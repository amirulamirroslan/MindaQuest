import { beforeAll, describe, expect, it } from 'vitest';
import { Group, type Mesh } from 'three';

// a headless canvas: enough for the water texture and the glow sprites (no pixels are needed to build geometry)
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => undefined), set: () => true });
  const canvas = () => ({ width: 0, height: 0, getContext: () => ctx, style: {} });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => canvas(), createElementNS: () => canvas() };
});

describe('WildsWorld (headless build)', () => {
  it('builds every structure and interactable with finite geometry', async () => {
    const { WildsWorld } = await import('./WildsWorld');
    const { CHEST_SPOTS, ACORN_SPOTS, ZONES } = await import('../systems/expansion');
    const parent = new Group(), w = new WildsWorld(parent);
    let meshes = 0, tris = 0;
    parent.traverse(o => { const m = o as Mesh; if (!m.isMesh) return; meshes++; const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) throw new Error(`NaN in ${m.name || 'mesh'}`); tris += (m.geometry.index ? m.geometry.index.count : p.count) / 3; });
    expect(meshes).toBeGreaterThan(60); expect(meshes).toBeLessThan(700); expect(tris).toBeLessThan(220_000);
    expect(Object.keys(w.npcs)).toEqual(['tani', 'lumut', 'din']);
    // state: chests, pickups and the thorn barrier follow the save
    w.setState({ zones: [], acorns: [0, 1], pumpkins: [], pearls: [], lanterns: [0], tablets: [], chests: [1], tani: 0, lumut: 2, din: 0, explored: '' }, false);
    w.update(1, 0, 0); w.update(2, -66, 2); w.setNight(1);
    expect(CHEST_SPOTS.length).toBe(10); expect(ACORN_SPOTS.length).toBe(20); expect(ZONES.length).toBe(15);
    console.log(`WildsWorld: ${meshes} meshes, ${Math.round(tris)} triangles in total (distant zones are hidden at 120 m)`);
  });
});
