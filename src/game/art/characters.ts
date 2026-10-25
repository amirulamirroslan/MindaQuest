import Phaser from 'phaser';
import { OBJ } from './painter';

/**
 * Painted explorer sprites drawn in code: big-eyed heads, soft shading, a pack and boots, in four facings with
 * a 9-frame idle (breathing) and a 4-frame walk. Frame numbers match the original Mixel sheets, so the
 * physics sprite, animation timing and collision body keep working unchanged.
 */
export type Facing = 'front' | 'back' | 'left' | 'right';
export type Look = 'hero' | 'lina';

const FRAME_W = 32, FRAME_H = 33;
const TAU = Math.PI * 2;

interface Palette {
  skin: string; skinShade: string; hair: string; hairHi: string; top: string; topHi: string; topLo: string;
  trim: string; pants: string; boots: string; pack: string; scarf: string; hat?: string; hatBand?: string; braid?: boolean;
}

const LOOKS: Record<Look, Palette> = {
  hero: {
    skin: '#f6cfa3', skinShade: '#e0a679', hair: '#b4522b', hairHi: '#e08046', top: '#3f9d6a', topHi: '#6fcf8c', topLo: '#256d4d',
    trim: '#7a4a2a', pants: '#5d4a8a', boots: '#4a2f22', pack: '#b9773b', scarf: '#e5524a',
  },
  lina: {
    skin: '#e8b98f', skinShade: '#c98f66', hair: '#3a2a3a', hairHi: '#6a4d6a', top: '#2f8f8a', topHi: '#62c9bd', topLo: '#1b5e66',
    trim: '#e2bf6a', pants: '#8a6a45', boots: '#3f2a20', pack: '#8a5a3a', scarf: '#f2d36b', hat: '#4aa56a', hatBand: '#f2d36b', braid: true,
  },
};

type Ctx = CanvasRenderingContext2D;
const OUTLINE = 'rgba(38,22,24,0.55)';

function fillStroke(ctx: Ctx, fill: string | CanvasGradient) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.stroke();
}
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0, stroke = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (stroke) fillStroke(ctx, fill); else { ctx.fillStyle = fill; ctx.fill(); }
}
function round(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); fillStroke(ctx, fill);
}
function vgrad(ctx: Ctx, y0: number, y1: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}

