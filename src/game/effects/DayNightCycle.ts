import Phaser from 'phaser';
import { DAY_CYCLE_SECONDS, timeOfDayAt, wrapPhase, type TimeOfDay } from '../systems/dayNight';

const PHASE_KEY = 'mq-day-phase';
const TINT_KEY = 'paint-night-tint';
/** Above every world object and the player, below sparkles, glows and fireflies so light sources stay bright at night. */
export const OVERLAY_DEPTH = 17000;

/**
 * The slow day-night colour grade. A single screen-sized image with a MULTIPLY blend sits over the world: the
 * tint multiplies everything underneath (so lanterns, fireflies and sparkles, which sit above it, keep their light).
 * Works the same in WebGL and Canvas. It is hidden entirely in plain daylight. Lives only on the world camera.
 */
export class DayNightCycle {
  current: TimeOfDay;
  readonly frozen: boolean;
  private phase: number;
  private readonly overlay: Phaser.GameObjects.Image;
  private readonly swatch: Phaser.Textures.CanvasTexture;
  private readonly multiply: boolean;
  private painted = -1;

  /** `start` and `frozen` come from the developer switch `?tod=`; otherwise the cycle continues from where the last session left it. */
  constructor(scene: Phaser.Scene, start: number | null) {
    this.frozen = start !== null;
    this.phase = start ?? (scene.registry.get(PHASE_KEY) as number | undefined) ?? 0;
    if (scene.textures.exists(TINT_KEY)) scene.textures.remove(TINT_KEY);
    this.swatch = scene.textures.createCanvas(TINT_KEY, 4, 4)!;
    this.overlay = scene.add.image(0, 0, TINT_KEY).setOrigin(0).setDepth(OVERLAY_DEPTH);
    // WebGL always multiplies. The Canvas fallback only does if the browser's blend modes were detected; otherwise
    // fall back to a plain translucent dark overlay (same mood, a little flatter) instead of painting over the world.
    const renderer = scene.game.renderer as unknown as { type: number; blendModes?: string[] };
    this.multiply = renderer.type !== Phaser.CANVAS || renderer.blendModes?.[Phaser.BlendModes.MULTIPLY] === 'multiply';
    if (this.multiply) this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.current = timeOfDayAt(this.phase);
    this.apply();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (!this.frozen) scene.registry.set(PHASE_KEY, this.phase); });
  }

  update(dtMs: number, view?: { x: number; y: number; width: number; height: number }): TimeOfDay {
    if (!this.frozen) {
      this.phase = wrapPhase(this.phase + dtMs / 1000 / DAY_CYCLE_SECONDS);
      this.current = timeOfDayAt(this.phase);
      this.apply();
    }
    // Only the part of the world on screen is tinted: a full-world multiply is wasted fill on every frame.
    if (view && view.width > 0 && this.overlay.visible) this.overlay.setPosition(view.x - 8, view.y - 8).setDisplaySize(view.width + 16, view.height + 16);
    return this.current;
  }

  private apply() {
    const visible = this.current.tint !== 0xffffff;
    this.overlay.setVisible(visible);
    if (visible && this.current.tint !== this.painted) {
      // A 4x4 swatch repainted when the colour changes (Canvas ignores tints, so the colour is baked in).
      this.painted = this.current.tint;
      const r = (this.current.tint >> 16) & 255, g = (this.current.tint >> 8) & 255, b = this.current.tint & 255;
      const ctx = this.swatch.getContext();
      ctx.clearRect(0, 0, 4, 4);
      if (this.multiply) ctx.fillStyle = `rgb(${r},${g},${b})`;
      else {
        // Strength follows how far the weakest channel is from white, so a warm golden hour still reads clearly.
        const strength = (1 - Math.min(r, g, b) / 255) * 0.8;
        ctx.fillStyle = `rgba(${Math.round(r * 0.6)},${Math.round(g * 0.6)},${Math.round(b * 0.6)},${strength.toFixed(3)})`;
      }
      ctx.fillRect(0, 0, 4, 4);
      this.swatch.refresh();
    }
  }
}
