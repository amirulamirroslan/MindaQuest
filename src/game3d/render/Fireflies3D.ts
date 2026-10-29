import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial, type Scene } from 'three';
import { heightAt } from '../systems/worldShape';
import { glowTexture } from './common';

const FOLLOW_RADIUS = 17;
/** Soft green-gold fireflies that drift near the hero after dark. They are only a light show: they never touch anything. */
export class Fireflies3D {
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array; // x, z, phase per firefly
  private readonly points: Points;
  private placed = false;

  constructor(scene: Scene, private readonly count = 34) {
    this.pos = new Float32Array(count * 3); this.col = new Float32Array(count * 3); this.base = new Float32Array(count * 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3)); g.setAttribute('color', new BufferAttribute(this.col, 3));
    this.points = new Points(g, new PointsMaterial({ size: 0.5, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = 3; this.points.visible = false;
    scene.add(this.points);
  }

  private place(i: number, hx: number, hz: number): void {
    const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * (FOLLOW_RADIUS - 6);
    this.base[i * 3] = hx + Math.sin(a) * d; this.base[i * 3 + 1] = hz + Math.cos(a) * d; this.base[i * 3 + 2] = Math.random() * 60;
  }

  /** `level` 0..1 is how many fireflies are out (see `fireflyLevel`). */
  update(t: number, hero: { x: number; z: number }, level: number): void {
    const on = level > 0.02;
    if (this.points.visible !== on) this.points.visible = on;
    if (!on) return;
    if (!this.placed) { for (let i = 0; i < this.count; i++) this.place(i, hero.x, hero.z); this.placed = true; }
    for (let i = 0; i < this.count; i++) {
      if (Math.hypot(this.base[i * 3] - hero.x, this.base[i * 3 + 1] - hero.z) > FOLLOW_RADIUS) this.place(i, hero.x, hero.z); // left behind: reappear near the hero
      const ph = this.base[i * 3 + 2];
      const x = this.base[i * 3] + Math.sin(t * 0.4 + ph) * 1.6, z = this.base[i * 3 + 1] + Math.cos(t * 0.33 + ph * 1.3) * 1.6;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = heightAt(x, z) + 0.8 + Math.sin(t * 0.9 + ph) * 0.4; this.pos[i * 3 + 2] = z;
      // each one blinks on its own rhythm; additive blending turns a dimmer colour into a dimmer light
      const b = (0.3 + 0.7 * Math.max(0, Math.sin(t * 1.7 + ph * 5))) * level;
      this.col[i * 3] = 0.85 * b; this.col[i * 3 + 1] = 1.0 * b; this.col[i * 3 + 2] = 0.45 * b;
    }
    (this.points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}
