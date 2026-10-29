import { describe, expect, it } from 'vitest';
import { ColliderGrid, isClear } from './colliders';
import { MOONLIT_GATE_POS, SPAWN, buildWorldLayout, mustReach } from './layout3d';
import {
  ACORN_SPOTS, CHEST_SPOTS, LANTERN_SPOTS, MIST_GATE, PASSES, PEARL_SPOTS, PEOPLE, PUMPKIN_SPOTS, REGIONS, SIGN_SPOTS, TABLET_SPOTS, THORNS, UNDERCROFT_DOOR, ZONES, expansionMustReach,
} from './expansion';
import { CLEARINGS, PATHS, distToPaths } from './expansionShape';
import { LEGACY_PLAY_RADIUS, LEGACY_WORLD_RADIUS, PLAY_RADIUS, WORLD_RADIUS, heightAt } from './worldShape';

const hs = (a: { x: number; z: number }[]): number => { let h = 0; for (const t of a) h = (h * 31 + Math.round(t.x * 100) * 7 + Math.round(t.z * 100)) | 0; return h; };
const layout = buildWorldLayout();
const grid = new ColliderGrid(layout.colliders);
const HERO = 0.45;

describe('world dimensions (v2.31)', () => {
  it('is much bigger than the old woods', () => {
    expect(LEGACY_PLAY_RADIUS).toBe(41); expect(LEGACY_WORLD_RADIUS).toBe(46);
    expect(PLAY_RADIUS).toBe(96); expect(WORLD_RADIUS).toBe(102);
    expect((PLAY_RADIUS / LEGACY_PLAY_RADIUS) ** 2).toBeGreaterThan(5);
  });
  it('keeps every zone, landmark and structure inside the walkable circle', () => {
    for (const z of ZONES) expect(Math.hypot(z.x, z.z) + z.r * 0.3).toBeLessThan(PLAY_RADIUS);
    for (const c of CHEST_SPOTS) expect(Math.hypot(c.x, c.z)).toBeLessThan(PLAY_RADIUS - 3);
    for (const p of [...ACORN_SPOTS, ...PUMPKIN_SPOTS, ...PEARL_SPOTS, ...LANTERN_SPOTS, ...TABLET_SPOTS]) expect(Math.hypot(p.x, p.z)).toBeLessThan(PLAY_RADIUS - 3);
  });
  it('has a finite, gently sloped ground everywhere, and no steep step along any path', () => {
    for (let x = -100; x <= 100; x += 4) for (let z = -100; z <= 100; z += 4) expect(Number.isFinite(heightAt(x, z))).toBe(true);
    for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const h0 = heightAt(a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0), h1 = heightAt(a.x + (b.x - a.x) * t1, a.z + (b.z - a.z) * t1); expect(Math.abs(h1 - h0)).toBeLessThan(0.9); }
    }
  });
  it('flattens every clearing', () => { for (const c of CLEARINGS) expect(Math.abs(heightAt(c.x, c.z))).toBeLessThan(0.5 + (c.id === 'mirror-shore' ? 0.4 : 0)); });
});

describe('the original glade is untouched', () => {
  const legacy = buildWorldLayout(20260, false);
  it('still generates exactly the v2.30 glade (same trees, rocks, plants and colliders)', () => {
    const inner = (a: { x: number; z: number }[]) => a.filter(t => Math.hypot(t.x, t.z) < 30);
    expect(legacy.trees).toHaveLength(405); expect(hs(inner(legacy.trees))).toBe(-661058647); expect(inner(legacy.trees)).toHaveLength(86);
    expect(hs(inner(legacy.rocks))).toBe(716650518); expect(hs(inner(legacy.deadTrees))).toBe(-110318764);
    expect(hs(legacy.flowers)).toBe(-211510217); expect(hs(legacy.bushes)).toBe(930865425); expect(hs(legacy.ferns)).toBe(-1266312715); expect(hs(legacy.mushrooms)).toBe(1441861752);
    expect(hs(legacy.colliders.filter(c => Math.hypot(c.x, c.z) < 30))).toBe(1986946635); expect(legacy.colliders).toHaveLength(553);
  });
  it('keeps every original tree, rock, plant and collider except those standing in a new path', () => {
    const key = (o: { x: number; z: number }) => `${o.x},${o.z}`;
    const keptTrees = new Set(layout.trees.map(key)), keptRocks = new Set(layout.rocks.map(key)), keptDead = new Set(layout.deadTrees.map(key)), keptCol = new Set(layout.colliders.map(key));
    let removed = 0;
    for (const t of legacy.trees) if (!keptTrees.has(key(t))) { removed++; expect(distToPaths(t.x, t.z), 'tree').toBeLessThan(6); }
    for (const t of legacy.rocks) if (!keptRocks.has(key(t))) { removed++; expect(distToPaths(t.x, t.z), 'rock').toBeLessThan(8); }
    for (const t of legacy.deadTrees) if (!keptDead.has(key(t))) { removed++; expect(distToPaths(t.x, t.z), 'dead tree').toBeLessThan(6); }
    for (const c of legacy.colliders) if (!keptCol.has(key(c))) expect(distToPaths(c.x, c.z), 'collider').toBeLessThan(8);
    expect(removed).toBeLessThan(130);
    // nothing of the original quest world is touched: the village, ruins, pond, camp, elder, petals and sprout spots keep all their colliders
    for (const c of legacy.colliders.filter(c => Math.hypot(c.x - 0, c.z - 25) < 11 || Math.hypot(c.x - 0, c.z + 27) < 9)) expect(keptCol.has(key(c)), `collider ${key(c)}`).toBe(true);
    const plants = new Set([...layout.flowers, ...layout.bushes, ...layout.ferns, ...layout.mushrooms].map(key));
    for (const p of [...legacy.flowers, ...legacy.bushes, ...legacy.ferns, ...legacy.mushrooms]) expect(plants.has(key(p))).toBe(true);   // plants are never removed
  });
  it('is deterministic', () => { const b = buildWorldLayout(); expect(b.trees.length).toBe(layout.trees.length); expect(hs(b.trees)).toBe(hs(layout.trees)); });
});

