import Phaser from 'phaser';
import { createPaintedObjects } from '../art/painter';
import { createHeroTextures, SOURCE_KEY } from '../art/hero';
import { BODY_TEXTURE } from '../entities/Player';
import { createEffectTextures } from '../art/effects';
import { BUSH_FLOWER_FRAMES, BUSH_FRAMES, LEAF_FRAMES, LOG_FRAMES, ROCK_FRAMES, type Rect } from '../data/frames';

const ASSET_ROOT = '/assets/mixel/';
const ISO_ROOT = '/assets/iso-forest/';

function registerFrames(textures: Phaser.Textures.TextureManager, key: string, frames: Record<string, Rect>) {
  const texture = textures.get(key);
  for (const [name, [x, y, w, h]] of Object.entries(frames)) if (!texture.has(name)) texture.add(name, 0, x, y, w, h);
}

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.load.tilemapTiledJSON('emerald-wilds', '/assets/maps/emerald-wilds.json');

    // Unmodified PNGs from Mixel's 32 px set. Only these files are used; see ASSET-LICENSES.md.
    this.load.image('mixel-logs', `${ASSET_ROOT}Topdown RPG 32x32 - Tree Stumps and Logs 1.2.PNG`);
    this.load.image('mixel-bushes', `${ASSET_ROOT}Topdown RPG 32x32 - Bushes 1.1.PNG`);

    // Kipperfalcon's CC0 isometric forest pack: terrain atlas, trees, rocks and plants.
    this.load.spritesheet('iso-forest-tiles', `${ISO_ROOT}Tileset_Atlas.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.image('iso-forest-rocks', `${ISO_ROOT}Rocks.png`);
    this.load.image('iso-forest-leaves', `${ISO_ROOT}Leaves.png`);
    this.load.image('iso-forest-tree-1', `${ISO_ROOT}Tree_1.png`);
    this.load.image('iso-forest-tree-2', `${ISO_ROOT}Tree_2.png`);
    this.load.image('iso-forest-tree-3', `${ISO_ROOT}Tree_3.png`);

    // Antahonist's Top-Down Adventurer: the pack's own atlas, unchanged (see ASSET-LICENSES.md).
    this.load.atlas(SOURCE_KEY, '/assets/adventurer/atlas_204.png', '/assets/adventurer/atlas_204.json');
  }

  create() {
    registerFrames(this.textures, 'mixel-logs', LOG_FRAMES);
    registerFrames(this.textures, 'mixel-bushes', BUSH_FRAMES);
    registerFrames(this.textures, 'mixel-bushes', BUSH_FLOWER_FRAMES);
    registerFrames(this.textures, 'iso-forest-rocks', ROCK_FRAMES);
    registerFrames(this.textures, 'iso-forest-leaves', LEAF_FRAMES);
    this.createIsometricTopFaces();
    createPaintedObjects(this.textures);
    createEffectTextures(this.textures);
    createHeroTextures(this);
    // The invisible physics sprite needs a 32x33 frame so its collision body keeps its size and offset.
    if (!this.textures.exists(BODY_TEXTURE)) this.textures.createCanvas(BODY_TEXTURE, 32, 33);
    this.scene.start('MainMenuScene');
  }

  private createIsometricTopFaces() {
    // The source atlas tiles are raised blocks. Extract their original top faces so the map can use the
    // hand-authored pixels as a continuous flat meadow instead of repeating the block sides.
    const source = this.textures.get('iso-forest-tiles').getSourceImage() as HTMLImageElement;
    const texture = this.textures.createCanvas('iso-ground-tops', 320, 48);
    if (!texture) throw new Error('Unable to create the isometric ground face atlas.');
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    for (let tile = 0; tile < 30; tile++) {
      const sourceX = (tile % 10) * 32;
      const sourceY = Math.floor(tile / 10) * 32;
      const targetY = Math.floor(tile / 10) * 16;
      context.drawImage(source, sourceX, sourceY, 32, 16, sourceX, targetY, 32, 16);
      removeTileSeams(context, sourceX, targetY);
      texture.add(`${tile < 20 ? 'grass' : 'dirt'}-${tile % 20}`, 0, sourceX, targetY, 32, 16);
    }
    texture.refresh();
  }
}

/**
 * The atlas draws a lighter outline around every diamond, which tiles into a visible lattice across the
 * meadow. Repaint those two outer pixel rings with pixels copied from just inside the tile so the original
 * grass texture continues across tile borders. (Kipperfalcon's pack is CC0, so derived art is allowed.)
 */
export function removeTileSeams(context: CanvasRenderingContext2D, originX: number, originY: number, width = 32, height = 16) {
  const image = context.getImageData(originX, originY, width, height);
  const { data } = image;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 0;
  const ring = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y) && !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) ring[y * width + x] = 1;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y) || ring[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ring[(y + dy) * width + x + dx] === 1) ring[y * width + x] = ring[y * width + x] || 2;
    }
  }
  // Fill the two outer rings with colours drawn pseudo-randomly from the tile's own interior, so the
  // grass texture carries across borders without streaks (and never samples transparent pixels).
  const interior: number[] = [];
  for (let i = 0; i < width * height; i++) if (data[i * 4 + 3] > 0 && !ring[i]) interior.push(i * 4);
  if (interior.length === 0) return;
  const source = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ring[y * width + x]) continue;
      const pick = interior[(Math.imul((x * 73856093) ^ (y * 19349663), 2654435761) >>> 0) % interior.length];
      const from = pick, to = (y * width + x) * 4;
      data[to] = source[from]; data[to + 1] = source[from + 1]; data[to + 2] = source[from + 2];
    }
  }
  context.putImageData(image, originX, originY);
}
