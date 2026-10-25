/**
 * Procedural stylised trees (oak, pine, birch, blossom, dead, and the glowing Ancient Tree). Each is one merged, vertex-coloured
 * geometry with a detailed and a simple level of detail, so a few hundred of them can be instanced cheaply.
 *
 * v2.6 detail pass: foliage is lumpy smooth-shaded clumps (dark inside, bright on top, painted in quantised patches) PLUS a skin of
 * small pointed leaf tufts that break up the silhouette and catch the light; trunks have ridged bark, bark plates, knots, moss,
 * buttress roots and forked branches; pines have jagged tiers with hanging needle fringes; a twisted dead tree and a pink blossom
 * tree add variety. Only the detailed model carries the leaf tufts and plates; the far model stays light.
 */
import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../systems/layout3d';
import { PartBuilder, lerp, smooth, sweep, type Ring } from '../hero/geom';
import { fbm2, noise3 } from './noise';

export type TreeKind = 'oak' | 'pine' | 'birch' | 'blossom' | 'dead';
export interface TreeModel { hi: BufferGeometry; lo: BufferGeometry }

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const UP = V(0, 1, 0);
const part = () => new PartBuilder(() => 0);

interface Palette { bottom: number; top: number; tipHue?: number; accent?: number; accentChance?: number }
interface Crown { centre: Vector3; radius: number }

/** Position on the surface of a foliage clump for unit direction (ux, uy, uz). Shared by the clump mesh and its leaf tufts. */
function clumpSurface(c: Vector3, r: number, seed: number, squash: number, ux: number, uy: number, uz: number, out: Vector3): number {
  const n = noise3(ux * 1.9 + seed, uy * 1.9 + seed * 0.7, uz * 1.9 - seed);
  const n2 = noise3(ux * 4.3 - seed, uy * 4.3, uz * 4.3 + seed * 0.4);
  const k = r * (0.84 + 0.34 * n) * (0.95 + 0.1 * n2);
  out.set(c.x + ux * k, c.y + uy * k * squash, c.z + uz * k);
  return n;
}

/** A lumpy foliage blob centred at `c`, added to `pb`, shaded by height and by distance from the crown centre. */
function clump(pb: PartBuilder, c: Vector3, r: number, detail: number, seed: number, pal: Palette, crown: Crown, squash = 0.82): void {
  let g: BufferGeometry = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute('position');
  const bottom = new Color(pal.bottom), top = new Color(pal.top), tmp = new Color(), tip = new Color(pal.tipHue ?? pal.top);
  const base = pb.vertexCount; const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const n = clumpSurface(c, r, seed, squash, ux, uy, uz, p);
    const up = smooth(uy * 0.5 + 0.5);
    const d = Math.hypot(p.x - crown.centre.x, p.y - crown.centre.y, p.z - crown.centre.z) / crown.radius;
    const ao = lerp(0.7, 1, smooth(d * 0.9));
    tmp.copy(bottom).lerp(top, up);
    tmp.lerp(tip, Math.max(0, up - 0.65) * (0.4 + 0.6 * n));
    // painted patches: quantised noise gives the foliage a clustered, hand-painted look
    const patch = Math.floor(noise3(ux * 3.4 + seed * 1.3, uy * 3.4, uz * 3.4) * 4) / 4;
    tmp.multiplyScalar(ao * (0.88 + 0.26 * patch) * (0.94 + 0.12 * noise3(p.x * 2.3, p.y * 2.3, p.z * 2.3)));
    pb.addVertex(p, tmp);
  }
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) pb.addTri(base + idx.getX(i), base + idx.getX(i + 1), base + idx.getX(i + 2));
}

