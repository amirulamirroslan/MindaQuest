/**
 * Persistent cosmetics inventory (pure maths + a small storage shim, unit-tested).
 *
 * Stored under `mindquest.cosmetics.v2`: which items were granted, which are equipped, and the cape/hat tints. Nothing else changes
 * format: the eight wardrobe colours stay in `mindaquest.outfit.v1` and the old accessories in `mindquest.equipment.v1`, which are
 * READ (never deleted) the first time to build the new state, so every saved look and unlocked reward carries over.
 */
import { CATALOG, COSMETIC_SLOTS, DEFAULT_EQUIPPED, OPTIONAL_SLOTS, itemById, type CosmeticItem, type CosmeticSlot } from './catalog';

export const COSMETICS_STORAGE_KEY = 'mindquest.cosmetics.v2';
export const TINT_SLOTS = ['cape', 'headgear'] as const;
export type TintSlot = (typeof TINT_SLOTS)[number];
/** Swatch count for cape/hat tints (index 0 = the item's own colour). Matches `PARTS.tunic.swatches`. */
export const TINT_SWATCHES = 10;

export type Equipped = Record<CosmeticSlot, string | null>;
export interface CosmeticsState {
  version: 2;
  /** Items granted by a reward or (later) a purchase. Free, level and quest items are derived, not stored, so they cannot be lost. */
  granted: string[];
  equipped: Equipped;
  tints: Record<TintSlot, number>;
}

/** What decides ownership right now (all from the existing save data). */
export interface OwnershipContext { level: number; unlocked: readonly string[] }

export type ItemStatus = 'equipped' | 'owned' | 'locked';
export type LockReason = { kind: 'level'; level: number } | { kind: 'quest' } | { kind: 'premium' };

export const defaultCosmetics = (): CosmeticsState => ({ version: 2, granted: [], equipped: { ...DEFAULT_EQUIPPED }, tints: { cape: 0, headgear: 0 } });

export function isOwned(item: CosmeticItem, state: CosmeticsState, ctx: OwnershipContext): boolean {
  if (state.granted.includes(item.id)) return true;
  switch (item.access.type) {
    case 'free': return true;
    case 'level': return ctx.level >= item.access.level;
    case 'quest': return ctx.unlocked.includes(item.access.unlock);
    case 'premium': return false; // only a grant (a future, approved store) can own a premium item
  }
}
export function lockReason(item: CosmeticItem): LockReason | null {
  const a = item.access;
  return a.type === 'level' ? { kind: 'level', level: a.level } : a.type === 'quest' ? { kind: 'quest' } : a.type === 'premium' ? { kind: 'premium' } : null;
}
export function statusOf(item: CosmeticItem, state: CosmeticsState, ctx: OwnershipContext): ItemStatus {
  if (state.equipped[item.slot] === item.id) return 'equipped';
  return isOwned(item, state, ctx) ? 'owned' : 'locked';
}

/** Collection progress: how many of a collection's items are owned. */
export function collectionProgress(state: CosmeticsState, ctx: OwnershipContext): Record<string, { owned: number; total: number }> {
  const out: Record<string, { owned: number; total: number }> = {};
  for (const i of CATALOG) { const c = (out[i.collection] ??= { owned: 0, total: 0 }); c.total++; if (isOwned(i, state, ctx)) c.owned++; }
  return out;
}

/** Equips (or clears, with null) one slot. Refuses unowned items and the empty value for slots that must be filled. Returns a new state. */
export function equip(state: CosmeticsState, slot: CosmeticSlot, id: string | null, ctx: OwnershipContext): CosmeticsState {
  if (id === null) return OPTIONAL_SLOTS.includes(slot) ? { ...state, equipped: { ...state.equipped, [slot]: null } } : state;
  const item = itemById(id);
  if (!item || item.slot !== slot || !isOwned(item, state, ctx)) return state;
  return { ...state, equipped: { ...state.equipped, [slot]: id } };
}
export const setTint = (state: CosmeticsState, slot: TintSlot, index: number): CosmeticsState =>
  Number.isInteger(index) && index >= 0 && index < TINT_SWATCHES ? { ...state, tints: { ...state.tints, [slot]: index } } : state;
