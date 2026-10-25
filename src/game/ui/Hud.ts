import Phaser from 'phaser';
import { getLayout } from '../responsive';
import { HUD_PANEL_HEIGHT, hudMetrics, type HudMetrics } from '../systems/uiLayout';
import { textResolutionFor } from '../systems/viewport';
import { Pill } from './Pill';
import { applyTextResolution, paintPanel, setTextResolution, textStyle, UI } from './theme';

export interface HudState { objective: string; timber: number; goal: number; xp: number }

const PANEL_H = HUD_PANEL_HEIGHT;

/**
 * Status panel (top-left), pause button (top-right), interaction prompt and toast.
 * Everything is placed by `hudMetrics`, so the same tested numbers drive desktop, tablet and phone layouts.
 * Desktop: prompt docked bottom-centre. Touch: the prompt floats beside the relevant character instead, so
 * it never competes with the thumb controls, and toasts move to the top where nothing else lives.
 */
export class Hud {
  private readonly status: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Text;
  private readonly chapter: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly xp: Phaser.GameObjects.Text;
  private readonly timberLabel: Phaser.GameObjects.Text;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly pause: Phaser.GameObjects.Container;
  private readonly pauseDisc: Phaser.GameObjects.Arc;
  private readonly pauseBars: Phaser.GameObjects.Graphics;
  private readonly docked: Pill;
  private readonly floating: Pill;
  private readonly toastPill: Pill;
  private toastTween?: Phaser.Tweens.Tween;
  private state: HudState = { objective: '', timber: 0, goal: 12, xp: 0 };
  private metrics!: HudMetrics;
  private touchLayout = false;
  private drawnUnits = -1;

