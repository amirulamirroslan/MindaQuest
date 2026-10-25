/** Hand-modelled geometry for the Elder, the Rune Stone and the petal collectible (merged, vertex-coloured). */
import { BufferAttribute, Color, ConeGeometry, IcosahedronGeometry, Matrix4, OctahedronGeometry, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise3 } from './noise';
import { sweep, curvePath, type Ring } from '../hero/geom';
import { Kit, M, V } from './Structures';

const rings = (pts: [number, number, number][], tintFn?: (i: number) => number): Ring[] => pts.map(([y, rA, rB], i) => ({ p: V(0, y, 0), rA, rB, tint: tintFn ? tintFn(i) : 0xffffff }));

/** Elder Tok Wan is built from separate parts so he can breathe, nod, gesture and blink: robe, two arms and the head with hat and beard. Faces +Z. Height ~1.65. */
export const ELDER_NECK_Y = 1.1;
export const ELDER_SHOULDER = { x: 0.2, y: 0.96, z: 0 } as const;
export function elderBodyGeometry(): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  sweep(pb, rings([[0, 0.38, 0.34], [0.05, 0.37, 0.33], [0.3, 0.3, 0.27], [0.65, 0.22, 0.2], [0.85, 0.2, 0.17], [1.0, 0.22, 0.17], [1.1, 0.12, 0.1]], i => (i === 0 ? 0xd8b25a : i === 1 ? 0xf0d27a : 0xffffff)), 0x7a58a8, { radial: 14, ref: V(1, 0, 0), capEnd: 'round', bump: (ri, a) => (ri > 1 && ri < 5 ? 0.05 * Math.sin(a * 5 + ri * 0.9) : 0) });  // soft vertical robe folds
  k.box(0.42, 0.07, 0.3, 0, 0.62, 0, 0xd8b25a); k.ball(0.05, 0, 0.62, 0.17, 0xfff0b0, 1, 1, 0.6, 0);
  for (let j = 0; j < 5; j++) { const a = -0.8 + j * 0.4; k.ball(0.022, Math.sin(a) * 0.37, 0.05, Math.cos(a) * 0.33, 0xfff0b0, 1, 1, 0.6, 0); }  // stitched gold beads along the hem
  k.box(0.14, 0.5, 0.04, 0, 0.36, 0.28, 0x8a68b8);            // a darker front panel
  k.ball(0.1, 0, 1.06, -0.12, 0x6a4a98, 1.6, 0.8, 1.2, 1);      // a cape-like collar at the back
  return k.build(0.1, 0.6);
}
/** An arm hanging from the shoulder (built around the shoulder so the group can rotate there). `s` = -1 left, +1 right. */
export function elderArmGeometry(s: -1 | 1): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  sweep(pb, curvePath(V(s * 0.2, 0.96, 0.0), V(s * 0.34, 0.8, 0.16), V(s * 0.28, 0.78, 0.38), 6, 0.1, 0.12, 1, 0x6a4a98, 0x8a68b8), 0xffffff, { radial: 8, ref: V(0, 1, 0), capEnd: 'round' });
  k.cyl(0.115, 0.125, 0.04, 8, s * 0.28, 0.77, 0.37, 0xd8b25a);  // gold cuff
  k.ball(0.065, s * 0.27, 0.77, 0.45, 0xe0b08a, 1, 1, 1, 1);
  const g = k.build(0.05, 0.6); g.translate(-s * ELDER_SHOULDER.x, -ELDER_SHOULDER.y, 0); return g;
}
/** Head, face, beard, moustache and the tall bent hat, around the neck so it can nod and turn. */
export function elderHeadGeometry(): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  k.ball(0.19, 0, 1.22, 0.02, 0xe0b08a, 1, 1.05, 1, 2);        // head
  k.ball(0.04, 0, 1.2, 0.2, 0xe0a07c, 1, 1, 1.3, 1);           // nose
  for (const s of [-1, 1]) { k.ball(0.03, s * 0.07, 1.25, 0.17, 0x1c1c22, 1, 1.2, 0.6, 0); k.ball(0.022, s * 0.062, 1.255, 0.19, 0xffffff, 1, 1, 0.5, 0); }  // eyes (with a glint); the bushy brows are separate meshes so they can move
  for (const s of [-1, 1]) k.ball(0.035, s * 0.12, 1.19, 0.14, 0xf0a090, 1, 0.7, 0.5, 1);   // rosy cheeks
  for (const s of [-1, 1]) k.ball(0.04, s * 0.19, 1.2, 0.0, 0xe0b08a, 0.6, 1.3, 1, 1);    // ears
  sweep(pb, curvePath(V(0, 1.14, 0.17), V(0.0, 0.8, 0.3), V(0.02, 0.45, 0.26), 8, 0.17, 0.02, 0.6, 0xfafaf6, 0xdad8d0), 0xffffff, { radial: 10, ref: V(1, 0, 0), capEnd: 'round', bump: (ri, a) => 0.1 * Math.sin(a * 3 + ri * 1.7) });
  k.ball(0.07, -0.06, 1.15, 0.2, 0xf4f2ec, 1.6, 0.5, 1, 1); k.ball(0.07, 0.06, 1.15, 0.2, 0xf4f2ec, 1.6, 0.5, 1, 1);  // moustache
  k.cyl(0.3, 0.3, 0.05, 14, 0, 1.36, 0, 0x5a3e86);             // hat brim
  sweep(pb, curvePath(V(0, 1.36, 0), V(0.02, 1.62, -0.05), V(0.2, 1.84, -0.22), 8, 0.2, 0.012, 1, 0x6a4a98, 0x8a68b8), 0xffffff, { radial: 12, ref: V(0, 0, 1), capEnd: 'round' });
  k.box(0.2, 0.04, 0.2, 0, 1.4, 0, 0xd8b25a); k.ball(0.045, 0.08, 1.58, 0.17, 0xffe066, 1, 1, 0.5, 0);
  k.ball(0.035, 0.2, 1.84, -0.22, 0xffe066, 1, 1, 1, 1);        // a little gold bobble on the hat tip
  const g = k.build(0.0, 1); g.translate(0, -ELDER_NECK_Y, 0); return g;
}
export function elderStaffGeometry(): BufferGeometry {
  const k = new Kit();
  sweep(k.pb, curvePath(V(0, 0, 0), V(0.03, 0.75, 0), V(0, 1.45, 0), 8, 0.032, 0.026, 1, 0x6b4a2a, 0x8a6240), 0xffffff, { radial: 6, ref: V(1, 0, 0), bump: (ri, a) => 0.2 * Math.sin(a * 2 + ri * 2) });
  for (let j = 0; j < 4; j++) { const a = j * 1.6; k.ball(0.05, Math.cos(a) * 0.07, 1.42 + j * 0.02, Math.sin(a) * 0.07, 0x7a5636, 1, 2, 1, 0); }
  return k.build(0, 1);
}

