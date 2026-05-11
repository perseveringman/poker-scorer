import type { Player } from "./types";

export interface Settlement {
  from: string;      // 付款方 playerId
  to: string;        // 收款方 playerId
  amount: number;    // 筹码数量
}

/**
 * 最小化转账次数的结算算法（贪心）：
 * 1. 每人盈亏 = currentChips - totalBoughtIn
 * 2. 把玩家分成两组：债权人（+）和债务人（-）
 * 3. 每次让最大债权人和最大债务人配对，转账取两者绝对值的较小者
 * 4. 重复直到清零
 *
 * 复杂度 O(n^2)，对于朋友局足够。
 */
/** 获取玩家"有效盈亏"：离场者用快照，在场者用实时 */
export function effectiveBalance(p: Player): number {
  if (p.checkout) return p.checkout.pnlChips;
  return p.currentChips - p.totalBoughtIn;
}

export function computeSettlements(players: Player[]): Settlement[] {
  const balances = players.map((p) => ({
    id: p.id,
    name: p.name,
    diff: effectiveBalance(p),
  }));

  const creditors = balances.filter((b) => b.diff > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.diff < 0).map((b) => ({ ...b }));

  const transfers: Settlement[] = [];

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.diff - a.diff);       // 债权从大到小
    debtors.sort((a, b) => a.diff - b.diff);          // 债务从小（绝对值大）到大
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.diff, -d.diff);
    transfers.push({ from: d.id, to: c.id, amount });
    c.diff -= amount;
    d.diff += amount;
    if (c.diff === 0) creditors.shift();
    if (d.diff === 0) debtors.shift();
  }

  return transfers;
}
