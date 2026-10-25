/**
 * The hero's face is a transparent decal painted in code (no image files) and laid over the front of the head.
 * Four expressions share one canvas each: open, blink, happy, hurt. The eye colour and brow colour follow the wardrobe.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

export type Expression = 'open' | 'blink' | 'happy' | 'hurt';
export const EXPRESSIONS: readonly Expression[] = ['open', 'blink', 'happy', 'hurt'];

/** The decal covers this part of the head: azimuth ±FACE_PHI/2 around the front, polar angle FACE_THETA0 .. FACE_THETA0 + FACE_THETA_LEN. */
export const FACE_PHI = 1.6;
export const FACE_THETA0 = Math.PI / 2 - 0.62;
export const FACE_THETA_LEN = 1.25;
const SIZE = 256;

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k)), g = Math.min(255, Math.round(((hex >> 8) & 255) * k)), b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/** Texture pixel for an angle (radians) to the right of the front line and below the equator. */
const px = (az: number): number => SIZE / 2 + (az / FACE_PHI) * SIZE;
const py = (below: number): number => ((Math.PI / 2 + below - FACE_THETA0) / FACE_THETA_LEN) * SIZE;

interface Palette { iris: number; brow: number; skin: number }

function eye(g: CanvasRenderingContext2D, side: -1 | 1, kind: Expression, pal: Palette): void {
  const cx = px(side * 0.34), cy = py(0.1);
  const hw = 27, hh = 38; // half width / height in pixels
  const outer = side; // direction of the outer corner
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const lash = '#2a1c24';
  if (kind === 'blink' || kind === 'happy') {
    g.strokeStyle = lash; g.lineWidth = 7;
    g.beginPath();
    if (kind === 'happy') { g.moveTo(cx - hw, cy + 8); g.quadraticCurveTo(cx, cy - hh * 0.75, cx + hw, cy + 8); }
    else { g.moveTo(cx - hw, cy + 2); g.quadraticCurveTo(cx, cy + hh * 0.42, cx + hw, cy + 2); }
    g.stroke();
    // little lash flick at the outer corner
    g.lineWidth = 5; g.beginPath(); g.moveTo(cx + outer * hw, kind === 'happy' ? cy + 8 : cy + 2); g.lineTo(cx + outer * (hw + 8), (kind === 'happy' ? cy + 8 : cy + 2) - 7); g.stroke();
    g.restore(); return;
  }
  const squint = kind === 'hurt' ? 0.55 : 1;
  const h = hh * squint;
  // sclera
  g.fillStyle = '#fffdf8'; g.beginPath(); g.ellipse(cx, cy, hw, h, 0, 0, Math.PI * 2); g.fill();
  // iris with a gradient: dark at the top, bright at the bottom
  const ir = hw * 0.8, ih = h * 0.86;
  const grad = g.createLinearGradient(0, cy - ih, 0, cy + ih);
  grad.addColorStop(0, css(shade(pal.iris, 0.45))); grad.addColorStop(0.55, css(pal.iris)); grad.addColorStop(1, css(shade(pal.iris, 1.45)));
  g.fillStyle = grad; g.beginPath(); g.ellipse(cx + side * 0.5, cy + 2, ir, ih, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = css(shade(pal.iris, 0.35)); g.lineWidth = 2.5; g.stroke();
  // pupil
  g.fillStyle = '#1b1220'; g.beginPath(); g.ellipse(cx + side * 0.5, cy + 3, ir * 0.42, ih * 0.5, 0, 0, Math.PI * 2); g.fill();
  // highlights
  g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(cx - 8, cy - h * 0.38, 8.5, 10, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 9, cy + h * 0.42, 4.2, 4.2, 0, 0, Math.PI * 2); g.fill();
  // upper lid (thick), lower lid (thin), flick
  g.strokeStyle = lash; g.lineWidth = 7;
  g.beginPath(); g.ellipse(cx, cy + 1, hw + 2, h + 1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(cx + outer * (hw + 1), cy - h * 0.3); g.lineTo(cx + outer * (hw + 9), cy - h * 0.62); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(42,28,36,0.55)';
  g.beginPath(); g.ellipse(cx, cy, hw, h, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  g.restore();
}

function brow(g: CanvasRenderingContext2D, side: -1 | 1, kind: Expression, pal: Palette): void {
  const cx = px(side * 0.36), cy = py(-0.2);
  g.save(); g.lineCap = 'round'; g.strokeStyle = css(shade(pal.brow, 0.85)); g.lineWidth = 6.5;
  g.beginPath();
  if (kind === 'hurt') { // worried: inner ends up
    g.moveTo(cx - side * 26, cy - 12); g.quadraticCurveTo(cx, cy + 2, cx + side * 28, cy + 8);
  } else if (kind === 'happy') {
    g.moveTo(cx - 28, cy + 2); g.quadraticCurveTo(cx, cy - 12, cx + 28, cy + 2);
  } else {
    g.moveTo(cx - side * 26, cy + 5); g.quadraticCurveTo(cx - side * 2, cy - 6, cx + side * 28, cy + 1);
  }
  g.stroke(); g.restore();
}

function mouth(g: CanvasRenderingContext2D, kind: Expression): void {
  const cx = px(0), cy = py(0.5);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'happy') {
    g.fillStyle = '#7a2a3a'; g.beginPath(); g.moveTo(cx - 20, cy - 6); g.quadraticCurveTo(cx, cy + 34, cx + 20, cy - 6); g.quadraticCurveTo(cx, cy + 2, cx - 20, cy - 6); g.fill();
    g.fillStyle = '#ff8a98'; g.beginPath(); g.ellipse(cx, cy + 12, 9, 5, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'hurt') {
    g.strokeStyle = '#6a2a38'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(cx - 14, cy + 6); g.quadraticCurveTo(cx - 5, cy - 3, cx, cy + 3); g.quadraticCurveTo(cx + 5, cy + 9, cx + 14, cy); g.stroke();
  } else {
    g.strokeStyle = '#6a2a38'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(cx - 17, cy - 1); g.quadraticCurveTo(cx, cy + 15, cx + 17, cy - 1); g.stroke();
  }
  g.restore();
}

export function paintFace(canvas: HTMLCanvasElement, kind: Expression, pal: Palette): void {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, SIZE, SIZE);
  // cheeks
  for (const s of [-1, 1] as const) {
    const bx = px(s * 0.5), by = py(0.34);
    const rg = g.createRadialGradient(bx, by, 0, bx, by, 30);
    rg.addColorStop(0, kind === 'hurt' ? 'rgba(255,110,110,0.30)' : 'rgba(255,92,120,0.42)'); rg.addColorStop(1, 'rgba(255,92,120,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(bx, by, 34, 22, 0, 0, Math.PI * 2); g.fill();
  }
  // nose shadow
  const nx = px(0), ny = py(0.3);
  const ng = g.createRadialGradient(nx, ny, 0, nx, ny, 16);
  ng.addColorStop(0, 'rgba(150,80,60,0.22)'); ng.addColorStop(1, 'rgba(150,80,60,0)');
  g.fillStyle = ng; g.beginPath(); g.arc(nx, ny, 16, 0, Math.PI * 2); g.fill();
  brow(g, -1, kind, pal); brow(g, 1, kind, pal);
  eye(g, -1, kind, pal); eye(g, 1, kind, pal);
  mouth(g, kind);
}

/** One canvas texture per expression, repainted when the wardrobe colours change. */
export class FaceSet {
  private readonly canvases = {} as Record<Expression, HTMLCanvasElement>;
  readonly textures = {} as Record<Expression, CanvasTexture>;
  constructor() {
    for (const e of EXPRESSIONS) {
      const c = document.createElement('canvas'); c.width = c.height = SIZE;
      this.canvases[e] = c;
      const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
      this.textures[e] = t;
    }
  }
  paint(pal: Palette): void {
    for (const e of EXPRESSIONS) { paintFace(this.canvases[e], e, pal); this.textures[e].needsUpdate = true; }
  }
  dispose(): void { for (const e of EXPRESSIONS) this.textures[e].dispose(); }
}
