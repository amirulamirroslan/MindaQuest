import { describe, expect, it } from 'vitest';
import { isClear } from './colliders';
import {
  DOOR_POS, ECHO_COLORS, ECHO_ORDER, ECHO_SPOTS, FLOOR, GLOWCAP_SPOTS, HEART_POS, HOLLOW_EXIT, HOLLOW_SPAWN, SHARD_SPOTS, WALL_MARGIN, buildHollowDecor, clampToFloor,
  floorDistance, floorRayClear, hollowGrid, hollowMustReach, onFloor, hueIndexAt, MURAL_POS, PRISM_POS,
  GLIM_POS, HEART_CHAMBER, SECRET_ROOM, SHARDLING_SPOTS, TABLET_APPROACH, TABLET_SPOTS, WARDEN_CHECKPOINT, WARDEN_POS, clampToArena,
} from './hollowLayout';
import { ENEMY_DEFS } from './enemies';

const HERO_R = 0.38;
/** Flood fill over the floor at 0.5 m, using exactly the rules the game applies (floor margin + solid circles). */
function reachable(gates: { doorOpen: boolean; secretOpen: boolean }) {
  const grid = hollowGrid(gates), res = 0.5, x0 = -54, z0 = -62, w = 210, h = 216;
  const open = new Uint8Array(w * h);
  for (let iz = 0; iz < h; iz++) for (let ix = 0; ix < w; ix++) { const x = x0 + ix * res, z = z0 + iz * res; if (onFloor(x, z, WALL_MARGIN) && isClear(grid, x, z, HERO_R)) open[iz * w + ix] = 1; }
  const cell = (p: { x: number; z: number }) => Math.round((p.z - z0) / res) * w + Math.round((p.x - x0) / res);
  const seen = new Uint8Array(w * h), stack = [cell(HOLLOW_SPAWN)]; seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop()!, cx = c % w, cz = Math.floor(c / w);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = nz * w + nx; if (open[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
  }
  return (p: { x: number; z: number }) => seen[cell(p)] === 1;
}

describe('crystal hollow layout', () => {
  it('lets the hero walk to every Shardling nest, Glim and the first two tablets with both gates shut (nothing optional is locked behind the quest)', () => {
    const shut = reachable({ doorOpen: false, secretOpen: false });
    for (const t of hollowMustReach()) if (/^(glim|shardling|tablet [01])/.test(t.name)) expect(shut(t.p), t.name).toBe(true);
    expect(shut({ x: TABLET_SPOTS[2].x + TABLET_APPROACH[2].x, z: TABLET_SPOTS[2].z + TABLET_APPROACH[2].z })).toBe(false); // the last tablet is the secret nook's prize
  });
  it('starts the hero on open floor, well inside the rock', () => {
    expect(onFloor(HOLLOW_SPAWN.x, HOLLOW_SPAWN.z, 2)).toBe(true);
    expect(isClear(hollowGrid({ doorOpen: false, secretOpen: false }), HOLLOW_SPAWN.x, HOLLOW_SPAWN.z, HERO_R)).toBe(true);
    expect(onFloor(HOLLOW_EXIT.x, HOLLOW_EXIT.z, WALL_MARGIN)).toBe(true);
  });
  it('puts every shard, crystal and mushroom on the floor and not inside a solid object', () => {
    const grid = hollowGrid({ doorOpen: true, secretOpen: true });
    for (const p of SHARD_SPOTS) { expect(onFloor(p.x, p.z, WALL_MARGIN), JSON.stringify(p)).toBe(true); expect(isClear(grid, p.x, p.z, HERO_R), JSON.stringify(p)).toBe(true); }
    for (const c of ECHO_COLORS) expect(onFloor(ECHO_SPOTS[c].x, ECHO_SPOTS[c].z, 0.6), c).toBe(true);
    for (const p of GLOWCAP_SPOTS) expect(onFloor(p.x, p.z, 0.6)).toBe(true);
    expect(onFloor(HEART_POS.x, HEART_POS.z, 1)).toBe(true);
  });
  it('lets the hero walk to everything once both gates are open', () => {
    const can = reachable({ doorOpen: true, secretOpen: true });
    for (const t of hollowMustReach()) expect(can(t.p), t.name).toBe(true);
  });
  it('keeps the Heart Chamber shut until the door opens', () => {
    const closed = reachable({ doorOpen: false, secretOpen: true });
    expect(closed({ x: HEART_POS.x, z: HEART_POS.z + 2.3 })).toBe(false);
    expect(closed({ x: DOOR_POS.x, z: DOOR_POS.z + 3 })).toBe(true); // the tunnel up to the door is open
    const behindDoor = ['heartstone', 'shard 7', 'tablet 4']; // the Heart Chamber and the Moon Vault beyond it (v2.32)
    for (const t of hollowMustReach()) if (!behindDoor.includes(t.name)) expect(closed(t.p), t.name).toBe(true); // everything else is reachable without it
    for (const name of behindDoor.slice(1)) expect(closed(hollowMustReach().find(t => t.name === name)!.p), name).toBe(false);
  });
  it('keeps the secret nook sealed until the glowcaps are lit', () => {
    const sealed = reachable({ doorOpen: true, secretOpen: false });
    expect(sealed({ x: SHARD_SPOTS[4].x, z: SHARD_SPOTS[4].z })).toBe(false);
    for (const t of hollowMustReach()) if (t.name !== 'shard 4' && t.name !== 'tablet 2') expect(sealed(t.p), t.name).toBe(true);
  });
  it('never needs a gate that cannot be opened: all three glowcaps and all three echo crystals are reachable with both gates shut', () => {
    const shut = reachable({ doorOpen: false, secretOpen: false });
    for (const c of ECHO_COLORS) expect(shut({ x: ECHO_SPOTS[c].x + 1.5, z: ECHO_SPOTS[c].z + 0.8 }), c).toBe(true);
    for (const p of GLOWCAP_SPOTS) expect(shut({ x: p.x + 1.0, z: p.z + 0.4 })).toBe(true);
  });
  it('orders the crystals so the walk is long: the first and second are far from the start', () => {
    expect(new Set(ECHO_ORDER).size).toBe(3);
    const d = (c: (typeof ECHO_COLORS)[number]) => Math.hypot(ECHO_SPOTS[c].x - HOLLOW_SPAWN.x, ECHO_SPOTS[c].z - HOLLOW_SPAWN.z);
    expect(d(ECHO_ORDER[0])).toBeGreaterThan(40); expect(d(ECHO_ORDER[1])).toBeGreaterThan(40);
  });
  it('clamps any point onto the floor, leaves good points alone and is stable', () => {
    for (const p of [{ x: 100, z: 100 }, { x: -60, z: 0 }, { x: 0, z: -80 }, { x: 12, z: 30 }, { x: 24, z: 24 }, { x: -8, z: -3 }]) {
      const c = clampToFloor(p.x, p.z);
      expect(onFloor(c.x, c.z, WALL_MARGIN - 1e-6), JSON.stringify(p)).toBe(true);
      const again = clampToFloor(c.x, c.z); expect(again.x).toBeCloseTo(c.x, 6); expect(again.z).toBeCloseTo(c.z, 6);
    }
    expect(clampToFloor(0, 13)).toEqual({ x: 0, z: 13 });
    // a point in rock beside the tunnel lands back in the tunnel, close to where it left
    const c = clampToFloor(5, -5); expect(Math.hypot(c.x - 5, c.z + 5)).toBeLessThan(3.5);
  });
  it('stops the camera ray at the rock', () => {
    expect(floorRayClear(0, 13, 0, 1, 40)).toBeGreaterThan(8); // the hub is wide open to the south
    expect(floorRayClear(0, 0, 1, 0, 40)).toBeLessThan(4);     // in the north tunnel the side walls are close
    expect(floorRayClear(0, 13, 0, 1, 5)).toBe(5);             // capped
  });
  it('is a compact map: about 1,500 square metres of chambers and tunnels, every one of them with something in it', () => {
    let floor = 0;
    for (let x = -50; x <= 46; x += 1) for (let z = -40; z <= 44; z += 1) if (floorDistance(x, z) <= 0) floor++;
    expect(floor).toBeGreaterThan(1400); expect(floor).toBeLessThan(3500); expect(FLOOR.length).toBeGreaterThan(10);
    const rooms: [number, number, number][] = [[0, 33, 5.5], [0, 13, 11], [-15, 27, 4.2], [-31, -9, 8.5], [32, -5, 8.5], [0, -26, 8.5], [-41, -22, 3.2]];
    const things = [...SHARD_SPOTS, ...GLOWCAP_SPOTS, ...ECHO_COLORS.map(c => ECHO_SPOTS[c]), HEART_POS, MURAL_POS, PRISM_POS];
    for (const [x, z, r] of rooms) expect(things.some(t => Math.hypot(t.x - x, t.z - z) <= r + 1), `room at ${x},${z}`).toBe(true);
  });
  it('builds a deterministic wall and plenty of crystals, none of them on the walking floor', () => {
    const a = buildHollowDecor(), b = buildHollowDecor();
    expect(b.rocks.length).toBe(a.rocks.length); expect(b.rocks[7]).toEqual(a.rocks[7]);
    expect(a.rocks.length).toBeGreaterThan(400); expect(a.crystals.length).toBeGreaterThanOrEqual(50);
    for (const r of a.rocks) expect(floorDistance(r.x, r.z)).toBeGreaterThan(0.1);
    for (const c of a.crystals) expect(floorDistance(c.x, c.z)).toBeGreaterThan(-1); // at the wall base, in the unwalkable margin or just on its edge
    expect(new Set(a.crystals.map(c => hueIndexAt(c.x, c.z))).size).toBeGreaterThan(2);
  });
});

describe('crystal hollow v2.28: nests, Glim, tablets, the Warden', () => {
  const open = hollowGrid({ doorOpen: true, secretOpen: true });
  const ok = (p: { x: number; z: number }, margin = 1) => onFloor(p.x, p.z, margin) && isClear(open, p.x, p.z, 0.8);
  it('puts every new thing on open floor with room to fight round it', () => {
    for (const p of [...SHARDLING_SPOTS, WARDEN_POS, WARDEN_CHECKPOINT]) expect(ok(p), JSON.stringify(p)).toBe(true);
    for (const p of [...TABLET_SPOTS, GLIM_POS]) expect(onFloor(p.x, p.z, 1), JSON.stringify(p)).toBe(true); // solid themselves, so only the floor is checked
    TABLET_SPOTS.forEach((p, i) => { const a = { x: p.x + TABLET_APPROACH[i].x, z: p.z + TABLET_APPROACH[i].z }; expect(isClear(open, a.x, a.z, 0.38), `approach ${i}`).toBe(true); });
    for (const p of SHARDLING_SPOTS) expect(isClear(open, p.x, p.z, 1.6), `a fighting space round ${JSON.stringify(p)}`).toBe(true);
  });
  it('has six nests with distinct, well-spaced places, none near the entry or the Lantern Cavern, and company for the two far Echo Crystals (the pink one, near the start, is left in peace)', () => {
    expect(SHARDLING_SPOTS).toHaveLength(6);
    SHARDLING_SPOTS.forEach((a, i) => { SHARDLING_SPOTS.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.z - b.z), `${i}-${j}`).toBeGreaterThan(5); }); expect(Math.hypot(a.x - HOLLOW_SPAWN.x, a.z - HOLLOW_SPAWN.z)).toBeGreaterThan(25); expect(Math.hypot(a.x - PRISM_POS.x, a.z - PRISM_POS.z)).toBeGreaterThan(14); expect(Math.hypot(a.x - GLIM_POS.x, a.z - GLIM_POS.z)).toBeGreaterThan(14); });
    for (const c of ['gold', 'blue'] as const) expect(SHARDLING_SPOTS.filter(p => Math.hypot(p.x - ECHO_SPOTS[c].x, p.z - ECHO_SPOTS[c].z) < 12).length, c).toBeGreaterThanOrEqual(2);
    expect(SHARDLING_SPOTS.filter(p => p.x > 0)).toHaveLength(3); expect(SHARDLING_SPOTS.filter(p => p.x < 0)).toHaveLength(3);
  });
  it('puts Glim where a first-time visitor walks past him, and the hidden tablets in three different corners, the last in the secret nook', () => {
    const d = Math.hypot(GLIM_POS.x - HOLLOW_SPAWN.x, GLIM_POS.z - HOLLOW_SPAWN.z); expect(d).toBeGreaterThan(8); expect(d).toBeLessThan(18);
    expect(Math.hypot(TABLET_SPOTS[2].x - SECRET_ROOM.x, TABLET_SPOTS[2].z - SECRET_ROOM.z)).toBeLessThan(SECRET_ROOM.r);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(TABLET_SPOTS[i].x - TABLET_SPOTS[j].x, TABLET_SPOTS[i].z - TABLET_SPOTS[j].z)).toBeGreaterThan(30);
  });
  it('keeps the Warden inside the Heart Chamber, clear of the Heartstone, with an arena big enough for its biggest ring and a pillar or two for cover', () => {
    expect(Math.hypot(WARDEN_POS.x - HEART_CHAMBER.x, WARDEN_POS.z - HEART_CHAMBER.z)).toBeLessThan(HEART_CHAMBER.r - 1.6);
    expect(Math.hypot(WARDEN_POS.x - HEART_POS.x, WARDEN_POS.z - HEART_POS.z)).toBeGreaterThan(ENEMY_DEFS.warden.radius + 0.95 + 0.5);
    for (const [x, z] of [[40, 40], [0, -80], [-9, -26], [0, -17]]) { const c = clampToArena(x, z); expect(Math.hypot(c.x - HEART_CHAMBER.x, c.z - HEART_CHAMBER.z)).toBeLessThanOrEqual(HEART_CHAMBER.r - 1.6 + 1e-9); expect(onFloor(c.x, c.z, 1.5)).toBe(true); }
    expect(clampToArena(0, -26)).toEqual({ x: 0, z: -26 });
    expect(HEART_CHAMBER.r * 2).toBeGreaterThan(5.2 * 2 + 4); // the 5.2 m ring fits with room to stand outside it only by running or rolling, which is the lesson
    expect(hollowGrid({ doorOpen: true, secretOpen: true }).constructor.name).toBe('ColliderGrid');
  });
  it('restarts a knocked-out hero on their side of the Heart Door, not at the cave mouth', () => {
    expect(WARDEN_CHECKPOINT.z).toBeGreaterThan(DOOR_POS.z); expect(Math.abs(WARDEN_CHECKPOINT.z - DOOR_POS.z)).toBeLessThan(8);
    expect(reachable({ doorOpen: false, secretOpen: false })(WARDEN_CHECKPOINT)).toBe(true);
  });
});
