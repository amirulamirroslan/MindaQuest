/**
 * Day-night look for the 3D woods (pure maths, unit-tested). It follows the same day as the 2D game (`timeOfDayAt` in
 * game/systems/dayNight.ts: bright morning, golden hour, dusk, a readable blue night, a pink dawn), but instead of one
 * multiply tint it describes real lights, fog and sky. Phase 0 is exactly the look the 3D game always had, so the game still
 * opens in plain daylight, and no phase is ever too dark to play in.
 */
import { DAY_CYCLE_SECONDS, timeOfDayAt, wrapPhase } from '../../game/systems/dayNight';

export { DAY_CYCLE_SECONDS, wrapPhase };

export interface SkyLook {
  /** Sky gradient stops from the top of the screen down: top, middle, low, bottom (0xRRGGBB). */
  sky: readonly [number, number, number, number];
  fog: number; fogNear: number; fogFar: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  sun: number; sunIntensity: number; sunPos: readonly [number, number, number];
  exposure: number;
}
interface Key { at: number; look: SkyLook }

const DAY: SkyLook = {
  sky: [0x5aa3da, 0xb4dcee, 0xf4f0cc, 0xe2ecc0], fog: 0xe3ebc6, fogNear: 32, fogFar: 92,
  hemiSky: 0xeef0ff, hemiGround: 0x5f8a45, hemiIntensity: 1.18, sun: 0xffdc98, sunIntensity: 2.15, sunPos: [-42, 38, 24], exposure: 1.1, // v2.13: cooler fill, warmer sun (painterly pair)
};
const GOLDEN: SkyLook = {
  sky: [0x4f7fc4, 0xf2c58a, 0xffdca8, 0xf3d6a4], fog: 0xf1d9b0, fogNear: 32, fogFar: 88,
  hemiSky: 0xf6e6ee, hemiGround: 0x5c6a3c, hemiIntensity: 1.12, sun: 0xffbe6e, sunIntensity: 1.9, sunPos: [-48, 26, 30], exposure: 1.05,
};
const SUNSET: SkyLook = {
  sky: [0x59589c, 0xe39ab4, 0xf3b4a2, 0xd99aa4], fog: 0xd9a9b2, fogNear: 28, fogFar: 84,
  hemiSky: 0xe0a8c4, hemiGround: 0x4a4860, hemiIntensity: 1.0, sun: 0xff9a84, sunIntensity: 1.3, sunPos: [-55, 12, 36], exposure: 1.05,
};
const DUSK: SkyLook = {
  sky: [0x2a3470, 0x5a5fa0, 0x9a78a8, 0x6a6a98], fog: 0x6c6e9e, fogNear: 24, fogFar: 78,
  hemiSky: 0x8c9ad8, hemiGround: 0x303a5c, hemiIntensity: 0.85, sun: 0x9aa0e0, sunIntensity: 0.75, sunPos: [-10, 38, 20], exposure: 1.05,
};
/** Night is a moonlit blue, bright enough to see the trail and the petals. */
const NIGHT: SkyLook = {
  sky: [0x0e1a44, 0x203468, 0x3a4f86, 0x2a3d6a], fog: 0x2a3b66, fogNear: 22, fogFar: 74,
  hemiSky: 0x86a0e0, hemiGround: 0x2e3c68, hemiIntensity: 0.95, sun: 0xb8c8ff, sunIntensity: 0.8, sunPos: [28, 50, -22], exposure: 1.05,
};
const DAWN: SkyLook = {
  sky: [0x6a76b8, 0xf0b4b8, 0xf8d0b0, 0xe0c0a8], fog: 0xe6c8b8, fogNear: 28, fogFar: 86,
  hemiSky: 0xffd6c8, hemiGround: 0x585a4a, hemiIntensity: 1.0, sun: 0xffb890, sunIntensity: 1.3, sunPos: [-45, 18, 28], exposure: 1.05,
};
const MORNING: SkyLook = {
  sky: [0x5a95d0, 0xd2dcdc, 0xf6ecc8, 0xe8e2b8], fog: 0xe6e4c0, fogNear: 32, fogFar: 90,
  hemiSky: 0xf0f0ff, hemiGround: 0x5a7e40, hemiIntensity: 1.16, sun: 0xffd694, sunIntensity: 1.95, sunPos: [-40, 36, 22], exposure: 1.08,
};

/** Same key times as the 2D cycle, so the sound (birds, crickets, owl) and the light always agree. */
const KEYS: readonly Key[] = [
  { at: 0.0, look: DAY }, { at: 0.4, look: DAY }, { at: 0.5, look: GOLDEN }, { at: 0.58, look: SUNSET }, { at: 0.66, look: DUSK },
  { at: 0.74, look: NIGHT }, { at: 0.88, look: NIGHT }, { at: 0.94, look: DAWN }, { at: 0.98, look: MORNING }, { at: 1.0, look: DAY },
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpHex(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const mixLook = (a: SkyLook, b: SkyLook, t: number): SkyLook => ({
  sky: [0, 1, 2, 3].map(i => lerpHex(a.sky[i], b.sky[i], t)) as unknown as SkyLook['sky'],
  fog: lerpHex(a.fog, b.fog, t), fogNear: lerp(a.fogNear, b.fogNear, t), fogFar: lerp(a.fogFar, b.fogFar, t),
  hemiSky: lerpHex(a.hemiSky, b.hemiSky, t), hemiGround: lerpHex(a.hemiGround, b.hemiGround, t), hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
  sun: lerpHex(a.sun, b.sun, t), sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
  sunPos: [lerp(a.sunPos[0], b.sunPos[0], t), lerp(a.sunPos[1], b.sunPos[1], t), lerp(a.sunPos[2], b.sunPos[2], t)],
  exposure: lerp(a.exposure, b.exposure, t),
});

/** Lights, fog and sky for a time of day (0..1 around one full day; 0 = bright morning). */
export function lookForPhase(rawPhase: number): SkyLook {
  const phase = wrapPhase(rawPhase);
  let i = 0;
  while (i < KEYS.length - 2 && phase >= KEYS[i + 1].at) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  return mixLook(a.look, b.look, smooth(Math.min(1, Math.max(0, (phase - a.at) / (b.at - a.at)))));
}

/** 0..1: how much the village lamps and house windows glow (they start to light up at golden hour). */
export function lampLevel(rawPhase: number): number {
  const { night, daylight } = timeOfDayAt(rawPhase);
  return Math.max(night, smooth(Math.min(1, Math.max(0, (0.9 - daylight) / 0.5))) * 0.6);
}
/** 0..1: how many fireflies are out. None by day, all of them once it is properly dark. */
export function fireflyLevel(rawPhase: number): number {
  return smooth(Math.min(1, Math.max(0, (timeOfDayAt(rawPhase).night - 0.3) / 0.5)));
}

/** Game clock to time of day. `startPhase` is where the day begins (0 = morning). */
export const phaseAt = (clockSeconds: number, startPhase = 0): number => wrapPhase(startPhase + clockSeconds / DAY_CYCLE_SECONDS);

/** Rough brightness of a look (0..~3), used to prove no moment of the day is too dark to play in. */
export const ambientStrength = (l: SkyLook): number => l.hemiIntensity + l.sunIntensity;
