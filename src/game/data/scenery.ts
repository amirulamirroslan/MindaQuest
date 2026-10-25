import type { LogFrame } from './frames';

/** Where the hero begins: the head of the explorer's trail, with the whole route visible below. */
export const PLAYER_START = { x: 426, y: 278 } as const;
/** Lina waits beside the trail, between the hero and the bridge. */
export const LINA_POS = { x: 660, y: 700 } as const;
/** Collected timber is stacked here, beside the bridge approach, so progress is visible in the world. */
export const TIMBER_PILE = { x: 748, y: 836 } as const;

export interface SceneryProp {
  id: string;
  frame: LogFrame;
  x: number;
  y: number;
  scale: number;
  /** Lie flat along the isometric axis (fallen logs). */
  flat?: boolean;
  flipX?: boolean;
  /** Small footprint that blocks walking, in world pixels. */
  blocker?: { w: number; h: number };
}

/**
 * Hand-placed props. Nothing here is random: the camp frames Lina, the posts mark the broken bridge,
 * and the lone stumps along the trail act as landmarks that lead the eye downhill to the river.
 */
export const SCENERY: readonly SceneryProp[] = [
  // Lina's camp, west of the trail: open meadow so the hero and Lina never overlap on screen
  { id: 'camp-stump', frame: 'stump-big', x: 585, y: 716, scale: 0.55, blocker: { w: 20, h: 10 } },
  { id: 'camp-seat', frame: 'stump-s2', x: 552, y: 676, scale: 0.7 },
  { id: 'camp-fork', frame: 'stump-fork', x: 604, y: 770, scale: 0.55, blocker: { w: 18, h: 10 } },
  // Start clearing
  { id: 'start-stump', frame: 'stump-s1', x: 350, y: 310, scale: 0.85 },
  { id: 'start-log', frame: 'log-branch', x: 560, y: 240, scale: 0.5, flat: true },
  // Broken bridge: posts at both banks (rope rails join them once the bridge is repaired)
  { id: 'bridge-post-nw', frame: 'log-post', x: 862, y: 752, scale: 0.62 },
  { id: 'bridge-post-sw', frame: 'log-post', x: 862, y: 868, scale: 0.62 },
  { id: 'bridge-post-ne', frame: 'log-post', x: 1092, y: 752, scale: 0.62 },
  { id: 'bridge-post-se', frame: 'log-post', x: 1092, y: 868, scale: 0.62 },
];

/** Signs: a trail marker at the start and the bridge sign (its text changes when the bridge is repaired). */
export const START_SIGN = { x: 470, y: 232, label: 'TRAIL' } as const;
export const BRIDGE_SIGN = { x: 1066, y: 772 } as const;

export function sceneryBlockers() {
  const props = SCENERY.filter((prop) => prop.blocker).map((prop) => ({ x: prop.x, y: prop.y - 4, w: prop.blocker!.w, h: prop.blocker!.h }));
  // Lina stands her ground: the hero can walk right up to her but never through or over her.
  return [{ x: LINA_POS.x, y: LINA_POS.y + 2, w: 16, h: 10 }, ...props];
}

/** Twelve timber pieces, spaced along the trail in four loose groups from the start clearing to the bridge. */
export const TIMBER_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [304, 183], [549, 370], [456, 393], [558, 458], [629, 560], [718, 572],
  [799, 772], [760, 672], [671, 869], [571, 828], [430, 805], [310, 760],
];

/** Open areas where random bushes and trees are never planted: the start, Lina's camp and every hand-placed prop. */
export const KEEP_CLEAR = [
  { x: PLAYER_START.x, y: PLAYER_START.y, r: 90 },
  { x: LINA_POS.x, y: LINA_POS.y, r: 110 },
  ...SCENERY.map((prop) => ({ x: prop.x, y: prop.y, r: 50 })),
  ...TIMBER_POSITIONS.map(([x, y]) => ({ x, y, r: 34 })),
  { x: TIMBER_PILE.x, y: TIMBER_PILE.y, r: 60 },
  { x: START_SIGN.x, y: START_SIGN.y, r: 40 },
  // Keep both bridge approaches open so the crossing is never hidden behind foliage.
  { x: 830, y: 810, r: 100 },
  { x: 1130, y: 810, r: 175 },
  { x: 980, y: 760, r: 90 },
  { x: 980, y: 880, r: 90 },
];
