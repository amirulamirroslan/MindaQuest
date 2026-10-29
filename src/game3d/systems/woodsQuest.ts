/**
 * Whispering Woods quest and progression (pure reducer, unit-tested, saved on the device).
 * Stages: talk to the Elder -> gather glow petals -> calm the sprouts -> answer the Rune Stone's three riddles (counting,
 * patterns, adding or taking away) -> face the Old Mossback -> the Moonlit Gate opens.
 * No accounts, no personal data: progress is a few small values in localStorage.
 */
export const PETALS_NEEDED = 6;
export const SPROUTS_NEEDED = 3;
export const COMPLETION_XP = 150;
export const PETAL_XP = 5;
export const SPROUT_XP = 15;
export const BOSS_XP = 60;
/** After the quest the woods keep one optional job: restless sprouts return and can be calmed again. Each pays PATROL_XP until the bonus pool
 *  (BONUS_XP_CAP) is used up. 330 quest XP + 120 = 450, which is level 5, so every reward in the wardrobe can be reached and nothing can be farmed for ever. */
export const PATROL_XP = 8;
export const BONUS_XP_CAP = 120;
export const RUNES_PER_RUN = 3;
export const RUNE_XP = 10;
/** Extra XP for a riddle answered right first time. Never taken away for mistakes: a wrong answer only costs the bonus. */
export const RUNE_STAR_XP = 5;
export const PROGRESS_STORAGE_KEY = 'mindquest.progress.v1';
/** The cosmetic id given for finishing the quest. */
export const COMPLETION_REWARD = 'mossy-cloak';
/** The cosmetic id given for finishing the Crystal Hollow (v2.22, see systems/hollowQuest.ts). */
export const HOLLOW_REWARD = 'crystal-hat';
/** v2.28: the cosmetic id given for defeating the Hollow Warden. */
export const WARDEN_REWARD = 'warden-mantle';
/** v2.31.3: the cosmetic id given for finding everything in the Crystal Hollow (see hollowPerfect in systems/hollowQuest.ts). */
export const HOLLOW_PERFECT_REWARD = 'heartstone-cloak';
/** Every cosmetic the Hollow may hand out through a `hollow` event. */
export const HOLLOW_REWARDS: readonly string[] = [HOLLOW_REWARD, WARDEN_REWARD, HOLLOW_PERFECT_REWARD];
/** v2.29 Moonwake Shore rewards: the Sailor set (for the eight pieces of sea-glass, handed over by Harbour-master Mak Long) and the Lighthouse Lantern (for lighting the lamp). */
export const SAILOR_REWARDS: readonly string[] = ['sailor-jacket', 'sailor-trousers', 'sailor-cap'];
export const LANTERN_REWARD = 'lighthouse-lantern';
/** Every cosmetic the shore may hand out through a `shore` event. */
export const SHORE_REWARDS: readonly string[] = [...SAILOR_REWARDS, LANTERN_REWARD];
/** The most XP one `shore` event may carry (the biggest single prize is 100; this is only a sanity limit). */
export const SHORE_EVENT_MAX_XP = 300;
/** The most XP one `hollow` event may carry (the Hollow's biggest single prize is 100; this is only a sanity limit). */
export const HOLLOW_EVENT_MAX_XP = 300;

export type WoodsStage = 'talk' | 'petals' | 'sprouts' | 'runes' | 'boss' | 'return' | 'complete';
/** Riddle difficulty. 1 = counting to 6 and patterns of two; 3 = numbers to 20 and number patterns. */
export type Tier = 1 | 2 | 3;

export interface Progress {
  stage: WoodsStage;
  petalIds: number[];
  sproutsCalmed: number;
  bossDefeated: boolean;
  xp: number;
  gateOpen: boolean;
  /** Cosmetic ids earned as rewards (wardrobe unlocks). */
  unlocked: string[];
  /** Rune Stone riddles answered so far (0..3). Saves from before the Rune Stone existed count as 3 once past the sprouts. */
  runesSolved: number;
  /** Mistakes made during the current run of riddles (decides the next difficulty). */
  runeMistakes: number;
  /** Difficulty of the next run of riddles; goes up after a smooth run and down after a rough one. */
  runeTier: Tier;
  /** Bonus XP earned from the post-quest sprout patrol (0..BONUS_XP_CAP); counted inside `xp` as well. */
  bonusXp: number;
}

