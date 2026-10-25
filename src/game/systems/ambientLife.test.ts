import { describe, expect, it } from 'vitest';
import { seededRandom } from './forestLayout';
import { BUTTERFLY_RANGE, BUTTERFLY_SHY, fishArc, isOutside, planFlock, spawnLeaf, stepButterfly, stepLeaf, type Flutterer, type ViewRect } from './ambientLife';

const VIEW: ViewRect = { x: 400, y: 200, width: 500, height: 320 };

describe('drifting leaves', () => {
  it('start inside the view when scattered, and at the upwind edge when recycled', () => {
    const rng = seededRandom(3);
    for (let i = 0; i < 50; i++) {
      const a = spawnLeaf(rng, VIEW, true);
      expect(a.x).toBeGreaterThanOrEqual(VIEW.x); expect(a.x).toBeLessThanOrEqual(VIEW.x + VIEW.width);
      expect(a.y).toBeGreaterThanOrEqual(VIEW.y); expect(a.y).toBeLessThanOrEqual(VIEW.y + VIEW.height);
      const b = spawnLeaf(rng, VIEW, false);
      expect(b.x < VIEW.x + 1 || b.y < VIEW.y + 1).toBe(true);
    }
  });
  it('fall and drift downwind, and eventually leave the view so they can be recycled', () => {
    const leaf = spawnLeaf(seededRandom(9), VIEW, true);
    const startY = leaf.y;
    let left = false;
    for (let i = 0; i < 60 * 40 && !left; i++) { stepLeaf(leaf, 1 / 60, 0.2, i / 60); left = isOutside(leaf.x, leaf.y, VIEW); }
    expect(left).toBe(true);
    expect(leaf.y).toBeGreaterThan(startY);
  });
  it('are pushed harder by a stronger wind', () => {
    const calm = { ...spawnLeaf(seededRandom(1), VIEW, true) }, gusty = { ...calm };
    for (let i = 0; i < 60; i++) { stepLeaf(calm, 1 / 60, -1, i / 60); stepLeaf(gusty, 1 / 60, 1, i / 60); }
    expect(gusty.x).toBeGreaterThan(calm.x);
  });
});

describe('bird flocks', () => {
  it('enter from just outside one edge and head across the view', () => {
    for (let seed = 1; seed < 40; seed++) {
      const plan = planFlock(seededRandom(seed), VIEW);
      expect(plan.members.length).toBeGreaterThanOrEqual(2);
      expect(plan.members.length).toBeLessThanOrEqual(4);
      if (plan.dir === 1) expect(plan.start.x).toBeLessThan(VIEW.x); else expect(plan.start.x).toBeGreaterThan(VIEW.x + VIEW.width);
      expect(plan.start.y).toBeGreaterThanOrEqual(VIEW.y); expect(plan.start.y).toBeLessThanOrEqual(VIEW.y + VIEW.height);
      expect(plan.speed).toBeGreaterThan(40);
      for (const m of plan.members) expect(Math.sign(m.dx) === -plan.dir || m.dx === 0).toBe(true);
    }
  });
});

describe('butterflies', () => {
  const make = (): Flutterer => ({ x: 500, y: 500, goalX: 500, goalY: 500, homeX: 500, homeY: 500, retarget: 0, speed: 22, phase: 0 });
  it('wander around their home patch without straying far', () => {
    const b = make(), rng = seededRandom(7), far = { x: 5000, y: 5000 };
    let maxDist = 0, moved = 0, last = { x: b.x, y: b.y };
    for (let i = 0; i < 60 * 120; i++) {
      stepButterfly(b, 1 / 60, rng, far);
      maxDist = Math.max(maxDist, Math.hypot(b.x - b.homeX, b.y - b.homeY));
      moved += Math.hypot(b.x - last.x, b.y - last.y); last = { x: b.x, y: b.y };
    }
    expect(maxDist).toBeLessThanOrEqual(BUTTERFLY_RANGE + 1);
    expect(moved).toBeGreaterThan(300);
  });
  it('dart away when the hero comes close', () => {
    const b = make(), rng = seededRandom(2), hero = { x: 480, y: 500 };
    const before = Math.hypot(b.x - hero.x, b.y - hero.y);
    expect(before).toBeLessThan(BUTTERFLY_SHY);
    for (let i = 0; i < 30; i++) stepButterfly(b, 1 / 60, rng, hero);
    expect(Math.hypot(b.x - hero.x, b.y - hero.y)).toBeGreaterThan(before + 10);
  });
  it('never produce NaN, even when standing exactly on the hero', () => {
    const b = make(), rng = seededRandom(5);
    for (let i = 0; i < 100; i++) stepButterfly(b, 1 / 60, rng, { x: b.x, y: b.y });
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
  });
});

describe('fish leaps', () => {
  const from = { x: 100, y: 200 }, to = { x: 140, y: 210 };
  it('start and end in the water at the planned points', () => {
    expect(fishArc(0, from, to, 26)).toMatchObject({ x: 100, y: 200 });
    const end = fishArc(1, from, to, 26);
    expect(end.x).toBeCloseTo(140); expect(end.y).toBeCloseTo(210);
  });
  it('rise by the arc height in the middle and are above the water the whole way', () => {
    const mid = fishArc(0.5, from, to, 26);
    expect(mid.y).toBeCloseTo(205 - 26);
    for (let t = 0.05; t < 0.96; t += 0.05) expect(fishArc(t, from, to, 26).y).toBeLessThan(Math.max(from.y, to.y));
  });
  it('tilt the nose up while rising and down while falling, whichever way the fish faces', () => {
    expect(fishArc(0.15, from, to, 26).rotation).toBeLessThan(0);
    expect(fishArc(0.85, from, to, 26).rotation).toBeGreaterThan(0);
    const left = { x: 60, y: 210 };
    expect(fishArc(0.15, from, left, 26).rotation).toBeGreaterThan(0);
    expect(fishArc(0.85, from, left, 26).rotation).toBeLessThan(0);
  });
});
