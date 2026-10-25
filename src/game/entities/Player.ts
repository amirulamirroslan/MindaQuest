import Phaser from 'phaser';
import type { Direction } from '../systems/movement';
import { advanceWalkPhase, facingFor, idleFrameName, walkFrameName, type Facing8 } from '../systems/heroFacing';

/**
 * The hero's physics body. This sprite is invisible: it owns position, collision and the 8-way facing /
 * walk-cycle state, and WorldScene draws the Adventurer atlas frame returned by `frameName` at the projected
 * position. The body keeps the exact size and offset it always had (a 32x33 frame at scale 1.35), so
 * collision with trees, river and bridge is unchanged.
 */
export const BODY_TEXTURE = 'hero-body';

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Facing8 = 'south';
  private phase = 0;
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, BODY_TEXTURE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(1.35);
    this.setCollideWorldBounds(true);
    this.setDepth(y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(13, 10);
    body.setOffset(9.5, 21);
  }

  /**
   * `screen` is the movement on screen (px/s, y down); `dtSeconds` the clamped frame time. The walk cycle
   * advances with the distance actually covered so the feet keep up with the ground at every speed.
   */
  setMovement(screen: Direction, dtSeconds = 0) {
    this.moving = screen.x !== 0 || screen.y !== 0;
    if (!this.moving) { this.phase = 0; return; }
    this.facing = facingFor(screen.x, screen.y, this.facing);
    this.phase = advanceWalkPhase(this.phase, Math.hypot(screen.x, screen.y) * dtSeconds);
  }

  get isMoving() { return this.moving; }

  /** Atlas frame to draw now. */
  get frameName(): string {
    return this.moving ? walkFrameName(this.facing, this.phase) : idleFrameName(this.facing);
  }
}
