"use client";

import type { Player } from "@/lib/types";
import clsx from "clsx";

interface Props {
  player: Player;
  isHost: boolean;
  isSelf: boolean;
  currentBet: number;           // 本轮已下注
  isAllIn: boolean;             // 本手是否已 all-in
  chipUnit: number;
  handInProgress: boolean;
  onBuyIn: () => void;
  onBet: () => void;
}

export function PlayerCard({
  player,
  isHost,
  isSelf,
  currentBet,
  isAllIn,
  chipUnit,
  handInProgress,
  onBuyIn,
  onBet,
}: Props) {
  const pnl = player.currentChips - player.totalBoughtIn;
  const pnlMoney = pnl * chipUnit;

  return (
    <div
      className={clsx(
        "rounded-xl border p-4 transition",
        isSelf
          ? "bg-emerald-900/30 border-emerald-500 shadow-lg shadow-emerald-500/10"
          : "bg-slate-800/60 border-slate-700"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={clsx(
              "w-2 h-2 rounded-full shrink-0",
              player.online ? "bg-emerald-400" : "bg-slate-500"
            )}
          />
          <span className="font-semibold text-white truncate">
            {player.name}
          </span>
          {isSelf && (
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">
              你
            </span>
          )}
          {isHost && (
            <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded">
              房主
            </span>
          )}
          {isAllIn && (
            <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-semibold animate-pulse">
              ALL-IN
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label="当前筹码" value={player.currentChips} highlight />
        <Row label="累计买入" value={player.totalBoughtIn} muted />
        <Row
          label="盈亏"
          value={
            <span
              className={clsx(
                pnl > 0 && "text-emerald-400",
                pnl < 0 && "text-rose-400",
                pnl === 0 && "text-slate-400"
              )}
            >
              {pnl > 0 ? "+" : ""}
              {pnl} ({pnl > 0 ? "+" : ""}
              {pnlMoney.toFixed(2)} 元)
            </span>
          }
        />
        {handInProgress && currentBet > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1">本轮下注</div>
            <div className="text-lg font-bold text-amber-400">
              {currentBet}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onBuyIn}
          className="flex-1 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition"
        >
          + 买入
        </button>
        {handInProgress && (
          <button
            onClick={onBet}
            disabled={isAllIn}
            className="flex-1 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition"
          >
            {isAllIn ? "已 All-in" : "下注"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400 text-xs">{label}</span>
      <span
        className={clsx(
          "font-mono",
          highlight && "text-white text-base font-bold",
          muted && "text-slate-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}
