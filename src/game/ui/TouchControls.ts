import Phaser from 'phaser';
import { getLayout } from '../responsive';
import { clampThumb, stickVector } from '../systems/touchStick';
import { ACTION_UNITS, STICK_UNITS, touchMetrics } from '../systems/uiLayout';
import { textResolutionFor } from '../systems/viewport';
import { applyTextResolution, textStyle, UI } from './theme';

/**
 * Compact analogue stick (any direction) plus one large action button. Only shown on touch devices.
 * Placement comes from `touchMetrics` (safe-area aware, >= 44 CSS px targets). The stick is released
 * whenever the touch ends anywhere, is cancelled, leaves the canvas, or the layout/visibility changes.
 */
export class TouchControls {
  readonly enabled: boolean;
  direction = { x: 0, y: 0 };
  private readonly stickBase: Phaser.GameObjects.Container;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly stickZone: Phaser.GameObjects.Zone;
  private readonly actionButton: Phaser.GameObjects.Container;
  private readonly actionRing: Phaser.GameObjects.Arc;
  private readonly actionDisc: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private center = { x: 0, y: 0 };
  private radius = STICK_UNITS;
  private ready = false;

  constructor(private readonly scene: Phaser.Scene, onAction: () => void) {
    this.enabled = scene.sys.game.device.input.touch;
    scene.input.addPointer(2);

    const base = scene.add.circle(0, 0, STICK_UNITS, UI.panel, 0.4).setStrokeStyle(1, UI.border, 0.4);
    const mark = scene.add.graphics();
    mark.lineStyle(1, 0xfff1c9, 0.18).strokeCircle(0, 0, STICK_UNITS * 0.55);
    this.thumb = scene.add.circle(0, 0, STICK_UNITS * 0.43, UI.gold, 0.55).setStrokeStyle(1, 0xfff1c9, 0.55);
    this.stickBase = scene.add.container(0, 0, [base, mark, this.thumb]).setScrollFactor(0).setDepth(21000);
    this.stickZone = scene.add.zone(0, 0, 10, 10).setScrollFactor(0).setDepth(21001).setInteractive();
    this.stickZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.pointerId = pointer.id; this.update(pointer); });

    this.actionRing = scene.add.circle(0, 0, ACTION_UNITS + 6, UI.gold, 0).setStrokeStyle(2, UI.gold, 0);
    this.actionDisc = scene.add.circle(0, 0, ACTION_UNITS, UI.panel, 0.7).setStrokeStyle(2, UI.border, 0.75).setInteractive({ useHandCursor: true });
    const label = scene.add.text(0, 0, 'USE', textStyle(15, UI.goldCss, true)).setOrigin(0.5);
    this.actionDisc.on('pointerdown', () => { this.actionDisc.setFillStyle(UI.dim, 0.9); onAction(); });
    this.actionDisc.on('pointerup', () => this.actionDisc.setFillStyle(UI.panel, 0.7));
    this.actionDisc.on('pointerout', () => this.actionDisc.setFillStyle(UI.panel, 0.7));
    this.actionButton = scene.add.container(0, 0, [this.actionRing, this.actionDisc, label]).setScrollFactor(0).setDepth(21000);

    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('gameout', this.release, this);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('gameout', this.release, this);
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
    scene.tweens.add({ targets: this.actionRing, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.layout();
  }

  /** Make the button glow when there is something to interact with. */
  setReady(ready: boolean) {
    if (ready === this.ready) return;
    this.ready = ready;
    this.actionRing.setStrokeStyle(2, UI.gold, ready ? 1 : 0);
  }

  /** Stops the hero immediately and re-centres the thumb. Safe to call at any time. */
  release() {
    this.pointerId = null;
    this.direction = { x: 0, y: 0 };
    this.thumb.setPosition(0, 0);
  }

  /**
   * Called every frame. Browsers sometimes swallow the final touch event (system gesture, notification
   * shade, palm rejection), which would leave the hero walking forever; if the tracked finger is gone, stop.
   */
  releaseIfPointerLost() {
    if (this.pointerId === null) return;
    const pointer = this.scene.input.manager.pointers.find((candidate) => candidate.id === this.pointerId);
    if (!pointer || !pointer.isDown) this.release();
  }

  private onMove(pointer: Phaser.Input.Pointer) { if (pointer.id === this.pointerId && pointer.isDown) this.update(pointer); }
  private onUp(pointer: Phaser.Input.Pointer) { if (pointer.id === this.pointerId) this.release(); }
  private onResize() { this.release(); this.layout(); }

  private update(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.center.x, dy = pointer.y - this.center.y;
    this.direction = stickVector(dx, dy, this.radius);
    const thumb = clampThumb(dx / this.stickBase.scaleX, dy / this.stickBase.scaleY, STICK_UNITS);
    this.thumb.setPosition(thumb.x, thumb.y);
  }

  layout() {
    const m = touchMetrics(getLayout(this.scene));
    this.center = { x: m.stick.cx, y: m.stick.cy };
    this.radius = m.stick.r;
    this.stickBase.setScale(m.scale).setPosition(m.stick.cx, m.stick.cy).setVisible(this.enabled);
    this.stickZone.setPosition(m.stickZone.x + m.stickZone.w / 2, m.stickZone.y + m.stickZone.h / 2).setSize(m.stickZone.w, m.stickZone.h);
    this.stickZone.input?.hitArea && (this.stickZone.input.hitArea as Phaser.Geom.Rectangle).setSize(m.stickZone.w, m.stickZone.h);
    this.stickZone.input && (this.stickZone.input.enabled = this.enabled);
    this.actionButton.setScale(m.scale).setPosition(m.action.cx, m.action.cy).setVisible(this.enabled);
    applyTextResolution(this.actionButton, textResolutionFor(m.scale));
  }
}
