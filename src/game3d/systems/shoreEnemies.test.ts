import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, Enemy, shapeHits, type EnemyEvent } from './enemies';

const run = (e: Enemy, seconds: number, player: { x: number; z: number }, step = 1 / 60): EnemyEvent[] => { const out: EnemyEvent[] = []; for (let t = 0; t < seconds; t += step) out.push(...e.update(step, player)); return out; };

describe('pebble crab', () => {
  it('blocks a blow from the front, takes one from the side or behind, and takes one while it recovers', () => {
    const faceSouth = (): Enemy => { const e = new Enemy('crab', { x: 0, z: 0 }); e.heading = 0; return e; };   // heading 0 = facing +z
    let e = faceSouth(); expect(e.takeDamage(1, 1, { x: 0, z: 2 })).toEqual([{ kind: 'blocked' }]); expect(e.hp).toBe(4);       // in front
    e = faceSouth(); expect(e.takeDamage(1, 1, { x: 2, z: 0.3 })[0]).toMatchObject({ kind: 'hit' }); expect(e.hp).toBe(3);      // beside it
    e = faceSouth(); expect(e.takeDamage(1, 1, { x: 0, z: -2 })[0]).toMatchObject({ kind: 'hit' }); expect(e.hp).toBe(3);      // behind it
    e = faceSouth(); (e as unknown as { state: string }).state = 'recover'; expect(e.takeDamage(1, 1, { x: 0, z: 2 })[0]).toMatchObject({ kind: 'hit' }); expect(e.hp).toBe(3);   // shell open
    e = faceSouth(); expect(e.takeDamage(1, 1, { x: 0, z: 2 }, true)[0]).toMatchObject({ kind: 'hit' });                       // the spin ignores the shell
  });
  it('counts one swing once even when it is blocked', () => {
    const e = new Enemy('crab', { x: 0, z: 0 }); e.heading = 0;
    expect(e.takeDamage(1, 7, { x: 0, z: 2 })).toHaveLength(1); expect(e.takeDamage(1, 7, { x: 0, z: -2 })).toEqual([]);
  });
  it('has no guard at all unless it is a crab, so every older creature is unchanged', () => {
    for (const k of ['sprout', 'mossback', 'shardling', 'warden', 'gull', 'heron'] as const) { const e = new Enemy(k, { x: 0, z: 0 }); e.heading = 0; expect(ENEMY_DEFS[k].frontGuard, k).toBeUndefined(); expect(e.takeDamage(1, 1, { x: 0, z: 2 })[0], k).toMatchObject({ kind: 'hit' }); }
  });
  it('turns slowly, so a hero circling it can get round to the back', () => {
    const e = new Enemy('crab', { x: 0, z: 0 }); e.heading = 0;
    run(e, 0.5, { x: 6, z: 0 });   // the hero is due east (heading pi/2): at 2.1 rad/s it cannot have turned that far in half a second
    expect(e.heading).toBeGreaterThan(0.5); expect(e.heading).toBeLessThan(Math.PI / 2 - 0.2);
    run(e, 1.5, { x: 6, z: 0 }); expect(e.heading).toBeGreaterThan(1.2);
    // a hero who runs round behind it is not met by the shell: after circling it is behind the crab, and the blow lands
    const c = new Enemy('crab', { x: 0, z: 0 }); c.heading = 0; expect(c.takeDamage(1, 3, { x: 0.2, z: -1.5 })[0]).toMatchObject({ kind: 'hit' });
  });
  it('scuttles along a warned line, then is dizzy and open, so it can always be beaten fairly', () => {
    const e = new Enemy('crab', { x: 0, z: 0 }), player = { x: 0, z: 6.5 };
    const ev = run(e, 12, player);
    const tele = ev.find(x => x.kind === 'telegraph'); expect(tele).toBeDefined();
    if (tele?.kind === 'telegraph') { expect(tele.attack).toBe('scuttle'); expect(tele.shape.type).toBe('line'); expect(tele.duration).toBeCloseTo(0.9, 5); }
    expect(ev.some(x => x.kind === 'strike')).toBe(true);
  });
  it('is calmed (defeated) by four plain hits to the side', () => {
    const e = new Enemy('crab', { x: 0, z: 0 }); e.heading = 0; let last: EnemyEvent[] = [];
    for (let i = 0; i < 4; i++) last = e.takeDamage(1, 10 + i, { x: 2, z: 0 }); expect(last.some(x => x.kind === 'defeated')).toBe(true); expect(e.defeated).toBe(true);
  });
});

describe('gloom gull', () => {
  it('swoops along a warned line and a hit in the wind-up interrupts it', () => {
    const e = new Enemy('gull', { x: 0, z: 0 }), player = { x: 0, z: 8 };
    const ev = run(e, 3, player); const tele = ev.find(x => x.kind === 'telegraph');
    expect(tele && tele.kind === 'telegraph' ? tele.attack : '').toBe('swoop');
        const w = new Enemy('gull', { x: 0, z: 0 }); let guard = 0; while (w.state !== 'telegraph' && guard++ < 600) w.update(1 / 60, player);
    expect(w.state).toBe('telegraph'); w.takeDamage(1, 1, { x: 0, z: 1 }); expect(w.state).toBe('recover');
  });
  it('is fair: its swoop line is escapable by stepping aside at 75 percent of run speed', () => {
    const e = new Enemy('gull', { x: 0, z: 0 }); const ev = run(e, 3, { x: 0, z: 8 }); const tele = ev.find(x => x.kind === 'telegraph');
    if (!tele || tele.kind !== 'telegraph' || tele.shape.type !== 'line') throw new Error('no line');
    const s = tele.shape, side = { x: s.x + s.dz * (s.width / 2 + 0.6), z: s.z - s.dx * (s.width / 2 + 0.6) };
    expect(shapeHits(s, side, 0.3)).toBe(false);
    expect(ENEMY_DEFS.gull.telegraphTime * 0.75 * 4.2).toBeGreaterThan(s.width / 2 + 0.3);   // the warning is long enough to step clear of the line
  });
});