/** The Rune Stone's body: a broken base, a tapering pillar with chiselled faces, a cap slab, moss and a few fallen stones. */
export function runeStoneGeometry(): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  k.cyl(0.95, 1.05, 0.28, 7, 0, 0.14, 0, 0x7e857b); k.cyl(0.82, 0.92, 0.2, 7, 0.02, 0.38, 0, 0x8f968c, 0.3);
  sweep(pb, rings([[0.45, 0.66, 0.58], [0.9, 0.58, 0.5], [1.4, 0.52, 0.45], [1.45, 0.62, 0.55]], i => (i === 0 ? 0xb8bcb2 : i === 3 ? 0xd8dad2 : 0xffffff)), 0xa4aa9f, { radial: 8, ref: V(1, 0, 0), capEnd: 'flat', bump: (ri, a) => 0.06 * Math.sin(a * 4 + ri) });
  k.cyl(0.78, 0.62, 0.18, 8, 0, 1.52, 0, 0xb4b9b0, 0.2);
  k.ball(0.3, 0.5, 0.35, 0.45, 0x6fae4e, 1.3, 0.55, 1, 1); k.ball(0.22, -0.55, 0.3, 0.3, 0x7cc454, 1.3, 0.55, 1, 1); k.ball(0.18, 0.1, 1.62, -0.2, 0x7cc454, 1.5, 0.4, 1, 1);
  k.box(0.5, 0.3, 0.4, 0.9, 0.15, -0.5, 0x9aa095, 0.5); k.box(0.34, 0.24, 0.3, -0.9, 0.12, -0.5, 0x8f968c, -0.4);
  for (let j = 0; j < 7; j++) k.ball(0.05, 0.5 * Math.cos(j * 0.9), 0.6 + j * 0.13, 0.5 * Math.sin(j * 0.9), 0x5fb04a, 1, 1, 0.6, 0);
  return k.build(0.2, 0.9);
}

