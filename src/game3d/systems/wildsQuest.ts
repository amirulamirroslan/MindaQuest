/**
 * The Wider Woods (v2.31, pure reducer functions, unit-tested, saved on the device under its own key so every older save is untouched).
 *
 * The expanded woods are optional: nothing here is needed for the main quest, the Hollow or the Shore. It pays small, one-time rewards:
 *   - discovering a region (ZONE_XP, more for the hidden ones), walking onto 14 Fairy Acorns, seven treasure chests, three Old Step tablets
 *   - three people with a small errand each (Pak Tani: pumpkins, Kak Lumut: wisp lanterns, Pak Din: pond pearls), each ending in a sum
 * Every reward is paid once. The XP is added to the hero through the normal quest reducer (`{ kind: 'wilds' }` in woodsQuest.ts).
 * Also saved: which 5 m squares of the map the hero has seen (the fog of war on the map screen).
 */
import { ACORN_SPOTS, CHEST_SPOTS, LANTERN_SPOTS, PEARL_SPOTS, PUMPKIN_SPOTS, TABLET_SPOTS, ZONES, zoneById } from './expansion';
import { LEGACY_WORLD_RADIUS } from './worldShape';

export const WILDS_STORAGE_KEY = 'mindquest.wilds.v1';
export const ACORN_COUNT = ACORN_SPOTS.length, PUMPKIN_COUNT = PUMPKIN_SPOTS.length, PEARL_COUNT = PEARL_SPOTS.length, LANTERN_COUNT = LANTERN_SPOTS.length, TABLET_COUNT = TABLET_SPOTS.length, CHEST_COUNT_ = CHEST_SPOTS.length;
export const ACORN_XP = 2, ALL_ACORNS_XP = 20, ITEM_XP = 3, TABLET_XP = 5, ALL_TABLETS_XP = 10, NPC_XP = 30;
export type Who = 'tani' | 'lumut' | 'din';
export const WHO: readonly Who[] = ['tani', 'lumut', 'din'];

export interface WildsState {
  /** Region ids found (see ZONES). */
  zones: string[];
  acorns: number[]; pumpkins: number[]; pearls: number[]; lanterns: number[]; tablets: number[]; chests: number[];
  /** 0 = not met, 1 = asked for help, 2 = reported back and thanked. */
  tani: 0 | 1 | 2; lumut: 0 | 1 | 2; din: 0 | 1 | 2;
  /** Fog of war: one bit per 5 m square (hex, see exploredAt). */
  explored: string;
}
export const newWilds = (): WildsState => ({ zones: [], acorns: [], pumpkins: [], pearls: [], lanterns: [], tablets: [], chests: [], tani: 0, lumut: 0, din: 0, explored: '' });

export interface WildsResult { state: WildsState; xp: number; first: boolean; all?: boolean }
const same = (s: WildsState): WildsResult => ({ state: s, xp: 0, first: false });
const validId = (id: number, n: number): boolean => Number.isInteger(id) && id >= 0 && id < n;

/** The most the wider woods can ever pay: used by the tests as the sanity total. */
export const WILDS_TOTAL_XP = ZONES.reduce((a, z) => a + z.xp, 0) + ACORN_COUNT * ACORN_XP + ALL_ACORNS_XP + CHEST_SPOTS.reduce((a, c) => a + c.xp, 0)
  + (PUMPKIN_COUNT + PEARL_COUNT + LANTERN_COUNT) * ITEM_XP + TABLET_COUNT * TABLET_XP + ALL_TABLETS_XP + WHO.length * NPC_XP;

