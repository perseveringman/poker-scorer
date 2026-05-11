"use client";

import { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import type { Player } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  target: Player | null;
  currentBet: number;
  onSubmit: (delta: number) => Promise<unknown>;
}

export function BetDialog({ open, onClose, target, currentBet, onSubmit }: Props) {
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

  const submit = async () => {
    if (amount <= 0) return setError("加注金额必须大于 0");
    if (amount > maxCanAdd) return setError(`筹码不足（剩余 ${maxCanAdd}）`);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(amount);
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
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-900 rounded-lg p-3">
            <div className="text-slate-400 text-xs">剩余筹码</div>
            <div className="text-white text-lg font-mono font-bold">{maxCanAdd}</div>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <div className="text-slate-400 text-xs">本轮已下注</div>
            <div className="text-amber-400 text-lg font-mono font-bold">
              {currentBet}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-2">本次加注</label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-amber-500 outline-none"
            autoFocus
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
          onClick={submit}
          disabled={submitting}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 rounded-lg text-white font-semibold transition"
        >
          {submitting ? "处理中..." : `确认下注 +${amount}`}
        </button>
      </div>
    </Dialog>
  );
}
