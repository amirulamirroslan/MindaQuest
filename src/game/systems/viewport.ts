/**
 * Pure responsive-layout maths. The browser glue lives in `../responsive.ts`; everything here is testable.
 *
 * Terminology:
 *  - CSS px: what the browser lays out (window.innerWidth).
 *  - render px: the canvas backing store, `renderScale` x CSS px. All Phaser coordinates are render px.
 *  - world px: the unscaled isometric scene. `worldZoom` render px show one world px.
 *  - HUD unit: the design unit of the HUD. `uiScale` render px make one unit.
 */
export interface Insets { top: number; right: number; bottom: number; left: number }
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio?: number;
  /** Safe-area insets in CSS px (notch, rounded corners, home indicator). */
  insets?: Insets;
  touch?: boolean;
  /** Developer override for the render scale (`?res=`). */
  renderScaleOverride?: number | null;
}

export interface ViewportLayout {
  cssWidth: number;
  cssHeight: number;
  /** Canvas pixels per CSS pixel. */
  renderScale: number;
  /** Canvas size in render px. */
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  /** Phone-sized: the short side is under 500 CSS px. */
  compact: boolean;
  touch: boolean;
  /** Render px per world px for the main camera. */
  worldZoom: number;
  /** Render px per HUD unit. */
  uiScale: number;
  /** Safe-area insets in render px. */
  safe: Insets;
}

export const FALLBACK_SIZE = { width: 960, height: 600 } as const;
export const MAX_RENDER_SCALE = 2;
export const COMPACT_SHORT_SIDE = 500;
/** World px shown across the short side of a phone. Desktop keeps the original 600 px of framing. */
export const PHONE_WORLD_SPAN = 340;
export const DESKTOP_WORLD_SPAN = 600;
const PHONE_SHORT_SIDE = 430;
const DESKTOP_SHORT_SIDE = 720;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const snap = (value: number, step: number) => Math.round(value / step) * step;

export function sanitizeSize(width: number, height: number): { width: number; height: number } {
  const valid = Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1;
  return valid ? { width, height } : { ...FALLBACK_SIZE };
}

/** Canvas pixels per CSS pixel: the device pixel ratio, capped so very dense phones stay fast. */
export function renderScaleFor(devicePixelRatio: number | undefined, override?: number | null, cap = MAX_RENDER_SCALE): number {
  const wanted = override != null && Number.isFinite(override) && override > 0 ? override : devicePixelRatio;
  if (wanted == null || !Number.isFinite(wanted) || wanted < 1) return 1;
  return Math.min(cap, Math.round(wanted * 100) / 100);
}

/**
 * CSS px per world px. A phone shows about 340 world px across its short side so the hero stays large and
 * readable; the span widens smoothly to the original 600 px on desktop-sized windows, so desktop framing
 * is unchanged. Snapped to 0.05 so a drifting browser toolbar does not keep nudging the zoom.
 */
export function worldZoomFor(cssWidth: number, cssHeight: number): number {
  const { width, height } = sanitizeSize(cssWidth, cssHeight);
  const short = Math.min(width, height);
  const t = clamp((short - PHONE_SHORT_SIDE) / (DESKTOP_SHORT_SIDE - PHONE_SHORT_SIDE), 0, 1);
  const span = PHONE_WORLD_SPAN + (DESKTOP_WORLD_SPAN - PHONE_WORLD_SPAN) * t;
  return clamp(snap(short / span, 0.05), 0.8, 4);
}

/** CSS px per HUD unit: 1 on phones (text stays 10-14 px), growing with the window up to 1.8. */
export function uiScaleCssFor(cssWidth: number, cssHeight: number): number {
  const { width, height } = sanitizeSize(cssWidth, cssHeight);
  return clamp(snap(Math.min(width, height) / 600, 0.05), 1, 1.8);
}

export function computeLayout(input: ViewportInput): ViewportLayout {
  const { width: cssWidth, height: cssHeight } = sanitizeSize(input.cssWidth, input.cssHeight);
  const renderScale = renderScaleFor(input.devicePixelRatio, input.renderScaleOverride);
  const insets = input.insets ?? NO_INSETS;
  const scaleInset = (value: number) => Math.max(0, Math.round(value * renderScale));
  return {
    cssWidth,
    cssHeight,
    renderScale,
    width: Math.max(1, Math.round(cssWidth * renderScale)),
    height: Math.max(1, Math.round(cssHeight * renderScale)),
    orientation: cssWidth >= cssHeight ? 'landscape' : 'portrait',
    compact: Math.min(cssWidth, cssHeight) < COMPACT_SHORT_SIDE,
    touch: Boolean(input.touch),
    worldZoom: worldZoomFor(cssWidth, cssHeight) * renderScale,
    uiScale: uiScaleCssFor(cssWidth, cssHeight) * renderScale,
    safe: { top: scaleInset(insets.top), right: scaleInset(insets.right), bottom: scaleInset(insets.bottom), left: scaleInset(insets.left) },
  };
}

export function sameLayout(a: ViewportLayout | undefined, b: ViewportLayout): boolean {
  return Boolean(a) && a!.width === b.width && a!.height === b.height && a!.renderScale === b.renderScale
    && a!.worldZoom === b.worldZoom && a!.uiScale === b.uiScale && a!.touch === b.touch
    && a!.safe.top === b.safe.top && a!.safe.right === b.safe.right && a!.safe.bottom === b.safe.bottom && a!.safe.left === b.safe.left;
}

/** Text is rasterised at this resolution so it stays sharp at the HUD's scale. */
export function textResolutionFor(uiScale: number): number {
  return clamp(Math.ceil(uiScale), 2, 4);
}

/** Largest scale (up to `maxScale`) at which a content box still fits inside the available area. */
export function fitScale(contentWidth: number, contentHeight: number, availableWidth: number, availableHeight: number, maxScale = Infinity): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  return Math.max(0.1, Math.min(maxScale, availableWidth / contentWidth, availableHeight / contentHeight));
}