/** Collects small pointed leaf tufts (own normals, blended towards "outwards" for soft lighting). Merged into the tree at the end. */
export class LeafBuilder {
  private pos: number[] = []; private col: number[] = []; private nor: number[] = []; private idx: number[] = [];
  private readonly fa = new Vector3(); private readonly fb = new Vector3();
  leaf(base: Vector3, tip: Vector3, side: Vector3, w: number, nrm: Vector3, cBase: Color, cMid: Color, cTip: Color): void {
    const mid = base.clone().lerp(tip, 0.4);
    const l = mid.clone().addScaledVector(side, w), r = mid.clone().addScaledVector(side, -w);
    const i0 = this.pos.length / 3;
    for (const [p, c] of [[base, cBase], [l, cMid], [r, cMid], [tip, cTip]] as const) { this.pos.push(p.x, p.y, p.z); this.col.push(c.r, c.g, c.b); this.nor.push(nrm.x, nrm.y, nrm.z); }
    const fn = this.fa.subVectors(l, base).cross(this.fb.subVectors(tip, base));
    if (fn.dot(nrm) >= 0) this.idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); else this.idx.push(i0, i0 + 3, i0 + 1, i0, i0 + 2, i0 + 3);
  }
  get empty(): boolean { return this.pos.length === 0; }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setIndex(this.idx); g.computeBoundingSphere();
    return g;
  }
}

/** Covers a foliage clump (same centre/radius/seed as the clump mesh) with `count` leaf tufts of three pointed leaves each. */
function leafTufts(lb: LeafBuilder, c: Vector3, r: number, squash: number, seed: number, count: number, size: number, pal: Palette, crown: Crown, rnd: () => number): void {
  const bottom = new Color(pal.bottom), top = new Color(pal.top), tipC = new Color(pal.tipHue ?? pal.top), acc = pal.accent !== undefined ? new Color(pal.accent) : null;
  const P = new Vector3(), n = new Vector3(), t1 = new Vector3(), t2 = new Vector3(), dir = new Vector3(), base = new Vector3(), tip = new Vector3(), side = new Vector3(), nrm = new Vector3();
  const cA = new Color(), cB = new Color(), cC = new Color();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2; const rr = Math.sqrt(Math.max(0, 1 - y * y)); const a = i * golden + seed;
    let ux = Math.cos(a) * rr + (rnd() - 0.5) * 0.18, uy = y + (rnd() - 0.5) * 0.18, uz = Math.sin(a) * rr + (rnd() - 0.5) * 0.18;
    const len = Math.hypot(ux, uy, uz); ux /= len; uy /= len; uz /= len;
    if (uy < -0.4 && rnd() < 0.65) continue; // few under the crown
    clumpSurface(c, r, seed, squash, ux, uy, uz, P);
    n.set(ux, uy, uz); P.addScaledVector(n, 0.03 * size);
    t1.crossVectors(n, Math.abs(n.y) < 0.9 ? UP : V(1, 0, 0)).normalize(); t2.crossVectors(n, t1);
    const up = smooth(uy * 0.5 + 0.5);
    const d = Math.hypot(P.x - crown.centre.x, P.y - crown.centre.y, P.z - crown.centre.z) / crown.radius;
    const ao = lerp(0.68, 1, smooth(d * 0.9));
    const useAcc = acc && rnd() < (pal.accentChance ?? 0.15);
    const shade = (0.88 + 0.28 * rnd()) * ao;
    cA.copy(bottom).lerp(top, up * 0.7).multiplyScalar(0.72 * shade);
    cB.copy(bottom).lerp(top, up).multiplyScalar(0.98 * shade);
    cC.copy(bottom).lerp(top, up).lerp(tipC, up * (0.3 + 0.6 * rnd())).multiplyScalar(1.12 * shade);
    if (useAcc) { cB.lerp(acc!, 0.6); cC.copy(acc!).multiplyScalar(1.0 + 0.1 * rnd()); }
    const sz = size * (0.75 + 0.5 * rnd()); const a0 = rnd() * 6.283;
    for (let k = 0; k < 2; k++) {
      const ang = a0 + (k - 0.5) * 1.5;
      dir.copy(t1).multiplyScalar(Math.cos(ang)).addScaledVector(t2, Math.sin(ang));
      base.copy(P).addScaledVector(n, -0.05 * sz);
      tip.copy(P).addScaledVector(n, 0.4 * sz).addScaledVector(dir, 0.78 * sz); tip.y -= 0.14 * sz;
      side.crossVectors(n, dir).normalize();
      const face = new Vector3().crossVectors(side, dir.clone().addScaledVector(n, 0.4)).normalize();
      nrm.copy(n).multiplyScalar(0.72).addScaledVector(face, face.dot(n) >= 0 ? 0.28 : -0.28).normalize();
      lb.leaf(base, tip, side, 0.36 * sz, nrm, cA, cB, cC);
    }
  }
}

