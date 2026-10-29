import { describe, expect, it } from 'vitest';
import { defaultOutfit, hexToHsv, PART_ID, PART_KEYS, PARTS, randomOutfit, recolourParts, recolourPixel, sanitizeOutfit, isDefaultOutfit, outfitsEqual, type Outfit } from './parts';
import { rgbToHsv } from './recolour';

/** 4x1 atlas: hood, tunic, outline, transparent hood pixel. */
const atlas = () => ({
  data: new Uint8ClampedArray([0x89, 0x63, 0x18, 255, 0x89, 0x63, 0x18, 255, 0x09, 0x09, 0x09, 255, 0x89, 0x63, 0x18, 0]),
  mask: new Uint8Array([PART_ID.hood, PART_ID.tunic, 0, PART_ID.hood]),
});

describe('sanitizeOutfit', () => {
  it('returns the default outfit for junk and keeps valid choices', () => {
    expect(sanitizeOutfit(null)).toEqual(defaultOutfit());
    expect(sanitizeOutfit('hood')).toEqual(defaultOutfit());
    expect(sanitizeOutfit({ hood: 3, tunic: 2 })).toMatchObject({ hood: 3, tunic: 2, skin: 0 });
  });
  it('rejects out-of-range, fractional and non-number values per part', () => {
    const out = sanitizeOutfit({ hood: 99, tunic: -1, skin: 1.5, eyes: '2', steel: 3, boots: NaN });
    expect(out).toMatchObject({ hood: 0, tunic: 0, skin: 0, eyes: 0, steel: 3, boots: 0 });
  });
});

describe('palettes', () => {
  it.each(PART_KEYS)('%s: has an Original swatch first, at most 10 swatches, unique names', (key) => {
    const { swatches } = PARTS[key];
    expect(swatches[0].name).toBe('Original');
    expect(swatches.length).toBeGreaterThan(5);
    expect(swatches.length).toBeLessThanOrEqual(10);
    expect(new Set(swatches.map((s) => s.name)).size).toBe(swatches.length);
  });
  it('gives every part its own mask id', () => {
    expect(new Set(Object.values(PART_ID)).size).toBe(PART_KEYS.length);
  });
});

describe('recolourParts', () => {
  it('leaves everything alone for the default outfit', () => {
    const { data, mask } = atlas(); const before = [...data];
    recolourParts(data, mask, 4, defaultOutfit());
    expect([...data]).toEqual(before);
  });
  it('recolours one part and not another that shares its colour', () => {
    const { data, mask } = atlas();
    recolourParts(data, mask, 4, { ...defaultOutfit(), hood: PARTS.hood.swatches.findIndex((s) => s.name === 'Crimson') });
    expect(data[0] > data[1] && data[0] > data[2]).toBe(true); // hood is now red
    expect([...data.slice(4, 8)]).toEqual([0x89, 0x63, 0x18, 255]); // tunic untouched
  });
  it('never touches outline or transparent pixels', () => {
    const { data, mask } = atlas();
    const all: Outfit = { hood: 1, tunic: 1, trousers: 1, boots: 1, gear: 1, skin: 1, steel: 1, eyes: 1 };
    recolourParts(data, mask, 4, all);
    expect([...data.slice(8, 12)]).toEqual([0x09, 0x09, 0x09, 255]);
    expect([...data.slice(12, 16)]).toEqual([0x89, 0x63, 0x18, 0]);
  });
  it('keeps the lightness order of a part ramp (lit stays lighter than shade)', () => {
    const lit = recolourPixel(0xa0, 0x78, 0x20, PARTS.tunic.ref, hexToHsv(0x3a58ae));
    const shade = recolourPixel(0x47, 0x2e, 0x06, PARTS.tunic.ref, hexToHsv(0x3a58ae));
    expect(Math.max(...lit)).toBeGreaterThan(Math.max(...shade));
  });
  it('moves the hue to the swatch hue', () => {
    const [r, g, b] = recolourPixel(0x89, 0x63, 0x18, PARTS.tunic.ref, hexToHsv(0x3d8043)); // forest
    const [h] = rgbToHsv(r / 255, g / 255, b / 255);
    expect(Math.abs(h - hexToHsv(0x3d8043).h)).toBeLessThan(0.06);
  });
  it('can tint a grey part (steel) to gold', () => {
    const [r, , b] = recolourPixel(0xb6, 0xb6, 0xb6, PARTS.steel.ref, hexToHsv(0xc9a23c));
    expect(r).toBeGreaterThan(b + 30);
  });
  it('only touches the requested region', () => {
    const data = new Uint8ClampedArray(2 * 4).fill(0); const mask = new Uint8Array([PART_ID.tunic, PART_ID.tunic]);
    data.set([0x89, 0x63, 0x18, 255, 0x89, 0x63, 0x18, 255]);
    recolourParts(data, mask, 2, { ...defaultOutfit(), tunic: 2 }, { x: 0, y: 0, w: 1, h: 1 });
    expect(data[0]).not.toBe(0x89);
    expect([...data.slice(4, 8)]).toEqual([0x89, 0x63, 0x18, 255]);
  });
  it('produces the same result for the same colour every time (cache is exact)', () => {
    const data = new Uint8ClampedArray([0x89, 0x63, 0x18, 255, 0x89, 0x63, 0x18, 255]);
    recolourParts(data, new Uint8Array([PART_ID.tunic, PART_ID.tunic]), 2, { ...defaultOutfit(), tunic: 4 });
    expect([...data.slice(0, 4)]).toEqual([...data.slice(4, 8)]);
  });
});

describe('outfit helpers', () => {
  it('detects default and equal outfits', () => {
    expect(isDefaultOutfit(defaultOutfit())).toBe(true);
    expect(isDefaultOutfit({ ...defaultOutfit(), eyes: 2 })).toBe(false);
    expect(outfitsEqual(defaultOutfit(), { ...defaultOutfit() })).toBe(true);
  });
  it('randomOutfit stays inside every palette', () => {
    for (let i = 0; i < 50; i++) {
      const out = randomOutfit(() => Math.random());
      for (const key of PART_KEYS) expect(out[key]).toBeLessThan(PARTS[key].swatches.length);
    }
    expect(randomOutfit(() => 0.999999)).toEqual(sanitizeOutfit(randomOutfit(() => 0.999999)));
  });
});
