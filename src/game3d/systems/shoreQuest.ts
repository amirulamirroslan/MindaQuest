/**
 * Moonwake Shore progress (v2.29, pure reducer functions, unit-tested, saved on the device under its own key so older saves are untouched).
 *
 * The shore has one goal and plenty of optional treasure:
 *   - ring the three bell-buoys in the right order: the EBB song (wave, shell, star) brings LOW tide, the FLOOD song (star, shell, wave: the
 *     ebb song played backwards) brings HIGH tide. A wrong bell just starts the attempt again. Each song pays once; once BOTH have been rung the
 *     tide puzzle is solved and the Moon Causeway to the lighthouse rises for good (SONG_XP each, TIDE_SOLVED_XP extra).
 *   - the Tidecaller Heron perches on the lighthouse island from the moment the causeway rises until it is calm (HERON_XP);
 *   - touch the lamp (only once the Heron is calm): LAMP_XP and the Lighthouse Lantern.
 * Optional extras, all paid once and remembered: eight pieces of sea-glass (GLASS_XP each; all eight = ALL_GLASS_XP and, when Mak Long has
 * been told, the Sailor set), five Pebble Crabs and four Gloom Gulls to calm (ids saved, never paid twice), three message bottles with tips
 * for the Heron, Harbour-master Mak Long's money sum and the lighthouse keeper's clock riddle.
 * The XP itself is added to the hero through the normal quest reducer (`{ kind: 'shore' }` in woodsQuest.ts).
 */
import { LANTERN_REWARD, SAILOR_REWARDS } from './woodsQuest';
import { BOTTLE_SPOTS, BUOYS, CRAB_SPOTS, EBB_SONG, FLOOD_SONG, GLASS_SPOTS, GULL_SPOTS, type BuoyId, type Tide } from './shoreLayout';

export const GLASS_COUNT = GLASS_SPOTS.length;
export const CRAB_COUNT = CRAB_SPOTS.length;
export const GULL_COUNT = GULL_SPOTS.length;
export const BOTTLE_COUNT = BOTTLE_SPOTS.length;
export const SONG_XP = 15;
export const TIDE_SOLVED_XP = 20;
export const GLASS_XP = 5;
export const ALL_GLASS_XP = 20;
export const CRAB_XP = 6;
export const GULL_XP = 8;
export const BOTTLE_XP = 5;
export const ALL_BOTTLES_XP = 15;
export const MAK_XP = 30;
export const KEEPER_XP = 30;
export const HERON_XP = 100;
export const LAMP_XP = 100;
/** The most the shore can ever pay: used by the tests as the sanity total. */
export const SHORE_TOTAL_XP = 2 * SONG_XP + TIDE_SOLVED_XP + GLASS_COUNT * GLASS_XP + ALL_GLASS_XP + CRAB_COUNT * CRAB_XP + GULL_COUNT * GULL_XP + BOTTLE_COUNT * BOTTLE_XP + ALL_BOTTLES_XP + MAK_XP + KEEPER_XP + HERON_XP + LAMP_XP;
export const SHORE_STORAGE_KEY = 'mindquest.shore.v1';

export type Song = 'ebb' | 'flood';
export const SONGS: Readonly<Record<Song, readonly BuoyId[]>> = { ebb: EBB_SONG, flood: FLOOD_SONG };
export const TIDE_OF: Readonly<Record<Song, Tide>> = { ebb: 'low', flood: 'high' };

export interface ShoreState {
  /** The hero has been to the shore at least once. */
  visited: boolean;
  /** Where the tide is now. It starts 'still' (stopped) and, once moving, is always 'low' or 'high'. */
  tide: Tide;
  /** The songs rung right at least once. Both = the tide puzzle is solved. */
  songs: Song[];
  glass: number[];
  crabs: number[];
  gulls: number[];
  bottles: number[];
  /** Harbour-master Mak Long. 0 = not met, 1 = asked for sea-glass, 2 = counted it with the child and paid. */
  mak: 0 | 1 | 2;
  /** The lighthouse keeper. 0 = not met, 1 = told about the Heron, 2 = set the clock riddle once the Heron was calm. */
  keeper: 0 | 1 | 2;
  heronDefeated: boolean;
  lampLit: boolean;
}
export const newShore = (): ShoreState => ({ visited: false, tide: 'still', songs: [], glass: [], crabs: [], gulls: [], bottles: [], mak: 0, keeper: 0, heronDefeated: false, lampLit: false });

export interface ShoreResult { state: ShoreState; xp: number; unlocks?: string[] }
const same = (s: ShoreState): ShoreResult => ({ state: s, xp: 0 });

export const tideSolved = (s: ShoreState): boolean => s.songs.length >= 2;
/** The Moon Causeway is up for good once the puzzle is solved. */
export const causewayOpen = (s: ShoreState): boolean => tideSolved(s);
export const glassDone = (s: ShoreState): boolean => s.glass.length >= GLASS_COUNT;
export const bottlesDone = (s: ShoreState): boolean => s.bottles.length >= BOTTLE_COUNT;
/** The Heron is on the island: the causeway is up and it has not been calmed. */
export const heronAwake = (s: ShoreState): boolean => causewayOpen(s) && !s.heronDefeated;
export const markVisited = (s: ShoreState): ShoreState => (s.visited ? s : { ...s, visited: true });