/** A tapering tube along a bent path (trunks, branches, roots). `bark` is the base colour; the foot is darker (ground contact). */
function limb(pb: PartBuilder, pts: Vector3[], r0: number, r1: number, bark: number, radial = 7, flare = 0, ridges = 0.06): void {
  const rings: Ring[] = pts.map((p, i) => {
    const t = i / (pts.length - 1);
    const r = lerp(r0, r1, Math.pow(t, 0.8)) * (1 + flare * Math.pow(1 - t, 4));
    const shade = lerp(0.8, 1.12, smooth(t * 1.6)) * (i % 2 ? 0.96 : 1.04);
    return { p, rA: r, rB: r, tint: new Color(0xffffff).multiplyScalar(shade).getHex() };
  });
  sweep(pb, rings, bark, { radial, ref: V(1, 0, 0), capEnd: 'round', bump: (ri, ang) => ridges * Math.sin(ang * 4 + ri * 1.3) + ridges * 0.6 * Math.sin(ang * 7 - ri * 0.8) });
}

const bend = (x: number, z: number, h: number, steps = 6, wob = 0.12): Vector3[] =>
  Array.from({ length: steps }, (_, i) => { const t = i / (steps - 1); return V(x + Math.sin(t * 2.2 + x) * wob * t * h * 0.3, t * h, z + Math.cos(t * 1.7 + z) * wob * t * h * 0.3); });

const pointOn = (pts: Vector3[], y: number): Vector3 => {
  for (let i = 0; i < pts.length - 1; i++) if (y <= pts[i + 1].y) { const t = (y - pts[i].y) / Math.max(1e-4, pts[i + 1].y - pts[i].y); return pts[i].clone().lerp(pts[i + 1], Math.min(1, Math.max(0, t))); }
  return pts[pts.length - 1].clone();
};

const Z_AXIS = V(0, 0, 1);
/** A small flattened blob stuck on a trunk (bark plate, knot, fungus shelf, moss patch). */
function stick(pb: PartBuilder, at: Vector3, outward: Vector3, sx: number, sy: number, sz: number, colour: number, detail = 0): void {
  const g = new IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const q = new Quaternion().setFromUnitVectors(Z_AXIS, outward.clone().normalize());
  pb.addGeometry(mergeVertices(g, 1e-4), new Matrix4().compose(at, q, V(sx, sy, sz)), colour);
}

/** Bark plates, knots and moss on the lower trunk, so the trunk reads as bark and not as a plain tube. */
function barkDetail(pb: PartBuilder, trunk: Vector3[], rAt: (y: number) => number, h: number, rnd: () => number, moss: boolean): void {
  for (let i = 0; i < 12; i++) {
    const y = 0.25 + rnd() * h * 0.7, a = rnd() * 6.283; const c = pointOn(trunk, y); const o = V(Math.cos(a), 0.1, Math.sin(a));
    const r = rAt(y);
    stick(pb, c.clone().addScaledVector(o, r * 0.96), o, 0.07 + rnd() * 0.06, 0.1 + rnd() * 0.12, 0.035, rnd() < 0.5 ? 0x6a4c34 : 0xb08a62);
  }
  { const y = 0.7 + rnd() * 0.8, a = rnd() * 6.283; const c = pointOn(trunk, y); const o = V(Math.cos(a), 0, Math.sin(a)); stick(pb, c.addScaledVector(o, rAt(y) * 0.92), o, 0.1, 0.13, 0.05, 0x3a281a, 1); } // a knot-hole
  if (moss) {
    const a = rnd() * 6.283; const o = V(Math.cos(a), 0.2, Math.sin(a)); const c = pointOn(trunk, 0.35);
    stick(pb, c.clone().addScaledVector(o, rAt(0.35) * 0.9), o, 0.26, 0.42, 0.1, 0x6fae4e, 1);
    stick(pb, pointOn(trunk, 0.05).addScaledVector(o, rAt(0.05) * 0.8), o, 0.34, 0.2, 0.12, 0x5f9e44, 1);
  }
}

