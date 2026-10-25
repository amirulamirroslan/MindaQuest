import type { ViewportLayout } from './viewport';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Circle { cx: number; cy: number; r: number }

export const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const circleRect = (c: Circle): Rect => ({ x: c.cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2 });

// ------------------------------------------------------------------ HUD

export const HUD_PANEL_HEIGHT = 62;
const HUD_PANEL_MAX = 262;
const HUD_PANEL_MAX_COMPACT = 290;
const HUD_PANEL_MIN = 190;

export interface HudMetrics {
  /** Render px per HUD unit. */
  scale: number;
  /** Panel width in HUD units (fits the room left of the pause button). */
  panelUnits: number;
  panel: Rect;
  pause: Circle;
  /** Font sizes in HUD units. */
  fonts: { header: number; objective: number; label: number; prompt: number };
  /** Top-centre anchor for toasts on touch layouts, in render px. */
  toastY: number;
}

/** HUD placement in render px, honouring safe areas. The pause button keeps a >= 44 CSS px tap target. */
export function hudMetrics(layout: ViewportLayout): HudMetrics {
  const s = layout.uiScale;
  const margin = 10 * s;
  const pauseR = (layout.compact || layout.touch ? 25 : 17) * s;
  const pause: Circle = { cx: layout.width - layout.safe.right - margin - pauseR, cy: layout.safe.top + margin + pauseR, r: pauseR };
  const x = layout.safe.left + margin, y = layout.safe.top + margin;
  const room = pause.cx - pauseR - 8 * s - x;
  const max = (layout.compact ? HUD_PANEL_MAX_COMPACT : HUD_PANEL_MAX) * s;
  const panelW = Math.max(HUD_PANEL_MIN * s, Math.min(max, room));
  return {
    scale: s,
    panelUnits: panelW / s,
    panel: { x, y, w: panelW, h: HUD_PANEL_HEIGHT * s },
    pause,
    fonts: layout.compact ? { header: 11, objective: 14, label: 11, prompt: 14 } : { header: 10, objective: 13, label: 10, prompt: 13 },
    toastY: y + HUD_PANEL_HEIGHT * s + 26 * s,
  };
}

// ------------------------------------------------------------------ touch controls

export interface TouchMetrics {
  scale: number;
  stick: Circle;
  /** Generous catch area around the stick, so the thumb does not have to land exactly on it. */
  stickZone: Rect;
  action: Circle;
}

export const STICK_UNITS = 46;
export const ACTION_UNITS = 36;

export function touchMetrics(layout: ViewportLayout): TouchMetrics {
  const s = layout.uiScale;
  // Landscape thumbs rest further in from rounded corners than portrait ones.
  const edge = (layout.orientation === 'landscape' ? 30 : 22) * s;
  const stickR = STICK_UNITS * s, actionR = ACTION_UNITS * s;
  const stick: Circle = { cx: layout.safe.left + edge + stickR, cy: layout.height - layout.safe.bottom - edge - stickR, r: stickR };
  const action: Circle = { cx: layout.width - layout.safe.right - edge - actionR, cy: layout.height - layout.safe.bottom - edge - actionR - 8 * s, r: actionR };
  const zone = stickR * 2.6;
  return { scale: s, stick, stickZone: { x: stick.cx - zone / 2, y: stick.cy - zone / 2, w: zone, h: zone }, action };
}

// ------------------------------------------------------------------ gameplay framing

/** Vertical screen fraction at which the hero rests so the HUD and thumb controls never cover them. */
export function playerAnchorY(layout: ViewportLayout): number {
  const hud = hudMetrics(layout);
  const top = hud.panel.y + hud.panel.h;
  const bottom = layout.touch ? touchMetrics(layout).stick.cy - touchMetrics(layout).stick.r : layout.height;
  const free = (top + bottom) / 2 / layout.height;
  // Never drift far from the centre: a small lift is enough, and desktop stays exactly centred.
  return layout.touch ? Math.min(0.5, Math.max(0.4, free)) : 0.5;
}

/** Camera follow offset (world px) that parks the hero at `playerAnchorY`. */
export function followOffsetY(layout: ViewportLayout): number {
  return (playerAnchorY(layout) - 0.5) * layout.height / layout.worldZoom;
}

// ------------------------------------------------------------------ main menu

export type MenuMode = 'standard' | 'portrait' | 'landscape-compact';

export interface MenuSpec {
  mode: MenuMode;
  cardW: number;
  cardH: number;
  /** Design-space size the menu is scaled to fit. */
  designW: number;
  designH: number;
  titleSize: number;
  subtitleSize: number;
  /** Size of the hint and tagline lines. */
  smallSize: number;
  buttonW: number;
  buttonH: number;
  /** y offsets from the card top, in design px. `null` = element omitted. */
  y: { title: number; subtitle: number; welcome: number | null; button: number; custom: number; hint: number; tagline: number | null };
  /** Size of the secondary "customise hero" button under the main one. */
  customW: number;
  customH: number;
  hero: boolean;
  /** Camera zoom that fits the design into the viewport (render px per design px). */
  zoom: number;
}

export function menuSpecFor(layout: ViewportLayout): MenuSpec {
  const fit = (designW: number, designH: number) => Math.max(0.1, Math.min(layout.width / designW, layout.height / designH));
  if (layout.orientation === 'landscape' && layout.cssHeight < 520) {
    return { mode: 'landscape-compact', cardW: 560, cardH: 276, designW: 600, designH: 316, titleSize: 44, subtitleSize: 17, smallSize: 13, buttonW: 260, buttonH: 52,
      y: { title: 52, subtitle: 100, welcome: null, button: 160, custom: 212, hint: 250, tagline: null }, customW: 220, customH: 38, hero: false, zoom: fit(600, 316) };
  }
  if (layout.orientation === 'portrait') {
    return { mode: 'portrait', cardW: 440, cardH: 452, designW: 480, designH: 580, titleSize: 48, subtitleSize: 18, smallSize: 14, buttonW: 270, buttonH: 56,
      y: { title: 74, subtitle: 128, welcome: 176, button: 252, custom: 310, hint: 358, tagline: 400 }, customW: 240, customH: 42, hero: true, zoom: fit(480, 580) };
  }
  return { mode: 'standard', cardW: 578, cardH: 433, designW: 640, designH: 600, titleSize: 58, subtitleSize: 21, smallSize: 13, buttonW: 280, buttonH: 56,
    y: { title: 76, subtitle: 138, welcome: 191, button: 273, custom: 332, hint: 376, tagline: 410 }, customW: 240, customH: 40, hero: true, zoom: fit(640, 600) };
}
