import type { AugmentDef, ItemDef } from "../types";
import { AUGMENTS, ITEMS } from "./definitions";
import { weightedPick } from "./random";

export function winStreakGoldBonus(streak: number): number {
  if (streak >= 6) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1;
  return 0;
}

export function lossStreakGoldBonus(streak: number): number {
  if (streak >= 5) return 4;
  if (streak >= 4) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1;
  return 0;
}

function winStreakQualityMultiplier(tier: 1 | 2 | 3, winStreak: number): number {
  if (winStreak >= 6) return tier === 1 ? 1.5 : tier === 2 ? 0.65 : 0.3;
  if (winStreak >= 4) return tier === 1 ? 1.35 : tier === 2 ? 0.8 : 0.5;
  if (winStreak >= 2) return tier === 1 ? 1.15 : tier === 2 ? 0.9 : 0.7;
  return 1;
}

export function itemTierWeight(tier: 1 | 2 | 3, lossStreak: number, winStreak = 0): number {
  const base = lossStreak >= 4
    ? tier === 1 ? 1 : tier === 2 ? 3 : 5
    : lossStreak === 3
      ? tier === 1 ? 2 : tier === 2 ? 4 : 3
      : lossStreak === 2
        ? tier === 1 ? 3 : tier === 2 ? 4 : 2
        : tier === 1 ? 5 : tier === 2 ? 3 : 1;
  return base * winStreakQualityMultiplier(tier, winStreak);
}

export function augmentTierWeight(tier: 1 | 2 | 3, lossStreak: number, winStreak = 0): number {
  const base = lossStreak >= 4
    ? tier === 1 ? 1 : tier === 2 ? 3 : 5
    : lossStreak === 3
      ? tier === 1 ? 2 : tier === 2 ? 4 : 3
      : lossStreak === 2
        ? tier === 1 ? 3 : tier === 2 ? 3 : 2
        : tier === 1 ? 4 : tier === 2 ? 2 : 1;
  return base * winStreakQualityMultiplier(tier, winStreak);
}

export function hpComebackGoldBonus(playerHp: number, opponentHp: number): number {
  const deficit = opponentHp - playerHp;
  if (deficit >= 35) return 2;
  if (deficit >= 15) return 1;
  return 0;
}

function weightedSample<T>(rng: () => number, values: T[], count: number, weightFor: (value: T) => number): T[] {
  const remaining = values.slice();
  const selected: T[] = [];
  while (remaining.length && selected.length < count) {
    const entries = remaining.map((value, index) => [{ value, index }, weightFor(value)] as [{ value: T; index: number }, number]);
    const picked = weightedPick(rng, entries);
    if (!picked) break;
    selected.push(picked.value);
    remaining.splice(picked.index, 1);
  }
  return selected;
}

function replaceWeakest<T extends { tier: 1 | 2 | 3 }>(selected: T[], replacement: T): void {
  let weakestIndex = 0;
  for (let i = 1; i < selected.length; i++) {
    if (selected[i].tier < selected[weakestIndex].tier) weakestIndex = i;
  }
  selected[weakestIndex] = replacement;
}

export function chooseBalancedItems(rng: () => number, lossStreak = 0, count = 3, winStreak = 0): ItemDef[] {
  const selected = weightedSample(rng, ITEMS, count, (item) => itemTierWeight(item.tier, lossStreak, winStreak));
  if (!selected.length) return selected;
  if (lossStreak >= 4 && !selected.some((item) => item.tier === 3)) {
    const candidates = ITEMS.filter((item) => item.tier === 3 && !selected.some((picked) => picked.id === item.id));
    const replacement = weightedSample(rng, candidates, 1, () => 1)[0];
    if (replacement) replaceWeakest(selected, replacement);
  }
  const guaranteedAdvanced = lossStreak >= 3 ? 2 : lossStreak >= 2 ? 1 : 0;
  for (let guard = 0; guard < 4 && selected.filter((item) => item.tier >= 2).length < guaranteedAdvanced; guard++) {
    const candidates = ITEMS.filter((item) => item.tier >= 2 && !selected.some((picked) => picked.id === item.id));
    const replacement = weightedSample(rng, candidates, 1, (item) => itemTierWeight(item.tier, lossStreak, winStreak))[0];
    if (!replacement) break;
    replaceWeakest(selected, replacement);
  }
  return selected;
}

export function augmentTierCap(round: number, lossStreak: number): 1 | 2 | 3 {
  const base = round >= 12 ? 3 : round >= 7 ? 2 : 1;
  return Math.min(3, base + (lossStreak >= 2 ? 1 : 0)) as 1 | 2 | 3;
}

export function chooseBalancedAugments(rng: () => number, round: number, owned: string[], lossStreak = 0, count = 3, winStreak = 0): AugmentDef[] {
  const cap = augmentTierCap(round, lossStreak);
  const pool = AUGMENTS.filter((augment) => augment.tier <= cap && !owned.includes(augment.id));
  const selected = weightedSample(rng, pool, count, (augment) => augmentTierWeight(augment.tier, lossStreak, winStreak));
  if (!selected.length) return selected;
  const bestAvailable = Math.max(...pool.map((augment) => augment.tier)) as 1 | 2 | 3;
  if (lossStreak >= 3 && bestAvailable > 1 && !selected.some((augment) => augment.tier === bestAvailable)) {
    const candidates = pool.filter((augment) => augment.tier === bestAvailable && !selected.some((picked) => picked.id === augment.id));
    const replacement = weightedSample(rng, candidates, 1, () => 1)[0];
    if (replacement) replaceWeakest(selected, replacement);
  }
  return selected;
}
