import { describe, expect, it } from 'vitest';
import {
  BAR_SECONDS, BEATS_PER_BAR, chirpsPerMinute, CHORDS, cricketLevel, distanceToRiver, earshot, isBreathBar, MELODY_POOL, midiToFreq, pickupMidi, planMusicBar, riverVolume,
} from './audioMath';
import { riverCenterX, RIVER_HALF_WIDTH } from './worldGeometry';

describe('pitch', () => {
  it('maps MIDI notes to frequencies (A4 = 440 Hz, an octave doubles)', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });
  it('climbs one scale step with every piece of timber, 1 through 12', () => {
    const notes = Array.from({ length: 12 }, (_, i) => pickupMidi(i + 1));
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
    expect(notes[0]).toBe(72);
    expect(pickupMidi(0)).toBe(pickupMidi(1));
    expect(pickupMidi(99)).toBe(pickupMidi(12));
  });
});

describe('ambience mix', () => {
  it('measures distance to the river from either bank and is zero in the water', () => {
    expect(distanceToRiver(riverCenterX(400), 400)).toBe(0);
    expect(distanceToRiver(riverCenterX(400) + RIVER_HALF_WIDTH + 100, 400)).toBeCloseTo(100);
    expect(distanceToRiver(riverCenterX(400) - RIVER_HALF_WIDTH - 250, 400)).toBeCloseTo(250);
  });
  it('river gets quieter with distance but never vanishes entirely', () => {
    let last = Infinity;
    for (let d = 0; d <= 900; d += 30) { const v = riverVolume(d); expect(v).toBeLessThanOrEqual(last); expect(v).toBeGreaterThanOrEqual(0.1); last = v; }
    expect(riverVolume(0)).toBe(1);
    expect(riverVolume(5000)).toBe(0.1);
  });
  it('one-off sounds fade out of earshot', () => {
    expect(earshot(0)).toBe(1);
    expect(earshot(5000)).toBe(0);
    expect(earshot(400)).toBeGreaterThan(0);
    expect(earshot(400)).toBeLessThan(1);
  });
  it('birds sing by day and stay quiet at night; crickets are the other way round', () => {
    expect(chirpsPerMinute(0)).toBe(0);
    expect(chirpsPerMinute(0.1)).toBe(0);
    expect(chirpsPerMinute(1)).toBeGreaterThan(chirpsPerMinute(0.5));
    expect(cricketLevel(0)).toBe(0);
    expect(cricketLevel(1)).toBe(1);
  });
});

describe('generative music', () => {
  const POOL = new Set<number>(MELODY_POOL);
  it('is deterministic: the same bar always plays the same notes', () => {
    expect(planMusicBar(5, { seed: 42 })).toEqual(planMusicBar(5, { seed: 42 }));
    expect(planMusicBar(5, { seed: 42 })).not.toEqual(planMusicBar(6, { seed: 42 }));
  });
  it('plays the chord for its bar: pad on the chord tones, bass on the root', () => {
    for (let bar = 0; bar < 8; bar++) {
      const chord = CHORDS[bar % CHORDS.length];
      const notes = planMusicBar(bar);
      expect(notes.filter((n) => n.voice === 'pad').map((n) => n.midi).sort()).toEqual([...chord.tones].sort());
      expect(notes.some((n) => n.voice === 'bass' && n.midi === chord.root)).toBe(true);
    }
  });
  it('keeps every melody note in the C major pentatonic scale, which cannot clash with the chords', () => {
    for (let bar = 0; bar < 200; bar++) for (const n of planMusicBar(bar, { night: bar % 2 })) if (n.voice === 'pluck') expect(POOL.has(n.midi)).toBe(true);
  });
  it('keeps every note inside the bar and gives each a positive length and a sane loudness', () => {
    for (let bar = 0; bar < 100; bar++) for (const n of planMusicBar(bar)) {
      expect(n.beat).toBeGreaterThanOrEqual(0); expect(n.beat).toBeLessThan(BEATS_PER_BAR);
      expect(n.beats).toBeGreaterThan(0); expect(n.velocity).toBeGreaterThan(0); expect(n.velocity).toBeLessThanOrEqual(1);
    }
  });
  it('rests the melody every eighth bar', () => {
    for (let bar = 0; bar < 64; bar++) if (isBreathBar(bar)) expect(planMusicBar(bar).some((n) => n.voice === 'pluck')).toBe(false);
    expect(isBreathBar(7)).toBe(true);
    expect(isBreathBar(8)).toBe(false);
  });
  it('plays a sparser melody at night than by day, and still has some melody overall', () => {
    const count = (night: number) => Array.from({ length: 160 }, (_, bar) => planMusicBar(bar, { night }).filter((n) => n.voice === 'pluck').length).reduce((a, b) => a + b, 0);
    expect(count(1)).toBeLessThan(count(0));
    expect(count(1)).toBeGreaterThan(40);
  });
  it('is slow and gentle: a bar lasts over three seconds', () => {
    expect(BAR_SECONDS).toBeGreaterThan(3);
  });
});