/** Buttress roots that flare out of the trunk and dive into the ground. */
function roots(pb: PartBuilder, n: number, r0: number, reach: number, seed: number, bark: number, radial: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed * 0.9 + (i % 2) * 0.2; const L = reach * (0.8 + 0.4 * ((i * 37 + seed * 11) % 10) / 10);
    limb(pb, [V(Math.cos(a) * r0 * 0.3, 0.42, Math.sin(a) * r0 * 0.3), V(Math.cos(a) * L * 0.38, 0.2, Math.sin(a) * L * 0.38), V(Math.cos(a + 0.12) * L * 0.72, 0.05, Math.sin(a + 0.12) * L * 0.72), V(Math.cos(a + 0.18) * L, -0.08, Math.sin(a + 0.18) * L)], r0 * 0.42, 0.03, bark, radial, 0.2, 0.04);
  }
}

const OAK_PALS: Palette[] = [
  { bottom: 0x3a7a3c, top: 0x7cc84e, tipHue: 0xcaec6e, accent: 0xe8f58a, accentChance: 0.14 },
  { bottom: 0x44843a, top: 0x92d05a, tipHue: 0xdcf07c, accent: 0xb8e068, accentChance: 0.16 },
  { bottom: 0x347c46, top: 0x70c262, tipHue: 0xbbe87c, accent: 0xd8f074, accentChance: 0.12 },
];
const BLOSSOM_PAL: Palette = { bottom: 0xc45d86, top: 0xffb0cf, tipHue: 0xfff2f8, accent: 0xffffff, accentChance: 0.3 };

function oak(seed: number, hi: boolean, blossom = false): BufferGeometry {
  const pb = part(); const lb = new LeafBuilder(); const rnd = mulberry32(seed * 977 + (blossom ? 31 : 7));
  const h = 2.3 + (seed % 3) * 0.25;
  const trunk = bend(0, 0, h, 8, 0.9);
  const bark = blossom ? 0x6b4a46 : 0x9a7650;
  const r0 = 0.32, r1 = 0.14; const rAt = (y: number) => lerp(r0, r1, Math.pow(Math.min(1, y / h), 0.8)) * (1 + 1.1 * Math.pow(1 - Math.min(1, y / h), 4));
  limb(pb, trunk, r0, r1, bark, hi ? 11 : 5, 1.1, hi ? 0.07 : 0.03);
  const crown: Crown = { centre: V(0, h + 0.75, 0), radius: 2.2 };
  const nb = hi ? 6 : 1;
  const ends: Vector3[] = [];
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + seed * 1.3;
    const start = trunk[3 + (i % 3)];
    const end = V(Math.cos(a) * 1.3, h + 0.5 + (i % 2) * 0.4, Math.sin(a) * 1.3);
    ends.push(end);
    if (hi) {
      const mid = start.clone().lerp(end, 0.5).add(V(0, 0.28, 0));
      limb(pb, [start, mid, end], 0.12, 0.05, bark, 6);
      // a fork and two twigs per branch
      limb(pb, [mid, mid.clone().add(V(Math.cos(a + 0.6) * 0.45, 0.4, Math.sin(a + 0.6) * 0.45)), mid.clone().add(V(Math.cos(a + 0.7) * 0.8, 0.75, Math.sin(a + 0.7) * 0.8))], 0.06, 0.02, bark, 4);
      limb(pb, [mid, mid.clone().add(V(Math.cos(a - 0.7) * 0.4, 0.3, Math.sin(a - 0.7) * 0.4)), mid.clone().add(V(Math.cos(a - 0.8) * 0.7, 0.55, Math.sin(a - 0.8) * 0.7))], 0.05, 0.02, bark, 4);
    }
  }
  if (hi) { roots(pb, 6, r0, 0.7, seed, bark, 6); barkDetail(pb, trunk, rAt, h, rnd, !blossom); }
  const pal = blossom ? BLOSSOM_PAL : OAK_PALS[seed % 3];
  const d = hi ? 2 : 1;
  const clumps: [number, number, number, number][] = [[0, 0.8, 0, 1.45], [1.1, 0.35, 0.2, 1.0], [-0.95, 0.5, 0.45, 1.05], [0.2, 0.45, -1.15, 1.0], [0.0, 1.25, 0.1, 0.95], [-0.3, 0.2, 1.1, 0.9], [0.9, 0.9, -0.7, 0.8], [-0.7, 1.0, -0.8, 0.75], [0.8, 0.5, 0.95, 0.72]];
  const use = hi ? clumps.length : 3;
  clumps.slice(0, use).forEach(([x, y, z, r], i) => {
    const rr = r * (hi || i === 0 ? 1 : 1.12); const sd = seed + i * 3.7; const cc = V(x, h + y, z);
    clump(pb, cc, rr, d, sd, pal, crown);
    if (hi) leafTufts(lb, cc, rr, 0.82, sd, Math.round(30 + rr * 22), 0.36 + 0.07 * rr, pal, crown, rnd);
  });
  const body = pb.build();
  return hi && !lb.empty ? mergeGeometries([body, lb.build()], false)! : body;
}

