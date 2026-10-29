import { describe, expect, it } from 'vitest';
import { COMBAT, COMBO_LENGTH, PlayerCombat, PlayerVitals, type CombatEvent } from './combat';

const run = (c: PlayerCombat, seconds: number, dt = 1 / 60): CombatEvent[] => {
  const out: CombatEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) out.push(...c.update(dt));
  return out;
};

describe('player combat rules', () => {
  it('lands exactly one hit per swing, however small the frames are', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.005]) {
      const c = new PlayerCombat(); c.request('attack');
      const ev = run(c, COMBAT.attackDuration + 0.1, dt);
      expect(ev.filter(e => e.kind === 'attackHit')).toHaveLength(1);
      expect(ev.filter(e => e.kind === 'end')).toHaveLength(1);
    }
  });

  it('chains a three-hit combo and starts again after the finisher', () => {
    const c = new PlayerCombat(); const steps: number[] = [];
    for (let i = 0; i < COMBO_LENGTH + 1; i++) {
      c.request('attack');
      for (const e of run(c, 0.05)) if (e.kind === 'attackStart') steps.push(c.comboStep);
      run(c, COMBAT.attackDuration + COMBAT.attackCooldown + 0.02);
    }
    expect(steps).toEqual([0, 1, 2, 0]);
  });

  it('lets the combo go if the child waits too long', () => {
    const c = new PlayerCombat(); c.request('attack'); run(c, COMBAT.attackDuration + 0.2);
    run(c, COMBAT.comboWindow + 0.3);
    c.request('attack'); run(c, 0.05); expect(c.comboStep).toBe(0);
  });

  it('is untouchable for the middle of a dodge only, and the dodge recharges', () => {
    const c = new PlayerCombat(); c.request('dodge');
    run(c, COMBAT.dodgeInvulnFrom / 2); expect(c.state).toBe('dodge'); expect(c.invulnerable).toBe(false);
    run(c, COMBAT.dodgeInvulnFrom + 0.05); expect(c.invulnerable).toBe(true);
    run(c, COMBAT.dodgeInvulnTo); expect(c.invulnerable).toBe(false);
    run(c, COMBAT.dodgeDuration); expect(c.state).toBe('free');
    expect(c.ready('dodge')).toBe(false); run(c, COMBAT.dodgeCooldown); expect(c.ready('dodge')).toBe(true);
  });

  it('keeps the spin on its long cooldown, and drops a press that waited too long', () => {
    const c = new PlayerCombat(); c.request('special'); run(c, COMBAT.specialDuration + 0.05);
    expect(c.cooldownFraction('special')).toBeGreaterThan(0.8);
    c.request('special'); const ev = run(c, 1); expect(ev.some(e => e.kind === 'specialStart')).toBe(false);
    run(c, COMBAT.specialCooldown); c.request('special'); expect(run(c, 0.05).some(e => e.kind === 'specialStart')).toBe(true);
  });

  it('forgets a press that has not started when the game pauses', () => {
    const c = new PlayerCombat(); c.request('attack'); c.clearBuffer();
    const ev = run(c, 0.2); expect(ev).toEqual([]); expect(c.state).toBe('free');
  });
});

describe('player health', () => {
  it('is gentle: a hit gives a second of safety, a dodge gives none, and a faint heals fully', () => {
    const v = new PlayerVitals(5);
    expect(v.hurt(1, true)).toBe(0); expect(v.hp).toBe(5); // dodged
    expect(v.hurt(1, false)).toBe(1); expect(v.hp).toBe(4);
    expect(v.hurt(1, false)).toBe(0); expect(v.hp).toBe(4); // still recovering
    v.update(1.01); expect(v.hurt(1, false)).toBe(1); expect(v.hp).toBe(3);
    v.update(1.01); v.hurt(99, false); expect(v.hp).toBe(0); expect(v.fainted).toBe(true);
    v.update(5); expect(v.hurt(1, false)).toBe(0); expect(v.hp).toBe(0); // never below zero
    v.respawn(); expect(v.hp).toBe(5); expect(v.fainted).toBe(false); expect(v.hurtInvulnerable).toBe(true);
  });
  it('ignores bad amounts', () => {
    const v = new PlayerVitals(5); expect(v.hurt(0, false)).toBe(0); expect(v.hurt(-3, false)).toBe(0); v.heal(-5); expect(v.hp).toBe(5); v.heal(99); expect(v.hp).toBe(5);
  });
});
