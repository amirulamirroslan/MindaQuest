export type PerformanceTier = 'full' | 'lite';

/** How much purely decorative animation the world spawns. Gameplay and art direction are identical. */
export interface PerformanceProfile {
  tier: PerformanceTier;
  /** Twinkling glints on the river. */
  glints: number;
  /** Expanding ripple rings on the river. */
  ripples: number;
  /** Drifting light streaks on the river. */
  streaks: number;
  /** World units between foam dashes along the banks (larger = fewer). */
  foamStep: number;
  fireflies: number;
  /** Leaves drifting through the view. */
  leaves: number;
  /** Butterflies around the flower patches. */
  butterflies: number;
  /** Glowing fireflies that gather around the hero after dark. */
  nightFireflies: number;
  /** Seconds between fish leaps [min, max], and between bird flocks [min, max]. */
  fishGap: readonly [number, number];
  birdGap: readonly [number, number];
}

const FULL: PerformanceProfile = { tier: 'full', glints: 60, ripples: 22, streaks: 14, foamStep: 26, fireflies: 18, leaves: 16, butterflies: 9, nightFireflies: 16, fishGap: [3.5, 8], birdGap: [14, 28] };
const LITE: PerformanceProfile = { tier: 'lite', glints: 28, ripples: 8, streaks: 6, foamStep: 52, fireflies: 9, leaves: 5, butterflies: 3, nightFireflies: 6, fishGap: [6, 13], birdGap: [24, 45] };

export function parseTierOverride(search: string): PerformanceTier | null {
  const value = new URLSearchParams(search).get('perf');
  return value === 'full' || value === 'lite' ? value : null;
}

/** Touch devices (phones and tablets) get the lighter decorative load unless `?perf=` says otherwise. */
export function performanceTierFor(options: { touch: boolean; override?: PerformanceTier | null }): PerformanceTier {
  return options.override ?? (options.touch ? 'lite' : 'full');
}

export function profileFor(tier: PerformanceTier): PerformanceProfile {
  return tier === 'lite' ? LITE : FULL;
}
