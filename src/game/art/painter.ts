import Phaser from 'phaser';
import { seededRandom, trailPoint, TILE } from '../systems/forestLayout';
import { valueNoise } from '../systems/terrain';
import { RIVER_HALF_WIDTH, riverCenterX, WORLD_HEIGHT } from '../systems/worldGeometry';

/**
 * Procedural "painted" art. Everything here is drawn with the Canvas 2D API at boot, so the game ships no new
 * image files and no third-party art: soft gradients, clustered leaf masses and warm light instead of hard pixels.
 * Object textures are drawn at OBJ x resolution; scenes scale them back down by 1 / OBJ.
 */
export const OBJ = 2;
export const ISO_W = 1600;
export const ISO_H = 800;
const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

export function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return canvas;
}

export function register(textures: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement) {
  if (textures.exists(key)) textures.remove(key);
  textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Colour of the dark contour drawn around solid objects, matching the Adventurer hero's outline. */
export const OUTLINE_RGB = [28, 20, 12] as const;
/** Pixels at or above this alpha count as solid object; softer pixels (cast shadows, glows) get no contour. */
const SOLID_ALPHA = 150;

/**
 * Draws a 1-logical-pixel dark contour around the solid parts of a canvas, in place. The hero sprite has a
 * dark outline; giving trees, rocks, logs and bushes the same one makes them read as the same world.
 * Soft shadow pixels are not solid, so they keep their soft edge.
 */
export function addOutline(canvas: HTMLCanvasElement, radius = OBJ) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  let solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0;
  const original = solid;
  // Grow the solid mask one pixel per pass (4-neighbourhood, plus diagonals on odd passes to keep it round).
  for (let pass = 0; pass < radius; pass++) {
    const next = Uint8Array.from(solid);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const l = x > 0 && solid[i - 1], r = x < w - 1 && solid[i + 1], u = y > 0 && solid[i - w], b = y < h - 1 && solid[i + w];
        if (l || r || u || b) next[i] = 1;
        else if (pass % 2 === 1 && ((x > 0 && y > 0 && solid[i - w - 1]) || (x < w - 1 && y > 0 && solid[i - w + 1]) || (x > 0 && y < h - 1 && solid[i + w - 1]) || (x < w - 1 && y < h - 1 && solid[i + w + 1]))) next[i] = 1;
      }
    }
    solid = next;
  }
  for (let i = 0; i < w * h; i++) {
    if (solid[i] && !original[i]) {
      d[i * 4] = OUTLINE_RGB[0]; d[i * 4 + 1] = OUTLINE_RGB[1]; d[i * 4 + 2] = OUTLINE_RGB[2]; d[i * 4 + 3] = 235;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Draw into a new texture in logical units (the context is pre-scaled by OBJ). `outline` adds the dark contour. */
export function makeObject(textures: Phaser.Textures.TextureManager, key: string, w: number, h: number, draw: (ctx: Ctx) => void, outline = false) {
  const canvas = makeCanvas(w * OBJ, h * OBJ);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(OBJ, OBJ);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  if (outline) addOutline(canvas);
  register(textures, key, canvas);
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation: number, fill: string | CanvasGradient, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ palettes

interface Palette { hi: string; mid: string; lo: string; dab: string; dark: string }

export const CANOPY: Record<string, Palette> = {
  green: { hi: '#a2d462', mid: '#47a24f', lo: '#1a5c3f', dab: '#c4ea80', dark: '#123f2c' },
  teal: { hi: '#6fcaa8', mid: '#2a8f7c', lo: '#10465c', dab: '#9ae0c2', dark: '#0a3045' },
  gold: { hi: '#d9e36a', mid: '#8cb946', lo: '#386f33', dab: '#ecf08e', dark: '#27572e' },
  rose: { hi: '#f58aa8', mid: '#c4406f', lo: '#6c1c4c', dab: '#f6b8c8', dark: '#4a1238' },
};

// ------------------------------------------------------------------ trees

function lobe(ctx: Ctx, cx: number, cy: number, r: number, pal: Palette, rng: Rng) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  const g = ctx.createLinearGradient(cx - r * 0.6, cy - r, cx + r * 0.55, cy + r);
  g.addColorStop(0, pal.hi); g.addColorStop(0.42, pal.mid); g.addColorStop(1, pal.lo);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (let i = 0; i < 26; i++) {
    const angle = rng() * TAU, dist = Math.sqrt(rng()) * r * 0.95;
    const x = cx + Math.cos(angle) * dist, y = cy + Math.sin(angle) * dist;
    const lit = (x - cx) * -0.55 + (y - cy) * -0.85 > -r * 0.05;
    blob(ctx, x, y, r * (0.1 + rng() * 0.1), r * (0.05 + rng() * 0.06), rng() * Math.PI, lit ? pal.dab : pal.dark, lit ? 0.5 : 0.32);
  }
  ctx.restore();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = pal.lo;
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function trunk(ctx: Ctx, cx: number, baseY: number, topY: number, width: number) {
  const g = ctx.createLinearGradient(cx - width, 0, cx + width, 0);
  g.addColorStop(0, '#5a3a28'); g.addColorStop(0.4, '#9b6a44'); g.addColorStop(1, '#5e3d2a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - width * 1.5, baseY + 1);
  ctx.quadraticCurveTo(cx - width * 0.55, baseY - 8, cx - width * 0.5, baseY - 22);
  ctx.lineTo(cx - width * 0.42, topY);
  ctx.lineTo(cx + width * 0.42, topY);
  ctx.lineTo(cx + width * 0.5, baseY - 22);
  ctx.quadraticCurveTo(cx + width * 0.6, baseY - 8, cx + width * 1.6, baseY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,12,0.35)';
  ctx.lineWidth = 0.9;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * width * 0.28, baseY - 2); ctx.lineTo(cx + i * width * 0.2, topY + 4); ctx.stroke(); }
}

function roundTree(textures: Phaser.Textures.TextureManager, key: string, seed: number, pal: Palette, scale = 1) {
  const w = 132, h = 152;
  makeObject(textures, key, w, h, (ctx) => {
    const rng = seededRandom(seed);
    ctx.translate(w / 2, h);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h);
    trunk(ctx, w / 2, 146, 86, 8);
    // Soft contact shade where the canopy meets the trunk.
    blob(ctx, w / 2, 100, 26, 8, 0, 'rgba(10,30,26,0.4)');
    const spec: Array<[number, number, number]> = [[-27, 10, 21], [27, 12, 20], [0, 18, 24], [-35, -8, 17], [35, -6, 16], [-14, -16, 23], [17, -18, 22], [0, -34, 21], [-3, -4, 26]];
    spec.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, r] of spec) lobe(ctx, w / 2 + dx + (rng() - 0.5) * 4, 62 + dy + (rng() - 0.5) * 4, r * (0.95 + rng() * 0.1), pal, rng);
    for (let i = 0; i < 16; i++) blob(ctx, w / 2 + (rng() - 0.5) * 58, 40 + (rng() - 0.5) * 46, 2.4, 1.2, rng() * 3, pal.dab, 0.55);
  }, true);
}