export type QuestEvent =
  | { kind: 'talked' }
  | { kind: 'petal'; id: number }
  | { kind: 'enemyDefeated'; enemy: 'sprout' | 'mossback' | 'shardling' | 'warden' }
  | { kind: 'runeSolved'; index: number; mistakes: number }
  /** A practice run at the Rune Stone after the quest part is done: adjusts difficulty only, no XP. */
  | { kind: 'practised'; mistakes: number }
  | { kind: 'returned' }
  /** XP (and at most the Hollow's reward) earned in the Crystal Hollow. Only counts once the woods quest is complete, since that is the only way in. */
  | { kind: 'hollow'; xp: number; unlock?: string }
  /** v2.29: XP (and the shore's rewards, one or several) earned on Moonwake Shore. Only counts once the woods quest is complete, since that is the only way there. */
  | { kind: 'shore'; xp: number; unlocks?: readonly string[] }
  /** v2.31: XP earned in the optional wider woods (see systems/wildsQuest.ts). Counts at any stage: the new paths are open from the start. */
  | { kind: 'wilds'; xp: number };
/** The most XP one `wilds` event may carry (the biggest single prize is 30; this is only a sanity limit). */
export const WILDS_EVENT_MAX_XP = 100;

export const newProgress = (): Progress => ({
  stage: 'talk', petalIds: [], sproutsCalmed: 0, bossDefeated: false, xp: 0, gateOpen: false, unlocked: [], runesSolved: 0, runeMistakes: 0, runeTier: 1, bonusXp: 0,
});

/** Next difficulty after a run of riddles: a smooth run (at most one slip) steps up, a rough one (five or more) steps down. */
export function nextTier(tier: Tier, mistakes: number): Tier {
  if (mistakes <= 1) return Math.min(3, tier + 1) as Tier;
  if (mistakes >= 5) return Math.max(1, tier - 1) as Tier;
  return tier;
}

export const levelForXp = (xp: number): number => 1 + Math.floor(Math.max(0, xp) / 100);
export const xpIntoLevel = (xp: number): number => Math.max(0, xp) % 100;

export interface QuestResult { state: Progress; xpGained: number; message: string | null; levelUp: boolean; unlockedNow: string[] }

const done = (state: Progress, xpGained: number, message: string | null, before: Progress, unlockedNow: string[] = []): QuestResult => ({
  state, xpGained, message, unlockedNow, levelUp: levelForXp(state.xp) > levelForXp(before.xp),
});

