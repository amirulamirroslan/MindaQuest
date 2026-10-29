/**
 * Animation plan for the hero (the pure maths is unit-tested). The game owns the timing of every action (`combat.ts`), so clips
 * are *scrubbed* by the action's progress instead of being played freely: the sword lands exactly on the logic's hit frame,
 * the roll covers exactly the dodge distance, and nothing can drift out of sync. Locomotion clips are speed-matched with a shared
 * phase so feet do not slide and blending between walk, jog and sprint does not pop.
 */
import { AnimationAction, type AnimationClip } from 'three';
import type { HeroRig } from './HeroRig';
import { HERO_SCALE } from './HeroRig';

/** Measured stance-foot speeds of the library's loops (m/s at native 1.78 m scale), scaled to the game hero. */
export const STRIDE = { walk: 0.95 * HERO_SCALE, jog: 5.3 * HERO_SCALE, sprint: 8.2 * HERO_SCALE } as const;
export const LOCO_CLIPS = { walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop' } as const;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface LocoPlan { idle: number; walk: number; jog: number; sprint: number; scaleWalk: number; scaleJog: number; scaleSprint: number }

/** Blend weights (sum to 1) and playback speeds for a ground speed in m/s. */
export function locomotionPlan(speed: number): LocoPlan {
  const moving = smooth((speed - 0.1) / 0.7);
  const jogShare = smooth((speed - 1.3) / 1.5);
  const sprintShare = smooth((speed - 4.4) / 1.2);
  return {
    idle: 1 - moving,
    walk: moving * (1 - jogShare),
    jog: moving * jogShare * (1 - sprintShare),
    sprint: moving * jogShare * sprintShare,
    scaleWalk: clamp(speed / STRIDE.walk, 0.7, 1.7),
    scaleJog: clamp(speed / STRIDE.jog, 0.5, 1.3),
    scaleSprint: clamp(speed / STRIDE.sprint, 0.8, 1.25),
  };
}

/** Sword_Attack: wind-up 0.2-0.4 s, the blade crosses at 0.4 s, recovery to 1.05 s. The attack's hit frame (hitN, 0..1) lands on the cross. */
export const ATTACK_CLIP = { start: 0.2, hit: 0.4, end: 1.05 };
export function attackClipTime(n: number, hitN: number): number {
  const c = clamp(n, 0, 1);
  return c < hitN ? lerp(ATTACK_CLIP.start, ATTACK_CLIP.hit, c / Math.max(1e-6, hitN)) : lerp(ATTACK_CLIP.hit, ATTACK_CLIP.end, (c - hitN) / Math.max(1e-6, 1 - hitN));
}
/** The special: wind up, then hold the extended strike pose while the body spins (the spin itself is applied to the rig). */
export function specialClipTime(n: number, blastN: number): number {
  const c = clamp(n, 0, 1);
  return c < blastN ? lerp(ATTACK_CLIP.start, ATTACK_CLIP.hit, c / Math.max(1e-6, blastN)) : lerp(ATTACK_CLIP.hit, ATTACK_CLIP.hit + 0.16, (c - blastN) / Math.max(1e-6, 1 - blastN));
}
export const rollClipTime = (n: number): number => lerp(0.05, 1.25, clamp(n, 0, 1));
export const faintClipTime = (f: number): number => clamp(f, 0, 1) * 1.3;

export type Override = 'attack' | 'special' | 'dodge' | 'hurt' | 'faint' | 'jump' | null;

export interface HeroPose {
  /** Ground speed in m/s. */
  speed: number;
  /** Seconds, free-running. */
  time: number;
  attack: number | null;
  /** v2.12: which swing of the 3-hit combo the attack is (0, 1, 2 = finisher). */
  combo?: number;
  dodge: number | null;
  special: number | null;
  /** 0 = standing, 1 = lying down. */
  faint: number;
  /** 0..1 through a hop (optional). */
  jump?: number | null;
  /** True while in conversation (a friendlier idle). */
  talking?: boolean;
}

export interface AnimTimings { attackHitN: number; specialBlastN: number }

export class HeroAnimator {
  private readonly act = new Map<string, AnimationAction>();
  private phase = 0;
  private over: Override = null; private overWeight = 0; private overClip = 'Sword_Attack'; private overTime = 0;
  private hurtT = 0;
  /** Seconds since combat last happened (the sword stays drawn a moment after). */
  combatIdle = 99;

  constructor(private readonly rig: HeroRig, private readonly timings: AnimTimings) {
    const names = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sword_Attack', 'Roll', 'Death01', 'Hit_Chest', 'Jump_Start', 'Jump_Loop', 'Jump_Land'];
    for (const n of names) {
      const clip: AnimationClip | undefined = rig.clips.get(n);
      if (!clip) continue;
      const a = rig.mixer.clipAction(clip); a.play(); a.paused = true; a.setEffectiveWeight(0);
      this.act.set(n, a);
    }
  }

  /** Starts the short flinch (Hit_Chest). */
  hit(): void { this.hurtT = 0.0001; }

  private setW(name: string, w: number, time?: number): void {
    const a = this.act.get(name); if (!a) return;
    a.enabled = true; a.setEffectiveWeight(w);
    if (time !== undefined) a.time = time;
  }

  update(dt: number, p: HeroPose): void {
    // which full-body action is active
    let next: Override = null; let clip = 'Sword_Attack'; let t = 0;
    if (p.faint > 0) { next = 'faint'; clip = 'Death01'; t = faintClipTime(p.faint); }
    else if (p.dodge !== null) { next = 'dodge'; clip = 'Roll'; t = rollClipTime(p.dodge); }
    else if (p.special !== null) { next = 'special'; clip = 'Sword_Attack'; t = specialClipTime(p.special, this.timings.specialBlastN); }
    else if (p.attack !== null) { next = 'attack'; clip = 'Sword_Attack'; t = attackClipTime(p.attack, this.timings.attackHitN); }
    else if (p.jump !== null && p.jump !== undefined) {
      next = 'jump';
      const j = p.jump;
      if (j < 0.14) { clip = 'Jump_Start'; t = (j / 0.14) * 0.12; } else if (j < 0.72) { clip = 'Jump_Loop'; t = 0.3 + (j - 0.14) * 0.6; } else { clip = 'Jump_Land'; t = ((j - 0.72) / 0.28) * 0.5; }
    }
    if (this.hurtT > 0) {
      this.hurtT += dt;
      if (this.hurtT > 0.34) this.hurtT = 0;
      else if (next === null || next === 'jump') { next = 'hurt'; clip = 'Hit_Chest'; t = Math.min(0.32, this.hurtT); }
    }
    if (next === 'attack' || next === 'special' || next === 'dodge') this.combatIdle = 0; else this.combatIdle += dt;
    if (next) { this.over = next; this.overClip = clip; this.overTime = t; }
    const target = next ? 1 : 0;
    const rate = next ? 18 : 9;
    this.overWeight += clamp(target - this.overWeight, -rate * dt, rate * dt);
    if (this.overWeight <= 0.001 && !next) this.over = null;
    const ow = smooth(this.overWeight);
    const lw = 1 - ow;

    // locomotion with a shared phase
    const plan = locomotionPlan(p.speed);
    const wIdle = plan.idle * lw, wWalk = plan.walk * lw, wJog = plan.jog * lw, wSprint = plan.sprint * lw;
    const dur = (n: string) => this.act.get(n)?.getClip().duration ?? 1;
    const cyclesPerSec = plan.walk * plan.scaleWalk / dur('Walk_Loop') + plan.jog * plan.scaleJog / dur('Jog_Fwd_Loop') + plan.sprint * plan.scaleSprint / dur('Sprint_Loop');
    this.phase = (this.phase + cyclesPerSec * dt) % 1;
    const idleName = p.talking ? 'Idle_Talking_Loop' : 'Idle_Loop';
    this.setW('Idle_Loop', p.talking ? 0 : wIdle, (p.time % dur('Idle_Loop')));
    this.setW('Idle_Talking_Loop', p.talking ? wIdle : 0, (p.time % dur('Idle_Talking_Loop')));
    void idleName;
    this.setW('Walk_Loop', wWalk, this.phase * dur('Walk_Loop'));
    this.setW('Jog_Fwd_Loop', wJog, this.phase * dur('Jog_Fwd_Loop'));
    this.setW('Sprint_Loop', wSprint, this.phase * dur('Sprint_Loop'));
    // override clips: only the active one has weight, the others are zero
    for (const n of ['Sword_Attack', 'Roll', 'Death01', 'Hit_Chest', 'Jump_Start', 'Jump_Loop', 'Jump_Land']) {
      if (n === this.overClip && this.over) this.setW(n, ow, Math.min(this.overTime, (this.act.get(n)?.getClip().duration ?? 1) - 1e-3)); else this.setW(n, 0);
    }
    this.rig.mixer.update(0);
  }

  get activeOverride(): Override { return this.over; }
}
