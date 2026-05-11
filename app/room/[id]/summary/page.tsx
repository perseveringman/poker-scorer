"use client";

import { useParams, useRouter } from "next/navigation";
import { useRoomStream } from "@/hooks/useRoomStream";
import { computeSettlements, effectiveBalance } from "@/lib/settlement";
import clsx from "clsx";

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params?.id?.toUpperCase();
  const { state, error } = useRoomStream(roomId);

  if (error) {
    return (
      <Centered>
        <div className="text-rose-400 mb-3">{error}</div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
        >
          返回首页
        </button>
      </Centered>
    );
  }

  if (!state) {
    return (
      <Centered>
        <div className="text-slate-400">加载中...</div>
      </Centered>
    );
  }

  const { room, players } = state;
  const chipUnit = room.chipUnit;
  const transfers = computeSettlements(players);
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "未知";

  const sortedPlayers = [...players].sort(
    (a, b) => effectiveBalance(b) - effectiveBalance(a)
  );

  return (
    <div className="min-h-screen p-4 pb-16 bg-slate-900">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push(`/room/${roomId}`)}
            className="text-slate-400 hover:text-white text-sm"
          >
            ← 返回房间
          </button>
          <div className="text-xs text-slate-500 font-mono">{roomId}</div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">本局汇总</h1>
        <p className="text-sm text-slate-400 mb-6">
          1 筹码 = {chipUnit} 元 · 共 {players.length} 人
        </p>

        {/* 盈亏榜 */}
        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-300 mb-3">盈亏榜</h2>
          <div className="space-y-2">
            {sortedPlayers.map((p, i) => {
              const diff = effectiveBalance(p);
              const money = diff * chipUnit;
              const chips = p.checkout ? p.checkout.finalChips : p.currentChips;
              const bought = p.checkout ? p.checkout.totalBoughtIn : p.totalBoughtIn;
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between",
                    p.checkout && "opacity-80"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={clsx(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        i === 0
                          ? "bg-amber-500 text-black"
                          : i === 1
                          ? "bg-slate-400 text-black"
                          : i === 2
                          ? "bg-amber-800 text-white"
                          : "bg-slate-700 text-slate-300"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate">
                          {p.name}
                        </span>
                        {p.checkout && (
                          <span className="text-[10px] bg-slate-600 text-white px-1.5 py-0.5 rounded shrink-0">
                            已离场
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        买入 {bought} · {p.checkout ? "离场" : "剩余"} {chips}
                      </div>
                    </div>
                  </div>
                  <div
                    className={clsx(
                      "text-right font-mono shrink-0",
                      diff > 0 && "text-emerald-400",
                      diff < 0 && "text-rose-400",
                      diff === 0 && "text-slate-400"
                    )}
                  >
                    <div className="text-lg font-bold">
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </div>
                    <div className="text-xs">
                      {money > 0 ? "+" : ""}
                      {money.toFixed(2)} 元
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 转账清单 */}
        <section>
          <h2 className="text-base font-semibold text-slate-300 mb-1">
            最简转账方案
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            算法自动最小化转账次数，照着转即可清账
          </p>
          {transfers.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-400 text-sm">
              ✨ 不用转账，所有人都不赔不赚
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <div
                  key={i}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="text-rose-400 truncate flex-1 text-right">
                    {nameOf(t.from)}
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="text-emerald-400 truncate flex-1">
                    {nameOf(t.to)}
                  </div>
                  <div className="font-mono font-bold text-white shrink-0 min-w-[80px] text-right">
                    {(t.amount * chipUnit).toFixed(2)} 元
                    <div className="text-xs text-slate-500 font-normal">
                      ({t.amount} 筹码)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 数据校验（零和应为 0） */}
        {(() => {
          const totalDiff = players.reduce(
            (s, p) => s + effectiveBalance(p),
            0
          );
          if (totalDiff !== 0) {
            return (
              <div className="mt-6 bg-amber-950/40 border border-amber-700 text-amber-300 rounded-lg p-3 text-sm">
                ⚠️ 数据异常：所有人盈亏总和应为 0，当前为 {totalDiff}
                。可能有未结算的手牌或 undo 遗留，请检查。
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">{children}</div>
    </div>
  );
}
