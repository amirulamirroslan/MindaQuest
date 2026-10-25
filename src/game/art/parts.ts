/**
 * Outfit parts and their colour options for the Adventurer hero (pure maths, no Phaser or DOM, unit-tested).
 *
 * The pack ships one flattened image per frame, so there are no real layers. What it does have is a disciplined
 * palette (ochre cloth, brown leather, navy trousers, tan skin, grey steel, near-black outline). `partMask.ts`
 * labels every pixel with the part it belongs to, and `recolourParts` below re-tints each part on its own while
 * keeping that pixel's lightness, so the pack's shading survives.
 */
import { hsvToRgb, rgbToHsv } from './recolour';

export type PartKey = 'hood' | 'tunic' | 'trousers' | 'boots' | 'gear' | 'skin' | 'steel' | 'eyes';

/** Values stored in the per-pixel part mask. 0 = not a part (outline, shadow, unclassified): never recoloured. */
export const PART_ID: Record<PartKey, number> = { hood: 1, tunic: 2, trousers: 3, gear: 4, skin: 5, steel: 6, eyes: 7, boots: 8 };
export const NO_PART = 0;

/** Order the wardrobe lists the parts in. */
export const PART_KEYS: readonly PartKey[] = ['hood', 'tunic', 'trousers', 'boots', 'gear', 'skin', 'steel', 'eyes'];

export interface Swatch { name: string; hex: number }
export interface Hsv { h: number; s: number; v: number }
export interface PartDef {
  key: PartKey;
  label: string;
  /** Typical (median) colour of this part in the pack's art: the point the shading is measured from. */
  ref: Hsv;
  /** Index 0 is always the pack's own colour and leaves the pixels untouched. */
  swatches: readonly Swatch[];
}

const cloth = (original: number): Swatch[] => [
  { name: 'Original', hex: original }, { name: 'Forest', hex: 0x3d8043 }, { name: 'Crimson', hex: 0xa83434 }, { name: 'Royal', hex: 0x3a58ae },
  { name: 'Violet', hex: 0x77489f }, { name: 'Teal', hex: 0x228a84 }, { name: 'Rose', hex: 0xc0587a }, { name: 'Bone', hex: 0xc9bd98 },
  { name: 'Slate', hex: 0x566470 }, { name: 'Midnight', hex: 0x2b3558 },
];
const leather = (original: number): Swatch[] => [
  { name: 'Original', hex: original }, { name: 'Black', hex: 0x2e2927 }, { name: 'Tan', hex: 0x94683f }, { name: 'Oxblood', hex: 0x7a2b35 },
  { name: 'Forest', hex: 0x38573a }, { name: 'Navy', hex: 0x34466e }, { name: 'Grey', hex: 0x77726d }, { name: 'Sand', hex: 0xb89868 },
  { name: 'Rust', hex: 0xa9552b }, { name: 'Plum', hex: 0x6a3a78 },
];

export const PARTS: Readonly<Record<PartKey, PartDef>> = {
  hood: { key: 'hood', label: 'Hood & hair', ref: { h: 0.111, s: 0.825, v: 0.537 }, swatches: cloth(0x8a6418) },
  tunic: { key: 'tunic', label: 'Tunic', ref: { h: 0.111, s: 0.825, v: 0.537 }, swatches: cloth(0x8a6418) },
  trousers: {
    key: 'trousers', label: 'Trousers', ref: { h: 0.581, s: 0.7, v: 0.22 },
    swatches: [{ name: 'Original', hex: 0x2c4a6a }, { name: 'Charcoal', hex: 0x3a3a42 }, { name: 'Brown', hex: 0x6a4a2e }, { name: 'Forest', hex: 0x35603f },
      { name: 'Maroon', hex: 0x702733 }, { name: 'Khaki', hex: 0x9a8a5a }, { name: 'Grey', hex: 0x7b8089 }, { name: 'Linen', hex: 0xc4bfae },
      { name: 'Teal', hex: 0x25757a }, { name: 'Black', hex: 0x1e1e22 }],
  },
  boots: { key: 'boots', label: 'Boots', ref: { h: 0.04, s: 0.72, v: 0.23 }, swatches: leather(0x5a2e1c) },
  gear: { key: 'gear', label: 'Pack & belt', ref: { h: 0.04, s: 0.72, v: 0.23 }, swatches: leather(0x5a2e1c) },
  skin: {
    key: 'skin', label: 'Skin', ref: { h: 0.081, s: 0.3, v: 0.875 },
    swatches: [{ name: 'Original', hex: 0xdfbd9d }, { name: 'Porcelain', hex: 0xf2d6c2 }, { name: 'Light', hex: 0xe6bd9b }, { name: 'Tan', hex: 0xc98f63 },
      { name: 'Brown', hex: 0x9a6742 }, { name: 'Deep', hex: 0x6c4228 }, { name: 'Ebony', hex: 0x4a2c1f }, { name: 'Moss', hex: 0x86a966 }, { name: 'Ash', hex: 0xa9a7b3 }],
  },
  steel: {
    key: 'steel', label: 'Blade', ref: { h: 0, s: 0.05, v: 0.49 },
    swatches: [{ name: 'Original', hex: 0xb6b6b6 }, { name: 'Gold', hex: 0xc9a23c }, { name: 'Bronze', hex: 0xa8703a }, { name: 'Ruby', hex: 0xb33a3a },
      { name: 'Ice', hex: 0x7cc0e0 }, { name: 'Obsidian', hex: 0x46424f }, { name: 'Emerald', hex: 0x3fa468 }, { name: 'Amethyst', hex: 0x8b66cc }],
  },
  eyes: {
    key: 'eyes', label: 'Eyes', ref: { h: 0.587, s: 0.835, v: 0.52 },
    swatches: [{ name: 'Original', hex: 0x2f78c8 }, { name: 'Green', hex: 0x3fa35c }, { name: 'Hazel', hex: 0xa8762a }, { name: 'Brown', hex: 0x6b4222 },
      { name: 'Grey', hex: 0x8896a6 }, { name: 'Violet', hex: 0x9356d0 }, { name: 'Amber', hex: 0xe0a21e }, { name: 'Red', hex: 0xd04545 }],
  },
};

