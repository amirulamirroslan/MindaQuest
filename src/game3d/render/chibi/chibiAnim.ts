/**
 * Drives the chibi hero's clips. As with the old rig, the GAME owns the timing of every action (`systems/combat.ts`), so attack,
 * special, dodge and faint clips are *scrubbed* by the action's progress: the blow lands on the game's hit frame whatever weapon
 * is held. Locomotion clips share one phase so walking and running blend without foot pops.
 */
import type { AnimationAction } from 'three';
import type { Loadout } from '../../cosmetics/loadout';
import type { HeroPose } from '../hero/heroAnim';
import { type ChibiRig } from './ChibiRig';
import { CLIP_DURATIONS, LOCO, attackWindow, idleClip, locomotionPlan, scrubTime, specialWindow, type ClipWindow } from './chibiClips';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
type Override = 'attack' | 'special' | 'dodge' | 'hurt' | 'faint' | 'jump' | 'cheer' | null;

export class ChibiAnimator {
  private readonly act = new Map<string, AnimationAction>();
  private phase = 0;
  private over: Override = null; private overWeight = 0; private overClip = ''; private overTime = 0;
  private hurtT = 0;
  private cheerLeft = 0; private cheerClock = 0;
  private loadout: Loadout | null = null;
  /** Seconds since combat last happened. */
  combatIdle = 99;

  constructor(private readonly rig: ChibiRig, private readonly timings: { attackHitN: number; specialBlastN: number }) {
    for (const name of Object.keys(CLIP_DURATIONS)) {
      const clip = rig.clips.get(name); if (!clip) continue;
      const a = rig.mixer.clipAction(clip); a.play(); a.paused = true; a.setEffectiveWeight(0); this.act.set(name, a);
    }
  }

  setLoadout(l: Loadout): void { this.loadout = l; }
  hit(): void { this.hurtT = 0.0001; }
  /** A short victory jig (the `Cheer` clip) when the hero is standing still: petal collected, level up, boss down. */
  cheer(seconds = 1.6): void { this.cheerLeft = seconds; this.cheerClock = 0; }
  private setW(name: string, w: number, time?: number): void {
    const a = this.act.get(name); if (!a) return;
    a.enabled = true; a.setEffectiveWeight(w); if (time !== undefined) a.time = time;
  }
  private dur(n: string): number { return this.act.get(n)?.getClip().duration ?? 1; }

  update(dt: number, p: HeroPose): void {
    const l = this.loadout;
    let next: Override = null; let clip = ''; let t = 0;
    if (p.faint > 0) { next = 'faint'; clip = 'Death_A'; t = clamp(p.faint, 0, 1) * 0.79; }
    else if (p.dodge !== null) { next = 'dodge'; clip = 'Dodge_Forward'; t = clamp(p.dodge, 0, 1) * 0.39; }
    else if (p.special !== null && l) { const w: ClipWindow = specialWindow(l); next = 'special'; clip = w.clip; t = scrubTime(w, p.special, this.timings.specialBlastN); }
    else if (p.attack !== null && l) { const w = attackWindow(l, p.combo ?? 0); next = 'attack'; clip = w.clip; t = scrubTime(w, p.attack, this.timings.attackHitN); }
    else if (p.jump !== null && p.jump !== undefined) {
      next = 'jump'; const j = p.jump;
      if (j < 0.14) { clip = 'Jump_Start'; t = (j / 0.14) * 0.5; } else if (j < 0.72) { clip = 'Jump_Idle'; t = 0.2 + (j - 0.14) * 0.9; } else { clip = 'Jump_Land'; t = ((j - 0.72) / 0.28) * 0.6; }
    }
    if (this.hurtT > 0) {
      this.hurtT += dt;
      if (this.hurtT > 0.4) this.hurtT = 0; else if (next === null || next === 'jump') { next = 'hurt'; clip = 'Hit_A'; t = Math.min(0.6, this.hurtT * 1.5); }
    }
    if (this.cheerLeft > 0) {
      this.cheerLeft -= dt; this.cheerClock += dt;
      if (next === null && p.speed < 1.2) { next = 'cheer'; clip = 'Cheer'; t = Math.min(this.cheerClock, this.dur('Cheer') - 1e-3); }
    }
    if (next === 'attack' || next === 'special' || next === 'dodge') this.combatIdle = 0; else this.combatIdle += dt;
    if (next) { this.over = next; this.overClip = clip; this.overTime = t; }
    const target = next ? 1 : 0, rate = next ? 18 : 9;
    this.overWeight += clamp(target - this.overWeight, -rate * dt, rate * dt);
    if (this.overWeight <= 0.001 && !next) this.over = null;
    const ow = smooth(this.overWeight), lw = 1 - ow;

    const plan = locomotionPlan(p.speed);
    const cyclesPerSec = plan.walk * plan.rateWalk / this.dur(LOCO.walk) + plan.run * plan.rateRun / this.dur(LOCO.run);
    this.phase = (this.phase + cyclesPerSec * dt) % 1;
    const idle = l ? idleClip(l) : 'Idle';
    for (const n of ['Idle', 'Unarmed_Idle', '2H_Melee_Idle']) this.setW(n, n === idle ? plan.idle * lw : 0, p.time % this.dur(n));
    this.setW(LOCO.walk, plan.walk * lw, this.phase * this.dur(LOCO.walk));
    this.setW(LOCO.run, plan.run * lw, this.phase * this.dur(LOCO.run));
    for (const n of Object.keys(CLIP_DURATIONS)) {
      if (n === 'Idle' || n === 'Unarmed_Idle' || n === '2H_Melee_Idle' || n === LOCO.walk || n === LOCO.run) continue;
      if (n === this.overClip && this.over) this.setW(n, ow, Math.min(this.overTime, this.dur(n) - 1e-3)); else this.setW(n, 0);
    }
    this.rig.mixer.update(0);
  }
  get activeOverride(): Override { return this.over; }
}