function pine(seed: number, hi: boolean): BufferGeometry {
  const pb = part();
  const h = 6.2 + (seed % 2) * 0.8;
  limb(pb, bend(0, 0, h * 0.82, 6, 0.1), 0.22, 0.05, 0x8a6340, hi ? 9 : 5, 0.8, hi ? 0.05 : 0.02);
  if (hi) roots(pb, 5, 0.22, 0.55, seed, 0x7a5636, 5);
  const tiers = hi ? 9 : 3; const radial = hi ? 20 : 6;
  const dark = new Color(0x255f42), mid = new Color(0x3b9055), light = new Color(0x74ca6c), tmp = new Color(), tmp2 = new Color();
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const y = 1.1 + k * (h * 0.7); const r = lerp(1.8, 0.45, Math.pow(k, 0.85)) * (0.92 + 0.12 * fbm2(seed, t)); const hh = lerp(1.5, 0.95, k);
    const base = pb.vertexCount;
    const rings: [number, number, number][] = [[hh, 0.0, 1.0], [hh * 0.45, r * 0.5, 0.82], [0.02, r, 0.62], [-0.18, r * 0.78, 0.36], [-0.12, r * 0.3, 0.3]]; // [dy, radius, shade]
    for (let ri = 0; ri < rings.length; ri++) {
      const [dy, rr, sh] = rings[ri];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2 + t * 0.7 + seed;
        const scallop = ri === 2 ? 1 + 0.2 * Math.sin(j / radial * Math.PI * 2 * 3 + t) + (hi ? 0.18 : 0.1) * (j % 2 ? 1 : -1) : 1;
        const droop = ri === 2 ? -0.14 * Math.sin(j * 1.3 + t) : 0;
        tmp.copy(dark).lerp(mid, smooth(1 - sh)).lerp(light, Math.max(0, (ri === 2 ? 0.55 : 0.0)) * (0.4 + 0.6 * fbm2(j * 0.6, t * 0.9 + seed)));
        tmp.multiplyScalar(lerp(0.8, 1.12, k) * (0.92 + 0.16 * fbm2(j * 0.4 + 3, t * 1.7)));
        pb.addVertex(V(Math.cos(a) * rr * scallop, y + dy + droop, Math.sin(a) * rr * scallop), tmp);
      }
    }
    for (let ri = 0; ri < rings.length - 1; ri++) for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial; const a = base + ri * radial + j, b = base + ri * radial + j2, c = base + (ri + 1) * radial + j, d = base + (ri + 1) * radial + j2;
      pb.addTri(a, b, c); pb.addTri(b, d, c);
    }
    if (hi) {
      // needle fringe: little pointed sprays hanging from the rim of every tier, lighter at the tips
      const rimBase = base + 2 * radial;
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial; const a = ((j + 0.5) / radial) * Math.PI * 2 + t * 0.7 + seed;
        const sc = 1.14 + 0.2 * fbm2(j * 1.1, t + seed);
        tmp2.copy(light).lerp(new Color(0xc2ee86), 0.3 + 0.4 * fbm2(j, t)).multiplyScalar(lerp(0.85, 1.1, k));
        const tipP = V(Math.cos(a) * r * sc, y - 0.34 - 0.16 * fbm2(j * 0.8, t * 1.3), Math.sin(a) * r * sc);
        const ti = pb.addVertex(tipP, tmp2);
        pb.addTri(rimBase + j, rimBase + j2, ti);
      }
    }
  }
  return pb.build();
}