/** Back to the starter look (granted items stay granted: resetting never takes anything away). */
export const resetLook = (state: CosmeticsState): CosmeticsState => ({ ...state, equipped: { ...DEFAULT_EQUIPPED }, tints: { cape: 0, headgear: 0 } });
export function grant(state: CosmeticsState, id: string): CosmeticsState {
  return itemById(id) && !state.granted.includes(id) ? { ...state, granted: [...state.granted, id] } : state;
}

/** Accepts anything (parsed storage) and returns a valid state: unknown ids, wrong slots and unowned items are dropped, never thrown. */
export function sanitizeCosmetics(raw: unknown, ctx: OwnershipContext): CosmeticsState {
  const base = defaultCosmetics();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  const granted = Array.isArray(r.granted) ? [...new Set(r.granted.filter((x): x is string => typeof x === 'string' && !!itemById(x)))].slice(0, 400) : [];
  const state: CosmeticsState = { ...base, granted };
  const eq = typeof r.equipped === 'object' && r.equipped !== null ? (r.equipped as Record<string, unknown>) : {};
  for (const slot of COSMETIC_SLOTS) {
    const v = eq[slot];
    if (v === null && OPTIONAL_SLOTS.includes(slot)) { state.equipped[slot] = null; continue; }
    const item = typeof v === 'string' ? itemById(v) : undefined;
    if (item && item.slot === slot && isOwned(item, state, ctx)) state.equipped[slot] = item.id;
  }
  const t = typeof r.tints === 'object' && r.tints !== null ? (r.tints as Record<string, unknown>) : {};
  for (const s of TINT_SLOTS) { const v = t[s]; if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < TINT_SWATCHES) state.tints[s] = v; }
  return state;
}

/** First run on a device that already has the old accessories: head -> headgear, back -> cape, hand -> off hand. */
export function migrateLegacyEquipment(legacy: unknown, ctx: OwnershipContext): CosmeticsState {
  const state = defaultCosmetics();
  if (typeof legacy !== 'object' || legacy === null) return state;
  const l = legacy as Record<string, unknown>;
  const pairs: [string, CosmeticSlot][] = [['head', 'headgear'], ['back', 'cape'], ['hand', 'offhand']];
  for (const [old, slot] of pairs) {
    const item = typeof l[old] === 'string' ? itemById(l[old] as string) : undefined;
    if (item && item.slot === slot && isOwned(item, state, ctx)) state.equipped[slot] = item.id;
  }
  return state;
}

type Reader = Pick<Storage, 'getItem'>; type Writer = Pick<Storage, 'setItem'>;
const browserStore = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };

export function loadCosmetics(ctx: OwnershipContext, legacyEquipmentKey = 'mindquest.equipment.v1', store: Reader | undefined = browserStore()): CosmeticsState {
  try {
    const text = store?.getItem(COSMETICS_STORAGE_KEY);
    if (text) return sanitizeCosmetics(JSON.parse(text), ctx);
    const old = store?.getItem(legacyEquipmentKey);
    return migrateLegacyEquipment(old ? JSON.parse(old) : null, ctx);
  } catch { return defaultCosmetics(); }
}
/** False when the browser refused (private mode, quota): the look still works for this session. */
export function saveCosmetics(state: CosmeticsState, store: Writer | undefined = browserStore()): boolean {
  try { if (!store) return false; store.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

/** Items that are owned in `next` but were not in `prev` (a level-up or a quest reward just made them available). */
export function newlyOwned(prev: OwnershipContext, next: OwnershipContext, state: CosmeticsState): CosmeticItem[] {
  return CATALOG.filter(i => !isOwned(i, state, prev) && isOwned(i, state, next));
}
