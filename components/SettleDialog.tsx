"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import { splitPots, type Pot } from "@/lib/sidepots";
import type { Hand, Player, SettleRequest, Winner } from "@/lib/types";
import clsx from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
  hand: Hand | null;
  players: Player[];
  onSubmit: (settle: SettleRequest) => Promise<unknown>;
}

export function SettleDialog({ open, onClose, hand, players, onSubmit }: Props) {
  const pot = hand?.potTotal ?? 0;
  const hasAllIn = (hand?.allInIds?.length ?? 0) > 0;

  // 拆好的池子（仅 all-in 场景使用）
  const pots = useMemo<Pot[]>(() => {
    if (!hand || !hasAllIn) return [];
    return splitPots({
      bets: hand.bets,
      eligibleIds: Object.keys(hand.bets),
    });
  }, [hand, hasAllIn]);

  // 模式：simple（手动填金额）或 pots（按池选赢家）
  const [mode, setMode] = useState<"simple" | "pots">("simple");

  // simple 模式：playerId → 分到的金额
  const [simpleSelected, setSimpleSelected] = useState<Record<string, number>>({});

  // pots 模式：potIndex → 赢家 ID 列表
  const [potSelections, setPotSelections] = useState<Record<number, string[]>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时重置
  useEffect(() => {
    if (open) {
      setMode(hasAllIn ? "pots" : "simple");
      setSimpleSelected({});
      setPotSelections({});
      setError(null);
    }
  }, [open, hasAllIn]);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "未知";

  // ========== simple 模式逻辑 ==========
  const toggleSimple = (playerId: string) => {
    setSimpleSelected((s) => {
      const next = { ...s };
      if (next[playerId] !== undefined) delete next[playerId];
      else next[playerId] = 0;
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
  const updateSimpleAmount = (playerId: string, amount: number) => {
    setSimpleSelected((s) => ({ ...s, [playerId]: amount }));
  };

  // ========== pots 模式逻辑 ==========
  const togglePotWinner = (potIndex: number, playerId: string) => {
    setPotSelections((s) => {
      const curr = s[potIndex] ?? [];
      const next = curr.includes(playerId)
        ? curr.filter((id) => id !== playerId)
        : [...curr, playerId];
      return { ...s, [potIndex]: next };
    });
  };

  // 为 pots 模式计算每人总共能拿多少（展示用）
  const potsPreview = useMemo(() => {
    return pots.map((p, i) => {
      const winners = potSelections[i] ?? [];
      if (winners.length === 0) return { ...p, distribution: [] as { playerId: string; amount: number }[] };
      const base = Math.floor(p.amount / winners.length);
      const remainder = p.amount - base * winners.length;
      return {
        ...p,
        distribution: winners.map((pid, idx) => ({
          playerId: pid,
          amount: base + (idx === 0 ? remainder : 0),
        })),
      };
    });
  }, [pots, potSelections]);

  const playerTotals = useMemo(() => {
    const map: Record<string, number> = {};
    potsPreview.forEach((p) =>
      p.distribution.forEach((w) => {
        map[w.playerId] = (map[w.playerId] ?? 0) + w.amount;
      })
    );
    return map;
  }, [potsPreview]);

  // ========== 提交 ==========
  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "simple") {
        const winners: Winner[] = Object.entries(simpleSelected)
          .filter(([, v]) => v > 0)
          .map(([playerId, amount]) => ({ playerId, amount }));
        if (winners.length === 0) throw new Error("请选择赢家");
        const total = winners.reduce((s, w) => s + w.amount, 0);
        if (total !== pot) throw new Error(`分配总和 ${total} 必须等于底池 ${pot}`);
        await onSubmit({ mode: "simple", winners });
      } else {
        // pots 模式
        if (pots.some((_, i) => !(potSelections[i]?.length))) {
          throw new Error("请为每个池子选择赢家");
        }
        await onSubmit({
          mode: "pots",
          pots: pots.map((_, i) => ({
            potIndex: i,
            winnerIds: potSelections[i] ?? [],
          })),
        });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <Dialog open={open} onClose={onClose} title="结算本手">
      <div className="space-y-4">
        {/* 顶部：底池 + all-in 提示 */}
        <div className="bg-slate-900 rounded-lg p-3 flex justify-between items-center">
          <div>
            <div className="text-slate-400 text-xs">底池总额</div>
            <div className="text-amber-400 text-2xl font-bold font-mono">
              {pot}
            </div>
          </div>
          {hasAllIn && (
            <div className="text-right">
              <div className="text-xs text-rose-300 font-semibold">⚡ 检测到 All-in</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {hand?.allInIds.map((id) => nameOf(id)).join("、")}
              </div>
            </div>
          )}
        </div>

        {/* 模式切换 */}
        {hasAllIn && (
          <div className="flex gap-2 p-1 bg-slate-900 rounded-lg">
            <ModeBtn
              active={mode === "pots"}
              onClick={() => setMode("pots")}
              title="按池分（推荐）"
              desc="自动拆主池/边池"
            />
            <ModeBtn
              active={mode === "simple"}
              onClick={() => setMode("simple")}
              title="手动填"
              desc="完全自由分配"
            />
          </div>
        )}

        {/* 主区域 */}
        {mode === "pots" && hasAllIn ? (
          <PotsMode
            pots={potsPreview}
            selections={potSelections}
            onToggle={togglePotWinner}
            nameOf={nameOf}
            bets={hand?.bets ?? {}}
          />
        ) : (
          <SimpleMode
            players={players}
            bets={hand?.bets ?? {}}
            selected={simpleSelected}
            onToggle={toggleSimple}
            onChange={updateSimpleAmount}
            pot={pot}
          />
        )}

        {/* pots 模式汇总 */}
        {mode === "pots" && hasAllIn && (
          <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">📊 结算预览</div>
            {Object.keys(playerTotals).length === 0 ? (
              <div className="text-slate-500 text-xs">为每个池子选择赢家</div>
            ) : (
              <div className="space-y-1 text-sm">
                {Object.entries(playerTotals).map(([pid, amt]) => (
                  <div key={pid} className="flex justify-between">
                    <span className="text-white">{nameOf(pid)}</span>
                    <span className="text-emerald-400 font-mono">
                      +{amt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

// ============================================================
// 子组件：模式切换按钮
// ============================================================
function ModeBtn({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 py-2 px-3 rounded-md text-left transition",
        active ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[10px] opacity-80">{desc}</div>
    </button>
  );
}

// ============================================================
// 子组件：pots 模式 - 按池选赢家
// ============================================================
function PotsMode({
  pots,
  selections,
  onToggle,
  nameOf,
  bets,
}: {
  pots: (Pot & { distribution: { playerId: string; amount: number }[] })[];
  selections: Record<number, string[]>;
  onToggle: (potIndex: number, playerId: string) => void;
  nameOf: (id: string) => string;
  bets: Record<string, number>;
}) {
  return (
    <div className="space-y-3">
      {pots.map((pot, i) => {
        const winners = selections[i] ?? [];
        return (
          <div
            key={i}
            className="border border-slate-700 rounded-lg overflow-hidden"
          >
            <div className="bg-slate-800/80 px-3 py-2 flex justify-between items-center">
              <div>
                <div className="text-white font-semibold text-sm">
                  {pot.label}
                </div>
                <div className="text-[11px] text-slate-400">
                  {pot.eligibleIds.length} 人有资格 · 每人出{" "}
                  {pot.perPlayerContribution}
                </div>
              </div>
              <div className="text-amber-400 font-mono font-bold">
                {pot.amount}
              </div>
            </div>
            <div className="bg-slate-900/50 p-2 space-y-1">
              {pot.eligibleIds.map((pid) => {
                const checked = winners.includes(pid);
                const amount = pot.distribution.find(
                  (d) => d.playerId === pid
                )?.amount;
                return (
                  <label
                    key={pid}
                    className={clsx(
                      "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition",
                      checked
                        ? "bg-emerald-900/40"
                        : "hover:bg-slate-800/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(i, pid)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="flex-1 text-white text-sm">
                      {nameOf(pid)}
                    </span>
                    <span className="text-xs text-slate-500">
                      下注 {bets[pid] ?? 0}
                    </span>
                    {checked && amount !== undefined && (
                      <span className="text-emerald-400 font-mono text-sm font-bold">
                        +{amount}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {winners.length > 1 && (
              <div className="px-3 py-1.5 bg-slate-900 text-[11px] text-slate-500 border-t border-slate-800">
                {winners.length} 人平分（零头给第一位）
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 子组件：simple 模式 - 手动填金额
// ============================================================
function SimpleMode({
  players,
  bets,
  selected,
  onToggle,
  onChange,
  pot,
}: {
  players: Player[];
  bets: Record<string, number>;
  selected: Record<string, number>;
  onToggle: (id: string) => void;
  onChange: (id: string, v: number) => void;
  pot: number;
}) {
  const contributed = players.filter((p) => (bets[p.id] ?? 0) > 0);
  const others = players.filter((p) => (bets[p.id] ?? 0) === 0);
  const total = Object.values(selected).reduce((s, v) => s + v, 0);
  const diff = pot - total;

  return (
    <>
      <div>
        <div className="text-sm text-slate-300 mb-2">
          勾选赢家（多选自动平分，可手动调整）
        </div>
        <div className="space-y-2">
          {contributed.map((p) => (
            <SimpleRow
              key={p.id}
              player={p}
              betAmount={bets[p.id] ?? 0}
              checked={selected[p.id] !== undefined}
              amount={selected[p.id] ?? 0}
              onToggle={() => onToggle(p.id)}
              onChange={(v) => onChange(p.id, v)}
            />
          ))}
          {others.length > 0 && (
            <details>
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                显示未下注玩家（罕见场景）
              </summary>
              <div className="mt-2 space-y-2">
                {others.map((p) => (
                  <SimpleRow
                    key={p.id}
                    player={p}
                    betAmount={0}
                    checked={selected[p.id] !== undefined}
                    amount={selected[p.id] ?? 0}
                    onToggle={() => onToggle(p.id)}
                    onChange={(v) => onChange(p.id, v)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
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
    </>
  );
}

function SimpleRow({
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
      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
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