/** What the ground depends on. */
export const gatesOf = (s: ShoreState): { tide: Tide; causeway: boolean } => ({ tide: s.tide, causeway: causewayOpen(s) });

// ------------------------------------------------------------------------------------------------------------------ the bells
export type BellOutcome = 'right' | 'wrong' | 'ebb' | 'flood' | 'same';
/**
 * One ring of a bell-buoy. `attempt` is the bells rung right so far in this try (kept in memory, not saved). A bell that is not the next in
 * either song starts again (nothing is lost, there is no penalty). When a whole song is rung the tide follows it: the first time pays SONG_XP,
 * and ringing the second song solves the puzzle (TIDE_SOLVED_XP). Ringing the song for the tide that is already here changes nothing ('same').
 */
export function ringBuoy(s: ShoreState, attempt: readonly BuoyId[], buoy: BuoyId): { state: ShoreState; attempt: BuoyId[]; outcome: BellOutcome; xp: number; solved: boolean } {
  const safe = attempt.slice(0, 2), next = [...safe, buoy], fits = (song: readonly BuoyId[]): boolean => next.every((b, i) => song[i] === b);
  const candidates = (Object.keys(SONGS) as Song[]).filter(k => fits(SONGS[k]));
  if (!BUOYS.includes(buoy) || !candidates.length) {
    // a wrong bell: start again; if it happens to open a song, that counts as the first bell of a new try
    const fresh = (Object.keys(SONGS) as Song[]).filter(k => SONGS[k][0] === buoy);
    return { state: s, attempt: fresh.length ? [buoy] : [], outcome: 'wrong', xp: 0, solved: false };
  }
  const done = candidates.find(k => SONGS[k].length === next.length);
  if (!done) return { state: s, attempt: next, outcome: 'right', xp: 0, solved: false };
  const tide = TIDE_OF[done];
  if (s.tide === tide) return { state: s, attempt: [], outcome: 'same', xp: 0, solved: false };
  const first = !s.songs.includes(done), songs = first ? [...s.songs, done] : s.songs, state = { ...s, tide, songs };
  const solved = first && songs.length >= 2;
  return { state, attempt: [], outcome: done, xp: first ? SONG_XP + (solved ? TIDE_SOLVED_XP : 0) : 0, solved };
}

// ------------------------------------------------------------------------------------------------------------------ small prizes
type CountResult = ShoreResult & { first: boolean; all: boolean };
const noPay = (s: ShoreState): CountResult => ({ ...same(s), first: false, all: false });
/** A piece of sea-glass picked up: each id pays once, the eighth pays a bonus. */
export function collectGlass(s: ShoreState, id: number): CountResult {
  if (!Number.isInteger(id) || id < 0 || id >= GLASS_COUNT || s.glass.includes(id)) return noPay(s);
  const glass = [...s.glass, id].sort((a, b) => a - b), all = glass.length >= GLASS_COUNT;
  return { state: { ...s, glass }, xp: GLASS_XP + (all ? ALL_GLASS_XP : 0), first: true, all };
}
/** A Pebble Crab calmed. Each id pays once; a bad id or a repeat pays nothing. */
export function calmCrab(s: ShoreState, id: number): CountResult {
  if (!Number.isInteger(id) || id < 0 || id >= CRAB_COUNT || s.crabs.includes(id)) return noPay(s);
  const crabs = [...s.crabs, id].sort((a, b) => a - b);
  return { state: { ...s, crabs }, xp: CRAB_XP, first: true, all: crabs.length >= CRAB_COUNT };
}
/** A Gloom Gull calmed. */
export function calmGull(s: ShoreState, id: number): CountResult {
  if (!Number.isInteger(id) || id < 0 || id >= GULL_COUNT || s.gulls.includes(id)) return noPay(s);
  const gulls = [...s.gulls, id].sort((a, b) => a - b);
  return { state: { ...s, gulls }, xp: GULL_XP, first: true, all: gulls.length >= GULL_COUNT };
}
/** A message bottle read: each pays once, the last pays a bonus. */
export function readBottle(s: ShoreState, id: number): CountResult {
  if (!Number.isInteger(id) || id < 0 || id >= BOTTLE_COUNT || s.bottles.includes(id)) return noPay(s);
  const bottles = [...s.bottles, id].sort((a, b) => a - b), all = bottles.length >= BOTTLE_COUNT;
  return { state: { ...s, bottles }, xp: BOTTLE_XP + (all ? ALL_BOTTLES_XP : 0), first: true, all };
}

