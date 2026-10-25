/**
 * What the device remembers about practice (saved under `mindquest.learning.v1`, never leaves the device, holds no name, age or
 * other personal detail: only counters per skill and the last few riddle "signatures").
 *
 * How difficulty adapts (per skill, from what the child actually did, see `decideTier`):
 *  - Every finished riddle is "clean" (no slips, no hint), "steady" (a hint or one slip, then right) or "struggled" (the answer had to be shown).
 *  - The evidence is the last few riddles of that skill AT its current tier; a change of tier starts the evidence afresh.
 *  - Two clean riddles in a row -> one tier up (to 3 at most). A struggle right after another slip, or two struggles in the last three -> one tier down.
 *  - A hint, or a single stumble among good answers, never moves the tier. Nothing here changes XP.
 */
import { signatureOf, type Riddle, type RunPlan } from '../systems/runePuzzle';
import type { Tier } from '../systems/woodsQuest';
import { FIXED_TIER, SKILLS, skillOf, type Skill } from './skills';

export const LEARNING_STORAGE_KEY = 'mindquest.learning.v1';
export const RECENT_LIMIT = 24;
export const EVIDENCE_WINDOW = 4;

export type Outcome = 'clean' | 'steady' | 'struggled';
export interface SkillRecord {
  /** Riddles shown / finished (finished includes ones where the answer was shown). */
  attempted: number; completed: number;
  /** Finished with no wrong answer. */
  firstTry: number;
  /** Wrong answers, hints asked for, and answers that had to be shown. */
  retries: number; hints: number; revealed: number;
  tier: Tier;
  /** Outcomes at the current tier, oldest first (at most `EVIDENCE_WINDOW`). */
  recent: Outcome[];
}
export interface LearningProfile { version: 1; skills: Partial<Record<Skill, SkillRecord>>; /** Signatures of the riddles shown lately, oldest first. */ recent: string[] }
export interface Result { slips: number; hinted: boolean; revealed: boolean }

export const newProfile = (): LearningProfile => ({ version: 1, skills: {}, recent: [] });
const fresh = (tier: Tier): SkillRecord => ({ attempted: 0, completed: 0, firstTry: 0, retries: 0, hints: 0, revealed: 0, tier, recent: [] });

export function classify(r: Result): Outcome {
  if (r.revealed) return 'struggled';
  return r.slips === 0 && !r.hinted ? 'clean' : 'steady';
}

/** Pure rule for moving a tier from the recent outcomes (see the header comment). */
export function decideTier(recent: readonly Outcome[], tier: Tier): Tier {
  const last2 = recent.slice(-2), last3 = recent.slice(-3);
  if (tier < 3 && last2.length === 2 && last2.every(o => o === 'clean')) return (tier + 1) as Tier;
  const struggledNow = last2.filter(o => o === 'struggled').length >= 1 && last2.length === 2 && last2.every(o => o !== 'clean');
  if (tier > 1 && (struggledNow || last3.filter(o => o === 'struggled').length >= 2)) return (tier - 1) as Tier;
  return tier;
}

const pushRecent = (list: readonly string[], sig: string): string[] => [...list.filter(s => s !== sig), sig].slice(-RECENT_LIMIT);

/** A riddle has just been shown. */
export function recordStart(p: LearningProfile, r: Riddle): LearningProfile {
  const skill = skillOf(r), rec = { ...(p.skills[skill] ?? fresh(FIXED_TIER[skill] ?? r.tier)) };
  rec.attempted += 1;
  return { ...p, skills: { ...p.skills, [skill]: rec }, recent: pushRecent(p.recent, signatureOf(r)) };
}

/** A riddle has just been finished (right, or with the answer shown). */
export function recordResult(p: LearningProfile, r: Riddle, res: Result): LearningProfile {
  const skill = skillOf(r), rec = { ...(p.skills[skill] ?? fresh(FIXED_TIER[skill] ?? r.tier)), recent: [...(p.skills[skill]?.recent ?? [])] };
  rec.completed += 1; rec.retries += res.slips; rec.hints += res.hinted ? 1 : 0;
  if (res.revealed) rec.revealed += 1; else if (res.slips === 0) rec.firstTry += 1;
  // evidence only counts when the riddle was made at the tier the skill is on now (a riddle made before a tier change says little)
  if (r.tier === rec.tier || FIXED_TIER[skill]) {
    rec.recent = [...rec.recent, classify(res)].slice(-EVIDENCE_WINDOW);
    if (!FIXED_TIER[skill]) { const next = decideTier(rec.recent, rec.tier); if (next !== rec.tier) { rec.tier = next; rec.recent = []; } }
  }
  return { ...p, skills: { ...p.skills, [skill]: rec } };
}

export const tierOf = (p: LearningProfile, skill: Skill, fallback: Tier): Tier => FIXED_TIER[skill] ?? p.skills[skill]?.tier ?? fallback;