export function discoverZone(s: WildsState, id: string): WildsResult {
  const z = zoneById(id); if (!z || s.zones.includes(id)) return same(s);
  return { state: { ...s, zones: [...s.zones, id] }, xp: z.xp, first: true };
}
function collect(s: WildsState, field: 'acorns' | 'pumpkins' | 'pearls' | 'lanterns' | 'tablets' | 'chests', id: number, count: number, xp: number, bonus = 0): WildsResult {
  if (!validId(id, count) || s[field].includes(id)) return same(s);
  const list = [...s[field], id].sort((a, b) => a - b), all = list.length >= count;
  return { state: { ...s, [field]: list }, xp: xp + (all ? bonus : 0), first: true, all };
}
export const collectAcorn = (s: WildsState, id: number): WildsResult => collect(s, 'acorns', id, ACORN_COUNT, ACORN_XP, ALL_ACORNS_XP);
export const collectPumpkin = (s: WildsState, id: number): WildsResult => collect(s, 'pumpkins', id, PUMPKIN_COUNT, ITEM_XP);
export const collectPearl = (s: WildsState, id: number): WildsResult => collect(s, 'pearls', id, PEARL_COUNT, ITEM_XP);
export const lightLantern = (s: WildsState, id: number): WildsResult => collect(s, 'lanterns', id, LANTERN_COUNT, ITEM_XP);
export const readTablet = (s: WildsState, id: number): WildsResult => collect(s, 'tablets', id, TABLET_COUNT, TABLET_XP, ALL_TABLETS_XP);
export function openChest(s: WildsState, id: number): WildsResult {
  const c = CHEST_SPOTS[id]; if (!c || s.chests.includes(id)) return same(s);
  return { state: { ...s, chests: [...s.chests, id].sort((a, b) => a - b) }, xp: c.xp, first: true, all: s.chests.length + 1 >= CHEST_COUNT_ };
}

const itemsOf = (s: WildsState, who: Who): { have: number; need: number } => who === 'tani' ? { have: s.pumpkins.length, need: PUMPKIN_COUNT } : who === 'lumut' ? { have: s.lanterns.length, need: LANTERN_COUNT } : { have: s.pearls.length, need: PEARL_COUNT };
export const errandDone = (s: WildsState, who: Who): boolean => { const i = itemsOf(s, who); return i.have >= i.need; };
export const errandCount = itemsOf;
export type Script = 'intro' | 'waiting' | 'report' | 'thanks';
export function script(s: WildsState, who: Who): Script {
  const st = s[who]; if (st >= 2) return 'thanks';
  if (errandDone(s, who)) return 'report';
  return st === 0 ? 'intro' : 'waiting';
}
export const asked = (s: WildsState, who: Who): WildsState => (s[who] === 0 ? { ...s, [who]: 1 } : s);
/** After the sum at the end of the errand: pays NPC_XP once, and only if every item was found. */
export function claim(s: WildsState, who: Who): WildsResult {
  if (s[who] >= 2 || !errandDone(s, who)) return same(s);
  return { state: { ...s, [who]: 2 }, xp: NPC_XP, first: true };
}
/** The thorn barrier of the Heartwood shortcut is gone once Kak Lumut has been helped. */
export const thornsOpen = (s: WildsState): boolean => s.lumut >= 2;

