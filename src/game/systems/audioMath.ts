import { seededRandom } from './forestLayout';
import { RIVER_HALF_WIDTH, riverCenterX } from './worldGeometry';

/** Pure sound-design maths (pitches, volumes, the generative music plan). The Web Audio side lives in audio/GameAudio.ts. */

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const PICKUP_ROOT = 72; // C5

/** Each piece of timber rings one step higher up a major scale, so collecting 1..12 climbs a little tune. */
export function pickupMidi(count: number): number {
  const n = clamp(Math.round(count), 1, 12) - 1;
  return PICKUP_ROOT + MAJOR_SCALE[n % 7] + 12 * Math.floor(n / 7);
}

// ------------------------------------------------------------------ ambience

/** Distance from the hero to the nearest water, in world px (0 when standing in or on the river). */
export function distanceToRiver(x: number, y: number): number {
  return Math.max(0, Math.abs(x - riverCenterX(y)) - RIVER_HALF_WIDTH);
}

/** River loudness 0.1..1: full beside the water, a distant murmur deep in the forest, never silent. */
export function riverVolume(distance: number): number {
  const near = 40, far = 640;
  if (distance <= near) return 1;
  if (distance >= far) return 0.1;
  return 0.1 + 0.9 * (1 - (distance - near) / (far - near)) ** 2;
}

/** Volume for a one-off sound at `distance` from the hero: 1 when close, 0 when out of earshot. */
export function earshot(distance: number, near = 120, far = 720): number {
  if (distance <= near) return 1;
  if (distance >= far) return 0;
  return (1 - (distance - near) / (far - near)) ** 2;
}

/** Average birdsong chirps per minute for a given daylight: none at night, busiest in bright daylight. */
export function chirpsPerMinute(daylight: number): number {
  return daylight < 0.25 ? 0 : 5 + 11 * smooth(clamp((daylight - 0.25) / 0.75, 0, 1));
}

/** Cricket loudness 0..1: silent by day, full once it is properly dark. */
export function cricketLevel(night: number): number {
  return smooth(clamp((night - 0.35) / 0.55, 0, 1));
}

// ------------------------------------------------------------------ generative music

export const BPM = 76;
export const BEATS_PER_BAR = 4;
export const BEAT_SECONDS = 60 / BPM;
export const BAR_SECONDS = BEAT_SECONDS * BEATS_PER_BAR;

export interface Chord { name: string; root: number; tones: readonly number[] }
/** I - vi - IV - V in C major: the warm, familiar loop behind a thousand lullabies. */
export const CHORDS: readonly Chord[] = [
  { name: 'C', root: 48, tones: [60, 64, 67] },
  { name: 'Am', root: 45, tones: [57, 60, 64] },
  { name: 'F', root: 41, tones: [53, 57, 60] },
  { name: 'G', root: 43, tones: [55, 59, 62] },
];
/** C major pentatonic: every note sounds right over every chord above, so the melody can wander freely. */
export const MELODY_POOL = [72, 74, 76, 79, 81, 84, 86, 88] as const;

export type MusicVoice = 'pad' | 'bass' | 'pluck';
export interface MusicNote { beat: number; beats: number; midi: number; voice: MusicVoice; velocity: number }

/** Every eighth bar is a breath: pad and bass only. */
export const isBreathBar = (bar: number) => bar % 8 === 7;

/**
 * What to play in one bar. Deterministic for a given `bar`, `seed` and `night`, so it is testable; the tune is
 * different every bar yet never random-sounding. At night the melody thins out.
 */
export function planMusicBar(bar: number, options: { seed?: number; night?: number } = {}): MusicNote[] {
  const night = clamp(options.night ?? 0, 0, 1);
  const chord = CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length];
  const notes: MusicNote[] = chord.tones.map((midi) => ({ beat: 0, beats: BEATS_PER_BAR, midi, voice: 'pad', velocity: 1 }));
  notes.push({ beat: 0, beats: BEATS_PER_BAR, midi: chord.root, voice: 'bass', velocity: 1 });
  if (bar % 2 === 1) notes.push({ beat: 2, beats: 2, midi: chord.root + 7, voice: 'bass', velocity: 0.6 });
  if (isBreathBar(bar)) return notes;

  const rng = seededRandom((options.seed ?? 1207) + bar * 7919);
  let index = Math.floor(rng() * MELODY_POOL.length);
  let lastPlayed = -2;
  for (let slot = 0; slot < 8; slot++) {
    const chance = (slot === 0 ? 0.8 : 0.4) - 0.17 * night;
    if (rng() > chance || slot === lastPlayed + 1 && rng() < 0.35) continue;
    const step = [-2, -1, -1, 1, 1, 2][Math.floor(rng() * 6)];
    index = clamp(index + step, 0, MELODY_POOL.length - 1);
    notes.push({ beat: slot / 2, beats: 1.5, midi: MELODY_POOL[index], voice: 'pluck', velocity: 0.55 + 0.45 * rng() });
    lastPlayed = slot;
  }
  return notes.sort((a, b) => a.beat - b.beat);
}