// ------------------------------------------------------------------------------------------------------------------ Mak Long
/** What Mak Long says next: his first request, a reminder while sea-glass remains, his money sum once all eight are found, or thanks. */
export type MakScript = 'intro' | 'waiting' | 'report' | 'thanks';
export function makScript(s: ShoreState): MakScript {
  if (s.mak >= 2) return 'thanks';
  if (glassDone(s)) return 'report';
  return s.mak === 0 ? 'intro' : 'waiting';
}
export const makAsked = (s: ShoreState): ShoreState => (s.mak === 0 ? { ...s, mak: 1 } : s);
/** After the money sum has been answered (it never fails): pays MAK_XP and the Sailor set once, and only if all the sea-glass is found. */
export function makClaim(s: ShoreState): ShoreResult {
  if (s.mak >= 2 || !glassDone(s)) return same(s);
  return { state: { ...s, mak: 2 }, xp: MAK_XP, unlocks: [...SAILOR_REWARDS] };
}

// ------------------------------------------------------------------------------------------------------------------ the keeper, the Heron, the lamp
/** What the keeper says next: his warning about the Heron, a reminder while it is awake, the clock riddle once it is calm, or thanks. */
export type KeeperScript = 'intro' | 'waiting' | 'report' | 'thanks';
export function keeperScript(s: ShoreState): KeeperScript {
  if (s.keeper >= 2) return 'thanks';
  if (s.heronDefeated) return 'report';
  return s.keeper === 0 ? 'intro' : 'waiting';
}
export const keeperAsked = (s: ShoreState): ShoreState => (s.keeper === 0 ? { ...s, keeper: 1 } : s);
/** After the clock riddle has been answered (it never fails): pays KEEPER_XP once, and only if the Heron is calm. */
export function keeperClaim(s: ShoreState): ShoreResult {
  if (s.keeper >= 2 || !s.heronDefeated) return same(s);
  return { state: { ...s, keeper: 2 }, xp: KEEPER_XP };
}
/** The Heron falls: only once the causeway is up, only once. */
export function defeatHeron(s: ShoreState): ShoreResult {
  if (!causewayOpen(s) || s.heronDefeated) return same(s);
  return { state: { ...s, heronDefeated: true }, xp: HERON_XP };
}
/** Touching the lamp: only after the Heron is calm, only once. Pays LAMP_XP and the Lighthouse Lantern. */
export function lightLamp(s: ShoreState): ShoreResult {
  if (!s.heronDefeated || s.lampLit) return same(s);
  return { state: { ...s, lampLit: true }, xp: LAMP_XP, unlocks: [LANTERN_REWARD] };
}

// ------------------------------------------------------------------------------------------------------------------ saving
const ids = (v: unknown, max: number): number[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < max))].sort((a, b) => a - b) : []);

/**
 * Accepts anything (parsed storage) and returns valid state. A save can never claim the lamp without the Heron, the Heron without the
 * causeway, a causeway without both songs, or thanks from a keeper or harbour-master who was never helped. A solved puzzle with no tide
 * recorded is given a low tide (never a stuck one), so a hand-edited or damaged save cannot strand anybody.
 */
export function sanitizeShore(raw: unknown): ShoreState {
  if (typeof raw !== 'object' || raw === null) return newShore();
  const r = raw as Record<string, unknown>;
  const songs = [...new Set((Array.isArray(r.songs) ? r.songs : []).filter((x): x is Song => x === 'ebb' || x === 'flood'))] as Song[];
  const lampLit = r.lampLit === true;
  const solved = songs.length >= 2 || lampLit || r.heronDefeated === true;
  const allSongs: Song[] = solved ? ['ebb', 'flood'] : songs;
  const heronDefeated = (r.heronDefeated === true && solved) || lampLit;
  const glass = ids(r.glass, GLASS_COUNT), crabs = ids(r.crabs, CRAB_COUNT), gulls = ids(r.gulls, GULL_COUNT), bottles = ids(r.bottles, BOTTLE_COUNT);
  let tide: Tide = r.tide === 'low' || r.tide === 'high' || r.tide === 'still' ? r.tide : 'still';
  if (allSongs.length > 0 && tide === 'still') tide = 'low';   // once the tide has moved it never stops again
  const mak: 0 | 1 | 2 = r.mak === 2 && glass.length >= GLASS_COUNT ? 2 : r.mak === 1 || r.mak === 2 ? 1 : 0;
  const keeper: 0 | 1 | 2 = r.keeper === 2 && heronDefeated ? 2 : r.keeper === 1 || r.keeper === 2 ? 1 : 0;
  return {
    visited: r.visited === true || allSongs.length > 0 || glass.length > 0 || crabs.length > 0 || gulls.length > 0 || bottles.length > 0 || mak > 0 || keeper > 0,
    tide, songs: allSongs, glass, crabs, gulls, bottles, mak, keeper, heronDefeated, lampLit,
  };
}
export function loadShore(store: Pick<Storage, 'getItem'> | undefined = safeStorage()): ShoreState {
  try { const t = store?.getItem(SHORE_STORAGE_KEY); return t ? sanitizeShore(JSON.parse(t)) : newShore(); } catch { return newShore(); }
}
export function saveShore(s: ShoreState, store: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try { if (!store) return false; store.setItem(SHORE_STORAGE_KEY, JSON.stringify(sanitizeShore(s))); return true; } catch { return false; }
}
function safeStorage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
