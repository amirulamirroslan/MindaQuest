import { describe, expect, it } from 'vitest';
import { COMBAT, PlayerCombat, PlayerVitals, inAttackArc, inRadius, type CombatEvent } from './combat';

const run = (c: PlayerCombat, seconds: number, dt = 1 / 60): CombatEvent[] => { const ev: CombatEvent[] = []; for (let t = 0; t < seconds; t += dt) ev.push(...c.update(dt)); return ev; };

describe('PlayerCombat combo (v2.12)', () => {
  const swing = (c: PlayerCombat, gap: number) => { c.request('attack'); run(c, COMBAT.attackDuration + 0.05 + gap); };
  it('quick follow-up swings walk through the three-hit combo and then start over', () => {
    const c = new PlayerCombat(); const steps: number[] = [];
    for (let i = 0; i < 4; i++) { c.request('attack'); run(c, 0.15); steps.push(c.comboStep); run(c, COMBAT.attackDuration); }
    expect(steps).toEqual([0, 1, 2, 0]);
  });
  it('a pause longer than the combo window, a dodge, or a special resets it', () => {
    const a = new PlayerCombat(); swing(a, 0); a.request('attack'); run(a, 0.15); expect(a.comboStep).toBe(1);
    const b = new PlayerCombat(); swing(b, COMBAT.comboWindow + 0.2); b.request('attack'); run(b, 0.15); expect(b.comboStep).toBe(0);
    const d = new PlayerCombat(); swing(d, 0); d.request('dodge'); run(d, COMBAT.dodgeDuration + 0.05); d.request('attack'); run(d, 0.15); expect(d.comboStep).toBe(0);
  });
});

describe('PlayerCombat', () => {
  it('a swing emits exactly one hit event, at any frame rate', () => {
    for (const fps of [20, 30, 60, 144]) {
      const c = new PlayerCombat(); c.request('attack');
      const ev = run(c, 1, 1 / fps);
      expect(ev.filter((e) => e.kind === 'attackHit')).toHaveLength(1);
      expect(ev.filter((e) => e.kind === 'attackStart')).toHaveLength(1);
    }
  });
  it('mashing attack does not stack or skip: one swing per press after the swing ends', () => {
    const c = new PlayerCombat(); const ev: CombatEvent[] = [];
    for (let i = 0; i < 60; i++) { c.request('attack'); ev.push(...c.update(1 / 60)); }
    const starts = ev.filter((e) => e.kind === 'attackStart').length;
    expect(starts).toBeGreaterThanOrEqual(2); expect(starts).toBeLessThanOrEqual(3); // ~0.54s per swing in 1s
    const ids = ev.filter((e) => e.kind === 'attackHit').map((e) => (e as { swingId: number }).swingId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('a press made just before the swing ends is buffered, an old press is dropped', () => {
    const c = new PlayerCombat(); c.request('attack'); c.update(1 / 60);
    run(c, COMBAT.attackDuration - 0.1); c.request('attack');
    expect(run(c, 0.3).some((e) => e.kind === 'attackStart')).toBe(true);
    const d = new PlayerCombat(); d.request('special'); run(d, 1); d.request('special'); // on cooldown
    expect(run(d, 0.5).some((e) => e.kind === 'specialStart')).toBe(false);
  });
  it('special has a cooldown and one blast', () => {
    const c = new PlayerCombat(); c.request('special');
    const ev = run(c, 1);
    expect(ev.filter((e) => e.kind === 'specialBlast')).toHaveLength(1);
    expect(c.ready('special')).toBe(false); expect(c.cooldownFraction('special')).toBeGreaterThan(0.8);
    run(c, COMBAT.specialCooldown); expect(c.ready('special')).toBe(true);
  });
  it('dodge is invulnerable only inside its window and has a cooldown', () => {
    const c = new PlayerCombat(); c.request('dodge'); c.update(0.001);
    expect(c.invulnerable).toBe(false);
    c.update(0.1); expect(c.invulnerable).toBe(true);
    run(c, 0.4); expect(c.invulnerable).toBe(false); expect(c.state).toBe('free');
    c.request('dodge'); expect(run(c, 0.2).some((e) => e.kind === 'dodgeStart')).toBe(false);
  });
  it('arc and radius hit tests', () => {
    const o = { x: 0, z: 0 };
    expect(inAttackArc(o, 0, { x: 0, z: 1.5 }, 1.9, 0.6)).toBe(true);
    expect(inAttackArc(o, 0, { x: 0, z: -1.5 }, 1.9, 0.6)).toBe(false); // behind
    expect(inAttackArc(o, 0, { x: 0, z: 5 }, 1.9, 0.6)).toBe(false);    // too far
    expect(inRadius(o, { x: 3, z: 0 }, 3.4)).toBe(true); expect(inRadius(o, { x: 9, z: 0 }, 3.4)).toBe(false);
  });
});

describe('PlayerVitals', () => {
  it('takes one hit at a time, ignores hits while dodging, and respawns with full health', () => {
    const v = new PlayerVitals(5);
    expect(v.hurt(1, true)).toBe(0);
    expect(v.hurt(1, false)).toBe(1); expect(v.hurt(1, false)).toBe(0); // recovery window
    v.update(1.1); expect(v.hurt(1, false)).toBe(1); expect(v.hp).toBe(3);
    v.update(1.1); v.hurt(99, false); expect(v.fainted).toBe(true);
    v.respawn(); expect(v.hp).toBe(5); expect(v.fainted).toBe(false);
  });
});
