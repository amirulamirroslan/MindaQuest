import Phaser from 'phaser';
import type { Direction } from '../systems/movement';

type Facing = 'front' | 'back' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: Facing = 'front';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero-idle-front', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(1.35);
    this.setCollideWorldBounds(true);
    this.setDepth(y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(13, 10);
    body.setOffset(9.5, 21);

    for (const facing of ['front', 'back', 'left', 'right'] as const) {
      const idle = `hero-idle-${facing}`;
      const walk = `hero-walk-${facing}`;
      if (!scene.anims.exists(idle)) {
        scene.anims.create({ key: idle, frames: scene.anims.generateFrameNumbers(idle, { start: 0, end: 8 }), frameRate: 5, repeat: -1 });
      }
      if (!scene.anims.exists(walk)) {
        scene.anims.create({ key: walk, frames: scene.anims.generateFrameNumbers(walk, { start: 0, end: 3 }), frameRate: 9, repeat: -1 });
      }
    }
    this.play('hero-idle-front');
  }

  setMovement(direction: Direction) {
    if (direction.x === 0 && direction.y === 0) {
      this.play(`hero-idle-${this.facing}`, true);
      return;
    }

    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      this.facing = direction.x < 0 ? 'left' : 'right';
    } else {
      this.facing = direction.y < 0 ? 'back' : 'front';
    }
    this.play(`hero-walk-${this.facing}`, true);
  }
}
