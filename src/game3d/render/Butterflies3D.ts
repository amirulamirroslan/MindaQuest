import { DoubleSide, CanvasTexture, Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, type Scene } from 'three';
import { heightAt } from '../systems/worldShape';

const FOLLOW_RADIUS = 15;
export const BUTTERFLY_COLOURS = [0xffb347, 0xfff07a, 0xff9ec7, 0xa9d8ff, 0xffffff, 0xc7a6ff] as const;

/** A rounded wing with a dark rim and a pale spot, drawn once (white, so each butterfly's colour tints it). */
function wingTexture(): CanvasTexture {
  // a two-lobed wing hinged at the left edge: big upper lobe, smaller lower lobe, dark rim, pale spots
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!;
  const lobe = (cx: number, cy: number, rx: number, ry: number, rot: number, fill: string) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); x.fill(); };
  lobe(34, 22, 30, 18, -0.35, '#3a2a40'); lobe(28, 46, 20, 13, 0.3, '#3a2a40');
  lobe(33, 22, 26, 14.5, -0.35, '#ffffff'); lobe(28, 46, 16.5, 9.5, 0.3, '#f2f2f2');
  x.fillStyle = '#7a5a8a'; x.beginPath(); x.arc(40, 18, 4.5, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(30, 46, 3, 0, Math.PI * 2); x.fill();
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/**
 * v2.13: a few butterflies drifting over the meadow by day (the fireflies take over at night). Two instanced meshes (left and right
 * wings) share one texture: two draw calls for all of them. They wander in loose loops around the hero, flap, and never touch anything.
 */
export class Butterflies3D {
  private readonly left: InstancedMesh; private readonly right: InstancedMesh;
  private readonly base: Float32Array; // x, z, phase, speed
  private readonly d = new Object3D(); private placed = false;
  private shown = -1;

  constructor(scene: Scene, private readonly count = 8) {
    const wing = (sign: 1 | -1) => { const g = new PlaneGeometry(0.5, 0.5); g.translate(sign * 0.25, 0, 0); if (sign === -1) { const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } g.rotateX(-Math.PI / 2); return g; };
    const mat = new MeshBasicMaterial({ map: wingTexture(), transparent: true, alphaTest: 0.4, side: DoubleSide, depthWrite: false });
    this.left = new InstancedMesh(wing(-1), mat, count); this.right = new InstancedMesh(wing(1), mat, count);
    const col = new Color();
    for (let i = 0; i < count; i++) { col.setHex(BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length]); this.left.setColorAt(i, col); this.right.setColorAt(i, col); }
    for (const m of [this.left, this.right]) { m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m); }
    this.base = new Float32Array(count * 4);
  }

  private place(i: number, hx: number, hz: number): void {
    const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * (FOLLOW_RADIUS - 5);
    this.base[i * 4] = hx + Math.sin(a) * d; this.base[i * 4 + 1] = hz + Math.cos(a) * d; this.base[i * 4 + 2] = Math.random() * 60; this.base[i * 4 + 3] = 0.5 + Math.random() * 0.5;
  }

  /** `level` 0..1: how many are out (all by day, none at night). */
  update(t: number, hero: { x: number; z: number }, level: number): void {
    const n = Math.min(this.count, Math.ceil(level * this.count - 0.001));
    const on = n > 0; if (this.left.visible !== on) { this.left.visible = on; this.right.visible = on; }
    if (!on) return;
    if (!this.placed) { for (let i = 0; i < this.count; i++) this.place(i, hero.x, hero.z); this.placed = true; }
    const d = this.d;
    for (let i = 0; i < this.count; i++) {
      if (Math.hypot(this.base[i * 4] - hero.x, this.base[i * 4 + 1] - hero.z) > FOLLOW_RADIUS) this.place(i, hero.x, hero.z);
      const ph = this.base[i * 4 + 2], sp = this.base[i * 4 + 3];
      const w = t * sp * 0.55 + ph;
      const x = this.base[i * 4] + Math.sin(w) * 2.4 + Math.sin(w * 2.3) * 0.5, z = this.base[i * 4 + 1] + Math.cos(w * 0.8) * 2.4;
      const vx = Math.cos(w) * 2.4 * 0.55 * sp, vz = -Math.sin(w * 0.8) * 2.4 * 0.8 * 0.55 * sp;
      const y = heightAt(x, z) + 0.8 + Math.sin(t * 1.3 + ph) * 0.35;
      const flap = 0.8 + Math.sin(t * 17 + ph * 3) * 0.62, scale = i < n ? 1 : 0;
      d.position.set(x, y, z); d.rotation.set(0, Math.atan2(vx, vz), 0); d.scale.setScalar(scale);
      // each wing hinges on the body and tips up and down; a wing's tilt is about the body's forward (z) axis
      d.rotateZ(-flap); d.updateMatrix(); this.left.setMatrixAt(i, d.matrix);
      d.rotation.set(0, Math.atan2(vx, vz), 0); d.rotateZ(flap); d.updateMatrix(); this.right.setMatrixAt(i, d.matrix);
    }
    this.left.instanceMatrix.needsUpdate = true; this.right.instanceMatrix.needsUpdate = true;
    if (this.left.instanceColor) this.left.instanceColor.needsUpdate = this.shown !== 1;
    if (this.right.instanceColor) this.right.instanceColor.needsUpdate = this.shown !== 1; this.shown = 1;
  }
}
