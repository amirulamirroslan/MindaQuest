import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, Enemy, shapeHits, type EnemyEvent, type EnemyKind } from './enemies';
import { RUN_SPEED_3D } from './movement3d';
import { COMBAT } from './combat';

const step = (e: Enemy, player: { x: number; z: number }, seconds: number, dt = 1 / 60): EnemyEvent[] => { const ev: EnemyEvent[] = []; for (let t = 0; t < seconds; t += dt) ev.push(...e.update(dt, player)); return ev; };

describe('Enemy', () => {
  it('stays idle out of range, chases when the player comes close', () => {
    const e = new Enemy('sprout', { x: 0, z: 0 });
    step(e, { x: 40, z: 0 }, 1); expect(e.state).toBe('idle');
    step(e, { x: 5, z: 0 }, 0.1); expect(['chase', 'telegraph']).toContain(e.state);
  });
  it('always telegraphs before it strikes, and the warning lasts long enough to react', () => {
    const e = new Enemy('sprout', { x: 0, z: 0 });
    const ev = step(e, { x: 1, z: 0 }, 3);
    const t = ev.findIndex((x) => x.kind === 'telegraph'), s = ev.findIndex((x) => x.kind === 'strike');
    expect(t).toBeGreaterThanOrEqual(0); expect(s).toBeGreaterThan(t);
    const tel = ev[t] as Extract<EnemyEvent, { kind: 'telegraph' }>; expect(tel.duration).toBeGreaterThanOrEqual(0.7);
  });
  it('a swing counts once however many times it is applied, and three hits calm a sprout', () => {
    const e = new Enemy('sprout', { x: 0, z: 0 });
    e.takeDamage(1, 1); e.takeDamage(1, 1); e.takeDamage(1, 1);
    expect(e.hp).toBe(2);
    e.takeDamage(1, 2); const ev = e.takeDamage(1, 3);
    expect(e.defeated).toBe(true); expect(ev.some((x) => x.kind === 'defeated')).toBe(true);
    expect(e.takeDamage(1, 4)).toEqual([]);
    expect(step(e, { x: 0, z: 0 }, 1)).toEqual([]);
  });
  it('a hit interrupts a sprout mid-telegraph but not the boss', () => {
    const s = new Enemy('sprout', { x: 0, z: 0 }); step(s, { x: 1, z: 0 }, 0.4); expect(s.state).toBe('telegraph'); s.takeDamage(1, 1); expect(s.state).toBe('recover');
    const b = new Enemy('mossback', { x: 0, z: 0 }); step(b, { x: 2, z: 0 }, 0.6); expect(b.state).toBe('telegraph'); b.takeDamage(1, 1); expect(b.state).toBe('telegraph');
  });
  it('boss cycles slam -> charge -> sporeRing, enters phase 2 at half health, and can be defeated', () => {
    const b = new Enemy('mossback', { x: 0, z: 0 });
    const ev = step(b, { x: 3, z: 0 }, 25);
    const attacks = ev.filter((x): x is Extract<EnemyEvent, { kind: 'telegraph' }> => x.kind === 'telegraph').map((x) => x.attack);
    expect(attacks.slice(0, 4)).toEqual(['slam', 'charge', 'sporeRing', 'slam']);
    let id = 100; const phases: number[] = [];
    while (!b.defeated && id < 140) for (const x of b.takeDamage(1, id++)) if (x.kind === 'phase') phases.push(x.phase);
    expect(phases).toEqual([2]); expect(b.defeated).toBe(true);
  });
  it('shapes: strike hits only what was inside the telegraph', () => {
    expect(shapeHits({ type: 'circle', x: 0, z: 0, r: 2 }, { x: 1.5, z: 0 })).toBe(true);
    expect(shapeHits({ type: 'circle', x: 0, z: 0, r: 2 }, { x: 4, z: 0 })).toBe(false);
    const line = { type: 'line' as const, x: 0, z: 0, dx: 0, dz: 1, length: 5, width: 2 };
    expect(shapeHits(line, { x: 0.5, z: 3 })).toBe(true); expect(shapeHits(line, { x: 3, z: 3 })).toBe(false); expect(shapeHits(line, { x: 0, z: -3 })).toBe(false);
  });
});

