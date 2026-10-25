import { describe, expect, it } from 'vitest';
import { computeLayout, type ViewportLayout } from './viewport';
import { circleRect, followOffsetY, hudMetrics, menuSpecFor, playerAnchorY, rectsOverlap, touchMetrics, type Rect } from './uiLayout';

const DEVICES: Array<[string, number, number, number, boolean, { top: number; right: number; bottom: number; left: number }?]> = [
  ['iPhone SE', 375, 667, 2, true], ['iPhone 14', 390, 844, 3, true, { top: 47, right: 0, bottom: 34, left: 0 }],
  ['iPhone 14 landscape', 844, 390, 3, true, { top: 0, right: 47, bottom: 21, left: 47 }], ['Pixel 7', 412, 915, 2.625, true],
  ['Pixel 7 landscape', 915, 412, 2.625, true], ['small Android', 320, 568, 2, true], ['small Android landscape', 568, 320, 2, true],
  ['iPad portrait', 768, 1024, 2, true], ['iPad landscape', 1024, 768, 2, true], ['desktop 720p', 1280, 720, 1, false], ['desktop 1080p', 1920, 1080, 1, false],
];
const layoutOf = ([, w, h, dpr, touch, insets]: (typeof DEVICES)[number]): ViewportLayout =>
  computeLayout({ cssWidth: w, cssHeight: h, devicePixelRatio: dpr, touch, insets });
const inside = (r: Rect, l: ViewportLayout) => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= l.width + 0.5 && r.y + r.h <= l.height + 0.5;

describe('hudMetrics', () => {
  it.each(DEVICES)('%s: panel and pause button fit on screen, inside the safe area, without overlapping', (...device) => {
    const l = layoutOf(device as (typeof DEVICES)[number]);
    const hud = hudMetrics(l);
    expect(inside(hud.panel, l)).toBe(true);
    expect(inside(circleRect(hud.pause), l)).toBe(true);
    expect(rectsOverlap(hud.panel, circleRect(hud.pause))).toBe(false);
    expect(hud.panel.x).toBeGreaterThanOrEqual(l.safe.left);
    expect(hud.panel.y).toBeGreaterThanOrEqual(l.safe.top);
    expect(hud.pause.cx + hud.pause.r).toBeLessThanOrEqual(l.width - l.safe.right + 0.5);
  });
  it.each(DEVICES)('%s: pause tap target is at least 44 CSS px on touch devices', (...device) => {
    const d = device as (typeof DEVICES)[number];
    const l = layoutOf(d);
    if (d[4]) expect((hudMetrics(l).pause.r * 2) / l.renderScale).toBeGreaterThanOrEqual(44);
  });
  it('keeps HUD text legible on phones (>= 11 CSS px) and desktop-sized as before', () => {
    const phone = hudMetrics(layoutOf(DEVICES[1]));
    expect(Math.min(...Object.values(phone.fonts))).toBeGreaterThanOrEqual(11);
    expect(hudMetrics(layoutOf(DEVICES[9])).fonts.objective).toBe(13);
  });
  it('shrinks the panel on narrow screens but never below a usable width', () => {
    const narrow = layoutOf(DEVICES[5]);
    const hud = hudMetrics(narrow);
    expect(hud.panelUnits).toBeGreaterThanOrEqual(190);
    expect(hud.panelUnits).toBeLessThanOrEqual(262 + 28);
  });
});

