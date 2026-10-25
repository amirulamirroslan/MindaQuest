/**
 * Weapon sizing for the chibi hero (v2.10). The kit's weapons were modelled for a normal-headed adventurer; on the chibi (head x1.1,
 * body at 0.57x) a one-handed sword was almost as long as the hero is tall. Each hand-held mesh is shrunk about its GRIP: the kit puts
 * every weapon as a child of a hand slot bone with the grip at the bone's origin, so scaling the node's translation and scale by the
 * same factor keeps the grip exactly in the hand. Pure (no three.js): the rig applies `fitTransform`, tests check the table.
 */

/** Factor per kit node name (1 = the kit's own size). Anything not listed is left alone. */
export const WEAPON_FIT: Readonly<Record<string, number>> = {
  '1H_Sword': 0.66, '1H_Sword_Offhand': 0.66, '2H_Sword': 0.7,
  '1H_Axe': 0.78, '1H_Axe_Offhand': 0.78, '2H_Axe': 0.78,
  Knife: 0.86, Knife_Offhand: 0.86,
  '1H_Wand': 0.9, '2H_Staff': 0.8, Spellbook: 0.85,
  Round_Shield: 0.82, Badge_Shield: 0.82, Rectangle_Shield: 0.82, Spike_Shield: 0.82, Barbarian_Round_Shield: 0.82,
};

export const weaponFit = (nodeName: string): number => WEAPON_FIT[nodeName] ?? 1;

type V3 = readonly [number, number, number];
/** The node's new translation and uniform scale after shrinking about the grip (the parent's origin). */
export function fitTransform(position: V3, scale: V3, k: number): { position: [number, number, number]; scale: [number, number, number] } {
  return { position: [position[0] * k, position[1] * k, position[2] * k], scale: [scale[0] * k, scale[1] * k, scale[2] * k] };
}

/** Bones whose children are hand-held items. */
export const isHandSlot = (boneName: string): boolean => boneName.startsWith('handslot');
