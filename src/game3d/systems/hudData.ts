/**
 * v2.14: pure view-model helpers for the HUD, the Hero panel and the Bag. Everything is derived from the existing saved
 * `Progress`, the cosmetics state and the level, so the interface never shows invented numbers (unit-tested).
 */
import { CATALOG, COSMETIC_SLOTS, itemById, type CosmeticItem, type CosmeticSlot } from '../cosmetics/catalog';
import { PETALS_NEEDED, RUNES_PER_RUN, SPROUTS_NEEDED, levelForXp, xpIntoLevel, type Progress, type WoodsStage } from './woodsQuest';

export const XP_PER_LEVEL = 100;

export interface Counted { done: number; total: number }

/** Progress of the counted part of the current objective (petals, sprouts, riddles), or null when the goal is not a count. */
export function objectiveProgress(p: Progress): Counted | null {
  switch (p.stage) {
    case 'petals': return { done: Math.min(p.petalIds.length, PETALS_NEEDED), total: PETALS_NEEDED };
    case 'sprouts': return { done: Math.min(p.sproutsCalmed, SPROUTS_NEEDED), total: SPROUTS_NEEDED };
    case 'runes': return { done: Math.min(p.runesSolved, RUNES_PER_RUN), total: RUNES_PER_RUN };
    default: return null;
  }
}

export type StepState = 'done' | 'current' | 'todo';
export interface JournalStep { stage: WoodsStage; state: StepState; count: Counted | null }
const ORDER: readonly WoodsStage[] = ['talk', 'petals', 'sprouts', 'runes', 'boss', 'return', 'complete'];

/** The quest as a checklist: steps before the current stage are done, the current one is highlighted, the rest wait. */
export function journalSteps(p: Progress): JournalStep[] {
  const at = ORDER.indexOf(p.stage);
  return ORDER.map((stage, i) => ({ stage, state: i < at ? 'done' : i === at ? 'current' : 'todo', count: i === at ? objectiveProgress(p) : null }) as JournalStep);
}

/** The whole quest from 0 to 1 (used for the journal's progress line). */
export function questFraction(p: Progress): number {
  const at = ORDER.indexOf(p.stage); const c = objectiveProgress(p);
  return Math.min(1, (at + (c ? c.done / c.total : 0)) / (ORDER.length - 1));
}

export interface BagCounts { petals: Counted; sprouts: Counted; riddles: Counted; mossbackCalmed: boolean; rewards: string[] }
/** What the hero has collected or achieved so far. Numbers are the saved ones (the quest never counts anything twice). */
export function bagCounts(p: Progress): BagCounts {
  return {
    petals: { done: Math.min(p.petalIds.length, PETALS_NEEDED), total: PETALS_NEEDED },
    sprouts: { done: Math.min(p.sproutsCalmed, SPROUTS_NEEDED), total: SPROUTS_NEEDED },
    riddles: { done: Math.min(p.runesSolved, RUNES_PER_RUN), total: RUNES_PER_RUN },
    mossbackCalmed: p.bossDefeated, rewards: [...p.unlocked],
  };
}

export interface LevelInfo { level: number; xpInto: number; xpNeeded: number; xpToNext: number; fraction: number }
export function levelInfo(xp: number): LevelInfo {
  const xpInto = xpIntoLevel(xp);
  return { level: levelForXp(xp), xpInto, xpNeeded: XP_PER_LEVEL, xpToNext: XP_PER_LEVEL - xpInto, fraction: xpInto / XP_PER_LEVEL };
}

/** The nearest level reward: the lowest-level item the hero has not reached yet, or null when every level item is open. */
export function nextLevelUnlock(level: number): { level: number; item: CosmeticItem } | null {
  let best: { level: number; item: CosmeticItem } | null = null;
  for (const item of CATALOG) {
    if (item.access.type !== 'level' || item.access.level <= level) continue;
    if (!best || item.access.level < best.level) best = { level: item.access.level, item };
  }
  return best;
}

/** Equipped item per slot (null = nothing worn). Ids that no longer exist in the catalogue are shown as empty. */
export function equippedList(equipped: Readonly<Record<CosmeticSlot, string | null>>): { slot: CosmeticSlot; item: CosmeticItem | null }[] {
  return COSMETIC_SLOTS.map(slot => ({ slot, item: equipped[slot] ? itemById(equipped[slot]!) ?? null : null }));
}
