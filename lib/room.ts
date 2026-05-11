import { nanoid } from "nanoid";
import { redis, keys, ROOM_TTL_SECONDS } from "./redis";
import { splitPots, distributePots } from "./sidepots";
import type {
  ActionReq,
  BuyIn,
  Hand,
  LogEntry,
  Player,
  Room,
  RoomState,
  SettleRequest,
  SettledPot,
  Winner,
} from "./types";

// ============================================================
// 房间 ID 生成：6 位大写数字+字母（去除易混淆字符）
// ============================================================
const ROOM_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function genRoomId(): string {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return id;
}

// ============================================================
// 存取整个房间状态
// ============================================================
export async function readRoom(roomId: string): Promise<RoomState | null> {
  const data = await redis.get<RoomState>(keys.room(roomId));
  return data ?? null;
}

async function writeRoom(roomId: string, state: RoomState): Promise<void> {
  await redis.set(keys.room(roomId), state, { ex: ROOM_TTL_SECONDS });
  // 版本号自增，SSE 用它判断是否需要推送
  await redis.incr(keys.version(roomId));
  await redis.expire(keys.version(roomId), ROOM_TTL_SECONDS);
}

export async function getVersion(roomId: string): Promise<number> {
  const v = await redis.get<number>(keys.version(roomId));
  return v ?? 0;
}

// ============================================================
// 乐观锁式事务：读 → 修改 → 写。
// Upstash REST 不支持 WATCH/MULTI，我们用一个简单的自旋锁。
// 对于朋友局几乎不会有并发冲突，单次重试足够。
// ============================================================
async function withRoom<T>(
  roomId: string,
  mutator: (state: RoomState) => { state: RoomState; result: T } | Promise<{ state: RoomState; result: T }>
): Promise<T> {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    // 尝试获取锁（SET NX EX 2s，2 秒足够一次 mutation）
    const gotLock = await redis.set(keys.lock(roomId), "1", { nx: true, ex: 2 });
    if (gotLock) {
      try {
        const state = await readRoom(roomId);
        if (!state) throw new Error("房间不存在或已过期");
        const { state: newState, result } = await mutator(state);
        await writeRoom(roomId, newState);
        return result;
      } finally {
        await redis.del(keys.lock(roomId));
      }
    }
    // 等 50ms 再重试
    await new Promise((r) => setTimeout(r, 50 + i * 50));
  }
  throw new Error("系统繁忙，请重试");
}

// ============================================================
// 日志追加（最多保留 50 条）
// ============================================================
function appendLog(state: RoomState, entry: LogEntry): RoomState {
  const logs = [entry, ...state.logs].slice(0, 50);
  return { ...state, logs };
}

function operatorName(state: RoomState, operatorId: string): string {
  return state.players.find((p) => p.id === operatorId)?.name ?? "未知";
}

// ============================================================
// 创建房间
// ============================================================
export interface CreateRoomResult {
  roomId: string;
  playerId: string;
}

export async function createRoom(params: {
  name: string;
  chipUnit: number;
  playerName: string;
  initialChips: number;
}): Promise<CreateRoomResult> {
  const roomId = genRoomId();
  const playerId = nanoid(10);

  const room: Room = {
    id: roomId,
    name: params.name || `房间 ${roomId}`,
    hostId: playerId,
    chipUnit: params.chipUnit,
    status: "waiting",
    createdAt: Date.now(),
  };

  const host: Player = {
    id: playerId,
    name: params.playerName,
    seat: 1,
    initialChips: params.initialChips,
    currentChips: params.initialChips,
    totalBoughtIn: params.initialChips,
    online: true,
    joinedAt: Date.now(),
  };

  const initialLogs: LogEntry[] = [
    {
      type: "room:create",
      ts: Date.now(),
      operatorId: playerId,
      operatorName: host.name,
    },
    {
      type: "player:join",
      ts: Date.now(),
      operatorId: playerId,
      operatorName: host.name,
      playerId,
    },
  ];

  const state: RoomState = {
    room,
    players: [host],
    hand: null,
    history: [],
    buyIns: [
      {
        id: nanoid(8),
        playerId,
        playerName: host.name,
        amount: params.initialChips,
        operatorId: playerId,
        operatorName: host.name,
        timestamp: Date.now(),
      },
    ],
    logs: initialLogs,
  };

  await writeRoom(roomId, state);
  return { roomId, playerId };
}

