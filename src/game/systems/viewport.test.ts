import { describe, expect, it } from 'vitest';
import {
  computeLayout, fitScale, MAX_RENDER_SCALE, NO_INSETS, renderScaleFor, sameLayout, sanitizeSize,
  textResolutionFor, uiScaleCssFor, worldZoomFor,
} from './viewport';

const PHONES: Array<[string, number, number, number]> = [
  ['iPhone SE', 375, 667, 2], ['iPhone 14', 390, 844, 3], ['iPhone 15 Pro Max', 430, 932, 3],
  ['Pixel 7', 412, 915, 2.625], ['Galaxy S8', 360, 740, 4], ['small Android', 320, 568, 2],
];

describe('sanitizeSize / renderScaleFor', () => {
  it('falls back for invalid sizes', () => {
    expect(sanitizeSize(0, 0)).toEqual({ width: 960, height: 600 });
    expect(sanitizeSize(Number.NaN, 400)).toEqual({ width: 960, height: 600 });
    expect(sanitizeSize(390, 844)).toEqual({ width: 390, height: 844 });
  });
  it('uses the device pixel ratio but caps it for speed', () => {
    expect(renderScaleFor(1)).toBe(1);
    expect(renderScaleFor(1.25)).toBe(1.25);
    expect(renderScaleFor(3)).toBe(MAX_RENDER_SCALE);
    expect(renderScaleFor(undefined)).toBe(1);
    expect(renderScaleFor(0.5)).toBe(1);
    expect(renderScaleFor(Number.NaN)).toBe(1);
  });
  it('honours a developer override', () => {
    expect(renderScaleFor(3, 1)).toBe(1);
    expect(renderScaleFor(1, 1.5)).toBe(1.5);
    expect(renderScaleFor(2, -3)).toBe(2);
  });
});

describe('worldZoomFor', () => {
  it('keeps the original desktop framing: ~600 world px tall on a 720p+ window', () => {
    expect(720 / worldZoomFor(1280, 720)).toBeCloseTo(600, -1);
    expect(1080 / worldZoomFor(1920, 1080)).toBeCloseTo(600, -1);
  });
  it('shows about 340 world px across a phone short side, in both orientations', () => {
    for (const [, w, h] of PHONES) {
      for (const [cw, ch] of [[w, h], [h, w]] as const) {
        const span = Math.min(cw, ch) / worldZoomFor(cw, ch);
        expect(span).toBeGreaterThan(300);
        expect(span).toBeLessThan(420);
      }
    }
  });
  it('gives the hero a readable size on phones (46 world px tall -> at least 42 CSS px)', () => {
    for (const [, w, h] of PHONES) expect(46 * worldZoomFor(w, h)).toBeGreaterThan(42);
  });
  it('is identical for a rotated device, so rotating never changes the scale', () => {
    expect(worldZoomFor(390, 844)).toBe(worldZoomFor(844, 390));
  });
  it('keeps the hero a similar physical size from phones to 720p windows, then grows on bigger screens', () => {
    for (let short = 360; short <= 720; short += 30) {
      const hero = 46 * worldZoomFor(short * 1.8, short);
      expect(hero).toBeGreaterThan(46);
      expect(hero).toBeLessThan(64);
    }
    let previous = 0;
    for (let short = 720; short <= 1600; short += 40) {
      const zoom = worldZoomFor(short * 1.8, short);
      expect(zoom).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = zoom;
    }
    expect(worldZoomFor(100, 100)).toBeGreaterThanOrEqual(0.8);
  });
  it('keeps the visible slice of the 1600x800 world inside it for tall phones', () => {
    for (const [, w, h] of PHONES) expect(h / worldZoomFor(w, h)).toBeLessThanOrEqual(800);
  });
});

