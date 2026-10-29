/**
 * Small geometry toolkit for building the hero's skinned body in code (pure Three.js maths, no DOM).
 * Everything is built as "sweeps": a ring of points slid along a path with a radius that changes, which is how clothing,
 * limbs, hair locks, boots and the sword scabbard are modelled. Each ring vertex can carry bone weights so the result bends
 * with the Universal Animation Library skeleton.
 */
import { BufferAttribute, BufferGeometry, Color, Matrix4, Vector3 } from 'three';

export type Weights = readonly (readonly [string, number])[];

export interface Ring {
  p: Vector3;
  /** Radius along the frame's A axis. */
  rA: number;
  /** Radius along the frame's B axis. */
  rB: number;
  /** Optional per-ring vertex tint (multiplies the material colour). */
  tint?: number;
  /** Optional axis for this ring's A radius (overrides the sweep's `ref`). */
  ref?: Vector3;
}

export interface SweepOptions {
  radial?: number;
  /** Axis that the ring's A radius lies along (made perpendicular to the path). */
  ref?: Vector3;
  capStart?: 'none' | 'round' | 'flat';
  capEnd?: 'none' | 'round' | 'flat';
  /** Bone weights for a vertex, from its position in the bind pose and the ring index. */
  weights?: (p: Vector3, ringIndex: number, angle: number) => Weights;
  /** Extra vertex displacement (hair clumps, cloth folds): returns an offset in the ring plane scale (multiplies radii). */
  bump?: (ringIndex: number, angle: number) => number;
  /** Rotates the first vertex around the ring (radians) so seams face the back. */
  twist?: number;
}

/** Accumulates indexed geometry with vertex colours and optional skinning. */
export class PartBuilder {
  private pos: number[] = []; private col: number[] = []; private idx: number[] = [];
  private skinI: number[] = []; private skinW: number[] = [];
  skinned = false;
  constructor(private readonly boneIndex: (name: string) => number) {}

  get vertexCount(): number { return this.pos.length / 3; }

  addVertex(p: Vector3, tint: Color, w?: Weights): number {
    const i = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z); this.col.push(tint.r, tint.g, tint.b);
    if (w) {
      this.skinned = true;
      const list = [...w].filter(e => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = list.reduce((s, e) => s + e[1], 0) || 1;
      for (let k = 0; k < 4; k++) { this.skinI.push(list[k] ? this.boneIndex(list[k][0]) : 0); this.skinW.push(list[k] ? list[k][1] / sum : 0); }
    }
    return i;
  }
  addTri(a: number, b: number, c: number): void { this.idx.push(a, b, c); }

  /** Appends an existing BufferGeometry (positions, optional colours) with a fixed weight set or a weight function. */
  addGeometry(g: BufferGeometry, m: Matrix4 | null, tint: number, weights?: Weights | ((p: Vector3) => Weights)): void {
    const src = g.index ? g : g.clone();
    const base = this.vertexCount;
    const p = new Vector3(); const c = new Color(tint); const pa = g.getAttribute('position'); const ca = g.getAttribute('color');
    const cc = new Color();
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i); if (m) p.applyMatrix4(m);
      if (ca) { cc.setRGB(ca.getX(i), ca.getY(i), ca.getZ(i)).multiply(c); } else cc.copy(c);
      const w = typeof weights === 'function' ? weights(p) : weights;
      this.addVertex(p, cc, w);
    }
    const index = src.index;
    if (index) for (let i = 0; i < index.count; i++) this.idx.push(base + index.getX(i));
    else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    if (this.skinned) {
      if (this.skinI.length !== (this.pos.length / 3) * 4) throw new Error('PartBuilder: mixed skinned and unskinned vertices');
      g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(this.skinI), 4));
      g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(this.skinW), 4));
    }
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

const UP = new Vector3(0, 1, 0), FWD = new Vector3(0, 0, 1);

/** Frames (A, B) for each ring of a path. */
function frames(path: readonly Ring[], defaultRef: Vector3): { t: Vector3; a: Vector3; b: Vector3 }[] {
  const out: { t: Vector3; a: Vector3; b: Vector3 }[] = [];
  for (let i = 0; i < path.length; i++) {
    const ref = path[i].ref ?? defaultRef;
    const prev = path[Math.max(0, i - 1)].p, next = path[Math.min(path.length - 1, i + 1)].p;
    const t = new Vector3().subVectors(next, prev).normalize();
    let a = ref.clone().addScaledVector(t, -ref.dot(t));
    if (a.lengthSq() < 1e-6) a = (Math.abs(t.y) < 0.9 ? UP : FWD).clone().addScaledVector(t, -(Math.abs(t.y) < 0.9 ? t.y : t.z));
    a.normalize();
    out.push({ t, a, b: new Vector3().crossVectors(t, a).normalize() });
  }
  return out;
}

const tmpColor = new Color();