/** The petal: two layers of rounded petals (pink at the root, white at the tips) around a golden heart, on a stem with two leaves. */
export function petalFlowerGeometry(): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  const layer = (n: number, len: number, lift: number, w: number, base: number, tip: number, phase: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase; const c = V(Math.cos(a), 0, Math.sin(a));
      const path = curvePath(V(c.x * 0.02, 0, c.z * 0.02), V(c.x * len * 0.55, lift * 0.8, c.z * len * 0.55), V(c.x * len, lift, c.z * len), 5, w, w * 0.25, 0.35, base, tip);
      sweep(pb, path, 0xffffff, { radial: 6, ref: V(0, 1, 0), capEnd: 'round' });
    }
  };
  layer(6, 0.3, 0.1, 0.085, 0xff7cc4, 0xffeaf6, 0); layer(6, 0.22, 0.2, 0.07, 0xff9ad6, 0xfff6fc, 0.5); layer(5, 0.13, 0.26, 0.05, 0xffb4e0, 0xffffff, 0.2);
  k.ball(0.065, 0, 0.1, 0, 0xffd23a, 1, 0.8, 1, 1);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; k.ball(0.014, Math.cos(a) * 0.07, 0.18, Math.sin(a) * 0.07, 0xfff0a0, 1, 1, 1, 0); }
  return k.build(0, 1);
}
export function petalStemGeometry(): BufferGeometry {
  const k = new Kit(); const pb = k.pb;
  sweep(pb, curvePath(V(0, 0, 0), V(0.03, 0.35, 0), V(0, 0.7, 0), 5, 0.018, 0.014, 1, 0x3f8a3a, 0x6bb04a), 0xffffff, { radial: 5, ref: V(1, 0, 0) });
  for (const s of [-1, 1]) sweep(pb, curvePath(V(0, 0.2, 0), V(s * 0.12, 0.28, 0), V(s * 0.26, 0.22, 0.02), 4, 0.04, 0.005, 0.3, 0x4a9a3e, 0x8ad460), 0xffffff, { radial: 4, ref: V(0, 0, 1) });
  return k.build(0, 1);
}

// ------------------------------------------------------------------------------------------------ enemies

/** A smooth, lumpy blob (displaced icosphere) coloured by a function of its unit position. */
function blob(r: number, detail: number, scale: [number, number, number], seed: number, lump: number, colour: (ux: number, uy: number, uz: number, n: number) => Color): BufferGeometry {
  const g0 = new IcosahedronGeometry(1, detail); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  const g = mergeVertices(g0, 1e-4); const p = g.getAttribute('position'); const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i); const n = noise3(ux * 1.7 + seed, uy * 1.7, uz * 1.7 - seed); const k = r * (1 + lump * (n - 0.5));
    p.setXYZ(i, ux * k * scale[0], uy * k * scale[1], uz * k * scale[2]);
    const c = colour(ux, uy, uz, n); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
const mix = (a: number, b: number, t: number): Color => new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, t)));

/** The Sprout's body (tuft and face are separate so the tuft can sway). Faces +Z, ~0.9 m tall. */
export function sproutBodyGeometry(): BufferGeometry {
  const k = new Kit(); const bulb = blob(0.46, 3, [1, 0.92, 1], 4, 0.18, (_ux, uy, uz, n) => mix(0xb6e26a, 0x59b24a, (uy + 0.3) * 0.9).lerp(new Color(0xf2f7c4), Math.max(0, uz * 0.6 + 0.1 - uy * 0.2) * 0.35).multiplyScalar(0.9 + 0.2 * n));
  bulb.translate(0, 0.46, 0); k.add(bulb, 0xffffff);
  for (const s of [-1, 1]) { k.ball(0.14, s * 0.22, 0.1, 0.12, 0x8a6a46, 1, 0.7, 1.4, 1); k.ball(0.085, s * 0.32, 0.22, 0.02, 0x59b24a, 1, 1.4, 1, 1); }
  k.ball(0.1, 0, 0.36, 0.45, 0xe9a07a, 1, 0.7, 0.8, 1);  // a small cheek-nose
  for (const s of [-1, 1]) { k.ball(0.115, s * 0.17, 0.58, 0.37, 0xffffff, 1, 1.1, 0.7, 1); k.ball(0.06, s * 0.17, 0.57, 0.43, 0x1a1a22, 1, 1.1, 0.6, 1); k.ball(0.02, s * 0.15, 0.6, 0.47, 0xffffff, 1, 1, 1, 0); }
  // (the brows and the mouth are separate meshes in SproutView so they can scowl and shout)
  return k.build(0, 1);
}
export function sproutLeafGeometry(): BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const c = V(Math.cos(a), 0, Math.sin(a)); const len = i % 2 ? 0.34 : 0.44;
    sweep(k.pb, curvePath(V(c.x * 0.02, 0, c.z * 0.02), V(c.x * len * 0.4, len * 0.65, c.z * len * 0.4), V(c.x * len * 0.85, len * 0.9, c.z * len * 0.85), 5, 0.075, 0.01, 0.3, 0x4f9f3f, i % 2 ? 0xa6e870 : 0x8ad860), 0xffffff, { radial: 4, ref: V(0, 1, 0), capEnd: 'round' }); }
  k.ball(0.05, 0, 0.1, 0, 0xffe066, 1, 1, 1, 1);
  return k.build(0, 1);
}

