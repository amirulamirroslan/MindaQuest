import Phaser from 'phaser';
import { audioFor } from '../audio/GameAudio';
import { getLayout } from '../responsive';
import { fitScale, textResolutionFor } from '../systems/viewport';
import { applyTextResolution, paintPanel, setTextResolution, textStyle, UI } from '../ui/theme';

const PANEL_W = 320, PANEL_H = 300;

/** Pause overlay. Built around its own origin and scaled to fit, so it stays centred and tappable at any size. */
export class PauseScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private root!: Phaser.GameObjects.Container;
  private soundIcon!: Phaser.GameObjects.Graphics;

  constructor() { super('PauseScene'); }

  create() {
    const audio = audioFor(this);
    const leave = (next: () => void) => () => { audio.duck(false); audio.click(); next(); };
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x09241d, 0.62).setOrigin(0).setInteractive();
    const panel = this.add.graphics();
    paintPanel(panel, -PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 16, 0.97);
    setTextResolution(textResolutionFor(getLayout(this).uiScale));
    const title = this.add.text(0, -104, 'TAKE A BREATHER', { ...textStyle(22, UI.cream, true), letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
    const sub = this.add.text(0, -74, 'The forest will be right here when you return.', textStyle(12, UI.muted)).setOrigin(0.5);
    const resume = leave(() => { this.scene.stop(); this.scene.resume('WorldScene'); });
    this.root = this.add.container(0, 0, [panel, title, sub,
      ...this.button(-24, 'RESUME EXPLORING', true, resume),
      ...this.button(34, 'RESTART ADVENTURE', false, leave(() => { this.scene.stop('WorldScene'); this.scene.stop(); this.scene.start('WorldScene'); })),
      ...this.button(92, 'RETURN TO THE GROVE', false, leave(() => { this.scene.stop('WorldScene'); this.scene.stop(); this.scene.start('MainMenuScene'); })),
      ...this.soundButton(PANEL_W / 2 - 34, -PANEL_H / 2 + 34),
    ]);
    this.input.keyboard?.once('keydown-ESC', resume);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.layout();
  }

  private layout() {
    const layout = getLayout(this);
    const room = { w: layout.width - layout.safe.left - layout.safe.right, h: layout.height - layout.safe.top - layout.safe.bottom };
    const s = fitScale(PANEL_W + 24, PANEL_H + 24, room.w, room.h, layout.uiScale);
    this.dim.setSize(layout.width, layout.height);
    this.root.setScale(s).setPosition(layout.safe.left + room.w / 2, layout.safe.top + room.h / 2);
    applyTextResolution(this.root, textResolutionFor(s));
  }

  private button(y: number, label: string, primary: boolean, action: () => void) {
    // 44 design units tall: at least 44 CSS px on every phone layout.
    const bg = this.add.rectangle(0, y, 260, 46, primary ? UI.gold : UI.dim, primary ? 1 : 0.9).setStrokeStyle(1, UI.border, 0.7).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, y, label, textStyle(14, primary ? '#244d39' : UI.cream, true)).setOrigin(0.5);
    bg.on('pointerover', () => bg.setAlpha(0.85));
    bg.on('pointerout', () => bg.setAlpha(1));
    bg.on('pointerdown', action);
    return [bg, text];
  }

  /** A round speaker button in the panel's corner: waves when sound is on, a slash when it is off. */
  private soundButton(x: number, y: number) {
    const audio = audioFor(this);
    const disc = this.add.circle(x, y, 23, UI.dim, 0.9).setStrokeStyle(1, UI.border, 0.7).setInteractive({ useHandCursor: true });
    this.soundIcon = this.add.graphics({ x, y });
    const draw = () => {
      const g = this.soundIcon.clear();
      g.fillStyle(0xfff1c9, 1).fillRect(-10, -4, 5, 8);
      g.fillPoints([new Phaser.Geom.Point(-5, -4), new Phaser.Geom.Point(2, -9), new Phaser.Geom.Point(2, 9), new Phaser.Geom.Point(-5, 4)], true);
      if (audio.isMuted) g.lineStyle(3, 0xe8806a, 1).lineBetween(-12, -12, 12, 12);
      else {
        g.lineStyle(2, 0xfff1c9, 1);
        g.beginPath().arc(2, 0, 6, -0.9, 0.9).strokePath();
        g.beginPath().arc(2, 0, 11, -0.9, 0.9).strokePath();
      }
    };
    draw();
    disc.on('pointerover', () => disc.setAlpha(0.85));
    disc.on('pointerout', () => disc.setAlpha(1));
    disc.on('pointerdown', () => { if (!audio.toggleMuted()) audio.click(); draw(); });
    return [disc, this.soundIcon];
  }
}
