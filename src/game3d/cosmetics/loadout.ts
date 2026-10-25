/** Turns saved cosmetics into what the rig must show (pure, unit-tested). */
import { COSMETIC_SLOTS, itemById, type CosmeticItem, type CosmeticSlot } from './catalog';
import type { CosmeticsState } from './inventory';

export interface Loadout {
  /** One resolved item per filled slot. A two-handed weapon removes the off-hand item. */
  items: Partial<Record<CosmeticSlot, CosmeticItem>>;
  capeSwatch: number;
  hatSwatch: number;
}

export function resolveLoadout(state: CosmeticsState): Loadout {
  const items: Loadout['items'] = {};
  for (const slot of COSMETIC_SLOTS) {
    const id = state.equipped[slot]; const item = id ? itemById(id) : undefined;
    if (item && item.slot === slot) items[slot] = item;
  }
  if (items.weapon?.twoHanded) delete items.offhand;
  return { items, capeSwatch: state.tints.cape, hatSwatch: state.tints.headgear };
}

/** True when the hero holds a spare weapon in the off hand (uses the dual-wield attack). */
export const isDualWield = (l: Loadout): boolean => !!l.items.weapon && !l.items.weapon.twoHanded && l.items.offhand?.offhandWeapon === true;

/** Every kit mesh name the loadout shows. */
export function visibleKitNodes(l: Loadout): Set<string> {
  const s = new Set<string>();
  for (const it of Object.values(l.items)) for (const n of it.kit) s.add(n);
  return s;
}
