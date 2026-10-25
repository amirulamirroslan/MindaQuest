import Phaser from 'phaser';
import { allFrameNames, HERO_FRAME, type HeroLod } from '../systems/heroFacing';
import { loadOutfit } from '../systems/outfitStore';
import { buildPartMask } from './partMask';
import { isDefaultOutfit, recolourParts, type Outfit, type Region } from './parts';
import { recolourOchreToTeal } from './recolour';

/**
 * Texture set for the Top-Down Adventurer hero (Antahonist, see ASSET-LICENSES.md).
 * - `adv-src`: the pack's own atlas, 204 px frames, loaded unchanged from public/assets/adventurer. Never drawn.
 * - `adv-hi`: a canvas copy of it with the player's outfit applied (each part re-tinted on its own, see `parts.ts`).
 *   This is what the game draws. Its frames keep the pack's names, so everything that used the atlas still works.
 * - `adv-lo`: the same frames halved with smooth resampling, used when the hero is drawn at half size or less
 *   on the device. Drawing a 204 px frame at ~0.4x with plain bilinear filtering shimmers while walking.
 * - `lina-idle`: one frame (idle_west) recoloured at boot (ochre -> teal) for the trail keeper. Not part of the outfit.
 */
export const SOURCE_KEY = 'adv-src';
export const HERO_ATLAS_KEY = (lod: HeroLod) => `adv-${lod}`;
export const LINA_KEY = 'lina-idle';
export const LINA_LO_KEY = 'lina-idle-lo';
const LINA_FRAME = 'idle_west';

interface HeroState {
  /** The pack's pixels, untouched, as the starting point of every recolour. */
  source: ImageData;
  /** One part id per atlas pixel (see `partMask.ts`). */
  mask: Uint8Array;
  frames: Map<string, Region>;
  hiCanvas: HTMLCanvasElement;
  hiTexture: Phaser.Textures.CanvasTexture;
  loCanvas: HTMLCanvasElement;
  loTexture: Phaser.Textures.CanvasTexture;
}
let state: HeroState | undefined;

function addFrames(texture: Phaser.Textures.Texture, frames: Map<string, Region>, scale: number) {
  for (const [name, f] of frames) texture.add(name, 0, Math.round(f.x * scale), Math.round(f.y * scale), Math.round(f.w * scale), Math.round(f.h * scale));
}

function replaceCanvasTexture(textures: Phaser.Textures.TextureManager, key: string, width: number, height: number) {
  if (textures.exists(key)) textures.remove(key);
  const texture = textures.createCanvas(key, width, height)!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return texture;
}

export function createHeroTextures(scene: Phaser.Scene) {
  const textures = scene.textures;
  const sourceTexture = textures.get(SOURCE_KEY);
  const image = sourceTexture.getSourceImage() as HTMLImageElement;
  const width = image.width, height = image.height;

  const frames = new Map<string, Region>();
  for (const name of allFrameNames()) {
    const f = sourceTexture.get(name);
    frames.set(name, { x: f.cutX, y: f.cutY, w: f.width, h: f.height });
  }

  const read = document.createElement('canvas');
  read.width = width; read.height = height;
  const rctx = read.getContext('2d', { willReadFrequently: true })!;
  rctx.drawImage(image, 0, 0);
  const source = rctx.getImageData(0, 0, width, height);
  const mask = buildPartMask(source.data, width, [...frames.values()]);

  const hiTexture = replaceCanvasTexture(textures, HERO_ATLAS_KEY('hi'), width, height);
  addFrames(hiTexture, frames, 1);
  const loTexture = replaceCanvasTexture(textures, HERO_ATLAS_KEY('lo'), Math.ceil(width / 2), Math.ceil(height / 2));
  addFrames(loTexture, frames, 0.5);
  state = { source, mask, frames, hiCanvas: hiTexture.getCanvas(), hiTexture, loCanvas: loTexture.getCanvas(), loTexture };

  createLinaTextures(scene, image, sourceTexture);
  applyOutfit(loadOutfit());
}

/**
 * Draws the hero atlas with `outfit` applied. With `frameNames` only those frames are redone (the wardrobe previews
 * a handful of frames per tap); without it every frame is. The rest of the canvas keeps what it had.
 */
export function applyOutfit(outfit: Outfit, frameNames?: readonly string[]) {
  if (!state) return;
  const { source, mask, frames, hiCanvas, hiTexture, loCanvas, loTexture } = state;
  const regions = frameNames ? frameNames.map((n) => frames.get(n)).filter((r): r is Region => !!r) : [{ x: 0, y: 0, w: source.width, h: source.height }];
  const hiContext = hiCanvas.getContext('2d')!;
  const loContext = loCanvas.getContext('2d')!;
  loContext.imageSmoothingEnabled = true; loContext.imageSmoothingQuality = 'high';
  const identity = isDefaultOutfit(outfit);
  for (const r of regions) {
    // Start from the pack's pixels, recolour that rectangle, and put it on the canvas.
    const patch = hiContext.createImageData(r.w, r.h);
    for (let y = 0; y < r.h; y++) {
      const from = ((r.y + y) * source.width + r.x) * 4;
      patch.data.set(source.data.subarray(from, from + r.w * 4), y * r.w * 4);
    }
    if (!identity) recolourPatch(patch.data, mask, source.width, r, outfit);
    hiContext.putImageData(patch, r.x, r.y);
    loContext.clearRect(Math.floor(r.x / 2), Math.floor(r.y / 2), Math.ceil(r.w / 2), Math.ceil(r.h / 2));
    loContext.drawImage(hiCanvas, r.x, r.y, r.w, r.h, r.x / 2, r.y / 2, r.w / 2, r.h / 2);
  }
  hiTexture.refresh();
  loTexture.refresh();
}

/** `recolourParts` works on the whole atlas, so a frame-sized patch is recoloured through a view of its mask. */
function recolourPatch(patch: Uint8ClampedArray, mask: Uint8Array, atlasWidth: number, r: Region, outfit: Outfit) {
  const local = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) local.set(mask.subarray((r.y + y) * atlasWidth + r.x, (r.y + y) * atlasWidth + r.x + r.w), y * r.w);
  recolourParts(patch, local, r.w, outfit);
}

function createLinaTextures(scene: Phaser.Scene, image: HTMLImageElement, sourceTexture: Phaser.Textures.Texture) {
  const textures = scene.textures;
  const f = sourceTexture.get(LINA_FRAME);
  const lina = document.createElement('canvas');
  lina.width = HERO_FRAME; lina.height = HERO_FRAME;
  const nctx = lina.getContext('2d', { willReadFrequently: true })!;
  nctx.drawImage(image, f.cutX, f.cutY, f.width, f.height, 0, 0, HERO_FRAME, HERO_FRAME);
  const pixels = nctx.getImageData(0, 0, HERO_FRAME, HERO_FRAME);
  recolourOchreToTeal(pixels.data);
  nctx.putImageData(pixels, 0, 0);
  if (textures.exists(LINA_KEY)) textures.remove(LINA_KEY);
  textures.addCanvas(LINA_KEY, lina)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const linaLo = document.createElement('canvas');
  linaLo.width = HERO_FRAME / 2; linaLo.height = HERO_FRAME / 2;
  const llctx = linaLo.getContext('2d')!;
  llctx.imageSmoothingEnabled = true; llctx.imageSmoothingQuality = 'high';
  llctx.drawImage(lina, 0, 0, linaLo.width, linaLo.height);
  if (textures.exists(LINA_LO_KEY)) textures.remove(LINA_LO_KEY);
  textures.addCanvas(LINA_LO_KEY, linaLo)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