type Tele = Extract<EnemyEvent, { kind: 'telegraph' }>;
const telegraphs = (ev: EnemyEvent[]): Tele[] => ev.filter((x): x is Tele => x.kind === 'telegraph');
const hurt = (e: Enemy, n: number, id0 = 1000): void => { for (let i = 0; i < n; i++) e.takeDamage(1, id0 + i); };

describe('Shardling (Crystal Hollow)', () => {
  it('gives fair warning, then rolls along the line it warned about', () => {
    const e = new Enemy('shardling', { x: 0, z: 0 });
    const ev = step(e, { x: 0, z: 3.5 }, 4);
    const tel = telegraphs(ev)[0]; expect(tel.attack).toBe('roll'); expect(tel.duration).toBeGreaterThanOrEqual(0.7); expect(tel.shape.type).toBe('line');
    const strike = ev.find(x => x.kind === 'strike'); expect(strike).toBeDefined();
    // it stays where it is while it winds up, and travels 3 to 4 metres along the locked line afterwards
    const e2 = new Enemy('shardling', { x: 0, z: 0 }); const t2 = telegraphs(step(e2, { x: 0, z: 4 }, 0.3))[0]; const start = { ...e2.pos };
    expect(e2.state).toBe('telegraph'); step(e2, { x: 6, z: 0 }, 0.3); expect(e2.pos).toEqual(start); // the hero ran off to the side but the wind-up held its ground and its aim (t = 0.6 s of 0.8 s)
    step(e2, { x: 6, z: 0 }, 1.1);
    const travelled = Math.hypot(e2.pos.x - start.x, e2.pos.z - start.z); expect(travelled).toBeGreaterThan(2.5); expect(travelled).toBeLessThan((t2.shape as { length: number }).length);
    expect(Math.abs(e2.pos.x - start.x)).toBeLessThan(0.05); // along z only: the original direction
  });
  it('is interrupted by a blow during the wind-up, takes four blows, and is harmless once calm', () => {
    const e = new Enemy('shardling', { x: 0, z: 0 }); step(e, { x: 0, z: 3 }, 0.4); expect(e.state).toBe('telegraph'); e.takeDamage(1, 1); expect(e.state).toBe('recover');
    hurt(e, 2, 10); expect(e.defeated).toBe(false); const ev = e.takeDamage(1, 99); expect(ev.some(x => x.kind === 'defeated')).toBe(true); expect(step(e, { x: 0, z: 1 }, 2)).toEqual([]);
  });
  it('reports when it is rolling, so touching it hurts only then', () => {
    const e = new Enemy('shardling', { x: 0, z: 0 }); expect(e.dashing).toBe(false);
    const seen: boolean[] = []; for (let t = 0; t < 3; t += 1 / 60) { e.update(1 / 60, { x: 0, z: 3.5 }); seen.push(e.dashing); }
    expect(seen.some(Boolean)).toBe(true); expect(seen[0]).toBe(false);
  });
  it('wanders back to its nest when the hero goes away, and keeps the tag the scene gave it', () => {
    const e = new Enemy('shardling', { x: 10, z: 10 }); e.tag = 4; step(e, { x: 10, z: 13 }, 1.5); expect(e.pos.z).toBeGreaterThan(10.4);
    step(e, { x: 80, z: 80 }, 12); expect(Math.hypot(e.pos.x - 10, e.pos.z - 10)).toBeLessThan(0.5); expect(e.tag).toBe(4);
  });
});