// ============================================================
// 加入房间
// ============================================================
export async function joinRoom(params: {
  roomId: string;
  playerName: string;
  initialChips: number;
}): Promise<{ playerId: string }> {
  return withRoom(params.roomId, (state) => {
    if (state.room.status === "ended") {
      throw new Error("房间已结束");
    }
    // 如果同名玩家存在（断线重连场景），直接复用
    const existing = state.players.find((p) => p.name === params.playerName);
    if (existing) {
      return {
        state: {
          ...state,
          players: state.players.map((p) =>
            p.id === existing.id ? { ...p, online: true } : p
          ),
        },
        result: { playerId: existing.id },
      };
    }

    const playerId = nanoid(10);
    const player: Player = {
      id: playerId,
      name: params.playerName,
      seat: state.players.length + 1,
      initialChips: params.initialChips,
      currentChips: params.initialChips,
      totalBoughtIn: params.initialChips,
      online: true,
      joinedAt: Date.now(),
    };

    const buyIn: BuyIn = {
      id: nanoid(8),
      playerId,
      playerName: player.name,
      amount: params.initialChips,
      operatorId: playerId,
      operatorName: player.name,
      timestamp: Date.now(),
    };

    let next: RoomState = {
      ...state,
      players: [...state.players, player],
      buyIns: [buyIn, ...state.buyIns],
    };
    next = appendLog(next, {
      type: "player:join",
      ts: Date.now(),
      operatorId: playerId,
      operatorName: player.name,
      playerId,
    });

    return { state: next, result: { playerId } };
  });
}

