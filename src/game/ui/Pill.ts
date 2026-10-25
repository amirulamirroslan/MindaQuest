import Phaser from 'phaser';
import { applyTextResolution, paintPanel, textStyle, UI } from './theme';

/** A small rounded label that resizes itself to its text. Used for prompts, toasts and name plates. */
export class Pill extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly padX: number;
  private readonly padY: number;
  private shown = '';

  constructor(scene: Phaser.Scene, x: number, y: number, size = 13, color: string = UI.cream, padX = 12, padY = 6) {
    super(scene, x, y);
    this.padX = padX;
    this.padY = padY;
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', textStyle(size, color, true)).setOrigin(0.5);
    this.add([this.bg, this.label]);
    scene.add.existing(this);
  }

  /** Redraws only when the text changes: prompts call this every frame, and redrawing the panel is not free. */
  setLabel(text: string) {
    if (text === this.shown) return this;
    this.shown = text;
    this.label.setText(text);
    const width = Math.ceil(this.label.width) + this.padX * 2;
    const height = Math.ceil(this.label.height) + this.padY * 2;
    this.bg.clear();
    paintPanel(this.bg, -width / 2, -height / 2, width, height, height / 2.4);
    this.setSize(width, height);
    return this;
  }

  /** Changes the label font size (HUD units) and re-measures, e.g. when the layout switches to a phone. */
  setFontSize(size: number) {
    if (this.label.style.fontSize === `${size}px`) return this;
    this.label.setFontSize(size);
    const text = this.shown;
    this.shown = '';
    return this.setLabel(text);
  }

  setResolution(resolution: number) {
    const before = this.label.style.resolution;
    applyTextResolution(this, resolution);
    if (before !== resolution) { const text = this.shown; this.shown = ''; this.setLabel(text); }
    return this;
  }
}