/** The Old Mossback's shell: ellipsoid radii (about the shell centre, which sits MOSS_SHELL_Y above the feet) and a point + normal on its surface. */
export const MOSS_SHELL_Y = 1.35;
export const MOSS_SHELL_R = { x: 1.575, y: 1.11, z: 1.95 } as const;
export function mossSurface(x: number, z: number): { p: Vector3; n: Vector3 } {
  const R = MOSS_SHELL_R, f = 1 - (x / R.x) ** 2 - (z / R.z) ** 2, y = R.y * Math.sqrt(Math.max(0.04, f));
  return { p: new Vector3(x, y, z), n: new Vector3(x / R.x ** 2, y / R.y ** 2, z / R.z ** 2).normalize() };
}
const UP = new Vector3(0, 1, 0);
/** A cone standing on `base`, pointing along `dir` (unit). */
function coneOn(k: Kit, base: Vector3, dir: Vector3, r: number, h: number, color: number, sides = 5): void {
  const q = new Quaternion().setFromUnitVectors(UP, dir), pos = base.clone().addScaledVector(dir, h / 2);
  k.add(new ConeGeometry(r, h, sides, 1), color, new Matrix4().compose(pos, q, new Vector3(1, 1, 1)));
}

/** The Old Mossback: a domed shell of dark, cracked stone with patchy moss on top (crystals, spikes, cracks and tail are separate so they can move). ~2.2 m wide. */
export function mossShellGeometry(): BufferGeometry {
  const k = new Kit();
  const shell = blob(1.5, 3, [1.05, 0.74, 1.3], 9, 0.2, (ux, uy, uz, n) => {
    const plate = Math.abs(Math.sin(ux * 5.5 + noise3(ux * 2, uy * 2, uz * 2) * 2)) * Math.abs(Math.sin(uz * 5.5 + uy * 3));
    const c = mix(0x3b4541, 0x8d978a, 0.45 + uy * 0.35 - plate * 0.55).multiplyScalar(0.8 + 0.3 * n);
    return c.lerp(mix(0x2f5a2c, 0x6f9f42, n), Math.max(0, uy - 0.45 + (n - 0.5) * 0.7) * 1.5);   // darker stone, moss only in patches
  });
  shell.translate(0, MOSS_SHELL_Y, 0); k.add(shell, 0xffffff);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; k.ball(0.22, Math.cos(a) * 1.55, 0.6, Math.sin(a) * 1.9, 0x3f6a36, 1, 0.6, 1, 1); }  // moss skirt
  for (const [x, z] of [[-0.9, -0.7], [0.5, 0.4]] as const) k.ball(0.4, x, 2.0, z, 0x5f9a42, 1.3, 0.35, 1.1, 1);
  return k.build(0.1, 1);
}
/** Stone thorns along the spine and flanks, built about the shell centre (the view scales this group so the thorns bristle when it is angry). */
export function mossSpikesGeometry(): BufferGeometry {
  const k = new Kit();
  const put = (x: number, z: number, h: number, r: number, lean = 0): void => {
    const { p, n } = mossSurface(x, z); const d = n.clone().add(new Vector3(0, 0, lean)).normalize();
    coneOn(k, p.clone().addScaledVector(n, -0.08), d, r, h, 0x4a524d); coneOn(k, p.clone().addScaledVector(d, h * 0.62 - 0.08), d, r * 0.42, h * 0.38, 0xd9d2b4);   // dark stone thorn with a pale bone tip
  };
  [-1.5, -1.05, -0.6, -0.15, 0.3, 0.75, 1.2].forEach((z, i) => put(0, z, 0.5 + 0.34 * (1 - Math.abs(i - 3) / 3), 0.2 + 0.06 * (1 - Math.abs(i - 3) / 3), -0.25));
  for (const s of [-1, 1]) {
    [-1.1, -0.45, 0.2, 0.85].forEach((z, i) => put(s * 0.85, z, 0.42 + (i % 2) * 0.1, 0.15, -0.2));
    [-0.6, 0.4].forEach(z => put(s * 1.3, z, 0.34, 0.12, -0.1));
  }
  const g = k.build(0, 1); g.translate(0, -MOSS_SHELL_Y, 0); return g;
}
/** A heavy tail with a spiked stone club, pointing -Z from its pivot. */
export function mossTailGeometry(): BufferGeometry {
  const k = new Kit();
  k.ball(0.3, 0, 0, -0.15, 0x4d5a50, 1, 0.9, 1.3, 1); k.ball(0.24, 0, 0.02, -0.72, 0x56645a, 1, 0.9, 1.2, 1); k.ball(0.4, 0, 0.06, -1.3, 0x626f64, 1, 0.95, 1, 1);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, d = new Vector3(Math.cos(a), Math.sin(a), -0.35).normalize(); coneOn(k, new Vector3(0, 0.06, -1.3).addScaledVector(d, 0.3), d, 0.1, 0.34, 0xd9d2b4); }
  return k.build(0, 1);
}
/** The head: heavy angry brow, horns, nostrils and a row of upper teeth over a dark mouth. Faces +Z. The eyes and the lower jaw are separate. */
export function mossHeadGeometry(): BufferGeometry {
  const k = new Kit();
  const head = blob(0.55, 3, [1.0, 0.8, 1.15], 3, 0.15, (_ux, uy, _uz, n) => mix(0x4c5a4d, 0x87978a, 0.5 + uy * 0.5).multiplyScalar(0.9 + 0.2 * n).lerp(new Color(0x4f8a3c), Math.max(0, uy - 0.55) * 1.2));
  k.add(head, 0xffffff);
  for (const s of [-1, 1]) {
    k.box(0.5, 0.13, 0.22, s * 0.28, 0.33, 0.45, 0x27302a, 0, s * 0.5);                 // heavy brow, slanted down toward the nose: angry
    k.box(0.4, 0.07, 0.16, s * 0.3, 0.41, 0.4, 0x4a5b4a, 0, s * 0.42);
    coneOn(k, new Vector3(s * 0.38, 0.38, -0.05), new Vector3(s * 0.55, 0.55, -0.62).normalize(), 0.11, 0.55, 0xcfc8a8);   // swept-back horn
    k.ball(0.045, s * 0.13, 0.0, 0.66, 0x1c231d, 1, 1, 0.6, 0);                           // nostril
  }
  k.box(0.7, 0.05, 0.5, 0, -0.12, 0.3, 0x3b0d12);                                         // the dark inside of the upper lip
  for (const x of [-0.24, -0.08, 0.08, 0.24]) coneOn(k, new Vector3(x, -0.1, 0.56 - Math.abs(x) * 0.25), new Vector3(0, -1, 0.15).normalize(), 0.05, 0.15, 0xf2ecd2, 4);
  for (const s of [-1, 1]) coneOn(k, new Vector3(s * 0.32, -0.1, 0.5), new Vector3(s * 0.05, -1, 0.1).normalize(), 0.07, 0.24, 0xf7f1da, 4);   // upper fangs
  k.ball(0.18, 0, 0.5, -0.05, 0x5f9a42, 1.3, 0.5, 1, 1);                                  // moss tuft
  return k.build(0, 1);
}
/** The lower jaw, hinged at the back (the pivot is the origin): chin, tusks and lower teeth. */
export function mossJawGeometry(): BufferGeometry {
  const k = new Kit();
  k.box(0.66, 0.15, 0.62, 0, -0.07, 0.31, 0x3e4b40); k.box(0.52, 0.06, 0.46, 0, 0.0, 0.3, 0x5a141a);            // chin and the red mouth floor
  k.ball(0.17, 0, -0.14, 0.56, 0x4a7a3a, 1.2, 0.6, 0.9, 1);                                                    // mossy chin
  for (const x of [-0.18, 0, 0.18]) coneOn(k, new Vector3(x, 0.02, 0.58 - Math.abs(x) * 0.3), new Vector3(0, 1, 0.1).normalize(), 0.045, 0.12, 0xf2ecd2, 4);
  for (const s of [-1, 1]) coneOn(k, new Vector3(s * 0.3, 0.0, 0.5), new Vector3(s * 0.2, 1, 0.35).normalize(), 0.08, 0.34, 0xf7f1da, 5);   // big tusks
  return k.build(0, 1);
}
export function mossLegGeometry(): BufferGeometry {
  const k = new Kit(); k.cyl(0.36, 0.44, 0.9, 8, 0, -0.4, 0, 0x6a786a); k.cyl(0.3, 0.36, 0.14, 8, 0, 0.0, 0, 0x4f8a3c);
  for (const x of [-0.2, 0, 0.2]) k.add(new ConeGeometry(0.075, 0.3, 5, 1), 0xe8e2c8, new Matrix4().compose(new Vector3(x, -0.78, 0.46), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 + 0.45), new Vector3(1, 1, 1)));   // claws
  k.ball(0.45, 0, -0.85, 0, 0x3f4a3d, 1.1, 0.35, 1.1, 1);
  return k.build(0, 1);
}

