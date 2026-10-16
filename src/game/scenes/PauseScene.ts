import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x09241d, 0.68);
    const panel = this.add.graphics();
    panel.fillStyle(0x061f19, 0.38).fillRoundedRect(304, 137, 368, 352, 26);
    panel.fillStyle(0x174b39, 0.98).fillRoundedRect(296, 128, 368, 352, 26);
    panel.lineStyle(3, 0xc0dda0, 0.9).strokeRoundedRect(296, 128, 368, 352, 26);
    panel.lineStyle(1, 0xf1d58b, 0.72).strokeRoundedRect(306, 138, 348, 332, 20);
    this.add.circle(GAME_WIDTH / 2, 182, 22, 0x2d704c).setStrokeStyle(2, 0xe9d28f, 0.9);
    this.add.text(GAME_WIDTH / 2, 181, 'Ⅱ', { fontFamily: 'Arial', fontSize: '19px', fontStyle: 'bold', color: '#fff2c8' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 225, 'TAKE A BREATHER', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '27px', fontStyle: 'bold', color: '#fff0bf', letterSpacing: 1,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 258, 'The forest will be right here when you return.', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '13px', color: '#c5dfc0',
    }).setOrigin(0.5);
    this.button(314, 'RESUME EXPLORING', 0xf1c969, () => { this.scene.stop(); this.scene.resume('WorldScene'); });
    this.button(379, 'RESTART ADVENTURE', 0xc5e4b0, () => { this.scene.stop('WorldScene'); this.scene.stop(); this.scene.start('WorldScene'); });
    this.button(444, 'RETURN TO THE GROVE', 0xd9e8c8, () => { this.scene.stop('WorldScene'); this.scene.stop(); this.scene.start('MainMenuScene'); });
  }

  private button(y: number, label: string, color: number, action: () => void) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, y, 276, 48, color).setStrokeStyle(2, 0xfff0c3, 0.8).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, y, label, { fontFamily: 'Trebuchet MS, Arial', fontSize: '15px', fontStyle: 'bold', color: '#244d39', letterSpacing: 0.5 }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setAlpha(0.82));
    bg.on('pointerout', () => bg.setAlpha(1));
    bg.on('pointerdown', action);
  }
}
