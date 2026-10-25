/**
 * Which kit animation clip the hero plays, by what it holds, and how each clip's timing maps onto the game's own action timing
 * (pure, unit-tested; `chibiClips.test.ts` checks every name and duration against the real GLB).
 *
 * Times were measured with `tools/chibi-kit/measure-clips.mjs` (peak hand speed = the moment the blow lands).
 */
import type { WeaponClass } from '../../cosmetics/catalog';
import type { Loadout } from '../../cosmetics/loadout';
import { isDualWield } from '../../cosmetics/loadout';

export interface ClipWindow {
  clip: string; duration: number;
  /** Clip time where the game's wind-up starts, where the blow lands, and where the recovery ends. */
  start: number; hit: number; end: number;
}

export const CLIP_DURATIONS = {
  Idle: 1.067, Unarmed_Idle: 1.067, '2H_Melee_Idle': 1.067, Walking_A: 1.067, Running_A: 0.8, Running_B: 1.067,
  Dodge_Forward: 0.4, Hit_A: 0.667, Hit_B: 0.867, Death_A: 0.8, Cheer: 1.667, Interact: 1.3, PickUp: 1.3,
  Jump_Start: 0.6, Jump_Idle: 1.067, Jump_Land: 0.667,
  '1H_Melee_Attack_Slice_Horizontal': 1.067, '1H_Melee_Attack_Chop': 1.067, '2H_Melee_Attack_Slice': 1.1, '2H_Melee_Attack_Chop': 1.633,
  Dualwield_Melee_Attack_Slice: 1.167, Spellcast_Shoot: 0.933, Unarmed_Melee_Attack_Punch_A: 1.467,
  // v2.12: the rest of the kit's combat clips, for the 3-hit combo and the real spin
  '1H_Melee_Attack_Slice_Diagonal': 1.0, '1H_Melee_Attack_Stab': 1.6, '2H_Melee_Attack_Stab': 1.6, '2H_Melee_Attack_Spin': 2.4,
  Dualwield_Melee_Attack_Chop: 1.267, Dualwield_Melee_Attack_Stab: 1.6, Spellcast_Raise: 2.1, Unarmed_Melee_Attack_Kick: 0.933,
} as const;

/** What the swing looks like as an effect: the arc's plane tilt (0 flat, +-0.7 diagonal, pi/2 overhead), sweep direction, or a forward thrust. */
export type SwingShape = 'slash' | 'back' | 'chop' | 'stab' | 'cast';
export interface ComboHit extends ClipWindow { shape: SwingShape }

const w = (clip: keyof typeof CLIP_DURATIONS, start: number, hit: number, end: number): ClipWindow => ({ clip, duration: CLIP_DURATIONS[clip], start, hit, end });

const h = (shape: SwingShape, c: ClipWindow): ComboHit => ({ ...c, shape });
const SLICE = w('1H_Melee_Attack_Slice_Horizontal', 0, 0.25, 0.7);
const DIAG = w('1H_Melee_Attack_Slice_Diagonal', 0, 0.39, 0.62);
/** v2.12: every weapon swings three different ways in a row (the third is the heavy finisher). Index 0 is the old single attack. */
const ATTACKS: Record<WeaponClass | 'none' | 'dual', readonly ComboHit[]> = {
  sword1h: [h('slash', SLICE), h('back', DIAG), h('chop', w('1H_Melee_Attack_Chop', 0.1, 0.59, 0.95))],
  axe1h: [h('chop', w('1H_Melee_Attack_Chop', 0.1, 0.59, 0.95)), h('back', DIAG), h('chop', w('1H_Melee_Attack_Chop', 0.05, 0.59, 1.0))],
  dagger: [h('slash', SLICE), h('back', DIAG), h('stab', w('1H_Melee_Attack_Stab', 0.05, 0.4, 0.7))],
  sword2h: [h('slash', w('2H_Melee_Attack_Slice', 0, 0.39, 0.85)), h('stab', w('2H_Melee_Attack_Stab', 0.05, 0.4, 0.75)), h('chop', w('2H_Melee_Attack_Chop', 0.2, 0.71, 1.15))],
  axe2h: [h('chop', w('2H_Melee_Attack_Chop', 0.2, 0.71, 1.15)), h('slash', w('2H_Melee_Attack_Slice', 0, 0.39, 0.85)), h('chop', w('2H_Melee_Attack_Chop', 0.15, 0.71, 1.2))],
  staff: [h('cast', w('Spellcast_Shoot', 0, 0.2, 0.7)), h('cast', w('Spellcast_Shoot', 0, 0.2, 0.7)), h('cast', w('Spellcast_Raise', 0, 0.26, 0.9))],
  wand: [h('cast', w('Spellcast_Shoot', 0, 0.2, 0.7)), h('cast', w('Spellcast_Shoot', 0, 0.2, 0.7)), h('cast', w('Spellcast_Raise', 0, 0.26, 0.9))],
  dual: [h('slash', w('Dualwield_Melee_Attack_Slice', 0, 0.58, 1.1)), h('chop', w('Dualwield_Melee_Attack_Chop', 0.1, 0.55, 0.95)), h('stab', w('Dualwield_Melee_Attack_Stab', 0.05, 0.4, 0.75))],
  none: [h('stab', w('Unarmed_Melee_Attack_Punch_A', 0.1, 0.42, 0.9)), h('back', w('Unarmed_Melee_Attack_Kick', 0.05, 0.33, 0.7)), h('stab', w('Unarmed_Melee_Attack_Punch_A', 0.05, 0.42, 0.9))],
};

