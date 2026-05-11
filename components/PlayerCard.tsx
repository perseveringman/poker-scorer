"use client";

import type { Player } from "@/lib/types";
import clsx from "clsx";

interface Props {
  player: Player;
  isHost: boolean;
  isSelf: boolean;
  currentBet: number;           // 本轮已下注
  isAllIn: boolean;             // 本手是否已 all-in
  callDiff: number;             // 需要跟注的差额（0 = 无需跟注）
  chipUnit: number;
  handInProgress: boolean;
  onBuyIn: () => void;
  onBet: () => void;
  onCheckout: () => void;
}

export function PlayerCard({
  player,
  isHost,
  isSelf,
  currentBet,
  isAllIn,
  callDiff,
  chipUnit,
  handInProgress,
  onBuyIn,
  onBet,
  onCheckout,
}: Props) {
  const isCheckedOut = !!player.checkout;

  // 显示数据：如果已离场用快照，否则用实时数据
  const displayChips = isCheckedOut
    ? player.checkout!.finalChips
    : player.currentChips;
  const displayBought = isCheckedOut
    ? player.checkout!.totalBoughtIn
    : player.totalBoughtIn;
  const pnl = displayChips - displayBought;
  const pnlMoney = pnl * chipUnit;

  return (
    <div
      className={clsx(
        "rounded-xl border p-4 transition",
        isCheckedOut
          ? "bg-slate-800/40 border-slate-700 opacity-70"
          : isSelf
          ? "bg-emerald-900/30 border-emerald-500 shadow-lg shadow-emerald-500/10"
          : "bg-slate-800/60 border-slate-700"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            className={clsx(
              "w-2 h-2 rounded-full shrink-0",
              isCheckedOut
                ? "bg-slate-600"
                : player.online
                ? "bg-emerald-400"
                : "bg-slate-500"
            )}
          />
          <span
            className={clsx(
              "font-semibold truncate",
              isCheckedOut ? "text-slate-400 line-through" : "text-white"
            )}
          >
            {player.name}
          </span>
          {isSelf && !isCheckedOut && (
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">
              你
            </span>
          )}
          {isHost && (
            <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded">
              房主
            </span>
          )}
          {isAllIn && !isCheckedOut && (
            <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-semibold animate-pulse">
              ALL-IN
            </span>
          )}
          {isCheckedOut && (
            <span className="text-[10px] bg-slate-600 text-white px-1.5 py-0.5 rounded">
              已离场
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row
          label={isCheckedOut ? "离场筹码" : "当前筹码"}
          value={displayChips}
          highlight
        />
        <Row label="累计买入" value={displayBought} muted />
        <Row
          label={isCheckedOut ? "最终盈亏" : "盈亏"}
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
        {handInProgress && currentBet > 0 && !isCheckedOut && (
          <div className="mt-2 pt-2 border-t border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1">本轮下注</div>
            <div className="text-lg font-bold text-amber-400">
              {currentBet}
            </div>
          </div>
        )}
      </div>

      {/* 按钮区 */}
      {isCheckedOut ? (
        <div className="mt-3 text-center text-[11px] text-slate-500">
          已于{" "}
          {new Date(player.checkout!.at).toLocaleTimeString("zh-CN", {
            hour12: false,
          })}{" "}
          结算离场
        </div>
      ) : isSelf ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
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
                {isAllIn
                  ? "已 All-in"
                  : callDiff > 0
                  ? `跟/加注（差 ${callDiff}）`
                  : "下注"}
              </button>
            )}
          </div>
          <button
            onClick={onCheckout}
            className="w-full py-1.5 text-xs bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-300 hover:text-white rounded-md transition"
          >
            🚪 结算离场
          </button>
        </div>
      ) : (
        handInProgress &&
        isAllIn && (
          <div className="mt-3 text-center text-[11px] text-rose-400 font-semibold">
            已 All-in
          </div>
        )
      )}
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