/** Slides an elliptical ring along `path`. Returns nothing; vertices go into `part`. */
export function sweep(part: PartBuilder, path: readonly Ring[], baseTint: number, o: SweepOptions = {}): void {
  const radial = o.radial ?? 12;
  const ref = o.ref ?? FWD;
  const rings: Ring[] = [...path];
  const capRings = (which: 'start' | 'end', kind: 'round' | 'flat'): void => {
    const edge = which === 'start' ? path[0] : path[path.length - 1];
    const nb = which === 'start' ? path[1] : path[path.length - 2];
    const dir = new Vector3().subVectors(edge.p, nb.p).normalize();
    const angles = kind === 'round' ? [0.4, 0.8, 1.15, 1.4, Math.PI / 2] : [1.55];
    const mean = (edge.rA + edge.rB) / 2;
    const extra: Ring[] = angles.map(a => ({
      p: edge.p.clone().addScaledVector(dir, Math.sin(a) * mean * (kind === 'round' ? 1 : 0.02)),
      rA: edge.rA * Math.cos(a), rB: edge.rB * Math.cos(a), tint: edge.tint, ref: edge.ref,
    }));
    // order extras from the edge outwards
    if (which === 'start') rings.unshift(...extra.reverse()); else rings.push(...extra);
  };
  if (o.capStart && o.capStart !== 'none') capRings('start', o.capStart);
  if (o.capEnd && o.capEnd !== 'none') capRings('end', o.capEnd);

  const fr = frames(rings, ref);
  const rowStart: number[] = [];
  const base = new Color(baseTint);
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i], f = fr[i];
    rowStart.push(part.vertexCount);
    tmpColor.copy(base); if (r.tint !== undefined) tmpColor.multiply(new Color(r.tint));
    for (let k = 0; k < radial; k++) {
      const ang = (k / radial) * Math.PI * 2 + (o.twist ?? 0);
      const bump = o.bump ? 1 + o.bump(i, ang) : 1;
      const p = r.p.clone().addScaledVector(f.a, Math.cos(ang) * r.rA * bump).addScaledVector(f.b, Math.sin(ang) * r.rB * bump);
      const w = o.weights ? o.weights(p, Math.min(i, path.length - 1), ang) : undefined;
      part.addVertex(p, tmpColor, w);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const k2 = (k + 1) % radial;
      const a = rowStart[i] + k, b = rowStart[i] + k2, c = rowStart[i + 1] + k, d = rowStart[i + 1] + k2;
      // winding chosen so normals point outwards for frames where B = T x A
      part.addTri(a, c, b); part.addTri(b, c, d);
    }
  }
}

/** Linear interpolation helpers for authoring ring tables. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const smooth = (t: number): number => { const k = clamp01(t); return k * k * (3 - 2 * k); };

/** Builds rings between two ring tables at fractional positions (used to add extra rings near joints). */
export function ringsFromTable(rows: readonly (readonly [number, number, number, number, number])[], axis: 'x' | 'y' | 'z', fixedA: number, fixedB: number): Ring[] {
  // rows: [position along axis, rA, rB, tint(0xRRGGBB as number), centreOffset]
  return rows.map(([s, rA, rB, tint, off]) => {
    const p = new Vector3();
    if (axis === 'y') p.set(fixedA, s, fixedB + off); else if (axis === 'x') p.set(s, fixedA + off, fixedB); else p.set(fixedA, fixedB + off, s);
    return { p, rA, rB, tint };
  });
}

/** Weight blending between consecutive bones along a scalar: `stops` are the boundary values between bone[i] and bone[i+1]. */
export function blendAlong(value: number, bones: readonly string[], stops: readonly number[], width: readonly number[]): Weights {
  // value increases with bone order. weight of bone i rises/falls through smoothstep around the stops.
  const w: [string, number][] = [];
  let remaining = 1;
  for (let i = 0; i < bones.length - 1; i++) {
    const t = smooth((value - (stops[i] - width[i])) / (2 * width[i]));
    w.push([bones[i], remaining * (1 - t)]);
    remaining *= t;
  }
  w.push([bones[bones.length - 1], remaining]);
  return w;
}

/** A tapering, curved lock/strand: path sampled from a quadratic Bezier with radii from `r0` to `r1` (flattened by `flat`). */
export function curvePath(a: Vector3, b: Vector3, c: Vector3, n: number, r0: number, r1: number, flat = 1, tintA = 0xffffff, tintB = 0xffffff): Ring[] {
  const out: Ring[] = [];
  const ca = new Color(tintA), cb = new Color(tintB);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), u = 1 - t;
    const p = new Vector3().addScaledVector(a, u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t);
    const k = Math.pow(1 - t, 0.75) * (1 - 0.15 * Math.sin(t * Math.PI));
    const r = lerp(r1, r0, k);
    out.push({ p, rA: r, rB: r * flat, tint: new Color().copy(ca).lerp(cb, t).getHex() });
  }
  return out;
}
