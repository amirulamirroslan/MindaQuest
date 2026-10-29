/**
 * Crystal Hollow progress (v2.22, pure reducer functions, unit-tested, saved on the device under its own key so older saves are untouched).
 *
 * The Hollow has one goal and some optional treasure:
 *   - strike the three Echo Crystals in the order the mural shows -> the Heart Door opens (DOOR_XP)
 *   - the Hollow Warden guards the Heartstone: beat it -> WARDEN_XP and the Warden's Mantle (v2.28)
 *   - touch the Heartstone in the Heart Chamber (only once the Warden is down) -> the Crystal Hat and HEART_XP
 *   - five Moon Shards are hidden around the cave (SHARD_XP each, ALL_SHARDS_XP extra for the last one); three glowing mushrooms in the grotto
 *     open the secret nook that holds the fifth shard.
 * v2.28 optional extras, all paid once and remembered: six Shardlings to calm (SHARDLING_XP each, ids saved, so a calmed one never returns for XP),
 * Glim the lantern sprite (talk, then report back with a sum once every Shardling is calm: GLIM_XP), and three hidden Moon Tablets
 * (TABLET_XP each, ALL_TABLETS_XP extra for the last; they carry tips for the Warden fight).
 * Every reward is paid once. The XP itself is added to the hero through the normal quest reducer (`{ kind: 'hollow' }` in woodsQuest.ts).
 */
import { HOLLOW_REWARD, WARDEN_REWARD } from './woodsQuest';
import { ECHO_ORDER, GLOWCAP_SPOTS, SHARDLING_SPOTS, SHARD_SPOTS, TABLET_SPOTS, type EchoColor } from './hollowLayout';

export const SHARD_COUNT = SHARD_SPOTS.length;
export const GLOWCAP_COUNT = GLOWCAP_SPOTS.length;
export const SHARD_XP = 10;
export const ALL_SHARDS_XP = 40;
export const DOOR_XP = 20;
export const HEART_XP = 100;
export const SHARDLING_COUNT = SHARDLING_SPOTS.length;
export const SHARDLING_XP = 6;
export const WARDEN_XP = 80;
export const GLIM_XP = 30;
export const TABLET_COUNT = TABLET_SPOTS.length;
export const TABLET_XP = 5;
export const ALL_TABLETS_XP = 15;
/** The most the Hollow can ever pay (v2.28: 386, was 210): used by the tests as the sanity total. */
export const HOLLOW_TOTAL_XP = SHARD_COUNT * SHARD_XP + ALL_SHARDS_XP + DOOR_XP + HEART_XP + SHARDLING_COUNT * SHARDLING_XP + WARDEN_XP + GLIM_XP + TABLET_COUNT * TABLET_XP + ALL_TABLETS_XP;
export const HOLLOW_STORAGE_KEY = 'mindquest.hollow.v1';

export interface HollowState {
  /** The hero has been through the Moonlit Gate at least once. */
  visited: boolean;
  /** Ids (indexes into SHARD_SPOTS) of the Moon Shards found. */
  shards: number[];
  /** Ids of the glowcap mushrooms touched. */
  glowcaps: number[];
  doorOpen: boolean;
  heartDone: boolean;
  /** v2.28: ids (indexes into SHARDLING_SPOTS) of the Shardlings calmed. They stay calm; they are not paid twice. */
  shardlings: number[];
  /** v2.28: the Hollow Warden has been beaten (the Heartstone can then be touched). */
  wardenDefeated: boolean;
  /** v2.28: Glim's request. 0 = not met, 1 = asked to calm the Shardlings, 2 = reported back and thanked. */
  glim: 0 | 1 | 2;
  /** v2.28: ids of the Moon Tablets read. */
  tablets: number[];
}
export const newHollow = (): HollowState => ({ visited: false, shards: [], glowcaps: [], doorOpen: false, heartDone: false, shardlings: [], wardenDefeated: false, glim: 0, tablets: [] });

export interface HollowResult { state: HollowState; xp: number; unlock?: string }
const same = (s: HollowState): HollowResult => ({ state: s, xp: 0 });

