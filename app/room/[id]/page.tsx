"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoomStream } from "@/hooks/useRoomStream";
import { apiAction, apiJoinRoom } from "@/lib/api";
import {
  getIdentity,
  getLastName,
  saveIdentity,
  saveLastName,
} from "@/lib/session";
import { PlayerCard } from "@/components/PlayerCard";
import { BuyInDialog } from "@/components/BuyInDialog";
import { BetDialog } from "@/components/BetDialog";
import { SettleDialog } from "@/components/SettleDialog";
import { HistoryPanel } from "@/components/HistoryPanel";
import type { Player, SettleRequest } from "@/lib/types";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params?.id?.toUpperCase();

  const [identity, setIdentity] = useState<{ playerId: string } | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinChips, setJoinChips] = useState(1000);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [buyInTarget, setBuyInTarget] = useState<Player | null>(null);
  const [betTarget, setBetTarget] = useState<Player | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 读取本地身份；没有则提示加入
  useEffect(() => {
    if (!roomId) return;
    const id = getIdentity(roomId);
    if (id) {
      setIdentity({ playerId: id.playerId });
    } else {
      setJoinName(getLastName());
      setShowJoin(true);
    }
  }, [roomId]);

  const { state, status, error } = useRoomStream(
    identity && roomId ? roomId : undefined
  );

  const self = useMemo(
    () =>
      state?.players.find((p) => p.id === identity?.playerId) ?? null,
    [state, identity]
  );

  // 如果带着旧身份但房间里找不到（房间过期重建等），提示重新加入
  useEffect(() => {
    if (state && identity && !self) {
      setShowJoin(true);
      setJoinName(getLastName());
    }
  }, [state, identity, self]);

  const joinNow = async () => {
    if (!roomId) return;
    if (!joinName.trim()) return setJoinError("请输入昵称");
    if (joinChips <= 0) return setJoinError("初始筹码必须大于 0");
    setJoining(true);
    setJoinError(null);
    try {
      const res = await apiJoinRoom({
        roomId,
        playerName: joinName.trim(),
        initialChips: joinChips,
      });
      saveIdentity(roomId, res.playerId, joinName.trim());
      saveLastName(joinName.trim());
      setIdentity({ playerId: res.playerId });
      setShowJoin(false);
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const copyRoomId = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setToast("房间号已复制");
      setTimeout(() => setToast(null), 1500);
    } catch {
      /* noop */
    }
  };

  // ---- 加入弹窗 ----
  if (showJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-1">加入房间</h2>
          <div className="text-slate-400 font-mono text-lg mb-4 tracking-widest">
            {roomId}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">昵称</label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={12}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">
                初始买入筹码
              </label>
              <input
                type="number"
                value={joinChips}
                min={1}
                onChange={(e) => setJoinChips(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-emerald-500"
              />
            </div>
            {joinError && (
              <div className="text-rose-400 text-sm">{joinError}</div>
            )}
            <button
              onClick={joinNow}
              disabled={joining}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold"
            >
              {joining ? "加入中..." : "进入房间"}
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2 text-sm text-slate-400 hover:text-white"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 加载中 ----
  if (!state || !identity) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        {error ? (
          <div className="text-center">
            <div className="text-rose-400 mb-3">{error}</div>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
            >
              返回首页
            </button>
          </div>
        ) : (
          <div>{status === "connecting" ? "连接中..." : "加载中..."}</div>
        )}
      </div>
    );
  }

  const { room, players, hand, history, buyIns, logs } = state;
  const handInProgress = !!hand && hand.status === "betting";
  const chipUnit = room.chipUnit;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold truncate">{room.name}</h1>
              <ConnectionBadge status={status} />
            </div>
            <button
              onClick={copyRoomId}
              className="text-xs text-slate-400 hover:text-white font-mono tracking-wider"
              title="点击复制房间号"
            >
              房号 {roomId} 📋
            </button>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md text-white"
            >
              {showHistory ? "返回桌面" : "历史"}
            </button>
            <button
              onClick={() => router.push(`/room/${roomId}/summary`)}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md text-white"
            >
              汇总
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {showHistory ? (
          <HistoryPanel
            history={history}
            buyIns={buyIns}
            logs={logs}
            players={players}
          />
        ) : (
          <>
            {/* Hand info bar */}
            <div className="bg-gradient-to-r from-emerald-900/60 to-slate-800 rounded-xl p-4 border border-emerald-800/40">
              {handInProgress && hand ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-emerald-300 uppercase tracking-wider">
                      进行中 · 第 {hand.handNumber} 手
                    </div>
                    <div className="text-3xl font-bold text-white mt-1 font-mono">
                      底池 {hand.potTotal}
                      <span className="text-sm text-slate-400 ml-2">
                        ({(hand.potTotal * chipUnit).toFixed(2)} 元)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        act(() =>
                          apiAction({
                            type: "hand:cancel",
                            roomId: room.id,
                            operatorId: identity.playerId,
                          })
                        )
                      }
                      className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                    >
                      取消本手
                    </button>
                    <button
                      onClick={() => setShowSettle(true)}
                      disabled={hand.potTotal === 0}
                      className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold"
                    >
                      结算本手 →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-slate-300 text-sm">
                    {history.length === 0
                      ? "准备好了就开始第一手"
                      : `已完成 ${history.length} 手，准备开新一手`}
                  </div>
                  <button
                    onClick={() =>
                      act(() =>
                        apiAction({
                          type: "hand:start",
                          roomId: room.id,
                          operatorId: identity.playerId,
                        })
                      )
                    }
                    className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold"
                  >
                    开始新一手 →
                  </button>
                </div>
              )}
            </div>

            {/* Undo */}
            {logs.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    act(() =>
                      apiAction({
                        type: "undo",
                        roomId: room.id,
                        operatorId: identity.playerId,
                      })
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded-md"
                >
                  ↶ 撤销上一步
                </button>
              </div>
            )}

            {/* Players grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isHost={p.id === room.hostId}
                  isSelf={p.id === identity.playerId}
                  currentBet={hand?.bets[p.id] ?? 0}
                  isAllIn={hand?.allInIds?.includes(p.id) ?? false}
                  chipUnit={chipUnit}
                  handInProgress={handInProgress}
                  onBuyIn={() => setBuyInTarget(p)}
                  onBet={() => setBetTarget(p)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Dialogs */}
      <BuyInDialog
        open={!!buyInTarget}
        target={buyInTarget}
        onClose={() => setBuyInTarget(null)}
        onSubmit={(amount) =>
          apiAction({
            type: "bank:buyIn",
            roomId: room.id,
            operatorId: identity.playerId,
            playerId: buyInTarget!.id,
            amount,
          })
        }
      />
      <BetDialog
        open={!!betTarget}
        target={betTarget}
        currentBet={betTarget ? hand?.bets[betTarget.id] ?? 0 : 0}
        onClose={() => setBetTarget(null)}
        onSubmit={(delta) =>
          apiAction({
            type: "hand:bet",
            roomId: room.id,
            operatorId: identity.playerId,
            playerId: betTarget!.id,
            delta,
          })
        }
      />
      <SettleDialog
        open={showSettle}
        hand={hand}
        players={players}
        onClose={() => setShowSettle(false)}
        onSubmit={(settle: SettleRequest) =>
          apiAction({
            type: "hand:settle",
            roomId: room.id,
            operatorId: identity.playerId,
            settle,
          })
        }
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg shadow-xl text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    connecting: { color: "bg-amber-500", label: "连接中" },
    connected: { color: "bg-emerald-500", label: "已连接" },
    disconnected: { color: "bg-slate-500", label: "重连中" },
    error: { color: "bg-rose-500", label: "错误" },
  };
  const s = map[status] ?? map.connecting;
  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-300">
      <span className={`w-1.5 h-1.5 rounded-full ${s.color} animate-pulse`} />
      {s.label}
    </span>
  );
}
