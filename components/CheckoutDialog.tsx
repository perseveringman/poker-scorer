"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import type { Player } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  me: Player | null;
  chipUnit: number;
  onConfirm: () => Promise<unknown>;
}

export function CheckoutDialog({ open, onClose, me, chipUnit, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  const pnl = me.currentChips - me.totalBoughtIn;
  const pnlMoney = pnl * chipUnit;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="结算离场">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          将你当前的筹码兑现为盈亏快照，离场后不再参与本局。
          <br />
          <span className="text-slate-500 text-xs">
            确认前请收齐应得/应付的现金。如果本手正在进行且你已下注，需等本手结算后再来。
          </span>
        </p>

        <div className="bg-slate-900 rounded-lg divide-y divide-slate-800">
          <Row label="当前筹码" value={me.currentChips} />
          <Row label="累计买入" value={me.totalBoughtIn} />
          <Row
            label="盈亏（筹码）"
            value={
              <span
                className={
                  pnl > 0
                    ? "text-emerald-400"
                    : pnl < 0
                    ? "text-rose-400"
                    : "text-slate-300"
                }
              >
                {pnl > 0 ? "+" : ""}
                {pnl}
              </span>
            }
          />
          <Row
            label="折算金额"
            value={
              <span
                className={
                  pnlMoney > 0
                    ? "text-emerald-400 text-lg font-bold"
                    : pnlMoney < 0
                    ? "text-rose-400 text-lg font-bold"
                    : "text-slate-300 text-lg font-bold"
                }
              >
                {pnlMoney > 0 ? "+" : ""}
                {pnlMoney.toFixed(2)} 元
              </span>
            }
          />
        </div>

        {pnl > 0 && (
          <div className="text-xs bg-emerald-950/40 border border-emerald-900 text-emerald-300 px-3 py-2 rounded">
            💰 你应从银行/输家收取 {pnlMoney.toFixed(2)} 元
          </div>
        )}
        {pnl < 0 && (
          <div className="text-xs bg-rose-950/40 border border-rose-900 text-rose-300 px-3 py-2 rounded">
            💸 你应向银行/赢家支付 {Math.abs(pnlMoney).toFixed(2)} 元
          </div>
        )}

        {error && (
          <div className="text-rose-400 text-sm bg-rose-950/40 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg text-white"
          >
            再等等
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold"
          >
            {submitting ? "处理中..." : "确认离场"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center px-3 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