describe('Hollow Warden (boss)', () => {
  it('runs rain -> beam -> ring in phase one and shows both rains in phase two, announcing the phase once at half health', () => {
    const e = new Enemy('warden', { x: 0, z: 0 });
    const first = telegraphs(step(e, { x: 4, z: 0 }, 40)).map(t => t.attack); expect(first.slice(0, 4)).toEqual(['shardRain', 'prismBeam', 'novaRing', 'shardRain']);
    const phases: number[] = []; let id = 100; while (e.hp > 15 && id < 140) for (const x of e.takeDamage(1, id++)) if (x.kind === 'phase') phases.push(x.phase);
    expect(phases).toEqual([2]); expect(e.phase).toBe(2); expect(e.def.attacks2!.filter(a => a === 'shardRain')).toHaveLength(2);
    const later = telegraphs(step(e, { x: 4, z: 0 }, 60)).map(t => t.attack); expect(later.length).toBeGreaterThan(8);
    for (const a of ['shardRain', 'prismBeam', 'novaRing']) expect(later).toContain(a);
  });
  it('aims the rain at where the hero stands, locks the beam, and rings itself', () => {
    const e = new Enemy('warden', { x: 0, z: 0 }); const rain = telegraphs(step(e, { x: 3, z: 4 }, 1))[0];
    expect(rain.attack).toBe('shardRain'); expect(rain.shape).toEqual({ type: 'circle', x: 3, z: 4, r: 2.3 });
    let beam: Tele | undefined; const lockedAt = { h: 0 };
    for (let t = 0; t < 12 && !beam; t += 1 / 60) { const b = telegraphs(e.update(1 / 60, { x: 0, z: 6 })); if (b.length && b[0].attack === 'prismBeam') { beam = b[0]; lockedAt.h = e.heading; } }
    expect(beam!.shape.type).toBe('line'); expect((beam!.shape as { width: number }).width).toBeLessThan(2.2);
    step(e, { x: 6, z: 0 }, 0.6); expect(e.heading).toBeCloseTo(lockedAt.h, 6); // the hero ran round it, the aim did not follow
    let ring: Tele | undefined; for (let t = 0; t < 12 && !ring; t += 1 / 60) { const r = telegraphs(e.update(1 / 60, { x: 3, z: 0 })); if (r.length && r[0].attack === 'novaRing') ring = r[0]; }
    expect(ring!.shape).toMatchObject({ type: 'circle', x: e.pos.x, z: e.pos.z });
  });
  it('is never interrupted, but a recovering Warden has its heart exposed and every blow counts double', () => {
    const e = new Enemy('warden', { x: 0, z: 0 }); step(e, { x: 3, z: 0 }, 0.5); expect(e.state).toBe('telegraph'); e.takeDamage(1, 1); expect(e.state).toBe('telegraph'); expect(e.hp).toBe(29);
    while (e.state !== 'recover') e.update(1 / 60, { x: 3, z: 0 });
    expect(e.exposed).toBe(true); const hp = e.hp, ev = e.takeDamage(1, 2); expect(e.hp).toBe(hp - 2); expect(ev[0]).toMatchObject({ kind: 'hit', weak: true });
    while (e.state === 'recover') e.update(1 / 60, { x: 3, z: 0 }); expect(e.exposed).toBe(false);
    const hp2 = e.hp, ev2 = e.takeDamage(1, 3); expect(e.hp).toBe(hp2 - 1); expect((ev2[0] as { weak?: boolean }).weak).toBeUndefined();
    expect(ENEMY_DEFS.sprout.weakWhileRecover).toBeUndefined(); expect(ENEMY_DEFS.mossback.weakWhileRecover).toBeUndefined(); // the woods are untouched
  });
  it('a swing is still counted once, and the finishing blow ends the fight', () => {
    const e = new Enemy('warden', { x: 0, z: 0 }); e.takeDamage(1, 5); e.takeDamage(1, 5); expect(e.hp).toBe(29);
    const ev = e.takeDamage(99, 6); expect(ev.some(x => x.kind === 'defeated')).toBe(true); expect(e.defeated).toBe(true);
  });
});

