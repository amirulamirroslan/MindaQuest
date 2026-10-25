/**
 * Small pure helpers for character animation (no three.js, unit-tested): easing, a damped spring for secondary motion and
 * hit recoil, and the per-creature temperament that makes every sprout move a little differently.
 */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const easeOutBack = (t: number, c = 1.7): number => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
/** 0 → 1 → 0 over [0,1]: a single smooth bump. */
export const bump = (t: number): number => Math.sin(clamp01(t) * Math.PI);

/** A damped spring (semi-implicit Euler, sub-stepped so a long frame cannot blow it up). */
export class Spring {
  value = 0; velocity = 0;
  constructor(public stiffness = 160, public damping = 12) {}
  kick(impulse: number): void { this.velocity += impulse; }
  step(dt: number, target = 0): number {
    let left = Math.min(0.1, Math.max(0, dt));
    while (left > 0) {
      const h = Math.min(left, 1 / 120); left -= h;
      this.velocity += ((target - this.value) * this.stiffness - this.velocity * this.damping) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

export type Temperament = 'bouncy' | 'sleepy' | 'jittery';
export interface SproutStyle {
  temperament: Temperament; scale: number;
  /** hop rate (rad/s) and height while chasing */
  hopRate: number; hopHeight: number;
  /** idle breathing rate and how often it looks around */
  breath: number; look: number;
  /** leaf-tuft sway amount */
  leaf: number;
  /** multiplies the body colour (r,g,b) so a patrol does not look cloned */
  tint: readonly [number, number, number];
}
const STYLES: Readonly<Record<Temperament, Omit<SproutStyle, 'scale' | 'temperament'>>> = {
  bouncy: { hopRate: 6.5, hopHeight: 0.32, breath: 3, look: 0.6, leaf: 0.14, tint: [1, 1, 1] },
  sleepy: { hopRate: 4.2, hopHeight: 0.2, breath: 1.6, look: 0.25, leaf: 0.06, tint: [0.9, 1, 1.06] },
  jittery: { hopRate: 8.4, hopHeight: 0.2, breath: 5, look: 1.4, leaf: 0.24, tint: [1.08, 1.02, 0.84] },
};
/** Deterministic: the same enemy id always gets the same personality and a +-8% size. */
export function sproutStyle(id: number): SproutStyle {
  const order: Temperament[] = ['bouncy', 'sleepy', 'jittery'];
  const temperament = order[Math.abs(Math.floor(id)) % 3];
  const scale = 0.92 + ((Math.abs(Math.floor(id)) * 37) % 17) / 17 * 0.16;
  return { temperament, scale, ...STYLES[temperament] };
}

/** How hard a blow shoves a creature visually: heavier creatures move less. */
export function recoilImpulse(step: number, mass: number): number { return (0.9 + step * 0.45) / Math.max(0.5, mass); }
