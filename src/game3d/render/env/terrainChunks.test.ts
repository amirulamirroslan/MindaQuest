import { describe, expect, it } from 'vitest';
import { buildWorldLayout } from '../../systems/layout3d';
import { heightAt } from '../../systems/worldShape';
import { buildTerrain, CHUNK } from './terrain';

describe('chunked terrain (v2.31)', () => {
  const layout = buildWorldLayout();
  it('builds only the chunks near the hero, and streams the rest', () => {
    const t = buildTerrain(layout, 1.6); t.buildAround(0, 27, 40);
    const first = t.builtCount; expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(20);
    let waiting = 99, guard = 0; while (waiting > 0 && guard++ < 80) waiting = t.update(0, 27, 4);
    expect(t.builtCount).toBeGreaterThan(first); expect(t.builtCount).toBeLessThanOrEqual(49);
    expect(t.update(0, 27, 4)).toBe(0);
  });
  it('uses world coordinates and the shared height function, so neighbouring chunks meet without a seam', () => {
    const t = buildTerrain(layout, 1.6); t.buildAround(0, 0, 70);
    const meshes = t.group.children as import('three').Mesh[]; expect(meshes.length).toBeGreaterThan(4);
    for (const m of meshes.slice(0, 6)) {
      const p = m.geometry.getAttribute('position'), n = m.geometry.getAttribute('normal');
      for (let i = 0; i < p.count; i += 37) { expect(Math.abs(p.getY(i) - (heightAt(p.getX(i), p.getZ(i)) - dipOfPond(p.getX(i), p.getZ(i))))).toBeLessThan(1e-4); expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 3); expect(n.getY(i)).toBeGreaterThan(0); }
    }
    // a vertex on the shared edge of two chunks has the same height and normal in both
    const edge = new Map<string, { y: number; ny: number; nx: number }>(); let shared = 0;
    for (const m of meshes) { const p = m.geometry.getAttribute('position'), n = m.geometry.getAttribute('normal'); for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getZ(i).toFixed(3)}`, v = { y: p.getY(i), ny: n.getY(i), nx: n.getX(i) }, o = edge.get(k); if (o) { shared++; expect(Math.abs(o.y - v.y)).toBeLessThan(1e-5); expect(Math.abs(o.ny - v.ny)).toBeLessThan(1e-5); expect(Math.abs(o.nx - v.nx)).toBeLessThan(1e-5); } else edge.set(k, v); } }
    expect(shared).toBeGreaterThan(20);
  });
  it('has chunks that are a sane size', () => { expect(CHUNK).toBe(32); });
});
function dipOfPond(x: number, z: number): number { const d = Math.hypot(x - 19, z - 17); if (d >= 3.4 + 0.9) return 0; const t = Math.min(1, Math.max(0, (d - (3.4 - 2.2)) / ((3.4 + 0.9) - (3.4 - 2.2)))); const s = t * t * (3 - 2 * t); return 0.42 * (1 - s) ** 1.2; }
