import { isBridgeZone, isRiverCell, RIVER_HALF_WIDTH, riverCenterX, WORLD_HEIGHT, WORLD_WIDTH } from './worldGeometry';
import { FLOWER_VARIANTS, BUSH_FRAME_NAMES, LEAF_FRAME_NAMES, ROCK_FRAME_NAMES, type BushFrame, type LeafFrame, type RockFrame } from '../data/frames';

export const TILE = 32;
export const MAP_COLUMNS = 60;
export const MAP_ROWS = 40;

export interface Blocker { x: number; y: number; w: number; h: number }
export interface ClearZone { x: number; y: number; r: number }
export interface MapObject { id?: number; name?: string; x?: number; y?: number; width?: number; height?: number }

export interface ForestPlan {
  trees: Array<{ x: number; y: number; variant: number; scale: number; flip: boolean }>;
  rocks: Array<{ x: number; y: number; frame: RockFrame; scale: number }>;
  bushes: Array<{ x: number; y: number; frame: BushFrame; scale: number; flower: number }>;
  tufts: Array<{ x: number; y: number; frame: LeafFrame; scale: number }>;
  blockers: Blocker[];
}

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** Centre line of the explorer's trail in world pixels, t from 0 (start clearing) to 1 (bridge). */
export function trailPoint(t: number) {
  return { x: (11 + t * 16 + Math.sin(t * Math.PI * 2) * 1.25) * TILE + 16, y: (7 + t * 17) * TILE + 16 };
}

/** Grid cells covered by the explorer's trail: from the start clearing, down to the bridge, and east. */
export function buildTrailCells(): Set<string> {
  const cells = new Set<string>();
  const brush = (column: number, row: number, radius: number) => {
    const reach = Math.ceil(radius);
    for (let y = Math.floor(row) - reach; y <= Math.floor(row) + reach; y++) {
      for (let x = Math.floor(column) - reach; x <= Math.floor(column) + reach; x++) {
        if ((x - column) ** 2 + (y - row) ** 2 <= radius ** 2 && x >= 0 && x < MAP_COLUMNS && y >= 0 && y < MAP_ROWS) cells.add(`${x},${y}`);
      }
    }
  };
  for (let i = 0; i <= 110; i++) {
    const t = i / 110;
    brush(11 + t * 16 + Math.sin(t * Math.PI * 2) * 1.25, 7 + t * 17, 1.35);
  }
  for (let column = 24; column <= 49; column++) brush(column, 25, 1.4);
  return cells;
}

