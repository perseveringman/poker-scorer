// ============================================================
// 边池拆分算法
// ============================================================
//
// 德州扑克 all-in 场景下，需要将底池拆分为主池和若干边池：
//   - 每个池子有自己的「参与者」（eligibleIds）
//   - 池子金额 = 按下注层切片后该层的总贡献
//   - 赢家必须是池子的参与者之一
//
// 算法：
//   1. 收集所有有下注的玩家 (playerId, amount)
//   2. 按下注额升序排序
//   3. 从最小的下注额开始逐层切片：
//      - 本层金额 = 当前最小下注额 - 上一层金额
//      - 本层贡献者 = 当前所有剩余玩家（每人出 `本层金额`）
//      - 本层资格者 = 所有剩余玩家
//   4. 扣掉本层后，移除已出完的玩家，继续下一层
//
// 例：A=100(all-in), B=500, C=500
//   层1: 金额=100, 参与=[A,B,C]  → 贡献 100*3=300, 资格 A/B/C (主池)
//   层2: 金额=400, 参与=[B,C]    → 贡献 400*2=800, 资格 B/C   (边池)
//
// 特殊情况：
//   - 有的玩家弃牌但下了注：他们的筹码仍然进池，但没有赢的资格
//     所以 bets 和 eligible 要分开传入
//   - 如果某一池只有 1 个资格者，钱直接退给他（自动 fold win）
// ============================================================

export interface Pot {
  /** 这一池的总筹码 */
  amount: number;
  /** 有资格赢这一池的玩家 ID 列表 */
  eligibleIds: string[];
  /** 池子类型标签：主池 / 边池 1 / 边池 2 ... */
  label: string;
  /** 这一层的每人贡献金额（展示用） */
  perPlayerContribution: number;
  /** 实际为本池贡献筹码的人（可能大于 eligibleIds，弃牌玩家仍贡献筹码） */
  contributorIds: string[];
}

export interface SplitInput {
  /** playerId → 本手下注总额 */
  bets: Record<string, number>;
  /**
   * 仍有资格赢钱的玩家 ID 集合（即没有弃牌的人）。
   * 如果你们的游戏没有记录 fold，就把所有有下注的玩家都当成 eligible 传进来。
   */
  eligibleIds: string[];
}

/**
 * 把底池按 all-in 情况拆分成主池和若干边池。
 * 返回按"主池 → 边池1 → 边池2 → ..."顺序的数组。
 */
export function splitPots(input: SplitInput): Pot[] {
  const eligibleSet = new Set(input.eligibleIds);

  // 复制一份当前剩余下注（修改用）
  const remaining = new Map<string, number>();
  for (const [pid, amt] of Object.entries(input.bets)) {
    if (amt > 0) remaining.set(pid, amt);
  }

  const pots: Pot[] = [];
  let layerIndex = 0;

  while (remaining.size > 0) {
    // 取当前剩余下注中最小的金额作为本层高度
    const layerAmount = Math.min(...remaining.values());
    if (layerAmount <= 0) break;

    // 所有还有筹码的玩家都贡献本层
    const contributors = Array.from(remaining.keys());
    const potAmount = layerAmount * contributors.length;

    // 本池的资格者 = 贡献者 ∩ eligibleIds
    const eligible = contributors.filter((id) => eligibleSet.has(id));

    pots.push({
      amount: potAmount,
      eligibleIds: eligible,
      contributorIds: contributors,
      perPlayerContribution: layerAmount,
      label: layerIndex === 0 ? "主池" : `边池 ${layerIndex}`,
    });

    // 从每人剩余下注里扣掉本层
    for (const pid of contributors) {
      const left = (remaining.get(pid) ?? 0) - layerAmount;
      if (left <= 0) remaining.delete(pid);
      else remaining.set(pid, left);
    }
    layerIndex++;
  }

  // 后处理：合并"只有 0 或 1 个资格者"的池子
  // 如果某池只有 1 个资格者，他必赢这池（不需要用户选）——仍保留条目，UI 上可以显示为"自动归属"
  // 如果 0 个资格者，钱应退还给贡献者（这在实际规则里极罕见，通常发生于误操作）。我们合并给贡献者平分，避免钱蒸发。
  return pots.filter((p) => p.amount > 0);
}

// ============================================================
// 从 pot + 赢家选择推导最终的 Winner 分配
// ============================================================
export interface PotWinnerSelection {
  /** 对应 splitPots 返回数组里的索引 */
  potIndex: number;
  /** 本池赢家（可多选平分） */
  winnerIds: string[];
}

export interface DistributeResult {
  /** playerId → 获得的筹码总量（跨多池累加） */
  distribution: Record<string, number>;
  /** 每个池子的具体分配结果，便于展示 */
  potResults: {
    potIndex: number;
    label: string;
    amount: number;
    winners: { playerId: string; amount: number }[];
  }[];
  /** 未分配的零头（因除不尽），在 UI 上可提示 */
  totalDistributed: number;
  totalPot: number;
}

/**
 * 把每池赢家选择转成最终的 playerId → 金额 分配。
 * 平分有零头时，把零头给第一个赢家（简单规则，UI 也可覆盖）。
 */
export function distributePots(
  pots: Pot[],
  selections: PotWinnerSelection[]
): DistributeResult {
  const distribution: Record<string, number> = {};
  const potResults: DistributeResult["potResults"] = [];

  const selByIndex = new Map<number, string[]>();
  selections.forEach((s) => selByIndex.set(s.potIndex, s.winnerIds));

  let totalDistributed = 0;
  const totalPot = pots.reduce((s, p) => s + p.amount, 0);

  pots.forEach((pot, i) => {
    const winners = selByIndex.get(i) ?? [];
    if (winners.length === 0 || pot.amount === 0) {
      potResults.push({
        potIndex: i,
        label: pot.label,
        amount: pot.amount,
        winners: [],
      });
      return;
    }
    const base = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - base * winners.length;
    const winList = winners.map((pid, idx) => ({
      playerId: pid,
      amount: base + (idx === 0 ? remainder : 0),
    }));
    winList.forEach((w) => {
      distribution[w.playerId] = (distribution[w.playerId] ?? 0) + w.amount;
      totalDistributed += w.amount;
    });
    potResults.push({
      potIndex: i,
      label: pot.label,
      amount: pot.amount,
      winners: winList,
    });
  });

  return { distribution, potResults, totalDistributed, totalPot };
}