// ------------------------------------------------------------------------------------------------ v2.28 Crystal Hollow

/** The Shardling's body: a squat, lumpy lump of violet-blue stone with a pale belly, stubby feet, big glinting eyes and rosy cheeks. Faces +Z, ~0.85 m tall. The crest, lids, brows and mouth are separate so they can move. */
export function shardlingBodyGeometry(): BufferGeometry {
  const k = new Kit();
  const rock = blob(0.44, 3, [1.12, 0.86, 1.0], 11, 0.2, (_ux, uy, uz, n) => mix(0x4f5594, 0x9aa2e6, (uy + 0.45) * 0.8).lerp(new Color(0xe3e6ff), Math.max(0, uz * 0.6 + 0.05 - uy * 0.25) * 0.4).multiplyScalar(0.88 + 0.24 * n));
  rock.translate(0, 0.4, 0); k.add(rock, 0xffffff);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.ball(0.115, sx * 0.27, 0.09, sz * 0.2 + 0.04, 0x40447e, 1, 0.7, 1.25, 1);   // four stubby feet
  for (const s of [-1, 1]) {
    k.ball(0.115, s * 0.17, 0.52, 0.36, 0xffffff, 1, 1.1, 0.7, 1); k.ball(0.062, s * 0.17, 0.51, 0.43, 0x1a1a2a, 1, 1.1, 0.6, 1); k.ball(0.022, s * 0.15, 0.545, 0.475, 0xffffff, 1, 1, 1, 0);   // eye, pupil, glint
    k.ball(0.07, s * 0.3, 0.36, 0.3, 0xff9ac8, 1, 0.7, 0.5, 1);                                                                                                                                   // rosy cheek
    k.ball(0.09, s * 0.43, 0.3, 0.02, 0x7a82cc, 1, 1.2, 1, 1);                                                                                                                                    // a little side nub (an arm)
  }
  k.ball(0.04, 0, 0.4, 0.45, 0xe9a0c0, 1, 0.8, 0.8, 1);     // small nose
  return k.build(0.12, 0.7);
}
/** A crest of crystal shards on the Shardling's back and head (near-white, tinted per creature by the material), built about the top of the body so it can bristle. */
export function shardlingCrestGeometry(): BufferGeometry {
  const k = new Kit();
  const shard = (x: number, y: number, z: number, h: number, r: number, tx: number, tz: number, c: number): void => { k.add(new ConeGeometry(r, h, 6, 1), c, M(x, y + h / 2, z, tx, 0, tz)); k.add(new ConeGeometry(r * 1.02, h * 0.28, 6, 1), 0xffffff, M(x + Math.sin(tz) * -h * 0.4, y + h * 0.9, z + Math.sin(tx) * h * 0.4, tx, 0, tz)); };
  shard(0, 0.0, -0.08, 0.56, 0.1, 0.0, 0.0, 0xdff4ff); shard(-0.2, -0.03, -0.12, 0.4, 0.085, -0.15, 0.5, 0xbfe6ff); shard(0.2, -0.03, -0.12, 0.42, 0.085, -0.15, -0.5, 0xbfe6ff);
  shard(-0.1, -0.06, -0.3, 0.32, 0.07, -0.55, 0.2, 0xaadcf8); shard(0.12, -0.06, -0.3, 0.3, 0.07, -0.55, -0.2, 0xaadcf8); shard(0, 0.0, 0.2, 0.2, 0.05, 0.4, 0, 0xe8f8ff);   // a small tuft over the forehead
  return k.build(0, 1);
}