function birch(seed: number, hi: boolean): BufferGeometry {
  const pb = part(); const lb = new LeafBuilder(); const rnd = mulberry32(seed * 613 + 5);
  const h = 4.6 + (seed % 2) * 0.5;
  const pts = bend(0, 0, h, 9, 0.5);
  const rings: Ring[] = pts.map((p, i) => { const t = i / (pts.length - 1); const r = lerp(0.2, 0.075, t) * (i === 0 ? 1.25 : 1); return { p, rA: r, rB: r, tint: i === 0 ? 0x5a5650 : i % 3 === 1 ? 0x77736a : 0xffffff }; });
  sweep(pb, rings, 0xe8e4d8, { radial: hi ? 9 : 5, ref: V(1, 0, 0), capEnd: 'round', bump: (ri, ang) => (ri % 2 ? 0.04 : 0) + 0.02 * Math.sin(ang * 2) });
  if (hi) {
    // the dark horizontal scars birch bark is known for
    for (let i = 0; i < 16; i++) {
      const y = 0.4 + rnd() * (h - 1.4), a = rnd() * 6.283; const c = pointOn(pts, y); const o = V(Math.cos(a), 0, Math.sin(a)); const r = lerp(0.2, 0.075, y / h);
      stick(pb, c.addScaledVector(o, r * 0.97), o, 0.05 + rnd() * 0.04, 0.012, 0.012, 0x2e2a26);
    }
    roots(pb, 4, 0.2, 0.45, seed, 0xb9b4a4, 5);
  }
  if (hi) for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + seed; const y = 1.4 + i * 0.4; const s = pointOn(pts, y);
    limb(pb, [V(s.x, y, s.z), V(s.x + Math.cos(a) * 0.35, y + 0.28, s.z + Math.sin(a) * 0.35), V(s.x + Math.cos(a) * 0.75, y + 0.6, s.z + Math.sin(a) * 0.75)], 0.04, 0.015, 0xe0dccf, 4);
  }
  const crown: Crown = { centre: V(0, h - 0.4, 0), radius: 1.7 };
  const pal: Palette = { bottom: 0x7fae42, top: 0xcdea64, tipHue: 0xf2f690, accent: 0xffe45e, accentChance: 0.12 };
  const d = hi ? 2 : 1;
  const top = pts[pts.length - 1];
  const spots: [number, number, number, number, number][] = [[0, -0.4, 0, 1.0, 1.15], [0.7, -1.2, 0.2, 0.75, 1.1], [-0.6, -0.8, 0.4, 0.8, 1.1], [0.1, -1.7, -0.7, 0.7, 1.1], [-0.2, 0.2, -0.5, 0.65, 1.1], [0.6, -0.3, -0.6, 0.6, 1.1], [-0.55, -1.5, -0.5, 0.6, 1.1]];
  const n = hi ? spots.length : 2;
  for (let i = 0; i < n; i++) {
    const s = spots[i]; const cc = V(top.x + s[0], h + s[1], top.z + s[2]);
    if (i === 0) cc.set(top.x, h - 0.4, top.z);
    clump(pb, cc, s[3], d, seed + i * 2.1, pal, crown, s[4]);
    if (hi) leafTufts(lb, cc, s[3], s[4], seed + i * 2.1, Math.round(22 + s[3] * 20), 0.32, pal, crown, rnd);
  }
  const body = pb.build();
  return hi && !lb.empty ? mergeGeometries([body, lb.build()], false)! : body;
}

