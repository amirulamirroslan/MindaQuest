/**
 * Day-night cycle: a slow, gentle colour grade for the whole world. Pure maths (no Phaser), so it is unit-tested.
 * `phase` runs 0..1 around one full day: 0 is bright morning (no tint at all, so the game opens exactly as before),
 * then golden hour, dusk, a soft blue night that stays readable for children, and a pink dawn.
 */
export const DAY_CYCLE_SECONDS = 300;

export type TimeOfDayName = 'day' | 'golden' | 'dusk' | 'night' | 'dawn';

export interface TimeOfDay {
  /** Multiply tint as 0xRRGGBB. 0xffffff leaves the world untouched. */
  tint: number;
  /** 1 in full daylight, 0 at night. Drives sun shafts, birds, butterflies. */
  daylight: number;
  /** 1 - daylight, shaped so it only really arrives after dusk. Drives fireflies, lantern glow, crickets. */
  night: number;
  name: TimeOfDayName;
  phase: number;
}

interface Key { at: number; rgb: readonly [number, number, number]; daylight: number }

const KEYS: readonly Key[] = [
  { at: 0.0, rgb: [255, 255, 255], daylight: 1 },
  { at: 0.4, rgb: [255, 255, 255], daylight: 1 },
  { at: 0.5, rgb: [255, 226, 178], daylight: 0.85 },
  { at: 0.58, rgb: [228, 162, 176], daylight: 0.5 },
  { at: 0.66, rgb: [128, 124, 184], daylight: 0.18 },
  { at: 0.74, rgb: [104, 120, 184], daylight: 0 },
  { at: 0.88, rgb: [104, 120, 184], daylight: 0 },
  { at: 0.94, rgb: [232, 172, 190], daylight: 0.4 },
  { at: 0.98, rgb: [255, 232, 200], daylight: 0.8 },
  { at: 1.0, rgb: [255, 255, 255], daylight: 1 },
];

/** Darkest channel any key may use: night is moonlit and readable, never black. */
export const MIN_TINT_CHANNEL = 96;

export const wrapPhase = (phase: number) => ((phase % 1) + 1) % 1;
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function timeOfDayAt(rawPhase: number): TimeOfDay {
  const phase = wrapPhase(rawPhase);
  let i = 0;
  while (i < KEYS.length - 2 && phase >= KEYS[i + 1].at) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (phase - a.at) / (b.at - a.at))));
  const [r, g, bl] = [0, 1, 2].map((c) => Math.round(lerp(a.rgb[c], b.rgb[c], t)));
  const daylight = lerp(a.daylight, b.daylight, t);
  const name: TimeOfDayName = phase < 0.45 ? 'day' : phase < 0.55 ? 'golden' : phase < 0.68 ? 'dusk' : phase < 0.9 ? 'night' : 'dawn';
  return { tint: (r << 16) | (g << 8) | bl, daylight, night: smooth(Math.min(1, Math.max(0, (0.75 - daylight) / 0.75))), name, phase };
}

const NAMED_PHASES: Record<string, number> = { day: 0.2, morning: 0.05, golden: 0.5, sunset: 0.54, dusk: 0.6, night: 0.8, dawn: 0.94 };

/**
 * Developer switch `?tod=night` (or `?tod=0.8`): starts at that time of day and freezes the clock, which makes
 * screenshots repeatable. Returns null when the parameter is absent or unreadable.
 */
export function parseTimeOfDay(search: string): number | null {
  const raw = new URLSearchParams(search).get('tod');
  if (raw === null) return null;
  const named = NAMED_PHASES[raw.toLowerCase()];
  if (named !== undefined) return named;
  const value = Number(raw);
  return raw.trim() !== '' && Number.isFinite(value) ? wrapPhase(value) : null;
}