export const secretOpen = (s: HollowState): boolean => s.glowcaps.length >= GLOWCAP_COUNT;
/** v2.31.3: the Crystal Hollow is 100%: Heartstone woken, every Moon Shard, Shardling and Moon Tablet found, and Glim thanked. */
export const hollowPerfect = (s: HollowState): boolean => s.heartDone && s.shards.length >= SHARD_COUNT && s.shardlings.length >= SHARDLING_COUNT && s.tablets.length >= TABLET_COUNT && s.glim === 2;
/** v2.31.3: the id of the Moon Shard inside the secret nook (an explicit index: v2.32 appended three more shards after it). */
export const SECRET_SHARD = 4;
/** v2.31.3: true when every Moon Shard but the one in the secret nook has been found, so the quest card and the map can point at the glowcaps / the nook. */
export const onlySecretShardLeft = (s: HollowState): boolean => !s.shards.includes(SECRET_SHARD) && SHARD_SPOTS.every((_, i) => i === SECRET_SHARD || s.shards.includes(i));
export const shardsDone = (s: HollowState): boolean => s.shards.length >= SHARD_COUNT;
export const shardlingsDone = (s: HollowState): boolean => s.shardlings.length >= SHARDLING_COUNT;
export const tabletsDone = (s: HollowState): boolean => s.tablets.length >= TABLET_COUNT;

export const markVisited = (s: HollowState): HollowState => (s.visited ? s : { ...s, visited: true });

export function collectShard(s: HollowState, id: number): HollowResult & { first: boolean; all: boolean } {
  if (!Number.isInteger(id) || id < 0 || id >= SHARD_COUNT || s.shards.includes(id)) return { ...same(s), first: false, all: false };
  const shards = [...s.shards, id], all = shards.length >= SHARD_COUNT;
  return { state: { ...s, shards }, xp: SHARD_XP + (all ? ALL_SHARDS_XP : 0), first: true, all };
}

export function lightGlowcap(s: HollowState, id: number): { state: HollowState; first: boolean; opened: boolean } {
  if (!Number.isInteger(id) || id < 0 || id >= GLOWCAP_COUNT || s.glowcaps.includes(id)) return { state: s, first: false, opened: false };
  const next = { ...s, glowcaps: [...s.glowcaps, id] };
  return { state: next, first: true, opened: secretOpen(next) && !secretOpen(s) };
}

export type EchoOutcome = 'right' | 'wrong' | 'solved' | 'ignored';
/**
 * One strike on an Echo Crystal. `step` is how many of the sequence the child has struck right in this attempt (kept in memory, not saved).
 * A wrong crystal resets the attempt (nothing is lost, there is no penalty); the right three open the door.
 */
export function strikeEcho(s: HollowState, step: number, color: EchoColor): { state: HollowState; step: number; outcome: EchoOutcome; xp: number } {
  if (s.doorOpen) return { state: s, step, outcome: 'ignored', xp: 0 };
  const at = Math.max(0, Math.min(ECHO_ORDER.length - 1, Math.floor(step) || 0));
  if (ECHO_ORDER[at] !== color) return { state: s, step: 0, outcome: 'wrong', xp: 0 };
  if (at + 1 >= ECHO_ORDER.length) return { state: { ...s, doorOpen: true }, step: 0, outcome: 'solved', xp: DOOR_XP };
  return { state: s, step: at + 1, outcome: 'right', xp: 0 };
}

/** A Shardling has been calmed. Each id pays once; a bad id or a repeat pays nothing. */
export function calmShardling(s: HollowState, id: number): HollowResult & { first: boolean; all: boolean } {
  if (!Number.isInteger(id) || id < 0 || id >= SHARDLING_COUNT || s.shardlings.includes(id)) return { ...same(s), first: false, all: false };
  const shardlings = [...s.shardlings, id].sort((a, b) => a - b);
  return { state: { ...s, shardlings }, xp: SHARDLING_XP, first: true, all: shardlings.length >= SHARDLING_COUNT };
}

/** The Warden falls: only once the door is open, only once. Pays XP and the Warden's Mantle. */
export function defeatWarden(s: HollowState): HollowResult {
  if (!s.doorOpen || s.wardenDefeated) return same(s);
  return { state: { ...s, wardenDefeated: true }, xp: WARDEN_XP, unlock: WARDEN_REWARD };
}
/** The Warden should be in the Heart Chamber: the door is open and it has not been beaten. */
export const wardenAwake = (s: HollowState): boolean => s.doorOpen && !s.wardenDefeated;