function drawCharacter(ctx: Ctx, facing: Facing, moving: boolean, t: number, p: Palette) {
  const phase = t * TAU;
  const swing = moving ? Math.sin(phase) : 0;
  const bob = moving ? -Math.abs(Math.sin(phase)) * 1.1 : Math.sin(phase) * 0.35;
  const dir = facing === 'left' ? -1 : 1;
  const side = facing === 'left' || facing === 'right';
  const cx = 16;

  // ---- backpack behind the body (back and side views)
  if (facing === 'back') round(ctx, cx - 5.5, 15 + bob, 11, 9, 3, p.pack);
  if (side) round(ctx, cx - dir * 7.4 - 2.4, 15.5 + bob, 4.8, 8, 2, p.pack);

  // ---- braid / hair tail for Lina
  if (p.braid && (facing === 'back' || side)) {
    const tail = side ? cx - dir * 7 : cx;
    ellipse(ctx, tail, 17 + bob + swing * 0.6, 1.9, 5.4, p.hair, swing * -0.12);
  }

  // ---- legs
  const legTop = 22 + bob * 0.5;
  if (side) {
    const far = cx - swing * 1.8, near = cx + swing * 1.8;
    round(ctx, far - 2, legTop, 4, 5.2, 1.6, p.pants); round(ctx, far - 2.3, 26.3, 5, 3.7, 1.6, p.boots);
    round(ctx, near - 2, legTop, 4, 5.2, 1.6, p.pants); round(ctx, near - 2.3 + dir * 0.6, 26.3 - Math.max(0, -swing) * 1.2, 5, 3.7, 1.6, p.boots);
  } else {
    const liftL = Math.max(0, swing) * 1.6, liftR = Math.max(0, -swing) * 1.6;
    round(ctx, cx - 5.2, legTop - liftL * 0.3, 4.4, 5.2, 1.6, p.pants); round(ctx, cx - 5.6, 26.3 - liftL, 5.2, 3.7, 1.6, p.boots);
    round(ctx, cx + 0.8, legTop - liftR * 0.3, 4.4, 5.2, 1.6, p.pants); round(ctx, cx + 0.4, 26.3 - liftR, 5.2, 3.7, 1.6, p.boots);
  }

  // ---- far arm (behind the torso in side view)
  if (side) ellipse(ctx, cx - dir * 0.4 - swing * 1.4 * -1, 19.4 + bob, 1.9, 3.8, p.topLo, swing * 0.18);

  // ---- torso
  const torso = side ? { x: cx - 4.8, w: 9.6 } : { x: cx - 5.6, w: 11.2 };
  round(ctx, torso.x, 14 + bob, torso.w, 9.6, 3.2, vgrad(ctx, 14, 24, p.topHi, p.top));
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(torso.x + torso.w * 0.38, 16.6 + bob, torso.w * 0.28, 1.6, -0.2, 0, TAU); ctx.fill();
  round(ctx, torso.x + 0.2, 21.2 + bob, torso.w - 0.4, 1.7, 0.8, p.trim);
  ctx.fillStyle = '#f6d98a'; ctx.fillRect(cx - 0.8 + (side ? dir * 1.2 : 0), 21.4 + bob, 1.6, 1.3);
  if (facing === 'front') {
    ctx.strokeStyle = p.trim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - 3.8, 14.4 + bob); ctx.lineTo(cx - 3, 21 + bob); ctx.moveTo(cx + 3.8, 14.4 + bob); ctx.lineTo(cx + 3, 21 + bob); ctx.stroke();
  }
  // scarf
  ellipse(ctx, cx, 14.6 + bob, side ? 4.4 : 5.6, 1.9, p.scarf);

  // ---- near arm
  if (side) {
    ellipse(ctx, cx + swing * 1.5, 19.6 + bob, 2, 4, vgrad(ctx, 15, 24, p.topHi, p.top), -swing * 0.2);
    ellipse(ctx, cx + swing * 1.8, 23.2 + bob, 1.6, 1.6, p.skin);
  } else {
    ellipse(ctx, cx - 7.1, 19.2 + bob - swing * 0.9, 2, 4, vgrad(ctx, 15, 24, p.topHi, p.top), 0.1);
    ellipse(ctx, cx + 7.1, 19.2 + bob + swing * 0.9, 2, 4, vgrad(ctx, 15, 24, p.topHi, p.top), -0.1);
    ellipse(ctx, cx - 7.4, 23.2 + bob - swing * 0.9, 1.6, 1.6, p.skin);
    ellipse(ctx, cx + 7.4, 23.2 + bob + swing * 0.9, 1.6, 1.6, p.skin);
  }

  // ---- head
  const hy = 9.6 + bob;
  const skin = ctx.createRadialGradient(cx - 2, hy - 2, 1, cx, hy, 8);
  skin.addColorStop(0, p.skin); skin.addColorStop(1, p.skinShade);
  ellipse(ctx, cx, hy, 7.4, 7, p.hair); // hair mass / back of head
  if (facing !== 'back') {
    const fx = side ? cx + dir * 1.7 : cx;
    ellipse(ctx, fx, hy + 1.2, side ? 5.4 : 6.2, 5.5, skin);
    // bangs
    ctx.beginPath();
    ctx.ellipse(fx, hy - 3.6, side ? 6.4 : 7.2, 3.2, 0, Math.PI, TAU);
    ctx.quadraticCurveTo(fx + 1, hy - 1, fx - (side ? dir * -3 : 3), hy - 1.4);
    ctx.fillStyle = p.hair; ctx.fill();
    ctx.fillStyle = p.hairHi; ctx.beginPath(); ctx.ellipse(fx - 1.8, hy - 5, 3, 1, -0.3, 0, TAU); ctx.fill();
    // face
    const eye = (x: number) => { ellipse(ctx, x, hy + 1.3, 1.25, 1.65, '#2b1c1d', 0, false); ellipse(ctx, x - 0.4, hy + 0.7, 0.5, 0.5, '#ffffff', 0, false); };
    if (side) eye(fx + dir * 2.3);
    else { eye(fx - 2.7); eye(fx + 2.7); }
    ctx.fillStyle = 'rgba(255,110,120,0.35)';
    if (side) { ctx.beginPath(); ctx.arc(fx + dir * 0.8, hy + 3.4, 1.2, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(fx - 4, hy + 3.4, 1.3, 0, TAU); ctx.arc(fx + 4, hy + 3.4, 1.3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 0.6; ctx.beginPath();
    if (side) ctx.arc(fx + dir * 2.4, hy + 4.3, 0.9, 0.2, Math.PI - 0.2); else ctx.arc(fx, hy + 3.7, 1.2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.hairHi; ctx.beginPath(); ctx.ellipse(cx - 2, hy - 3.5, 3.4, 1.1, -0.3, 0, TAU); ctx.fill();
  }
  // ---- explorer hat (Lina)
  if (p.hat) {
    ellipse(ctx, cx, hy - 4.4, 9.4, 2.8, p.hat);
    round(ctx, cx - 5.2, hy - 9.4, 10.4, 6, 3, vgrad(ctx, hy - 10, hy - 3, p.hat, '#2f7f4a'));
    ctx.fillStyle = p.hatBand ?? '#fff'; ctx.fillRect(cx - 5, hy - 5.2, 10, 1.4);
  }
  // pack straps visible on the shoulders in front view
  if (facing === 'front') { ellipse(ctx, cx - 6.4, 15.4 + bob, 1.6, 1.1, p.pack, 0, false); ellipse(ctx, cx + 6.4, 15.4 + bob, 1.6, 1.1, p.pack, 0, false); }
}

function makeSheet(textures: Phaser.Textures.TextureManager, key: string, facing: Facing, look: Look, moving: boolean, count: number) {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * OBJ * count; canvas.height = FRAME_H * OBJ;
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(i * FRAME_W * OBJ, 0);
    ctx.scale(OBJ, OBJ);
    drawCharacter(ctx, facing, moving, i / count, LOOKS[look]);
    ctx.restore();
  }
  if (textures.exists(key)) textures.remove(key);
  const texture = textures.addCanvas(key, canvas)!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (let i = 0; i < count; i++) texture.add(i, 0, i * FRAME_W * OBJ, 0, FRAME_W * OBJ, FRAME_H * OBJ);
}

/** Texture key of the painted twin of an original hero texture ("hero-walk-left" -> "paint-hero-walk-left"). */
export const paintedKeyFor = (key: string) => `paint-${key}`;

export function createPaintedCharacters(scene: Phaser.Scene) {
  const facings: Facing[] = ['front', 'back', 'left', 'right'];
  for (const look of ['hero', 'lina'] as const) {
    for (const facing of facings) {
      const idle = `paint-${look}-idle-${facing}`, walk = `paint-${look}-walk-${facing}`;
      makeSheet(scene.textures, idle, facing, look, false, 9);
      makeSheet(scene.textures, walk, facing, look, true, 4);
      if (!scene.anims.exists(idle)) scene.anims.create({ key: idle, frames: scene.anims.generateFrameNumbers(idle, { start: 0, end: 8 }), frameRate: 5, repeat: -1 });
      if (!scene.anims.exists(walk)) scene.anims.create({ key: walk, frames: scene.anims.generateFrameNumbers(walk, { start: 0, end: 3 }), frameRate: 9, repeat: -1 });
    }
  }
}
