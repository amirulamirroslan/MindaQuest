import { BAR_SECONDS, BEAT_SECONDS, chirpsPerMinute, cricketLevel, midiToFreq, pickupMidi, planMusicBar, type MusicNote } from '../systems/audioMath';
import { isOff } from '../systems/features';
import type { Surface } from '../systems/footsteps';

/**
 * Every sound in MindaQuest is synthesised here with the Web Audio API: no audio files, no samples, no licences
 * to track, nothing to download. Music is a slow generative tune (see `planMusicBar`), the ambience is filtered
 * noise and a few oscillators, and each effect is a few tiny envelopes.
 *
 * The engine works on any `BaseAudioContext`, so the same code can be rendered offline for automated checks.
 * With no context at all (no Web Audio, e.g. an old browser) every method quietly does nothing.
 */

export interface AudioStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface AmbienceState {
  /** 0.1..1: how close the river is. */
  river: number;
  /** 0..1 darkness and 0..1 daylight from the day-night cycle. */
  night: number;
  daylight: number;
  /** 0..1 breeze strength. */
  gust: number;
}

export type DialogueSound = 'open' | 'next' | 'close';

const STORAGE_KEY = 'mindaquest.sound';
const MASTER = 0.9, MUSIC = 0.5, AMBIENCE = 0.7, EFFECTS = 0.9;

export class GameAudio {
  readonly ctx: BaseAudioContext | null;
  /** Taps the final mix; used by automated checks to prove sound is really playing. */
  analyser: AnalyserNode | null = null;
  private readonly live: boolean;
  private muted = false;
  /** Phones: fewer oscillators and nodes per note and per step, so the audio never competes with drawing. */
  private lite = false;
  private ducked = false;
  private night = 0;
  private master!: GainNode;
  private music!: GainNode;
  private ambience!: GainNode;
  private sfx!: GainNode;
  private echo!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private musicTimer: number | undefined;
  private nextBarAt = 0;
  private bar = 0;
  private bed: { gate: GainNode; wind: GainNode; windFilter: BiquadFilterNode; river: GainNode; crickets: GainNode; stop: () => void } | null = null;
  private birdTimer: number | undefined;
  private owlTimer: number | undefined;
  private state: AmbienceState = { river: 0.1, night: 0, daylight: 1, gust: 0.3 };

