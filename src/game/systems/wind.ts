/**
 * One shared wind for everything that moves: grass and tree sway, drifting leaves and the wind sound.
 * Gusts roll across the map as waves (nearby plants lean together, distant ones do not), which reads as
 * wind rather than as every plant wobbling on its own.
 */

/** Lean direction and strength at a screen-space x, in [-1, 1]. `timeMs` is scene time. */
export function windAt(timeMs: number, x: number): number {
  const t = timeMs / 1000;
  return 0.6 * Math.sin(t * 1.1 - x * 0.004) + 0.4 * Math.sin(t * 2.7 - x * 0.011 + 1.3);
}

/** How strong the breeze is right now, in [0, 1]. Slow: a gust builds and fades over several seconds. */
export function gustLevel(timeMs: number): number {
  const t = timeMs / 1000;
  return 0.5 + 0.5 * Math.sin(t * 0.31) * (0.6 + 0.4 * Math.sin(t * 0.093 + 1));
}