function pine(textures: Phaser.Textures.TextureManager, key: string, seed: number, pal: Palette) {
  const w = 104, h = 176;
  makeObject(textures, key, w, h, (ctx) => {
    const rng = seededRandom(seed);
    const cx = w / 2;
    trunk(ctx, cx, 172, 150, 5);
    const tiers = 5;
    for (let i = tiers - 1; i >= 0; i--) {
      const top = 8 + i * 28, bottom = top + 46, half = 15 + i * 8.5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.quadraticCurveTo(cx + half * 0.5, top + (bottom - top) * 0.45, cx + half, bottom - 6);
      const scallops = 4;
      for (let s = 0; s < scallops; s++) {
        const x0 = cx + half - (s * 2 * half) / scallops, x1 = cx + half - ((s + 1) * 2 * half) / scallops;
        ctx.quadraticCurveTo((x0 + x1) / 2, bottom + 7, x1, bottom - 6);
      }
      ctx.quadraticCurveTo(cx - half * 0.5, top + (bottom - top) * 0.45, cx, top);
      ctx.closePath();
      ctx.clip();
      const g = ctx.createLinearGradient(cx - half, top, cx + half * 0.8, bottom);
      g.addColorStop(0, pal.hi); g.addColorStop(0.5, pal.mid); g.addColorStop(1, pal.lo);
      ctx.fillStyle = g;
      ctx.fillRect(cx - half - 2, top - 2, half * 2 + 4, bottom - top + 12);
      for (let k = 0; k < 34; k++) {
        const x = cx + (rng() - 0.5) * half * 1.7, y = top + rng() * (bottom - top);
        const lit = x < cx + (y - top) * 0.05;
        blob(ctx, x, y, 3 + rng() * 3.5, 1.2 + rng() * 1.4, -0.5 + rng() * 0.6, lit ? pal.dab : pal.dark, lit ? 0.5 : 0.35);
      }
      // Shadow cast on the tier below.
      const shade = ctx.createLinearGradient(0, bottom - 14, 0, bottom + 8);
      shade.addColorStop(0, 'rgba(8,40,50,0)'); shade.addColorStop(1, 'rgba(8,40,50,0.45)');
      ctx.fillStyle = shade;
      ctx.fillRect(cx - half - 2, bottom - 14, half * 2 + 4, 24);
      ctx.restore();
    }
    blob(ctx, cx - 1, 10, 2.5, 4, 0, pal.hi, 0.9);
  }, true);
}