/** A twisted, leafless tree: forked grey branches, a knot-hole, bracket fungi and roots. Used as landmarks near the rim. */
function dead(seed: number, hi: boolean): BufferGeometry {
  const pb = part(); const rnd = mulberry32(seed * 431 + 99);
  const bark = 0x7b6a5a;
  const h = 3.8 + (seed % 3) * 0.5;
  const nTrunk = hi ? 9 : 5;
  const trunk: Vector3[] = Array.from({ length: nTrunk }, (_unused, i) => { const t = i / (nTrunk - 1); return V(Math.sin(t * 5.2 + seed) * 0.34 * t, t * h, Math.cos(t * 4.4 + seed * 1.7) * 0.3 * t); });
  limb(pb, trunk, 0.34, 0.1, bark, hi ? 9 : 5, 1.5, hi ? 0.09 : 0.03);
  roots(pb, hi ? 6 : 4, 0.34, 0.95, seed, 0x6c5c4c, hi ? 6 : 4);
  const branch = (o: Vector3, dir: Vector3, len: number, r: number, depth: number): void => {
    const pts: Vector3[] = []; const cur = o.clone(); const d = dir.clone().normalize();
    for (let i = 0; i < 4; i++) {
      pts.push(cur.clone()); cur.addScaledVector(d, len / 3);
      d.add(V((rnd() - 0.5) * 0.6, 0.1 + (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.6)).normalize();
    }
    limb(pb, pts, r, Math.max(0.012, r * 0.42), depth % 2 ? 0x8b7a68 : bark, hi ? 6 : 4, 0, 0.04);
    if (depth > 0) {
      const forks = hi ? 2 + (depth > 1 ? 1 : 0) : 1;
      for (let f = 0; f < forks; f++) {
        const at = pts[1 + (f % 3)]; const a = rnd() * 6.283;
        branch(at, V(Math.cos(a) * 0.9, 0.55 + rnd() * 0.5, Math.sin(a) * 0.9), len * 0.62, r * 0.55, depth - 1);
      }
    }
  };
  const nb = hi ? 6 : 3;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + seed * 1.1; const o = pointOn(trunk, h * (0.52 + 0.4 * (i / nb)));
    branch(o, V(Math.cos(a), 0.65 + rnd() * 0.4, Math.sin(a)), 1.5 + rnd() * 0.5, 0.1, hi ? 2 : 1);
  }
  branch(trunk[trunk.length - 1], V(0.1, 1, 0.05), 1.3, 0.09, hi ? 2 : 1);
  if (hi) {
    const rAt = (y: number) => lerp(0.34, 0.1, Math.pow(Math.min(1, y / h), 0.8)) * (1 + 1.5 * Math.pow(1 - Math.min(1, y / h), 4));
    barkDetail(pb, trunk, rAt, h * 0.8, rnd, true);
    for (let i = 0; i < 3; i++) { const y = 0.8 + i * 0.7 + rnd() * 0.3, a = rnd() * 6.283; const o = V(Math.cos(a), 0.05, Math.sin(a)); stick(pb, pointOn(trunk, y).addScaledVector(o, rAt(y) * 0.95), o, 0.2, 0.06, 0.14, 0xe2a24e, 1); } // bracket fungi
  }
  return pb.build();
}

/** The Ancient Tree: enormous, gnarled, with luminous pink-and-teal foliage. A point of interest, not part of the forest field. */
export function ancientTree(): BufferGeometry {
  const pb = part(); const lb = new LeafBuilder(); const rnd = mulberry32(4242);
  const h = 7;
  const trunk = bend(0, 0, h, 10, 0.4);
  limb(pb, trunk, 1.5, 0.55, 0x86624a, 16, 1.6, 0.1);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; limb(pb, [V(Math.cos(a) * 0.6, 1.2, Math.sin(a) * 0.6), V(Math.cos(a) * 1.9, 0.5, Math.sin(a) * 1.9), V(Math.cos(a + 0.1) * 3.3, 0.05, Math.sin(a + 0.1) * 3.3), V(Math.cos(a + 0.15) * 4.4, -0.2, Math.sin(a + 0.15) * 4.4)], 0.6, 0.1, 0x7a5640, 8, 0.2, 0.05); }
  barkDetail(pb, trunk, y => lerp(1.5, 0.55, Math.pow(Math.min(1, y / h), 0.8)) * (1 + 1.6 * Math.pow(1 - Math.min(1, y / h), 4)), h, rnd, true);
  for (let i = 0; i < 22; i++) { const y = 0.6 + rnd() * 4.6, a = rnd() * 6.283; const c = pointOn(trunk, y); const o = V(Math.cos(a), 0.1, Math.sin(a)); const rr = lerp(1.5, 0.55, Math.pow(y / h, 0.8)) * (1 + 1.6 * Math.pow(1 - y / h, 4)); stick(pb, c.addScaledVector(o, rr * 0.97), o, 0.2 + rnd() * 0.16, 0.28 + rnd() * 0.2, 0.09, rnd() < 0.5 ? 0x6a4c3c : 0x9a7458); }
  const crown: Crown = { centre: V(0, h + 2.2, 0), radius: 6.5 };
  const pal: Palette[] = [{ bottom: 0x3a8a82, top: 0x78e8c8, tipHue: 0xe0fff4, accent: 0xc8fff0, accentChance: 0.2 }, { bottom: 0x9a5090, top: 0xffa8dc, tipHue: 0xfff0f8, accent: 0xffffff, accentChance: 0.2 }];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4; const rr = 2.8 + (i % 3) * 0.9;
    limb(pb, [V(0, h - 0.8, 0), V(Math.cos(a) * rr * 0.5, h + 0.9, Math.sin(a) * rr * 0.5), V(Math.cos(a) * rr, h + 1.2 + (i % 2) * 1.1, Math.sin(a) * rr)], 0.34, 0.1, 0x86624a, 6);
    const cc = V(Math.cos(a) * rr, h + 1.7 + (i % 2) * 1.2, Math.sin(a) * rr); const r = 2.1 + (i % 3) * 0.3;
    clump(pb, cc, r, 2, 11 + i, pal[i % 2], crown);
    leafTufts(lb, cc, r, 0.82, 11 + i, 60, 0.6, pal[i % 2], crown, rnd);
  }
  const cc = V(0, h + 3.4, 0);
  clump(pb, cc, 2.7, 2, 3, pal[0], crown);
  leafTufts(lb, cc, 2.7, 0.82, 3, 70, 0.6, pal[0], crown, rnd);
  return mergeGeometries([pb.build(), lb.build()], false)!;
}

