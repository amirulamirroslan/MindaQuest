import type Phaser from 'phaser';
import { makeObject } from './painter';

/**
 * Textures for the living-world extras (leaves, birds, butterflies, fish, dust, sparkles, glows). Like the rest of the
 * art they are drawn with the Canvas 2D API at boot: no image files, no third-party art. Light, neutral shapes (leaf,
 * butterfly, dust, spark, glow) are meant to be tinted per use.
 */
/** Colours baked into the textures (the Canvas fallback renderer ignores tints, so tinting at draw time would show white). */
export const LEAF_COLORS = ['#8fcf5a', '#e8c85a', '#e0924a', '#a6d86a', '#f2a0b8', '#d9b04a'] as const;
export const BUTTERFLY_COLORS = ['#ffa34a', '#6fb4ff', '#ffe36a', '#ff8fc0', '#b48cff', '#ffffff'] as const;
export const leafKey = (i: number) => `paint-leaf-${i % LEAF_COLORS.length}`;
export const butterflyKey = (i: number) => `paint-butterfly-${i % BUTTERFLY_COLORS.length}`;
export const dustKey = (kind: 'grass' | 'dirt' | 'wood') => `paint-dust-${kind}`;

export const FX = {
  leaf: 'paint-leaf',
  birdUp: 'paint-bird-up',
  birdDown: 'paint-bird-down',
  butterfly: 'paint-butterfly',
  fish: 'paint-fish',
  dust: 'paint-dust',
  spark: 'paint-spark',
  glow: 'paint-glow',
  drop: 'paint-drop',
} as const;

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: Array<[number, string]>) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function leaf(ctx: Ctx) {
  // An almond leaf with a darker centre vein; tinted green, gold, orange or rose in use.
  const body = ctx.createLinearGradient(0, 3.5, 12, 3.5);
  body.addColorStop(0, '#d9dcc2'); body.addColorStop(0.5, '#fbfbee'); body.addColorStop(1, '#cfd3b6');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0.5, 3.5); ctx.quadraticCurveTo(5, -0.6, 11.5, 3.5); ctx.quadraticCurveTo(5, 7.6, 0.5, 3.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,84,50,0.75)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0.5, 3.5); ctx.quadraticCurveTo(6, 3.2, 11, 3.5); ctx.stroke();
}

