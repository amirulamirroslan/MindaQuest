import Phaser from 'phaser';
import { dustKey, FX } from '../art/effects';
import type { Surface } from '../systems/footsteps';
import { isOff } from '../systems/features';

/** Above the day-night overlay (17000), so sparkles and glows stay bright after dark. */
export const GLOW_DEPTH = 17600;

/**
 * Game-feel particles: footstep dust, pickup sparkles and water splashes. Positions are screen-space (the isometric
 * plane the world is drawn in). Each kind is one pooled emitter, so a burst costs almost nothing.
 */
export class Fx {
  private readonly dusts: Record<Surface, Phaser.GameObjects.Particles.ParticleEmitter>;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly drops: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene, private readonly lite: boolean) {
    const dust = (surface: Surface) => scene.add.particles(0, 0, dustKey(surface), {
      emitting: false, lifespan: { min: 380, max: 560 }, speed: { min: 6, max: 20 }, angle: { min: -165, max: -15 }, gravityY: -10,
      scale: { start: 0.15, end: 0.36 }, alpha: { start: 0.55, end: 0 },
    });
    this.dusts = { grass: dust('grass'), dirt: dust('dirt'), wood: dust('wood') };
    this.sparks = scene.add.particles(0, 0, 'paint-spark-gold', {
      emitting: false, lifespan: { min: 460, max: 820 }, speed: { min: 26, max: 72 }, angle: { min: 0, max: 360 }, gravityY: -28,
      scale: { start: 0.34, end: 0 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 220 },
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(GLOW_DEPTH);
    this.drops = scene.add.particles(0, 0, FX.drop, {
      emitting: false, lifespan: { min: 420, max: 560 }, speed: { min: 40, max: 95 }, angle: { min: -135, max: -45 }, gravityY: 320,
      scale: { start: 0.55, end: 0.25 }, alpha: { start: 1, end: 0 },
    });
  }

  /** A little puff at the hero's feet. `foot` (-1 left, 1 right) offsets it so the steps alternate. */
  dust(sx: number, sy: number, surface: Surface, foot: -1 | 1) {
    if (isOff('dust')) return;
    const emitter = this.dusts[surface];
    emitter.setDepth(sy + 17);
    emitter.explode(this.lite ? 1 : 2, sx + foot * 4, sy);
  }

  /** A burst of golden stars and a gold ring. */
  sparkleBurst(sx: number, sy: number, count = 10) {
    if (isOff('sparkles')) return;
    this.sparks.explode(this.lite ? Math.ceil(count * 0.7) : count, sx, sy);
    this.ring(sx, sy, 0xffe08a, 16, 480, GLOW_DEPTH - 1, 0.9);
  }

  /** Water droplets and spreading rings. `big` is for the bridge planks, small for a fish. */
  splash(sx: number, sy: number, size: 'small' | 'big') {
    const big = size === 'big';
    this.drops.setDepth(sy + 26);
    this.drops.explode(big ? (this.lite ? 7 : 12) : (this.lite ? 3 : 5), sx, sy);
    this.ring(sx, sy, 0xeaf6ff, big ? 26 : 14, big ? 720 : 560, sy + 10, 0.85);
    if (big) this.scene.time.delayedCall(140, () => this.ring(sx, sy, 0xcfe9ff, 18, 600, sy + 10, 0.7));
  }

  /** An expanding 2:1 ellipse (a circle on the isometric ground) that fades as it grows. */
  ring(sx: number, sy: number, color: number, radius: number, duration: number, depth: number, alpha = 0.9) {
    const ring = this.scene.add.ellipse(sx, sy, radius * 2, radius, color, 0).setStrokeStyle(2, color, alpha).setDepth(depth).setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration, ease: 'Sine.Out', onComplete: () => ring.destroy() });
  }
}