export function isPathNear(paths: Set<string>, x: number, y: number): boolean {
  const column = Math.floor(x / TILE), row = Math.floor(y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (paths.has(`${column + dx},${row + dy}`)) return true;
  return false;
}

const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/**
 * Plans every forest object once, from a fixed seed, so the scene and the tests agree on exactly what
 * exists and what blocks the player.
 */
export function planForest(objects: MapObject[], paths: Set<string>, keepClear: ClearZone[] = [], fixedBlockers: Blocker[] = []): ForestPlan {
  const plan: ForestPlan = { trees: [], rocks: [], bushes: [], tufts: [], blockers: [...fixedBlockers] };
  const clear = (x: number, y: number) => keepClear.every((zone) => distance(x, y, zone.x, zone.y) > zone.r);
  const safe = (x: number, y: number) => !isRiverCell(x, y) && !isBridgeZone(x, y) && !isPathNear(paths, x, y) && clear(x, y);

  for (const object of objects) {
    if (object.name !== 'tree' && object.name !== 'rock') continue;
    const id = object.id ?? 0;
    const x = (object.x ?? 0) + (object.width ?? TILE) / 2;
    const y = (object.y ?? 0) + (object.height ?? TILE);
    if (isPathNear(paths, x, y) || isRiverCell(x, y - 12) || isBridgeZone(x, y) || !clear(x, y)) continue;
    if (object.name === 'tree') {
      plan.trees.push({ x, y, variant: id % 3, scale: [1.25, 1.15, 1.3][id % 3] * (0.94 + ((id * 7) % 5) * 0.03), flip: id % 2 === 0 });
      plan.blockers.push({ x, y: y - 5, w: 23, h: 15 });
    } else {
      const frame = ROCK_FRAME_NAMES[id % ROCK_FRAME_NAMES.length];
      plan.rocks.push({ x, y, frame, scale: 1 });
      plan.blockers.push({ x, y: y - 5, w: frame === 'rock-wide' ? 34 : 20, h: 14 });
    }
  }

  const random = seededRandom(8763);
  for (let i = 0; i < 8; i++) {
    const x = 70 + random() * (WORLD_WIDTH - 140), y = 110 + random() * (WORLD_HEIGHT - 220);
    if (!safe(x, y) || plan.blockers.some((b) => distance(x, y, b.x, b.y) < 112)) continue;
    plan.trees.push({ x, y, variant: i % 3, scale: 1.08 + (i % 3) * 0.08, flip: i % 2 === 1 });
    plan.blockers.push({ x, y: y - 5, w: 23, h: 15 });
  }

  // Solid bushes: real bush sprites, with a small footprint so they never wall the trail in.
  const bushScale: Record<BushFrame, number> = { 'bush-big': 0.5, 'bush-wide-1': 0.55, 'bush-wide-2': 0.55, 'bush-small-1': 0.7, 'bush-small-2': 0.7, 'bush-small-3': 0.7, 'bush-tiny': 0.85 };
  for (let i = 0; i < 16; i++) {
    const x = 42 + random() * (WORLD_WIDTH - 84), y = 64 + random() * (WORLD_HEIGHT - 128);
    const frame = BUSH_FRAME_NAMES[Math.floor(random() * BUSH_FRAME_NAMES.length)];
    if (!safe(x, y) || plan.blockers.some((b) => distance(x, y, b.x, b.y) < 40)) continue;
    plan.bushes.push({ x, y, frame, scale: bushScale[frame], flower: random() < 0.5 ? 1 + Math.floor(random() * FLOWER_VARIANTS) : 0 });
    plan.blockers.push({ x, y: y - 3, w: 20, h: 11 });
  }

  // The trail is lined with alternating bushes and fern tufts, 90+ px off the path, so the route reads as designed.
  const edge = seededRandom(4409);
  for (let i = 2; i < 100; i += 3) {
    const t = i / 100, here = trailPoint(t), ahead = trailPoint(Math.min(1, t + 0.01));
    const length = Math.hypot(ahead.x - here.x, ahead.y - here.y) || 1;
    const nx = -(ahead.y - here.y) / length, ny = (ahead.x - here.x) / length;
    const side = (i / 3) % 2 === 0 ? 1 : -1;
    const offset = 92 + edge() * 22;
    const x = here.x + nx * side * offset, y = here.y + ny * side * offset;
    if (!safe(x, y) || plan.blockers.some((b) => distance(x, y, b.x, b.y) < 44)) continue;
    if ((i / 3) % 3 !== 1) {
      const frame = BUSH_FRAME_NAMES[Math.floor(edge() * BUSH_FRAME_NAMES.length)];
      plan.bushes.push({ x, y, frame, scale: bushScale[frame], flower: edge() < 0.6 ? 1 + Math.floor(edge() * FLOWER_VARIANTS) : 0 });
      plan.blockers.push({ x, y: y - 3, w: 20, h: 11 });
    }
    for (let k = 0; k < 3; k++) {
      plan.tufts.push({ x: x + (edge() - 0.5) * 46, y: y + (edge() - 0.5) * 30, frame: LEAF_FRAME_NAMES[Math.floor(edge() * LEAF_FRAME_NAMES.length)], scale: 1.15 });
    }
  }

  // Walk-through grass tufts for texture.
  for (let i = 0; i < 70; i++) {
    const x = 20 + random() * (WORLD_WIDTH - 40), y = 24 + random() * (WORLD_HEIGHT - 48);
    const frame = LEAF_FRAME_NAMES[Math.floor(random() * LEAF_FRAME_NAMES.length)];
    if (safe(x, y)) plan.tufts.push({ x, y, frame, scale: 1.1 });
  }

  // Riverbanks: reeds and pebbles hugging the water so the edge reads as a natural bank.
  const shore = seededRandom(2207);
  for (let y = 30; y < WORLD_HEIGHT - 20; y += 34) {
    for (const side of [-1, 1]) {
      const x = riverCenterX(y) + side * (RIVER_HALF_WIDTH + 12 + shore() * 22);
      const roll = shore();
      if (!safe(x, y) || roll > 0.8) continue;
      if (roll < 0.5) plan.tufts.push({ x, y, frame: LEAF_FRAME_NAMES[Math.floor(shore() * LEAF_FRAME_NAMES.length)], scale: 1.25 });
      else plan.rocks.push({ x, y, frame: 'rock-a', scale: 0.5 });
    }
  }
  return plan;
}