// ------------------------------------------------------------------ fog of war
export const EXPLORE_CELL = 5, EXPLORE_N = 40, EXPLORE_HALF = (EXPLORE_N * EXPLORE_CELL) / 2;
const BITS = EXPLORE_N * EXPLORE_N;
const cellOf = (v: number): number => Math.floor((v + EXPLORE_HALF) / EXPLORE_CELL);
const bytesOf = (hex: string): Uint8Array => { const b = new Uint8Array(BITS / 8); for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2) || '00', 16) || 0; return b; };
const hexOf = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0'); return s; };
/** Whether the hero has seen the square at (x, z). The original glade is known from the start, so older saves show it in full. */
export function exploredAt(s: WildsState, x: number, z: number): boolean {
  if (Math.hypot(x, z) < LEGACY_WORLD_RADIUS - 2) return true;
  const ix = cellOf(x), iz = cellOf(z); if (ix < 0 || iz < 0 || ix >= EXPLORE_N || iz >= EXPLORE_N) return false;
  const k = iz * EXPLORE_N + ix, i = k >> 3; if (i * 2 >= s.explored.length) return false;
  return (parseInt(s.explored.substr(i * 2, 2), 16) & (1 << (k & 7))) !== 0;
}
/** Marks every square within `radius` metres of (x, z) as seen. Returns the same state object when nothing new was seen. */
export function markExplored(s: WildsState, x: number, z: number, radius = 14): WildsState {
  const b = bytesOf(s.explored); let changed = false;
  for (let iz = Math.max(0, cellOf(z - radius)); iz <= Math.min(EXPLORE_N - 1, cellOf(z + radius)); iz++) for (let ix = Math.max(0, cellOf(x - radius)); ix <= Math.min(EXPLORE_N - 1, cellOf(x + radius)); ix++) {
    const cx = (ix + 0.5) * EXPLORE_CELL - EXPLORE_HALF, cz = (iz + 0.5) * EXPLORE_CELL - EXPLORE_HALF;
    if (Math.hypot(cx - x, cz - z) > radius) continue;
    const k = iz * EXPLORE_N + ix; if (!(b[k >> 3] & (1 << (k & 7)))) { b[k >> 3] |= 1 << (k & 7); changed = true; }
  }
  return changed ? { ...s, explored: hexOf(b) } : s;
}
export function exploredShare(s: WildsState): number { let n = 0, t = 0; for (let iz = 0; iz < EXPLORE_N; iz++) for (let ix = 0; ix < EXPLORE_N; ix++) { const x = (ix + 0.5) * EXPLORE_CELL - EXPLORE_HALF, z = (iz + 0.5) * EXPLORE_CELL - EXPLORE_HALF; if (Math.hypot(x, z) > 96) continue; t++; if (exploredAt(s, x, z)) n++; } return n / t; }

// ------------------------------------------------------------------ saving
const ids = (v: unknown, max: number): number[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < max))].sort((a, b) => a - b) : []);
const stage = (v: unknown): 0 | 1 | 2 => (v === 2 ? 2 : v === 1 ? 1 : 0);
/** Accepts anything (parsed storage) and returns valid state. A thank-you cannot be claimed without every item, or before the request. */
export function sanitizeWilds(raw: unknown): WildsState {
  if (typeof raw !== 'object' || raw === null) return newWilds();
  const r = raw as Record<string, unknown>;
  const s: WildsState = {
    zones: Array.isArray(r.zones) ? [...new Set(r.zones.filter((z): z is string => typeof z === 'string' && !!zoneById(z)))] : [],
    acorns: ids(r.acorns, ACORN_COUNT), pumpkins: ids(r.pumpkins, PUMPKIN_COUNT), pearls: ids(r.pearls, PEARL_COUNT), lanterns: ids(r.lanterns, LANTERN_COUNT), tablets: ids(r.tablets, TABLET_COUNT), chests: ids(r.chests, CHEST_COUNT_),
    tani: stage(r.tani), lumut: stage(r.lumut), din: stage(r.din),
    explored: typeof r.explored === 'string' && /^[0-9a-f]*$/.test(r.explored) && r.explored.length <= BITS / 4 ? r.explored : '',
  };
  for (const w of WHO) if (s[w] === 2 && !errandDone(s, w)) s[w] = 1;
  return s;
}
export function loadWilds(store: Pick<Storage, 'getItem'> | undefined = safeStorage()): WildsState {
  try { const t = store?.getItem(WILDS_STORAGE_KEY); return t ? sanitizeWilds(JSON.parse(t)) : newWilds(); } catch { return newWilds(); }
}
export function saveWilds(s: WildsState, store: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try { if (!store) return false; store.setItem(WILDS_STORAGE_KEY, JSON.stringify(sanitizeWilds(s))); return true; } catch { return false; }
}
function safeStorage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }

/** The zone the hero is standing in, if any (the nearest when two overlap). */
export function zoneAt(x: number, z: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z); if (d < zn.r && d / zn.r < bd) { bd = d / zn.r; best = zn.id; } }
  return best;
}