/** A gull-shaped silhouette seen from the side, wings raised (`up`) or lowered. */
function bird(ctx: Ctx, up: boolean) {
  const tip = up ? 1.2 : 11.5, curl = up ? 4.4 : 9.4;
  const wing = (dir: 1 | -1) => {
    const x0 = 14 + dir * 1.2, tipX = 14 + dir * 11.6;
    const g = ctx.createLinearGradient(x0, 7, tipX, tip);
    g.addColorStop(0, '#3d4f78'); g.addColorStop(1, '#232f4f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 7.4);
    ctx.quadraticCurveTo(14 + dir * 6, curl, tipX, tip);
    ctx.quadraticCurveTo(14 + dir * 7.4, up ? 7.2 : 8.6, x0, 9.6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(190,210,255,0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
  };
  wing(-1); wing(1);
  ctx.fillStyle = '#2b3a5e';
  ctx.beginPath(); ctx.ellipse(14, 8.6, 3.6, 2.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath(); ctx.ellipse(14.6, 9.2, 2.3, 1.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b3a5e';
  ctx.beginPath(); ctx.arc(17.3, 7.9, 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffb04a';
  ctx.beginPath(); ctx.moveTo(18.5, 7.7); ctx.lineTo(20.4, 8.2); ctx.lineTo(18.5, 8.7); ctx.fill();
  ctx.fillStyle = '#232f4f';
  ctx.beginPath(); ctx.moveTo(10.6, 8.4); ctx.lineTo(7.4, 7.4); ctx.lineTo(7.6, 9.7); ctx.closePath(); ctx.fill();
}

function butterfly(ctx: Ctx) {
  // Pale wings with dark edges so a colour tint turns them orange, blue, yellow or pink while keeping the markings.
  const wings: Array<[number, number, number, number, number]> = [[-1, -1, 4.2, 3, -0.5], [1, -1, 4.2, 3, 0.5], [-1, 1, 3, 2.4, 0.5], [1, 1, 3, 2.4, -0.5]];
  for (const [sx, sy, rx, ry, rot] of wings) {
    const cx = 8 + sx * 3.4, cy = 6.5 + sy * 2.1;
    ctx.fillStyle = radial(ctx, cx, cy, rx + 1, [[0, '#ffffff'], [0.65, '#f0f0f0'], [1, '#bdbdbd']]);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot * sx, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,50,90,0.8)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = 'rgba(80,60,100,0.55)';
    ctx.beginPath(); ctx.arc(cx + sx * 1, cy + sy * 0.5, 0.8, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#3a2d4a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(8, 3.4); ctx.lineTo(8, 9.6); ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(8, 3.6); ctx.lineTo(6.6, 1.8); ctx.moveTo(8, 3.6); ctx.lineTo(9.4, 1.8); ctx.stroke();
}

function fish(ctx: Ctx) {
  ctx.fillStyle = '#ff9a4a';
  ctx.beginPath(); ctx.moveTo(4.4, 4.2); ctx.lineTo(0.4, 0.8); ctx.quadraticCurveTo(1.8, 4.2, 0.4, 7.6); ctx.closePath(); ctx.fill();
  const body = ctx.createLinearGradient(0, 1.2, 0, 7.2);
  body.addColorStop(0, '#5f93bf'); body.addColorStop(0.45, '#bddcf0'); body.addColorStop(1, '#f6fcff');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(9, 4.2, 5.6, 2.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e9843c';
  ctx.beginPath(); ctx.moveTo(7.4, 1.7); ctx.quadraticCurveTo(9.4, -0.3, 11, 1.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(8.6, 3, 3.2, 0.7, -0.05, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16314a';
  ctx.beginPath(); ctx.arc(12.4, 3.7, 0.75, 0, TAU); ctx.fill();
}

function dust(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 8, 8, 8, [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, 0, 16, 16);
}

function spark(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 8, 8, 8, [[0, 'rgba(255,255,255,0.7)'], [0.35, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(8, 0.5); ctx.quadraticCurveTo(8.7, 7.3, 15.5, 8); ctx.quadraticCurveTo(8.7, 8.7, 8, 15.5); ctx.quadraticCurveTo(7.3, 8.7, 0.5, 8); ctx.quadraticCurveTo(7.3, 7.3, 8, 0.5); ctx.fill();
}

function glow(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 16, 16, 16, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, 0, 32, 32);
}

function drop(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 2.6, 2.4, 3, [[0, '#ffffff'], [0.6, '#cfeaff'], [1, '#8cc4ec']]);
  ctx.beginPath(); ctx.arc(3, 3, 2.6, 0, TAU); ctx.fill();
}

/** Draws a neutral shape, multiplies a colour into it and keeps the original silhouette. */
function colored(draw: (ctx: Ctx) => void, color: string, w: number, h: number) {
  return (ctx: Ctx) => {
    draw(ctx);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
  };
}

export function createEffectTextures(textures: Phaser.Textures.TextureManager) {
  LEAF_COLORS.forEach((color, i) => makeObject(textures, leafKey(i), 12, 7, colored(leaf, color, 12, 7)));
  BUTTERFLY_COLORS.forEach((color, i) => makeObject(textures, butterflyKey(i), 16, 12, colored(butterfly, color, 16, 12)));
  for (const [kind, color] of [['grass', '#d8efb2'], ['dirt', '#dcc197'], ['wood', '#e8d3a8']] as const) makeObject(textures, dustKey(kind), 16, 16, colored(dust, color, 16, 16));
  makeObject(textures, 'paint-spark-gold', 16, 16, colored(spark, '#ffe88f', 16, 16));
  makeObject(textures, 'paint-glow-firefly', 32, 32, colored(glow, '#e6ff9a', 32, 32));
  makeObject(textures, 'paint-glow-warm', 32, 32, colored(glow, '#ffd36b', 32, 32));
  makeObject(textures, FX.leaf, 12, 7, leaf);
  makeObject(textures, FX.birdUp, 28, 14, (ctx) => bird(ctx, true));
  makeObject(textures, FX.birdDown, 28, 14, (ctx) => bird(ctx, false));
  makeObject(textures, FX.butterfly, 16, 12, butterfly);
  makeObject(textures, FX.fish, 16, 8, fish);
  makeObject(textures, FX.dust, 16, 16, dust);
  makeObject(textures, FX.spark, 16, 16, spark);
  makeObject(textures, FX.glow, 32, 32, glow);
  makeObject(textures, FX.drop, 6, 6, drop);
}
