/**
 * Pure layout of the wardrobe screen, in a fixed "design space" (top-left origin) that the camera zooms to fit,
 * the same approach as the title screen. Everything here is unit-tested for fit, overlap and finger-sized targets.
 */
import type { ViewportLayout } from './viewport';

export interface Box { x: number; y: number; w: number; h: number }

export type WardrobeMode = 'tall' | 'wide';

export interface WardrobeSpec {
  mode: WardrobeMode;
  designW: number;
  designH: number;
  /** Camera zoom that fits the design into the viewport (render px per design px). */
  zoom: number;
  preview: Box;
  title: { x: number; y: number; size: number };
  /** Where the hero's feet stand, and the scale the 204 px frame is drawn at. */
  heroFoot: { x: number; y: number };
  heroScale: number;
  turnLeft: Box;
  turnRight: Box;
  walk: Box;
  controls: Box;
  tabs: Box[];
  label: { x: number; y: number; size: number };
  swatches: Box[];
  buttons: { reset: Box; random: Box; done: Box };
}

const TAB_COLS = 4;
const SWATCH_COLS = 5;
const SWATCH_COUNT = 10;

function grid(count: number, cols: number, x: number, y: number, w: number, h: number, gapX: number, gapY: number): Box[] {
  return Array.from({ length: count }, (_, i) => ({ x: x + (i % cols) * (w + gapX), y: y + Math.floor(i / cols) * (h + gapY), w, h }));
}

export function wardrobeSpecFor(layout: ViewportLayout, partCount = 8): WardrobeSpec {
  const fit = (designW: number, designH: number) => Math.max(0.1, Math.min(layout.width / designW, layout.height / designH));
  if (layout.orientation === 'portrait') {
    const designW = 440, designH = 700;
    const tabs = grid(partCount, TAB_COLS, 28, 316, 93, 46, 4, 6);
    return {
      mode: 'tall', designW, designH, zoom: fit(designW, designH),
      preview: { x: 20, y: 58, w: 400, h: 240 },
      title: { x: 220, y: 32, size: 22 },
      heroFoot: { x: 220, y: 280 }, heroScale: 1.25,
      turnLeft: { x: 32, y: 150, w: 48, h: 56 }, turnRight: { x: 360, y: 150, w: 48, h: 56 },
      walk: { x: 304, y: 242, w: 104, h: 44 },
      controls: { x: 20, y: 308, w: 400, h: 296 },
      tabs,
      label: { x: 220, y: 428, size: 15 },
      swatches: grid(SWATCH_COUNT, SWATCH_COLS, 40, 448, 64, 64, 10, 10),
      buttons: { reset: { x: 20, y: 628, w: 120, h: 52 }, random: { x: 150, y: 628, w: 120, h: 52 }, done: { x: 280, y: 628, w: 140, h: 52 } },
    };
  }
  const designW = 780, designH = 400;
  const tabs = grid(partCount, TAB_COLS, 308, 20, 104, 46, 8, 6);
  return {
    mode: 'wide', designW, designH, zoom: fit(designW, designH),
    preview: { x: 20, y: 20, w: 266, h: 360 },
    title: { x: 153, y: 46, size: 22 },
    heroFoot: { x: 153, y: 298 }, heroScale: 1.45,
    turnLeft: { x: 30, y: 180, w: 48, h: 56 }, turnRight: { x: 228, y: 180, w: 48, h: 56 },
    walk: { x: 101, y: 320, w: 104, h: 44 },
    controls: { x: 296, y: 12, w: 464, h: 376 },
    tabs,
    label: { x: 528, y: 138, size: 15 },
    swatches: grid(SWATCH_COUNT, SWATCH_COLS, 346, 156, 64, 64, 14, 14),
    buttons: { reset: { x: 316, y: 320, w: 120, h: 52 }, random: { x: 446, y: 320, w: 120, h: 52 }, done: { x: 596, y: 320, w: 140, h: 52 } },
  };
}

export const interactiveBoxes = (spec: WardrobeSpec): Box[] => [
  spec.turnLeft, spec.turnRight, spec.walk, ...spec.tabs, ...spec.swatches, spec.buttons.reset, spec.buttons.random, spec.buttons.done,
];
