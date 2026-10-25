import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { clampDelta, followLerp, groundVelocity, slideVelocity } from '../systems/movement';
import { projectIsometricPoint, worldVelocityToScreen } from '../systems/isometric';
import { getLayout } from '../responsive';
import { followOffsetY } from '../systems/uiLayout';
import { parseTierOverride, performanceTierFor, profileFor, type PerformanceProfile } from '../systems/performance';
import { textResolutionFor } from '../systems/viewport';
import { canOccupyWorldPoint, hasReachedEastBank, isBridgeZone, isRiverCell, RIVER_HALF_WIDTH, riverCenterX, WORLD_HEIGHT, WORLD_WIDTH } from '../systems/worldGeometry';
import { ForestQuest, TIMBER_GOAL } from '../systems/forestQuest';
import { buildTrailCells, planForest, seededRandom, TILE, type Blocker, type ForestPlan, type MapObject } from '../systems/forestLayout';
import { bakeShadow, bushKey, bushKindFor, createTerrain, ISO_H, ISO_W, OBJ, rockKey, tuftKey, type TerrainTexture } from '../art/painter';
import { LOG_FRAMES } from '../data/frames';
import { HERO_ATLAS_KEY, LINA_KEY, LINA_LO_KEY } from '../art/hero';
import { HERO_ORIGIN, HERO_SCALE, idleFrameName, pickHeroLod, type HeroLod } from '../systems/heroFacing';
import { audioFor, type GameAudio } from '../audio/GameAudio';
import { AmbientLife } from '../effects/AmbientLife';
import { DayNightCycle } from '../effects/DayNightCycle';
import { Fx, GLOW_DEPTH } from '../effects/Fx';
import { distanceToRiver, riverVolume } from '../systems/audioMath';
import { parseTimeOfDay, type TimeOfDay } from '../systems/dayNight';
import { FootstepTracker, surfaceAt, type Foot } from '../systems/footsteps';
import { isOff } from '../systems/features';
import { gustLevel } from '../systems/wind';
import { actionLabel, bridgePrompt, objectiveLabel, talkPrompt, timberPrompt } from '../systems/questText';
import { BRIDGE_SIGN, KEEP_CLEAR, LINA_POS, PLAYER_START, SCENERY, sceneryBlockers, START_SIGN, TIMBER_PILE, TIMBER_POSITIONS } from '../data/scenery';
import * as text from '../data/emeraldWildsText';
import { DialogueBox } from '../ui/DialogueBox';
import { Hud } from '../ui/Hud';
import { Pill } from '../ui/Pill';
import { TouchControls } from '../ui/TouchControls';
import { setTextResolution, textStyle, UI } from '../ui/theme';

const BRIDGE_ROWS = [24, 25, 26];
const ISO_WIDTH = ISO_W;
const ISO_HEIGHT = ISO_H;
const FLAT_ROTATION = Math.atan(0.5); // objects lying on the ground follow the isometric axis
const GROUND_SHADOW = 0x1d3a2a;
/** Ground point under the hero's feet, in world units below `player.y` (the centre of the collision footprint). */
const FOOT_WORLD_DY = 12.8;
/** Lina's feet, in screen px below her world point. */
const LINA_FOOT_DY = 18;

/** Painted textures are drawn at OBJ x resolution; these factors give each its on-screen size. */
const TREE_SIZE = 0.62;

/** Project the orthogonal gameplay grid into the isometric screen plane. */
function projectPoint(x: number, y: number) {
  return projectIsometricPoint(x, y, WORLD_HEIGHT * 0.5);
}

/** A circle of radius r on the ground appears as a 2:1 ellipse in this projection. */
const ringSize = (radius: number) => ({ width: radius * Math.SQRT2, height: radius * Math.SQRT1_2 });

interface BridgeSlot {
  x: number; y: number;
  ghost?: Phaser.GameObjects.Image;
  pulse?: Phaser.Tweens.Tween;
  plank?: Phaser.GameObjects.Image;
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private playerVisual!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private linaSprite?: Phaser.GameObjects.Sprite;
  private heroLod: HeroLod = 'hi';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private quest = new ForestQuest();
  private hud!: Hud;
  private dialogue!: DialogueBox;
  private touch!: TouchControls;
  private timberSprites = new Map<string, Phaser.GameObjects.Image>();
  private timberGlows = new Map<string, Phaser.GameObjects.Ellipse>();
  private timberShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  private bridgePlanks: Phaser.GameObjects.Image[] = [];
  private bridgeDecor: Phaser.GameObjects.GameObject[] = [];
  private bridgeSlots: BridgeSlot[] = [];
  private bridgeRepairedDecor: Phaser.GameObjects.GameObject[] = [];
  private bridgeChevrons: Phaser.GameObjects.GameObject[] = [];
  private pileLogs: Phaser.GameObjects.Image[] = [];
  private pileObjects: Phaser.GameObjects.GameObject[] = [];
  private vignette!: Phaser.GameObjects.RenderTexture;
  private vignetteBrush!: Phaser.GameObjects.Graphics;
  private terrain!: TerrainTexture;
  private staticShadows: Array<{ x: number; y: number; w: number; h: number; alpha: number }> = [];
  private profile!: PerformanceProfile;
  private lastValid = { x: 0, y: 0 };
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private buildingUi = false;
  private repairBusy = false;
  private bridgeSignReady = false;
  private linaMarker?: Phaser.GameObjects.Container;
  private bridgeBarrier?: Phaser.GameObjects.Rectangle;
  private bridgeBarrierCollider?: Phaser.Physics.Arcade.Collider;
  private linaRing!: Phaser.GameObjects.Ellipse;
  private bridgeRing!: Phaser.GameObjects.Ellipse;
  private nearbyTarget: 'npc' | 'bridge' | string | null = null;
  private lastActionTime = Number.NEGATIVE_INFINITY;
  // Living world and game feel. Public so the ?debug hook (window.__mq) can inspect them.
  audio!: GameAudio;
  fx!: Fx;
  ambient!: AmbientLife;
  dayNight!: DayNightCycle;
  private footsteps = new FootstepTracker();
  private trail = new Set<string>();
  private shafts: Array<{ img: Phaser.GameObjects.Image; period: number; phase: number }> = [];
  private lanternHalos: Array<{ img: Phaser.GameObjects.Image; phase: number }> = [];
  private audioClock = 0;

  constructor() { super('WorldScene'); }

