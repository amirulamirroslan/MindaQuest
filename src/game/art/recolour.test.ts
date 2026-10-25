import { describe, expect, it } from 'vitest';
import { recolourOchreToTeal } from './recolour';

const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];

describe('recolourOchreToTeal', () => {
  it('turns the ochre tunic ramp teal and keeps lightness order', () => {
    const data = new Uint8ClampedArray([...px(0x89, 0x63, 0x18), ...px(0x81, 0x5f, 0x1b), ...px(0x47, 0x2e, 0x06)]);
    recolourOchreToTeal(data);
    for (let i = 0; i < 12; i += 4) expect(data[i + 1] > data[i] && data[i + 2] > data[i]).toBe(true); // g and b exceed r: teal family
    expect(Math.max(data[0], data[1], data[2])).toBeGreaterThan(Math.max(data[8], data[9], data[10])); // lit stays lighter than shade
  });
  it('leaves skin, outline, steel, boots and transparent pixels alone', () => {
    const keep = [px(0xdf, 0xbd, 0x9d), px(0x09, 0x09, 0x09), px(0xb6, 0xb6, 0xb6), px(0x52, 0x2d, 0x1c), px(0x33, 0x13, 0x0b), px(0x89, 0x63, 0x18, 0)];
    const data = new Uint8ClampedArray(keep.flat());
    recolourOchreToTeal(data);
    expect([...data]).toEqual(keep.flat());
  });
});
