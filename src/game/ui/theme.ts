import type Phaser from 'phaser';

/** One small design language for every label, prompt and button: dark-green panels, restrained gold. */
export const UI = {
  font: 'Trebuchet MS, Verdana, Arial, sans-serif',
  panel: 0x0f2b21,
  panelAlpha: 0.86,
  border: 0xe2bf6a,
  borderAlpha: 0.5,
  gold: 0xe2bf6a,
  goldCss: '#e2bf6a',
  cream: '#fff1c9',
  muted: '#a9cdb0',
  dim: 0x2b5a42,
} as const;

let textResolution = 2;

/** Rasterisation resolution for new text; follows the HUD scale so labels stay sharp on dense screens. */
export function setTextResolution(resolution: number) { textResolution = resolution; }
export function getTextResolution() { return textResolution; }

export function textStyle(size: number, color: string = UI.cream, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', resolution: textResolution };
}

/** Re-rasterises every Text under `root` at `resolution`. Only does work when the resolution really changed. */
export function applyTextResolution(root: Phaser.GameObjects.GameObject, resolution: number) {
  if (root.type === 'Text') {
    const label = root as Phaser.GameObjects.Text;
    if (label.style.resolution !== resolution) label.setResolution(resolution);
  } else if (root.type === 'Container') {
    (root as Phaser.GameObjects.Container).list.forEach((child) => applyTextResolution(child, resolution));
  }
}

/** Painted-style panel: soft drop shadow, a lighter top sheen, a gold rim and a fine inner line. */
export function paintPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, alpha: number = UI.panelAlpha, fill: number = UI.panel) {
  g.fillStyle(0x06190f, 0.32).fillRoundedRect(x + 1, y + 3, w, h, r);
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xffffff, 0.06).fillRoundedRect(x + 1, y + 1, w - 2, Math.max(4, h * 0.45), { tl: r, tr: r, bl: 2, br: 2 });
  g.lineStyle(1.5, UI.border, 0.7).strokeRoundedRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  g.lineStyle(1, UI.border, 0.2).strokeRoundedRect(x + 3.5, y + 3.5, w - 7, h - 7, Math.max(2, r - 3));
}