describe('the expanded woods are explorable', () => {
  const res = 0.5, half = Math.ceil(PLAY_RADIUS / res), size = half * 2 + 1;
  const idx = (ix: number, iz: number): number => iz * size + ix, cellOf = (v: number): number => Math.round(v / res) + half;
  function flood(extra: readonly { x: number; z: number; r: number }[]): { seen: Uint8Array; open: Uint8Array } {
    const g = extra.length ? new ColliderGrid([...layout.colliders, ...extra]) : grid;
    const open = new Uint8Array(size * size);
    for (let iz = 0; iz < size; iz++) for (let ix = 0; ix < size; ix++) { const x = (ix - half) * res, z = (iz - half) * res; if (Math.hypot(x, z) <= PLAY_RADIUS && isClear(g, x, z, HERO)) open[idx(ix, iz)] = 1; }
    const seen = new Uint8Array(size * size), st = [idx(cellOf(SPAWN.x), cellOf(SPAWN.z))]; seen[st[0]] = 1;
    while (st.length) { const c = st.pop()!, cx = c % size, cz = (c - cx) / size; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue; const n = idx(nx, nz); if (open[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
    return { seen, open };
  }
  it('lets the hero walk from the spawn to every important place (thorn barrier closed)', () => {
    const { seen } = flood(layout.extras.thorns);
    const bad = mustReach().filter(t => !seen[idx(cellOf(t.p.x), cellOf(t.p.z))]).map(t => t.name);
    expect(bad).toEqual([]);
  });
  it('lets the hero walk to every important place with the thorn barrier open too', () => {
    const { seen } = flood([]);
    expect(mustReach().filter(t => !seen[idx(cellOf(t.p.x), cellOf(t.p.z))]).map(t => t.name)).toEqual([]);
  });
  it('has no large pockets of walkable ground that cannot be reached', () => {
    const { seen, open } = flood(layout.extras.thorns); let total = 0, reach = 0; for (let i = 0; i < open.length; i++) { total += open[i]; reach += seen[i]; }
    expect(reach / total).toBeGreaterThan(0.99);
    // and the walkable ground really is much bigger than before
    expect(reach * res * res).toBeGreaterThan(5281 * 3);
  });
  it('keeps every pickup, chest, person, sign and tablet clear of solid things', () => {
    for (const t of expansionMustReach()) expect(isClear(grid, t.p.x, t.p.z, HERO), t.name).toBe(true);
    for (const s of SIGN_SPOTS) expect(isClear(grid, s.x + 1.2, s.z, HERO), `sign ${s.id}`).toBe(true);
  });
  it('can be walked along every path from end to end', () => {
    for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.0);
      for (let k = 0; k <= n; k++) { const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n; if (!isClear(grid, x, z, HERO) && !isClear(new ColliderGrid(layout.colliders.filter(c => !layout.extras.thorns.some(t => t.x === c.x))), x, z, HERO)) throw new Error(`${p.id} blocked at ${x.toFixed(1)},${z.toFixed(1)}`); }
    }
  });
  it('opens a way through the old rim at every pass, between the arch posts', () => {
    for (const p of PASSES) { expect(isClear(grid, p.at.x, p.at.z, HERO), p.id).toBe(true); expect(distToPaths(p.at.x, p.at.z), p.id).toBeLessThan(2.5); }
  });
  it('seals the Mistfall Gate and the Undercroft door so the hero cannot walk past them', () => {
    const l = Math.hypot(MIST_GATE.x, MIST_GATE.z), bx = MIST_GATE.x + (MIST_GATE.x / l) * 5.4, bz = MIST_GATE.z + (MIST_GATE.z / l) * 5.4;
    expect(isClear(grid, MIST_GATE.x + (MIST_GATE.x / l) * 3.4, MIST_GATE.z + (MIST_GATE.z / l) * 3.4, HERO)).toBe(false); void bx; void bz;
    expect(isClear(grid, UNDERCROFT_DOOR.x, UNDERCROFT_DOOR.z - 1.2, HERO)).toBe(false);
  });
  it('blocks the thorn shortcut only while it is closed', () => {
    expect(isClear(new ColliderGrid(layout.extras.thorns), THORNS.x, THORNS.z, HERO)).toBe(false);
    expect(isClear(grid, THORNS.x, THORNS.z, HERO)).toBe(true);
  });
  it('has dense forest in the Thicket and open ground on the farm', () => {
    const count = (cx: number, cz: number, r: number) => layout.trees.filter(t => Math.hypot(t.x - cx, t.z - cz) < r).length;
    expect(count(-66, 2, 15) / (Math.PI * 225)).toBeGreaterThan(0.03);
    expect(count(0, 76, 14)).toBeLessThan(6 + 16); // orchard rows sit at the edge, the farm itself is open
  });
  it('stays within a sensible object budget', () => { expect(layout.trees.length).toBeLessThan(1500); expect(layout.colliders.length).toBeLessThan(2400); expect(layout.rocks.length).toBeLessThan(450); });
});

describe('the world is laid out for future regions', () => {
  it('lists the built regions at their real gates and the planned ones at real gates with paths', () => {
    const built = REGIONS.filter(r => r.status === 'built'), planned = REGIONS.filter(r => r.status === 'planned');
    expect(built.map(r => r.id)).toEqual(['crystal-hollow', 'moonwake-shore']);
    expect(built[0].gate).toEqual({ x: MOONLIT_GATE_POS.x, z: MOONLIT_GATE_POS.z }); expect(built[1].gate).toEqual({ x: 7.4, z: 19 });
    expect(planned.map(r => r.id)).toContain('mistfall-highlands');
    for (const r of planned) { expect(distToPaths(r.gate.x, r.gate.z) <= 14, r.id).toBe(true); expect(Math.hypot(r.gate.x, r.gate.z)).toBeLessThan(PLAY_RADIUS); }
  });
  it('gives every region name in both languages', () => { for (const r of REGIONS) { expect(r.name.en.length).toBeGreaterThan(2); expect(r.name.ms.length).toBeGreaterThan(2); } });
  it('has people far enough apart', () => { for (const a of PEOPLE) for (const b of PEOPLE) if (a !== b) expect(Math.hypot(a.at.x - b.at.x, a.at.z - b.at.z)).toBeGreaterThan(30); });
});

describe('v2.34 Deeper Woods', () => {
  const ids = ['marsh', 'rise', 'falls'];
  it('adds three zones, the last one hidden, each with its own trail and clearing', () => {
    for (const id of ids) expect(ZONES.find(z => z.id === id), id).toBeTruthy();
    expect(ZONES.find(z => z.id === 'falls')!.hidden).toBe(true); expect(ZONES.find(z => z.id === 'marsh')!.hidden).toBe(false);
    for (const p of ['marsh-trail', 'rise-trail', 'falls-trail']) expect(PATHS.some(q => q.id === p), p).toBe(true);
    for (const c of ['firefly-marsh', 'sunstone-rise', 'whispering-falls']) expect(CLEARINGS.some(q => q.id === c), c).toBe(true);
  });
  it('keeps the old pickup ids: the first 14 acorns and 7 chests are where they were', () => {
    expect(ACORN_SPOTS.slice(0, 3)).toEqual([{ x: 16, z: 89 }, { x: -16, z: 84 }, { x: 10, z: 56 }]);
    expect(CHEST_SPOTS[6]).toMatchObject({ zone: 'kite' });
    expect(CHEST_SPOTS.slice(7).map(c => c.zone)).toEqual(['marsh', 'rise', 'falls']);
  });
  it('puts every new pickup inside its zone and on ground the hero can walk to', () => {
    for (const c of CHEST_SPOTS.slice(7)) { const z = ZONES.find(q => q.id === c.zone)!; expect(Math.hypot(c.x - z.x, c.z - z.z), c.zone).toBeLessThan(z.r); }
    for (const m of expansionMustReach()) if (/^(zone (marsh|rise|falls)|acorn (1[4-9])|chest [7-9])$/.test(m.name)) expect(isClear(grid, m.p.x, m.p.z, HERO), m.name).toBe(true);
  });
});

