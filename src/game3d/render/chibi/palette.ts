/**
 * Palette recolouring for the chibi kit (pure pixel maths, no three.js or DOM, unit-tested).
 *
 * The kit's meshes are painted from small colour atlases. Each pixel is classified into a wardrobe slot from its colour and the kind
 * of mesh it is on (a tan swatch is "skin" on a head but "boots" on legs), then re-tinted to the chosen swatch keeping its lightness,
 * so the pack's shading survives. Rules come from measuring the atlases (see docs/V2_8_CHIBI_NOTES.md).
 */
import { rgbToHsv, hsvToRgb } from '../../../game/art/recolour';
import type { PartKey } from '../../../game/art/parts';

export type MeshKind = 'head' | 'body' | 'legs' | 'headgear' | 'cape' | 'weapon';
export type Slot = PartKey | 'cape' | 'hat';

const deg = (h: number) => h * 360;
/** The kit's shared skin swatch family: light, warm, low-medium saturation. Leather is clearly more saturated, metal clearly less. */
export const isSkin = (h: number, s: number, v: number): boolean => deg(h) >= 18 && deg(h) <= 36 && s >= 0.3 && s <= 0.48 && v >= 0.82;
export const isEye = (h: number, s: number, v: number): boolean => deg(h) >= 185 && deg(h) <= 215 && s >= 0.2 && s <= 0.36 && v <= 0.2;
export const isLeather = (h: number, s: number): boolean => deg(h) >= 8 && deg(h) <= 24 && s >= 0.45 && s <= 0.7;
export const isMetal = (s: number): boolean => s < 0.16;
const isAccent = (h: number, s: number, v: number): boolean => (deg(h) >= 15 && deg(h) <= 50 && s > 0.6) || (isMetal(s) && v > 0.7);

/** Which slot a pixel belongs to on a given kind of mesh, or null to leave it alone. */
export function classify(r: number, g: number, b: number, kind: MeshKind): Slot | null {
  const [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
  switch (kind) {
    case 'head': return isSkin(h, s, v) ? 'skin' : isEye(h, s, v) ? 'eyes' : 'hood';
    case 'body': return isSkin(h, s, v) ? 'skin' : isLeather(h, s) ? 'gear' : 'tunic';
    case 'legs': return isSkin(h, s, v) ? 'skin' : isLeather(h, s) ? 'boots' : 'trousers';
    case 'headgear': return isAccent(h, s, v) ? null : 'hat';
    case 'cape': return 'cape';
    case 'weapon': return s < 0.2 ? 'steel' : null;
  }
}

/** The brightness each slot's source pixels centre on, so a pixel's lightness relative to it carries over to the new colour. */
const REF_V: Record<Slot, number> = { hood: 0.4, tunic: 0.5, trousers: 0.4, boots: 0.6, gear: 0.6, skin: 0.93, steel: 0.55, eyes: 0.15, cape: 0.6, hat: 0.5 };

/** Re-tints one pixel toward `target` (0xRRGGBB), keeping its lightness relationship. */
export function tintPixel(r: number, g: number, b: number, slot: Slot, target: number): [number, number, number] {
  const [, s0, v0] = rgbToHsv(r / 255, g / 255, b / 255);
  const [th, ts, tv] = rgbToHsv(((target >> 16) & 255) / 255, ((target >> 8) & 255) / 255, (target & 255) / 255);
  const nv = Math.min(1, Math.max(0, tv * Math.pow(v0 / REF_V[slot], 0.8)));
  // keep a trace of the pixel's own saturation so gradients do not flatten completely
  const ns = Math.min(1, ts * (0.8 + 0.4 * Math.min(1, s0)));
  const [nr, ng, nb] = hsvToRgb(th, ns, nv);
  return [Math.round(nr * 255), Math.round(ng * 255), Math.round(nb * 255)];
}

/** Recolours RGBA pixels in place. `targets` lists only the slots to change; with none, nothing is touched. Returns how many pixels changed. */
export function recolourAtlas(data: Uint8ClampedArray, kind: MeshKind, targets: Partial<Record<Slot, number>>): number {
  if (!Object.keys(targets).length) return 0;
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const slot = classify(data[i], data[i + 1], data[i + 2], kind);
    const t = slot ? targets[slot] : undefined;
    if (slot === null || t === undefined) continue;
    const [r, g, b] = tintPixel(data[i], data[i + 1], data[i + 2], slot, t);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; changed++;
  }
  return changed;
}
