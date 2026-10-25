export interface GroundProbe { river: boolean; path: boolean }
export type GroundKind = 'water' | 'sand' | 'path' | 'grass';
export interface GroundTile { kind: GroundKind; atlas: 'tops' | 'tiles'; frame: string | number }

function hash(col: number, row: number, seed: number): number {
  let h = Math.imul(col, 374761393) ^ Math.imul(row, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [0,1). Low frequencies give soft, natural-looking patches instead of per-tile speckle. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smooth(x - x0), ty = smooth(y - y0);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export const GRASS_FRAMES = ['grass-10', 'grass-11', 'grass-12'] as const;

export function grassFrame(col: number, row: number): string {
  const n = valueNoise(col / 6, row / 6, 11) * 0.65 + valueNoise(col / 2.4, row / 2.4, 29) * 0.35;
  if (n < 0.15) return 'grass-12';
  if (n > 0.62) return 'grass-11';
  return 'grass-10';
}

export function waterFrame(col: number, row: number): number {
  const h = hash(col, row, 53);
  if (h < 0.05) return 54;
  if (h < 0.16) return 55;
  return 44;
}

export function pathFrame(col: number, row: number): string {
  return valueNoise(col / 3, row / 3, 71) > 0.5 ? 'dirt-4' : 'dirt-3';
}

/** Decides which ground tile belongs at a grid cell. A one-cell sand beach softens every river edge. */
export function classifyGround(col: number, row: number, probe: (col: number, row: number) => GroundProbe): GroundTile {
  const here = probe(col, row);
  if (here.river) return { kind: 'water', atlas: 'tiles', frame: waterFrame(col, row) };
  if (here.path) return { kind: 'path', atlas: 'tops', frame: pathFrame(col, row) };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx !== 0 || dy !== 0) && probe(col + dx, row + dy).river) return { kind: 'sand', atlas: 'tops', frame: 'dirt-3' };
    }
  }
  return { kind: 'grass', atlas: 'tops', frame: grassFrame(col, row) };
}