// ------------------------------------------------------------------ bushes, flowers, rocks

type BushKind = 'big' | 'wide' | 'small' | 'tiny';
const BUSH_SPECS: Record<BushKind, { w: number; h: number; lobes: Array<[number, number, number]> }> = {
  big: { w: 78, h: 64, lobes: [[-20, 3, 16], [20, 5, 15], [0, -8, 19], [-4, 10, 15]] },
  wide: { w: 72, h: 36, lobes: [[-22, 2, 12], [0, -3, 14], [22, 3, 12], [-8, 7, 10], [10, 8, 10]] },
  small: { w: 44, h: 34, lobes: [[-9, 2, 11], [9, 3, 10], [0, -5, 12]] },
  tiny: { w: 28, h: 22, lobes: [[-5, 1, 7], [5, 2, 6.5], [0, -3, 7.5]] },
};
export const FLOWER_COLORS = ['', '#ffffff', '#ffd84a', '#ff7fa8', '#8fc6ff'];

export function bushKey(kind: BushKind, flower: number) { return `paint-bush-${kind}-${flower}`; }
export function bushKindFor(frame: string): BushKind {
  if (frame === 'bush-big') return 'big';
  if (frame.startsWith('bush-wide')) return 'wide';
  if (frame.startsWith('bush-small')) return 'small';
  return 'tiny';
}

function bush(textures: Phaser.Textures.TextureManager, kind: BushKind, flower: number, seed: number) {
  const { w, h, lobes } = BUSH_SPECS[kind];
  makeObject(textures, bushKey(kind, flower), w, h, (ctx) => {
    const rng = seededRandom(seed);
    const pal = kind === 'wide' ? CANOPY.gold : CANOPY.green;
    const base = h - 4;
    blob(ctx, w / 2, base, w * 0.4, h * 0.14, 0, 'rgba(10,36,28,0.4)');
    const sorted = [...lobes].sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, r] of sorted) lobe(ctx, w / 2 + dx, base - r - 2 + dy, r, pal, rng);
    if (flower > 0) {
      for (let i = 0; i < 9; i++) {
        const x = w / 2 + (rng() - 0.5) * w * 0.7, y = base - h * 0.3 - rng() * h * 0.42;
        for (let p = 0; p < 5; p++) blob(ctx, x + Math.cos((p / 5) * TAU) * 1.7, y + Math.sin((p / 5) * TAU) * 1.7, 1.5, 1.5, 0, FLOWER_COLORS[flower]);
        blob(ctx, x, y, 1.1, 1.1, 0, '#f6b73c');
      }
    }
  }, true);
}

export function rockKey(frame: string) { return frame === 'rock-wide' ? 'paint-rock-wide' : frame === 'rock-tall' ? 'paint-rock-tall' : 'paint-rock-a'; }

function rock(textures: Phaser.Textures.TextureManager, key: string, w: number, h: number, points: Array<[number, number]>, seed: number) {
  makeObject(textures, key, w, h, (ctx) => {
    const rng = seededRandom(seed);
    blob(ctx, w / 2, h - 3, w * 0.46, h * 0.12, 0, 'rgba(10,36,28,0.35)');
    ctx.save();
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * w, y * h) : ctx.lineTo(x * w, y * h)));
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9d4cb'); g.addColorStop(0.5, '#86978f'); g.addColorStop(1, '#4b5d63');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Moss on top, facets and chips.
    for (let i = 0; i < 7; i++) blob(ctx, w * (0.2 + rng() * 0.6), h * (0.1 + rng() * 0.22), w * 0.13, h * 0.08, rng(), i % 2 ? '#7cbc58' : '#5b9f4b', 0.9);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.5); ctx.lineTo(w * 0.45, h * 0.3); ctx.lineTo(w * 0.7, h * 0.36); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,45,52,0.4)';
    ctx.beginPath(); ctx.moveTo(w * 0.55, h * 0.42); ctx.lineTo(w * 0.6, h * 0.95); ctx.stroke();
    ctx.restore();
  }, true);
}

export function tuftKey(frame: string): { key: string; scale: number } {
  const n = Number(frame.split('-')[1] ?? 1);
  if (n === 9) return { key: 'paint-lotus', scale: 0.7 };
  if (n === 8) return { key: 'paint-daisy-pink', scale: 0.9 };
  if (n === 7) return { key: 'paint-daisy-yellow', scale: 0.9 };
  if (n === 6) return { key: 'paint-daisy-white', scale: 0.9 };
  return { key: `paint-tuft-${n % 3}`, scale: 1 };
}

