// ============================================================
// 领域模型 —— 所有前后端共享的类型定义
// ============================================================

export interface Room {
  id: string;           // 6 位房间号
  name: string;
  hostId: string;       // 创建者，仅用于标识「谁是房主」，不做权限校验
  chipUnit: number;     // 1 筹码 = 多少钱（用于汇总结算展示）
  status: "waiting" | "playing" | "ended";
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  seat: number;
  initialChips: number;   // 初始买入筹码
  currentChips: number;   // 当前手上剩余筹码
  totalBoughtIn: number;  // 累计从银行买入筹码（含 initialChips）
  online: boolean;
  joinedAt: number;
  /** 已结算离场则为该快照，否则为 null */
  checkout: CheckoutSnapshot | null;
}

/** 玩家结算离场的快照 */
export interface CheckoutSnapshot {
  /** 离场时手上的筹码数 */
  finalChips: number;
  /** 离场时累计买入 */
  totalBoughtIn: number;
  /** 盈亏（筹码）= finalChips - totalBoughtIn */
  pnlChips: number;
  /** 盈亏（金额）= pnlChips × chipUnit */
  pnlMoney: number;
  /** 离场时间 */
  at: number;
}

export interface BuyIn {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  operatorId: string;
  operatorName: string;
  timestamp: number;
}

export interface Bet {
  playerId: string;
  amount: number;   // 本手内累计下注
}

export interface Winner {
  playerId: string;
  amount: number;   // 从底池中分到多少
}

export interface Hand {
  id: string;
  handNumber: number;
  status: "betting" | "settled";
  bets: Record<string, number>;      // playerId → 累计下注筹码
  /** 标记哪些下注者 all-in 了（下注后手上筹码归零）。用于结算时计算边池 */
  allInIds: string[];
  winners: Winner[];
  potTotal: number;
  /** 结算后保存的池子拆分明细（供历史回溯） */
  potBreakdown?: SettledPot[];
  startedAt: number;
  settledAt?: number;
}

export interface SettledPot {
  label: string;            // "主池" / "边池 1"...
  amount: number;
  eligibleIds: string[];
  winners: Winner[];        // 本池的赢家和分到多少
}

// 操作日志（用于 undo 和审计）
export type LogEntry =
  | { type: "room:create"; ts: number; operatorId: string; operatorName: string }
  | { type: "player:join"; ts: number; operatorId: string; operatorName: string; playerId: string }
  | { type: "player:leave"; ts: number; operatorId: string; operatorName: string; playerId: string }
  | { type: "player:setInitial"; ts: number; operatorId: string; operatorName: string; playerId: string; amount: number }
  | { type: "bank:buyIn"; ts: number; operatorId: string; operatorName: string; playerId: string; amount: number; buyInId: string }
  | { type: "hand:start"; ts: number; operatorId: string; operatorName: string; handId: string; handNumber: number }
  | { type: "hand:bet"; ts: number; operatorId: string; operatorName: string; handId: string; playerId: string; delta: number }
  | { type: "hand:settle"; ts: number; operatorId: string; operatorName: string; handId: string; winners: Winner[] }
  | { type: "player:checkout"; ts: number; operatorId: string; operatorName: string; playerId: string; snapshot: CheckoutSnapshot };

// ============================================================
// 房间完整状态（SSE 全量同步 / API 返回）
// ============================================================
export interface RoomState {
  room: Room;
  players: Player[];
  hand: Hand | null;         // 当前进行中的手牌
  history: Hand[];           // 已结算手牌（倒序，最新在前，最多保留 50 条）
  buyIns: BuyIn[];           // 所有买入记录（倒序）
  logs: LogEntry[];          // 最近 50 条日志
}

// ============================================================
// WebSocket/SSE 消息协议
// ============================================================
export type ServerEvent =
  | { type: "snapshot"; state: RoomState }
  | { type: "patch"; state: RoomState }              // 简化：每次都推全量（房间小，省心）
  | { type: "ping"; ts: number }
  | { type: "error"; message: string };

// ============================================================
// 客户端请求 payload
// ============================================================
export interface CreateRoomReq {
  name: string;
  chipUnit: number;
  playerName: string;
  initialChips: number;
}

export interface JoinRoomReq {
  roomId: string;
  playerName: string;
  initialChips: number;
}

/** 结算请求：支持两种格式
 * - 简单模式（无 all-in）：winners 直接指定每人赢多少（总和 = potTotal）
 * - 多池模式（有 all-in）：pots 指定每个池子的赢家 ID 列表；服务端自动拆池和分钱
 */
export type SettleRequest =
  | { mode: "simple"; winners: Winner[] }
  | { mode: "pots"; pots: { potIndex: number; winnerIds: string[] }[] };

export type ActionReq =
  | { type: "bank:buyIn"; roomId: string; operatorId: string; playerId: string; amount: number }
  | { type: "hand:start"; roomId: string; operatorId: string }
  | { type: "hand:bet"; roomId: string; operatorId: string; playerId: string; delta: number }
  | { type: "hand:settle"; roomId: string; operatorId: string; settle: SettleRequest }
  | { type: "hand:cancel"; roomId: string; operatorId: string }    // 取消未结算的手牌
  | { type: "undo"; roomId: string; operatorId: string }
  | { type: "player:leave"; roomId: string; operatorId: string }
  | { type: "player:checkout"; roomId: string; operatorId: string }  // 结算离场（仅本人）
  | { type: "room:end"; roomId: string; operatorId: string };