export function reduceQuest(prev: Progress, e: QuestEvent): QuestResult {
  const s: Progress = { ...prev, petalIds: [...prev.petalIds], unlocked: [...prev.unlocked] };
  switch (e.kind) {
    case 'talked':
      if (s.stage !== 'talk') return done(prev, 0, null, prev);
      s.stage = 'petals';
      return done(s, 0, `Gather ${PETALS_NEEDED} glow petals from the Whispering Woods!`, prev);
    case 'petal': {
      if (s.stage === 'talk' || s.petalIds.includes(e.id)) return done(prev, 0, null, prev); // never counted twice
      s.petalIds.push(e.id); s.xp += PETAL_XP;
      if (s.stage === 'petals' && s.petalIds.length >= PETALS_NEEDED) { s.stage = 'sprouts'; return done(s, PETAL_XP, `All ${PETALS_NEEDED} petals! Now calm ${SPROUTS_NEEDED} grumpy sprouts.`, prev); }
      return done(s, PETAL_XP, null, prev);
    }
    case 'enemyDefeated':
      if (e.enemy === 'sprout') {
        if (s.stage === 'complete') { // the patrol: paid from the bonus pool only
          const gain = Math.max(0, Math.min(PATROL_XP, BONUS_XP_CAP - s.bonusXp));
          if (gain === 0) return done(prev, 0, null, prev);
          s.bonusXp += gain; s.xp += gain; return done(s, gain, null, prev);
        }
        if (s.stage !== 'sprouts') return done(prev, 0, null, prev); // sprouts only count (and pay) in their own stage, never again later
        s.sproutsCalmed += 1; s.xp += SPROUT_XP;
        if (s.sproutsCalmed >= SPROUTS_NEEDED) { s.stage = 'runes'; return done(s, SPROUT_XP, 'All the sprouts are calm! Visit the Rune Stone at the ruins.', prev); }
        return done(s, SPROUT_XP, null, prev);
      }
      if (e.enemy !== 'mossback' || s.bossDefeated) return done(prev, 0, null, prev); // the Hollow's creatures are paid by the Hollow, never here
      s.bossDefeated = true; s.xp += BOSS_XP;
      if (s.stage === 'boss') s.stage = 'return';
      return done(s, BOSS_XP, 'The Old Mossback is calm again! Return to the Elder.', prev);
    case 'runeSolved': {
      // riddles are answered in order, and only while the Rune Stone is waiting for them
      if (s.stage !== 'runes' || e.index !== s.runesSolved) return done(prev, 0, null, prev);
      const slips = Math.min(9, Math.max(0, Math.floor(Number.isFinite(e.mistakes) ? e.mistakes : 0)));
      const gained = RUNE_XP + (slips === 0 ? RUNE_STAR_XP : 0);
      s.runesSolved += 1; s.runeMistakes += slips; s.xp += gained;
      if (s.runesSolved >= RUNES_PER_RUN) {
        s.stage = 'boss'; s.runeTier = nextTier(s.runeTier, s.runeMistakes); s.runeMistakes = 0;
        return done(s, gained, 'The runes glow! The Old Mossback is stirring in the ruins. Be brave!', prev);
      }
      return done(s, gained, null, prev);
    }
    case 'practised': {
      if (s.runesSolved < RUNES_PER_RUN) return done(prev, 0, null, prev);
      s.runeTier = nextTier(s.runeTier, Math.max(0, Math.floor(Number.isFinite(e.mistakes) ? e.mistakes : 0)));
      return done(s, 0, null, prev);
    }
    case 'hollow': {
      if (s.stage !== 'complete') return done(prev, 0, null, prev);
      const gain = Number.isFinite(e.xp) ? Math.min(HOLLOW_EVENT_MAX_XP, Math.max(0, Math.floor(e.xp))) : 0;
      const unlockedNow = e.unlock !== undefined && HOLLOW_REWARDS.includes(e.unlock) && !s.unlocked.includes(e.unlock) ? [e.unlock] : [];
      if (gain === 0 && !unlockedNow.length) return done(prev, 0, null, prev);
      s.xp += gain; s.unlocked.push(...unlockedNow);
      return done(s, gain, null, prev, unlockedNow);
    }
    case 'shore': {
      if (s.stage !== 'complete') return done(prev, 0, null, prev);
      const gain = Number.isFinite(e.xp) ? Math.min(SHORE_EVENT_MAX_XP, Math.max(0, Math.floor(e.xp))) : 0;
      const unlockedNow = [...new Set(e.unlocks ?? [])].filter(u => SHORE_REWARDS.includes(u) && !s.unlocked.includes(u));
      if (gain === 0 && !unlockedNow.length) return done(prev, 0, null, prev);
      s.xp += gain; s.unlocked.push(...unlockedNow);
      return done(s, gain, null, prev, unlockedNow);
    }
    case 'wilds': {
      const gain = Number.isFinite(e.xp) ? Math.min(WILDS_EVENT_MAX_XP, Math.max(0, Math.floor(e.xp))) : 0;
      if (gain === 0) return done(prev, 0, null, prev);
      s.xp += gain;
      return done(s, gain, null, prev);
    }
    case 'returned': {
      if (s.stage !== 'return') return done(prev, 0, null, prev);
      s.stage = 'complete'; s.xp += COMPLETION_XP; s.gateOpen = true;
      const reward = COMPLETION_REWARD;
      const unlockedNow = s.unlocked.includes(reward) ? [] : [reward];
      s.unlocked.push(...unlockedNow);
      return done(s, COMPLETION_XP, 'The Moonlit Gate is open! New reward unlocked: Mossy Cloak.', prev, unlockedNow);
    }
  }
}

