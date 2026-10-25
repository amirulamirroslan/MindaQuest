import { describe, expect, it } from 'vitest';
import { ColliderGrid, isClear } from './colliders';
import { ANCIENT_TREE_POS, FAIRY_RING_POS, POND_POS, ARENA_ENTRANCE, BOSS_POS, ELDER_POS, MOONLIT_GATE_TRIGGER, PETAL_SPOTS, RUNE_STONE_POS, RUNE_STONE_RANGE, SPAWN, SPROUT_SPOTS, buildWorldLayout, mustReach } from './layout3d';
import { PETALS_NEEDED, SPROUTS_NEEDED } from './woodsQuest';
import { PLAY_RADIUS, heightAt } from './worldShape';

const layout = buildWorldLayout();
const grid = new ColliderGrid(layout.colliders);
const HERO_R = 0.45;

describe('world layout', () => {
  it('is deterministic', () => {
    const again = buildWorldLayout();
    expect(again.trees.length).toBe(layout.trees.length);
    expect(again.trees[10]).toEqual(layout.trees[10]);
  });
  it('has enough petals and sprouts for the quest, plus spares for petals', () => {
    expect(PETAL_SPOTS.length).toBeGreaterThan(PETALS_NEEDED);
    expect(SPROUT_SPOTS.length).toBeGreaterThanOrEqual(SPROUTS_NEEDED);
  });
  it('builds a real forest', () => {
    expect(layout.trees.length).toBeGreaterThan(250);
    expect(layout.pillars.length).toBeGreaterThan(8);
  });
  it('starts the hero, the Elder, petals, sprouts and the boss in open ground', () => {
    for (const p of [SPAWN, ELDER_POS, BOSS_POS, ...PETAL_SPOTS, ...SPROUT_SPOTS]) {
      // the Elder stands on her own collider; test a point beside her
      const q = p === ELDER_POS ? { x: p.x - 1.4, z: p.z + 0.6 } : p;
      expect(isClear(grid, q.x, q.z, HERO_R), JSON.stringify(p)).toBe(true);
    }
  });
  it('lets the hero walk from the start to everything that matters', () => {
    const res = 0.5, half = Math.ceil(PLAY_RADIUS / res), size = half * 2 + 1;
    const idx = (ix: number, iz: number) => iz * size + ix;
    const toCell = (v: number) => Math.round(v / res) + half;
    const open = new Uint8Array(size * size);
    for (let iz = 0; iz < size; iz++) for (let ix = 0; ix < size; ix++) {
      const x = (ix - half) * res, z = (iz - half) * res;
      if (Math.hypot(x, z) <= PLAY_RADIUS && isClear(grid, x, z, HERO_R)) open[idx(ix, iz)] = 1;
    }
    const seen = new Uint8Array(size * size);
    const stack = [idx(toCell(SPAWN.x), toCell(SPAWN.z))];
    seen[stack[0]] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % size, cz = Math.floor(c / size);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const n = idx(nx, nz);
        if (open[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    for (const t of mustReach()) expect(seen[idx(toCell(t.p.x), toCell(t.p.z))], t.name).toBe(1);
  });
  it('keeps the arena entrance wide enough for the hero', () => {
    for (let dx = -1.5; dx <= 1.5; dx += 0.5) expect(isClear(grid, ARENA_ENTRANCE.x + dx, ARENA_ENTRANCE.z - 6, HERO_R)).toBe(true);
  });
  it('has flat ground for the village and the ruins', () => {
    expect(heightAt(SPAWN.x, SPAWN.z)).toBeCloseTo(0, 5);
    expect(heightAt(BOSS_POS.x, BOSS_POS.z)).toBeCloseTo(0, 5);
    expect(heightAt(MOONLIT_GATE_TRIGGER.x, MOONLIT_GATE_TRIGGER.z)).toBeCloseTo(0, 1);
  });
  it('puts the Rune Stone beside the trail end, solid, with open ground to stand in front of it', () => {
    expect(isClear(grid, RUNE_STONE_POS.x, RUNE_STONE_POS.z, HERO_R)).toBe(false); // solid: the hero cannot walk through it
    const toTrail = Math.hypot(RUNE_STONE_POS.x - ARENA_ENTRANCE.x, RUNE_STONE_POS.z - ARENA_ENTRANCE.z);
    expect(toTrail).toBeLessThan(6); expect(toTrail).toBeGreaterThan(2.5); // visible from the trail end, not in the way of it
    // somewhere a hero can stand and still be in range, on every side of the stone that faces the trail
    let standable = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { const x = RUNE_STONE_POS.x + Math.sin(a) * 1.9, z = RUNE_STONE_POS.z + Math.cos(a) * 1.9; if (isClear(grid, x, z, HERO_R)) standable++; }
    expect(standable).toBeGreaterThanOrEqual(10); expect(1.9).toBeLessThan(RUNE_STONE_RANGE);
    expect(heightAt(RUNE_STONE_POS.x, RUNE_STONE_POS.z)).toBeLessThan(0.6);
  });
  it('rises into hills at the rim', () => { expect(heightAt(0, 44)).toBeGreaterThan(3); });
  it('keeps the points of interest clear of trees and out of the way of the quest', () => {
    const layout = buildWorldLayout();
    for (const p of [ANCIENT_TREE_POS, POND_POS, FAIRY_RING_POS]) for (const t of layout.trees) expect(Math.hypot(t.x - p.x, t.z - p.z)).toBeGreaterThan(2.5);
    expect(layout.fairyRing.length).toBeGreaterThan(5);
    expect(new Set(layout.trees.map(t => t.kind))).toEqual(new Set(['oak', 'pine', 'birch']));
  });
  it('plants twisted dead trees as solid landmarks away from the trail, the quest spots and the village (v2.6)', () => {
    expect(layout.deadTrees.length).toBeGreaterThanOrEqual(8);
    for (const t of layout.deadTrees) {
      expect(isClear(grid, t.x, t.z, HERO_R)).toBe(false); // solid
      expect(Math.hypot(t.x, t.z)).toBeLessThan(PLAY_RADIUS);
      for (const p of [SPAWN, ELDER_POS, ...PETAL_SPOTS, ...SPROUT_SPOTS]) expect(Math.hypot(t.x - p.x, t.z - p.z)).toBeGreaterThan(2);
    }
    expect(new Set(layout.deadTrees.map(t => t.variant)).size).toBeGreaterThan(1);
  });
  it('keeps the earlier layout unchanged by the v2.6 additions (same trees as before)', () => {
    expect(layout.trees.length).toBeGreaterThan(250);
    expect(layout.trees[0]).toEqual(buildWorldLayout().trees[0]);
  });
});
