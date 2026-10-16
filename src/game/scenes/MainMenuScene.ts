import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#92ad41');
    const ground = this.add.renderTexture(0, 0, GAME_WIDTH, 600).setOrigin(0).setDepth(-6);
    const floor = Array.from({ length: 71 * 71 }, (_, index) => {
      const column = index % 71 - 35, row = Math.floor(index / 71) - 35;
      return { column, row, depth: column + row };
    }).sort((a, b) => a.depth - b.depth);
    for (const { column, row } of floor) {
      const x = GAME_WIDTH / 2 + (column - row) * 16;
      const y = 295 + (column + row) * 8;
      ground.drawFrame('iso-ground-tops', 'grass-10', x - 16, y - 8);
    }

    // Match the menu to the angled forest scene with the same local artwork.
    for (const [x, y, scale, type] of [[38, 450, 1.65, 1], [158, 530, 1.3, 3], [822, 448, 1.7, 2], [940, 522, 1.35, 1], [76, 148, 1.05, 3], [899, 180, 1.1, 2]] as const) {
      this.add.image(x, y, `iso-forest-tree-${type}`).setOrigin(0.5, 0.92).setScale(scale).setDepth(y);
    }
    const leafScatter = [[104, 435], [190, 486], [780, 512], [900, 414], [54, 252], [911, 262], [166, 122], [782, 146]];
    leafScatter.forEach(([x, y], index) => this.add.image(x, y, 'iso-forest-leaves', index * 2).setOrigin(0.5, 0.85).setScale(1.25).setDepth(y - 1));

    const frame = this.add.graphics().setDepth(10);
    frame.fillStyle(0x0d302b, 0.46).fillRoundedRect(191, 75, 578, 433, 30);
    frame.fillStyle(0x164536, 0.92).fillRoundedRect(184, 66, 578, 433, 30);
    frame.lineStyle(3, 0xa6d389, 0.9).strokeRoundedRect(184, 66, 578, 433, 30);
    frame.lineStyle(1, 0xf0d995, 0.72).strokeRoundedRect(194, 76, 558, 413, 24);
    frame.fillStyle(0x6db568, 0.24).fillEllipse(GAME_WIDTH / 2, 154, 300, 124);

    this.add.text(GAME_WIDTH / 2, 142, 'MINDAQUEST', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '58px', fontStyle: 'bold', color: '#fff1be',
      stroke: '#315c42', strokeThickness: 8, shadow: { color: '#0d302b', blur: 12, fill: true, offsetY: 4 }, letterSpacing: 2,
    }).setOrigin(0.5).setDepth(11);
    this.add.text(GAME_WIDTH / 2, 204, 'A little hero. A big world of wonder.', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '21px', color: '#e1f2d1',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(GAME_WIDTH / 2, 257, '✦   WELCOME TO THE EMERALD WILDS   ✦', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '13px', fontStyle: 'bold', color: '#c5e6a3', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(11);

    const buttonGlow = this.add.graphics().setDepth(11);
    buttonGlow.fillStyle(0xd69b44, 0.23).fillRoundedRect(322, 307, 316, 72, 24);
    const button = this.add.container(GAME_WIDTH / 2, 339).setDepth(12);
    const plate = this.add.rectangle(0, 0, 280, 56, 0xf0c969, 1).setStrokeStyle(2, 0xffe9a5, 1).setInteractive({ useHandCursor: true });
    button.add(plate);
    button.add(this.add.text(0, -1, 'BEGIN ADVENTURE', { fontFamily: 'Trebuchet MS, Arial', fontSize: '20px', fontStyle: 'bold', color: '#284f3b', letterSpacing: 0.8 }).setOrigin(0.5));
    plate.on('pointerover', () => plate.setFillStyle(0xffd985));
    plate.on('pointerout', () => plate.setFillStyle(0xf0c969));
    plate.on('pointerdown', () => this.scene.start('WorldScene'));

    this.add.text(GAME_WIDTH / 2, 419, 'WASD  /  ARROW KEYS  ·  ESC TO PAUSE', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '13px', fontStyle: 'bold', color: '#c4e3c0', letterSpacing: 0.5,
    }).setOrigin(0.5).setDepth(11);
    this.add.text(GAME_WIDTH / 2, 461, 'A bright forest adventure for curious young explorers', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '13px', color: '#a6ccb1',
    }).setOrigin(0.5).setDepth(11);
    this.add.image(GAME_WIDTH / 2, 547, 'mixel-shadow').setScale(1.6).setDepth(11.8);
    this.add.image(GAME_WIDTH / 2, 535, 'hero-idle-front', 0).setScale(1.5).setDepth(12);
  }
}