  constructor(ctx: BaseAudioContext | null, private readonly storage: AudioStorage | null = null) {
    this.ctx = ctx;
    this.live = !!ctx && !(typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext);
    if (!ctx) return;
    this.muted = readStored(storage) === 'off';

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16; compressor.knee.value = 24; compressor.ratio.value = 5;
    compressor.attack.value = 0.004; compressor.release.value = 0.25;
    this.master.connect(compressor);
    compressor.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    compressor.connect(this.analyser);

    this.music = this.bus(MUSIC);
    this.ambience = this.bus(AMBIENCE);
    this.sfx = this.bus(EFFECTS);

    // A dotted-eighth echo that gives the plucked notes their dreamy tail.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = BEAT_SECONDS * 0.75;
    const feedback = ctx.createGain(); feedback.gain.value = 0.33;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    this.echo = ctx.createGain(); this.echo.gain.value = 0.35;
    this.echo.connect(delay); delay.connect(tone); tone.connect(feedback); feedback.connect(delay); tone.connect(this.music);

    const length = Math.floor(ctx.sampleRate * 2);
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    // Browsers only start audio after a tap or key press. this wakes our context on the first one.
    if (this.live && typeof document !== 'undefined') {
      const wake = () => this.resume();
      for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, wake, { passive: true, capture: true });
    }
  }

  get available() { return this.ctx !== null; }
  setLite(lite: boolean) { this.lite = lite; }
  get isMuted() { return this.muted; }

  resume() {
    const context = this.ctx as AudioContext | null;
    if (context && this.live && context.state === 'suspended') void context.resume().catch(() => undefined);
  }

  /** Mutes or unmutes everything and remembers the choice on this device. */
  setMuted(muted: boolean) {
    this.muted = muted;
    try { this.storage?.setItem(STORAGE_KEY, muted ? 'off' : 'on'); } catch { /* private mode: the choice just will not persist */ }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MASTER, this.ctx.currentTime, 0.04);
  }
  toggleMuted() { this.setMuted(!this.muted); return this.muted; }

  /** Turns the music and ambience down while a menu is open. */
  duck(on: boolean) {
    this.ducked = on;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(MUSIC * (on ? 0.25 : 1), now, 0.15);
    this.ambience.gain.setTargetAtTime(AMBIENCE * (on ? 0.3 : 1), now, 0.15);
  }
  get isDucked() { return this.ducked; }

  /** Current loudness of the final mix, 0..1 (root mean square). */
  level(): number {
    if (!this.analyser) return 0;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
  }

  // ------------------------------------------------------------------ music

  startMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.live || this.musicTimer !== undefined || isOff('music')) return;
    this.nextBarAt = ctx.currentTime + 0.4;
    this.musicTimer = window.setInterval(() => this.pumpMusic(), 250);
    this.pumpMusic();
  }

  stopMusic() {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  private pumpMusic() {
    const ctx = this.ctx!;
    // After a long pause the next bar can be in the past; restart cleanly instead of stacking bars on top of each other.
    if (this.nextBarAt < ctx.currentTime) this.nextBarAt = ctx.currentTime + 0.1;
    while (this.nextBarAt < ctx.currentTime + 1.5) {
      this.scheduleBar(this.bar++, this.nextBarAt, this.night);
      this.nextBarAt += BAR_SECONDS;
    }
  }

  /** Schedules one bar of music to begin at context time `when`. Public so the music can be rendered offline. */
  scheduleBar(bar: number, when: number, night = this.night) {
    if (!this.ctx) return;
    for (const note of planMusicBar(bar, { night })) this.playNote(note, when + note.beat * BEAT_SECONDS, night);
  }

  private playNote(note: MusicNote, at: number, night: number) {
    const ctx = this.ctx!;
    const length = note.beats * BEAT_SECONDS;
    const freq = midiToFreq(note.midi);
    if (note.voice === 'pad') {
      // Two slightly detuned triangles through a soft low-pass: a warm, slow-breathing chord.
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1300 - 450 * night;
      const env = ctx.createGain();
      env.gain.value = 0.0001;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.034, at + 0.9);
      env.gain.setValueAtTime(0.034, at + length - 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, at + length + 1.1);
      filter.connect(env); env.connect(this.music);
      for (const detune of this.lite ? [0] : [-7, 7]) {
        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq; osc.detune.value = detune;
        osc.connect(filter); osc.start(at); osc.stop(at + length + 1.2);
      }
    } else if (note.voice === 'bass') {
      this.tone({ freq, at, attack: 0.06, decay: length * 0.9, gain: 0.1 * note.velocity, to: this.music });
    } else {
      // A music-box pluck: a fundamental, a quiet octave and a glassy upper partial, with a fast decay.
      const gain = 0.1 * note.velocity;
      if (this.lite) {
        // Phones: just the fundamental and a quiet octave, centred, no echo copies (a third of the nodes).
        this.tone({ freq, at, attack: 0.004, decay: 1.4, gain, to: this.music });
        this.tone({ freq: freq * 2, at, attack: 0.004, decay: 0.7, gain: gain * 0.28, to: this.music });
        return;
      }
      const pan = (Math.random() - 0.5) * 0.6;
      for (const [mult, level, decay] of [[1, 1, 1.5], [2, 0.28, 0.8], [4.01, 0.07, 0.35]] as const) {
        this.tone({ freq: freq * mult, at, attack: 0.004, decay, gain: gain * level, to: this.music, pan });
        this.tone({ freq: freq * mult, at, attack: 0.004, decay: decay * 0.8, gain: gain * level * 0.6, to: this.echo, pan });
      }
    }
  }

  // ------------------------------------------------------------------ ambience

  startAmbience() {
    const ctx = this.ctx;
    if (!ctx || this.bed || isOff('ambience')) return;
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, ctx.currentTime);
    gate.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    gate.connect(this.ambience);
    const sources: Array<AudioScheduledSourceNode> = [];
    const noise = () => {
      const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = true;
      source.start(0, Math.random() * 1.5); sources.push(source); return source;
    };
    const lfo = (rate: number, depth: number, target: AudioParam, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = rate;
      const amount = ctx.createGain(); amount.gain.value = depth;
      osc.connect(amount); amount.connect(target); osc.start(); sources.push(osc);
    };

    // Wind: low rushing noise whose pitch and loudness follow the gusts.
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 450; windFilter.Q.value = 0.4;
    const wind = ctx.createGain(); wind.gain.value = 0.02;
    noise().connect(windFilter); windFilter.connect(wind); wind.connect(gate);
    lfo(0.09, 160, windFilter.frequency);

    // River: a soft hush with a slowly drifting babble.
    const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 320;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1100; band.Q.value = 0.55;
    const river = ctx.createGain(); river.gain.value = 0.05;
    noise().connect(high); high.connect(band); band.connect(river); river.connect(gate);
    lfo(0.27, 260, band.detune); lfo(0.61, 0.012, river.gain);

    // Crickets: two thin, fast-pulsing tones that only get any volume after dark.
    const crickets = ctx.createGain(); crickets.gain.value = 0;
    crickets.connect(gate);
    for (const [freq, rate] of [[4300, 13], [5050, 11]]) {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const env = ctx.createGain(); env.gain.value = 0.5;
      osc.connect(env); env.connect(crickets); osc.start(); sources.push(osc);
      lfo(rate, 0.5, env.gain, 'triangle');
    }

    this.bed = {
      gate, wind, windFilter, river, crickets,
      stop: () => {
        gate.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        const finish = () => { for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } } gate.disconnect(); };
        if (this.live) window.setTimeout(finish, 1500); else finish();
      },
    };
    this.setAmbience(this.state);
    if (this.live) { this.scheduleBirdsong(); this.scheduleOwl(); }
  }

  stopAmbience() {
    this.bed?.stop();
    this.bed = null;
    window.clearTimeout?.(this.birdTimer); window.clearTimeout?.(this.owlTimer);
    this.birdTimer = undefined; this.owlTimer = undefined;
  }

  setAmbience(state: AmbienceState) {
    this.state = state;
    this.night = state.night;
    const ctx = this.ctx;
    if (!ctx || !this.bed) return;
    const now = ctx.currentTime;
    this.bed.wind.gain.setTargetAtTime(0.012 + 0.05 * state.gust, now, 0.6);
    this.bed.windFilter.Q.setTargetAtTime(0.4 + 0.5 * state.gust, now, 0.6);
    this.bed.river.gain.setTargetAtTime(0.012 + 0.2 * state.river, now, 0.4);
    this.bed.crickets.gain.setTargetAtTime(cricketLevel(state.night) * 0.014, now, 1.2);
  }

  private scheduleBirdsong() {
    const rate = chirpsPerMinute(this.state.daylight);
    const wait = rate <= 0 ? 2500 : (60000 / rate) * (0.5 + Math.random());
    this.birdTimer = window.setTimeout(() => {
      if (this.bed && chirpsPerMinute(this.state.daylight) > 0) this.chirp(0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 1.4);
      if (this.bed) this.scheduleBirdsong();
    }, wait);
  }

  private scheduleOwl() {
    this.owlTimer = window.setTimeout(() => {
      if (this.bed && this.state.night > 0.7) this.hoot();
      if (this.bed) this.scheduleOwl();
    }, 16000 + Math.random() * 18000);
  }

  // ------------------------------------------------------------------ effects
  // Each takes an optional `at` (context time) so the same calls can be placed on a timeline offline.

  step(surface: Surface, at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005, r = Math.random();
    if (surface === 'grass') {
      this.noise({ at: t, dur: 0.08, gain: 0.14 + 0.04 * r, type: 'bandpass', freq: 2200 + 700 * r, q: 0.9, to: this.sfx });
      if (!this.lite) this.noise({ at: t, dur: 0.1, gain: 0.07, type: 'lowpass', freq: 900, to: this.sfx });
    } else if (surface === 'dirt') {
      this.noise({ at: t, dur: 0.065, gain: 0.15 + 0.03 * r, type: 'lowpass', freq: 1300 + 300 * r, to: this.sfx });
      this.tone({ freq: 150 + 20 * r, endFreq: 90, at: t, decay: 0.08, gain: 0.09, to: this.sfx });
    } else {
      this.tone({ freq: 200 + 25 * r, endFreq: 120, type: 'triangle', at: t, decay: 0.11, gain: 0.17, to: this.sfx });
      this.noise({ at: t, dur: 0.035, gain: 0.07, type: 'bandpass', freq: 1600, q: 1, to: this.sfx });
      this.tone({ freq: 400 + 40 * r, at: t, decay: 0.05, gain: 0.03, to: this.sfx });
    }
  }

  /** A bright bell chime that rises one scale step per piece of timber; the twelfth ends in a fanfare. */
  pickup(count: number, at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    const root = midiToFreq(pickupMidi(count));
    [[0, 0.17], [7, 0.12], [12, 0.1]].forEach(([semitones, gain], i) => {
      const freq = root * Math.pow(2, semitones / 12), when = t + i * 0.07;
      this.tone({ freq, at: when, attack: 0.004, decay: 0.55, gain, to: this.sfx });
      this.tone({ freq: freq * 2, at: when, attack: 0.004, decay: 0.3, gain: gain * 0.3, type: 'triangle', to: this.sfx });
    });
    this.noise({ at: t + 0.02, dur: 0.2, gain: 0.03, type: 'highpass', freq: 5200, to: this.sfx });
    if (count >= 12) this.fanfare(t + 0.32);
  }

  /** A plank dropping onto the bridge: a hollow wooden knock. */
  plank(at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    this.tone({ freq: 215, endFreq: 130, type: 'triangle', at: t, decay: 0.15, gain: 0.17, to: this.sfx });
    this.tone({ freq: 105, at: t + 0.005, decay: 0.22, gain: 0.1, to: this.sfx });
    this.noise({ at: t, dur: 0.05, gain: 0.07, type: 'bandpass', freq: 900, q: 0.8, to: this.sfx });
  }

  /** Water splash: a burst of filtered noise plus a couple of bubbly plops. `volume` 0..1. */
  splash(volume = 1, size: 'small' | 'big' = 'small', at?: number) {
    const ctx = this.ctx; if (!ctx || volume <= 0.01) return;
    const t = at ?? ctx.currentTime + 0.005, big = size === 'big';
    this.noise({ at: t, dur: big ? 0.42 : 0.22, gain: (big ? 0.2 : 0.12) * volume, type: 'lowpass', freq: 3600, endFreq: 800, q: 0.5, attack: 0.012, to: this.sfx });
    this.noise({ at: t, dur: 0.12, gain: 0.05 * volume, type: 'highpass', freq: 4500, to: this.sfx });
    const plops = big ? 3 : 1;
    for (let i = 0; i < plops; i++) {
      const base = 260 + Math.random() * 120;
      this.tone({ freq: base, endFreq: base * 2.3, at: t + 0.03 + i * 0.07, decay: 0.1, gain: 0.07 * volume, to: this.sfx });
    }
  }

  /** The little "bloop" of a fish leaving the water. */
  fishLeap(volume = 1, at?: number) {
    const ctx = this.ctx; if (!ctx || volume <= 0.01) return;
    const t = at ?? ctx.currentTime + 0.005;
    this.tone({ freq: 420, endFreq: 900, at: t, decay: 0.09, gain: 0.1 * volume, to: this.sfx });
    this.splash(volume * 0.8, 'small', t);
  }

  /** Bridge repaired: a rising bell arpeggio and a held, shimmering chord. */
  fanfare(at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    [72, 76, 79, 84, 88].forEach((midi, i) => {
      const freq = midiToFreq(midi), when = t + i * 0.09;
      this.tone({ freq, at: when, attack: 0.004, decay: 0.9, gain: 0.13, to: this.sfx });
      this.tone({ freq: freq * 2, at: when, attack: 0.004, decay: 0.4, gain: 0.04, type: 'triangle', to: this.sfx });
    });
    for (const midi of [84, 88, 91]) this.tone({ freq: midiToFreq(midi), at: t + 0.5, attack: 0.05, decay: 1.7, gain: 0.07, type: 'triangle', to: this.sfx });
    this.noise({ at: t + 0.4, dur: 0.5, gain: 0.025, type: 'highpass', freq: 6000, attack: 0.15, to: this.sfx });
  }

  /** Quest complete: a longer, warmer celebration than the fanfare. */
  reward(at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    [79, 84, 88, 91, 96].forEach((midi, i) => {
      const freq = midiToFreq(midi), when = t + i * 0.12;
      this.tone({ freq, at: when, attack: 0.004, decay: 1.0, gain: 0.08, to: this.sfx });
      this.tone({ freq: freq * 2, at: when, attack: 0.004, decay: 0.45, gain: 0.025, type: 'triangle', to: this.sfx });
    });
    for (const midi of [72, 79, 84, 88, 91]) this.tone({ freq: midiToFreq(midi), at: t + 0.62, attack: 0.08, decay: 2.4, gain: 0.04, type: 'triangle', to: this.sfx });
    this.noise({ at: t + 0.5, dur: 0.8, gain: 0.03, type: 'highpass', freq: 5500, attack: 0.2, to: this.sfx });
  }

  /** A soft tick for buttons. */
  click(at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    this.tone({ freq: 760, endFreq: 540, at: t, attack: 0.002, decay: 0.06, gain: 0.08, to: this.sfx });
  }

  /** Speech-box blips: two rising notes to open, one to turn the page, two falling notes to close. */
  dialogue(kind: DialogueSound, at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    const notes = kind === 'open' ? [523, 659] : kind === 'next' ? [587] : [659, 523];
    notes.forEach((freq, i) => {
      this.tone({ freq, at: t + i * 0.07, attack: 0.004, decay: 0.16, gain: kind === 'next' ? 0.06 : 0.08, to: this.sfx });
      this.tone({ freq: freq * 2, at: t + i * 0.07, attack: 0.004, decay: 0.08, gain: 0.015, type: 'triangle', to: this.sfx });
    });
  }

  /** A short songbird phrase: two to four quick, bright notes. `pan` -1..1. */
  chirp(volume = 1, pan = 0, at?: number) {
    const ctx = this.ctx; if (!ctx || volume <= 0.01) return;
    const t = at ?? ctx.currentTime + 0.005;
    const base = 2300 + Math.random() * 1500, notes = 2 + Math.floor(Math.random() * 3);
    let when = t;
    for (let i = 0; i < notes; i++) {
      const up = Math.random() < 0.6, length = 0.05 + Math.random() * 0.05;
      const from = base * (0.85 + Math.random() * 0.3);
      this.tone({ freq: from, endFreq: from * (up ? 1.3 : 0.75), at: when, attack: 0.008, decay: length, gain: 0.055 * volume, to: this.ambience, pan });
      when += length + 0.04 + Math.random() * 0.05;
    }
  }

  /** A far-off, gentle owl: two low hoots. */
  hoot(at?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = at ?? ctx.currentTime + 0.005;
    this.tone({ freq: 392, endFreq: 370, at: t, attack: 0.08, decay: 0.45, gain: 0.04, to: this.ambience });
    this.tone({ freq: 349, endFreq: 320, at: t + 0.6, attack: 0.08, decay: 0.6, gain: 0.035, to: this.ambience });
  }

  // ------------------------------------------------------------------ building blocks

  private bus(level: number) {
    const gain = this.ctx!.createGain();
    gain.gain.value = level;
    gain.connect(this.master);
    return gain;
  }

  private route(node: AudioNode, to: AudioNode, pan?: number) {
    const ctx = this.ctx!;
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner); panner.connect(to);
    } else node.connect(to);
  }

  /** One oscillator with an attack-decay envelope (and an optional pitch glide). */
  private tone(o: { freq: number; endFreq?: number; type?: OscillatorType; at: number; attack?: number; decay: number; gain: number; to: AudioNode; pan?: number }) {
    const ctx = this.ctx!, attack = o.attack ?? 0.005;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, o.at);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, o.at + attack + o.decay);
    const env = ctx.createGain();
    // A GainNode starts at 1: without this the very first sample of a burst can play at full level before the envelope applies (a click).
    env.gain.value = 0.0001;
    env.gain.setValueAtTime(0.0001, o.at);
    env.gain.exponentialRampToValueAtTime(Math.max(o.gain, 0.0002), o.at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, o.at + attack + o.decay);
    osc.connect(env);
    this.route(env, o.to, o.pan);
    osc.start(o.at);
    osc.stop(o.at + attack + o.decay + 0.05);
  }

  /** A burst of filtered noise with an attack-decay envelope (and an optional filter sweep). */
  private noise(o: { at: number; dur: number; gain: number; type: BiquadFilterType; freq: number; endFreq?: number; q?: number; attack?: number; to: AudioNode; pan?: number }) {
    const ctx = this.ctx!, attack = o.attack ?? 0.004;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type; filter.Q.value = o.q ?? 0.8;
    filter.frequency.setValueAtTime(o.freq, o.at);
    if (o.endFreq) filter.frequency.exponentialRampToValueAtTime(o.endFreq, o.at + o.dur);
    const env = ctx.createGain();
    // A GainNode starts at 1: without this the very first sample of a burst can play at full level before the envelope applies (a click).
    env.gain.value = 0.0001;
    env.gain.setValueAtTime(0.0001, o.at);
    env.gain.exponentialRampToValueAtTime(Math.max(o.gain, 0.0002), o.at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
    source.connect(filter); filter.connect(env);
    this.route(env, o.to, o.pan);
    source.start(o.at, Math.random() * 1.4);
    source.stop(o.at + o.dur + 0.05);
  }
}

function readStored(storage: AudioStorage | null): string | null {
  try { return storage?.getItem(STORAGE_KEY) ?? null; } catch { return null; }
}

/** localStorage when the browser allows it (it can throw in private mode); otherwise null and the choice is per-session. */
export function safeStorage(): AudioStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
