/**
 * A swing trail that follows the real blade (v2.12). Each frame the weapon's grip-end and tip are pushed in; the last few samples are
 * smoothed with a Catmull-Rom spline and drawn as a ribbon that fades with age, brighter at the tip edge. Because it is built from
 * the animated weapon itself, it lines up with every weapon, combo step and the spin without any hand-tuned arcs.
 */
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial, Vector3 } from 'three';

const MAX = 14, SUB = 3, COLS = (MAX - 1) * SUB + 1;

/** Catmull-Rom between p1 and p2 at t (0..1) for one coordinate. */
export function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
/** Opacity of a trail sample of the given age: full when new, easing to nothing at `life`. */
export function trailAlpha(age: number, life: number, peak: number): number { const k = Math.min(1, Math.max(0, age / life)); return peak * Math.pow(1 - k, 1.6); }

export class WeaponTrail {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** Seconds a sample stays visible. */
  life = 0.22;
  private readonly tips: Vector3[] = []; private readonly bases: Vector3[] = []; private readonly ages: number[] = [];
  private readonly pos = new Float32Array(COLS * 2 * 3);
  private readonly col = new Float32Array(COLS * 2 * 4);
  private readonly geo = new BufferGeometry();
  private readonly rgb = new Color(1, 1, 1);

  constructor() {
    const posA = new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage), colA = new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', posA); this.geo.setAttribute('color', colA);
    const idx: number[] = [];
    for (let c = 0; c < COLS - 1; c++) { const a = c * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx); this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.visible = false;
  }

  /** Forget everything (a new swing must not be joined to the last one). */
  clear(): void { this.tips.length = 0; this.bases.length = 0; this.ages.length = 0; this.mesh.visible = false; this.geo.setDrawRange(0, 0); }
  get count(): number { return this.ages.length; }

  /** Adds the blade's current tip and base. */
  push(tip: Vector3, base: Vector3): void {
    this.tips.unshift(tip.clone()); this.bases.unshift(base.clone()); this.ages.unshift(0);
    if (this.tips.length > MAX) { this.tips.pop(); this.bases.pop(); this.ages.pop(); }
  }

  /** Ages the samples by `dt`, drops the dead ones and rebuilds the ribbon in `color` at up to `peak` opacity. */
  step(dt: number, color: number, peak: number): void {
    for (let i = 0; i < this.ages.length; i++) this.ages[i] += dt;
    while (this.ages.length && this.ages[this.ages.length - 1] >= this.life) { this.tips.pop(); this.bases.pop(); this.ages.pop(); }
    const n = this.ages.length;
    if (n < 2) { this.mesh.visible = false; this.geo.setDrawRange(0, 0); return; }
    this.rgb.setHex(color);
    const cols = (n - 1) * SUB + 1;
    for (let j = 0; j < cols; j++) {
      const s = j / SUB, i = Math.min(n - 2, Math.floor(s)), f = s - i;
      const i0 = Math.max(0, i - 1), i2 = i + 1, i3 = Math.min(n - 1, i + 2);
      const a = trailAlpha(this.ages[i] + (this.ages[i2] - this.ages[i]) * f, this.life, peak);
      for (let k = 0; k < 2; k++) {
        const arr = k === 0 ? this.tips : this.bases, o = (j * 2 + k) * 3, oc = (j * 2 + k) * 4;
        this.pos[o] = catmull(arr[i0].x, arr[i].x, arr[i2].x, arr[i3].x, f);
        this.pos[o + 1] = catmull(arr[i0].y, arr[i].y, arr[i2].y, arr[i3].y, f);
        this.pos[o + 2] = catmull(arr[i0].z, arr[i].z, arr[i2].z, arr[i3].z, f);
        this.col[oc] = this.rgb.r; this.col[oc + 1] = this.rgb.g; this.col[oc + 2] = this.rgb.b; this.col[oc + 3] = k === 0 ? a : a * 0.4; // bright at the blade's tip edge, soft at the grip edge
      }
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true; (this.geo.getAttribute('color') as BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, (cols - 1) * 6); this.mesh.visible = true;
  }
}