describe('uiScaleCssFor / textResolutionFor', () => {
  it('keeps phones at 1x so text is 10-14 CSS px, and caps large screens', () => {
    expect(uiScaleCssFor(390, 844)).toBe(1);
    expect(uiScaleCssFor(844, 390)).toBe(1);
    expect(uiScaleCssFor(1920, 1080)).toBe(1.8);
    expect(uiScaleCssFor(5000, 4000)).toBe(1.8);
  });
  it('rasterises text at least 2x and at most 4x', () => {
    expect(textResolutionFor(1)).toBe(2);
    expect(textResolutionFor(2.4)).toBe(3);
    expect(textResolutionFor(9)).toBe(4);
  });
});

describe('computeLayout', () => {
  it('fills the whole viewport: the canvas always matches the window, in render px', () => {
    for (const [, w, h, dpr] of PHONES) {
      for (const [cw, ch] of [[w, h], [h, w]] as const) {
        const layout = computeLayout({ cssWidth: cw, cssHeight: ch, devicePixelRatio: dpr, touch: true });
        expect(layout.width).toBe(Math.round(cw * layout.renderScale));
        expect(layout.height).toBe(Math.round(ch * layout.renderScale));
        expect(Number.isInteger(layout.width) && Number.isInteger(layout.height)).toBe(true);
        expect(layout.compact).toBe(true);
      }
    }
  });
  it('reports orientation and form factor', () => {
    expect(computeLayout({ cssWidth: 390, cssHeight: 844 }).orientation).toBe('portrait');
    expect(computeLayout({ cssWidth: 844, cssHeight: 390 }).orientation).toBe('landscape');
    expect(computeLayout({ cssWidth: 600, cssHeight: 600 }).orientation).toBe('landscape');
    expect(computeLayout({ cssWidth: 1280, cssHeight: 720 }).compact).toBe(false);
    expect(computeLayout({ cssWidth: 768, cssHeight: 1024 }).compact).toBe(false);
  });
  it('multiplies zoom and UI scale by the render scale so the canvas stays crisp', () => {
    const layout = computeLayout({ cssWidth: 390, cssHeight: 844, devicePixelRatio: 3 });
    expect(layout.renderScale).toBe(2);
    expect(layout.worldZoom).toBeCloseTo(worldZoomFor(390, 844) * 2);
    expect(layout.uiScale).toBe(2);
  });
  it('converts safe-area insets from CSS px to render px', () => {
    const layout = computeLayout({ cssWidth: 844, cssHeight: 390, devicePixelRatio: 2, insets: { top: 0, right: 47, bottom: 21, left: 47 } });
    expect(layout.safe).toEqual({ top: 0, right: 94, bottom: 42, left: 94 });
    expect(computeLayout({ cssWidth: 844, cssHeight: 390, insets: { top: -4, right: 0, bottom: 0, left: 0 } }).safe.top).toBe(0);
  });
  it('survives nonsense input', () => {
    const layout = computeLayout({ cssWidth: 0, cssHeight: Number.NaN });
    expect(layout.width).toBe(960); expect(layout.height).toBe(600);
    expect(computeLayout({ cssWidth: 100, cssHeight: 100, insets: NO_INSETS }).safe).toEqual(NO_INSETS);
  });
  it('detects meaningful change only', () => {
    const a = computeLayout({ cssWidth: 390, cssHeight: 844, devicePixelRatio: 3, touch: true });
    expect(sameLayout(a, computeLayout({ cssWidth: 390, cssHeight: 844, devicePixelRatio: 3, touch: true }))).toBe(true);
    expect(sameLayout(a, computeLayout({ cssWidth: 844, cssHeight: 390, devicePixelRatio: 3, touch: true }))).toBe(false);
    expect(sameLayout(undefined, a)).toBe(false);
  });
});

describe('fitScale', () => {
  it('fits content inside the available area without exceeding the cap', () => {
    expect(fitScale(100, 100, 200, 400)).toBe(2);
    expect(fitScale(100, 100, 200, 400, 1.5)).toBe(1.5);
    expect(fitScale(400, 100, 200, 400)).toBe(0.5);
    expect(fitScale(0, 0, 200, 400)).toBe(1);
  });
});
