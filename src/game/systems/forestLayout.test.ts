import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, LINA_POS, PLAYER_START, SCENERY, sceneryBlockers, TIMBER_POSITIONS } from '../data/scenery';
import { BUSH_FRAMES, LEAF_FRAMES, LOG_FRAMES, ROCK_FRAMES } from '../data/frames';
import { buildTrailCells, isPathNear, planForest, type MapObject } from './forestLayout';
import { canOccupyWorldPoint, hasReachedEastBank, isBridgeZone, isRiverCell, riverCenterX, WORLD_HEIGHT, WORLD_WIDTH } from './worldGeometry';

const mapPath = fileURLToPath(new URL('../../../public/assets/maps/emerald-wilds.json', import.meta.url));
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const objects: MapObject[] = map.layers.find((layer: { name: string }) => layer.name === 'Collision').objects;
const paths = buildTrailCells();
const plan = planForest(objects, paths, KEEP_CLEAR, sceneryBlockers());

// Player body half-extents (13x10 body at 1.35 scale).
const HX = 8.8, HY = 6.75, STEP = 6;

function free(x: number, y: number, repaired: boolean) {
  if (x < HX || y < HY || x > WORLD_WIDTH - HX || y > WORLD_HEIGHT - HY) return false;
  for (const [px, py] of [[x - 8, y - 6], [x + 8, y - 6], [x - 8, y + 6], [x + 8, y + 6]]) if (!canOccupyWorldPoint(px, py, repaired)) return false;
  return !plan.blockers.some((b) => Math.abs(x - b.x) < b.w / 2 + HX && Math.abs(y - b.y) < b.h / 2 + HY);
}

function reachable(repaired: boolean) {
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[PLAYER_START.x, PLAYER_START.y]];
  seen.add(`${PLAYER_START.x},${PLAYER_START.y}`);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || !free(nx, ny, repaired)) continue;
      seen.add(key);
      stack.push([nx, ny]);
    }
  }
  return [...seen].map((key) => key.split(',').map(Number) as [number, number]);
}

const canReach = (cells: Array<[number, number]>, tx: number, ty: number, range: number) => cells.some(([x, y]) => Math.hypot(x - tx, y - ty) <= range);

describe('Emerald Wilds layout', () => {
  const before = reachable(false);

  it('starts the hero on open ground, clearly apart from Lina', () => {
    expect(free(PLAYER_START.x, PLAYER_START.y, false)).toBe(true);
    expect(Math.hypot(PLAYER_START.x - LINA_POS.x, PLAYER_START.y - LINA_POS.y)).toBeGreaterThan(300);
  });

  it('lets the hero reach Lina, every timber piece and the bridge before it is repaired', () => {
    expect(canReach(before, LINA_POS.x, LINA_POS.y, 78)).toBe(true);
    TIMBER_POSITIONS.forEach(([x, y], index) => expect(canReach(before, x, y, 78), `timber ${index + 1}`).toBe(true));
    expect(before.some(([x, y]) => Math.hypot(x - riverCenterX(y), y - 800) <= 160)).toBe(true);
  });

  it('keeps the east bank closed until the bridge is repaired, then opens it', () => {
    expect(before.some(([x, y]) => hasReachedEastBank(x, y))).toBe(false);
    expect(reachable(true).some(([x, y]) => hasReachedEastBank(x, y))).toBe(true);
  });

  it('places all twelve timber pieces on dry land, apart from each other and from Lina', () => {
    expect(TIMBER_POSITIONS).toHaveLength(12);
    for (const [x, y] of TIMBER_POSITIONS) expect(isRiverCell(x, y) || isBridgeZone(x, y)).toBe(false);
    for (let i = 0; i < 12; i++) {
      expect(Math.hypot(TIMBER_POSITIONS[i][0] - LINA_POS.x, TIMBER_POSITIONS[i][1] - LINA_POS.y)).toBeGreaterThan(60);
      for (let j = i + 1; j < 12; j++) expect(Math.hypot(TIMBER_POSITIONS[i][0] - TIMBER_POSITIONS[j][0], TIMBER_POSITIONS[i][1] - TIMBER_POSITIONS[j][1])).toBeGreaterThan(40);
    }
  });

  it('keeps generated blockers off the trail and every blocker out of the river', () => {
    const generated = plan.blockers.slice(sceneryBlockers().length);
    for (const b of plan.blockers) expect(isRiverCell(b.x, b.y), `river ${b.x},${b.y}`).toBe(false);
    for (const b of generated) {
      expect(isPathNear(paths, b.x, b.y + 5), `trail ${b.x},${b.y}`).toBe(false);
    }
  });

  it('uses only real sprite frames so nothing invisible can block the player', () => {
    for (const rock of plan.rocks) expect(Object.keys(ROCK_FRAMES)).toContain(rock.frame);
    for (const bush of plan.bushes) expect(Object.keys(BUSH_FRAMES)).toContain(bush.frame);
    for (const tuft of plan.tufts) expect(Object.keys(LEAF_FRAMES)).toContain(tuft.frame);
    for (const prop of SCENERY) expect(Object.keys(LOG_FRAMES)).toContain(prop.frame);
    expect(plan.blockers.length).toBe(sceneryBlockers().length + plan.trees.length + plan.rocks.filter((r) => r.scale === 1).length + plan.bushes.length);
  });

  it('is deterministic, so every playthrough shows the same forest', () => {
    expect(planForest(objects, paths, KEEP_CLEAR, sceneryBlockers())).toEqual(plan);
  });
});