/** The Hollow Warden's torso: a squat, heavy egg of dark indigo stone with gold trim, a recessed chest window for the dimmed heart, shoulder plates and stubby feet. Faces +Z, ~1.9 m tall without the head. */
export const WARDEN_NECK_Y = 1.72;
export function wardenBodyGeometry(): BufferGeometry {
  const k = new Kit();
  const stone = blob(0.95, 3, [1.0, 0.98, 0.86], 21, 0.14, (ux, uy, uz, n) => {
    const plate = Math.abs(Math.sin(ux * 4.2 + noise3(ux * 2, uy * 2, uz * 2) * 1.5)) * Math.abs(Math.sin(uy * 3.4 + uz * 2));
    return mix(0x2c2f66, 0x6f77bc, 0.4 + uy * 0.35 - plate * 0.4).multiplyScalar(0.85 + 0.25 * n);
  });
  stone.translate(0, 1.0, 0); k.add(stone, 0xffffff);
  k.cyl(0.9, 0.96, 0.13, 14, 0, 0.62, 0, 0xe6c36a); k.cyl(0.62, 0.7, 0.06, 14, 0, 0.7, 0, 0xfff0b0);                 // a gold belt
  k.ball(0.37, 0, 1.15, 0.7, 0x16143a, 1, 1.15, 0.45, 1);                                                          // the recessed chest window (the heart floats in it)
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.ball(0.045, Math.sin(a) * 0.42, 1.15 + Math.cos(a) * 0.5, 0.74, 0xe6c36a, 1, 1, 0.7, 0); }   // gold studs round the window
  for (const s of [-1, 1]) {
    k.ball(0.4, s * 0.88, 1.58, 0.02, 0x59608e, 1.05, 0.8, 1.05, 1); k.ball(0.14, s * 0.88, 1.84, 0.02, 0xe6c36a, 1, 0.8, 1, 1);   // shoulder plate with a gold boss
    for (let j = 0; j < 3; j++) coneOn(k, new Vector3(s * (0.84 + j * 0.08), 1.68 - j * 0.04, -0.2 + j * 0.2), new Vector3(s * 0.7, 0.7, 0).normalize(), 0.06, 0.24, 0xb59cff, 5);   // crystal spikes on the shoulder
    k.ball(0.33, s * 0.46, 0.2, 0.1, 0x3d4284, 1.15, 0.65, 1.3, 1);                                                   // stubby foot
  }
  k.ball(0.3, 0, 1.3, -0.78, 0x4a5190, 1.3, 1.1, 0.8, 1);                                                          // a hump of rock on the back
  for (const [x, y] of [[-0.25, 1.65], [0, 1.78], [0.25, 1.65]] as const) coneOn(k, new Vector3(x, y, -0.7), new Vector3(x * 0.6, 0.6, -0.8).normalize(), 0.09, 0.4, i2c(x), 6);   // three crystals up the back
  return k.build(0.12, 1);
}
const i2c = (x: number): number => (x < 0 ? 0xff9fd8 : x > 0 ? 0xb59cff : 0x9fe6ff);
/** The Warden's big round head (chibi: nearly as wide as the body) with a heavy brow, a crown of crystals, cheek crystals and a slit of a mouth with small teeth. Built about the neck. The glowing eyes are separate. Faces +Z. */
export function wardenHeadGeometry(): BufferGeometry {
  const k = new Kit();
  const head = blob(0.82, 3, [1.06, 0.9, 1.0], 31, 0.1, (_ux, uy, uz, n) => mix(0x3a3f7c, 0x8087cc, 0.5 + uy * 0.4).lerp(new Color(0xaab0e8), Math.max(0, uz * 0.5) * 0.25).multiplyScalar(0.9 + 0.2 * n));
  head.translate(0, 0.62, 0.04); k.add(head, 0xffffff);
  for (const s of [-1, 1]) {
    k.box(0.52, 0.14, 0.24, s * 0.33, 0.94, 0.7, 0x20224c, 0, s * 0.45);                    // heavy brow, slanted toward the nose (cross, but a little silly)
    k.box(0.42, 0.06, 0.18, s * 0.34, 1.02, 0.66, 0x59608e, 0, s * 0.4);
    coneOn(k, new Vector3(s * 0.74, 0.42, 0.34), new Vector3(s, 0.1, 0.2).normalize(), 0.09, 0.34, s < 0 ? 0xff9fd8 : 0xb59cff, 5);   // cheek crystals
    k.ball(0.06, s * 0.24, 0.5, 0.78, 0x1a1840, 1, 1, 0.6, 0);                                // nostril dots
  }
  k.box(0.62, 0.1, 0.2, 0, 0.3, 0.76, 0x120f2e);                                            // the mouth slit
  for (const x of [-0.2, -0.07, 0.07, 0.2]) coneOn(k, new Vector3(x, 0.35, 0.82), new Vector3(0, -1, 0.1).normalize(), 0.04, 0.12, 0xf4f0ff, 4);   // small teeth
  // crown: five crystals round the top, tallest at the back
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45, h = 0.62 + (i === 2 ? 0.2 : 0) + (i % 2) * 0.1; coneOn(k, new Vector3(Math.sin(a) * 0.5, 1.28 - Math.abs(a) * 0.12, -0.12 + Math.cos(a) * 0.05), new Vector3(Math.sin(a) * 0.45, 1, -0.2).normalize(), 0.12, h, [0xff9fd8, 0xb59cff, 0xffd68a, 0xb59cff, 0xff9fd8][i], 6); }
  k.cyl(0.5, 0.56, 0.1, 14, 0, 1.2, -0.02, 0xe6c36a);                                       // a gold crown band
  return k.build(0, 1);
}
/** A floating fist (the Warden has no arms): a rounded stone knuckle with gold studs and a wrist crystal pointing back. `s` = -1 left, +1 right. */
export function wardenFistGeometry(s: -1 | 1): BufferGeometry {
  const k = new Kit();
  const fist = blob(0.5, 3, [1.12, 0.95, 1.1], 41 + s, 0.12, (_ux, uy, _uz, n) => mix(0x3a3f78, 0x7a82c6, 0.4 + uy * 0.4).multiplyScalar(0.9 + 0.2 * n));
  k.add(fist, 0xffffff);
  for (let i = 0; i < 4; i++) k.ball(0.065, (i - 1.5) * 0.2, 0.2, 0.46 - Math.abs(i - 1.5) * 0.06, 0xe6c36a, 1, 1, 0.8, 1);   // gold knuckle studs
  coneOn(k, new Vector3(s * 0.4, 0.05, -0.2), new Vector3(s * 0.8, 0.3, -0.5).normalize(), 0.12, 0.5, s < 0 ? 0xff9fd8 : 0xb59cff, 6);       // wrist crystal
  k.cyl(0.46, 0.46, 0.08, 12, 0, -0.38, 0, 0xe6c36a);                                       // a gold cuff on the underside
  return k.build(0.05, 1);
}
/** The heart that hangs in the Warden's chest: a faceted gem (octahedron) the view makes glow. Origin at its centre. */
export function wardenHeartGeometry(): BufferGeometry { return new OctahedronGeometry(0.3, 0); }

