import { describe, expect, it } from 'vitest';
import { isClear } from './colliders';
import {
  BOTTLE_SPOTS, BOTTLE_NEEDS, CRAB_NEEDS, GULL_NEEDS, BUOYS, BUOY_SPOTS, CRAB_SPOTS, EBB_SONG, FLOOD_SONG, GLASS_SPOTS, GROUND, GULL_SPOTS, HERON_POS, LAMP_POS, SHORE_EXIT, SHORE_SPAWN, WALL_MARGIN,
  buildShoreDecor, clampToArena, clampToFloor, floorDistance, floorRayClear, onFloor, shoreGrid, shoreMustReach, type ShoreGates, HERON_CHECKPOINT, KEEPER_POS, MAK_POS, TIDE_BOARD_POS,
} from './shoreLayout';

const HERO_R = 0.38;
/** Flood fill over the ground at 0.5 m, using exactly the rules the game applies (ground margin + solid circles). */
function reachable(gates: ShoreGates) {
  const grid = shoreGrid(), res = 0.5, x0 = -56, z0 = -70, w = 230, h = 260;
  const open = new Uint8Array(w * h);
  for (let iz = 0; iz < h; iz++) for (let ix = 0; ix < w; ix++) { const x = x0 + ix * res, z = z0 + iz * res; if (onFloor(gates, x, z, WALL_MARGIN) && isClear(grid, x, z, HERO_R)) open[iz * w + ix] = 1; }
  const cell = (p: { x: number; z: number }) => Math.round((p.z - z0) / res) * w + Math.round((p.x - x0) / res);
  const seen = new Uint8Array(w * h), stack = [cell(SHORE_SPAWN)]; seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop()!, cx = c % w, cz = Math.floor(c / w);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = nz * w + nx; if (open[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
  }
  return (p: { x: number; z: number }) => seen[cell(p)] === 1;
}
const STILL: ShoreGates = { tide: 'still', causeway: false };
const LOW: ShoreGates = { tide: 'low', causeway: false };
const HIGH: ShoreGates = { tide: 'high', causeway: false };
const ALL_GATES: ShoreGates[] = [STILL, LOW, HIGH, { tide: 'still', causeway: true }, { tide: 'low', causeway: true }, { tide: 'high', causeway: true }];

describe('moonwake shore layout', () => {
  it('starts the hero on open ground, well inside the water\'s edge', () => {
    expect(onFloor(STILL, SHORE_SPAWN.x, SHORE_SPAWN.z, 2)).toBe(true);
    expect(isClear(shoreGrid(), SHORE_SPAWN.x, SHORE_SPAWN.z, HERO_R)).toBe(true);
    expect(onFloor(STILL, SHORE_EXIT.x, SHORE_EXIT.z, WALL_MARGIN)).toBe(true);
  });
  it('lets the hero walk to every goal with just the gates that goal needs (the tide never traps anybody)', () => {
    for (const t of shoreMustReach()) expect(reachable(t.needs)(t.p), `${t.name} with ${JSON.stringify(t.needs)}`).toBe(true);
  });
  it('can always be walked back to the beach: from anywhere reachable, the way out is reachable', () => {
    for (const g of ALL_GATES) expect(reachable(g)({ x: SHORE_EXIT.x, z: SHORE_EXIT.z }), JSON.stringify(g)).toBe(true);
  });
  it('closes each place until the tide or the puzzle opens it', () => {
    const flats = { x: -36, z: 8 }, wreck = { x: 38, z: 6 }, island = { x: 0, z: -44 }, cave = { x: -18, z: -58.5 };
    expect(reachable(STILL)(flats)).toBe(false); expect(reachable(HIGH)(flats)).toBe(false); expect(reachable(LOW)(flats)).toBe(true);
    expect(reachable(STILL)(wreck)).toBe(false); expect(reachable(LOW)(wreck)).toBe(false); expect(reachable(HIGH)(wreck)).toBe(true);
    for (const g of [STILL, LOW, HIGH]) expect(reachable(g)(island), JSON.stringify(g)).toBe(false);                  // the causeway is under water until the puzzle is solved
    expect(reachable({ tide: 'still', causeway: true })(island)).toBe(true); expect(reachable({ tide: 'high', causeway: true })(island)).toBe(true);
    expect(reachable({ tide: 'still', causeway: true })(cave)).toBe(false); expect(reachable({ tide: 'low', causeway: true })(cave)).toBe(true);   // the sea cave is dry only at low tide
  });
  it('v2.33: Pearl Cove is always open, Tern Rock only at high tide, Beacon Rock only once the causeway is up', () => {
    const cove = { x: -34, z: 41 }, tern = { x: 35, z: 41 }, beacon = { x: 25, z: -54 };
    for (const g of [STILL, LOW, HIGH]) expect(reachable(g)(cove), JSON.stringify(g)).toBe(true);
    expect(reachable(STILL)(tern)).toBe(false); expect(reachable(LOW)(tern)).toBe(false); expect(reachable(HIGH)(tern)).toBe(true);
    for (const g of [STILL, LOW, HIGH]) expect(reachable(g)(beacon), JSON.stringify(g)).toBe(false);
    for (const g of [{ tide: 'still', causeway: true }, { tide: 'high', causeway: true }] as ShoreGates[]) expect(reachable(g)(beacon), JSON.stringify(g)).toBe(true);
    expect(BOTTLE_SPOTS).toHaveLength(6); expect(CRAB_SPOTS).toHaveLength(7); expect(GULL_SPOTS).toHaveLength(6);
  });
  it('keeps the village, the Tide Board, Mak Long and all three bell-buoys on the always-open ground', () => {
    const open = reachable(STILL);
    for (const t of shoreMustReach()) if (/^(board|mak|buoy|exit|glass [01])/.test(t.name)) expect(open(t.p), t.name).toBe(true);
    expect(open({ x: MAK_POS.x + 1.5, z: MAK_POS.z + 0.8 })).toBe(true); expect(open({ x: TIDE_BOARD_POS.x - 1.5, z: TIDE_BOARD_POS.z + 2 })).toBe(true);
  });
  it('puts every pickup and creature on ground that exists with its gate, and not inside a solid object', () => {
    const grid = shoreGrid();
    const spots: [string, { x: number; z: number }, ShoreGates][] = [
      ...GLASS_SPOTS.map((p, i): [string, { x: number; z: number }, ShoreGates] => [`glass ${i}`, p, i < 2 ? STILL : i < 5 ? LOW : i < 7 ? HIGH : { tide: 'low', causeway: true }]),
      ...CRAB_SPOTS.map((p, i): [string, { x: number; z: number }, ShoreGates] => [`crab ${i}`, p, CRAB_NEEDS[i]]),
      ...GULL_SPOTS.map((p, i): [string, { x: number; z: number }, ShoreGates] => [`gull ${i}`, p, GULL_NEEDS[i]]),
    ];
    for (const [name, p, g] of spots) { expect(onFloor(g, p.x, p.z, WALL_MARGIN), name).toBe(true); expect(isClear(grid, p.x, p.z, HERO_R), name).toBe(true); }
    for (const b of BUOYS) expect(onFloor(STILL, BUOY_SPOTS[b].x, BUOY_SPOTS[b].z, 0.7), b).toBe(true);
    BOTTLE_SPOTS.forEach((p, i) => expect(floorDistance({ tide: BOTTLE_NEEDS[i].tide === 'still' ? 'low' : BOTTLE_NEEDS[i].tide, causeway: true }, p.x, p.z), `bottle ${i}`).toBeLessThan(-0.6));
    expect(onFloor({ tide: 'still', causeway: true }, HERON_POS.x, HERON_POS.z, 2)).toBe(true);
    expect(onFloor({ tide: 'still', causeway: true }, HERON_CHECKPOINT.x, HERON_CHECKPOINT.z, 1)).toBe(true);
    expect(onFloor({ tide: 'still', causeway: true }, LAMP_POS.x, LAMP_POS.z, 1)).toBe(true); expect(onFloor({ tide: 'still', causeway: true }, KEEPER_POS.x, KEEPER_POS.z, 1)).toBe(true);
  });
  it('makes the bells a real walk apart, so the order is something to remember', () => {
    const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
    expect(d(BUOY_SPOTS.shell, BUOY_SPOTS.wave)).toBeGreaterThan(30); expect(d(BUOY_SPOTS.wave, BUOY_SPOTS.star)).toBeGreaterThan(30); expect(d(BUOY_SPOTS.shell, BUOY_SPOTS.star)).toBeGreaterThan(30);
    expect(EBB_SONG).toHaveLength(3); expect(new Set(EBB_SONG).size).toBe(3); expect([...EBB_SONG].reverse()).toEqual([...FLOOD_SONG]);   // the flood song is the ebb song backwards
  });
  it('keeps a hero pushed into the sea on the ground, and leaves a point already on it alone', () => {
    const p = clampToFloor(LOW, -60, 30); expect(onFloor(LOW, p.x, p.z, WALL_MARGIN - 1e-6)).toBe(true);
    expect(clampToFloor(STILL, SHORE_SPAWN.x, SHORE_SPAWN.z)).toEqual({ x: SHORE_SPAWN.x, z: SHORE_SPAWN.z });
    for (const g of ALL_GATES) for (const [x, z] of [[100, 100], [-70, -80], [3, -25], [-36, 8], [38, 6], [-18, -58]]) { const c = clampToFloor(g, x, z); expect(onFloor(g, c.x, c.z, WALL_MARGIN - 1e-6), `${x},${z} ${JSON.stringify(g)}`).toBe(true); }
  });
  it('keeps the camera from drifting far out to sea, and the Heron on its island', () => {
    expect(floorRayClear(STILL, 0, 33, 0, 1, 20)).toBeLessThan(20);
    expect(floorRayClear(STILL, 0, 15, 0, 1, 6)).toBe(6);
    const c = clampToArena(0, -70); expect(Math.hypot(c.x - 0, c.z + 44)).toBeLessThanOrEqual(8.4 + 1e-9);
    expect(clampToArena(1, -44)).toEqual({ x: 1, z: -44 });
  });
  it('builds the same decoration every time, all of it on dry ground and clear of solid objects', () => {
    const a = buildShoreDecor(), b = buildShoreDecor();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.pebbles.length).toBeGreaterThan(80); expect(a.reeds.length).toBeGreaterThan(10); expect(a.huts).toHaveLength(5);
    for (const p of a.pebbles) expect(onFloor({ tide: 'low', causeway: true }, p.x, p.z, 0.1)).toBe(true);
    expect(buildShoreDecor(7).pebbles[0]).not.toEqual(a.pebbles[0]);
  });
  it('names every piece of ground once, and gives each a gate the code understands', () => {
    expect(new Set(GROUND.map(g => g.part)).size).toBe(GROUND.length);
    for (const g of GROUND) expect(['always', 'low', 'high', 'causeway']).toContain(g.gate);
  });
});