/** The swing for combo step `step` (0, 1, 2); without a step it is the first swing, as before v2.12. */
export function attackHit(l: Loadout, step = 0): ComboHit {
  const wc = l.items.weapon?.weapon;
  const list = !wc ? ATTACKS.none : isDualWield(l) ? ATTACKS.dual : ATTACKS[wc];
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(step)))];
}
export function attackWindow(l: Loadout, step = 0): ClipWindow { return attackHit(l, step); }

/**
 * v2.12: the special is the kit's real spin clip (`2H_Melee_Attack_Spin`: one full turn with the weapon out; its root bone turns,
 * so the game adds only ONE more turn on top, for two in all). Scrubbed so the blast lands mid-spin.
 */
const SPIN = w('2H_Melee_Attack_Spin', 0.28, 0.95, 1.55);
export const specialWindow = (_l: Loadout): ClipWindow => SPIN;

/** The standing pose: unarmed, two-handed weapons and staves each have their own stance. */
export function idleClip(l: Loadout): keyof typeof CLIP_DURATIONS {
  const wc = l.items.weapon;
  if (!wc) return 'Unarmed_Idle';
  return wc.twoHanded ? '2H_Melee_Idle' : 'Idle';
}

/** Clip time for the game's action progress n (0..1), landing the blow on the game's hit frame `hitN`. */
export function scrubTime(win: ClipWindow, n: number, hitN: number): number {
  const c = Math.min(1, Math.max(0, n)); const h = Math.max(1e-6, Math.min(0.999, hitN));
  const t = c < h ? win.start + (win.hit - win.start) * (c / h) : win.hit + (win.end - win.hit) * ((c - h) / (1 - h));
  return Math.min(win.duration - 1e-3, Math.max(0, t));
}

/** Native stance-foot speeds (units/s, measured) and the scale the hero is drawn at, for locomotion blending. */
export const STRIDE_NATIVE = { walk: 0.69, runA: 3.2 } as const;
export const CHIBI_SCALE = 0.57;
export const LOCO = { walk: 'Walking_A', run: 'Running_A' } as const;

export interface LocoPlan { idle: number; walk: number; run: number; rateWalk: number; rateRun: number }
const sm = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
/** Blend weights (sum to 1) and playback rates for a ground speed in m/s. Rates are capped so a sprint stays readable (a little foot slide is accepted). */
export function locomotionPlan(speed: number): LocoPlan {
  const moving = sm((speed - 0.1) / 0.6), runShare = sm((speed - 1.4) / 1.6);
  return {
    idle: 1 - moving, walk: moving * (1 - runShare), run: moving * runShare,
    rateWalk: Math.min(2.2, Math.max(0.7, speed / (STRIDE_NATIVE.walk * CHIBI_SCALE))),
    rateRun: Math.min(2.4, Math.max(0.8, speed / (STRIDE_NATIVE.runA * CHIBI_SCALE))),
  };
}
