import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Points, PointsMaterial, Sprite, SpriteMaterial, type Scene } from 'three';
import { glowTexture } from './common';

interface Pulse { sprite: Sprite; t: number; dur: number; size: number; peak: number }
interface Ghost { sprite: Sprite; t: number; dur: number; peak: number; w: number; h: number }
interface Beam { mesh: Mesh<CylinderGeometry, MeshBasicMaterial>; t: number; dur: number; h: number }

/** One pooled particle system (sparkles, dust, poofs, petal bursts). Everything is round, soft and harmless. */
export class Fx3D {
  private readonly max = 520;
  private readonly pulses: Pulse[] = [];
  private readonly beams: Beam[] = [];
  private readonly ghosts: Ghost[] = [];
  private readonly fxGroup = new Group();
  private readonly pos = new Float32Array(this.max * 3);
  private readonly col = new Float32Array(this.max * 3);
  private readonly vel = new Float32Array(this.max * 3);
  private readonly life = new Float32Array(this.max);
  private readonly maxLife = new Float32Array(this.max);
  private readonly grav = new Float32Array(this.max);
  private next = 0;
  readonly points: Points;
  private tmp = new Color();

  constructor(scene: Scene) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    const m = new PointsMaterial({ size: 0.32, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
    this.points = new Points(g, m);
    this.points.frustumCulled = false; this.points.renderOrder = 4;
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -999;
    scene.add(this.points);
    scene.add(this.fxGroup);
    for (let i = 0; i < 6; i++) { const sp = new Sprite(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })); sp.visible = false; sp.renderOrder = 5; this.fxGroup.add(sp); this.pulses.push({ sprite: sp, t: 1, dur: 1, size: 1, peak: 1 }); }
    for (let i = 0; i < 8; i++) { const sp = new Sprite(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })); sp.visible = false; sp.renderOrder = 3; this.fxGroup.add(sp); this.ghosts.push({ sprite: sp, t: 1, dur: 1, peak: 1, w: 1, h: 1 }); }
    for (let i = 0; i < 3; i++) { const m = new Mesh(new CylinderGeometry(0.5, 0.5, 1, 14, 1, true), new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, side: 2 })); m.visible = false; m.renderOrder = 4; this.fxGroup.add(m); this.beams.push({ mesh: m, t: 1, dur: 1, h: 1 }); }
  }

  /** A soft flash of light that swells and fades (collecting, abilities, defeats). */
  flash(x: number, y: number, z: number, color: number, size = 3, dur = 0.45, peak = 0.9): void {
    const p = this.pulses.find(q => q.t >= q.dur) ?? this.pulses[0];
    p.t = 0; p.dur = dur; p.size = size; p.peak = peak; p.sprite.position.set(x, y, z); p.sprite.material.color.set(color); p.sprite.visible = true;
  }
  /** v2.12: a tall soft glow that stays where it was left and fades: strung along a dodge it reads as an afterimage of the hero. */
  ghost(x: number, y: number, z: number, color: number, w = 0.9, h = 1.7, dur = 0.3, peak = 0.55): void {
    const g = this.ghosts.find(q => q.t >= q.dur) ?? this.ghosts[0];
    g.t = 0; g.dur = dur; g.peak = peak; g.w = w; g.h = h; g.sprite.position.set(x, y + h * 0.4, z); g.sprite.material.color.set(color); g.sprite.visible = true;
  }
  /** A column of light rising from the ground (a reward, a level up). */
  beam(x: number, y: number, z: number, color: number, height = 4, dur = 0.9, radius = 0.45): void {
    const b = this.beams.find(q => q.t >= q.dur) ?? this.beams[0];
    b.t = 0; b.dur = dur; b.h = height; b.mesh.position.set(x, y + height / 2, z); b.mesh.scale.set(radius * 2, height, radius * 2); b.mesh.material.color.set(color); b.mesh.visible = true;
  }

  burst(x: number, y: number, z: number, color: number, count: number, speed = 2.5, life = 0.7, gravity = 3, up = 1.5): void {
    this.tmp.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * (0.4 + Math.random()); this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
      this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6); this.grav[i] = gravity;
    }
  }

  /** v2.12: a cone of particles flying along (dirX, dirZ): sword sparks, dust kicked up behind a dodge, impact chips. */
  spray(x: number, y: number, z: number, dirX: number, dirZ: number, color: number, count = 10, speed = 3.5, spread = 0.7, life = 0.4, gravity = 2, up = 0.8): void {
    this.tmp.set(color); const base = Math.atan2(dirZ, dirX);
    for (let n = 0; n < count; n++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const a = base + (Math.random() - 0.5) * 2 * spread, s = speed * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * (0.2 + Math.random()); this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
      this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6); this.grav[i] = gravity;
    }
  }

  /** A ring of particles on the ground (shockwaves). */
  ring(x: number, y: number, z: number, radius: number, color: number, count = 28): void {
    this.tmp.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const a = (n / count) * Math.PI * 2;
      this.pos[i * 3] = x + Math.cos(a) * radius * 0.2; this.pos[i * 3 + 1] = y + 0.1; this.pos[i * 3 + 2] = z + Math.sin(a) * radius * 0.2;
      this.vel[i * 3] = Math.cos(a) * radius * 2.2; this.vel[i * 3 + 1] = 0.3; this.vel[i * 3 + 2] = Math.sin(a) * radius * 2.2;
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
      this.life[i] = this.maxLife[i] = 0.45; this.grav[i] = 0;
    }
  }

  update(dt: number): void {
    for (const p of this.pulses) {
      if (p.t >= p.dur) { p.sprite.visible = false; continue; }
      p.t += dt; const k = Math.min(1, p.t / p.dur);
      const sc = p.size * (0.35 + 0.65 * (1 - (1 - k) * (1 - k))); p.sprite.scale.set(sc, sc, 1); p.sprite.material.opacity = p.peak * (1 - k) * (1 - k);
    }
    for (const g of this.ghosts) {
      if (g.t >= g.dur) { g.sprite.visible = false; continue; }
      g.t += dt; const k = Math.min(1, g.t / g.dur);
      g.sprite.scale.set(g.w * (1 + k * 0.25), g.h * (1 - k * 0.1), 1); g.sprite.material.opacity = g.peak * (1 - k) * (1 - k);
    }
    for (const b of this.beams) {
      if (b.t >= b.dur) { b.mesh.visible = false; continue; }
      b.t += dt; const k = Math.min(1, b.t / b.dur);
      b.mesh.material.opacity = 0.5 * Math.sin(Math.min(1, k * 1.25) * Math.PI) * (1 - k * 0.4); const w = 1 - k * 0.7; b.mesh.scale.x = b.mesh.scale.z = Math.max(0.01, b.mesh.scale.x * 0 + w * 0.9 + 0.1);
      b.mesh.scale.y = b.h * (0.3 + 0.7 * Math.min(1, k * 2.5));
    }
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // fade by dimming the additive colour toward black
      const k = Math.min(1, (this.life[i] / this.maxLife[i]) * 1.6);
      this.col[i * 3] *= 1 - (1 - k) * 0.12; this.col[i * 3 + 1] *= 1 - (1 - k) * 0.12; this.col[i * 3 + 2] *= 1 - (1 - k) * 0.12;
    }
    (this.points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}