/** Reading a Moon Tablet: each pays once, the last pays a bonus. */
export function readTablet(s: HollowState, id: number): HollowResult & { first: boolean; all: boolean } {
  if (!Number.isInteger(id) || id < 0 || id >= TABLET_COUNT || s.tablets.includes(id)) return { ...same(s), first: false, all: false };
  const tablets = [...s.tablets, id].sort((a, b) => a - b), all = tablets.length >= TABLET_COUNT;
  return { state: { ...s, tablets }, xp: TABLET_XP + (all ? ALL_TABLETS_XP : 0), first: true, all };
}

/** What Glim says next: his first request, a reminder while Shardlings remain, his report-and-sum once all are calm, or thanks. */
export type GlimScript = 'intro' | 'waiting' | 'report' | 'thanks';
export function glimScript(s: HollowState): GlimScript {
  if (s.glim >= 2) return 'thanks';
  if (shardlingsDone(s)) return 'report';
  return s.glim === 0 ? 'intro' : 'waiting';
}
/** After Glim's first request has been heard. */
export const glimAsked = (s: HollowState): HollowState => (s.glim === 0 ? { ...s, glim: 1 } : s);
/** After the sum has been answered (the question never fails, so this is always reachable): pays GLIM_XP once, and only if every Shardling is calm. */
export function glimClaim(s: HollowState): HollowResult {
  if (s.glim >= 2 || !shardlingsDone(s)) return same(s);
  return { state: { ...s, glim: 2 }, xp: GLIM_XP };
}

/** Touching the Heartstone: only after the Heart Door is open and the Warden is beaten, only once. */
export function touchHeart(s: HollowState): HollowResult {
  if (!s.doorOpen || !s.wardenDefeated || s.heartDone) return same(s);
  return { state: { ...s, heartDone: true }, xp: HEART_XP, unlock: HOLLOW_REWARD };
}

const ids = (v: unknown, max: number): number[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < max))].sort((a, b) => a - b) : []);

/**
 * Accepts anything (parsed storage) and returns valid state. A save can never claim the Heartstone without the door, or a door nobody has
 * visited. Saves from before v2.28 have none of the new fields: a finished Heartstone means the Warden is (treated as) beaten, so nobody who
 * already finished is sent back to fight it, and a hero who only opened the door will meet it.
 */
export function sanitizeHollow(raw: unknown): HollowState {
  if (typeof raw !== 'object' || raw === null) return newHollow();
  const r = raw as Record<string, unknown>;
  const heartDone = r.heartDone === true;
  const doorOpen = r.doorOpen === true || heartDone;
  const shards = ids(r.shards, SHARD_COUNT), glowcaps = ids(r.glowcaps, GLOWCAP_COUNT), shardlings = ids(r.shardlings, SHARDLING_COUNT), tablets = ids(r.tablets, TABLET_COUNT);
  const wardenDefeated = (r.wardenDefeated === true && doorOpen) || heartDone;
  // Glim's thanks needs every Shardling calm, and cannot be claimed before he has been met
  const glim: 0 | 1 | 2 = r.glim === 2 && shardlings.length >= SHARDLING_COUNT ? 2 : r.glim === 1 || r.glim === 2 ? 1 : 0;
  return { visited: r.visited === true || doorOpen || shards.length > 0 || glowcaps.length > 0 || shardlings.length > 0 || tablets.length > 0 || glim > 0, shards, glowcaps, doorOpen, heartDone, shardlings, wardenDefeated, glim, tablets };
}
export function loadHollow(store: Pick<Storage, 'getItem'> | undefined = safeStorage()): HollowState {
  try { const t = store?.getItem(HOLLOW_STORAGE_KEY); return t ? sanitizeHollow(JSON.parse(t)) : newHollow(); } catch { return newHollow(); }
}
export function saveHollow(s: HollowState, store: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try { if (!store) return false; store.setItem(HOLLOW_STORAGE_KEY, JSON.stringify(sanitizeHollow(s))); return true; } catch { return false; }
}
function safeStorage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
