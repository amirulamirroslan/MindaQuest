import { beforeAll, describe, expect, it } from 'vitest';
import { Scene, type Mesh } from 'three';

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => undefined), set: () => true });
  const canvas = () => ({ width: 0, height: 0, getContext: () => ctx, style: {} });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => canvas(), createElementNS: () => canvas() };
});

describe('the expanded world (headless build, walking the whole map)', () => {
  it('streams terrain and grass as the hero walks from the village to the far corners without errors', { timeout: 120000 }, async () => {
    const { buildWorld } = await import('./WorldBuilder');
    const scene = new Scene(); const t0 = Date.now(); const world = buildWorld(scene, 'low'); const buildMs = Date.now() - t0; const t1 = Date.now();
    const count = (name: string) => { let n = 0; scene.traverse(o => { if (o.name.startsWith(name) && (o as Mesh).isMesh) n++; }); return n; };
    const startChunks = count('terrain-');
    const route: [number, number][] = [[0, 27], [0, 50], [0, 76], [-50, 62], [-66, 2], [-80, -26], [-52, -56], [0, -78], [30, -54], [62, -66], [68, 14], [62, 56], [0, 27]];
    let t = 0;
    for (const [x, z] of route) for (let i = 0; i < 40; i++) { t += 0.1; world.follow(t, x, z); world.update(t); }
    const chunks = count('terrain-');
    expect(startChunks).toBeGreaterThan(2); expect(chunks).toBeGreaterThan(startChunks); expect(chunks).toBeLessThanOrEqual(49);
    console.log(`buildWorld(low) ${buildMs} ms; whole tour ${Date.now() - t1} ms; terrain chunks at start ${startChunks}, after the tour ${chunks}`);
  });
});