/** Glim the lantern sprite: a round, cloud-pale body with a crystal horn, two leaf ears, big glinting eyes, rosy cheeks, tiny hands and a wisp of a tail. Floats; origin at the middle of the body. Faces +Z. ~0.9 m tall. */
export function glimBodyGeometry(): BufferGeometry {
  const k = new Kit();
  const body = blob(0.32, 3, [1.0, 1.08, 0.96], 51, 0.1, (_ux, uy, uz, n) => mix(0x9fdcf0, 0xeafaff, 0.45 + uy * 0.4 + uz * 0.1).multiplyScalar(0.96 + 0.1 * n));
  k.add(body, 0xffffff);
  for (const s of [-1, 1]) {
    k.ball(0.092, s * 0.12, 0.06, 0.26, 0xffffff, 1, 1.15, 0.7, 1); k.ball(0.05, s * 0.12, 0.05, 0.325, 0x14243a, 1, 1.15, 0.6, 1); k.ball(0.018, s * 0.105, 0.085, 0.358, 0xffffff, 1, 1, 1, 0);   // eye, pupil, glint
    k.ball(0.055, s * 0.22, -0.05, 0.22, 0xffa8cc, 1, 0.7, 0.5, 1);                                                                                                                                  // rosy cheek
    k.ball(0.075, s * 0.33, -0.1, 0.1, 0xcaeefa, 1, 1, 1, 1);                                                                                                                                        // a tiny hand
    coneOn(k, new Vector3(s * 0.2, 0.26, -0.02), new Vector3(s * 0.8, 0.8, 0).normalize(), 0.075, 0.3, 0x8fe0c8, 5);                                                                              // leaf ear
  }
  coneOn(k, new Vector3(0, 0.3, 0.02), new Vector3(0, 1, 0.05).normalize(), 0.08, 0.36, 0x9fe8ff, 6);        // the crystal horn (its lantern light)
  k.ball(0.03, 0, -0.02, 0.31, 0xf0a0c0, 1, 0.8, 0.8, 1);                                                    // a small nose
  coneOn(k, new Vector3(0, -0.28, -0.04), new Vector3(0, -1, -0.15).normalize(), 0.14, 0.42, 0xb8e8f8, 7);   // a tapering tail, so it hovers rather than stands
  coneOn(k, new Vector3(-0.1, -0.3, -0.08), new Vector3(-0.35, -1, -0.3).normalize(), 0.07, 0.3, 0xcff0fa, 6); coneOn(k, new Vector3(0.1, -0.3, -0.08), new Vector3(0.35, -1, -0.3).normalize(), 0.07, 0.3, 0xcff0fa, 6);
  return k.build(0, 1);
}