/** A skill the child is finding hard right now (used to rest multi-step reasoning and to suggest practice). */
export function needsPractice(rec: SkillRecord | undefined): boolean {
  return !!rec && rec.completed >= 2 && rec.recent.slice(-2).includes('struggled');
}

/**
 * Chooses a run from what the child has shown. Counting and patterns follow their own tiers. The third riddle goes to the maths skill
 * practised least (so adding and taking away stay balanced); multi-step reasoning joins only once both are at Challenge and rests while it is hard.
 * `fallback` is the quest's tier, used for a skill with no history yet.
 */
export function planRun(p: LearningProfile, fallback: Tier, seed: number): RunPlan {
  const countingTier = tierOf(p, 'counting', fallback);
  const seen = (prefix: string) => p.recent.filter(s => s.startsWith(prefix)).length;
  const recognise = countingTier === 1 && (seen('word:') < seen('count:') || (seen('word:') === seen('count:') && seed % 2 === 0));

  const addT = tierOf(p, 'adding', fallback), subT = tierOf(p, 'subtracting', fallback);
  const candidates: Skill[] = ['adding', 'subtracting'];
  if (addT === 3 && subT === 3 && !needsPractice(p.skills.multistep)) candidates.push('multistep');
  const practised = (s: Skill) => p.skills[s]?.attempted ?? 0;
  const least = Math.min(...candidates.map(practised));
  const tied = candidates.filter(s => practised(s) === least);
  const maths = tied[seed % tied.length];
  return {
    counting: { kind: recognise ? 'recognise' : 'count', tier: countingTier },
    pattern: { tier: tierOf(p, 'patterns', fallback) },
    maths: maths === 'multistep' ? { kind: 'twostep', tier: 3 } : { kind: maths === 'adding' ? 'add' : 'subtract', tier: maths === 'adding' ? addT : subT },
  };
}

export interface SkillSummary { skill: Skill; tier: Tier; attempted: number; completed: number; firstTry: number; retries: number; hints: number; practice: boolean }
/** Practised skills for the Hero panel, in a fixed order, plus the ones that could use more practice. */
export function summarise(p: LearningProfile): SkillSummary[] {
  return SKILLS.filter(s => (p.skills[s]?.attempted ?? 0) > 0).map(skill => {
    const r = p.skills[skill]!;
    return { skill, tier: r.tier, attempted: r.attempted, completed: r.completed, firstTry: r.firstTry, retries: r.retries, hints: r.hints, practice: needsPractice(r) };
  });
}

// ---------- saving ----------
const num = (v: unknown, hi = 100_000): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(0, Math.floor(v))) : 0);
const OUTCOMES: readonly Outcome[] = ['clean', 'steady', 'struggled'];

/** Accepts anything (parsed storage) and returns a valid profile; corrupt data becomes an empty one, never an error. */
export function sanitizeProfile(raw: unknown): LearningProfile {
  if (typeof raw !== 'object' || raw === null) return newProfile();
  const r = raw as Record<string, unknown>, out = newProfile();
  const skills = typeof r.skills === 'object' && r.skills !== null ? (r.skills as Record<string, unknown>) : {};
  for (const s of SKILLS) {
    const v = skills[s]; if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    const tier = FIXED_TIER[s] ?? ((o.tier === 1 || o.tier === 2 || o.tier === 3 ? o.tier : 1) as Tier);
    const completed = num(o.completed), attempted = Math.max(completed, num(o.attempted));
    out.skills[s] = {
      attempted, completed, firstTry: Math.min(completed, num(o.firstTry)), retries: num(o.retries), hints: num(o.hints), revealed: Math.min(completed, num(o.revealed)), tier,
      recent: Array.isArray(o.recent) ? o.recent.filter((x): x is Outcome => OUTCOMES.includes(x as Outcome)).slice(-EVIDENCE_WINDOW) : [],
    };
  }
  out.recent = Array.isArray(r.recent) ? [...new Set(r.recent.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80))].slice(-RECENT_LIMIT) : [];
  return out;
}
type Reader = Pick<Storage, 'getItem'>; type Writer = Pick<Storage, 'setItem'>;
const browserStore = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadLearning(store: Reader | undefined = browserStore()): LearningProfile {
  try { const t = store?.getItem(LEARNING_STORAGE_KEY); return t ? sanitizeProfile(JSON.parse(t)) : newProfile(); } catch { return newProfile(); }
}
/** False when the browser refused (private mode, quota): practice still adapts for this session. */
export function saveLearning(p: LearningProfile, store: Writer | undefined = browserStore()): boolean {
  try { if (!store) return false; store.setItem(LEARNING_STORAGE_KEY, JSON.stringify(sanitizeProfile(p))); return true; } catch { return false; }
}