const cache = new Map<string, TreeModel>();
export function treeModel(kind: TreeKind, variant: number): TreeModel {
  const key = `${kind}${variant}`; const hit = cache.get(key); if (hit) return hit;
  const gen = (s: number, hi: boolean): BufferGeometry => kind === 'oak' ? oak(s, hi) : kind === 'blossom' ? oak(s, hi, true) : kind === 'pine' ? pine(s, hi) : kind === 'dead' ? dead(s, hi) : birch(s, hi);
  const m = { hi: gen(variant, true), lo: gen(variant, false) };
  cache.set(key, m);
  return m;
}
export const TREE_VARIANTS = 3;

/** A shrub: several small lumpy clumps with leaf tufts and, on some, berries or blossoms (`kind` picks the fruit colour). */
export function bushModel(seed: number, kind: 'plain' | 'berry' | 'flower'): BufferGeometry {
  const pb = part(); const lb = new LeafBuilder(); const rnd = mulberry32(seed * 313 + 17);
  const pal: Palette = kind === 'flower'
    ? { bottom: 0x2f7a3a, top: 0x86cc5a, tipHue: 0xc4ec74, accent: 0xff9fc8, accentChance: 0.22 }
    : { bottom: 0x2f7438, top: 0x8ccc58, tipHue: 0xc0e870, accent: 0xd2f27a, accentChance: 0.12 };
  const crown: Crown = { centre: V(0, 0.35, 0), radius: 0.95 };
  const lumps: [number, number, number, number][] = [[0, 0.32, 0, 0.62], [0.45, 0.24, 0.1, 0.45], [-0.42, 0.27, -0.1, 0.5], [0.05, 0.3, 0.4, 0.42], [-0.15, 0.22, -0.42, 0.4], [0.3, 0.3, -0.3, 0.38]];
  lumps.forEach(([x, y, z, r], k) => {
    const cc = V(x, y, z); const sd = seed + k * 2.3;
    clump(pb, cc, r, 1, sd, pal, crown, 0.82);
    leafTufts(lb, cc, r, 0.82, sd, Math.round(14 + r * 18), 0.2, pal, crown, rnd);
  });
  if (kind !== 'plain') {
    const berry = kind === 'berry' ? [0xe0384a, 0xc03060, 0x4a5ad0] : [0xffd84a, 0xffffff, 0xff8fc8];
    const p = V(0, 0, 0);
    for (let i = 0; i < 16; i++) {
      const [x, y, z, r] = lumps[i % lumps.length]; const a = rnd() * 6.283, e = 0.2 + rnd() * 1.0;
      const u = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      clumpSurface(V(x, y, z), r, seed + (i % lumps.length) * 2.3, 0.82, u.x, u.y, u.z, p);
      stick(pb, p.clone().addScaledVector(u, 0.02), u, 0.045, 0.045, 0.045, berry[i % berry.length], 0);
    }
  }
  const body = pb.build();
  return mergeGeometries([body, lb.build()], false)!;
}