  create() {
    // The quest object deliberately survives scene restarts, so collected timber and the repaired bridge persist.
    this.timberSprites.clear();
    this.timberGlows.clear();
    this.timberShadows.clear();
    this.bridgePlanks = [];
    this.bridgeDecor = [];
    this.bridgeSlots = [];
    this.bridgeRepairedDecor = [];
    this.bridgeChevrons = [];
    this.pileLogs = [];
    this.pileObjects = [];
    this.repairBusy = false;
    this.bridgeSignReady = false;
    this.linaMarker = undefined;
    this.bridgeBarrier = undefined;
    this.bridgeBarrierCollider = undefined;
    this.nearbyTarget = null;
    this.staticShadows = [];
    this.shafts = [];
    this.lanternHalos = [];
    this.audioClock = 0;
    this.footsteps = new FootstepTracker();
    // Two cameras: the main one zooms and follows the hero and draws only the world; a second, fixed 1:1
    // camera draws only the HUD. A zoomed camera would otherwise scale and shift every screen-pinned object.
    const layout = getLayout(this);
    this.buildingUi = false;
    this.uiCam = this.cameras.add(0, 0, layout.width, layout.height, false, 'ui');
    const routeToCamera = (object: Phaser.GameObjects.GameObject) => (this.buildingUi ? this.cameras.main : this.uiCam).ignore(object);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, routeToCamera);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, routeToCamera));
    setTextResolution(textResolutionFor(getLayout(this).uiScale));
    this.profile = profileFor(performanceTierFor({ touch: this.sys.game.device.input.touch, override: parseTierOverride(typeof location === 'undefined' ? '' : location.search) }));

    // Sound is synthesised in code. The BEGIN click that got us here has already unlocked the browser's audio.
    this.audio = audioFor(this);
    this.audio.setLite(this.profile.tier === 'lite');
    this.audio.resume();
    this.audio.startMusic();
    this.audio.startAmbience();
    this.fx = new Fx(this, this.profile.tier === 'lite');
    this.dayNight = new DayNightCycle(this, isOff('daynight') ? 0 : parseTimeOfDay(typeof location === 'undefined' ? '' : location.search));

    const map = this.make.tilemap({ key: 'emerald-wilds' });
    const objects = (map.getObjectLayer('Collision')?.objects ?? []) as MapObject[];
    const paths = buildTrailCells();
    this.trail = paths;
    const plan = planForest(objects, paths, KEEP_CLEAR, sceneryBlockers());

    this.createWorldTexture();
    this.addWaterLife();
    this.ambient = new AmbientLife({
      scene: this, profile: this.profile, fx: this.fx, audio: this.audio, project: projectPoint,
      hero: () => ({ x: this.player.x, y: this.player.y }), homes: this.butterflyHomes(plan),
    });
    this.addForest(plan);
    this.addScenery();
    this.addSign(START_SIGN.x, START_SIGN.y, START_SIGN.label, 0xd0a45f, 0x6b4a26, '#4a2f14');
    this.addBridge();
    this.player = new Player(this, PLAYER_START.x, PLAYER_START.y);
    this.player.setVisible(false);
    this.attachBridgeBlocker();
    const startFoot = projectPoint(PLAYER_START.x, PLAYER_START.y + FOOT_WORLD_DY);
    this.playerVisual = this.add.sprite(startFoot.x, startFoot.y, HERO_ATLAS_KEY('hi'), idleFrameName('south')).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y);
    this.playerShadow = this.add.image(startFoot.x, startFoot.y, 'paint-shadow').setScale(0.34).setDepth(startFoot.y);
    this.addTrailKeeper();
    this.addTimberCollectibles();
    this.addInteractionRings();
    this.bakeStaticShadows();

    const obstacles = this.physics.add.staticGroup();
    for (const blocker of plan.blockers) this.addBlocker(blocker, obstacles);
    this.physics.add.collider(this.player, obstacles);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.cameras.main.setBounds(0, 0, ISO_WIDTH, ISO_HEIGHT);
    this.cameras.main.setBackgroundColor('#527e45');
    this.cameras.main.startFollow(this.playerVisual, true, 1, 1);
    this.applyCameraLayout();
    this.cameras.main.centerOn(this.playerVisual.x, this.playerVisual.y);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.pauseKey = this.keys.ESC;
    this.input.keyboard!.on('keydown', this.handleKeyboardInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', this.handleKeyboardInput, this));

    this.addFireflies();
    this.addLighting();
    // The floating prompt lives in the world (beside the character it describes), so it is made before the UI.
    const floatingPrompt = new Pill(this, 0, 0, 13).setDepth(22000).setVisible(false);
    this.buildingUi = true;
    this.hud = new Hud(this, () => this.openPause(), floatingPrompt);
    this.dialogue = new DialogueBox(this);
    this.dialogue.onSound = (kind) => this.audio.dialogue(kind);
    this.touch = new TouchControls(this, () => this.handleActionKey());
    this.vignetteBrush = this.make.graphics({ x: 0, y: 0 }, false);
    this.vignette = this.add.renderTexture(0, 0, 4, 4).setOrigin(0).setScrollFactor(0).setDepth(19000);
    this.buildingUi = false;
    this.drawVignette();
    const onResize = () => { this.uiCam.setSize(this.scale.width, this.scale.height); this.applyCameraLayout(); this.drawVignette(); this.touch.release(); };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    // Backgrounded tab, locked phone or app switch: drop held input so nothing keeps walking, and pause.
    const onHidden = () => { this.releaseInputs(); if (this.scene.isActive()) this.openPause(); };
    const onBlur = () => this.releaseInputs();
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
      this.vignetteBrush.destroy();
      this.audio.stopAmbience();
    });
    this.lastValid = { x: this.player.x, y: this.player.y };
    this.updatePile(false);
    this.refreshQuestHud();
    // Developer hook for automated screenshots; only active with ?debug in the URL.
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) (window as unknown as { __mq?: WorldScene }).__mq = this;
  }

  update(time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.openPause();
      return;
    }
    const dt = clampDelta(delta);
    // The world keeps living during dialogue and the bridge repair, so this runs before any early return.
    this.updateAlive(time, dt);
    // Time-based camera follow: the same catch-up speed at 30, 60 or 144 fps.
    this.cameras.main.setLerp(followLerp(dt), followLerp(dt));
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const bridgeRepaired = this.bridgeIsRepaired;
    if (this.dialogue.open || this.repairBusy) {
      body.setVelocity(0, 0);
      this.touch.release();
      this.player.setMovement({ x: 0, y: 0 });
      this.footsteps.advance(0);
      this.syncVisual();
      return;
    }
    this.touch.releaseIfPointerLost();
    // If a long frame ever carried the feet into water or onto the broken bridge, step back to the last good spot.
    if (this.footprintFits(0, 0, bridgeRepaired)) this.lastValid = { x: this.player.x, y: this.player.y };
    else { body.reset(this.lastValid.x, this.lastValid.y); }
    let x = (this.cursors.left.isDown || this.keys.A.isDown ? -1 : 0) + (this.cursors.right.isDown || this.keys.D.isDown ? 1 : 0);
    let y = (this.cursors.up.isDown || this.keys.W.isDown ? -1 : 0) + (this.cursors.down.isDown || this.keys.S.isDown ? 1 : 0);
    if (this.touch.direction.x || this.touch.direction.y) ({ x, y } = this.touch.direction);
    // One ground speed for keyboard and touch, every direction. Arcade integrates it with the frame's real
    // time (fixedStep is off), so nothing here is multiplied by delta a second time.
    const wanted = groundVelocity(x, y);
    const lookahead = Math.max(dt, 1000 / 60) / 1000;
    const velocity = slideVelocity(wanted.x, wanted.y, lookahead, (dx, dy) => this.footprintFits(dx, dy, bridgeRepaired));
    body.setVelocity(velocity.x, velocity.y);
    const onScreen = worldVelocityToScreen(velocity.x, velocity.y);
    const moving = velocity.x !== 0 || velocity.y !== 0;
    this.player.setMovement(moving ? onScreen : { x: 0, y: 0 }, dt / 1000);
    // Footsteps follow the ground actually covered, so they match the walk speed and stop when sliding along a wall.
    for (const foot of this.footsteps.advance(moving ? Math.hypot(velocity.x, velocity.y) * dt / 1000 : 0)) this.onFootstep(foot, bridgeRepaired);
    this.syncVisual();
    this.updateInteractionPrompt();
    this.updateRings(time);
    if (this.quest.stage === 'bridge-repaired' && hasReachedEastBank(this.player.x, this.player.y) && this.quest.completeAfterCrossing()) {
      this.refreshQuestHud();
      const here = projectPoint(this.player.x, this.player.y);
      this.audio.reward();
      this.fx.sparkleBurst(here.x, here.y - 22, 24);
      this.showDialogue(text.QUEST_COMPLETE, text.questCompletePages);
    }
  }

  // ---------------------------------------------------------------- terrain

  private createWorldTexture() {
    // The ground is painted once from the same analytic river and trail geometry that drives collision, so
    // what looks like water is water and what looks like trail is trail. Resolution follows the GPU limit.
    const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl as WebGLRenderingContext | undefined;
    const maxSize = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 4096;
    const wanted = this.profile.tier === 'lite' ? 1.5 : 2;
    const scale = Math.max(1, Math.min(wanted, maxSize / ISO_WIDTH));
    this.terrain = createTerrain(this.textures, scale);
    this.add.image(0, 0, 'paint-terrain').setOrigin(0).setScale(1 / scale).setDepth(-10);
  }

  /** Living water: glints, expanding ripples, drifting light streaks and foam along both banks. */
  private addWaterLife() {
    const random = seededRandom(5521);
    const onWater = (inset: number) => {
      const y = 40 + random() * (WORLD_HEIGHT - 80);
      const x = riverCenterX(y) + (random() - 0.5) * 2 * (RIVER_HALF_WIDTH - inset);
      return { x, y, point: projectPoint(x, y), ok: !isBridgeZone(x, y) };
    };
    for (let i = 0; i < this.profile.glints; i++) {
      const spot = onWater(16);
      if (!spot.ok) continue;
      const glint = this.add.rectangle(spot.point.x, spot.point.y, i % 3 === 0 ? 5 : 3, 1, 0xeaf6ff, 0.8).setDepth(-9).setAlpha(0.05);
      this.tweens.add({ targets: glint, alpha: 0.75, duration: 900 + (i % 5) * 220, yoyo: true, repeat: -1, delay: Math.floor(random() * 2200), ease: 'Sine.InOut' });
    }
    for (let i = 0; i < this.profile.ripples; i++) {
      const spot = onWater(26);
      if (!spot.ok) continue;
      const ring = this.add.ellipse(spot.point.x, spot.point.y, 8, 4).setStrokeStyle(1, 0xffffff, 0.6).setDepth(-9).setAlpha(0);
      this.tweens.add({ targets: ring, scale: { from: 0.4, to: 3 }, alpha: { from: 0.7, to: 0 }, duration: 2200, repeat: -1, delay: Math.floor(random() * 4000), repeatDelay: 600 + Math.floor(random() * 2200), ease: 'Sine.Out' });
    }
    for (let i = 0; i < this.profile.streaks; i++) {
      const spot = onWater(30);
      if (!spot.ok) continue;
      const streak = this.add.rectangle(spot.point.x, spot.point.y, 14 + (i % 3) * 5, 1, 0xdff3ff, 0.4).setDepth(-9).setAlpha(0);
      this.tweens.add({ targets: streak, x: spot.point.x + 26, y: spot.point.y + 13, alpha: { from: 0, to: 0.5 }, duration: 3200 + (i % 4) * 500, yoyo: true, repeat: -1, delay: Math.floor(random() * 3000), ease: 'Sine.InOut' });
    }
    for (let y = 20; y < WORLD_HEIGHT - 10; y += this.profile.foamStep) {
      for (const side of [-1, 1]) {
        const x = riverCenterX(y) + side * (RIVER_HALF_WIDTH - 4 + (random() - 0.5) * 6);
        if (isBridgeZone(x, y) || random() < 0.25) continue;
        const point = projectPoint(x, y);
        const foam = this.add.rectangle(point.x, point.y, 5 + (y % 3) * 2, 1, 0xf4fbff, 0.6).setDepth(-9).setAlpha(0.2);
        this.tweens.add({ targets: foam, alpha: 0.7, duration: 1200 + (y % 5) * 200, yoyo: true, repeat: -1, delay: Math.floor(random() * 1500), ease: 'Sine.InOut' });
      }
    }
  }

  // ---------------------------------------------------------------- scenery

  /** Static ground shadow: queued and painted once into the terrain texture instead of living as a display object. */
  private groundShadow(x: number, y: number, width: number, height: number, alpha = 0.24) {
    // Light comes from the upper left, so every shadow falls a little toward the lower right.
    this.staticShadows.push({ x: x + width * 0.1, y: y + height * 0.1, w: width, h: height, alpha });
  }

  private bakeStaticShadows() {
    for (const shadow of this.staticShadows) bakeShadow(this.terrain, shadow.x, shadow.y, shadow.w, shadow.h, shadow.alpha);
    this.terrain.texture.refresh();
    this.staticShadows = [];
  }

  /** A shadow that must be removable later (signs, timber, the log pile). */
  private shadow(x: number, y: number, width: number, height: number, alpha = 0.24) {
    const point = projectPoint(x, y);
    return this.add.ellipse(point.x, point.y, width, height, GROUND_SHADOW, alpha).setDepth(-5);
  }

  private addForest(plan: ForestPlan) {
    plan.trees.forEach((tree, index) => {
      const point = projectPoint(tree.x, tree.y);
      const pineTree = tree.variant === 2;
      const rose = !pineTree && index % 9 === 4;
      const key = pineTree ? `paint-pine-${tree.flip ? 0 : 1}` : rose ? 'paint-tree-rose' : `paint-tree-${tree.variant}`;
      const size = tree.scale * TREE_SIZE * (pineTree ? 0.9 : 1) * (rose ? 1.1 : 1);
      this.groundShadow(tree.x, tree.y, 110 * size * 1.5, 40 * size * 1.5, 0.2);
      this.groundShadow(tree.x, tree.y, 52 * size * 1.5, 19 * size * 1.5, 0.3);
      const image = this.add.image(point.x, point.y, key).setOrigin(0.5, pineTree ? 0.975 : 0.96).setScale(size / OBJ).setFlipX(pineTree ? false : tree.flip).setDepth(point.y);
      this.ambient.addSway(image, pineTree ? 'pine' : 'tree');
    });
    for (const rock of plan.rocks) {
      const point = projectPoint(rock.x, rock.y);
      this.groundShadow(rock.x, rock.y, 30 * rock.scale, 11 * rock.scale, 0.26);
      this.add.image(point.x, point.y, rockKey(rock.frame)).setOrigin(0.5, 0.92).setScale((rock.scale * 1.2) / OBJ).setDepth(point.y);
    }
    for (const bush of plan.bushes) {
      const point = projectPoint(bush.x, bush.y);
      this.groundShadow(bush.x, bush.y, 34 * bush.scale * 1.8, 11 * bush.scale * 1.8, 0.2);
      const image = this.add.image(point.x, point.y, bushKey(bushKindFor(bush.frame), bush.flower)).setOrigin(0.5, 0.94).setScale((bush.scale * 1.25) / OBJ).setDepth(point.y);
      this.ambient.addSway(image, 'bush');
    }
    for (const tuft of plan.tufts) {
      const point = projectPoint(tuft.x, tuft.y);
      const art = tuftKey(tuft.frame);
      const image = this.add.image(point.x, point.y, art.key).setOrigin(0.5, 0.9).setScale((tuft.scale * art.scale) / OBJ).setDepth(point.y - 0.2);
      this.ambient.addSway(image, 'tuft');
    }
  }

  private addScenery() {
    for (const prop of SCENERY) {
      const point = projectPoint(prop.x, prop.y);
      const [frameW, frameH] = LOG_FRAMES[prop.frame].slice(2) as unknown as [number, number];
      const isPost = prop.frame === 'log-post';
      const isLog = prop.frame.startsWith('log') && !isPost;
      const key = isPost ? 'paint-post' : isLog ? 'paint-log' : 'paint-stump';
      const fit = isPost ? frameH / 66 : isLog ? frameW / 70 : Math.max(frameW, frameH) / 64;
      const image = this.add.image(point.x, point.y, key).setScale((prop.scale * fit * 1.1) / OBJ).setFlipX(Boolean(prop.flipX));
      if (prop.flat) {
        // Weathered, fallen logs: darker than the bright timber the player can collect.
        image.setOrigin(0.5, 0.5).setRotation(FLAT_ROTATION).setTint(0xb7a68a).setDepth(point.y);
        this.groundShadow(prop.x, prop.y + 5, 44 * prop.scale, 12 * prop.scale, 0.2);
      } else {
        image.setOrigin(0.5, 0.92).setDepth(point.y);
        this.groundShadow(prop.x, prop.y, 38 * prop.scale, 12 * prop.scale, 0.24);
      }
    }
  }

  private addBlocker(blocker: Blocker, group: Phaser.Physics.Arcade.StaticGroup) {
    // A Zone has no visuals to render or sort: it only carries the static collision body.
    const zone = this.add.zone(blocker.x, blocker.y, blocker.w, blocker.h);
    this.physics.add.existing(zone, true);
    group.add(zone);
  }

  // ---------------------------------------------------------------- bridge
  // Four readable states: broken (ghost planks + CLOSED sign), under repair (planks fill in as timber is
  // collected), repaired (fresh deck, rope rails, lanterns, OPEN sign) and passable (gold chevrons point east).

  private get bridgeIsRepaired() { return this.quest.stage === 'bridge-repaired' || this.quest.stage === 'complete'; }

  private addBridge() {
    const center = riverCenterX(800);
    const left = Math.round((center - 160) / 64) * 64;
    this.bridgeSlots = [];
    for (const row of BRIDGE_ROWS) {
      for (let x = left; x < left + 320; x += 64) {
        const wx = x + 32, wy = row * TILE + 16;
        const point = projectPoint(wx, wy);
        if (!this.isBridgeGapColumn(x, center)) {
          // The surviving deck ends are old and weathered, so new timber reads as new.
          this.bridgePlanks.push(this.add.image(point.x, point.y, 'paint-log').setScale(0.6 / OBJ).setRotation(FLAT_ROTATION).setTint(0xc9b896).setDepth(point.y + 0.5));
          continue;
        }
        const slot: BridgeSlot = { x: wx, y: wy };
        if (this.bridgeIsRepaired) slot.plank = this.freshPlank(wx, wy);
        else {
          slot.ghost = this.add.image(point.x, point.y, 'paint-log').setScale(0.6 / OBJ).setRotation(FLAT_ROTATION).setAlpha(0.34).setTint(0xffe9a8).setDepth(point.y + 0.4);
          slot.pulse = this.tweens.add({ targets: slot.ghost, alpha: 0.62, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: (row - 24) * 150 });
        }
        this.bridgeSlots.push(slot);
      }
    }
    this.bridgeSlots.sort((a, b) => a.x - b.x || a.y - b.y);
    if (!this.bridgeIsRepaired) {
      this.bridgeBarrier = this.add.rectangle(center, 800, 200, 132, 0, 0).setVisible(false);
      this.physics.add.existing(this.bridgeBarrier, true);
      this.bridgeDecor.push(this.addSign(BRIDGE_SIGN.x, BRIDGE_SIGN.y, 'CLOSED', 0xd98a72, 0x7a3326, '#4a1a14'));
    } else {
      this.addRepairedDecor(false);
    }
    this.updateBridgeProgress();
  }

  private freshPlank(wx: number, wy: number) {
    const point = projectPoint(wx, wy);
    return this.add.image(point.x, point.y, 'paint-log').setScale(0.6 / OBJ).setRotation(FLAT_ROTATION).setTint(0xffe7b4).setDepth(point.y + 0.5);
  }

  /** Planks fill in as timber is collected, so the bridge visibly gets closer to ready. */
  private updateBridgeProgress() {
    if (this.bridgeIsRepaired || this.bridgeSlots.length === 0) return;
    const filled = Math.floor((this.quest.timberCount / TIMBER_GOAL) * this.bridgeSlots.length);
    this.bridgeSlots.forEach((slot, index) => {
      if (!slot.ghost) return;
      if (index < filled) {
        slot.pulse?.stop();
        slot.ghost.setAlpha(0.85).setTint(0xf0d79c);
      }
    });
  }

  /** Broken: red-brown CLOSED. Materials collected: green-gold REPAIR sign. (Repaired state has its own OPEN sign.) */
  private updateBridgeSign() {
    if (this.bridgeIsRepaired || this.bridgeSignReady || !this.quest.canRepairBridge) return;
    this.bridgeSignReady = true;
    this.bridgeDecor.forEach((object) => object.destroy());
    this.bridgeDecor = [this.addSign(BRIDGE_SIGN.x, BRIDGE_SIGN.y, 'REPAIR ME', 0xf2d36b, 0x7a5326, '#4a2f14')];
  }

  private addSign(x: number, y: number, label: string, fill: number, stroke: number, textColor: string) {
    const point = projectPoint(x, y);
    const caption = this.add.text(0, -19, label, textStyle(9, textColor, true)).setOrigin(0.5);
    const width = Math.ceil(caption.width) + 16;
    const post = this.add.graphics();
    post.fillStyle(0x5a3a22, 1).fillRoundedRect(-3, -8, 6, 27, 2);
    post.fillStyle(0xb98450, 1).fillRoundedRect(-3, -8, 2.5, 27, 1);
    post.fillStyle(0x2f1d10, 0.35).fillRect(1.5, -8, 1.5, 27);
    const board = this.add.graphics();
    board.fillStyle(0x1b2b1f, 0.28).fillRoundedRect(-width / 2 + 1.5, -25.5, width, 19, 4);
    board.fillStyle(stroke, 1).fillRoundedRect(-width / 2 - 1, -29, width + 2, 21, 5);
    board.fillStyle(fill, 1).fillRoundedRect(-width / 2, -28, width, 19, 4);
    board.fillStyle(0xffffff, 0.22).fillRoundedRect(-width / 2 + 1.5, -27, width - 3, 5, 3);
    board.lineStyle(1, stroke, 0.28).lineBetween(-width / 2 + 3, -14, width / 2 - 3, -14);
    board.fillStyle(stroke, 0.8).fillCircle(-width / 2 + 4, -18.5, 1).fillCircle(width / 2 - 4, -18.5, 1);
    const shadow = this.shadow(x, y, 22, 8, 0.25);
    const sign = this.add.container(point.x, point.y, [post, board, caption]).setDepth(point.y + 2);
    sign.once(Phaser.GameObjects.Events.DESTROY, () => shadow.destroy());
    return sign;
  }

  /** Rope rails between the bank posts, intermediate posts, lanterns and a green OPEN sign. */
  private addRepairedDecor(animate: boolean) {
    const rails = this.add.graphics();
    const lanterns: Phaser.GameObjects.GameObject[] = [];
    const postXs = [862, 908, 954, 1000, 1046, 1092];
    for (const railY of [752, 868]) {
      const top = postXs.map((x) => { const p = projectPoint(x, railY); return { x: p.x, y: p.y - 26 }; });
      const base = postXs.map((x) => projectPoint(x, railY));
      rails.lineStyle(3, 0x4a321a, 1);
      for (let i = 0; i < top.length - 1; i++) {
        const mid = { x: (top[i].x + top[i + 1].x) / 2, y: (top[i].y + top[i + 1].y) / 2 + 4 };
        rails.beginPath().moveTo(top[i].x, top[i].y).lineTo(mid.x, mid.y).lineTo(top[i + 1].x, top[i + 1].y).strokePath();
      }
      rails.lineStyle(1, 0xe0b878, 0.9);
      for (let i = 0; i < top.length - 1; i++) {
        const mid = { x: (top[i].x + top[i + 1].x) / 2, y: (top[i].y + top[i + 1].y) / 2 + 3 };
        rails.beginPath().moveTo(top[i].x, top[i].y - 1).lineTo(mid.x, mid.y - 1).lineTo(top[i + 1].x, top[i + 1].y - 1).strokePath();
      }
      postXs.forEach((_x, i) => {
        if (i !== 0 && i !== postXs.length - 1) { rails.fillStyle(0x6b4a26, 1).fillRect(base[i].x - 2, base[i].y - 26, 4, 28); }
        else {
          const glow = this.add.ellipse(top[i].x, top[i].y - 5, 18, 18, 0xffd36b, 0.28).setDepth(base[i].y + 3);
          const lamp = this.add.circle(top[i].x, top[i].y - 5, 3, 0xffe9a0).setStrokeStyle(1, 0x7a5326).setDepth(base[i].y + 3.1);
          this.tweens.add({ targets: glow, alpha: 0.12, scale: 1.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          // After dark each lantern also throws a soft additive halo that stays bright above the night tint.
          const halo = this.add.image(top[i].x, top[i].y - 5, 'paint-glow-warm').setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setDepth(GLOW_DEPTH - 3).setAlpha(0);
          this.lanternHalos.push({ img: halo, phase: i * 1.3 + railY });
          lanterns.push(glow, lamp, halo);
        }
      });
    }
    rails.setDepth(projectPoint(980, 800).y + 1);
    const sign: Phaser.GameObjects.Container = this.addSign(BRIDGE_SIGN.x, BRIDGE_SIGN.y, 'OPEN', 0x7fbf6a, 0x2f5f2f, '#1d3f22');
    this.bridgeRepairedDecor.push(rails, sign, ...lanterns);
    void animate;
    if (animate) {
      [rails, sign].forEach((object) => {
        object.setAlpha(0);
        this.tweens.add({ targets: object, alpha: 1, duration: 500 });
      });
    }
    this.addCrossingChevrons();
  }

  /** Gold arrows along the deck, pointing east, while the bridge is repaired but not yet crossed. */
  private addCrossingChevrons() {
    this.bridgeChevrons.forEach((chevron) => chevron.destroy());
    this.bridgeChevrons = [];
    if (this.quest.stage !== 'bridge-repaired') return;
    const d = { x: 0.894, y: 0.447 }, n = { x: -0.447, y: 0.894 };
    [880, 940, 1000, 1060].forEach((x, index) => {
      const p = projectPoint(x, 816);
      const arrow = this.add.graphics().setDepth(p.y + 0.8);
      arrow.fillStyle(0xffe08a, 0.95);
      arrow.fillTriangle(p.x + d.x * 8, p.y + d.y * 8, p.x - d.x * 5 + n.x * 6, p.y - d.y * 5 + n.y * 6, p.x - d.x * 5 - n.x * 6, p.y - d.y * 5 - n.y * 6);
      this.tweens.add({ targets: arrow, alpha: { from: 0.25, to: 1 }, duration: 600, yoyo: true, repeat: -1, delay: index * 160 });
      this.bridgeChevrons.push(arrow);
    });
  }

  /** The repair itself: planks drop in one by one, then rails, lanterns and the OPEN sign appear. */
  private playRepairAnimation() {
    this.bridgeSlots.forEach((slot) => { slot.pulse?.stop(); slot.ghost?.destroy(); slot.ghost = undefined; });
    this.bridgeDecor.forEach((object) => object.destroy());
    this.bridgeDecor = [];
    this.bridgeSlots.forEach((slot, index) => {
      const plank = this.freshPlank(slot.x, slot.y);
      const rest = plank.y;
      plank.setAlpha(0).setY(rest - 30);
      slot.plank = plank;
      this.tweens.add({
        targets: plank, alpha: 1, y: rest, duration: 320, delay: index * 150, ease: 'Back.Out',
        // The plank lands a moment after it starts to fall: knock, splash and sparkles on impact.
        onStart: () => this.time.delayedCall(230, () => this.onPlankLanded(slot, index)),
      });
    });
    const finish = this.bridgeSlots.length * 150 + 360;
    this.time.delayedCall(finish, () => {
      this.addRepairedDecor(true);
      const deck = projectPoint(riverCenterX(800), 800);
      this.audio.fanfare();
      this.fx.sparkleBurst(deck.x, deck.y - 26, 18);
    });
    return finish + 500;
  }

  /** Every plank knocks; alternate ones send up a big splash so the river reacts without turning into a storm. */
  private onPlankLanded(slot: BridgeSlot, index: number) {
    const point = projectPoint(slot.x, slot.y);
    const big = index % 2 === 0;
    this.audio.plank();
    this.audio.splash(big ? 0.85 : 0.5, big ? 'big' : 'small');
    this.fx.splash(point.x, point.y, big ? 'big' : 'small');
    this.fx.sparkleBurst(point.x, point.y - 10, 6);
  }

  private isBridgeGapColumn(plankX: number, centerX: number) {
    // Leave a visible gap across the full deck while the bridge is broken.
    return Math.abs(plankX + 32 - centerX) <= 64;
  }

  private attachBridgeBlocker() {
    if (this.bridgeBarrier) this.bridgeBarrierCollider = this.physics.add.collider(this.player, this.bridgeBarrier);
  }

  private addInteractionRings() {
    const lina = projectPoint(LINA_POS.x, LINA_POS.y + 10);
    const linaSize = ringSize(78);
    this.linaRing = this.add.ellipse(lina.x, lina.y, linaSize.width, linaSize.height).setStrokeStyle(2, UI.gold, 0.9).setFillStyle(UI.gold, 0.07).setDepth(-4).setAlpha(0);
    const bridge = projectPoint(riverCenterX(800), 800);
    const bridgeSize = ringSize(160);
    this.bridgeRing = this.add.ellipse(bridge.x, bridge.y, bridgeSize.width, bridgeSize.height).setStrokeStyle(2, UI.gold, 0.9).setFillStyle(UI.gold, 0.05).setDepth(-4).setAlpha(0);
  }

  private updateRings(time: number) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 280);
    const nearLina = Phaser.Math.Distance.Between(this.player.x, this.player.y, LINA_POS.x, LINA_POS.y) < 180;
    const linaTarget = this.quest.stage === 'unstarted' || nearLina ? 0.45 + pulse * 0.4 : 0;
    this.linaRing.setAlpha(Phaser.Math.Linear(this.linaRing.alpha, linaTarget, 0.12));
    const stage = this.quest.stage;
    const bridgeTarget = stage === 'collecting' ? (this.quest.canRepairBridge ? 0.5 + pulse * 0.5 : 0.18 + pulse * 0.12) : 0;
    this.bridgeRing.setAlpha(Phaser.Math.Linear(this.bridgeRing.alpha, bridgeTarget, 0.12));
  }

  // ---------------------------------------------------------------- characters & items

  private addTrailKeeper() {
    const point = projectPoint(LINA_POS.x, LINA_POS.y);
    this.add.image(point.x, point.y + LINA_FOOT_DY, 'paint-shadow').setScale(0.34).setDepth(point.y + LINA_FOOT_DY);
    // Lina is the Adventurer idle_west frame recoloured teal at boot, so she never reads as a copy of the hero.
    this.linaSprite = this.add.sprite(point.x, point.y + LINA_FOOT_DY, LINA_KEY).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setDepth(point.y + LINA_FOOT_DY + 1);
    this.applyHeroLod();
    const name = new Pill(this, point.x, point.y + 38, 10, UI.goldCss, 8, 3).setLabel('LINA').setDepth(point.y + 30);
    name.setAlpha(0.95);
    const marker = this.linaMarker = this.add.container(point.x, point.y - 44, [
      this.add.circle(0, 0, 9, UI.gold).setStrokeStyle(2, 0xfff1c9),
      this.add.text(0, -1, '!', textStyle(12, '#264a36', true)).setOrigin(0.5),
    ]).setDepth(point.y + 40);
    this.tweens.add({ targets: marker, y: point.y - 49, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private addTimberCollectibles() {
    TIMBER_POSITIONS.forEach(([x, y], index) => {
      if (isRiverCell(x, y) || isBridgeZone(x, y)) return;
      const id = `timber-${String(index + 1).padStart(2, '0')}`;
      if (this.quest.hasCollected(id)) return;
      const point = projectPoint(x, y);
      this.timberShadows.set(id, this.shadow(x, y + 4, 38, 11, 0.3));
      const glow = this.add.ellipse(point.x, point.y + 3, 46, 20, 0xffe08a, 0.3).setDepth(point.y + 19).setVisible(false);
      this.tweens.add({ targets: glow, alpha: 0.12, scaleX: 1.15, duration: 800 + (index % 4) * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const plank = this.add.image(point.x, point.y, 'paint-log').setScale(0.5 / OBJ)
        .setRotation(FLAT_ROTATION + ((index % 3) - 1) * 0.1).setDepth(point.y + 20).setData({ worldX: x, worldY: y });
      this.tweens.add({ targets: plank, y: point.y - 1.5, duration: 850 + (index % 4) * 100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.timberSprites.set(id, plank);
      this.timberGlows.set(id, glow);
    });
  }

  // ---------------------------------------------------------------- interaction

  private touchMode() { return this.touch?.enabled ?? false; }

  private showDialogue(speaker: string, pages: string[]) {
    this.hud.hidePrompt();
    this.dialogue.show(speaker, pages, this.touchMode());
  }

  private updateInteractionPrompt() {
    const px = this.player.x, py = this.player.y;
    const action = actionLabel(this.touchMode());
    type Candidate = { target: string; distance: number; prompt: string; x: number; y: number; lift: number };
    let nearest: Candidate | undefined;
    const consider = (candidate: Candidate) => {
      const reach = candidate.target === 'bridge' ? 160 : 78;
      if (candidate.distance <= reach && (!nearest || candidate.distance < nearest.distance)) nearest = candidate;
    };
    consider({ target: 'npc', distance: Phaser.Math.Distance.Between(px, py, LINA_POS.x, LINA_POS.y), prompt: talkPrompt(action), x: LINA_POS.x, y: LINA_POS.y, lift: 74 });
    if (this.quest.stage !== 'unstarted') {
      for (const [id, sprite] of this.timberSprites) {
        const wx = sprite.getData('worldX') as number, wy = sprite.getData('worldY') as number;
        consider({ target: id, distance: Phaser.Math.Distance.Between(px, py, wx, wy), prompt: timberPrompt(action), x: wx, y: wy, lift: 36 });
      }
    }
    const bridgeX = riverCenterX(py);
    consider({
      target: 'bridge', distance: Phaser.Math.Distance.Between(px, py, bridgeX, 800),
      prompt: bridgePrompt(this.quest.stage, this.quest.canRepairBridge, this.quest.timberCount, TIMBER_GOAL, action),
      x: riverCenterX(800), y: 800, lift: 92,
    });
    const found = nearest as Candidate | undefined;
    this.nearbyTarget = found?.target ?? null;
    // On touch layouts the prompt floats beside the character it is about; on desktop it stays docked.
    const anchor = found ? (() => { const p = projectPoint(found.x, found.y); return { x: p.x, y: p.y - found.lift }; })() : undefined;
    this.hud.setPrompt(found?.prompt ?? null, anchor);
    const actionable = this.nearbyTarget !== null && !(this.nearbyTarget === 'bridge' && !this.quest.canRepairBridge && this.quest.stage !== 'unstarted' && this.quest.stage !== 'collecting');
    this.touch.setReady(actionable);
  }

  private interact() {
    if (this.nearbyTarget === 'npc') {
      if (this.quest.start()) {
        this.refreshQuestHud();
        this.showDialogue(text.LINA, text.linaIntro);
      } else if (this.quest.stage === 'collecting' && this.quest.canRepairBridge) {
        this.showDialogue(text.LINA, text.linaReady);
      } else if (this.quest.stage === 'collecting') {
        this.showDialogue(text.LINA, text.linaProgress(this.quest.timberCount));
      } else {
        this.showDialogue(text.LINA, text.linaDone);
      }
      return;
    }
    if (typeof this.nearbyTarget === 'string' && this.nearbyTarget.startsWith('timber-')) {
      const id = this.nearbyTarget;
      const item = this.timberSprites.get(id);
      if (!item || !this.quest.collect(id)) return;
      const collected = this.quest.timberCount;
      this.timberSprites.delete(id);
      const glow = this.timberGlows.get(id);
      this.timberGlows.delete(id);
      glow?.destroy();
      this.timberShadows.get(id)?.destroy();
      this.timberShadows.delete(id);
      this.tweens.add({ targets: item, alpha: 0, scale: 0.1, angle: item.angle + 100, duration: 260, onComplete: () => item.destroy() });
      this.addCollectionSpark(item.getData('worldX') as number, item.getData('worldY') as number);
      this.audio.pickup(collected);
      this.heroPop();
      this.refreshQuestHud();
      this.hud.toast(collected === TIMBER_GOAL ? '12/12 timber! The bridge is ready to repair!' : `Timber collected  ·  ${collected}/${TIMBER_GOAL}`);
      this.updateInteractionPrompt();
      return;
    }
    if (this.nearbyTarget === 'bridge') {
      if (this.quest.canRepairBridge) {
        if (!this.quest.repairBridge()) return;
        this.bridgeBarrierCollider?.destroy();
        this.bridgeBarrier?.destroy();
        this.bridgeBarrier = undefined;
        this.hud.hidePrompt();
        this.refreshQuestHud();
        this.repairBusy = true;
        const wait = this.playRepairAnimation();
        this.time.delayedCall(wait, () => {
          this.repairBusy = false;
          this.showDialogue(text.BRIDGE_REPAIRED, text.bridgeRepairedPages);
        });
      } else if (this.quest.stage === 'collecting') {
        this.showDialogue(text.BRIDGE_BROKEN, text.bridgeNeedsTimber(TIMBER_GOAL - this.quest.timberCount));
      } else if (this.quest.stage === 'unstarted') {
        this.showDialogue(text.BRIDGE_BROKEN, text.bridgeNeedsLina);
      }
    }
  }

  private handleActionKey() {
    if (this.time.now - this.lastActionTime < 220) return;
    this.lastActionTime = this.time.now;
    if (this.dialogue.open) this.dialogue.advance();
    else this.interact();
  }

  private handleKeyboardInput(event: KeyboardEvent) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'e' || key === ' ' || key === 'spacebar') this.handleActionKey();
    if (key === 'm') {
      const muted = this.audio.toggleMuted();
      if (!muted) this.audio.click();
      this.hud.toast(muted ? 'Sound off  ·  press M to turn it on' : 'Sound on');
    }
  }

  private addCollectionSpark(x: number, y: number) {
    const point = projectPoint(x, y - 12);
    this.fx.sparkleBurst(point.x, point.y, 10);
  }

  /** A quick squash-and-stretch on the hero when something is picked up. */
  private heroPop() {
    const base = this.heroBaseScale();
    this.tweens.killTweensOf(this.playerVisual);
    this.playerVisual.setScale(base);
    this.tweens.add({ targets: this.playerVisual, scaleX: base * 1.12, scaleY: base * 0.9, duration: 90, yoyo: true, ease: 'Sine.Out', onComplete: () => this.playerVisual.setScale(base) });
  }

  private onFootstep(foot: Foot, bridgeRepaired: boolean) {
    const x = this.player.x, y = this.player.y + 15;
    const surface = surfaceAt(x, y, this.trail, bridgeRepaired);
    const point = projectPoint(x, y);
    this.audio.step(surface);
    this.fx.dust(point.x, point.y, surface, foot);
  }

  private refreshQuestHud() {
    this.hud.setState({
      objective: objectiveLabel(this.quest.stage, this.quest.canRepairBridge),
      timber: this.quest.timberCount, goal: TIMBER_GOAL, xp: this.quest.xp,
    });
    this.updateBridgeProgress();
    this.updateBridgeSign();
    // The "!" invites the player to meet Lina; once the quest is running it would only be visual noise.
    this.linaMarker?.setVisible(this.quest.stage === 'unstarted');
    this.updatePile(true);
    if (this.quest.stage === 'complete') this.addCrossingChevrons();
    // The collectible timber only glows once Lina has asked for it.
    for (const glow of this.timberGlows.values()) glow.setVisible(this.quest.stage === 'collecting');
  }

  // ---------------------------------------------------------------- misc

  /** Sun shafts through the canopy and a gentle colour grade. Purely decorative; gameplay never reads these. */
  private addLighting() {
    const random = seededRandom(1717);
    const spots = this.profile.tier === 'lite' ? 4 : 7;
    for (let i = 0; i < spots; i++) {
      const x = 120 + random() * (ISO_WIDTH - 240), y = 80 + random() * (ISO_HEIGHT - 200);
      const img = this.add.image(x, y, 'paint-shaft').setBlendMode(Phaser.BlendModes.ADD).setRotation(-0.55).setScale(0.55 + random() * 0.5, 0.9 + random() * 0.6)
        .setDepth(18000).setAlpha(0.05);
      // Driven by hand (see updateLights) so the shafts fade away with the daylight instead of glowing at night.
      this.shafts.push({ img, period: 2 * (3200 + random() * 2600), phase: (random() * 3000 / 1000) });
    }
    const cam = this.cameras.main;
    if (cam.postFX) {
      const grade = cam.postFX.addColorMatrix();
      grade.saturate(0.1, true);
      grade.contrast(0.08, true);
    }
  }

  private addFireflies() {
    const random = seededRandom(3301);
    for (let i = 0; i < this.profile.fireflies; i++) {
      const x = 70 + random() * (WORLD_WIDTH - 140), y = 30 + random() * (WORLD_HEIGHT - 60);
      if (isRiverCell(x, y)) continue;
      const point = projectPoint(x, y);
      const mote = this.add.circle(point.x, point.y, i % 4 === 0 ? 2 : 1.3, i % 3 === 0 ? 0xffe88f : 0xe5f5ad, 0.32).setDepth(point.y + 60);
      this.tweens.add({ targets: mote, alpha: { from: 0.14, to: 0.65 }, scale: { from: 0.8, to: 1.25 }, duration: 1600 + (i % 5) * 260, yoyo: true, repeat: -1, delay: (i * 173) % 1800 });
    }
  }

  /** The timber you have gathered is stacked beside the bridge, so progress is visible in the world. */
  private updatePile(animate: boolean) {
    const target = this.bridgeIsRepaired ? 0 : this.quest.timberCount;
    const base = projectPoint(TIMBER_PILE.x, TIMBER_PILE.y);
    if (target > 0 && this.pileObjects.length === 0) {
      this.pileObjects.push(this.shadow(TIMBER_PILE.x, TIMBER_PILE.y + 4, 58, 20, 0.3));
    }
    const rows = [4, 3, 3, 2];
    const slot = (index: number) => {
      let row = 0, rest = index;
      while (rest >= rows[row]) { rest -= rows[row]; row++; }
      const spread = rest - (rows[row] - 1) / 2;
      return { x: base.x + spread * 11, y: base.y + spread * 5.5 - row * 6, depth: base.y + 1 + row * 0.2 + rest * 0.01 };
    };
    while (this.pileLogs.length < target) {
      const at = slot(this.pileLogs.length);
      const log = this.add.image(at.x, at.y, 'paint-log').setScale(animate ? 0.1 / OBJ : 0.42 / OBJ).setRotation(FLAT_ROTATION).setDepth(at.depth);
      if (animate) this.tweens.add({ targets: log, scale: 0.42 / OBJ, duration: 260, ease: 'Back.Out' });
      this.pileLogs.push(log);
    }
    if (this.pileLogs.length > target) {
      const spent = this.pileLogs.splice(0);
      spent.forEach((log, index) => this.tweens.add({ targets: log, alpha: 0, y: log.y - 10, duration: 300, delay: index * 60, onComplete: () => log.destroy() }));
      this.pileObjects.forEach((object) => object.destroy());
      this.pileObjects = [];
    }
  }

  private drawVignette() {
    const { width, height } = getLayout(this);
    const k = Math.min(width, height) / 600;
    this.vignette.resize(width, height);
    this.vignette.clear();
    const brush = this.vignetteBrush.clear();
    for (let i = 0; i < 9; i++) {
      brush.lineStyle(14 * k, 0x0a2418, 0.05 * (1 - i / 9)).strokeRect(i * 7 * k, i * 7 * k, width - i * 14 * k, height - i * 14 * k);
    }
    // Painted once per layout instead of re-tessellating nine stroked rectangles every frame.
    this.vignette.draw(brush);
  }

  /** Zoom and framing come from the tested layout maths; nothing here depends on a fixed design size. */
  private applyCameraLayout() {
    const layout = getLayout(this);
    const cam = this.cameras.main;
    cam.setZoom(layout.worldZoom);
    cam.setFollowOffset(0, followOffsetY(layout));
    this.heroLod = pickHeroLod(layout.worldZoom);
    this.applyHeroLod();
  }

  private releaseInputs() {
    this.touch?.release();
    this.input.keyboard?.resetKeys();
    (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
  }

  /** Whether the hero's feet (the physics body) could stand `dx, dy` away from where they are now. */
  private footprintFits(dx: number, dy: number, bridgeRepaired: boolean) {
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const left = b.left + dx, right = b.right + dx, top = b.top + dy, bottom = b.bottom + dy;
    return canOccupyWorldPoint(left, top, bridgeRepaired) && canOccupyWorldPoint(right, top, bridgeRepaired)
      && canOccupyWorldPoint(left, bottom, bridgeRepaired) && canOccupyWorldPoint(right, bottom, bridgeRepaired);
  }

  /** The hero is drawn from the half-size atlas when it is shown at half size or less on the device (smoother walking). */
  private heroBaseScale() { return this.heroLod === 'lo' ? HERO_SCALE * 2 : HERO_SCALE; }

  private applyHeroLod() {
    const scale = this.heroBaseScale();
    this.playerVisual?.setScale(scale);
    this.linaSprite?.setTexture(this.heroLod === 'lo' ? LINA_LO_KEY : LINA_KEY).setScale(scale);
  }

  private syncVisual() {
    const visual = this.playerVisual;
    // The hero is drawn standing on its collision footprint so what you see is what collides.
    const foot = projectPoint(this.player.x, this.player.y + FOOT_WORLD_DY);
    visual.setPosition(foot.x, foot.y).setDepth(foot.y + 1);
    // Only touch the texture when the facing, frame or atlas resolution actually changed.
    const atlas = HERO_ATLAS_KEY(this.heroLod), frame = this.player.frameName;
    if (visual.texture.key !== atlas || visual.frame.name !== frame) visual.setTexture(atlas, frame);
    this.playerShadow.setPosition(foot.x - 2, foot.y + 1).setDepth(foot.y);
  }

  /** Day-night, creatures, lights and the ambience mix. Cosmetic only: nothing here is read by gameplay. */
  private updateAlive(time: number, dt: number) {
    const tod = this.dayNight.update(dt, this.cameras.main.worldView);
    this.ambient.update(time, dt, tod);
    this.updateLights(time, tod);
    this.audioClock += dt;
    if (this.audioClock >= 250) {
      this.audioClock = 0;
      this.audio.setAmbience({ river: riverVolume(distanceToRiver(this.player.x, this.player.y)), night: tod.night, daylight: tod.daylight, gust: gustLevel(time) });
    }
  }

  /** Sun shafts follow the daylight; lantern halos follow the dark. */
  private updateLights(time: number, tod: TimeOfDay) {
    const day = tod.daylight * tod.daylight;
    for (const shaft of this.shafts) shaft.img.setAlpha((0.05 + 0.15 * (0.5 + 0.5 * Math.sin((time / shaft.period) * Math.PI * 2 + shaft.phase))) * day);
    for (const halo of this.lanternHalos) {
      halo.img.setVisible(tod.night > 0.02).setAlpha(Math.min(1, tod.night * 0.65 * (0.85 + 0.15 * Math.sin(time / 260 + halo.phase))));
    }
  }

  /** Butterflies live around the flowering bushes: a few right by the start so they are seen early, the rest spread through the forest. */
  private butterflyHomes(plan: ForestPlan) {
    const flowering = plan.bushes.filter((bush) => bush.flower > 0).map((bush) => ({ x: bush.x, y: bush.y }));
    const nearStart = [...flowering].sort((a, b) => Math.hypot(a.x - PLAYER_START.x, a.y - PLAYER_START.y) - Math.hypot(b.x - PLAYER_START.x, b.y - PLAYER_START.y));
    return [...nearStart.slice(0, 3), ...flowering.filter((_, index) => index % 5 === 0)];
  }

  private openPause() {
    this.audio.duck(true);
    this.audio.click();
    this.scene.launch('PauseScene');
    this.scene.pause();
  }
}