describe('touchMetrics', () => {
  const touchDevices = DEVICES.filter((d) => d[4]);
  it.each(touchDevices)('%s: stick and USE button are on screen, in the safe area and apart', (...device) => {
    const l = layoutOf(device as (typeof DEVICES)[number]);
    const t = touchMetrics(l);
    expect(inside(circleRect(t.stick), l)).toBe(true);
    expect(inside(circleRect(t.action), l)).toBe(true);
    expect(t.stick.cx - t.stick.r).toBeGreaterThanOrEqual(l.safe.left);
    expect(t.action.cx + t.action.r).toBeLessThanOrEqual(l.width - l.safe.right + 0.5);
    expect(t.stick.cy + t.stick.r).toBeLessThanOrEqual(l.height - l.safe.bottom + 0.5);
    expect(rectsOverlap(circleRect(t.stick), circleRect(t.action))).toBe(false);
  });
  it.each(touchDevices)('%s: both controls are comfortable touch targets (>= 44 CSS px)', (...device) => {
    const l = layoutOf(device as (typeof DEVICES)[number]);
    const t = touchMetrics(l);
    expect((t.action.r * 2) / l.renderScale).toBeGreaterThanOrEqual(44);
    expect((t.stick.r * 2) / l.renderScale).toBeGreaterThanOrEqual(44);
    expect(t.stickZone.w).toBeGreaterThan(t.stick.r * 2);
  });
  it.each(touchDevices)('%s: controls and HUD never cover the hero or each other', (...device) => {
    const l = layoutOf(device as (typeof DEVICES)[number]);
    const t = touchMetrics(l), hud = hudMetrics(l);
    // The hero is ~46 world px tall and ~30 wide; give it a generous box around its resting point.
    const heroW = 40 * l.worldZoom, heroH = 56 * l.worldZoom;
    const hero: Rect = { x: l.width / 2 - heroW / 2, y: playerAnchorY(l) * l.height - heroH / 2, w: heroW, h: heroH };
    for (const rect of [hud.panel, circleRect(hud.pause), circleRect(t.stick), circleRect(t.action)]) expect(rectsOverlap(rect, hero)).toBe(false);
    expect(rectsOverlap(hud.panel, circleRect(t.stick))).toBe(false);
    expect(rectsOverlap(hud.panel, circleRect(t.action))).toBe(false);
  });
});

describe('player framing', () => {
  it('keeps the hero centred on desktop and lifts it slightly on touch layouts', () => {
    expect(playerAnchorY(layoutOf(DEVICES[9]))).toBe(0.5);
    const phone = playerAnchorY(layoutOf(DEVICES[1]));
    expect(phone).toBeLessThanOrEqual(0.5);
    expect(phone).toBeGreaterThanOrEqual(0.4);
  });
  it('turns the anchor into a camera offset of the right sign', () => {
    expect(followOffsetY(layoutOf(DEVICES[9]))).toBe(0);
    expect(followOffsetY(layoutOf(DEVICES[1]))).toBeLessThanOrEqual(0);
  });
});

describe('menuSpecFor', () => {
  it.each(DEVICES)('%s: the title card fits inside the viewport at the chosen zoom', (...device) => {
    const l = layoutOf(device as (typeof DEVICES)[number]);
    const m = menuSpecFor(l);
    expect(m.cardW * m.zoom).toBeLessThanOrEqual(l.width + 0.5);
    expect(m.cardH * m.zoom).toBeLessThanOrEqual(l.height + 0.5);
    expect(m.designW).toBeGreaterThanOrEqual(m.cardW);
    expect(m.designH).toBeGreaterThanOrEqual(m.cardH);
  });
  it('picks a layout that suits the orientation', () => {
    expect(menuSpecFor(layoutOf(DEVICES[1])).mode).toBe('portrait');
    expect(menuSpecFor(layoutOf(DEVICES[2])).mode).toBe('landscape-compact');
    expect(menuSpecFor(layoutOf(DEVICES[9])).mode).toBe('standard');
  });
  it('keeps the smallest menu text readable on phones (>= 9 CSS px)', () => {
    for (const d of DEVICES.filter((x) => x[4] && x[1] < 500)) {
      const l = layoutOf(d); const m = menuSpecFor(l);
      expect((m.smallSize * m.zoom) / l.renderScale).toBeGreaterThanOrEqual(9);
    }
  });
});