function grassTuft(textures: Phaser.Textures.TextureManager, index: number) {
  makeObject(textures, `paint-tuft-${index}`, 28, 26, (ctx) => {
    const rng = seededRandom(100 + index);
    const tones = ['#2f7f45', '#4fa24d', '#79c357', '#a6dc6c'];
    for (let i = 0; i < 9; i++) {
      const lean = (i - 4) * 2.6 + (rng() - 0.5) * 2;
      ctx.strokeStyle = tones[(i + index) % tones.length];
      ctx.lineWidth = 2.2 - Math.abs(i - 4) * 0.12;
      ctx.beginPath();
      ctx.moveTo(14 + (i - 4) * 1.2, 24);
      ctx.quadraticCurveTo(14 + lean * 0.5, 14, 14 + lean, 4 + rng() * 6 + Math.abs(i - 4));
      ctx.stroke();
    }
  });
}

function daisy(textures: Phaser.Textures.TextureManager, key: string, petal: string) {
  makeObject(textures, key, 30, 32, (ctx) => {
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = i === 1 ? '#5fae52' : '#3f8e48'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, 30); ctx.quadraticCurveTo(15 + (i - 1) * 7, 20, 15 + (i - 1) * 11, 12); ctx.stroke(); }
    ctx.strokeStyle = '#4a9a4a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(15, 30); ctx.lineTo(15, 12); ctx.stroke();
    for (let p = 0; p < 6; p++) blob(ctx, 15 + Math.cos((p / 6) * TAU) * 4.2, 11 + Math.sin((p / 6) * TAU) * 4.2, 3.2, 2.2, (p / 6) * TAU, petal);
    blob(ctx, 15, 11, 2.4, 2.4, 0, '#f2a93a');
  });
}

function lotus(textures: Phaser.Textures.TextureManager) {
  makeObject(textures, 'paint-lotus', 52, 46, (ctx) => {
    blob(ctx, 26, 41, 22, 5, 0, 'rgba(10,36,28,0.3)');
    for (const [dx, dy, rot] of [[-14, 34, -0.5], [14, 35, 0.5], [0, 37, 0]] as const) blob(ctx, 26 + dx, dy, 13, 4.6, rot, '#3f9a4a');
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 7 : 5, radius = ring === 0 ? 15 : 8, size = ring === 0 ? 8 : 6;
      for (let p = 0; p < count; p++) {
        const angle = (p / count) * Math.PI - Math.PI;
        const px = 26 + Math.cos(angle) * radius, py = 26 + Math.sin(angle) * radius * 0.5 + (ring ? -1 : 3);
        const g = ctx.createLinearGradient(px, py - size, px, py + size);
        g.addColorStop(0, ring ? '#ff9ec8' : '#e85a9e'); g.addColorStop(1, ring ? '#ffd0e4' : '#ff8fbf');
        blob(ctx, px, py, size * 0.5, size, angle + Math.PI / 2 + 0.0, g);
      }
    }
    const core = ctx.createRadialGradient(26, 24, 1, 26, 24, 7);
    core.addColorStop(0, '#ecfff8'); core.addColorStop(1, '#4cc8d6');
    blob(ctx, 26, 25, 7, 5, 0, core);
  });
}

// ------------------------------------------------------------------ logs, stumps, posts, shadow

function log(textures: Phaser.Textures.TextureManager) {
  makeObject(textures, 'paint-log', 70, 30, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 26);
    g.addColorStop(0, '#c58a55'); g.addColorStop(0.5, '#9a6238'); g.addColorStop(1, '#5f3a22');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(60, 5); ctx.lineTo(60, 25); ctx.lineTo(8, 25); ctx.quadraticCurveTo(2, 15, 8, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,12,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(10 + i * 6, 8 + i * 4); ctx.quadraticCurveTo(34, 7 + i * 4.4, 58, 9 + i * 4); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,230,180,0.5)'; ctx.beginPath(); ctx.moveTo(12, 8); ctx.lineTo(56, 8); ctx.stroke();
    const end = ctx.createRadialGradient(61, 15, 1, 61, 15, 11);
    end.addColorStop(0, '#f2d19a'); end.addColorStop(1, '#c99557');
    blob(ctx, 61, 15, 5.5, 10.4, 0, end);
    ctx.strokeStyle = 'rgba(120,70,30,0.6)'; ctx.lineWidth = 0.9;
    for (const r of [3, 6.5]) { ctx.beginPath(); ctx.ellipse(61, 15, r * 0.55, r, 0, 0, TAU); ctx.stroke(); }
  }, true);
}

