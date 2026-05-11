"use client";

import { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import type { Player } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  target: Player | null;
  currentBet: number;                    // 本人本轮已下注
  allBets: Record<string, number>;       // 本手所有人的下注（用于算最高注）
  onSubmit: (delta: number) => Promise<unknown>;
}

export function BetDialog({
  open,
  onClose,
  target,
  currentBet,
  allBets,
  onSubmit,
}: Props) {
  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(100);
      setError(null);
    }
  }, [open]);

  const maxCanAdd = target?.currentChips ?? 0;

  // 计算最高注 & 跟注差额
  const highestBet = Math.max(0, ...Object.values(allBets));
  const callDiff = Math.max(0, highestBet - currentBet);
  // 跟注实际需要的筹码（筹码不够则 all-in 跟）
  const effectiveCall = Math.min(callDiff, maxCanAdd);
  const isShortCall = callDiff > 0 && callDiff > maxCanAdd; // 要 all-in 才能跟

  const submit = async (delta?: number) => {
    const value = delta ?? amount;
    if (value <= 0) return setError("加注金额必须大于 0");
    if (value > maxCanAdd) return setError(`筹码不足（剩余 ${maxCanAdd}）`);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={target ? `${target.name} 下注` : "下注"}
    >
      <div className="space-y-4">
        {/* 状态面板 */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-slate-900 rounded-lg p-2.5">
            <div className="text-slate-400 text-[11px]">剩余筹码</div>
            <div className="text-white text-base font-mono font-bold">
              {maxCanAdd}
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-2.5">
            <div className="text-slate-400 text-[11px]">我已下注</div>
            <div className="text-amber-400 text-base font-mono font-bold">
              {currentBet}
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-2.5">
            <div className="text-slate-400 text-[11px]">桌面最高</div>
            <div className="text-rose-300 text-base font-mono font-bold">
              {highestBet}
            </div>
          </div>
        </div>

        {/* 跟注快捷区 */}
        <CallPanel
          callDiff={callDiff}
          effectiveCall={effectiveCall}
          isShortCall={isShortCall}
          maxCanAdd={maxCanAdd}
          submitting={submitting}
          onCall={() => submit(effectiveCall)}
        />

        {/* 加注区 */}
        <div className="border-t border-slate-700 pt-4">
          <label className="block text-sm text-slate-300 mb-2">
            加注金额（高于跟注即 Raise）
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-amber-500 outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[50, 100, 200, 500, 1000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              disabled={v > maxCanAdd}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-md text-white"
            >
              +{v}
            </button>
          ))}
          <button
            onClick={() => setAmount(maxCanAdd)}
            disabled={maxCanAdd <= 0}
            className="px-3 py-1.5 text-sm bg-rose-700 hover:bg-rose-600 disabled:bg-slate-800 rounded-md text-white"
          >
            All-in
          </button>
        </div>

        {error && (
          <div className="text-rose-400 text-sm bg-rose-950/40 px-3 py-2 rounded">
            {error}
          </div>
        )}
        <button
          onClick={() => submit()}
          disabled={submitting}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 rounded-lg text-white font-semibold transition"
        >
          {submitting ? "处理中..." : `确认加注 +${amount}`}
        </button>
      </div>
    </Dialog>
  );
}

// ============================================================
// 跟注面板
// ============================================================
function CallPanel({
  callDiff,
  effectiveCall,
  isShortCall,
  maxCanAdd,
  submitting,
  onCall,
}: {
  callDiff: number;
  effectiveCall: number;
  isShortCall: boolean;
  maxCanAdd: number;
  submitting: boolean;
  onCall: () => void;
}) {
  // 还没人下注 / 或者自己已经是最高 → 不需要跟注
  if (callDiff === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-center">
        <div className="text-slate-400 text-xs">桌上无需跟注</div>
        <div className="text-slate-500 text-[11px] mt-0.5">
          你可以直接加注或 All-in
        </div>
      </div>
    );
  }

  // 筹码不够跟，只能 all-in 跟
  if (isShortCall) {
    return (
      <button
        onClick={onCall}
        disabled={submitting || maxCanAdd <= 0}
        className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 rounded-lg text-white font-semibold transition flex flex-col items-center"
      >
        <span>筹码不足 · All-in 跟注 +{effectiveCall}</span>
        <span className="text-[11px] opacity-80 font-normal">
          差额 {callDiff}，仅能补 {effectiveCall}
        </span>
      </button>
    );
  }

  // 正常跟注
  return (
    <button
      onClick={onCall}
      disabled={submitting}
      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold transition flex flex-col items-center"
    >
      <span>跟注 +{effectiveCall}</span>
      <span className="text-[11px] opacity-80 font-normal">
        补齐到桌面最高注
      </span>
    </button>
  );
}
