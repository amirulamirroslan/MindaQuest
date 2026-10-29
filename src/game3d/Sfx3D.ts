import { GameAudio, type AmbienceState } from '../game/audio/GameAudio';
import { midiToFreq } from '../game/systems/audioMath';
import { isOff } from '../game/systems/features';

export type SfxName =
  | 'swing' | 'hit' | 'hurt' | 'petal' | 'poof' | 'dodge' | 'spin' | 'talk' | 'levelup' | 'fanfare' | 'telegraph' | 'faint'
  /** Rune Stone: a petal tapped while counting, a right answer, a gentle wrong answer, and the stone waking up. */
  | 'tap' | 'right' | 'wrong' | 'wake'
  /** The boss: a deep roar, and a footfall (step 0..2 = far..near). */
  | 'roar' | 'stomp';
const STORAGE_KEY = 'mindaquest.sound'; // shared with the 2D game: 'off' mutes

/**
 * Tiny synthesised sound effects (Web Audio, no files) plus the music and ambience engine the 2D game already has (`GameAudio`),
 * on the same audio context: a slow generative tune, wind, birdsong by day, crickets and an owl at night.
 * Browsers start audio only after a tap or key press, so `unlock()` runs on the first one.
 */
export class Sfx3D {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Music and ambience (null until the first tap, or when the browser has no Web Audio). */
  private bed: GameAudio | null = null;
  private ducked = false;
  private lastTelegraph = 0;
  muted: boolean;
  constructor() {
    let off = false;
    try { off = localStorage.getItem(STORAGE_KEY) === 'off'; } catch { /* private mode */ }
    this.muted = off;
  }
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
        this.bed = new GameAudio(this.ctx, safeStorage());
        this.bed.setLite(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); // phones: fewer notes' worth of work
        this.bed.duck(this.ducked);
        if (!isOff('sound')) { this.bed.startMusic(); this.bed.startAmbience(); }
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* no audio: the game still works */ }
  }
  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(STORAGE_KEY, m ? 'off' : 'on'); } catch { /* ignore */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    this.bed?.setMuted(m);
  }
  /** Turns the music and ambience down while a menu or a riddle is open. */
  duck(on: boolean): void { if (on === this.ducked) return; this.ducked = on; this.bed?.duck(on); }
  /** Feeds the time of day and breeze to the ambience: birds by day, crickets and an owl at night, wind that follows the gusts. */
  setAmbience(a: AmbienceState): void { this.bed?.setAmbience(a); }
  /** The mix's current loudness 0..1, for automated checks. */
  level(): number { return this.bed?.level() ?? 0; }
  get musicRunning(): boolean { return this.bed !== null && !this.muted; }
  private lastStomp = 0;
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master || this.muted || isOff('sound')) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  play(n: SfxName, step = 0): void {
    switch (n) {
      case 'swing': this.tone(520 + step * 110, 0.12 + step * 0.03, 'triangle', 0.14, 0, 180 + step * 40); if (step === 2) this.tone(150, 0.2, 'sine', 0.12, 0.04, 70); break;
      case 'hit': this.tone(200 - step * 25, 0.12 + step * 0.04, 'square', 0.12 + step * 0.02, 0, 90); this.tone(640 + step * 80, 0.08, 'triangle', 0.1); if (step === 2) this.tone(110, 0.25, 'sine', 0.16); break;
      case 'hurt': this.tone(300, 0.25, 'sawtooth', 0.12, 0, 90); break;
      case 'petal': this.tone(midiToFreq(76 + step * 2), 0.35, 'sine', 0.2); this.tone(midiToFreq(83 + step * 2), 0.3, 'sine', 0.1, 0.07); break;
      case 'poof': this.tone(420, 0.3, 'sine', 0.16, 0, 120); this.tone(630, 0.2, 'triangle', 0.08, 0.05, 200); break;
      case 'dodge': this.tone(260, 0.18, 'sine', 0.1, 0, 520); this.tone(180, 0.22, 'sawtooth', 0.03, 0, 760); break;
      case 'spin': this.tone(300, 0.55, 'triangle', 0.14, 0, 900); this.tone(450, 0.55, 'sine', 0.08, 0.1, 1200); this.tone(220, 0.4, 'sawtooth', 0.04, 0.05, 1000); break;
      case 'talk': this.tone(midiToFreq(69 + (step % 4)), 0.06, 'square', 0.05); break;
      case 'levelup': [72, 76, 79, 84].forEach((m, i) => this.tone(midiToFreq(m), 0.4, 'triangle', 0.16, i * 0.1)); break;
      case 'fanfare': [67, 72, 76, 79, 84, 88].forEach((m, i) => this.tone(midiToFreq(m), 0.5, 'triangle', 0.15, i * 0.12)); break;
      case 'telegraph': { const now = performance.now(); if (now - this.lastTelegraph > 400) { this.lastTelegraph = now; this.tone(180, 0.25, 'sine', 0.1, 0, 260); } break; }
      case 'faint': this.tone(400, 0.6, 'sine', 0.12, 0, 120); break;
      case 'roar':
        this.tone(130, 1.1, 'sawtooth', 0.16, 0, 55); this.tone(96, 1.2, 'square', 0.09, 0.03, 40); this.tone(210, 0.7, 'sawtooth', 0.06, 0.05, 80);
        this.tone(60, 1.3, 'sine', 0.2, 0, 38); break;
      case 'stomp': { const now = performance.now(); if (now - this.lastStomp > 160) { this.lastStomp = now; this.tone(85, 0.22, 'sine', 0.07 + step * 0.05, 0, 38); if (step > 0) this.tone(150, 0.1, 'square', 0.03 * step, 0, 70); } break; }
      case 'tap': this.tone(midiToFreq(72 + Math.min(step, 14)), 0.18, 'sine', 0.13); break;
      case 'right': [72, 76, 79].forEach((m, i) => this.tone(midiToFreq(m), 0.32, 'triangle', 0.15, i * 0.08)); break;
      case 'wrong': this.tone(midiToFreq(57), 0.28, 'sine', 0.09, 0, midiToFreq(53)); break; // a soft, low "hmm": never a buzzer
      case 'wake':
        this.tone(95, 1.3, 'sine', 0.2, 0, 55);
        [60, 64, 67, 72, 76, 79].forEach((m, i) => this.tone(midiToFreq(m), 0.7, 'triangle', 0.12, 0.15 + i * 0.13));
        break;
    }
  }
}

function safeStorage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