function stump(textures: Phaser.Textures.TextureManager) {
  makeObject(textures, 'paint-stump', 64, 64, (ctx) => {
    blob(ctx, 32, 57, 26, 6, 0, 'rgba(10,36,28,0.35)');
    const side = ctx.createLinearGradient(8, 0, 56, 0);
    side.addColorStop(0, '#6b4429'); side.addColorStop(0.4, '#a56f45'); side.addColorStop(1, '#5b3822');
    ctx.fillStyle = side;
    ctx.beginPath(); ctx.moveTo(10, 24); ctx.lineTo(6, 54); ctx.quadraticCurveTo(32, 62, 58, 54); ctx.lineTo(54, 24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,12,0.4)'; ctx.lineWidth = 1;
    for (const x of [16, 24, 33, 42, 49]) { ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x + (x - 32) * 0.12, 56); ctx.stroke(); }
    const top = ctx.createRadialGradient(30, 21, 2, 32, 24, 24);
    top.addColorStop(0, '#f6dba6'); top.addColorStop(1, '#d6a566');
    blob(ctx, 32, 24, 23, 11.5, 0, top);
    ctx.strokeStyle = 'rgba(130,80,36,0.55)'; ctx.lineWidth = 1;
    for (const r of [5, 10, 15, 20]) { ctx.beginPath(); ctx.ellipse(32, 24, r, r * 0.5, 0, 0, TAU); ctx.stroke(); }
    blob(ctx, 14, 52, 7, 3, 0.3, '#6ab253', 0.95);
    blob(ctx, 22, 55, 5, 2.4, 0, '#8bcd62', 0.9);
  }, true);
}

function post(textures: Phaser.Textures.TextureManager) {
  makeObject(textures, 'paint-post', 26, 66, (ctx) => {
    blob(ctx, 13, 62, 10, 3, 0, 'rgba(10,36,28,0.35)');
    const g = ctx.createLinearGradient(5, 0, 21, 0);
    g.addColorStop(0, '#68412a'); g.addColorStop(0.45, '#b07848'); g.addColorStop(1, '#5e3a24');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(4, 60); ctx.lineTo(22, 60); ctx.lineTo(21, 12); ctx.closePath(); ctx.fill();
    blob(ctx, 13, 12, 8.5, 4, 0, '#e7c68a');
    ctx.strokeStyle = '#d9c28a'; ctx.lineWidth = 2;
    for (const y of [20, 25, 30]) { ctx.beginPath(); ctx.moveTo(4.5, y); ctx.quadraticCurveTo(13, y + 3, 21.5, y); ctx.stroke(); }
  }, true);
}

function shadowTexture(textures: Phaser.Textures.TextureManager) {
  makeObject(textures, 'paint-shadow', 64, 32, (ctx) => {
    ctx.save();
    ctx.translate(32, 16);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(14,38,30,0.55)'); g.addColorStop(1, 'rgba(14,38,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.restore();
  });
}

function lightShaft(textures: Phaser.Textures.TextureManager) {
  const canvas = makeCanvas(256, 512);
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,244,190,0)'); g.addColorStop(0.5, 'rgba(255,244,190,0.55)'); g.addColorStop(1, 'rgba(255,244,190,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 512);
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createLinearGradient(0, 0, 0, 512);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.25, 'rgba(0,0,0,1)'); fade.addColorStop(0.75, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 256, 512);
  register(textures, 'paint-shaft', canvas);
}

/** Builds every object texture. Cheap (a few ms each); runs once in BootScene. */
export function createPaintedObjects(textures: Phaser.Textures.TextureManager) {
  roundTree(textures, 'paint-tree-0', 11, CANOPY.green);
  roundTree(textures, 'paint-tree-1', 23, CANOPY.teal);
  roundTree(textures, 'paint-tree-2', 37, CANOPY.gold);
  roundTree(textures, 'paint-tree-rose', 41, CANOPY.rose, 0.72);
  pine(textures, 'paint-pine-0', 53, CANOPY.teal);
  pine(textures, 'paint-pine-1', 67, CANOPY.green);
  (['big', 'wide', 'small', 'tiny'] as const).forEach((kind, k) => FLOWER_COLORS.forEach((_c, flower) => bush(textures, kind, flower, 300 + k * 10 + flower)));
  rock(textures, 'paint-rock-a', 30, 30, [[0.1, 0.9], [0.05, 0.5], [0.28, 0.14], [0.7, 0.1], [0.95, 0.5], [0.9, 0.9]], 5);
  rock(textures, 'paint-rock-wide', 58, 34, [[0.03, 0.9], [0.05, 0.55], [0.22, 0.2], [0.6, 0.08], [0.9, 0.35], [0.98, 0.9]], 6);
  rock(textures, 'paint-rock-tall', 24, 38, [[0.1, 0.95], [0.08, 0.4], [0.3, 0.06], [0.7, 0.1], [0.92, 0.5], [0.88, 0.95]], 7);
  [0, 1, 2].forEach((i) => grassTuft(textures, i));
  daisy(textures, 'paint-daisy-white', '#ffffff');
  daisy(textures, 'paint-daisy-yellow', '#ffd84a');
  daisy(textures, 'paint-daisy-pink', '#ff8fb8');
  lotus(textures);
  log(textures); stump(textures); post(textures); shadowTexture(textures); lightShaft(textures);
}

