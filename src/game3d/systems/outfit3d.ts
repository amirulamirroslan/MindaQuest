/**
 * Bridge from the existing wardrobe (`art/parts.ts`, saved under `mindaquest.outfit.v1`) to the 3D hero.
 * The wardrobe is NOT replaced: the same eight swatch indices are read and mapped to 3D mesh-group colours, so the
 * player's saved look carries straight over. Accessories (hats, capes, new weapons) are new and stored separately
 * (`mindquest.equipment.v1`) because the 2D wardrobe cannot express shapes.
 */
import { PARTS, PART_KEYS, type Outfit, type PartKey } from '../../game/art/parts';

/** Mesh groups on the 3D hero, and which wardrobe part tints each. */
export type MeshGroup = 'hair' | 'hood' | 'tunic' | 'trousers' | 'boots' | 'belt' | 'pack' | 'skin' | 'blade' | 'eyes';
export const MESH_GROUP_PART: Readonly<Record<MeshGroup, PartKey>> = {
  hair: 'hood', hood: 'hood', tunic: 'tunic', trousers: 'trousers', boots: 'boots', belt: 'gear', pack: 'gear', skin: 'skin', blade: 'steel', eyes: 'eyes',
};
export const MESH_GROUPS = Object.keys(MESH_GROUP_PART) as MeshGroup[];

/** Colour (0xRRGGBB) of every mesh group for an outfit. The "Original" swatch (index 0) is the pack's own colour. */
export function resolveOutfitColors(outfit: Outfit): Record<MeshGroup, number> {
  const out = {} as Record<MeshGroup, number>;
  for (const g of MESH_GROUPS) {
    const part = PARTS[MESH_GROUP_PART[g]];
    const idx = outfit[MESH_GROUP_PART[g]];
    out[g] = (part.swatches[idx] ?? part.swatches[0]).hex;
  }
  return out;
}

/** Outfit slots that can gain new shapes. Each is currently satisfied by a procedural mesh; real models can replace them. */
export type AccessorySlot = 'head' | 'back' | 'hand';
export interface AccessoryDef { id: string; label: string; slot: AccessorySlot; /** Progress.unlocked id required, or null if free. */ unlock: string | null }
export const ACCESSORY_CATALOG: readonly AccessoryDef[] = [
  { id: 'leaf-crown', label: 'Leaf crown', slot: 'head', unlock: null },
  { id: 'mossy-cloak', label: 'Mossy cloak', slot: 'back', unlock: 'mossy-cloak' },
  { id: 'glow-lantern', label: 'Glow lantern', slot: 'hand', unlock: null },
];
export const EQUIPMENT_STORAGE_KEY = 'mindquest.equipment.v1';
export type Equipment = Partial<Record<AccessorySlot, string>>;

/** Keeps only known, unlocked accessories, one per slot. Corrupt or locked entries are dropped. */
export function sanitizeEquipment(raw: unknown, unlocked: readonly string[]): Equipment {
  const out: Equipment = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const def of ACCESSORY_CATALOG) {
    if (r[def.slot] === def.id && (def.unlock === null || unlocked.includes(def.unlock))) out[def.slot] = def.id;
  }
  return out;
}
export const wardrobePartCount = PART_KEYS.length;