/** Short, child-friendly objective line for the HUD. */
export function objectiveText(p: Progress): string {
  switch (p.stage) {
    case 'talk': return 'Talk to the Elder at the village gate';
    case 'petals': return `Collect glow petals (${p.petalIds.length}/${PETALS_NEEDED})`;
    case 'sprouts': return `Calm the grumpy sprouts (${p.sproutsCalmed}/${SPROUTS_NEEDED})`;
    case 'runes': return `Wake the Rune Stone at the ruins (${p.runesSolved}/${RUNES_PER_RUN})`;
    case 'boss': return 'Face the Old Mossback in the ruins';
    case 'return': return 'Return to the Elder';
    case 'complete': return 'Walk through the Moonlit Gate!';
  }
}

const STAGES: readonly WoodsStage[] = ['talk', 'petals', 'sprouts', 'runes', 'boss', 'return', 'complete'];
const num = (v: unknown, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : lo);

/** Accepts anything (parsed storage) and returns valid progress; corrupt data falls back to a fresh start. */
export function sanitizeProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return newProgress();
  const r = raw as Record<string, unknown>;
  let stage = STAGES.includes(r.stage as WoodsStage) ? (r.stage as WoodsStage) : 'talk';
  const petalIds = Array.isArray(r.petalIds) ? [...new Set(r.petalIds.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < 1000))].slice(0, 50) : [];
  const unlocked = Array.isArray(r.unlocked) ? [...new Set(r.unlocked.filter((x): x is string => typeof x === 'string' && x.length < 40))].slice(0, 50) : [];
  let sproutsCalmed = num(r.sproutsCalmed, 0, 99);
  let bossDefeated = r.bossDefeated === true;
  // A save must never strand the child: if its numbers already finish the stage it says it is in, move on (the stage only
  // advances when an event arrives, and for these no event would ever come again).
  if (stage === 'petals' && petalIds.length >= PETALS_NEEDED) stage = 'sprouts';
  if (stage === 'sprouts' && sproutsCalmed >= SPROUTS_NEEDED) stage = 'runes';
  if (stage === 'boss' && bossDefeated) stage = 'return';
  if (stage === 'talk' || stage === 'petals') sproutsCalmed = 0;
  if (stage === 'return' || stage === 'complete') bossDefeated = true;
  if (stage === 'complete' && !unlocked.includes(COMPLETION_REWARD)) unlocked.push(COMPLETION_REWARD);
  // Saves made before the Rune Stone existed are already past it: count its riddles as solved so nobody is sent back.
  const pastRunes = stage === 'boss' || stage === 'return' || stage === 'complete';
  const runesSolved = pastRunes ? RUNES_PER_RUN : stage === 'runes' ? Math.min(RUNES_PER_RUN - 1, num(r.runesSolved, 0, RUNES_PER_RUN)) : 0;
  const runeMistakes = stage === 'runes' ? num(r.runeMistakes, 0, 99) : 0;
  const runeTier = num(r.runeTier, 1, 3) as Tier;
  const bonusXp = stage === 'complete' ? num(r.bonusXp, 0, BONUS_XP_CAP) : 0;
  return {
    stage, petalIds, sproutsCalmed, bossDefeated, xp: num(r.xp, 0, 1_000_000),
    gateOpen: stage === 'complete', unlocked, runesSolved, runeMistakes, runeTier, bonusXp,
  };
}
export function loadProgress(store: Pick<Storage, 'getItem'> | undefined = safeStorage()): Progress {
  try { const t = store?.getItem(PROGRESS_STORAGE_KEY); return t ? sanitizeProgress(JSON.parse(t)) : newProgress(); } catch { return newProgress(); }
}
export function saveProgress(p: Progress, store: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try { if (!store) return false; store.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(sanitizeProgress(p))); return true; } catch { return false; }
}
function safeStorage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