// ------------------------------------------------------------------ terrain

const hexToRgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
const shade = (hex: string, f: number) => { const [r, g, b] = hexToRgb(hex); return `rgb(${Math.round(Math.min(255, r * f))},${Math.round(Math.min(255, g * f))},${Math.round(Math.min(255, b * f))})`; };

const GRASS_TONES = ['#276a3b', '#347d40', '#46903f', '#5aa247', '#74b24f', '#8fc156'];

/** Fills a rectangle (screen space, scaled by S) with layered, clustered grass. */
export function paintGrass(ctx: Ctx, width: number, height: number, S: number, seed: number) {
  const rng = seededRandom(seed);
  ctx.save();
  ctx.scale(S, S);
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#54984a'); base.addColorStop(1, '#3f8741');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  const tone = (x: number, y: number) => valueNoise(x / 240, y / 240, 3) * 0.6 + valueNoise(x / 70, y / 70, 5) * 0.3 + rng() * 0.1;
  // Broad warm and cool patches.
  for (let y = 0; y < height + 40; y += 36) {
    for (let x = 0; x < width + 40; x += 36) {
      const n = tone(x, y);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 54);
      const col = n > 0.5 ? '190,226,96' : '30,100,74';
      const a = Math.abs(n - 0.5) * 0.5;
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - 54, y - 54, 108, 108);
    }
  }
  // Leaf clusters, back to front, each with a dark underside and a lit top.
  const count = Math.round((width * height) / 250);
  const spots: Array<{ x: number; y: number; r: number; t: number }> = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * width, y = rng() * height;
    spots.push({ x, y, r: 8 + rng() * 8, t: Math.min(0.999, Math.max(0, tone(x, y))) });
  }
  spots.sort((a, b) => a.y - b.y);
  for (const s of spots) {
    const color = GRASS_TONES[Math.min(GRASS_TONES.length - 1, Math.floor(s.t * GRASS_TONES.length))];
    blob(ctx, s.x, s.y + 1.8, s.r, s.r * 0.6, 0, shade(color, 0.84), 0.85);
    blob(ctx, s.x, s.y, s.r, s.r * 0.58, 0, shade(color, 1), 0.92);
    blob(ctx, s.x - s.r * 0.18, s.y - s.r * 0.22, s.r * 0.58, s.r * 0.28, -0.2, shade(color, 1.14), 0.7);
  }
  // Tiny blades and speckles.
  for (let i = 0; i < count * 0.7; i++) {
    const x = rng() * width, y = rng() * height;
    const light = rng() < 0.55;
    ctx.strokeStyle = light ? 'rgba(206,238,120,0.4)' : 'rgba(24,88,60,0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 2.5, y - 2 - rng() * 3); ctx.stroke();
  }
  ctx.restore();
}

/** Soft-edged fill using the shadow trick: works in every browser (unlike ctx.filter on older Safari). */
function softFill(ctx: Ctx, fill: string, blur: number, draw: () => void) {
  const OFFSET = 8000;
  ctx.save();
  const m = ctx.getTransform();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e - OFFSET, m.f);
  ctx.shadowColor = fill;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = OFFSET;
  ctx.fillStyle = '#000';
  draw();
  ctx.restore();
}

const toScreen = (x: number, y: number) => ({ x: (x - y) * 0.5 + WORLD_HEIGHT * 0.5, y: (x + y) * 0.25 });

function riverHalf(y: number) { return RIVER_HALF_WIDTH + Math.sin(y / 122) * 8; }

function riverPolygon(inset: number, wobble: number): Array<[number, number]> {
  const left: Array<[number, number]> = [], right: Array<[number, number]> = [];
  for (let y = -1000; y <= 2400; y += 8) {
    const half = riverHalf(y) + inset;
    const w1 = (valueNoise(y / 16, 1, 91) - 0.5) * 2 * wobble, w2 = (valueNoise(y / 16, 9, 77) - 0.5) * 2 * wobble;
    left.push([riverCenterX(y) - half + w1, y]);
    right.push([riverCenterX(y) + half + w2, y]);
  }
  return [...left, ...right.reverse()];
}