describe('tidecaller heron', () => {
  it('is a boss with three readable attacks, a second phase, and an exposed chest while it preens', () => {
    const d = ENEMY_DEFS.heron; expect(d.boss).toBe(true); expect(d.interruptible).toBe(false); expect(d.attacks).toEqual(['waterSpout', 'wingSweep', 'tidalRing']);
    expect(d.attacks2).toEqual(['waterSpout', 'wingSweep', 'waterSpout', 'tidalRing']); expect(d.weakWhileRecover).toBe(2); expect(d.phaseAt).toBe(0.5); expect(d.maxHp).toBe(32);
  });
  it('counts blows double while it recovers and not otherwise', () => {
    const e = new Enemy('heron', { x: 0, z: 0 }); let ev = e.takeDamage(1, 1, { x: 0, z: 3 }); expect(e.hp).toBe(31); expect(ev[0]).toMatchObject({ kind: 'hit' }); expect((ev[0] as { weak?: boolean }).weak).toBeUndefined();
    (e as unknown as { state: string }).state = 'recover'; ev = e.takeDamage(1, 2, { x: 0, z: 3 }); expect(e.hp).toBe(29); expect((ev[0] as { weak?: boolean }).weak).toBe(true);
  });
  it('drops a water spout where the hero STANDS, a long line for the wing sweep and a ring round itself', () => {
    const shapes = new Map<string, unknown>(); const e = new Enemy('heron', { x: 0, z: 0 });
    for (let k = 0; k < 40 && shapes.size < 3; k++) { for (const ev of run(e, 1, { x: 3 + k * 0.1, z: 4 })) if (ev.kind === 'telegraph') shapes.set(ev.attack, ev.shape); }
    const spout = shapes.get('waterSpout') as { type: string; r: number; x: number }, sweep = shapes.get('wingSweep') as { type: string; length: number }, ring = shapes.get('tidalRing') as { type: string; r: number; x: number; z: number };
    expect(spout.type).toBe('circle'); expect(spout.x).toBeGreaterThan(2.9); expect(sweep.type).toBe('line'); expect(sweep.length).toBeGreaterThan(10); expect(ring.type).toBe('circle'); expect(ring.r).toBeGreaterThan(5);
  });
  it('can be beaten by a hero who steps out of every warning (a scripted player takes no hits and finishes it)', () => {
    const e = new Enemy('heron', { x: 0, z: 0 }), p = { x: 0, z: 6 }; let hits = 0, t = 0, id = 100, swingAt = 0;
    const warn: { shape: Parameters<typeof shapeHits>[0]; until: number }[] = [];
    while (!e.defeated && t < 120) {
      for (const ev of e.update(1 / 60, p)) { if (ev.kind === 'telegraph') warn.push({ shape: ev.shape, until: t + ev.duration }); if (ev.kind === 'strike' && shapeHits(ev.shape, p, 0.3)) hits++; }
      // the hero steps out of any shape that is winding up, at 75 percent of a 4.2 m/s run, then walks back and swings when the heron recovers
      const live = warn.filter(w => w.until > t - 0.1);
      const danger = live.find(w => shapeHits(w.shape, p, 0.6));
      if (danger) {
        const sh = danger.shape; let dx: number, dz: number;
        if (sh.type === 'circle') { dx = p.x - sh.x; dz = p.z - sh.z; if (Math.hypot(dx, dz) < 1e-3) { dx = 1; dz = 0; } }
        else { const side = (p.x - sh.x) * -sh.dz + (p.z - sh.z) * sh.dx; const sg = side >= 0 ? 1 : -1; dx = -sh.dz * sg; dz = sh.dx * sg; }
        const d = Math.hypot(dx, dz) || 1; p.x += (dx / d) * 4.2 * 0.75 / 60; p.z += (dz / d) * 4.2 * 0.75 / 60;
      }
      else {
        const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz) || 1, sp = 4.2 / 60;
        if (e.state === 'recover' && e.t < 1.3) { if (d > 1.9) { p.x += (dx / d) * sp; p.z += (dz / d) * sp; } else if (t - swingAt > 0.45) { swingAt = t; e.takeDamage(1, id++, { x: p.x, z: p.z }); } }   // dash in and strike while it preens
        else if (d < 6.5) { p.x -= (dx / d) * sp; p.z -= (dz / d) * sp; }                                                                                                                    // then back off to a safe distance
        else if (d > 8.5) { p.x += (dx / d) * sp; p.z += (dz / d) * sp; }
      }
      t += 1 / 60;
    }
    expect(e.defeated, `still alive after ${t}s with ${e.hp} hp`).toBe(true); expect(hits).toBe(0);
  });
});
