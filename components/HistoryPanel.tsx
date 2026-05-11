"use client";

import type { BuyIn, Hand, LogEntry, Player } from "@/lib/types";

interface Props {
  history: Hand[];
  buyIns: BuyIn[];
  logs: LogEntry[];
  players: Player[];
}

export function HistoryPanel({ history, buyIns, logs, players }: Props) {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "未知";

  return (
    <div className="space-y-4">
      <Section title={`已结算手牌 (${history.length})`}>
        {history.length === 0 && (
          <div className="text-slate-500 text-sm">暂无</div>
        )}
        <div className="space-y-2">
          {history.map((h) => (
            <div
              key={h.id}
              className="bg-slate-900/60 rounded-lg p-3 text-sm border border-slate-800"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">
                  第 {h.handNumber} 手
                  {h.potBreakdown && h.potBreakdown.length > 1 && (
                    <span className="ml-2 text-[10px] bg-rose-700 text-white px-1.5 py-0.5 rounded">
                      ALL-IN
                    </span>
                  )}
                </span>
                <span className="text-amber-400 font-mono">
                  底池 {h.potTotal}
                </span>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <div>
                  下注：
                  {Object.entries(h.bets)
                    .map(([pid, v]) => `${nameOf(pid)} ${v}`)
                    .join(" · ") || "无"}
                </div>
                {h.potBreakdown && h.potBreakdown.length > 1 ? (
                  <div className="space-y-0.5 mt-1">
                    {h.potBreakdown.map((p, i) => (
                      <div key={i} className="text-emerald-400">
                        {p.label}（{p.amount}）→{" "}
                        {p.winners
                          .map((w) => `${nameOf(w.playerId)} +${w.amount}`)
                          .join(" · ") || "无"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-emerald-400">
                    赢家：
                    {h.winners
                      .map((w) => `${nameOf(w.playerId)} +${w.amount}`)
                      .join(" · ") || "无"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`银行买入记录 (${buyIns.length})`}>
        {buyIns.length === 0 && (
          <div className="text-slate-500 text-sm">暂无</div>
        )}
        <div className="space-y-1.5 text-sm">
          {buyIns.slice(0, 20).map((b) => (
            <div
              key={b.id}
              className="flex justify-between bg-slate-900/60 px-3 py-1.5 rounded-md"
            >
              <span className="text-slate-300 truncate">
                {b.playerName}
                {b.operatorId !== b.playerId && (
                  <span className="text-slate-500 text-xs ml-1">
                    (由 {b.operatorName} 操作)
                  </span>
                )}
              </span>
              <span className="text-emerald-400 font-mono shrink-0">
                +{b.amount}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="操作日志">
        {logs.length === 0 && (
          <div className="text-slate-500 text-sm">暂无</div>
        )}
        <div className="space-y-1 text-xs max-h-60 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-slate-400">
              <span className="text-slate-600 mr-2">
                {new Date(l.ts).toLocaleTimeString("zh-CN", {
                  hour12: false,
                })}
              </span>
              <span>{describeLog(l, nameOf)}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function describeLog(l: LogEntry, nameOf: (id: string) => string): string {
  switch (l.type) {
    case "room:create":
      return `${l.operatorName} 创建了房间`;
    case "player:join":
      return `${nameOf(l.playerId)} 加入`;
    case "player:leave":
      return `${nameOf(l.playerId)} 离开`;
    case "player:setInitial":
      return `${l.operatorName} 设置 ${nameOf(l.playerId)} 初始 ${l.amount}`;
    case "bank:buyIn":
      return `${l.operatorName} 为 ${nameOf(l.playerId)} 买入 ${l.amount}`;
    case "hand:start":
      return `${l.operatorName} 开始第 ${l.handNumber} 手`;
    case "hand:bet":
      return `${l.operatorName} 为 ${nameOf(l.playerId)} 下注 ${
        l.delta > 0 ? "+" : ""
      }${l.delta}`;
    case "hand:settle":
      return `${l.operatorName} 结算：${l.winners
        .map((w) => `${nameOf(w.playerId)} +${w.amount}`)
        .join(" · ")}`;
    case "player:checkout":
      return `${l.operatorName} 结算离场（${
        l.snapshot.pnlChips >= 0 ? "+" : ""
      }${l.snapshot.pnlChips} 筹码）`;
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-2">{title}</h4>
      {children}
    </div>
  );
}
