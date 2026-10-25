import { describe, expect, it } from 'vitest';
import { PART_ID } from './parts';
import { BOOT_SPLIT, buildPartMask, classifyPixel, HOOD_SPLIT } from './partMask';
import { rgbToHsv } from './recolour';

const hsv = (r: number, g: number, b: number) => rgbToHsv(r / 255, g / 255, b / 255);

describe('classifyPixel (pack colours)', () => {
  it('splits the shared ochre into hood (head) and tunic (body)', () => {
    expect(classifyPixel(hsv(0x89, 0x63, 0x18), true, false)).toBe(PART_ID.hood);
    expect(classifyPixel(hsv(0x89, 0x63, 0x18), false, false)).toBe(PART_ID.tunic);
  });
  it('splits the shared leather into pack/belt and boots (feet)', () => {
    expect(classifyPixel(hsv(0x5a, 0x2e, 0x1c), false, false)).toBe(PART_ID.gear);
    expect(classifyPixel(hsv(0x5a, 0x2e, 0x1c), false, true)).toBe(PART_ID.boots);
  });
  it('finds skin, steel, trousers and eyes', () => {
    expect(classifyPixel(hsv(0xdf, 0xbd, 0x9d), true, false)).toBe(PART_ID.skin);
    expect(classifyPixel(hsv(0xb6, 0xb6, 0xb6), false, false)).toBe(PART_ID.steel);
    expect(classifyPixel(hsv(0x2c, 0x4a, 0x6a), false, false)).toBe(PART_ID.trousers);
    expect(classifyPixel(hsv(0x2f, 0x78, 0xc8), true, false)).toBe(PART_ID.eyes);
  });
  it('leaves the outline and unknown colours out of every part', () => {
    expect(classifyPixel(hsv(0x09, 0x09, 0x09), false, false)).toBe(0);
    expect(classifyPixel(hsv(0x20, 0x90, 0x30), false, false)).toBe(0);
  });
});

describe('buildPartMask', () => {
  it('uses position inside the figure, not the frame, so a figure standing low in its frame is split the same way', () => {
    // 1 frame, 4 px wide, 20 rows; figure occupies rows 5..14 (height 10): ochre in every row.
    const width = 4, height = 20;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 5; y <= 14; y++) for (let x = 0; x < width; x++) data.set([0x89, 0x63, 0x18, 255], (y * width + x) * 4);
    const mask = buildPartMask(data, width, [{ x: 0, y: 0, w: width, h: height }]);
    const rows = Array.from({ length: height }, (_, y) => mask[y * width]);
    expect(rows.slice(0, 5).every((v) => v === 0)).toBe(true); // empty rows stay unlabelled
    const headRows = Math.ceil(HOOD_SPLIT * 10); // rows whose y is above top + 0.41 * height
    expect(rows.slice(5, 5 + headRows).every((v) => v === PART_ID.hood)).toBe(true);
    expect(rows.slice(5 + headRows, 15).every((v) => v === PART_ID.tunic)).toBe(true);
    expect(BOOT_SPLIT).toBeGreaterThan(HOOD_SPLIT);
  });
  it('handles empty frames and keeps frames independent', () => {
    const width = 8, height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    data.set([0x89, 0x63, 0x18, 255], 5 * 4); // only in the right frame
    const mask = buildPartMask(data, width, [{ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 }]);
    expect([...mask].filter(Boolean).length).toBe(1);
  });
});
