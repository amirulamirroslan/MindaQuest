import { describe, expect, it } from 'vitest';
import { computeLayout, type ViewportLayout } from './viewport';
import { interactiveBoxes, wardrobeSpecFor, type Box } from './wardrobeLayout';

const DEVICES: Array<[string, number, number, number, boolean]> = [
  ['iPhone SE', 375, 667, 2, true], ['iPhone 14', 390, 844, 3, true], ['iPhone 14 landscape', 844, 390, 3, true], ['Pixel 7', 412, 915, 2.625, true],
  ['Pixel 7 landscape', 915, 412, 2.625, true], ['small Android', 320, 568, 2, true], ['small Android landscape', 568, 320, 2, true],
  ['iPad portrait', 768, 1024, 2, true], ['iPad landscape', 1024, 768, 2, true], ['desktop 720p', 1280, 720, 1, false], ['desktop 1080p', 1920, 1080, 1, false],
];
const layoutOf = ([, w, h, dpr, touch]: (typeof DEVICES)[number]): ViewportLayout => computeLayout({ cssWidth: w, cssHeight: h, devicePixelRatio: dpr, touch });
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const within = (b: Box, w: number, h: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;

describe('wardrobeSpecFor', () => {
  it.each(DEVICES)('%s: the whole design fits the viewport at the chosen zoom', (...d) => {
    const l = layoutOf(d as (typeof DEVICES)[number]); const s = wardrobeSpecFor(l);
    expect(s.designW * s.zoom).toBeLessThanOrEqual(l.width + 0.5);
    expect(s.designH * s.zoom).toBeLessThanOrEqual(l.height + 0.5);
  });
  it('picks the tall layout in portrait and the wide one in landscape', () => {
    expect(wardrobeSpecFor(layoutOf(DEVICES[1])).mode).toBe('tall');
    expect(wardrobeSpecFor(layoutOf(DEVICES[2])).mode).toBe('wide');
    expect(wardrobeSpecFor(layoutOf(DEVICES[9])).mode).toBe('wide');
  });
  it.each(['tall', 'wide'] as const)('%s: every control sits inside the design and none overlap', (mode) => {
    const s = wardrobeSpecFor(layoutOf(mode === 'tall' ? DEVICES[1] : DEVICES[9]));
    const boxes = interactiveBoxes(s);
    for (const b of boxes) expect(within(b, s.designW, s.designH)).toBe(true);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    expect(s.tabs).toHaveLength(8);
    expect(s.swatches).toHaveLength(10);
  });
  it('keeps the hero inside the preview card', () => {
    for (const d of [DEVICES[1], DEVICES[9]]) {
      const s = wardrobeSpecFor(layoutOf(d));
      const half = 52 * s.heroScale; // the figure (backpack and sword included) is about 104 px wide in its 204 px frame
      expect(s.heroFoot.x - half).toBeGreaterThanOrEqual(s.preview.x);
      expect(s.heroFoot.x + half).toBeLessThanOrEqual(s.preview.x + s.preview.w);
      expect(s.heroFoot.y).toBeLessThanOrEqual(s.preview.y + s.preview.h);
      expect(s.heroFoot.y - 134 * s.heroScale).toBeGreaterThanOrEqual(s.preview.y + 40); // clear of the title
    }
  });
  it('keeps the hero clear of the walk button and the tabs inside the controls panel', () => {
    for (const d of [DEVICES[1], DEVICES[9]]) {
      const s = wardrobeSpecFor(layoutOf(d));
      const half = 52 * s.heroScale;
      const sharesColumn = s.heroFoot.x + half > s.walk.x && s.heroFoot.x - half < s.walk.x + s.walk.w;
      if (sharesColumn) expect(s.heroFoot.y).toBeLessThanOrEqual(s.walk.y - 8);
      for (const t of s.tabs) {
        expect(t.x).toBeGreaterThanOrEqual(s.controls.x + 6);
        expect(t.x + t.w).toBeLessThanOrEqual(s.controls.x + s.controls.w - 6);
      }
    }
  });
  it.each(DEVICES.filter((d) => d[4] && Math.min(d[1], d[2]) >= 375))('%s: swatches are finger-sized (>= 44 CSS px) and tabs/buttons >= 36', (...d) => {
    const l = layoutOf(d as (typeof DEVICES)[number]); const s = wardrobeSpecFor(l);
    const css = (units: number) => (units * s.zoom) / l.renderScale;
    for (const b of s.swatches) expect(css(Math.min(b.w, b.h))).toBeGreaterThanOrEqual(44);
    for (const b of [...s.tabs, s.buttons.reset, s.buttons.random, s.buttons.done, s.walk]) expect(css(b.h)).toBeGreaterThanOrEqual(36);
  });
});
