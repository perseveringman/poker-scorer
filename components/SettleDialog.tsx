"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import type { Hand, Player, Winner } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  hand: Hand | null;
  players: Player[];
  onSubmit: (winners: Winner[]) => Promise<unknown>;
}

export function SettleDialog({ open, onClose, hand, players, onSubmit }: Props) {
  // selected: playerId → amount
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pot = hand?.potTotal ?? 0;

  useEffect(() => {
    if (open) {
      setSelected({});
      setError(null);
    }
  }, [open]);

  const toggle = (playerId: string) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[playerId] !== undefined) {
        delete next[playerId];
      } else {
        next[playerId] = 0;
      }
      // 重新平分
      const ids = Object.keys(next);
      if (ids.length > 0) {
        const base = Math.floor(pot / ids.length);
        const remainder = pot - base * ids.length;
        ids.forEach((id, i) => {
          next[id] = base + (i === 0 ? remainder : 0);
        });
      }
      return next;
    });
  };

  const updateAmount = (playerId: string, amount: number) => {
    setSelected((s) => ({ ...s, [playerId]: amount }));
  };

  const submit = async () => {
    const winners = Object.entries(selected)
      .filter(([, v]) => v > 0)
      .map(([playerId, amount]) => ({ playerId, amount }));
    if (winners.length === 0) return setError("请选择赢家");
    const total = winners.reduce((s, w) => s + w.amount, 0);
    if (total !== pot) {
      return setError(`赢家分得总和 ${total} 必须等于底池 ${pot}`);
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(winners);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 只显示有下注的玩家（也允许选其他人，以防边池场景）
  const contributed = players.filter((p) => (hand?.bets[p.id] ?? 0) > 0);
  const others = players.filter((p) => (hand?.bets[p.id] ?? 0) === 0);

  return (
    <Dialog open={open} onClose={onClose} title="结算本手">
      <div className="space-y-4">
        <div className="bg-slate-900 rounded-lg p-3 flex justify-between">
          <span className="text-slate-400 text-sm">底池</span>
          <span className="text-amber-400 text-xl font-bold font-mono">
            {pot}
          </span>
        </div>

        <div>
          <div className="text-sm text-slate-300 mb-2">
            勾选赢家（多选自动平分，可手动调整）
          </div>
          <div className="space-y-2">
            {contributed.map((p) => (
              <WinnerRow
                key={p.id}
                player={p}
                betAmount={hand?.bets[p.id] ?? 0}
                checked={selected[p.id] !== undefined}
                amount={selected[p.id] ?? 0}
                onToggle={() => toggle(p.id)}
                onChange={(v) => updateAmount(p.id, v)}
              />
            ))}
            {others.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                  显示未下注玩家（罕见场景）
                </summary>
                <div className="mt-2 space-y-2">
                  {others.map((p) => (
                    <WinnerRow
                      key={p.id}
                      player={p}
                      betAmount={0}
                      checked={selected[p.id] !== undefined}
                      amount={selected[p.id] ?? 0}
                      onToggle={() => toggle(p.id)}
                      onChange={(v) => updateAmount(p.id, v)}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        <SumRow selected={selected} pot={pot} />

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
          {submitting ? "结算中..." : "确认结算"}
        </button>
      </div>
    </Dialog>
  );
}

function WinnerRow({
  player,
  betAmount,
  checked,
  amount,
  onToggle,
  onChange,
}: {
  player: Player;
  betAmount: number;
  checked: boolean;
  amount: number;
  onToggle: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-2.5">
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 accent-emerald-500"
        />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm truncate">{player.name}</div>
          <div className="text-xs text-slate-500">下注 {betAmount}</div>
        </div>
      </label>
      {checked && (
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-right text-white font-mono text-sm focus:border-emerald-500 outline-none"
        />
      )}
    </div>
  );
}

function SumRow({
  selected,
  pot,
}: {
  selected: Record<string, number>;
  pot: number;
}) {
  const total = Object.values(selected).reduce((s, v) => s + v, 0);
  const diff = pot - total;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">已分配 / 底池</span>
      <span className={diff === 0 ? "text-emerald-400" : "text-amber-400"}>
        <span className="font-mono">{total}</span>
        <span className="text-slate-500"> / </span>
        <span className="font-mono">{pot}</span>
        {diff !== 0 && (
          <span className="ml-2 text-xs text-rose-400">
            (差 {diff > 0 ? "+" : ""}
            {diff})
          </span>
        )}
      </span>
    </div>
  );
}
