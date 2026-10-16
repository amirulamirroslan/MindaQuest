import Phaser from 'phaser';

const ASSET_ROOT = '/assets/mixel/';
const ISO_ROOT = '/assets/iso-forest/';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.load.tilemapTiledJSON('emerald-wilds', '/assets/maps/emerald-wilds.json');

    // These are the original, unmodified PNGs from Mixel's matching 32 px set.
    this.load.image('mixel-logs', `${ASSET_ROOT}Topdown RPG 32x32 - Tree Stumps and Logs 1.2.PNG`);
    this.load.image('mixel-shadow', `${ASSET_ROOT}MainC_Shadow.png`);

    // Kipperfalcon's CC0 forest pack provides actual isometric terrain and props.
    this.load.spritesheet('iso-forest-tiles', `${ISO_ROOT}Tileset_Atlas.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('iso-forest-rocks', `${ISO_ROOT}Rocks.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('iso-forest-leaves', `${ISO_ROOT}Leaves.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.image('iso-forest-tree-1', `${ISO_ROOT}Tree_1.png`);
    this.load.image('iso-forest-tree-2', `${ISO_ROOT}Tree_2.png`);
    this.load.image('iso-forest-tree-3', `${ISO_ROOT}Tree_3.png`);

    for (const direction of ['Front', 'Back', 'Left', 'Right']) {
      const key = direction.toLowerCase();
      this.load.spritesheet(`hero-idle-${key}`, `${ASSET_ROOT}MainC_Idle_${direction}.PNG`, { frameWidth: 32, frameHeight: 33 });
      this.load.spritesheet(`hero-walk-${key}`, `${ASSET_ROOT}MainC_Walk_${direction}.PNG`, { frameWidth: 32, frameHeight: 33 });
    }
  }

  create() {
    this.createIsometricTopFaces();
    this.scene.start('MainMenuScene');
  }

  private createIsometricTopFaces() {
    // The source atlas tiles are raised blocks. Extract their original top
    // faces so the map can use the hand-authored pixels as a continuous flat
    // meadow instead of repeating the block sides across every ground cell.
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
      texture.add(`${tile < 20 ? 'grass' : 'dirt'}-${tile % 20}`, 0, sourceX, targetY, 32, 16);
    }
    texture.refresh();
  }
}