// ============================================================
// 统一 action dispatcher
// ============================================================
export async function applyAction(req: ActionReq): Promise<void> {
  await withRoom(req.roomId, (state) => {
    const opName = operatorName(state, req.operatorId);
    const ts = Date.now();

    switch (req.type) {
      case "bank:buyIn": {
        if (req.amount <= 0) throw new Error("买入金额必须大于 0");
        const target = state.players.find((p) => p.id === req.playerId);
        if (!target) throw new Error("玩家不存在");

        const players = state.players.map((p) =>
          p.id === req.playerId
            ? {
                ...p,
                currentChips: p.currentChips + req.amount,
                totalBoughtIn: p.totalBoughtIn + req.amount,
              }
            : p
        );
        const buyIn: BuyIn = {
          id: nanoid(8),
          playerId: req.playerId,
          playerName: target.name,
          amount: req.amount,
          operatorId: req.operatorId,
          operatorName: opName,
          timestamp: ts,
        };
        let next: RoomState = {
          ...state,
          players,
          buyIns: [buyIn, ...state.buyIns],
        };
        next = appendLog(next, {
          type: "bank:buyIn",
          ts,
          operatorId: req.operatorId,
          operatorName: opName,
          playerId: req.playerId,
          amount: req.amount,
          buyInId: buyIn.id,
        });
        return { state: next, result: undefined };
      }

      case "hand:start": {
        if (state.hand && state.hand.status === "betting") {
          throw new Error("已有进行中的手牌，请先结算");
        }
        const handNumber = state.history.length + 1;
        const hand: Hand = {
          id: nanoid(8),
          handNumber,
          status: "betting",
          bets: {},
          allInIds: [],
          winners: [],
          potTotal: 0,
          startedAt: ts,
        };
        let next: RoomState = {
          ...state,
          hand,
          room: { ...state.room, status: "playing" },
        };
        next = appendLog(next, {
          type: "hand:start",
          ts,
          operatorId: req.operatorId,
          operatorName: opName,
          handId: hand.id,
          handNumber,
        });
        return { state: next, result: undefined };
      }

      case "hand:bet": {
        if (!state.hand || state.hand.status !== "betting") {
          throw new Error("当前没有进行中的手牌");
        }
        const player = state.players.find((p) => p.id === req.playerId);
        if (!player) throw new Error("玩家不存在");
        if (req.delta === 0) throw new Error("加注金额不能为 0");
        if (req.delta > 0 && player.currentChips < req.delta) {
          throw new Error("筹码不足");
        }
        const currentBet = state.hand.bets[req.playerId] ?? 0;
        const newBet = currentBet + req.delta;
        if (newBet < 0) throw new Error("不能减到负数");

        const players = state.players.map((p) =>
          p.id === req.playerId
            ? { ...p, currentChips: p.currentChips - req.delta }
            : p
        );
        const bets = { ...state.hand.bets, [req.playerId]: newBet };
        if (newBet === 0) delete bets[req.playerId];

        const potTotal = Object.values(bets).reduce((s, v) => s + v, 0);

        // 刷新 all-in 列表：
        // - 加注后筹码变 0 的人 → 加入
        // - 被 undo 或负向调整后又有筹码 → 移除（保持与实际状态一致）
        const allInSet = new Set(state.hand.allInIds);
        const updatedPlayer = players.find((p) => p.id === req.playerId);
        if (updatedPlayer) {
          if (updatedPlayer.currentChips === 0 && (bets[req.playerId] ?? 0) > 0) {
            allInSet.add(req.playerId);
          } else {
            allInSet.delete(req.playerId);
          }
        }

        const hand: Hand = {
          ...state.hand,
          bets,
          potTotal,
          allInIds: Array.from(allInSet),
        };

        let next: RoomState = { ...state, players, hand };
        next = appendLog(next, {
          type: "hand:bet",
          ts,
          operatorId: req.operatorId,
          operatorName: opName,
          handId: hand.id,
          playerId: req.playerId,
          delta: req.delta,
        });
        return { state: next, result: undefined };
      }

      case "hand:settle": {
        if (!state.hand || state.hand.status !== "betting") {
          throw new Error("当前没有进行中的手牌");
        }
        const { winners, potBreakdown } = resolveSettlement(state.hand, req.settle);

        // 将筹码发给赢家
        const winMap = new Map<string, number>();
        winners.forEach((w) =>
          winMap.set(w.playerId, (winMap.get(w.playerId) ?? 0) + w.amount)
        );
        const players = state.players.map((p) => {
          const win = winMap.get(p.id);
          return win ? { ...p, currentChips: p.currentChips + win } : p;
        });
        const settledHand: Hand = {
          ...state.hand,
          status: "settled",
          winners,
          potBreakdown,
          settledAt: ts,
        };
        const history = [settledHand, ...state.history].slice(0, 50);
        let next: RoomState = {
          ...state,
          players,
          hand: null,
          history,
        };
        next = appendLog(next, {
          type: "hand:settle",
          ts,
          operatorId: req.operatorId,
          operatorName: opName,
          handId: settledHand.id,
          winners,
        });
        return { state: next, result: undefined };
      }

      case "hand:cancel": {
        // 取消当前未结算的手牌：把下注筹码原路返还
        if (!state.hand || state.hand.status !== "betting") {
          throw new Error("没有可取消的手牌");
        }
        const players = state.players.map((p) => {
          const bet = state.hand!.bets[p.id] ?? 0;
          return bet ? { ...p, currentChips: p.currentChips + bet } : p;
        });
        const next: RoomState = {
          ...state,
          players,
          hand: null,
        };
        return { state: next, result: undefined };
      }

      case "undo": {
        return { state: undoLastAction(state), result: undefined };
      }

      case "player:leave": {
        const players = state.players.map((p) =>
          p.id === req.operatorId ? { ...p, online: false } : p
        );
        let next: RoomState = { ...state, players };
        next = appendLog(next, {
          type: "player:leave",
          ts,
          operatorId: req.operatorId,
          operatorName: opName,
          playerId: req.operatorId,
        });
        return { state: next, result: undefined };
      }

      case "room:end": {
        const next: RoomState = {
          ...state,
          room: { ...state.room, status: "ended" },
        };
        return { state: next, result: undefined };
      }
    }
  });
}

// ============================================================
// 结算解析：把 SettleRequest 转成最终 winners + 池明细
// ============================================================
function resolveSettlement(
  hand: Hand,
  settle: SettleRequest
): { winners: Winner[]; potBreakdown?: SettledPot[] } {
  const pot = hand.potTotal;

  if (settle.mode === "simple") {
    const winTotal = settle.winners.reduce((s, w) => s + w.amount, 0);
    if (winTotal !== pot) {
      throw new Error(`赢家分配总和 ${winTotal} 必须等于底池 ${pot}`);
    }
    if (settle.winners.some((w) => w.amount <= 0)) {
      throw new Error("每个赢家的金额必须大于 0");
    }
    return { winners: settle.winners };
  }

  // pots 模式：用 splitPots 拆池 + distributePots 分钱
  const pots = splitPots({
    bets: hand.bets,
    eligibleIds: Object.keys(hand.bets),   // 本版本假设所有下注者都没弃牌
  });

  // 校验每池赢家都属于 eligibleIds
  settle.pots.forEach((sel) => {
    const pot = pots[sel.potIndex];
    if (!pot) throw new Error(`池索引 ${sel.potIndex} 不存在`);
    if (sel.winnerIds.length === 0) {
      throw new Error(`${pot.label}未选择赢家`);
    }
    const invalid = sel.winnerIds.filter(
      (id) => !pot.eligibleIds.includes(id)
    );
    if (invalid.length > 0) {
      throw new Error(`${pot.label}的赢家必须在参与者中`);
    }
  });

  // 每个池都必须有赢家（不允许漏选）
  if (settle.pots.length !== pots.length) {
    throw new Error("请为每个池子选择赢家");
  }

  const result = distributePots(pots, settle.pots);

  // 合并同一玩家跨多池的获胜额
  const winners: Winner[] = Object.entries(result.distribution).map(
    ([playerId, amount]) => ({ playerId, amount })
  );

  const potBreakdown: SettledPot[] = pots.map((p, i) => ({
    label: p.label,
    amount: p.amount,
    eligibleIds: p.eligibleIds,
    winners: result.potResults[i]?.winners ?? [],
  }));

  // 数据校验：分出去的钱等于底池
  if (result.totalDistributed !== pot) {
    throw new Error(
      `内部错误：分配总和 ${result.totalDistributed} ≠ 底池 ${pot}`
    );
  }

  return { winners, potBreakdown };
}