/** One swatch index per part. All zeros is the pack's own look. */
export type Outfit = Record<PartKey, number>;

export const DEFAULT_OUTFIT: Readonly<Outfit> = { hood: 0, tunic: 0, trousers: 0, boots: 0, gear: 0, skin: 0, steel: 0, eyes: 0 };
export const defaultOutfit = (): Outfit => ({ ...DEFAULT_OUTFIT });

/** Accepts anything (e.g. parsed storage) and returns a valid outfit: unknown or out-of-range values fall back to 0. */
export function sanitizeOutfit(raw: unknown): Outfit {
  const out = defaultOutfit();
  if (typeof raw !== 'object' || raw === null) return out;
  for (const key of PART_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < PARTS[key].swatches.length) out[key] = value;
  }
  return out;
}

export const isDefaultOutfit = (outfit: Outfit) => PART_KEYS.every((key) => outfit[key] === 0);
export const outfitsEqual = (a: Outfit, b: Outfit) => PART_KEYS.every((key) => a[key] === b[key]);

/** A random outfit. `random` returns [0, 1) so tests can pass a seeded source. */
export function randomOutfit(random: () => number = Math.random): Outfit {
  const out = defaultOutfit();
  for (const key of PART_KEYS) out[key] = Math.min(PARTS[key].swatches.length - 1, Math.floor(random() * PARTS[key].swatches.length));
  return out;
}

export function hexToHsv(hex: number): Hsv {
  const [h, s, v] = rgbToHsv(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  return { h, s, v };
}

/** Keeps the shading contrast of the source ramp when the part's overall brightness changes a lot. */
const VALUE_GAMMA = 0.75;
/** How much of a pixel's own hue offset from the part's typical hue survives (keeps warm highlights and cool shadows). */
const HUE_KEEP = 0.35;

/** Re-tints one pixel from the part's own colour ramp (`ref`) to `target`, keeping its lightness relationship. */
export function recolourPixel(r: number, g: number, b: number, ref: Hsv, target: Hsv): [number, number, number] {
  const [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
  let dh = h - ref.h;
  if (dh > 0.5) dh -= 1; else if (dh < -0.5) dh += 1;
  const nh = (((target.h + dh * HUE_KEEP) % 1) + 1) % 1;
  // Greys (steel) have no hue to scale, so they take the target's saturation directly.
  const ns = ref.s < 0.1 ? target.s : Math.min(1, s * (target.s / ref.s));
  const nv = Math.min(1, Math.max(0, target.v * Math.pow(v / ref.v, VALUE_GAMMA)));
  const [nr, ng, nb] = hsvToRgb(nh, ns, nv);
  return [Math.round(nr * 255), Math.round(ng * 255), Math.round(nb * 255)];
}

export interface Region { x: number; y: number; w: number; h: number }

/**
 * Recolours `data` (RGBA, `width` px wide) in place, part by part, using `mask` (one part id per pixel).
 * Only pixels whose part has a non-original swatch are touched. `region` limits the work to some pixels (a frame).
 */
export function recolourParts(data: Uint8ClampedArray, mask: Uint8Array, width: number, outfit: Outfit, region?: Region) {
  const height = mask.length / width;
  const plan: Array<{ ref: Hsv; target: Hsv; cache: Map<number, number> } | undefined> = [];
  let any = false;
  for (const key of PART_KEYS) {
    const index = outfit[key];
    if (!index) continue;
    const swatch = PARTS[key].swatches[index];
    if (!swatch) continue;
    plan[PART_ID[key]] = { ref: PARTS[key].ref, target: hexToHsv(swatch.hex), cache: new Map() };
    any = true;
  }
  if (!any) return;
  const x0 = Math.max(0, region?.x ?? 0), y0 = Math.max(0, region?.y ?? 0);
  const x1 = Math.min(width, region ? region.x + region.w : width), y1 = Math.min(height, region ? region.y + region.h : height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = y * width + x;
      const part = plan[mask[p]];
      if (!part) continue;
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const packed = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      let result = part.cache.get(packed);
      if (result === undefined) {
        const [r, g, b] = recolourPixel(data[i], data[i + 1], data[i + 2], part.ref, part.target);
        result = (r << 16) | (g << 8) | b;
        part.cache.set(packed, result);
      }
      data[i] = (result >> 16) & 255; data[i + 1] = (result >> 8) & 255; data[i + 2] = result & 255;
    }
  }
}
