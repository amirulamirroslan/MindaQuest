import Phaser from 'phaser';
import { getLayout } from '../responsive';
import { textResolutionFor } from '../systems/viewport';
import { applyTextResolution, paintPanel, textStyle, UI } from './theme';

const MIN_H = 76;

/** Bottom-centre speech box. Advances with E / Space or by tapping/clicking anywhere on it. */
export class DialogueBox {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly tab: Phaser.GameObjects.Graphics;
  private readonly speaker: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private pages: string[] = [];
  private page = 0;
  private hintAction = 'E / SPACE';
  private onClose?: () => void;
  private boxH = MIN_H;
  open = false;
  /** Lets the scene play blips as pages open, turn and close, including when the box is tapped. */
  onSound?: (kind: 'open' | 'next' | 'close') => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x071e18, 0.3).setOrigin(0).setScrollFactor(0).setDepth(29990).setVisible(false).setInteractive();
    this.bg = scene.add.graphics();
    this.tab = scene.add.graphics();
    this.speaker = scene.add.text(14, -13, '', textStyle(11, '#3a2a10', true));
    this.body = scene.add.text(18, 18, '', { ...textStyle(16, UI.cream), lineSpacing: 4 });
    this.hint = scene.add.text(0, MIN_H - 14, '', textStyle(10, UI.muted, true)).setOrigin(1, 0.5);
    this.root = scene.add.container(0, 0, [this.bg, this.tab, this.speaker, this.body, this.hint]).setScrollFactor(0).setDepth(29991).setVisible(false);
    this.dim.on('pointerdown', () => this.advance());
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.dim.destroy(); this.root.destroy();
    });
  }

  show(speaker: string, pages: string[], touch: boolean, onClose?: () => void) {
    this.pages = pages; this.page = 0; this.onClose = onClose; this.open = true;
    this.hintAction = touch ? 'TAP' : 'E / SPACE';
    this.speaker.setText(speaker);
    this.layout();
    this.root.setVisible(true); this.dim.setVisible(true);
    this.onSound?.('open');
    this.showPage();
  }

  advance() {
    if (!this.open) return;
    this.page++;
    if (this.page >= this.pages.length) {
      this.onSound?.('close');
      this.open = false;
      this.root.setVisible(false); this.dim.setVisible(false);
      this.onClose?.();
      return;
    }
    this.onSound?.('next');
    this.showPage();
  }

  private showPage() {
    this.body.setText(this.pages[this.page]);
    this.boxH = Math.max(MIN_H, Math.ceil(this.body.height) + 54);
    this.layout();
    this.hint.setText(`${this.hintAction}  ·  ${this.page === this.pages.length - 1 ? 'CLOSE' : 'NEXT'}`);
  }

  layout() {
    const layout = getLayout(this.scene);
    const { width, height } = layout;
    const s = layout.uiScale;
    const room = width - layout.safe.left - layout.safe.right - 24 * s;
    const boxW = Math.min(600, room / s);
    this.dim.setSize(width, height);
    this.bg.clear();
    paintPanel(this.bg, 0, 0, boxW, this.boxH, 14, 0.95);
    const tabW = Math.ceil(this.speaker.width) + 28;
    this.tab.clear();
    this.tab.fillStyle(0x06190f, 0.3).fillRoundedRect(7, -20, tabW, 24, 9);
    this.tab.fillStyle(UI.gold, 1).fillRoundedRect(6, -22, tabW, 24, 9);
    this.tab.fillStyle(0xffffff, 0.28).fillRoundedRect(8, -20.5, tabW - 4, 8, 6);
    this.tab.lineStyle(1.5, 0x9a7330, 0.9).strokeRoundedRect(6.75, -21.25, tabW - 1.5, 22.5, 9);
    this.speaker.setPosition(20, -16);
    this.body.setWordWrapWidth(boxW - 36);
    this.hint.setPosition(boxW - 14, this.boxH - 14);
    applyTextResolution(this.root, textResolutionFor(s));
    const left = layout.safe.left + (width - layout.safe.left - layout.safe.right - boxW * s) / 2;
    this.root.setScale(s).setPosition(left, height - layout.safe.bottom - (this.boxH + 12) * s);
  }
}