interface Disc { x: number; y: number; r: number }
function pathDiscs(): Disc[] {
  const discs: Disc[] = [];
  for (let i = 0; i <= 260; i++) {
    const t = i / 260, p = trailPoint(t);
    discs.push({ x: p.x, y: p.y, r: 36 + valueNoise(i / 5, 3, 41) * 12 });
  }
  const start = trailPoint(0);
  discs.push({ x: start.x, y: start.y, r: 62 });
  for (let x = 24 * TILE + 16; x <= 49 * TILE + 16; x += 7) discs.push({ x, y: 25 * TILE + 16 + Math.sin(x / 90) * 5, r: 38 + valueNoise(x / 30, 5, 43) * 12 });
  return discs;
}

export interface TerrainTexture { texture: Phaser.Textures.CanvasTexture; scale: number; context: CanvasRenderingContext2D }

/** The whole ground (grass, sand, trail, river) painted once into a single texture. */
export function createTerrain(textures: Phaser.Textures.TextureManager, S: number): TerrainTexture {
  const W = Math.round(ISO_W * S), H = Math.round(ISO_H * S);
  if (textures.exists('paint-terrain')) textures.remove('paint-terrain');
  const texture = textures.createCanvas('paint-terrain', W, H)!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const ctx = texture.getContext();
  paintGrass(ctx, ISO_W, ISO_H, S, 9021);

  const world = (c: Ctx, k: number) => c.setTransform(0.5 * k, 0.25 * k, -0.5 * k, 0.25 * k, (WORLD_HEIGHT * 0.5) * k, 0);
  const layer = makeCanvas(W, H), lctx = layer.getContext('2d')!;
  const mask = makeCanvas(W / 2, H / 2), mctx = mask.getContext('2d')!;
  const mk = S / 2;

  const makeMask = (draw: (c: Ctx) => void) => { mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mask.width, mask.height); draw(mctx); mctx.setTransform(1, 0, 0, 1, 0, 0); };
  const composite = (paint: (c: Ctx) => void) => {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    paint(lctx);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.imageSmoothingEnabled = true;
    lctx.drawImage(mask, 0, 0, W, H);
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
  };
  const polyPath = (c: Ctx, pts: Array<[number, number]>) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const rng = seededRandom(7771);

  // ---- sand beach: a soft, wide band around the river
  makeMask((c) => { world(c, mk); softFill(c, '#000', 9, () => { polyPath(c, riverPolygon(30, 5)); c.fill(); }); });
  composite((c) => {
    c.setTransform(S, 0, 0, S, 0, 0);
    const g = c.createLinearGradient(0, 0, ISO_W, ISO_H);
    g.addColorStop(0, '#e6c986'); g.addColorStop(1, '#d4b172');
    c.fillStyle = g; c.fillRect(0, 0, ISO_W, ISO_H);
    for (let i = 0; i < 2600; i++) blob(c, rng() * ISO_W, rng() * ISO_H, 1 + rng() * 2.2, 0.7 + rng() * 1.2, rng() * 3, rng() < 0.5 ? '#f6e3b0' : '#b99660', 0.55);
  });
  // Damp sand right at the waterline.
  makeMask((c) => { world(c, mk); softFill(c, '#000', 7, () => { polyPath(c, riverPolygon(10, 3)); c.fill(); }); });
  composite((c) => { c.setTransform(S, 0, 0, S, 0, 0); c.fillStyle = 'rgba(150,112,64,0.55)'; c.fillRect(0, 0, ISO_W, ISO_H); });

  // ---- trail edge: a darker rim just outside the dirt, like the contour around the hero and the trees
  makeMask((c) => { world(c, mk); softFill(c, '#000', 3, () => { for (const d of pathDiscs()) { c.beginPath(); c.arc(d.x, d.y, d.r + 3.2, 0, TAU); c.fill(); } }); });
  composite((c) => { c.setTransform(S, 0, 0, S, 0, 0); c.fillStyle = 'rgba(78,52,28,0.5)'; c.fillRect(0, 0, ISO_W, ISO_H); });

  // ---- dirt trail and the east road
  makeMask((c) => { world(c, mk); softFill(c, '#000', 5, () => { for (const d of pathDiscs()) { c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill(); } }); });
  composite((c) => {
    c.setTransform(S, 0, 0, S, 0, 0);
    const g = c.createLinearGradient(0, 0, ISO_W, ISO_H);
    g.addColorStop(0, '#d2a86a'); g.addColorStop(1, '#bb8f56');
    c.fillStyle = g; c.fillRect(0, 0, ISO_W, ISO_H);
    // Worn lighter centre line.
    c.save(); world(c, S);
    for (const d of pathDiscs()) { c.globalAlpha = 0.07; c.fillStyle = '#f0d3a0'; c.beginPath(); c.arc(d.x, d.y, d.r * 0.55, 0, TAU); c.fill(); }
    c.restore();
    c.setTransform(S, 0, 0, S, 0, 0);
    for (let i = 0; i < 3800; i++) blob(c, rng() * ISO_W, rng() * ISO_H, 1 + rng() * 2.6, 0.7 + rng() * 1.3, rng() * 3, rng() < 0.5 ? '#ecd09a' : '#8f6a3c', 0.6);
  });

  // ---- river
  makeMask((c) => { world(c, mk); softFill(c, '#000', 2.4, () => { polyPath(c, riverPolygon(0, 3)); c.fill(); }); });
  composite((c) => {
    c.setTransform(S, 0, 0, S, 0, 0);
    c.fillStyle = '#69c3e8'; c.fillRect(0, 0, ISO_W, ISO_H);
    const bands: Array<[number, string, number]> = [[-6, '#4fa7e3', 5], [-20, '#3b8ed8', 8], [-46, '#2f78c6', 14]];
    c.save(); world(c, S);
    for (const [inset, color, blur] of bands) { c.save(); softFill(c, color, blur * S, () => { polyPath(c, riverPolygon(inset, 0)); c.fill(); }); c.restore(); }
    c.restore();
    c.setTransform(S, 0, 0, S, 0, 0);
    // Flow streaks following the river's centre line.
    for (let i = 0; i < 380; i++) {
      const y0 = -300 + rng() * 1900, u = (rng() * 2 - 1) * 0.8, len = 40 + rng() * 120;
      c.strokeStyle = rng() < 0.7 ? 'rgba(206,236,255,0.32)' : 'rgba(18,64,130,0.22)';
      c.lineWidth = 0.8 + rng() * 1.8;
      c.beginPath();
      for (let s = 0; s <= 6; s++) { const y = y0 + (len * s) / 6; const p = toScreen(riverCenterX(y) + u * riverHalf(y), y); s ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
      c.stroke();
    }
    for (let i = 0; i < 160; i++) {
      const y = -300 + rng() * 1900, p = toScreen(riverCenterX(y) + (rng() * 2 - 1) * 0.7 * riverHalf(y), y);
      blob(c, p.x, p.y, 4 + rng() * 6, 1.4 + rng() * 1.6, -0.45, '#e6f6ff', 0.2);
    }
  });

  // ---- foam where water meets the bank
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.lineJoin = 'round';
  for (const side of [0, 1]) {
    const poly = riverPolygon(0, 3);
    const half = poly.length / 2;
    const edge = side === 0 ? poly.slice(0, half) : poly.slice(half);
    ctx.strokeStyle = 'rgba(18,44,66,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    edge.forEach(([x, y], i) => { const p = toScreen(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.stroke();
  }
  for (const side of [0, 1]) {
    const poly = riverPolygon(0, 3);
    const half = poly.length / 2;
    const edge = side === 0 ? poly.slice(0, half) : poly.slice(half);
    for (const [width, alpha] of [[5, 0.16], [2.4, 0.5]] as const) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = width;
      ctx.beginPath();
      edge.forEach(([x, y], i) => { const p = toScreen(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
  }

  // ---- large soft light and shade patches break up the pattern further
  const blobs = seededRandom(404);
  for (let i = 0; i < 70; i++) {
    const x = blobs() * ISO_W, y = blobs() * ISO_H, size = 90 + blobs() * 200, light = i % 3 !== 0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    g.addColorStop(0, light ? 'rgba(236,246,150,0.13)' : 'rgba(18,70,60,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.5); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.fillRect(x - size / 2, y - size / 2, size, size); ctx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  texture.refresh();
  return { texture, scale: S, context: ctx };
}

/** Soft ground shadow baked straight into the terrain texture. Coordinates are world pixels. */
export function bakeShadow(terrain: TerrainTexture, x: number, y: number, width: number, height: number, alpha: number) {
  const { context: ctx, scale: S } = terrain;
  const p = toScreen(x, y);
  ctx.save();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.translate(p.x, p.y);
  ctx.scale(1, height / width);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2);
  g.addColorStop(0, `rgba(12,44,38,${alpha})`); g.addColorStop(0.6, `rgba(12,44,38,${alpha * 0.55})`); g.addColorStop(1, 'rgba(12,44,38,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, width / 2, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Standalone painted meadow for the title screen. */
export function createMeadow(textures: Phaser.Textures.TextureManager, key: string, width: number, height: number, S: number) {
  if (textures.exists(key)) textures.remove(key);
  const texture = textures.createCanvas(key, Math.round(width * S), Math.round(height * S))!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  paintGrass(texture.getContext(), width, height, S, 1234);
  texture.refresh();
}