// ============================================================
// Undo：反向执行最近一条日志
// ============================================================
function undoLastAction(state: RoomState): RoomState {
  const last = state.logs[0];
  if (!last) throw new Error("没有可撤销的操作");

  switch (last.type) {
    case "bank:buyIn": {
      const buyIn = state.buyIns.find((b) => b.id === last.buyInId);
      if (!buyIn) throw new Error("买入记录未找到");
      const players = state.players.map((p) =>
        p.id === buyIn.playerId
          ? {
              ...p,
              currentChips: p.currentChips - buyIn.amount,
              totalBoughtIn: p.totalBoughtIn - buyIn.amount,
            }
          : p
      );
      return {
        ...state,
        players,
        buyIns: state.buyIns.filter((b) => b.id !== buyIn.id),
        logs: state.logs.slice(1),
      };
    }
    case "hand:bet": {
      if (!state.hand || state.hand.id !== last.handId) {
        throw new Error("无法撤销：当前手牌已变化");
      }
      const currentBet = state.hand.bets[last.playerId] ?? 0;
      const newBet = currentBet - last.delta;
      const bets = { ...state.hand.bets };
      if (newBet <= 0) delete bets[last.playerId];
      else bets[last.playerId] = newBet;

      const players = state.players.map((p) =>
        p.id === last.playerId ? { ...p, currentChips: p.currentChips + last.delta } : p
      );
      const potTotal = Object.values(bets).reduce((s, v) => s + v, 0);

      // 撤销后这位玩家筹码恢复，若之前是 all-in 则移除；若其他人因其他原因仍为 0 也重新核对
      const allInSet = new Set(state.hand.allInIds);
      const updated = players.find((p) => p.id === last.playerId);
      if (updated) {
        if (updated.currentChips === 0 && (bets[last.playerId] ?? 0) > 0) {
          allInSet.add(last.playerId);
        } else {
          allInSet.delete(last.playerId);
        }
      }

      const hand: Hand = {
        ...state.hand,
        bets,
        potTotal,
        allInIds: Array.from(allInSet),
      };
      return { ...state, players, hand, logs: state.logs.slice(1) };
    }
    case "hand:start": {
      if (!state.hand || state.hand.id !== last.handId) {
        throw new Error("无法撤销：当前手牌已变化");
      }
      if (Object.keys(state.hand.bets).length > 0) {
        throw new Error("手牌已有下注，无法撤销开始；请先 cancel 或 settle");
      }
      return { ...state, hand: null, logs: state.logs.slice(1) };
    }
    case "hand:settle": {
      const lastHand = state.history[0];
      if (!lastHand || lastHand.id !== last.handId) {
        throw new Error("无法撤销：最近一手牌已变化");
      }
      // 把赢家筹码扣回去，恢复 hand 为 betting 状态
      const winMap = new Map<string, number>();
      lastHand.winners.forEach((w: Winner) =>
        winMap.set(w.playerId, (winMap.get(w.playerId) ?? 0) + w.amount)
      );
      const players = state.players.map((p) => {
        const win = winMap.get(p.id);
        return win ? { ...p, currentChips: p.currentChips - win } : p;
      });
      const restoredHand: Hand = {
        ...lastHand,
        status: "betting",
        winners: [],
        settledAt: undefined,
      };
      return {
        ...state,
        players,
        hand: restoredHand,
        history: state.history.slice(1),
        logs: state.logs.slice(1),
      };
    }
    default:
      throw new Error(`无法撤销此类型的操作：${last.type}`);
  }
}
