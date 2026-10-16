import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Player } from '../entities/Player';
import { normalizeDirection } from '../systems/movement';
import { projectIsometricPoint, screenDirectionToWorld } from '../systems/isometric';
import { canOccupyWorldPoint, hasReachedEastBank, isBridgeZone, isBlockedByRiver, isRiverCell, riverCenterX, WORLD_HEIGHT, WORLD_WIDTH } from '../systems/worldGeometry';
import { ForestQuest, TIMBER_GOAL } from '../systems/forestQuest';

const TILE = 32;
const BRIDGE_ROWS = [24, 25, 26];
const ISO_WIDTH = 1600;
const ISO_HEIGHT = 800;

/** Project the existing orthogonal gameplay grid into an isometric-like screen plane. */
function projectPoint(x: number, y: number) {
  return projectIsometricPoint(x, y, WORLD_HEIGHT * 0.5);
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private playerVisual!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touchDirection = { x: 0, y: 0 };
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private quest = new ForestQuest();
  private timberSprites = new Map<string, Phaser.GameObjects.Image>();
  private bridgePlanks: Phaser.GameObjects.Image[] = [];
  private bridgeBarrier?: Phaser.GameObjects.Rectangle;
  private bridgeBarrierCollider?: Phaser.Physics.Arcade.Collider;
  private promptText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private dialogueOpen = false;
  private dialoguePages: string[] = [];
  private dialoguePage = 0;
  private dialoguePanel?: Phaser.GameObjects.Graphics;
  private dialogueSpeaker?: Phaser.GameObjects.Text;
  private dialogueText?: Phaser.GameObjects.Text;
  private dialogueContinue?: Phaser.GameObjects.Text;
  private dialogueDim?: Phaser.GameObjects.Rectangle;
  private nearbyTarget: 'npc' | 'bridge' | string | null = null;
  private lastActionTime = Number.NEGATIVE_INFINITY;

  constructor() { super('WorldScene'); }

  create() {
    this.timberSprites.clear();
    this.bridgePlanks = [];
    this.dialogueOpen = false;
    const map = this.make.tilemap({ key: 'emerald-wilds' });
    const obstacles = this.physics.add.staticGroup();
    const paths = this.createTrailCells();

    this.createWorldTexture(paths);
    this.addBridge();
    this.player = new Player(this, 790, 700);
    this.player.setVisible(false);
    this.attachBridgeBlocker();
    this.playerVisual = this.add.sprite(790, 700, this.player.texture.key, this.player.frame.name).setScale(1.45);
    this.playerVisual.setData('isoProjected', true);
    this.playerShadow = this.add.image(790, 716, 'mixel-shadow').setScale(1.2).setDepth(720);
    this.addTrailKeeper();
    this.addForestObjects(map.getObjectLayer('Collision')?.objects ?? [], paths, obstacles);
    this.addForestDressing(paths, obstacles);
    this.addTimberCollectibles();

    this.physics.add.collider(this.player, obstacles);
    this.addRiverCollision();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.projectStaticWorldArt();
    this.cameras.main.setBounds(0, 0, ISO_WIDTH, ISO_HEIGHT);
    this.cameras.main.setZoom(1);
    this.cameras.main.startFollow(this.playerVisual, true, 0.085, 0.085);
    this.cameras.main.setBackgroundColor('#527e45');

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.pauseKey = this.keys.ESC;
    this.input.keyboard!.on('keydown', this.handleKeyboardInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', this.handleKeyboardInput, this));

    this.addFireflies();
    this.createHud();
    this.createTouchControls();
    this.createDialoguePanel();
    this.refreshQuestHud();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.openPause();
      return;
    }
    if (this.dialogueOpen) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }
    let x = (this.cursors.left.isDown || this.keys.A.isDown ? -1 : 0) + (this.cursors.right.isDown || this.keys.D.isDown ? 1 : 0);
    let y = (this.cursors.up.isDown || this.keys.W.isDown ? -1 : 0) + (this.cursors.down.isDown || this.keys.S.isDown ? 1 : 0);
    if (this.touchDirection.x || this.touchDirection.y) ({ x, y } = this.touchDirection);
    const screenDirection = normalizeDirection(x, y);
    // Inverse of projectPoint's grid transform. Input directions stay intuitive
    // on screen while the existing collision and quest geometry remain unchanged.
    const direction = screenDirectionToWorld(screenDirection.x, screenDirection.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const nextX = this.player.x + direction.x * 185 * this.game.loop.delta / 1000;
    const nextY = this.player.y + direction.y * 185 * this.game.loop.delta / 1000;
    const bodyRadiusX = 8, bodyRadiusY = 6;
    const bridgeRepaired = this.quest.stage === 'bridge-repaired' || this.quest.stage === 'complete';
    const nextPoints = [
      [nextX - bodyRadiusX, nextY - bodyRadiusY], [nextX + bodyRadiusX, nextY - bodyRadiusY],
      [nextX - bodyRadiusX, nextY + bodyRadiusY], [nextX + bodyRadiusX, nextY + bodyRadiusY],
    ];
    const blocked = nextPoints.some(([x, y]) => !canOccupyWorldPoint(x, y, bridgeRepaired));
    body.setVelocity(blocked ? 0 : direction.x * 185, blocked ? 0 : direction.y * 185);
    this.player.setMovement(blocked ? { x: 0, y: 0 } : screenDirection);
    const playerPoint = projectPoint(this.player.x, this.player.y);
    this.playerVisual.setPosition(playerPoint.x, playerPoint.y).setDepth(playerPoint.y + 18);
    this.playerVisual.setTexture(this.player.texture.key, this.player.frame.name);
    const shadowPoint = projectPoint(this.player.x, this.player.y + 15);
    this.playerShadow.setPosition(shadowPoint.x, shadowPoint.y).setDepth(shadowPoint.y + 1);
    this.updateInteractionPrompt();
    if (this.quest.stage === 'bridge-repaired' && hasReachedEastBank(this.player.x, this.player.y) && this.quest.completeAfterCrossing()) {
      this.refreshQuestHud();
      this.showDialogue('QUEST COMPLETE', [
        'You gathered all 12 pieces of timber, repaired the bridge, and crossed safely!',
        'You earned 100 XP. The whole forest is open to explore now!'
      ]);
    }
  }

  private createTrailCells() {
    const cells = new Set<string>();
    const addBrush = (column: number, row: number, radius = 1.25) => {
      const reach = Math.ceil(radius);
      for (let y = Math.floor(row) - reach; y <= Math.floor(row) + reach; y++) {
        for (let x = Math.floor(column) - reach; x <= Math.floor(column) + reach; x++) {
          if ((x - column) ** 2 + (y - row) ** 2 <= radius ** 2 && x >= 0 && x < 60 && y >= 0 && y < 40) cells.add(`${x},${y}`);
        }
      }
    };

    // A gentle explorer's trail leads from the starting clearing to the river crossing.
    for (let i = 0; i <= 110; i++) {
      const t = i / 110;
      const row = 7 + t * 17;
      const column = 11 + t * 16 + Math.sin(t * Math.PI * 2) * 1.25;
      addBrush(column, row, 1.35);
    }
    // The log bridge continues east as a clear route through the forest.
    for (let column = 24; column <= 49; column++) addBrush(column, 25, 1.4);
    return cells;
  }

  private createWorldTexture(paths: Set<string>) {
    // Draw the licensed diamond tiles in projected space. The collision map
    // and quest coordinates remain orthogonal, so all existing gameplay gates
    // continue to use the same tested world geometry.
    const terrain = this.add.renderTexture(0, 0, ISO_WIDTH, ISO_HEIGHT).setOrigin(0).setDepth(-10);
    terrain.setData('isoProjected', true);
    const isPath = (column: number, row: number) => paths.has(`${column},${row}`);
    const tiles: Array<{ column: number; row: number; x: number; y: number }> = [];
    // Extend the meadow beyond the playable diamond so the camera never shows
    // a bare canvas corner while following the player near the map edges.
    for (let row = -32; row <= 72; row++) {
      for (let column = -22; column <= 82; column++) {
        const x = column * TILE + 16, y = row * TILE + 16;
        tiles.push({ column, row, ...projectPoint(x, y) });
      }
    }
    // Isometric faces must be painted back-to-front along the diagonal rows.
    tiles.sort((a, b) => a.column + a.row - (b.column + b.row));
    for (const tile of tiles) {
      const x = tile.column * TILE + 16, y = tile.row * TILE + 16;
      const inMap = tile.column >= 0 && tile.column < 60 && tile.row >= 0 && tile.row < 40;
      const inRiver = inMap && isRiverCell(x, y);
      const path = inMap && isPath(tile.column, tile.row) && !inRiver;
      // A consistent base face prevents the small atlas's noticeably different
      // greens from forming checkerboards or large square colour patches.
      let frame: string | number = path ? 'dirt-0' : 'grass-10';
      if (inRiver) {
        // Frame 55 is an open-water diamond. Using one surface tile keeps the
        // river continuous; shoreline detail is supplied by the grass bank.
        frame = 55;
      }
      const tileY = tile.y - 8;
      terrain.drawFrame(inRiver ? 'iso-forest-tiles' : 'iso-ground-tops', frame, tile.x - 16, tileY);
    }
  }

  private addBridge() {
    const logs = this.textures.get('mixel-logs');
    if (!logs.has('bridge-plank')) logs.add('bridge-plank', 0, 128, 0, 64, 32);
    const center = riverCenterX(800);
    const left = Math.round((center - 160) / 64) * 64;
    for (const row of BRIDGE_ROWS) {
      for (let x = left; x < left + 320; x += 64) {
        const isBrokenSpan = this.quest.stage !== 'bridge-repaired' && this.isBridgeGapColumn(x, center);
        if (isBrokenSpan) continue;
        const point = projectPoint(x + 32, row * TILE + 16);
        const plank = this.add.image(point.x, point.y, 'mixel-logs', 'bridge-plank')
          .setOrigin(0.5, 0.5)
          .setScale(0.8)
          .setRotation(Math.atan(0.5))
          .setDepth(point.y + 0.5)
          .setData('isoProjected', true);
        this.bridgePlanks.push(plank);
      }
    }
    if (this.quest.stage !== 'bridge-repaired') {
      this.bridgeBarrier = this.add.rectangle(center, 800, 200, 132, 0, 0).setVisible(false);
      this.physics.add.existing(this.bridgeBarrier, true);
    }
  }

  private isBridgeGapColumn(plankX: number, centerX: number) {
    // Leave a visible gap across the full deck while the bridge is broken.
    return Math.abs(plankX + 32 - centerX) <= 64;
  }

  private attachBridgeBlocker() {
    if (this.bridgeBarrier) this.bridgeBarrierCollider = this.physics.add.collider(this.player, this.bridgeBarrier);
  }

  private addTrailKeeper() {
    const npcPoint = projectPoint(752, 640);
    this.add.image(npcPoint.x, npcPoint.y, 'hero-idle-left', 0).setScale(1.4).setDepth(npcPoint.y + 14).setData('isoProjected', true);
    const shadowPoint = projectPoint(752, 653);
    this.add.image(shadowPoint.x, shadowPoint.y, 'mixel-shadow').setScale(1.05).setDepth(shadowPoint.y + 1).setAlpha(0.65).setData('isoProjected', true);
    const labelPoint = projectPoint(752, 590);
    this.add.text(labelPoint.x, labelPoint.y, 'LINA · TRAIL KEEPER', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '11px', fontStyle: 'bold', color: '#fff3c5',
      backgroundColor: '#164635', padding: { x: 7, y: 4 }, stroke: '#163b2e', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(labelPoint.y + 2).setData('isoProjected', true);
    const markerPoint = projectPoint(752, 602);
    this.add.circle(markerPoint.x, markerPoint.y, 10, 0xf2c867).setStrokeStyle(2, 0xfff1bd).setDepth(markerPoint.y + 3).setData('isoProjected', true);
    this.add.text(markerPoint.x, markerPoint.y - 1, '!', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#264a36' }).setOrigin(0.5).setDepth(markerPoint.y + 4).setData('isoProjected', true);
  }

  private addTimberCollectibles() {
    // All twelve are on the starting river bank, along or beside the trail.
    // Trail cells are excluded from map scenery collision, so each piece stays reachable.
    const positions: Array<[number, number]> = [
      [390, 250], [480, 330], [510, 410], [565, 475], [625, 535], [690, 590],
      [790, 675], [770, 735], [690, 770], [595, 790], [430, 805], [310, 760],
    ];
    positions.forEach(([x, y], index) => {
      if (isRiverCell(x, y) || isBridgeZone(x, y)) return;
      const id = `timber-${String(index + 1).padStart(2, '0')}`;
      if (this.quest.hasCollected(id)) return;
      this.add.ellipse(x, y + 4, 38, 12, 0x24492c, 0.32).setDepth(y - 1);
      const point = projectPoint(x, y);
      const plank = this.add.image(point.x, point.y, 'mixel-logs', 'bridge-plank').setScale(0.72).setRotation(Math.atan(0.5) + ((index % 3) - 1) * 0.12).setDepth(point.y + 20).setData({ isoProjected: true, worldX: x, worldY: y });
      this.tweens.add({ targets: plank, y: point.y - 0.75, duration: 850 + (index % 4) * 100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.timberSprites.set(id, plank);
    });
  }

  private createDialoguePanel() {
    this.dialogueDim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x071e18, 0.35)
      .setScrollFactor(0).setDepth(29990).setVisible(false);
    this.dialoguePanel = this.add.graphics().setScrollFactor(0).setDepth(29991).setVisible(false);
    this.dialoguePanel.fillStyle(0x0a2c25, 0.3).fillRoundedRect(35, 415, 900, 158, 22);
    this.dialoguePanel.fillStyle(0x164536, 0.98).fillRoundedRect(28, 407, 900, 158, 22);
    this.dialoguePanel.lineStyle(3, 0xc6df9d, 0.95).strokeRoundedRect(28, 407, 900, 158, 22);
    this.dialoguePanel.lineStyle(1, 0xf0d58d, 0.74).strokeRoundedRect(37, 416, 882, 140, 17);
    this.dialogueSpeaker = this.add.text(56, 430, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '15px', fontStyle: 'bold', color: '#f4d479', letterSpacing: 0.7,
    }).setScrollFactor(0).setDepth(29992).setVisible(false);
    this.dialogueText = this.add.text(56, 464, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '18px', color: '#fff4d4',
      wordWrap: { width: 820 }, lineSpacing: 5,
    }).setScrollFactor(0).setDepth(29992).setVisible(false);
    this.dialogueContinue = this.add.text(884, 536, 'E / SPACE  ·  NEXT', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '11px', fontStyle: 'bold', color: '#d2e9bd',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(29992).setVisible(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dialogueDim?.destroy();
      this.dialoguePanel?.destroy();
      this.dialogueSpeaker?.destroy();
      this.dialogueText?.destroy();
      this.dialogueContinue?.destroy();
    });
  }

  private showDialogue(speaker: string, pages: string[]) {
    this.dialogueOpen = true;
    this.dialoguePages = pages;
    this.dialoguePage = 0;
    this.dialogueSpeaker?.setText(speaker).setVisible(true);
    this.dialogueText?.setText(pages[0]).setVisible(true);
    this.dialogueContinue?.setText(pages.length > 1 ? 'E / SPACE  ·  NEXT' : 'E / SPACE  ·  CLOSE').setVisible(true);
    this.dialogueDim?.setVisible(true);
    this.dialoguePanel?.setVisible(true);
    this.promptText?.setVisible(false);
  }

  private advanceDialogue() {
    this.dialoguePage++;
    if (this.dialoguePage >= this.dialoguePages.length) {
      this.dialogueOpen = false;
      this.dialoguePanel?.setVisible(false);
      this.dialogueSpeaker?.setVisible(false);
      this.dialogueText?.setVisible(false);
      this.dialogueContinue?.setVisible(false);
      this.dialogueDim?.setVisible(false);
      return;
    }
    this.dialogueText?.setText(this.dialoguePages[this.dialoguePage]);
    this.dialogueContinue?.setText(this.dialoguePage === this.dialoguePages.length - 1 ? 'E / SPACE  ·  CLOSE' : 'E / SPACE  ·  NEXT');
  }

  private updateInteractionPrompt() {
    const px = this.player.x, py = this.player.y;
    let nearest: { target: 'npc' | 'bridge' | string; x: number; y: number; distance: number; prompt: string } | undefined;
    const consider = (candidate: typeof nearest) => {
      const reach = candidate?.target === 'bridge' ? 160 : 78;
      if (candidate && candidate.distance <= reach && (!nearest || candidate.distance < nearest.distance)) nearest = candidate;
    };
    const npcX = 752, npcY = 640;
    consider({ target: 'npc', x: npcX, y: npcY, distance: Phaser.Math.Distance.Between(px, py, npcX, npcY), prompt: 'E  ·  Talk to Lina' });
    if (this.quest.stage !== 'unstarted') {
      for (const [id, sprite] of this.timberSprites) {
        const itemX = sprite.getData('worldX') as number, itemY = sprite.getData('worldY') as number;
        const distance = Phaser.Math.Distance.Between(px, py, itemX, itemY);
        consider({ target: id, x: itemX, y: itemY, distance, prompt: 'E  ·  Pick up timber' });
      }
    }
    const center = riverCenterX(py);
    const bridgeDistance = Phaser.Math.Distance.Between(px, py, center, 800);
    const bridgePrompt = this.quest.stage === 'collecting' && this.quest.canRepairBridge
      ? 'E  ·  Repair the bridge'
      : this.quest.stage === 'bridge-repaired' ? 'Bridge repaired  ·  Cross to the east bank'
        : this.quest.stage === 'complete' ? 'Quest complete  ·  Keep exploring'
        : `Bridge broken  ·  Timber ${this.quest.timberCount}/${TIMBER_GOAL}`;
    consider({ target: 'bridge', x: center, y: 800, distance: bridgeDistance, prompt: bridgePrompt });
    this.nearbyTarget = nearest?.target ?? null;
    this.promptText.setText(nearest?.prompt ?? '').setVisible(Boolean(nearest));
  }

  private interact() {
    if (this.nearbyTarget === 'npc') {
      if (this.quest.start()) {
        this.refreshQuestHud();
        this.showDialogue('LINA · TRAIL KEEPER', [
          'Hello, Explorer! The river bridge is broken. Could you find 12 pieces of timber on this side?',
          'Walk near a timber piece and press E to pick it up. When you have all 12, go to the bridge and press E to repair it!'
        ]);
      } else if (this.quest.stage === 'collecting' && this.quest.canRepairBridge) {
        this.showDialogue('LINA · TRAIL KEEPER', ['You found all 12 pieces! Go to the broken bridge and press E to mend it.']);
      } else if (this.quest.stage === 'collecting') {
        this.showDialogue('LINA · TRAIL KEEPER', [`The bridge needs 12 pieces of timber. You have ${this.quest.timberCount} so far. Look along the forest trail!`]);
      } else {
        this.showDialogue('LINA · TRAIL KEEPER', ['Wonderful work, Explorer! The bridge is safe again. Have fun exploring the forest!']);
      }
      return;
    }
    if (typeof this.nearbyTarget === 'string' && this.nearbyTarget.startsWith('timber-')) {
      const item = this.timberSprites.get(this.nearbyTarget);
      if (!item || !this.quest.collect(this.nearbyTarget)) return;
      const collected = this.quest.timberCount;
      this.timberSprites.delete(this.nearbyTarget);
      this.tweens.add({ targets: item, alpha: 0, scale: 0.1, angle: item.angle + 100, duration: 260, onComplete: () => item.destroy() });
      this.addCollectionSpark(item.getData('worldX') as number, item.getData('worldY') as number);
      this.refreshQuestHud();
      this.showToast(collected === TIMBER_GOAL ? '12/12 timber! The bridge is ready to repair!' : `Timber collected  ·  ${collected}/${TIMBER_GOAL}`);
      this.updateInteractionPrompt();
      return;
    }
    if (this.nearbyTarget === 'bridge') {
      if (this.quest.canRepairBridge) {
        if (!this.quest.repairBridge()) return;
        this.bridgeBarrierCollider?.destroy();
        this.bridgeBarrier?.destroy();
        this.bridgePlanks.forEach((plank) => plank.destroy());
        this.bridgePlanks = [];
        this.addBridge();
        this.refreshQuestHud();
        this.showDialogue('BRIDGE REPAIRED!', ['The new planks are strong and safe. Walk across to the other side to finish your quest and earn XP!']);
      } else if (this.quest.stage === 'collecting') {
        this.showDialogue('BROKEN BRIDGE', [`This bridge still has a gap. Find ${TIMBER_GOAL - this.quest.timberCount} more pieces of timber, then press E here to repair it.`]);
      } else if (this.quest.stage === 'unstarted') {
        this.showDialogue('BROKEN BRIDGE', ['The bridge is broken. Find Lina, the trail keeper, to learn how you can help.']);
      }
    }
  }

  private handleActionKey() {
    if (this.time.now - this.lastActionTime < 220) return;
    this.lastActionTime = this.time.now;
    if (this.dialogueOpen) this.advanceDialogue();
    else this.interact();
  }

  private handleKeyboardInput(event: KeyboardEvent) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'e' || key === ' ' || key === 'spacebar') this.handleActionKey();
  }

  private addCollectionSpark(x: number, y: number) {
    const point = projectPoint(x, y - 12);
    const spark = this.add.text(point.x, point.y, '✦', { fontFamily: 'Arial', fontSize: '20px', color: '#ffe88f', stroke: '#815a32', strokeThickness: 2 }).setOrigin(0.5).setDepth(point.y + 5);
    this.tweens.add({ targets: spark, y: point.y - 12, alpha: 0, scale: 1.5, duration: 450, onComplete: () => spark.destroy() });
  }

  private showToast(message: string) {
    this.toastText.setText(message).setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1500, duration: 350, onComplete: () => this.toastText.setVisible(false) });
  }

  private refreshQuestHud() {
    const objective = this.quest.stage === 'unstarted' ? 'Meet Lina to start your quest'
      : this.quest.stage === 'collecting' && this.quest.canRepairBridge ? 'Timber ready · Repair the bridge'
        : this.quest.stage === 'collecting' ? 'Find timber along the trail'
          : this.quest.stage === 'bridge-repaired' ? 'Cross the bridge to earn your reward'
            : 'Quest complete · Keep exploring!';
    this.questText.setText(`${objective}  ·  Timber: ${this.quest.timberCount}/${TIMBER_GOAL}  ·  XP: ${this.quest.xp}`);
    const hint = this.quest.stage === 'unstarted' ? '✦  FIND LINA THE TRAIL KEEPER  ✦'
      : this.quest.stage === 'collecting' ? '✦  FIND 12 TIMBER PIECES  ·  PRESS E NEAR AN ITEM  ✦'
        : this.quest.stage === 'bridge-repaired' ? '✦  CROSS THE BRIDGE TO FINISH YOUR QUEST  ✦'
          : '✦  QUEST COMPLETE  ·  KEEP EXPLORING  ✦';
    this.hintText.setText(hint);
  }

  private addForestObjects(objects: Phaser.Types.Tilemaps.TiledObject[], paths: Set<string>, blockers: Phaser.Physics.Arcade.StaticGroup) {
    const trees = ['iso-forest-tree-1', 'iso-forest-tree-2', 'iso-forest-tree-3'] as const;

    for (const object of objects) {
      if (object.name !== 'tree' && object.name !== 'rock') continue;
      const x = (object.x ?? 0) + (object.width ?? TILE) / 2;
      const y = (object.y ?? 0) + (object.height ?? TILE);
      if (this.isPathNear(paths, x, y) || isRiverCell(x, y - 12) || isBridgeZone(x, y)) continue;

      if (object.name === 'tree') {
        const tree = this.add.image(x, y, trees[(object.id ?? 0) % trees.length]).setOrigin(0.5, 0.92).setDepth(y);
        tree.setScale([1.25, 1.15, 1.3][(object.id ?? 0) % 3]);
      } else {
        this.add.image(x, y, 'iso-forest-rocks', (object.id ?? 0) % 9).setOrigin(0.5, 1).setDepth(y);
      }

      const blocker = this.add.rectangle(x, y - 5, 23, 15, 0x000000, 0).setVisible(false);
      this.physics.add.existing(blocker, true);
      blockers.add(blocker);
    }
  }

  private addForestDressing(paths: Set<string>, blockers: Phaser.Physics.Arcade.StaticGroup) {
    const random = this.seededRandom(8763);
    const safe = (x: number, y: number) => !isRiverCell(x, y) && !isBridgeZone(x, y) && !this.isPathNear(paths, x, y) && Phaser.Math.Distance.Between(x, y, 790, 700) > 110;

    const occupied = () => blockers.getChildren().map((object) => ({ x: (object as Phaser.GameObjects.GameObject & { x: number }).x, y: (object as Phaser.GameObjects.GameObject & { y: number }).y }));
    for (let i = 0; i < 8; i++) {
      const x = 70 + random() * (WORLD_WIDTH - 140), y = 110 + random() * (WORLD_HEIGHT - 220);
      if (!safe(x, y) || occupied().some((point) => Phaser.Math.Distance.Between(x, y, point.x, point.y) < 112)) continue;
      this.add.image(x, y, `iso-forest-tree-${(i % 3) + 1}`).setOrigin(0.5, 0.92).setDepth(y).setScale(1.08 + (i % 3) * 0.08);
      const trunk = this.add.rectangle(x, y - 5, 23, 15, 0, 0).setVisible(false);
      this.physics.add.existing(trunk, true);
      blockers.add(trunk);
    }

    // These solid understory clumps retain the old blocker layout, but use
    // matching foliage from the isometric pack instead of top-down bushes.
    for (let i = 0; i < 20; i++) {
      const x = 42 + random() * (WORLD_WIDTH - 84), y = 64 + random() * (WORLD_HEIGHT - 128);
      if (!safe(x, y)) continue;
      this.add.image(x, y, 'iso-forest-leaves', (i * 7) % 16).setOrigin(0.5, 0.85).setScale(1.22).setDepth(y);
      const obstacle = this.add.rectangle(x, y - 3, 20, 12, 0, 0).setVisible(false);
      this.physics.add.existing(obstacle, true);
      blockers.add(obstacle);
    }

    for (let i = 0; i < 36; i++) {
      const x = 20 + random() * (WORLD_WIDTH - 40), y = 24 + random() * (WORLD_HEIGHT - 48);
      if (!safe(x, y)) continue;
      if (i % 3 === 0) this.add.image(x, y, 'iso-forest-leaves', Math.floor(random() * 16)).setOrigin(0.5, 0.85).setDepth(y - 0.2);
    }
  }

  private addRiverCollision() {
    const step = 16;
    for (let y = 0; y < WORLD_HEIGHT; y += step) {
      let runStart: number | undefined;
      for (let x = 0; x <= WORLD_WIDTH; x += step) {
        const centerX = x + step / 2, centerY = y + step / 2;
      const blocked = x < WORLD_WIDTH && isBlockedByRiver(centerX, centerY);
        if (blocked && runStart === undefined) runStart = x;
        if (!blocked && runStart !== undefined) {
          const width = x - runStart;
          const bank = this.add.rectangle(runStart + width / 2, centerY, width, step, 0, 0).setVisible(false);
          this.physics.add.existing(bank, true);
          this.physics.add.collider(this.player, bank);
          runStart = undefined;
        }
      }
    }
  }

  private projectStaticWorldArt() {
    for (const child of this.children.list) {
      const visual = child as Phaser.GameObjects.GameObject & { x: number; y: number; visible: boolean; scrollFactorX: number; setPosition(x: number, y: number): unknown; setDepth(depth: number): unknown; setData(data: object): unknown };
      if (child === this.player || !visual.visible || child.getData('isoProjected') || visual.scrollFactorX === 0) continue;
      const worldX = visual.x, worldY = visual.y;
      const point = projectPoint(worldX, worldY);
      visual.setPosition(point.x, point.y);
      visual.setDepth(point.y);
      visual.setData({ isoProjected: true, worldX, worldY });
    }
  }

  private isPathNear(paths: Set<string>, x: number, y: number) {
    const column = Math.floor(x / TILE), row = Math.floor(y / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (paths.has(`${column + dx},${row + dy}`)) return true;
    return false;
  }

  private seededRandom(seed: number) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  private addFireflies() {
    const random = this.seededRandom(3301);
    for (let i = 0; i < 18; i++) {
      const x = 70 + random() * (WORLD_WIDTH - 140), y = 30 + random() * (WORLD_HEIGHT - 60);
      if (isRiverCell(x, y)) continue;
      const point = projectPoint(x, y);
      const mote = this.add.circle(point.x, point.y, i % 4 === 0 ? 2 : 1.3, i % 3 === 0 ? 0xffe88f : 0xe5f5ad, 0.32).setDepth(point.y + 2).setData('isoProjected', true);
      this.tweens.add({ targets: mote, alpha: { from: 0.14, to: 0.65 }, scale: { from: 0.8, to: 1.25 }, duration: 1600 + (i % 5) * 260, yoyo: true, repeat: -1, delay: (i * 173) % 1800 });
    }
  }

  private createHud() {
    const panel = this.add.graphics().setScrollFactor(0).setDepth(20000);
    panel.fillStyle(0x092c26, 0.2).fillRoundedRect(18, 18, 440, 104, 21);
    panel.fillStyle(0x123b31, 0.96).fillRoundedRect(14, 14, 440, 104, 21);
    panel.lineStyle(2, 0xc6e8a7, 0.86).strokeRoundedRect(14, 14, 440, 104, 21);
    panel.fillStyle(0x315f45, 1).fillCircle(52, 52, 23);
    panel.lineStyle(2, 0xf0d488, 0.92).strokeCircle(52, 52, 19);
    panel.fillStyle(0x8ed36d, 1).fillEllipse(52, 51, 12, 20);
    panel.lineStyle(2, 0x416b42, 1).lineBetween(52, 43, 52, 59).lineBetween(52, 51, 46, 47).lineBetween(52, 53, 58, 47);
    this.add.text(86, 28, 'EMERALD WILDS', { fontFamily: 'Trebuchet MS, Arial', fontSize: '16px', fontStyle: 'bold', color: '#fff5d7', letterSpacing: 1.5 }).setScrollFactor(0).setDepth(20001);
    this.add.text(86, 53, 'Chapter 1  ·  The sunlit trail', { fontFamily: 'Trebuchet MS, Arial', fontSize: '13px', color: '#c9e2bb' }).setScrollFactor(0).setDepth(20001);
    this.questText = this.add.text(86, 78, '', { fontFamily: 'Trebuchet MS, Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffebae' })
      .setScrollFactor(0).setDepth(20001);

    const pause = this.add.container(GAME_WIDTH - 43, 48).setScrollFactor(0).setDepth(20001);
    pause.add(this.add.circle(0, 2, 27, 0x092c26, 0.25));
    const button = this.add.circle(0, 0, 24, 0x214f3e, 1).setStrokeStyle(2, 0xd4eab7, 0.9).setInteractive({ useHandCursor: true });
    pause.add(button);
    pause.add(this.add.text(0, -1, 'Ⅱ', { fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#fff5d7' }).setOrigin(0.5));
    button.on('pointerover', () => button.setFillStyle(0x4b8a59));
    button.on('pointerout', () => button.setFillStyle(0x214f3e));
    button.on('pointerdown', () => this.openPause());

    const hint = this.add.graphics().setScrollFactor(0).setDepth(20000);
    const hintWidth = 410;
    hint.fillStyle(0x153b31, 0.88).fillRoundedRect((GAME_WIDTH - hintWidth) / 2, GAME_HEIGHT - 47, hintWidth, 34, 15);
    hint.lineStyle(1, 0xb7dda1, 0.68).strokeRoundedRect((GAME_WIDTH - hintWidth) / 2, GAME_HEIGHT - 47, hintWidth, 34, 15);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '12px', fontStyle: 'bold', color: '#fff0bd', letterSpacing: 0.6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    this.promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 87, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '14px', fontStyle: 'bold', color: '#fff4c9',
      backgroundColor: '#123b31', padding: { x: 12, y: 7 }, stroke: '#071e18', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22000).setVisible(false);
    this.toastText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 133, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '14px', fontStyle: 'bold', color: '#fff0bd',
      backgroundColor: '#174b39', padding: { x: 14, y: 8 }, stroke: '#f1d58b', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22001).setVisible(false);
  }

  private createTouchControls() {
    const pad = this.add.container(76, GAME_HEIGHT - 87).setScrollFactor(0).setDepth(21000);
    pad.add(this.add.circle(0, 3, 53, 0x0b322a, 0.28));
    pad.add(this.add.circle(0, 0, 49, 0x153e32, 0.82).setStrokeStyle(2, 0xb9dfa3, 0.85));
    pad.add(this.add.circle(0, 0, 31, 0x285740, 0.76).setStrokeStyle(1, 0x9ac787, 0.62));
    const buttons = [
      { x: 0, y: -26, glyph: '▲', dx: 0, dy: -1 }, { x: 0, y: 26, glyph: '▼', dx: 0, dy: 1 },
      { x: -26, y: 0, glyph: '◀', dx: -1, dy: 0 }, { x: 26, y: 0, glyph: '▶', dx: 1, dy: 0 },
    ];
    for (const direction of buttons) {
      const button = this.add.text(direction.x, direction.y, direction.glyph, { fontFamily: 'Arial', fontSize: '14px', color: '#f7f3cf', backgroundColor: '#3a7951', padding: { x: 8, y: 6 } })
        .setOrigin(0.5).setInteractive();
      button.on('pointerdown', () => { this.touchDirection = { x: direction.dx, y: direction.dy }; });
      button.on('pointerup', () => { this.touchDirection = { x: 0, y: 0 }; });
      button.on('pointerout', () => { this.touchDirection = { x: 0, y: 0 }; });
      pad.add(button);
    }
    this.add.text(76, GAME_HEIGHT - 151, 'MOVE', { fontFamily: 'Trebuchet MS, Arial', fontSize: '10px', fontStyle: 'bold', color: '#ecf4d1', backgroundColor: '#153d32cc', padding: { x: 8, y: 4 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(21000);
  }

  private openPause() { this.scene.launch('PauseScene'); this.scene.pause(); }
}
