/**
 * Player combat rules for the 3D game (pure, unit-tested). The scene asks `PlayerCombat` what is happening and
 * applies the geometry/animation; this class owns timing, cooldowns, input buffering and "one hit per swing".
 */
import type { Vec2 } from './movement3d';

export type CombatState = 'free' | 'attack' | 'dodge' | 'special';
export type CombatAction = 'attack' | 'dodge' | 'special';
export type CombatEvent =
  | { kind: 'attackStart'; swingId: number }
  | { kind: 'attackHit'; swingId: number }      // emitted exactly once per swing: run the hit test now
  | { kind: 'dodgeStart' }
  | { kind: 'specialStart' }
  | { kind: 'specialBlast'; swingId: number }   // emitted exactly once per special: run the area hit test now
  | { kind: 'end'; from: CombatState };

export const COMBAT = {
  attackDuration: 0.42, attackHitAt: 0.14, attackCooldown: 0.12, attackRange: 1.9, attackHalfAngle: Math.PI / 2.6, attackDamage: 1,
  dodgeDuration: 0.38, dodgeInvulnFrom: 0.03, dodgeInvulnTo: 0.3, dodgeCooldown: 0.8, dodgeDistance: 3.2,
  specialDuration: 0.7, specialHitAt: 0.3, specialCooldown: 7, specialRadius: 3.4, specialDamage: 3,
  inputBuffer: 0.3,
  /** v2.12: a swing started within this many seconds of the last one continues the 3-hit combo (slice, back-slice, finisher). */
  comboWindow: 0.75,
} as const;

/** Number of swings in the attack combo. */
export const COMBO_LENGTH = 3;

export class PlayerCombat {
  state: CombatState = 'free';
  /** Seconds since the current action began. */
  t = 0;
  private cooldown = { attack: 0, dodge: 0, special: 0 };
  private buffered: CombatAction | null = null;
  private bufferedFor = 0;
  private swing = 0;
  private hitFired = false;
  private combo = 0;
  private sinceAttack = 99;

  /** Which swing of the combo the current (or next) attack is: 0, 1, or 2 = the finisher. */
  get comboStep(): number { return this.combo; }
  get swingId(): number { return this.swing; }
  get busy(): boolean { return this.state !== 'free'; }
  /** True while a dodge's invulnerability window is open. */
  get invulnerable(): boolean {
    return this.state === 'dodge' && this.t >= COMBAT.dodgeInvulnFrom && this.t <= COMBAT.dodgeInvulnTo;
  }
  /** 0 = ready, 1 = just used. For HUD cooldown rings. */
  cooldownFraction(a: CombatAction): number {
    const total = a === 'attack' ? COMBAT.attackCooldown : a === 'dodge' ? COMBAT.dodgeCooldown : COMBAT.specialCooldown;
    return Math.min(1, Math.max(0, this.cooldown[a] / total));
  }
  ready(a: CombatAction): boolean { return this.cooldown[a] <= 0; }

  /**
   * Press an action. Presses made while busy or cooling down are buffered briefly (so quick taps on a phone are not
   * lost) but never stacked: only the latest press is kept, and holding a button must be turned into a single
   * press by the caller (edge-triggered).
   */
  request(a: CombatAction): void { this.buffered = a; this.bufferedFor = COMBAT.inputBuffer; }
  /** Forget a press that has not started yet (the game paused, a conversation opened or the hero fainted), so it cannot fire later. */
  clearBuffer(): void { this.buffered = null; this.bufferedFor = 0; }

  update(dt: number): CombatEvent[] {
    const events: CombatEvent[] = [];
    if (!(dt > 0)) return events;
    if (this.state === 'free') this.sinceAttack += dt;
    for (const k of ['attack', 'dodge', 'special'] as const) this.cooldown[k] = Math.max(0, this.cooldown[k] - dt);
    if (this.buffered) { this.bufferedFor -= dt; if (this.bufferedFor <= 0) this.buffered = null; }

    if (this.state !== 'free') {
      this.t += dt;
      if (this.state === 'attack' && !this.hitFired && this.t >= COMBAT.attackHitAt) { this.hitFired = true; events.push({ kind: 'attackHit', swingId: this.swing }); }
      if (this.state === 'special' && !this.hitFired && this.t >= COMBAT.specialHitAt) { this.hitFired = true; events.push({ kind: 'specialBlast', swingId: this.swing }); }
      const dur = this.state === 'attack' ? COMBAT.attackDuration : this.state === 'dodge' ? COMBAT.dodgeDuration : COMBAT.specialDuration;
      if (this.t >= dur) {
        const from = this.state;
        if (from === 'attack') { this.cooldown.attack = COMBAT.attackCooldown; this.sinceAttack = 0; } else this.sinceAttack = 99;
        this.state = 'free'; this.t = 0;
        events.push({ kind: 'end', from });
      }
    }
    if (this.state === 'free' && this.buffered && this.ready(this.buffered)) {
      const a = this.buffered; this.buffered = null;
      this.state = a; this.t = 0; this.hitFired = false;
      if (a === 'attack') { this.combo = this.sinceAttack < COMBAT.comboWindow ? (this.combo + 1) % COMBO_LENGTH : 0; this.swing++; events.push({ kind: 'attackStart', swingId: this.swing }); }
      else if (a === 'dodge') { this.cooldown.dodge = COMBAT.dodgeCooldown; events.push({ kind: 'dodgeStart' }); }
      else { this.swing++; this.cooldown.special = COMBAT.specialCooldown; events.push({ kind: 'specialStart' }); }
    }
    return events;
  }
}

/** Is `target` within `range` of `from` and inside the cone around `heading` (0 = facing +Z)? */
export function inAttackArc(from: Vec2, heading: number, target: Vec2, range: number, halfAngle: number, targetRadius = 0.4): boolean {
  const dx = target.x - from.x, dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range + targetRadius) return false;
  if (dist < 1e-6) return true;
  let diff = Math.atan2(dx, dz) - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) <= halfAngle;
}

export function inRadius(from: Vec2, target: Vec2, radius: number, targetRadius = 0.4): boolean {
  return Math.hypot(target.x - from.x, target.z - from.z) <= radius + targetRadius;
}

/**
 * Player health is deliberately gentle for ages 6-15: being "knocked out" never ends the game. The hero is
 * returned to the last checkpoint with full health after a short faint.
 */
export class PlayerVitals {
  hp: number;
  private hurtTimer = 0;
  constructor(public readonly maxHp = 5) { this.hp = maxHp; }
  get hurtInvulnerable(): boolean { return this.hurtTimer > 0; }
  get fainted(): boolean { return this.hp <= 0; }
  update(dt: number): void { this.hurtTimer = Math.max(0, this.hurtTimer - dt); }
  /** Returns the damage actually taken (0 while recovering from a hit or dodging). */
  hurt(amount: number, dodgeInvulnerable: boolean): number {
    if (this.fainted || this.hurtTimer > 0 || dodgeInvulnerable || amount <= 0) return 0;
    const taken = Math.min(amount, this.hp);
    this.hp -= taken; this.hurtTimer = 1.0;
    return taken;
  }
  heal(amount: number): void { this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount)); }
  respawn(): void { this.hp = this.maxHp; this.hurtTimer = 1.5; }
}
