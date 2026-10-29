import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { mulberry32 } from '../../systems/layout3d';
import { distToTrail, heightAt } from '../../systems/worldShape';
import { fallenLeafGeometry, fernGeometry, grassCellGeometry, reedGeometry, rockGeometry, spikeBudsGeometry, spikeStemGeometry } from './plants';
import { ancientTree, bushModel, treeModel, type TreeKind } from './treeGen';

const tris = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const finite = (g: BufferGeometry): boolean => {
  for (const name of ['position', 'color', 'normal']) {
    const a = g.getAttribute(name); if (!a) return false;
    for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) return false;
  }
  return true;
};

describe('tree models (v2.6)', () => {
  const kinds: TreeKind[] = ['oak', 'pine', 'birch', 'blossom', 'dead'];
  for (const kind of kinds) {
    it(`${kind}: valid geometry, detailed model richer than the far model, within a triangle budget`, () => {
      for (let v = 0; v < 3; v++) {
        const m = treeModel(kind, v);
        expect(finite(m.hi), `${kind}${v} hi`).toBe(true); expect(finite(m.lo), `${kind}${v} lo`).toBe(true);
        expect(tris(m.hi)).toBeGreaterThan(tris(m.lo));
        expect(tris(m.hi)).toBeLessThan(14000);   // many are drawn at once near the hero
        expect(tris(m.lo)).toBeLessThan(2600);
        m.hi.computeBoundingBox(); const b = m.hi.boundingBox!;
        expect(b.min.y).toBeGreaterThan(-0.6); expect(b.max.y).toBeGreaterThan(3); expect(b.max.y).toBeLessThan(12);
      }
    });
  }
  it('leaf tufts and colour variation are present on the detailed oak (many more vertices than the clump meshes alone)', () => {
    const m = treeModel('oak', 0);
    expect(m.hi.getAttribute('position').count).toBeGreaterThan(3000);
    const col = m.hi.getAttribute('color'); let min = 9, max = 0;
    for (let i = 0; i < col.count; i++) { const g = col.getY(i); min = Math.min(min, g); max = Math.max(max, g); }
    expect(max - min).toBeGreaterThan(0.3);
  });
  it('blossom trees are pinker than oaks', () => {
    const avg = (g: BufferGeometry) => { const c = g.getAttribute('color'); let r = 0, gr = 0; for (let i = 0; i < c.count; i++) { r += c.getX(i); gr += c.getY(i); } return r / gr; };
    expect(avg(treeModel('blossom', 0).hi)).toBeGreaterThan(avg(treeModel('oak', 0).hi));
  });
  it('is deterministic', () => {
    const a = treeModel('dead', 1).hi; const b = bushModel(3, 'berry');
    expect(tris(a)).toBe(tris(treeModel('dead', 1).hi));
    expect(tris(bushModel(3, 'berry'))).toBe(tris(b));
  });
  it('the Ancient Tree and the three bush kinds are valid and bounded', () => {
    expect(finite(ancientTree())).toBe(true); expect(tris(ancientTree())).toBeLessThan(40000);
    for (const k of ['plain', 'berry', 'flower'] as const) { const g = bushModel(3, k); expect(finite(g)).toBe(true); expect(tris(g)).toBeLessThan(2600); expect(tris(g)).toBeGreaterThan(300); }
  });
});

describe('small plants (v2.6)', () => {
  it('rocks are faceted with strata colour variation', () => {
    const g = rockGeometry(11, 2); expect(finite(g)).toBe(true); expect(g.index).toBeNull();
    const c = g.getAttribute('color'); let min = 9, max = 0; for (let i = 0; i < c.count; i++) { min = Math.min(min, c.getX(i)); max = Math.max(max, c.getX(i)); }
    expect(max - min).toBeGreaterThan(0.25);
  });
  it('ferns, reeds, spikes and leaves build valid, cheap geometry', () => {
    for (const [g, max] of [[fernGeometry(), 900], [reedGeometry(), 700], [spikeStemGeometry(), 150], [spikeBudsGeometry(), 250], [fallenLeafGeometry(), 4]] as const) { expect(finite(g)).toBe(true); expect(tris(g)).toBeLessThan(max); expect(tris(g)).toBeGreaterThan(1); }
  });
  it('grass cells are whole tufts with a clean prefix list, finite and above the ground', () => {
    const rnd = mulberry32(5);
    const g = grassCellGeometry(120, { x: -3, z: 12, size: 6 }, heightAt, (x, z) => distToTrail(x, z) > 1.2, rnd)!;
    expect(g).not.toBeNull();
    const ends = g.userData.ends as number[];
    expect(ends.length).toBeGreaterThan(40);
    for (let i = 1; i < ends.length; i++) expect(ends[i]).toBeGreaterThan(ends[i - 1]);
    expect(ends[ends.length - 1]).toBe(g.index!.count);
    for (const e of ends) expect(e % 3).toBe(0);
    expect(finite(g)).toBe(true);
    const bend = g.getAttribute('aBend'); expect(bend.count).toBe(g.getAttribute('position').count);
    // roughly 20-45 triangles per tuft keeps a full meadow affordable
    expect(tris(g) / ends.length).toBeLessThan(60);
    for (let i = 0; i < g.index!.count; i++) expect(g.index!.getX(i)).toBeLessThan(g.getAttribute('position').count);
  });
  it('grass has a mix of heights (lawn, tall, seed heads)', () => {
    const rnd = mulberry32(9);
    const g = grassCellGeometry(400, { x: 0, z: 0, size: 6 }, () => 0, () => true, rnd)!;
    const p = g.getAttribute('position'); let tallest = 0, short = 0; for (let i = 0; i < p.count; i++) tallest = Math.max(tallest, p.getY(i));
    expect(tallest).toBeGreaterThan(0.9);
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.05 && p.getY(i) < 0.25) short++;
    expect(short).toBeGreaterThan(100);
  });
});