describe('fairness of every new telegraph', () => {
  /** The hero starts anywhere the attack can begin; to be safe they must reach the edge of the shape (plus the strike's body margin) at run speed with a quarter of the time to spare. */
  const kinds: EnemyKind[] = ['shardling', 'warden'];
  for (const kind of kinds) for (const phase2 of [false, true]) it(`${kind}${phase2 ? ' (phase 2)' : ''}: the hero can always step out in time`, () => {
    for (const startDist of [1.8, 2.6, 3.5, 4.5, 5, 6, 8, 9.5]) for (const angle of [0, 1.1, 2.4, 4]) {
      const e = new Enemy(kind, { x: 0, z: 0 }); if (phase2 && e.def.phaseAt !== undefined) hurt(e, Math.ceil(e.def.maxHp / 2) + 1);
      const hero = { x: Math.sin(angle) * startDist, z: Math.cos(angle) * startDist };
      const tele = telegraphs(step(e, hero, 8))[0]; if (!tele) continue;
      const s = tele.shape; let need: number;
      if (s.type === 'circle') need = Math.max(0, s.r + 0.3 + 0.1 - Math.hypot(hero.x - s.x, hero.z - s.z));
      else { const across = Math.abs((hero.x - s.x) * -s.dz + (hero.z - s.z) * s.dx); need = Math.max(0, s.width / 2 + 0.3 + 0.1 - across); }
      expect(need / tele.duration, `${tele.attack} from ${startDist} at ${angle}`).toBeLessThan(RUN_SPEED_3D * 0.75);
    }
  });
});

describe('a scripted hero can beat the Hollow Warden', () => {
  /** A simple bot: steps out of every warning, otherwise walks up to the boss and swings once every swing-time while it is recovering. Checks length and fairness of the pattern. */
  function fight(skill: 'dodges' | 'stands'): { won: boolean; seconds: number; hits: number; weakBlows: number } {
    const e = new Enemy('warden', { x: 0, z: 0 }), hero = { x: 0, z: 7 }; let seconds = 0, hits = 0, weak = 0, swingAt = 0, id = 1, escape: { x: number; z: number; until: number } | null = null; const dt = 1 / 60;
    while (!e.defeated && seconds < 240) {
      seconds += dt;
      for (const ev of e.update(dt, hero)) {
        if (ev.kind === 'telegraph' && skill === 'dodges') {
          const s = ev.shape; let dx: number, dz: number, need: number;
          if (s.type === 'circle') { const d0 = Math.hypot(hero.x - s.x, hero.z - s.z), d = d0 || 1; dx = (hero.x - s.x) / d || 1; dz = (hero.z - s.z) / d; need = s.r + 0.6 - d0; }
          else { const across = (hero.x - s.x) * -s.dz + (hero.z - s.z) * s.dx, sg = across >= 0 ? 1 : -1; dx = -s.dz * sg; dz = s.dx * sg; need = s.width / 2 + 0.6 - Math.abs(across); }
          escape = need > 0 ? { x: dx, z: dz, until: seconds + need / RUN_SPEED_3D + 0.02 } : null;
        }
        if (ev.kind === 'strike' && shapeHits(ev.shape, hero, 0.3)) hits++;
      }
      if (escape && seconds < escape.until) { hero.x += escape.x * RUN_SPEED_3D * dt; hero.z += escape.z * RUN_SPEED_3D * dt; }
      else { escape = null; const d = Math.hypot(e.pos.x - hero.x, e.pos.z - hero.z), want = 2.2 + e.def.radius * 0.5; if (d > want && e.state !== 'telegraph' && e.state !== 'strike') { hero.x += ((e.pos.x - hero.x) / d) * 4 * dt; hero.z += ((e.pos.z - hero.z) / d) * 4 * dt; } }
      const near = Math.hypot(e.pos.x - hero.x, e.pos.z - hero.z) <= COMBAT.attackRange + e.def.radius * 0.9;
      if (seconds >= swingAt && near && (skill === 'stands' || e.state === 'recover')) { swingAt = seconds + COMBAT.attackDuration; const before = e.hp; e.takeDamage(COMBAT.attackDamage, id++); if (before - e.hp > COMBAT.attackDamage) weak++; }
    }
    return { won: e.defeated, seconds, hits, weakBlows: weak };
  }
  it('a hero who steps out of every warning wins in well under two minutes, using the weak spot, and is never struck', () => {
    const r = fight('dodges'); expect(r.won).toBe(true); expect(r.seconds).toBeLessThan(120); expect(r.seconds).toBeGreaterThan(14); expect(r.weakBlows).toBeGreaterThan(3);
    expect(r.hits).toBe(0); // every warning is escapable at run speed
  });
  it('a hero who just stands and swings loses hearts, so the telegraphs matter (and the fight is not trivial)', () => {
    const r = fight('stands'); expect(r.hits).toBeGreaterThanOrEqual(3);
  });
});