  constructor(private readonly scene: Phaser.Scene, onPause: () => void, floatingPrompt: Pill) {
    this.panel = scene.add.graphics();
    this.zone = scene.add.text(13, 9, 'EMERALD WILDS', { ...textStyle(10, UI.goldCss, true), letterSpacing: 1.2 } as Phaser.Types.GameObjects.Text.TextStyle);
    this.chapter = scene.add.text(0, 9, 'CH. 1', { ...textStyle(10, UI.muted, true), letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle);
    this.xp = scene.add.text(0, 9, 'XP 0', { ...textStyle(10, UI.goldCss, true), letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0);
    this.objective = scene.add.text(13, 24, '', textStyle(13, UI.cream, true));
    this.pips = scene.add.graphics();
    this.timberLabel = scene.add.text(0, PANEL_H - 12, '', { ...textStyle(10, UI.cream, true), letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0.5);
    this.status = scene.add.container(0, 0, [this.panel, this.zone, this.chapter, this.xp, this.objective, this.pips, this.timberLabel])
      .setScrollFactor(0).setDepth(20000);

    this.pauseDisc = scene.add.circle(0, 0, 16, UI.panel, UI.panelAlpha).setStrokeStyle(1, UI.border, 0.6);
    this.pauseBars = scene.add.graphics();
    this.pauseBars.fillStyle(0xfff1c9, 1).fillRoundedRect(-5, -6, 3.5, 12, 1).fillRoundedRect(1.5, -6, 3.5, 12, 1);
    this.pause = scene.add.container(0, 0, [this.pauseDisc, this.pauseBars]).setScrollFactor(0).setDepth(20000)
      .setSize(40, 40).setInteractive({ useHandCursor: true });
    this.pause.on('pointerover', () => this.pauseDisc.setFillStyle(UI.dim, 1));
    this.pause.on('pointerout', () => this.pauseDisc.setFillStyle(UI.panel, UI.panelAlpha));
    this.pause.on('pointerdown', onPause);

    this.docked = new Pill(scene, 0, 0, 13).setScrollFactor(0).setDepth(22000).setVisible(false);
    // World-space twin of the docked prompt: it sits beside the character it talks about.
    this.floating = floatingPrompt;
    this.toastPill = new Pill(scene, 0, 0, 13, UI.goldCss).setScrollFactor(0).setDepth(22001).setVisible(false);

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.layout();
  }

  setState(next: HudState) {
    this.state = next;
    this.objective.setText(next.objective);
    this.fitObjective();
    this.xp.setText(`XP ${next.xp}`);
    this.timberLabel.setText(`TIMBER ${next.timber}/${next.goal}`);
    this.drawPips();
  }

  /**
   * Shows a prompt. On touch layouts `anchor` (world coordinates) places it beside the relevant character;
   * on desktop it is docked at the bottom of the screen as before.
   */
  setPrompt(text: string | null, anchor?: { x: number; y: number }) {
    if (!text) { this.hidePrompt(); return; }
    if (this.touchLayout && anchor) {
      this.docked.setVisible(false);
      this.floating.setLabel(text).setVisible(true);
      const view = this.scene.cameras.main.worldView;
      const layout = getLayout(this.scene);
      const half = (this.floating.width * this.floating.scaleX) / 2 + 6 / layout.worldZoom * layout.uiScale;
      const x = Phaser.Math.Clamp(anchor.x, view.x + half, Math.max(view.x + half, view.right - half));
      this.floating.setPosition(x, anchor.y);
      return;
    }
    this.floating.setVisible(false);
    this.docked.setLabel(text).setVisible(true);
  }

  hidePrompt() { this.docked.setVisible(false); this.floating.setVisible(false); }

  toast(text: string) {
    this.toastTween?.stop();
    this.toastPill.setLabel(text).setAlpha(1).setVisible(true);
    this.toastTween = this.scene.tweens.add({ targets: this.toastPill, alpha: 0, delay: 1700, duration: 350, onComplete: () => this.toastPill.setVisible(false) });
  }

  layout() {
    const layout = getLayout(this.scene);
    const m = this.metrics = hudMetrics(layout);
    const s = m.scale;
    this.touchLayout = layout.touch;
    const resolution = textResolutionFor(s);
    setTextResolution(resolution);

    const fonts = m.fonts;
    this.zone.setFontSize(fonts.header);
    this.chapter.setFontSize(fonts.header).setX(this.zone.x + this.zone.width + 7);
    this.xp.setFontSize(fonts.header).setX(m.panelUnits - 13);
    this.timberLabel.setFontSize(fonts.label).setX(m.panelUnits - 13);
    this.status.setScale(s).setPosition(m.panel.x, m.panel.y);

    const radius = m.pause.r / s;
    // The tap target is never smaller than 48 CSS px, whatever the button looks like.
    const hit = Math.max(radius * 2, (48 * layout.renderScale) / s);
    this.pauseDisc.setRadius(radius);
    this.pauseBars.setScale(radius / 16);
    this.pause.setSize(hit, hit);
    (this.pause.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(hit, hit);
    this.pause.setScale(s).setPosition(m.pause.cx, m.pause.cy);

    const zoom = layout.worldZoom;
    this.docked.setScale(s).setFontSize(fonts.prompt);
    this.docked.setPosition(layout.width / 2, layout.height - layout.safe.bottom - 10 * s - 14 * s);
    this.floating.setScale(s / zoom).setFontSize(fonts.prompt);
    this.toastPill.setScale(s).setFontSize(fonts.prompt);
    this.toastPill.setPosition(layout.width / 2, layout.touch ? m.toastY : layout.height - layout.safe.bottom - 10 * s - 52 * s);

    for (const root of [this.status, this.pause, this.docked, this.floating, this.toastPill]) applyTextResolution(root, resolution);
    this.docked.setResolution(resolution); this.floating.setResolution(resolution); this.toastPill.setResolution(resolution);
    this.drawPanel();
    this.setState(this.state);
  }

  private drawPanel() {
    const w = this.metrics.panelUnits;
    if (w === this.drawnUnits) return;
    this.drawnUnits = w;
    this.panel.clear();
    paintPanel(this.panel, 0, 0, w, PANEL_H, 12);
    this.panel.fillStyle(UI.gold, 1).fillRoundedRect(0, 10, 4, 16, 2);
    this.panel.lineStyle(1, UI.border, 0.18).lineBetween(13, 24, w - 13, 24);
  }

  private fitObjective() {
    const size = this.metrics.fonts.objective;
    // Never let a long objective spill out of the panel.
    this.objective.setFontSize(size);
    const room = this.metrics.panelUnits - 26;
    if (this.objective.width > room) this.objective.setFontSize(Math.max(10, Math.floor(size * room / this.objective.width)));
    this.objective.setY(26);
  }

  private drawPips() {
    const { goal, timber } = this.state;
    const w = this.metrics.panelUnits;
    const labelRoom = this.timberLabel.width + 14;
    this.pips.clear();
    const gap = 3, width = Math.max(4, (w - 26 - labelRoom - gap * (goal - 1)) / goal);
    for (let i = 0; i < goal; i++) {
      const x = 13 + i * (width + gap), y = PANEL_H - 15;
      this.pips.fillStyle(i < timber ? 0xd9a93f : 0x234a37, 1).fillRoundedRect(x, y, width, 7, 3.5);
      if (i < timber) this.pips.fillStyle(0xfff0b0, 0.8).fillRoundedRect(x + 1, y + 1, width - 2, 2.4, 1.2);
      else this.pips.lineStyle(1, 0x4d8a63, 0.6).strokeRoundedRect(x + 0.5, y + 0.5, width - 1, 6, 3);
    }
  }
}
