"use client";

import { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import type { Player } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  target: Player | null;
  onSubmit: (amount: number) => Promise<unknown>;
}

export function BuyInDialog({ open, onClose, target, onSubmit }: Props) {
  const [amount, setAmount] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(target?.initialChips ?? 1000);
      setError(null);
    }
  }, [open, target]);

  const submit = async () => {
    if (amount <= 0) return setError("买入金额必须大于 0");
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
      title={target ? `为 ${target.name} 买入筹码` : "银行买入"}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-2">买入筹码数</label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-emerald-500 outline-none"
            autoFocus
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[500, 1000, 2000, 5000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-md text-white"
            >
              {v}
            </button>
          ))}
        </div>
        {error && (
          <div className="text-rose-400 text-sm bg-rose-950/40 px-3 py-2 rounded">
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold transition"
        >
          {submitting ? "处理中..." : `确认买入 ${amount} 筹码`}
        </button>
      </div>
    </Dialog>
  );
}
