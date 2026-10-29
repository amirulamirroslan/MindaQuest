/**
 * The shore's two sums (v2.29, pure and deterministic for a given seed). Both reuse the existing add / subtract riddle engine, so hints,
 * the free answer after two slips, the learning profile and the explanations all work unchanged; only the story around the numbers differs.
 *   - Harbour-master Mak Long: money and change. Ringgit only, whole numbers, never more than 20, so the child never needs decimals.
 *   - The lighthouse keeper: the clock. Whole hours on a 12-hour face, never past 12, so a sum of hours is also a time.
 */
import { makeSum, type SumRiddle } from './runePuzzle';
import { mulberry32 } from './layout3d';
import type { Tier } from './woodsQuest';

type Rnd = () => number;

/** "You sold sea-glass for RM{a}, and a rope costs RM{b}": change is `subtract`; "RM{a} for the glass and RM{b} for the shells": the total is `add`. */
export function makeMoneySum(kind: 'add' | 'subtract', tier: Tier, rnd: Rnd): SumRiddle { return makeSum(kind, tier, rnd); }

/**
 * Hours on a clock. `subtract`: the lamp is lit at {a} o'clock and it is {b} o'clock now, how many hours to wait? `add`: the bell rang at {a}
 * o'clock and rings again {b} hours later, what o'clock is it then? Every number stays on the 12-hour face: the sums are capped at the middle
 * tier's range (totals up to 10), however well the child is doing with ordinary sums.
 */
export const makeClockSum = (kind: 'add' | 'subtract', tier: Tier, rnd: Rnd): SumRiddle => makeSum(kind, (tier === 3 ? 2 : tier) as Tier, rnd);

/** A clock sum from a seed: the same seed gives the same sum. */
export const clockSumFor = (kind: 'add' | 'subtract', tier: Tier, seed: number): SumRiddle => makeClockSum(kind, tier, mulberry32(seed >>> 0));
