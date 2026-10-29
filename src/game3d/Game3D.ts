import { ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { DEFAULT_OUTFIT, type Outfit } from '../game/art/parts';
import { gustLevel } from '../game/systems/wind';
import { isOff } from '../game/systems/features';
import { OUTFIT_STORAGE_KEY, loadOutfit, saveOutfit } from '../game/systems/outfitStore';
import { TEXT, loadLang, objectiveLine, questToast, saveLang, type Lang } from './data/woodsText';
import { parseTimeOfDay, timeOfDayAt } from '../game/systems/dayNight';
import { Input3D } from './input/Input3D';
import { EnemyManager, type EnemyEntry } from './render/EnemyManager';
import type { EnemyCue } from './render/Characters';
import { clamp01 } from './systems/charAnim';
import { Fx3D } from './render/Fx3D';
import { HeroModel } from './render/HeroModel';
import { HeroSnapshot } from './render/HeroSnapshot';
import { ItemThumbs } from './render/ItemThumbs';
import { ElderModel, GlimModel, PetalView, RuneStoneModel } from './render/Characters';
import { Fireflies3D } from './render/Fireflies3D';
import { Butterflies3D } from './render/Butterflies3D';
import { buildWorld, type BuiltWorld } from './render/WorldBuilder';
import { SETTINGS, initialQuality, nextQuality, outlineWanted, type Quality } from './systems/quality';
import { castShadows } from './render/common';
import { Sfx3D } from './Sfx3D';
import { initialPixelRatio, nextPixelRatio } from './systems/adaptiveRes';
import { COMBAT, PlayerCombat, PlayerVitals, inAttackArc, inRadius, type CombatAction } from './systems/combat';
import { shapeHits, type EnemyEvent, type EnemyKind, type Shape } from './systems/enemies';
import { hollowCheckpoint, hollowSpawns, hollowTargetAt, type HollowTarget } from './systems/hollowEncounters';
import {
  ARENA_ENTRANCE, BOSS_POS, ELDER_POS, MOONLIT_GATE_TRIGGER, PETAL_SPOTS, RUNE_STONE_POS, RUNE_STONE_RANGE, SPAWN, SPROUT_SPOTS,
} from './systems/layout3d';
import { fireflyLevel, lampLevel, lookForPhase, phaseAt } from './systems/lighting3d';
import { pickPreviewYaw, previewDistance, previewPoseInput, previewShift, type PreviewPose } from './systems/wardrobeCam';
import {
  MIN_CAMERA_RATIO, blockedCameraPitch, cameraPreset, cameraRelativeVelocity, clampDeltaSeconds, followCameraOffset, headingOf, smoothingFactor, speedForInput, turnToward, wrapAngle,
} from './systems/movement3d';
import { resolveOutfitColors } from './systems/outfit3d';
import { equip as equipItem, grant, loadCosmetics, resetLook, sanitizeCosmetics, saveCosmetics, setTint, newlyOwned, type CosmeticsState, type OwnershipContext } from './cosmetics/inventory';
import { itemById, type CosmeticSlot } from './cosmetics/catalog';
import { resolveLoadout } from './cosmetics/loadout';
import { resolveCircles, rayClearDistance } from './systems/colliders';
import {
  BONUS_XP_CAP, PETALS_NEEDED, SPROUTS_NEEDED, levelForXp, loadProgress, newProgress, reduceQuest, saveProgress, xpIntoLevel, type Progress, type QuestEvent, type WoodsStage,
} from './systems/woodsQuest';
import { PLAY_RADIUS, heightAt } from './systems/worldShape';
import { WildsWorld } from './render/WildsWorld';
import { WILDS_TEXT } from './data/wildsText';
import {
  ACORN_COUNT, ACORN_XP, LANTERN_COUNT, PEARL_COUNT, PUMPKIN_COUNT, TABLET_COUNT as WILDS_TABLET_COUNT, asked as wildsAsked, claim as wildsClaim, collectAcorn, collectPearl, collectPumpkin, discoverZone, errandCount, exploredShare,
  lightLantern, loadWilds, markExplored, newWilds, openChest, readTablet as readWildsTablet, saveWilds, script as wildsScript, thornsOpen, zoneAt, CHEST_COUNT_, WHO, type Who, type WildsState,
} from './systems/wildsQuest';
import { ACORN_SPOTS, CHEST_SPOTS, LANTERN_SPOTS, MIST_GATE, PEARL_SPOTS, PEOPLE, PUMPKIN_SPOTS, SIGN_SPOTS, TABLET_SPOTS as WILDS_TABLET_SPOTS, UNDERCROFT_DOOR, ZONES, zoneById } from './systems/expansion';
import { ColliderGrid } from './systems/colliders';
import { Hud3D } from './ui/Hud3D';
import { HollowWorld, ECHO_HEX, HOLLOW_LOOK } from './render/HollowWorld';
import {
  DOOR_POS, ECHO_COLORS, ECHO_SPOTS, GLIM_POS, GLIM_RANGE, GLOWCAP_RANGE, GLOWCAP_SPOTS, HEART_POS, HOLLOW_EXIT, HOLLOW_SPAWN, MURAL_POS, MURAL_RANGE, SECRET_COLLIDERS, SHARD_RANGE, SHARD_SPOTS, TABLET_SPOTS,
  clampToArena, clampToFloor, floorRayClear, type EchoColor,
} from './systems/hollowLayout';
import {
  GLOWCAP_COUNT, SHARDLING_COUNT, SHARD_COUNT, TABLET_COUNT, calmShardling, collectShard, defeatWarden, glimAsked, glimClaim, glimScript, lightGlowcap, loadHollow, markVisited, newHollow, readTablet, saveHollow, secretOpen,
  strikeEcho, touchHeart, wardenAwake, type HollowState,
} from './systems/hollowQuest';
import { HOLLOW_TEXT, hollowFill, hollowObjective, orderText } from './data/hollowText';
import { ShoreWorld, BUOY_HEX } from './render/ShoreWorld';
import { ShoreNpc } from './render/ShoreViews';
import { Group, Mesh, TorusGeometry } from 'three';
import { Kit, M, mat } from './render/env/Structures';
import { glowSprite } from './render/common';
import { singularHour, SHORE_TEXT, ebbText, floodText, shoreFill, shoreObjective } from './data/shoreText';
import {
  BOARD_RANGE, BUOYS as SHORE_BUOYS, BUOY_SPOTS, GLASS_RANGE, GLASS_SPOTS, KEEPER_POS, LAMP_POS, MAK_POS, SHORE_EXIT, SHORE_SPAWN, TIDE_BOARD_POS, BOTTLE_SPOTS,
  clampToArena as clampShoreArena, clampToFloor as clampShoreFloor, floorRayClear as shoreRayClear, onFloor as onShoreFloor, type BuoyId,
} from './systems/shoreLayout';
import {
  BOTTLE_COUNT, CRAB_COUNT, GLASS_COUNT, GULL_COUNT, calmCrab, calmGull, causewayOpen, collectGlass, defeatHeron, gatesOf, keeperAsked, keeperClaim, keeperScript, lightLamp, loadShore, makAsked, makClaim,
  makScript, newShore, readBottle, ringBuoy, saveShore, tideSolved, type ShoreState,
} from './systems/shoreQuest';
import { shoreCheckpoint, shoreSpawns, shoreTargetAt, type ShoreTarget } from './systems/shoreEncounters';
import { shoreTargets } from './systems/shoreMap';
import { makeClockSum } from './systems/shoreRiddles';
import { hollowTargets } from './systems/hollowMap';
const PORTRAIT_PX = 160;
/** Post-quest sprout patrol: at most this many at once, and a new one this many seconds after the last appeared. */
const PATROL_MAX = 2, PATROL_RESPAWN_S = 9;
import { PuzzlePanel } from './ui/PuzzlePanel';
import { loadLearning, planRun, recordResult, recordStart, saveLearning, type LearningProfile } from './learning/profile';
import type { DialogueQuestion } from './ui/Hud3D';
import { answerText, explain, makePlannedRun, makeSum, pickFresh, type Riddle } from './systems/runePuzzle';
import { explanationText, fill } from './data/woodsText';
import { CosmeticsPanel } from './ui/CosmeticsPanel';
import { MapPanel } from './ui/MapPanel';
import { HeroPanel, type HeroTab } from './ui/HeroPanel';
import { objectiveProgress } from './systems/hudData';
import { questTargets } from './systems/mapView';

/** The 3D hero starts with turquoise hair (the Teal swatch). Players who already saved a look keep it; the shared 2D default is unchanged. */
const HERO_START_OUTFIT: Outfit = { ...DEFAULT_OUTFIT, hood: 5 };
const initialOutfit = (): Outfit => { try { return localStorage.getItem(OUTFIT_STORAGE_KEY) === null ? { ...HERO_START_OUTFIT } : loadOutfit(); } catch { return { ...HERO_START_OUTFIT }; } };
const HERO_RADIUS = 0.38;
const TALK_RANGE = 3.4;
const PETAL_RANGE = 1.35;
/** The preset distances in movement3d.ts are tuned for a 1.2 m hero; this pulls the camera back a little so the village and trail read better. */
const CAMERA_DISTANCE_SCALE = 1.0;
/** How quickly the camera catches up with the hero (per second): higher = tighter. Vertical is softer so hills do not bob the picture. */
const FOLLOW_RATE = 10;
const FOLLOW_RATE_Y = 5;

/** What decides which cosmetics the player owns: hero level (from XP) and quest rewards. */
const ownershipOf = (p: Progress): OwnershipContext => ({ level: levelForXp(p.xp), unlocked: p.unlocked });

/** The colour of the chips that fly off each kind of creature when it is struck. */
const CHIP_COLOR: Readonly<Record<EnemyKind, number>> = { sprout: 0xa6e870, mossback: 0xb8c0a8, shardling: 0xbfe6ff, warden: 0xc59bff, crab: 0xb8b2a4, gull: 0xc9d0e0, heron: 0xbff4ff };
/** Where the woods' driftwood arch to Moonwake Shore stands (on the east side of the village square, the one clear patch left in the crowded woods), and the circle that carries the hero through it. */
const SHORE_ARCH = { x: 7.4, z: 19 }, SHORE_ARCH_TRIGGER = { x: 6.2, z: 19, r: 1.4 };

export class Game3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 280);
  private readonly world: BuiltWorld;
  private readonly fx: Fx3D;
  private readonly hero = new HeroModel();
  /** v2.20: real pictures of the 3D hero: the HUD portrait and the wardrobe item thumbnails. */
  private snap!: HeroSnapshot; private thumbs!: ItemThumbs; private portraitDirty = true; private portraitWait = 0;
  private outlineOverride: string | null = null;
  private readonly elder = new ElderModel();
  /** v2.28: Glim the lantern sprite, who floats in the Lantern Cavern (shown only in the Hollow). */
  private readonly glim = new GlimModel();
  private glimFacing = 0; private glimGreeted = false; private weakTipShown = false; private wardenAnnounced = false;
  /** Who the hero is facing during a conversation (the Elder when null; Glim or a tablet in the Hollow). */
  private talkAt: { x: number; z: number } | null = null; private talkWho: 'glim' | 'tablet' | 'mak' | 'keeper' | 'bottle' | 'wilds' | null = null;
  /** v2.31 The wider woods: its own save, its world (a child of the woods world, so it hides with it), the thorn barrier and the short-lived dialogue/save timers. */
  wilds: WildsState = loadWilds();
  private wildsWorld!: WildsWorld; private thornGrid = new ColliderGrid([]); private wildsTalkWho: Who | null = null; private wildsSaveT = 0; private wildsExploreT = 0; private wildsTipShown = false;
  private readonly runeStone = new RuneStoneModel();
  private fireflies!: Fireflies3D;
  private butterflies!: Butterflies3D;
  private puzzle!: PuzzlePanel;
  /** What practice has shown so far (counters only, saved on this device); it chooses the next riddles. */
  private learning: LearningProfile = loadLearning();
  private wardrobe!: CosmeticsPanel;
  private map!: MapPanel;
  private heroPanel!: HeroPanel;
  private outfit: Outfit = initialOutfit();
  private readonly sfx = new Sfx3D();
  private readonly hud: Hud3D;
  private readonly input: Input3D;
  private readonly combat = new PlayerCombat();
  private readonly vitals = new PlayerVitals(5);
  private readonly chars: EnemyManager;
  private petals: PetalView[] = [];
  private lang: Lang = loadLang();
  progress: Progress = loadProgress();
  /** v2.22 Crystal Hollow: its own save, which area the hero is in, and the short-lived puzzle state (not saved). */
  hollow: HollowState = loadHollow();
  /** v2.29 Moonwake Shore: its own save, its world (built the first time), its two people and the short-lived bell state (not saved). */
  shore: ShoreState = loadShore();
  private shoreWorld: ShoreWorld | null = null;
  private readonly mak = new ShoreNpc('mak'); private readonly keeper = new ShoreNpc('keeper');
  private makFacing = 0; private keeperFacing = 0; private makGreeted = false; private keeperGreeted = false;
  private ringAttempt: BuoyId[] = []; private ringCool = 0; private boardSeen = false; private shellTipShown = false; private heronAnnounced = false; private lastBellWrong = 0;
  private cameFrom: 'hollow' | 'shore' = 'hollow';
  private area: 'woods' | 'hollow' | 'shore' = 'woods';
  private hollowWorld: HollowWorld | null = null;
  private echoStep = 0; private echoCool = 0; private muralSeen = false; private portalArmed = false; private lastWrongToast = 0;
  private transition: { to: 'woods' | 'hollow' | 'shore'; t: number; swapped: boolean } | null = null;
  private cosmetics: CosmeticsState = loadCosmetics(ownershipOf(this.progress));
  // hero state
  pos = { x: SPAWN.x, z: SPAWN.z };
  private y = 0;
  private heading = Math.PI;
  private vel = { x: 0, z: 0 };
  private dodgeDir = { x: 0, z: -1 };
  private knock = { x: 0, z: 0 };
  private faintT: number | null = null;
  private endSeen = false;
  // camera state
  private camYaw = 0;
  private camDist = 7;
  private readonly focus = { x: 0, y: 0, z: 0, init: false };
  private shake = 0;
  /** v2.24: a directional camera punch (world x/z) that eases back: blows push the view the way they travel, not just rattle it. */
  private camKick = { x: 0, z: 0 };
  private punchCamera(dx: number, dz: number, amount: number): void {
    const l = Math.hypot(dx, dz) || 1, a = Math.min(0.4, amount);
    this.camKick.x = Math.max(-0.4, Math.min(0.4, this.camKick.x + (dx / l) * a)); this.camKick.z = Math.max(-0.4, Math.min(0.4, this.camKick.z + (dz / l) * a));
  }
  /** v2.12 combat feel: a brief near-freeze when a blow lands, the swing that last hit, the dodge afterimage clock and the spirit glow. */
  private hitStop = 0;
  /** 0..1: how much the camera is framing the boss fight (see updateEnemies). */
  private bossK = 0; private bossAt = { x: 0, z: 0 };
  private blow = { kind: 'attack' as 'attack' | 'special', step: 0 };
  private ghostTimer = 0;
  private phaseK = 0;
  private layoutName: 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop' = 'desktop';
  private elderFacing = 0;
  private time = 0;
  /** Seconds of play, which drives the day-night cycle (it stops while a menu is open). */
  private clock = 0;
  private readonly frozenPhase: number | null = isOff('daynight') ? 0 : parseTimeOfDay(location.search);
  private ambienceTimer = 0;
  // wardrobe preview
  private wardrobeK = 0; private wardrobeYaw = 0; private wardrobeHeading = 0; private wardrobeZoom = 1; private previewPose: PreviewPose = 'stand'; private previewIdle = 0;
  private lastHearts = -1;
  private dustTimer = 0; private sparkleTimer = 0;
  // performance
  private pixelRatio: number; private readonly maxRatio: number; private quality: Quality;
  /** `?debug` only: a free camera for screenshots. */
  debugCam: { from: [number, number, number]; to: [number, number, number] } | null = null;
  private fpsFrames = 0; private fpsTime = 0; private warm = 2;
  private fpsMeter: HTMLElement | null = null;
  private running = true;
  private readonly tmp = new Vector3();
  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => { if (document.hidden && !this.hud.blocking) this.setPaused(true); };
  /** Frames skipped in a row while a menu covers the game (see `frame`). */
  private menuFrame = 0;
  private readonly ro: ResizeObserver | null;

  constructor(private readonly host: HTMLElement) {
    const qs = new URLSearchParams(location.search);
    const resOverride = Number(qs.get('res')) || null;
    this.quality = initialQuality({ touch: matchMedia('(pointer: coarse)').matches, cores: navigator.hardwareConcurrency, memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, devicePixelRatio: window.devicePixelRatio, width: window.innerWidth, height: window.innerHeight }, qs.get('q'));
    this.maxRatio = Math.min(initialPixelRatio(window.devicePixelRatio, resOverride), resOverride ? 3 : SETTINGS[this.quality].maxPixelRatio);
    this.pixelRatio = this.maxRatio;
    this.renderer = new WebGLRenderer({ antialias: this.maxRatio < 2.01, powerPreference: 'high-performance', alpha: false });
    this.renderer.toneMapping = ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.className = 'mq-canvas';
    host.appendChild(this.renderer.domElement);
    this.snap = new HeroSnapshot(this.renderer, this.hero, () => this.scene.environment);
    this.thumbs = new ItemThumbs(this.snap, () => this.hero.isChibi);

    this.world = buildWorld(this.scene, this.quality);
    this.outlineOverride = qs.get('outline'); this.hero.setOutline(outlineWanted(this.quality, this.outlineOverride));
    this.hero.whenReady(() => castShadows(this.hero.root, 'hero'));
    castShadows(this.elder.root); castShadows(this.glim.root);
    this.fx = new Fx3D(this.scene);
    this.chars = new EnemyManager(this.scene, this.quality !== 'low');
    this.fireflies = new Fireflies3D(this.scene);
    this.butterflies = new Butterflies3D(this.scene, this.quality === 'high' ? 10 : this.quality === 'medium' ? 7 : 4);
    castShadows(this.mak.root); castShadows(this.keeper.root);
    this.wildsWorld = new WildsWorld(this.world.group); this.wildsWorld.setState(this.wilds); this.thornGrid = new ColliderGrid(this.world.layout.extras.thorns);
    for (const w of WHO) castShadows(this.wildsWorld.npcs[w].root);
    this.scene.add(this.hero.root, this.elder.root, this.runeStone.root, this.glim.root, this.mak.root, this.keeper.root);
    this.mak.root.position.set(MAK_POS.x, 0.02, MAK_POS.z); this.keeper.root.position.set(KEEPER_POS.x, 0.02, KEEPER_POS.z); this.mak.root.visible = this.keeper.root.visible = false; this.makFacing = Math.PI * 0.2; this.keeperFacing = Math.PI * 0.6;
    this.scene.add(this.shoreArch());
    this.glim.root.position.set(GLIM_POS.x, 0.02, GLIM_POS.z); this.glim.root.visible = false; this.glimFacing = Math.PI * 0.85;

    this.hud = new Hud3D(host, this.lang, {
      onResume: () => this.setPaused(false),
      onLang: l => { this.lang = l; saveLang(l); document.documentElement.lang = l; this.hud.setStrings(l); this.puzzle.setLang(l); this.wardrobe.setLang(l); this.map.setLang(l); this.heroPanel.setLang(l); this.input.setLabels(this.labels()); this.refreshHud(); },
      onWardrobe: () => this.openWardrobe(),
      onMap: () => this.toggleMap(),
      onPanel: tab => this.togglePanel(tab),
      onSound: on => { this.sfx.setMuted(!on); this.refreshPauseContext(); },
      onStartOver: () => this.startOver(),
      onKeepExploring: () => { this.endSeen = true; },
      onDialogueNext: () => this.advanceDialogue(),
    }, () => this.setPaused(!this.hud.paused));
    this.puzzle = new PuzzlePanel(this.hud.root, this.lang, {
      onSolved: (index, mistakes) => this.applyQuest({ kind: 'runeSolved', index, mistakes }, undefined, true).xpGained,
      onPracticeDone: mistakes => this.applyQuest({ kind: 'practised', mistakes }, undefined, true),
      onRiddleStart: r => this.noteStart(r),
      onRiddleDone: (r, res) => this.noteDone(r, res),
      newRun: () => this.newRun(),
      onSound: (n, step) => this.sfx.play(n, step ?? 0),
      onClose: () => { this.host.classList.remove('mq-pz-mode'); this.refreshHud(); },
    });
    this.wardrobe = new CosmeticsPanel(this.hud.root, this.lang, this.thumbs, {
      onOutfit: o => { this.outfit = o; this.hero.setLook(o); this.hero.setOutfit(resolveOutfitColors(o)); this.lookChanged(); saveOutfit(o); this.applyCosmetics(false); this.sfx.play('tap', 2); }, // redraw the panel too, or the ring stays on the old swatch
      onEquip: (slot, id) => this.equip(slot, id),
      onTint: (slot, i) => { this.cosmetics = setTint(this.cosmetics, slot, i); this.applyCosmetics(); this.sfx.play('tap', 2); },
      onReset: () => this.resetLook(),
      onPose: p => { this.previewPose = p; },
      onRotate: r => { this.wardrobeHeading += r; this.previewIdle = 0; },
      onZoom: d => { this.wardrobeZoom = Math.min(1.5, Math.max(0.65, this.wardrobeZoom * (1 + d))); },
      onClose: () => this.closeWardrobe(),
    });
    this.map = new MapPanel(this.hud.root, this.lang, () => this.toggleMap(false));
    this.heroPanel = new HeroPanel(this.hud.root, this.lang, this.thumbs, () => ({ progress: this.progress, learning: this.learning, equipped: this.cosmetics.equipped, hp: this.vitals.hp, maxHp: this.vitals.maxHp }), {
      onClose: () => this.togglePanel(null),
      onOutfit: () => { this.heroPanel.hide(); if (!this.hud.paused) this.setPaused(true); this.openWardrobe(); },
    });
    this.hud.addBlocker(() => this.puzzle.isOpen || this.wardrobe.isOpen || this.map.isOpen || this.heroPanel.isOpen);
    this.input = new Input3D(host, {
      onAction: a => this.requestAction(a),
      onInteract: () => this.interact(),
      onMap: () => this.toggleMap(),
      onPanel: tab => this.togglePanel(tab),
      onPause: () => { if (this.heroPanel.isOpen) this.togglePanel(null); else if (this.map.isOpen) this.toggleMap(false); else if (this.puzzle.isOpen) this.puzzle.close(); else if (this.wardrobe.isOpen) this.wardrobe.close(); else this.setPaused(!this.hud.paused); },
      onFirstGesture: () => this.sfx.unlock(),
    }, this.labels());

    // saved looks carry over from the 2D wardrobe
    this.hero.setOutfit(resolveOutfitColors(this.outfit));
    this.hero.setLook(this.outfit);
    this.lookChanged();
    this.applyCosmetics(false);

    for (let i = 0; i < PETAL_SPOTS.length; i++) {
      const p = PETAL_SPOTS[i]; const v = new PetalView(i, heightAt(p.x, p.z));
      v.root.position.set(p.x, heightAt(p.x, p.z), p.z); v.collected = this.progress.petalIds.includes(i); v.root.visible = !v.collected;
      this.petals.push(v); this.scene.add(v.root);
    }
    this.elder.root.position.set(ELDER_POS.x, heightAt(ELDER_POS.x, ELDER_POS.z), ELDER_POS.z);
    this.runeStone.root.position.set(RUNE_STONE_POS.x, heightAt(RUNE_STONE_POS.x, RUNE_STONE_POS.z), RUNE_STONE_POS.z);
    this.applyWorldState(true);
    this.checkpointRespawn(false);

    this.resize();
    window.addEventListener('resize', this.onResize); window.addEventListener('orientationchange', this.onResize);
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(this.onResize) : null; this.ro?.observe(host);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.documentElement.lang = this.lang;
    if (qs.has('fps')) { this.fpsMeter = document.createElement('div'); this.fpsMeter.className = 'mq-fps'; host.appendChild(this.fpsMeter); }
    if (qs.has('debug')) Object.assign(window, { __mq3d: this });
    this.refreshHud(); this.refreshPauseContext();
    this.renderer.setAnimationLoop(t => this.frame(t));
  }

  // ---------- helpers ----------
  private labels() { const u = TEXT[this.lang].ui; return { attack: u.attack, dodge: u.dodge, special: u.special, talk: this.area !== 'woods' ? HOLLOW_TEXT[this.lang].ui.use : u.talk }; }
  private get strings() { return TEXT[this.lang]; }
  private get blocked(): boolean { return this.hud.blocking || this.faintT !== null || this.hud.dialogueOpen || this.transition !== null; }
  private groundY(x: number, z: number): number { return this.area !== 'woods' ? 0 : heightAt(x, z); }
  /** The solid circles of the area the hero is in. */
  private get grid() { return this.area === 'hollow' && this.hollowWorld ? this.hollowWorld.grid : this.area === 'shore' && this.shoreWorld ? this.shoreWorld.grid : this.world.grid; }
  private get ht() { return HOLLOW_TEXT[this.lang]; }

  /** The hero's colours changed: item pictures and the portrait are taken again. */
  private lookChanged(): void { this.thumbs.setLookSignature(JSON.stringify(this.outfit)); this.portraitDirty = true; this.portraitWait = 0.3; }
  /** The round HUD portrait: the real hero's head, with the hair, hat and colours worn now. Taken between frames, never while a menu hides the HUD. */
  private updatePortrait(dt: number): void {
    if (!this.portraitDirty || !this.hero.isChibi || this.wardrobe.isOpen || this.wardrobeK > 0) return;
    this.portraitWait -= dt; if (this.portraitWait > 0) return; // lets the hero settle into the standing pose first
    this.portraitDirty = false;
    const c = this.snap.render({ frame: 'portrait', size: PORTRAIT_PX, bg: ['#cfeaa6', '#7db960'], yaw: 0.38 });
    if (c) this.hud.setPortrait(c.toDataURL('image/png'));
  }
  /** Shows the saved cosmetics on the hero (and saves them). */
  private applyCosmetics(save = true): void {
    this.hero.setLoadout(resolveLoadout(this.cosmetics));
    this.portraitDirty = true; this.portraitWait = 0.3;
    if (save) saveCosmetics(this.cosmetics);
    this.wardrobe?.setState(this.cosmetics, this.outfit, ownershipOf(this.progress));
    this.heroPanel?.refresh();
  }
  private equip(slot: CosmeticSlot, id: string | null): void {
    const next = equipItem(this.cosmetics, slot, id, ownershipOf(this.progress));
    if (next === this.cosmetics) { this.wardrobe.setState(this.cosmetics, this.outfit, ownershipOf(this.progress)); return; } // nothing changed (for example a blocked pick): still show what was tapped
    this.cosmetics = next; this.applyCosmetics(); this.sfx.play('tap', 2);
  }
  private resetLook(): void {
    this.cosmetics = resetLook(this.cosmetics); this.outfit = { ...HERO_START_OUTFIT }; saveOutfit(this.outfit);
    this.hero.setLook(this.outfit); this.hero.setOutfit(resolveOutfitColors(this.outfit)); this.lookChanged(); this.applyCosmetics(); this.sfx.play('tap', 2);
  }
  private refreshPauseContext(): void { this.hud.setPauseContext(!this.sfx.muted); }

  setPaused(p: boolean): void {
    if (p) { this.input.releaseAll(); this.combat.clearBuffer(); this.hud.openPause(); } else { this.hud.closePause(); }
  }

  private refreshHud(): void {
    this.hud.setLevel(levelForXp(this.progress.xp), xpIntoLevel(this.progress.xp));
    this.hud.setObjective(this.objectiveText());
    this.hud.setObjectiveProgress(this.objectiveCount());
    this.hud.setTide(this.area === 'shore' ? this.st.tide[this.shore.tide] : null, this.area === 'shore' ? this.shore.tide : 'still');
    this.hud.setHearts(this.vitals.hp, this.vitals.maxHp); this.lastHearts = this.vitals.hp;
    this.heroPanel?.refresh();
  }

  /** Applies quest-dependent scenery: gate, Elder marker, enemies that belong to the stage. */
  private applyWorldState(initial = false): void {
    const st = this.progress.stage;
    this.world.setGateOpen(this.progress.gateOpen);
    this.elder.setMarker(st === 'talk' || st === 'return');
    this.runeStone.setSolved(this.progress.runesSolved); this.runeStone.setMarker(st === 'runes');
    if (st === 'sprouts' && !this.chars.has('sprout')) {
      const n = Math.max(1, SPROUTS_NEEDED - this.progress.sproutsCalmed);
      for (let i = 0; i < n; i++) this.spawnEnemy('sprout', SPROUT_SPOTS[i % SPROUT_SPOTS.length], !initial);
    }
    if (st === 'boss' && !this.progress.bossDefeated && !this.chars.has('mossback')) {
      this.spawnEnemy('mossback', BOSS_POS, !initial);
      if (!initial) this.fx.ring(BOSS_POS.x, this.groundY(BOSS_POS.x, BOSS_POS.z), BOSS_POS.z, 6, 0x66e8d4, 40);
    }
    if (this.area === 'hollow') this.spawnHollowCreatures(!initial);
    if (this.area === 'shore') this.spawnShoreCreatures(!initial);
  }

  private spawnEnemy(kind: EnemyKind, at: { x: number; z: number }, burst: boolean, tag: number | null = null, sound = true): void {
    this.chars.spawn(kind, at, tag);
    const crystal = kind === 'shardling' || kind === 'warden' || kind === 'crab' || kind === 'gull' || kind === 'heron';
    if (burst) this.fx.burst(at.x, this.groundY(at.x, at.z) + 0.5, at.z, crystal ? 0xbfe6ff : 0xbfffa8, 18, 2.5, 0.7);
    if (sound) this.sfx.play('poof');
  }
  /**
   * v2.28: puts into the Hollow every creature the save says is still owed (see systems/hollowEncounters.ts): the Shardlings that have not been
   * calmed, and the Warden while the Heart Door is open and it has not been beaten. Anything already there is left alone, so it is safe to call again.
   */
  private spawnHollowCreatures(burst: boolean): void {
    for (const sp of hollowSpawns(this.hollow)) {
      if (this.chars.all().some(c => c.enemy.def.kind === sp.kind && c.enemy.tag === sp.tag)) continue;
      this.spawnEnemy(sp.kind, sp.at, burst && sp.kind === 'warden', sp.tag, sp.kind === 'warden');
      if (sp.kind === 'warden') { this.wardenAnnounced = false; if (burst) { this.fx.ring(sp.at.x, 0.1, sp.at.z, 6, 0xc59bff, 40); this.fx.beam(sp.at.x, 0, sp.at.z, 0xc59bff, 6, 1.2, 1.0); } }
    }
  }

  // ---------- quest ----------
  private applyQuest(e: QuestEvent, worldAt?: { x: number; y: number; z: number }, quiet = false): { xpGained: number } {
    const before = this.progress;
    const r = reduceQuest(before, e);
    this.progress = r.state; saveProgress(this.progress);
    if (r.xpGained > 0 && !quiet) { const s = this.screenOf(worldAt ?? { x: this.pos.x, y: this.y + 1.6, z: this.pos.z }); this.hud.floatText(s.x, s.y, `+${r.xpGained} XP`, '#ffe27a'); }
    const msg = questToast(this.lang, before, this.progress);
    if (msg) this.hud.toast(msg);
    if (r.levelUp || r.unlockedNow.length) { const fresh = newlyOwned(ownershipOf(before), ownershipOf(this.progress), this.cosmetics).filter(i => !r.unlockedNow.includes(i.id)); if (fresh.length) setTimeout(() => this.hud.toast(this.strings.cosmetics.newItems, 4500, 'shirt'), 1400); }
    if (r.levelUp) { this.hero.cheer(1.8); this.hud.toast(`${this.strings.toast.levelUp} ${levelForXp(this.progress.xp)}`, 3600, 'star'); this.sfx.play('levelup'); this.fx.burst(this.pos.x, this.y + 1, this.pos.z, 0xffe27a, 40, 3.5, 1.1, 1.5, 3); this.fx.beam(this.pos.x, this.y, this.pos.z, 0xffe27a, 5, 1.1); this.fx.flash(this.pos.x, this.y + 1, this.pos.z, 0xffe27a, 4.5, 0.7); }
    for (const id of r.unlockedNow) {
      this.hud.toast(`${this.strings.toast.unlocked}: ${this.strings.accessory[id] ?? itemById(id)?.name[this.lang] ?? id}`, 5000, 'gift');
      const it = itemById(id); if (it && !this.cosmetics.equipped[it.slot]) { this.cosmetics = grant(this.cosmetics, id); this.equip(it.slot, id); }
    }
    if (before.bonusXp < BONUS_XP_CAP && this.progress.bonusXp >= BONUS_XP_CAP) setTimeout(() => this.hud.toast(this.strings.toast.patrolDone, 4200, 'sparkles'), 1200);
    if (e.kind === 'petal' && r.state !== before) this.hud.pulseTile('bag');
    if (r.levelUp || r.unlockedNow.length) this.hud.pulseTile('hero');
    this.refreshHud(); this.refreshPauseContext(); this.applyWorldState();
    return { xpGained: r.xpGained };
  }

  private screenOf(p: { x: number; y: number; z: number }): { x: number; y: number } {
    this.tmp.set(p.x, p.y, p.z).project(this.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    return { x: (this.tmp.x * 0.5 + 0.5) * w, y: (-this.tmp.y * 0.5 + 0.5) * h };
  }

  // ---------- input actions ----------
  private requestAction(a: CombatAction): void {
    if (this.blocked) return;
    this.combat.request(a);
  }

  private nearRuneStone(): boolean { return this.area === 'woods' && this.progress.stage !== 'talk' && this.progress.stage !== 'petals' && this.progress.stage !== 'sprouts' && Math.hypot(this.pos.x - RUNE_STONE_POS.x, this.pos.z - RUNE_STONE_POS.z) < RUNE_STONE_RANGE; }
  private nearElder(): boolean { return this.area === 'woods' && Math.hypot(this.pos.x - ELDER_POS.x, this.pos.z - ELDER_POS.z) < TALK_RANGE; }

  private interact(): void {
    if (this.hud.endOpen) return;
    if (this.hud.paused) return;
    if (this.hud.dialogueOpen) { this.advanceDialogue(); return; }
    if (this.puzzle.isOpen || this.wardrobe.isOpen) return;
    if (this.faintT !== null || this.combat.busy) return;
    if (this.area === 'hollow') { this.useHollow(); return; }
    if (this.area === 'shore') { this.useShore(); return; }
    if (!this.nearElder()) { const w = this.wildsTarget(); if (w && !this.nearRuneStone()) { this.useWilds(w); return; } if (this.nearRuneStone()) this.openPuzzle(); return; }
    const stage = this.progress.stage;
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0;
    this.startHint = false; this.hud.setHint(null);
    this.hud.openDialogue(this.strings.elderName, this.elderLines(stage), () => {
      if (stage === 'talk') this.applyQuest({ kind: 'talked' });
      else if (stage === 'return') {
        this.sfx.play('fanfare'); this.elder.cheer();
        this.fx.burst(MOONLIT_GATE_TRIGGER.x - 1.5, 2, MOONLIT_GATE_TRIGGER.z, 0xbfd8ff, 60, 4, 1.4, 0.5, 2.5);
        this.applyQuest({ kind: 'returned' }, { x: ELDER_POS.x, y: 2.2, z: ELDER_POS.z });
      }
    }, stage === 'return' ? this.gateQuestion() : undefined);
    this.sfx.play('talk');
  }

  // ---------- learning ----------
  private noteStart(r: Riddle): void { this.learning = recordStart(this.learning, r); saveLearning(this.learning); }
  private noteDone(r: Riddle, res: { slips: number; hinted: boolean; revealed: boolean }): void {
    this.learning = recordResult(this.learning, r, res); saveLearning(this.learning); this.heroPanel.refresh();
  }
  /** Three riddles chosen from what the child has shown (see `learning/profile.ts`), avoiding the ones seen lately. */
  private newRun(): Riddle[] {
    const seed = (Math.random() * 0x7fffffff) >>> 0;
    return makePlannedRun(seed, planRun(this.learning, this.progress.runeTier, seed), this.learning.recent);
  }
  /**
   * The Elder's lantern question, asked inside the conversation just before the Moonlit Gate opens: the quest reward follows a small
   * adding or taking-away problem, with free hints and no way to fail (the answer is shown after two slips).
   */
  private gateQuestion(ask: { add: string; subtract: string } = this.strings.puzzle.gate, theme?: 'money' | 'clock'): DialogueQuestion {
    const seed = (Math.random() * 0x7fffffff) >>> 0, plan = planRun(this.learning, this.progress.runeTier, seed);
    const kind = plan.maths.kind === 'subtract' ? 'subtract' : 'add';
    const riddle = pickFresh(rnd => (theme === 'clock' ? makeClockSum : makeSum)(kind, plan.maths.tier, rnd), seed, this.learning.recent);
    this.noteStart(riddle);
    const p = this.strings.puzzle, v = riddle as Extract<Riddle, { kind: 'add' | 'subtract' }>;
    return {
      riddle, theme, ask: singularHour(fill(ask[kind], { a: v.a, b: v.b })), hintLabel: p.hintLabel, hint: theme ? SHORE_TEXT[this.lang].sums[theme].hint[kind] : p.hint[kind], concept: theme ? SHORE_TEXT[this.lang].sums[theme].concept[kind] : p.concept[kind], tryAgain: p.tryAgain,
      right: p.correct, rightFirst: p.correctFirst, revealed: fill(p.revealed, { n: answerText(riddle) }), explain: explanationText(this.lang, explain(riddle)),
      onEvent: e => this.sfx.play(e === 'right' ? 'right' : e === 'wrong' ? 'wrong' : 'tap', e === 'hint' ? 1 : 0),
      onResolved: res => this.noteDone(riddle, res),
    };
  }
  private openPuzzle(): void {
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0; this.startHint = false; this.hud.setHint(null);
    this.host.classList.add('mq-pz-mode');
    const practice = this.progress.stage !== 'runes';
    this.puzzle.open({ practice, startIndex: this.progress.runesSolved, run: this.newRun() });
    this.sfx.play('talk');
  }

  // ---------- wardrobe ----------
  /** Opens or closes the woods map (the `M` key or the Map tile). It cannot open over the pause menu, a riddle, the wardrobe or a conversation. */
  private toggleMap(open = !this.map.isOpen): void {
    if (open === this.map.isOpen) return;
    if (open) { if (this.hud.blocking) return; this.map.show(); this.sfx.play('tap', 1); } else { this.map.hide(); this.sfx.play('tap', 0); }
  }

  /** Opens the Hero panel on a tab (the Bag/Hero tiles, `I` and `C`), or closes it (null, or the same key again). Never opens over another menu. */
  private togglePanel(tab: HeroTab | null): void {
    if (tab === null || (this.heroPanel.isOpen && this.heroPanel.current === tab)) { if (this.heroPanel.isOpen) { this.heroPanel.hide(); this.sfx.play('tap', 0); } return; }
    if (this.heroPanel.isOpen) { this.heroPanel.show(tab); this.sfx.play('tap', 1); return; }
    if (this.hud.blocking) return;
    this.input.releaseAll(); this.heroPanel.show(tab); this.sfx.play('tap', 1);
  }

  private openWardrobe(): void {
    this.hud.hidePauseMenu(true); this.host.classList.add('mq-wd-mode');
    // the camera swings round to the front of the hero, in the direction with the most room
    this.wardrobeYaw = pickPreviewYaw(this.grid, this.pos.x, this.pos.z, this.camYaw + Math.PI, 3.2, 0.5);
    this.wardrobeHeading = this.wardrobeYaw + 0.45; this.previewPose = 'stand'; this.previewIdle = 0;
    this.wardrobeZoom = 1; this.wardrobe.open(this.outfit, this.cosmetics, ownershipOf(this.progress));
  }
  private closeWardrobe(): void {
    this.host.classList.remove('mq-wd-mode'); this.refreshPauseContext(); this.hud.hidePauseMenu(false);
  }
  private advanceDialogue(): void { this.sfx.play('talk', 2); this.hud.nextDialogue(); }

  // ---------- combat ----------
  private damageEnemy(entry: EnemyEntry, amount: number, hitId: number): void {
    const ev = entry.enemy.takeDamage(amount, hitId, { x: this.pos.x, z: this.pos.z }, this.blow.kind === 'special');
    this.handleEnemyEvents(entry, ev);
  }
  private handleEnemyEvents(entry: EnemyEntry, events: EnemyEvent[]): void {
    const e = entry.enemy; const gy = this.groundY(e.pos.x, e.pos.z);
    for (const ev of events) {
      switch (ev.kind) {
        case 'hit':
          {
            const boss = e.def.boss, hy = gy + (boss ? (e.def.kind === 'warden' ? 2.0 : e.def.kind === 'heron' ? 2.2 : 1.8) : e.def.kind === 'gull' ? 1.3 : 0.7), st = this.blow.kind === 'special' ? 2 : this.blow.step, size = boss ? 1.8 : 1;
            const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, dl = Math.hypot(dx, dz) || 1;
            entry.view.react(dx / dl, dz / dl, this.blow.kind === 'special' ? 3 : st);   // the creature is shoved away from the blow and springs back
            this.fx.burst(e.pos.x, hy, e.pos.z, 0xfff0a0, 8 + st * 3, 3.2, 0.5, 4, 2);
            this.fx.spray(e.pos.x, hy, e.pos.z, dx / dl, dz / dl, st === 2 ? 0xc9f4ff : 0xffffff, 6 + st * 3, 4.2 + st, 0.6, 0.35, 2, 1);   // sparks fly away from the hero
            this.fx.spray(e.pos.x, hy, e.pos.z, dx / dl, dz / dl, CHIP_COLOR[e.def.kind], boss ? 10 : 6, 3 + st, 0.9, 0.5, 4, 1.4);        // chips of stone, crystal or leaf bits
            this.fx.flash(e.pos.x, hy, e.pos.z, st === 2 ? 0xc9f4ff : 0xfff6d0, (1.2 + st * 0.5) * size, 0.18 + (boss ? 0.06 : 0), 0.85);
            if (st === 2) this.fx.ring(e.pos.x, gy, e.pos.z, 1.4 * size, 0xc9f4ff, 18);   // the finisher and the spin leave a ring on the ground
            this.punchCamera(dx, dz, (boss ? 0.1 : 0.05) + st * (boss ? 0.05 : 0.03));
            if (boss) this.hitStop = Math.max(this.hitStop, 0.06 + st * 0.03);              // the boss feels heavier to hit
          }
          if (ev.weak) {   // the Warden's exposed heart: a golden ring, a "x2" and (once) a reminder of why
            const hy = gy + (e.def.kind === 'heron' ? 2.0 : 2.0);
            this.fx.ring(e.pos.x, gy + 1.2, e.pos.z, 1.8, 0xffe9a0, 24); this.fx.flash(e.pos.x, hy, e.pos.z, 0xffe9a0, 3.2, 0.25, 0.9); this.hitStop = Math.max(this.hitStop, 0.05);
            const sp = this.screenOf({ x: e.pos.x, y: hy + 1.2, z: e.pos.z }); this.hud.floatText(sp.x, sp.y, '\u00d72', '#ffe27a');
            if (!this.weakTipShown) { this.weakTipShown = true; this.hud.toast(e.def.kind === 'heron' ? SHORE_TEXT[this.lang].toast.weakSpot : this.ht.toast.weakSpot, 3600, 'sparkles'); }
          }
          this.sfx.play('hit', this.blow.step); this.shake = Math.max(this.shake, e.def.boss ? 0.2 : 0.08);
          break;
        case 'blocked': {   // a blow on the Pebble Crab's shell: a clink and a spark, and (once) a hint
          const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, dl = Math.hypot(dx, dz) || 1, bx = e.pos.x - (dx / dl) * 0.5;
          this.fx.burst(bx, gy + 0.7, e.pos.z - (dz / dl) * 0.5, 0xfff6d0, 10, 3, 0.4, 3, 1.6); this.fx.flash(bx, gy + 0.7, e.pos.z - (dz / dl) * 0.5, 0xffffff, 1.6, 0.14, 0.9); entry.view.react(dx / dl, dz / dl, 0);
          this.sfx.play('tap', 3); this.sfx.play('hit', 0); this.punchCamera(dx, dz, 0.03);
          if (!this.shellTipShown) { this.shellTipShown = true; this.hud.toast(SHORE_TEXT[this.lang].toast.shellBlocks, 4600, 'sparkles'); }
          break;
        }
        case 'phase': this.fx.ring(e.pos.x, gy, e.pos.z, 4, 0xff9a5a, 36); this.fx.flash(e.pos.x, gy + 1.8, e.pos.z, 0xff6a30, 8, 0.9, 0.7); this.fx.burst(e.pos.x, gy + 1.6, e.pos.z, e.def.kind === 'warden' ? 0xffb050 : 0xffa050, 40, 4, 1, 0.5, 3); this.sfx.play('telegraph'); this.shake = 0.3; break;
        case 'defeated': {
          // the killing blow lands now (a long freeze and a white flash); the big poof comes when the defeat animation reaches its end
          const boss = e.def.boss;
          this.fx.flash(e.pos.x, gy + (boss ? 1.8 : 0.7), e.pos.z, 0xffffff, boss ? 5 : 2.2, 0.3, 0.9);
          this.fx.burst(e.pos.x, gy + 0.8, e.pos.z, 0xfff0a0, boss ? 30 : 14, 3.5, 0.8, 2, 2.5);
          this.hitStop = Math.max(this.hitStop, boss ? 0.2 : 0.1); this.shake = Math.max(this.shake, boss ? 0.4 : 0.14);
          this.sfx.play('hit', 2); entry.marker.hide();
          if (e.def.kind === 'shardling') this.shardlingCalmed(e.tag, { x: e.pos.x, y: gy + 1.2, z: e.pos.z });
          else if (e.def.kind === 'warden') this.wardenFell({ x: e.pos.x, y: gy + 2.2, z: e.pos.z });
          else if (e.def.kind === 'crab') this.shoreCreatureCalmed('crab', e.tag, { x: e.pos.x, y: gy + 1.2, z: e.pos.z });
          else if (e.def.kind === 'gull') this.shoreCreatureCalmed('gull', e.tag, { x: e.pos.x, y: gy + 1.6, z: e.pos.z });
          else if (e.def.kind === 'heron') this.heronFell({ x: e.pos.x, y: gy + 2.4, z: e.pos.z });
          else this.applyQuest({ kind: 'enemyDefeated', enemy: e.def.kind }, { x: e.pos.x, y: gy + 1.8, z: e.pos.z });
          break;
        }
        case 'telegraph': entry.marker.show(ev.shape, gy); this.sfx.play('telegraph'); break;
        case 'strike': {
          entry.marker.hide();
          if (ev.shape.type === 'circle') this.fx.ring(ev.shape.x, this.groundY(ev.shape.x, ev.shape.z), ev.shape.z, ev.shape.r, 0xffb070, 30);
          if (e.def.kind === 'mossback') this.bossStrikeFx(ev.attack, ev.shape);
          else if (e.def.kind === 'warden') this.wardenStrikeFx(ev.attack, ev.shape, e.pos);
          else if (e.def.kind === 'heron') this.heronStrikeFx(ev.attack, ev.shape, e.pos);
          else if (e.def.kind === 'crab' || e.def.kind === 'gull') { this.fx.burst(e.pos.x, gy + (e.def.kind === 'gull' ? 0.6 : 0.2), e.pos.z, e.def.kind === 'gull' ? 0xc9d0e0 : 0xe6d8a8, 8, 2, 0.5, 1.2, 1); }
          else if (e.def.kind === 'shardling') { this.fx.burst(e.pos.x, gy + 0.3, e.pos.z, 0xbfe6ff, 6, 1.8, 0.5, 1.5, 1); }
          else if (ev.shape.type === 'circle') { const sy = this.groundY(ev.shape.x, ev.shape.z); this.fx.burst(ev.shape.x, sy + 0.2, ev.shape.z, 0xa6e870, 10, 2.4, 0.5, 3, 2); }
          if (shapeHits(ev.shape, this.pos, 0.3)) this.hurtHero(ev.damage, e.pos);
          break;
        }
      }
    }
  }
  /** What the boss's big attacks look like when they land: flying rubble for the slam, a green spore wave, a hard shake. */
  private bossStrikeFx(attack: string, shape: Shape): void {
    if (shape.type === 'line') { this.shake = Math.max(this.shake, 0.25); return; }
    const gy = this.groundY(shape.x, shape.z);
    if (attack === 'sporeRing') {
      this.fx.ring(shape.x, gy, shape.z, shape.r, 0xa6e860, 56); this.fx.ring(shape.x, gy, shape.z, shape.r * 0.6, 0xe6ffa0, 36);
      this.fx.burst(shape.x, gy + 0.4, shape.z, 0xb8f070, 60, 5.5, 1.3, -0.3, 1.6); this.fx.flash(shape.x, gy + 0.8, shape.z, 0xb8f070, 7, 0.6, 0.6); this.shake = Math.max(this.shake, 0.3);
    } else {
      this.fx.burst(shape.x, gy + 0.3, shape.z, 0x9aa393, 34, 4.8, 0.9, 6, 4.5); this.fx.burst(shape.x, gy + 0.2, shape.z, 0xcbb98a, 26, 3.5, 0.9, 1, 1.2);
      this.fx.ring(shape.x, gy, shape.z, shape.r * 1.2, 0xcbb98a, 40); this.fx.flash(shape.x, gy + 0.5, shape.z, 0xffd0a0, 5, 0.3, 0.8);
      this.hitStop = Math.max(this.hitStop, 0.05); this.shake = Math.max(this.shake, 0.55);
    }
    this.sfx.play('stomp', 2); this.sfx.play('hit', 2);
  }
  /** What the Warden's attacks look like when they land (v2.28): crystals crashing down, a prism beam along the floor, a ring of shattering light. */
  private wardenStrikeFx(attack: string, shape: Shape, from: { x: number; z: number }): void {
    if (shape.type === 'circle' && attack === 'shardRain') {
      const gy = this.groundY(shape.x, shape.z);
      this.fx.beam(shape.x, gy, shape.z, 0xc59bff, 9, 0.9, 0.9); this.fx.burst(shape.x, gy + 0.4, shape.z, 0xc59bff, 46, 4.6, 1, 5, 3.5); this.fx.burst(shape.x, gy + 0.3, shape.z, 0xff9fd8, 24, 3.4, 0.9, 3, 2);
      this.fx.ring(shape.x, gy, shape.z, shape.r * 1.15, 0xc59bff, 36); this.fx.flash(shape.x, gy + 0.6, shape.z, 0xe6d4ff, 5, 0.3, 0.8); this.hitStop = Math.max(this.hitStop, 0.05); this.shake = Math.max(this.shake, 0.45);
    } else if (shape.type === 'circle') {   // the ring: a wave of light out from the Warden
      const gy = this.groundY(shape.x, shape.z);
      this.fx.ring(shape.x, gy, shape.z, shape.r, 0xff9fd8, 56); this.fx.ring(shape.x, gy, shape.z, shape.r * 0.6, 0xffe9ff, 36);
      this.fx.burst(shape.x, gy + 0.5, shape.z, 0xc59bff, 60, 5.5, 1.3, -0.2, 1.6); this.fx.flash(shape.x, gy + 0.9, shape.z, 0xe6d4ff, 7, 0.6, 0.6); this.shake = Math.max(this.shake, 0.32);
    } else {   // the beam: sparks streaming along its length and a kick of shake
      for (let i = 1; i <= 5; i++) { const f = i / 5, x = shape.x + shape.dx * shape.length * f, z = shape.z + shape.dz * shape.length * f; this.fx.burst(x, this.groundY(x, z) + 0.4, z, i % 2 ? 0xff9fe8 : 0xffffff, 8, 2.2, 0.6, 1.2, 1.4); }
      this.fx.flash(from.x, this.groundY(from.x, from.z) + 1.4, from.z, 0xffd0ff, 6, 0.4, 0.8); this.shake = Math.max(this.shake, 0.3);
    }
    this.sfx.play('stomp', 2); this.sfx.play('hit', 2);
  }
  /** A Hollow Shardling has been calmed: its nest number is saved, so it never comes back for XP (see systems/hollowQuest.ts). */
  private shardlingCalmed(id: number | null, at: { x: number; y: number; z: number }): void {
    const r = calmShardling(this.hollow, id ?? -1); if (!r.first) return;
    this.hollow = r.state; saveHollow(this.hollow);
    this.hud.toast(hollowFill(this.ht.toast.shardling, { n: this.hollow.shardlings.length, total: SHARDLING_COUNT }), 2600, 'sparkles');
    this.applyQuest({ kind: 'hollow', xp: r.xp }, at);
    if (r.all) setTimeout(() => { this.hud.toast(this.ht.toast.allShardlings, 4600, 'sparkles'); this.sfx.play('levelup'); }, 1200);
    this.refreshHud();
  }
  /** The Hollow Warden has fallen: pays XP and the Warden's Mantle once, and frees the Heartstone. */
  private wardenFell(at: { x: number; y: number; z: number }): void {
    const r = defeatWarden(this.hollow); if (r.xp === 0) return;
    this.hollow = r.state; saveHollow(this.hollow); this.hollowWorld?.setWardenDown(true);
    this.hud.toast(this.ht.toast.wardenDown, 5200, 'sparkles'); this.sfx.play('fanfare'); this.hero.cheer(2);
    this.applyQuest({ kind: 'hollow', xp: r.xp, unlock: r.unlock }, at);
    this.refreshHud();
  }
  /** Dresses the one-off happenings the enemy models ask for (footfalls, roars, snorts, embers, dust): see EnemyView.takeCues. */
  private enemyCue(c: EnemyCue): void {
    const near = Math.max(0, 1 - Math.hypot(c.x - this.pos.x, c.z - this.pos.z) / 20), gy = this.groundY(c.x, c.z), pw = c.power ?? 1;
    switch (c.kind) {
      case 'stomp':
        this.fx.burst(c.x, gy + 0.12, c.z, c.color ?? 0xcbb98a, 6, 1.7 * pw, 0.55, 0.8, 0.7); this.fx.ring(c.x, gy, c.z, 0.9, c.color ?? 0xcbb98a, 10);
        this.shake = Math.max(this.shake, 0.09 * near * pw); this.sfx.play('stomp', near > 0.55 ? 2 : near > 0.25 ? 1 : 0); break;
      case 'roar':
        this.fx.ring(c.x, gy, c.z, 9, c.color ?? 0xffa060, 48); this.fx.ring(c.x, gy, c.z, 5, c.color ? 0xf0e6ff : 0xffe0a0, 30);
        this.fx.burst(c.x, gy + 1.6, c.z, c.color ?? 0xcbb98a, 40, 5, 1, 1.2, 2.4); this.fx.flash(c.x, gy + 2.2, c.z, c.color ?? 0xff9a50, 8, 0.8, 0.55);
        this.shake = Math.max(this.shake, 0.4); this.sfx.play('roar'); break;
      case 'snort': this.fx.burst(c.x, c.y, c.z, 0xe8efe8, 6, 1.2, 0.8, -0.3, 0.7); break;
      case 'ember': this.fx.burst(c.x, c.y, c.z, c.color ?? 0xff8a30, 2, 0.4, 1.2, -1.2, 1.4); break;
      case 'dust': this.fx.burst(c.x, gy + 0.1, c.z, c.color ?? 0xcbb98a, Math.round(3 * pw) + 1, 1.2 * pw, 0.4, 0.8, 0.5); break;
      case 'alert': this.fx.burst(c.x, c.y, c.z, 0xffe27a, 8, 2, 0.5, 1.5, 2); break;
      case 'steam': this.fx.burst(c.x, c.y, c.z, c.color ?? 0xff9a6a, 2, 0.6, 0.5, -0.8, 1); break;
      case 'slam': this.fx.burst(c.x, gy + 0.12, c.z, c.color ?? 0xcbb98a, 8, 2, 0.5, 1, 0.8); this.fx.ring(c.x, gy, c.z, 1.1, c.color ?? 0xcbb98a, 12); this.shake = Math.max(this.shake, (c.power ?? 1) > 1 ? 0.12 * near : 0.05 * near); break;
      case 'crystal': this.fx.burst(c.x, c.y, c.z, c.color ?? 0xbfe6ff, Math.round(6 * pw) + 2, 1.6, 0.7, 1.8, 1.2); break;                // a twinkle, or a spray of crystal chips when hit
      case 'shatter': this.fx.burst(c.x, c.y + 0.4, c.z, c.color ?? 0xbfe6ff, 34, 3.6, 1, 3, 2.2); this.fx.burst(c.x, c.y + 0.4, c.z, 0xffffff, 12, 2.4, 0.6, 3.5, 1.2); this.fx.ring(c.x, gy, c.z, 1.6, c.color ?? 0xbfe6ff, 20); this.sfx.play('poof'); break;
    }
  }
  /** The big poof at the end of a defeat animation (the boss's is a proper send-off: light column, ring and a rain of sparkles). */
  private defeatFinale(entry: EnemyEntry): void {
    const e = entry.enemy, gy = this.groundY(e.pos.x, e.pos.z), boss = e.def.boss;
    if (e.def.kind === 'warden') {   // the heart's light, set free: a rose-gold column, rings and a rain of sparkles
      this.fx.burst(e.pos.x, gy + 1.2, e.pos.z, 0xc59bff, 80, 4, 1.2, 1.5, 3.2); this.fx.flash(e.pos.x, gy + 2, e.pos.z, 0xffd0ec, 10, 1.0); this.fx.beam(e.pos.x, gy, e.pos.z, 0xffc8ea, 10, 1.6, 1.4);
      this.fx.ring(e.pos.x, gy, e.pos.z, 8, 0xffd0ec, 52); this.fx.ring(e.pos.x, gy, e.pos.z, 4.5, 0xc59bff, 40); this.fx.burst(e.pos.x, gy + 3, e.pos.z, 0xffe9a0, 36, 1.6, 1.6, -0.6, 1.4); this.shake = Math.max(this.shake, 0.3); this.sfx.play('poof'); return;
    }
    if (e.def.kind === 'heron') {   // the Tide Pearl, set free: a column of sea-blue light, rings that roll out over the water and sparkles
      this.fx.burst(e.pos.x, gy + 1.5, e.pos.z, 0x9fe8ff, 80, 4, 1.2, 1.5, 3.2); this.fx.flash(e.pos.x, gy + 2.4, e.pos.z, 0xe6faff, 10, 1.0); this.fx.beam(e.pos.x, gy, e.pos.z, 0xbff4ff, 11, 1.6, 1.4);
      this.fx.ring(e.pos.x, gy, e.pos.z, 9, 0xbff4ff, 52); this.fx.ring(e.pos.x, gy, e.pos.z, 5, 0xffffff, 40); this.fx.burst(e.pos.x, gy + 3, e.pos.z, 0xffe9a0, 36, 1.6, 1.6, -0.6, 1.4); this.shake = Math.max(this.shake, 0.3); this.sfx.play('poof'); return;
    }
    if (e.def.kind === 'crab' || e.def.kind === 'gull') { this.fx.burst(e.pos.x, gy + 0.6, e.pos.z, e.def.kind === 'gull' ? 0xe6ecf8 : 0xe6d8a8, 22, 3, 1, 1.5, 2.4); this.sfx.play('poof'); return; }
    if (e.def.kind === 'shardling') { this.fx.burst(e.pos.x, gy + 0.6, e.pos.z, 0xbfe6ff, 22, 3, 1, 1.5, 2.4); this.sfx.play('poof'); return; }
    this.fx.burst(e.pos.x, gy + 0.8, e.pos.z, 0xbfffa8, boss ? 70 : 28, 3.5, 1, 1.5, 3);
    if (boss) { this.fx.flash(e.pos.x, gy + 1.5, e.pos.z, 0xbfffa8, 9, 0.9); this.fx.beam(e.pos.x, gy, e.pos.z, 0x9be8ff, 8, 1.4, 1.2); this.fx.ring(e.pos.x, gy, e.pos.z, 7, 0xbfffa8, 48); this.fx.burst(e.pos.x, gy + 2.6, e.pos.z, 0x9be8ff, 30, 1.6, 1.4, -0.6, 1.2); this.shake = Math.max(this.shake, 0.3); }
    this.sfx.play('poof');
  }
  private hurtHero(amount: number, from: { x: number; z: number }): void {
    if (this.faintT !== null) return;
    const taken = this.vitals.hurt(amount, this.combat.invulnerable);
    if (taken <= 0) return;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.knock.x = (dx / d) * 6; this.knock.z = (dz / d) * 6;
    this.sfx.play('hurt'); this.hero.hit(); this.shake = Math.max(this.shake, 0.25); this.punchCamera(dx, dz, 0.22);
    this.fx.burst(this.pos.x, this.y + 0.8, this.pos.z, 0xff8a7a, 12, 2.4, 0.5);
    this.hud.setHearts(this.vitals.hp, this.vitals.maxHp); this.hud.pulseHeart(this.vitals.hp); this.lastHearts = this.vitals.hp;
    if (this.vitals.fainted) { this.faintT = 0; this.input.releaseAll(); this.combat.clearBuffer(); this.sfx.play('faint'); }
  }

  private handleCombatEvents(): void {
    for (const ev of this.combat.update(this.dtCache)) {
      switch (ev.kind) {
        case 'attackStart': {
          const t = this.nearestEnemy(4.5); // gentle aim assist
          if (t) this.heading = headingOf(t.enemy.pos.x - this.pos.x, t.enemy.pos.z - this.pos.z);
          const step = this.combat.comboStep; this.blow = { kind: 'attack', step };
          this.sfx.play('swing', step);
          // a puff of dust under the feet as the hero steps into the swing (bigger for the finisher)
          const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
          this.fx.spray(this.pos.x, this.y + 0.1, this.pos.z, -fx, -fz, 0xe8e0c8, 4 + step * 3, 1.6, 0.9, 0.35, 0.5, 0.5);
          break;
        }
        case 'attackHit': {
          const step = this.combat.comboStep, finisher = step === 2;
          const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
          const range = COMBAT.attackRange * (finisher ? 1.3 : 1), half = COMBAT.attackHalfAngle * (finisher ? 1.25 : 1);
          let hits = 0;
          for (const en of this.chars.alive()) {
            if (inAttackArc(this.pos, this.heading, en.enemy.pos, range, half, en.enemy.def.radius * 0.9)) { this.damageEnemy(en, COMBAT.attackDamage, ev.swingId); hits++; }
          }
          if (this.area === 'hollow') this.strikeCrystals(range, half); else if (this.area === 'shore') this.strikeBuoys(range, half);
          // sparks off the blade's arc, even on a miss: the swing always looks like it did something
          const col = [0xfff1c9, 0xffd77a, 0xc9f4ff][step];
          this.fx.spray(this.pos.x + fx * 1.0, this.y + 0.95, this.pos.z + fz * 1.0, fx, fz, col, 6 + step * 5, 3.6 + step, 0.8, 0.35, 1.5, 0.5);
          if (finisher) {
            this.fx.ring(this.pos.x + fx * 1.2, this.y, this.pos.z + fz * 1.2, 2.2, 0xc9f4ff, 24);
            this.fx.flash(this.pos.x + fx * 1.2, this.y + 0.7, this.pos.z + fz * 1.2, 0xc9f4ff, 2.6, 0.3, 0.7);
            this.shake = Math.max(this.shake, 0.12);
          }
          if (hits > 0) { this.hitStop = Math.max(this.hitStop, 0.04 + step * 0.025); this.shake = Math.max(this.shake, 0.06 + step * 0.03); }
          break;
        }
        case 'dodgeStart': {
          const i = this.input.read(); const v = cameraRelativeVelocity(i.x, i.y, this.camYaw, 1); const l = Math.hypot(v.x, v.z);
          this.dodgeDir = l > 0.1 ? { x: v.x / l, z: v.z / l } : { x: Math.sin(this.heading), z: Math.cos(this.heading) };
          this.heading = headingOf(this.dodgeDir.x, this.dodgeDir.z);
          this.sfx.play('dodge');
          // a burst of dust kicked up behind the hero, a small cyan flash, and the first afterimage
          this.fx.spray(this.pos.x, this.y + 0.12, this.pos.z, -this.dodgeDir.x, -this.dodgeDir.z, 0xe8e0c8, 16, 2.6, 0.7, 0.45, 0.8, 0.7);
          this.fx.flash(this.pos.x, this.y + 0.6, this.pos.z, 0x9be8ff, 1.8, 0.25, 0.6);
          this.fx.ghost(this.pos.x, this.y, this.pos.z, 0x8fdcff); this.ghostTimer = 0.05;
          break;
        }
        case 'specialStart':
          this.blow = { kind: 'special', step: 2 }; this.sfx.play('spin');
          this.fx.burst(this.pos.x, this.y + 0.15, this.pos.z, 0x9be8ff, 14, 1.3, 0.55, -2.5, 2.2); // sparkles gather and rise as the hero winds up
          break;
        case 'specialBlast': {
          const p = this.pos;
          this.fx.ring(p.x, this.y, p.z, COMBAT.specialRadius, 0x9be8ff, 40); this.fx.ring(p.x, this.y, p.z, COMBAT.specialRadius * 0.7, 0xffffff, 28);
          this.fx.flash(p.x, this.y + 0.6, p.z, 0x9be8ff, 5.2, 0.5, 1); this.fx.flash(p.x, this.y + 0.9, p.z, 0xffffff, 2.4, 0.22, 0.9);
          this.fx.burst(p.x, this.y + 0.6, p.z, 0xdff6ff, 36, 4.8, 0.85, 1.5, 3.5);
          this.sfx.play('hit', 2); this.shake = Math.max(this.shake, 0.24);
          let hits = 0;
          for (const en of this.chars.alive()) if (inRadius(this.pos, en.enemy.pos, COMBAT.specialRadius, en.enemy.def.radius * 0.9)) { this.damageEnemy(en, COMBAT.specialDamage, ev.swingId); hits++; }
          if (hits > 0) this.hitStop = Math.max(this.hitStop, 0.08);
          break;
        }
        case 'end':
          if (ev.from === 'dodge') this.fx.burst(this.pos.x, this.y + 0.1, this.pos.z, 0xe8e0c8, 6, 1.4, 0.35, 1, 0.5); // a little puff as the roll ends
          break;
      }
    }
  }
  private nearestEnemy(range: number): EnemyEntry | null {
    let best: EnemyEntry | null = null, bd = range;
    for (const en of this.chars.alive()) { const d = Math.hypot(en.enemy.pos.x - this.pos.x, en.enemy.pos.z - this.pos.z) - en.enemy.def.radius; if (d < bd) { bd = d; best = en; } }
    return best;
  }

  // ---------- respawn / reset ----------
  private checkpoint() { if (this.area === 'shore') { const c = shoreCheckpoint(this.shore, this.pos, SHORE_SPAWN); return { x: c.x, z: c.z, heading: Math.PI }; } if (this.area === 'hollow') { const c = hollowCheckpoint(this.hollow, this.pos, HOLLOW_SPAWN); return { x: c.x, z: c.z, heading: Math.PI }; } return this.progress.stage === 'boss' ? { x: ARENA_ENTRANCE.x, z: ARENA_ENTRANCE.z, heading: Math.PI } : { x: SPAWN.x, z: SPAWN.z, heading: Math.PI }; }
  private checkpointRespawn(resetEnemies: boolean): void {
    const c = this.checkpoint();
    this.pos.x = c.x; this.pos.z = c.z; this.heading = c.heading; this.y = this.groundY(c.x, c.z); this.vel.x = this.vel.z = 0; this.knock.x = this.knock.z = 0;
    this.camYaw = 0;
    if (resetEnemies) { this.chars.clear(); this.applyWorldState(); }
  }
  private startOver(): void {
    this.progress = newProgress(); saveProgress(this.progress);
    this.hollow = newHollow(); saveHollow(this.hollow); this.shore = newShore(); saveShore(this.shore); this.wilds = newWilds(); saveWilds(this.wilds); this.wildsWorld.setState(this.wilds); this.wildsTalkWho = null; this.ringAttempt = []; this.boardSeen = false; this.shellTipShown = false; this.heronAnnounced = false; this.transition = null; if (this.area !== 'woods') this.setArea('woods', true); this.shoreWorld?.setTide('still', false); this.shoreWorld?.setCauseway(false, false); this.shoreWorld?.setGlass([]); this.shoreWorld?.setBottles([]); this.shoreWorld?.setSolved(false); this.shoreWorld?.setLampLit(false, false); this.mak.setLit(false); this.keeper.setLit(false); this.hollowWorld?.setGates({ doorOpen: false, secretOpen: false }, false); this.hollowWorld?.setShards([]); this.hollowWorld?.setGlowcaps([]); this.hollowWorld?.setEchoesDone(false); this.hollowWorld?.resetEchoes(); this.hollowWorld?.setHeartLit(false); this.hollowWorld?.setTablets([]); this.hollowWorld?.setWardenDown(true); this.glim.setLit(false); this.glimGreeted = false; this.talkAt = null; this.talkWho = null; this.weakTipShown = false; this.wardenAnnounced = false; this.echoStep = 0; this.muralSeen = false;
    this.cosmetics = sanitizeCosmetics(this.cosmetics, ownershipOf(this.progress)); this.applyCosmetics();
    this.petals.forEach(p => { p.collected = false; p.root.visible = true; });
    this.clock = 0; this.startHint = true; this.chars.clear(); this.endSeen = false; this.vitals.respawn(); this.faintT = null; this.hud.fadeTo(false);
    this.hud.closePause(); this.hud.closeDialogue(); this.hud.showBoss(null);
    this.checkpointRespawn(false); this.applyWorldState(true); this.refreshHud(); this.refreshPauseContext();
  }

  // ---------- frame ----------
  private dtCache = 0;
  private frame(nowMs: number): void {
    if (!this.running) return;
    const realDt = clampDeltaSeconds((nowMs - (this.lastNow || nowMs)) / 1000); this.lastNow = nowMs;
    // v2.12 hit-stop: the world nearly freezes for a few frames when a blow lands, which is what makes a hit feel heavy
    let dt = realDt;
    if (this.hitStop > 0) { this.hitStop -= realDt; dt = realDt * 0.05; }
    this.dtCache = dt;
    this.time += dt;
    this.input.enabled = !this.hud.blocking;
    // While a menu or riddle covers the game (not the wardrobe, which shows the hero) only every third frame is drawn: the picture
    // behind a menu hardly moves, and phones stay cooler and last longer.
    if (this.hud.blocking && !this.wardrobe.isOpen && this.wardrobeK === 0 && !this.map.isOpen) { if (++this.menuFrame % 3 !== 0) return; } else this.menuFrame = 0;
    this.trackFps(realDt);
    if (!this.hud.blocking) this.simulate(dt);
    else { this.updateWorld(); this.runeStone.update(this.time); this.tickElder(); if (this.wardrobe.isOpen) this.updateWardrobePreview(dt); }
    this.updateDayNight(dt);
    this.updateCamera(dt);
    this.fx.update(dt);
    if (this.map.isOpen) this.map.update({ x: this.pos.x, z: this.pos.z, heading: this.heading, hollow: this.hollow, shore: this.shore, wilds: this.wilds, targets: this.area === 'shore' ? shoreTargets(this.shore, this.ringAttempt, this.boardSeen) : this.area === 'hollow' ? hollowTargets(this.hollow, this.echoStep, this.muralSeen) : [...questTargets(this.progress, this.chars.alive().map(e => ({ x: e.enemy.pos.x, z: e.enemy.pos.z }))), ...(this.shoreNext() ? [{ x: SHORE_ARCH.x, z: SHORE_ARCH.z }] : [])] }, this.time);
    this.updatePortrait(dt);
    if (this.wardrobe.isOpen || this.heroPanel.isOpen) this.thumbs.pump(this.wardrobe.isOpen ? 3 : 2);
    this.renderer.render(this.scene, this.camera);
  }
  private lastNow = 0;

  /** Sky, fog, lights, lamps, fireflies and the sound of the time of day. The clock only runs while the game does. */
  private updateDayNight(dt: number): void {
    const phase = this.frozenPhase ?? phaseAt(this.clock), cave = this.area === 'hollow', coast = this.area === 'shore';
    this.world.applyLook(cave ? HOLLOW_LOOK : lookForPhase(phase)); this.world.setLampGlow(cave ? 0 : lampLevel(phase)); this.wildsWorld?.setNight(cave ? 0 : lampLevel(phase)); this.shoreWorld?.setLampLevel(lampLevel(phase));
    this.fireflies.update(this.time, this.pos, cave || coast || isOff('fireflies') ? 0 : fireflyLevel(phase));
    this.butterflies.update(this.time, this.pos, cave || coast || isOff('butterflies') ? 0 : 1 - Math.min(1, fireflyLevel(phase) * 1.6));
    this.sfx.duck(this.hud.blocking);
    this.ambienceTimer -= dt;
    if (this.ambienceTimer <= 0) {
      this.ambienceTimer = 0.3; const tod = timeOfDayAt(phase);
      // inside the cave there are no birds, crickets or wind: only the music
      this.sfx.setAmbience(cave ? { river: 0, night: 0, daylight: 0, gust: 0 } : { river: coast ? 0.55 : 0, night: tod.night, daylight: tod.daylight, gust: gustLevel(this.time * 1000) });
    }
  }

  /** The hero shows off the outfit: turns slowly until you drag, and does the move picked in the panel. */
  private updateWardrobePreview(dt: number): void {
    this.previewIdle += dt; if (this.previewIdle > 3) this.wardrobeHeading += dt * 0.5;
    const t = this.time, inp = previewPoseInput(this.previewPose, t);
    this.hero.root.position.set(this.pos.x, this.y, this.pos.z); this.hero.root.rotation.y = this.wardrobeHeading;
    this.hero.pose({ speed: inp.speed, time: t, attack: inp.attack, dodge: null, special: inp.special, faint: 0 });
    this.hero.setFlash(0);
  }

  private simulate(dt: number): void {
    this.clock += dt;
    const inp = this.input.read();
    const busyTalking = this.hud.dialogueOpen;
    const canControl = this.faintT === null && !busyTalking && this.transition === null;
    this.camYaw = wrapAngle(this.camYaw + this.input.takeYaw() + inp.yawRate * 1.9 * dt);

    // faint sequence: fall, fade, return to the checkpoint with full hearts
    if (this.faintT !== null) {
      this.faintT += dt;
      if (this.faintT > 0.9) this.hud.fadeTo(true);
      if (this.faintT > 1.8) {
        this.vitals.respawn(); this.faintT = null; this.combat.state = 'free'; this.combat.t = 0;
        this.checkpointRespawn(true); this.hud.setHearts(this.vitals.hp, this.vitals.maxHp); this.lastHearts = this.vitals.hp; this.hud.fadeTo(false);
        this.hud.toast(this.strings.toast.fainted, 2500);
      }
    }
    this.vitals.update(dt);

    if (canControl) this.handleCombatEvents(); else this.combat.update(0);

    // ground movement
    let speed = 0;
    if (canControl && this.combat.state === 'free') {
      const sp = speedForInput(inp.magnitude, inp.run);
      const want = cameraRelativeVelocity(inp.x, inp.y, this.camYaw, sp);
      const k = smoothingFactor(want.x || want.z ? 16 : 22, dt);
      this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
      speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.35) this.heading = turnToward(this.heading, headingOf(this.vel.x, this.vel.z), 13 * dt);
    } else if (this.combat.state === 'attack') {
      const step = this.combat.comboStep; const lunge = this.combat.t < (step === 2 ? 0.24 : 0.2) ? [2.6, 3.0, 4.0][step] : 0;
      this.vel.x = Math.sin(this.heading) * lunge; this.vel.z = Math.cos(this.heading) * lunge;
    } else if (this.combat.state === 'dodge') {
      const s = this.combat.t / COMBAT.dodgeDuration; const v = (COMBAT.dodgeDistance / COMBAT.dodgeDuration) * (1.4 * (1 - s) + 0.3);
      this.vel.x = this.dodgeDir.x * v; this.vel.z = this.dodgeDir.z * v; speed = v * 0.3;
      // afterimages along the path and a thread of dust at the feet
      this.ghostTimer -= this.dtCache;
      if (this.ghostTimer <= 0 && s < 0.8) { this.ghostTimer = 0.055; this.fx.ghost(this.pos.x, this.y, this.pos.z, 0x8fdcff, 0.85, 1.6, 0.3, 0.5); }
      if (Math.random() < 0.7) this.fx.spray(this.pos.x, this.y + 0.1, this.pos.z, -this.dodgeDir.x, -this.dodgeDir.z, 0xe8e0c8, 1, 1.2, 0.6, 0.3, 0.5, 0.4);
    } else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    if (busyTalking) {
      this.vel.x = this.vel.z = 0;
      const at = this.talkAt ?? ELDER_POS; this.heading = turnToward(this.heading, headingOf(at.x - this.pos.x, at.z - this.pos.z), 8 * dt);
    }
    // knockback decays quickly
    this.knock.x *= Math.exp(-9 * dt); this.knock.z *= Math.exp(-9 * dt);
    let nx = this.pos.x + (this.vel.x + this.knock.x) * dt, nz = this.pos.z + (this.vel.z + this.knock.z) * dt;
    // enemies are solid for the hero (except mid-roll)
    if (!this.combat.invulnerable) for (const en of this.chars.alive()) {
      const dx = nx - en.enemy.pos.x, dz = nz - en.enemy.pos.z, d = Math.hypot(dx, dz), min = HERO_RADIUS + en.enemy.def.radius * 0.8;
      if (d < min && d > 1e-5) { nx = en.enemy.pos.x + (dx / d) * min; nz = en.enemy.pos.z + (dz / d) * min; }
    }
    const r = resolveCircles(this.grid, nx, nz, HERO_RADIUS);
    nx = r.x; nz = r.z;
    if (this.area === 'woods' && !thornsOpen(this.wilds)) { const t = resolveCircles(this.thornGrid, nx, nz, HERO_RADIUS); nx = t.x; nz = t.z; }
    if (this.area === 'hollow') { const c = clampToFloor(nx, nz); nx = c.x; nz = c.z; } else if (this.area === 'shore') { const c = clampShoreFloor(gatesOf(this.shore), nx, nz); nx = c.x; nz = c.z; } else { const dist = Math.hypot(nx, nz); if (dist > PLAY_RADIUS) { nx *= PLAY_RADIUS / dist; nz *= PLAY_RADIUS / dist; } }
    this.pos.x = nx; this.pos.z = nz; this.y = this.groundY(nx, nz);

    if (this.area === 'woods') { this.updateEnemies(dt); this.updatePatrol(dt); this.updatePetals(dt); this.updateElder(dt); this.updateWilds(dt); } else if (this.area === 'shore') this.updateShore(dt); else this.updateHollow(dt);
    this.updatePortals(); this.updateTransition(dt);
    this.ambient(dt, speed);
    this.updateWorld();

    // hero model
    const c = this.combat;
    this.hero.root.position.set(this.pos.x, this.y, this.pos.z); this.hero.root.rotation.y = this.heading;
    this.hero.pose({
      speed, time: this.time,
      attack: c.state === 'attack' ? c.t / COMBAT.attackDuration : null,
      combo: c.comboStep,
      dodge: c.state === 'dodge' ? c.t / COMBAT.dodgeDuration : null,
      special: c.state === 'special' ? c.t / COMBAT.specialDuration : null,
      faint: this.faintT === null ? 0 : Math.min(1, this.faintT / 0.5),
      talking: busyTalking,
    });
    // spirit glow while the dodge makes the hero untouchable (it flickers a little so it reads as a magic effect, not a lighting bug)
    this.phaseK += ((c.invulnerable ? 1 : 0) - this.phaseK) * smoothingFactor(22, this.dtCache);
    this.hero.setPhase(this.phaseK < 0.02 ? 0 : this.phaseK * (0.8 + 0.2 * Math.sin(this.time * 42)));
    this.hero.setFlash(this.vitals.hurtInvulnerable && this.faintT === null ? (Math.sin(this.time * 38) > 0 ? 0.55 : 0) : 0);

    // HUD
    this.input.setCooldown('attack', c.cooldownFraction('attack')); this.input.setCooldown('dodge', c.cooldownFraction('dodge')); this.input.setCooldown('special', c.cooldownFraction('special'));
    const stone = this.nearRuneStone() && !this.nearElder() && !this.puzzle.isOpen;
    const near = (this.nearElder() || stone || this.hollowTarget() !== null || this.shoreTarget() !== null || this.wildsLabel() !== null) && !busyTalking && this.faintT === null && this.transition === null;
    this.runeStone.setNear(stone && near);
    this.input.setTalk(near);
    const hot = this.area === 'hollow' ? this.hollowTarget() : null, hollowLabel = hot?.kind === 'tablet' ? this.strings.ui.read : hot?.kind === 'glim' ? this.strings.ui.talk : null;
    const shoreLabel = this.shoreLabel() ?? this.wildsLabel();
    this.input.setTalkLabel(stone ? this.strings.ui.read : hollowLabel ?? shoreLabel ?? this.labels().talk);
    if (this.startHint && Math.hypot(this.pos.x - SPAWN.x, this.pos.z - SPAWN.z) > 4) this.startHint = false;
    if (near && stone) this.hud.setHint(this.input.touch ? this.strings.ui.read : `${this.strings.ui.read}: E`);
    else if (near && !this.input.touch) this.hud.setHint(`${this.area === 'hollow' ? hollowLabel ?? this.ht.ui.use : this.area === 'shore' ? shoreLabel ?? this.ht.ui.use : shoreLabel ?? this.strings.ui.talk}: E`);
    else if (this.startHint && !busyTalking) this.hud.setHint(this.input.touch ? this.strings.ui.moveHint : this.strings.controlsHelp[0]);
    else this.hud.setHint(null);
    if (this.vitals.hp !== this.lastHearts) { this.hud.setHearts(this.vitals.hp, this.vitals.maxHp); this.lastHearts = this.vitals.hp; }
  }
  private startHint = this.progress.stage === 'talk';

  /**
   * v2.21 Woods patrol: once the quest is done, calmed sprouts keep returning (never more than PATROL_MAX at a time, one every few
   * seconds, always out of sight of the hero) until the bonus pool is used up. This is what gives the free-roam time after the
   * Moonlit Gate something to do and lets the level-5 rewards be earned. Pauses with every menu and while the hero is down.
   */
  private patrolT = 8; private patrolTold = false;
  private updatePatrol(dt: number): void {
    const p = this.progress;
    if (this.area !== 'woods' || p.stage !== 'complete' || p.bonusXp >= BONUS_XP_CAP || this.faintT !== null || this.hud.blocking) return;
    const live = this.chars.all().filter(c => !c.enemy.defeated);
    if (live.filter(c => c.enemy.def.kind === 'sprout').length >= PATROL_MAX) return;
    this.patrolT -= dt; if (this.patrolT > 0) return;
    const free = SPROUT_SPOTS.filter(sp => Math.hypot(sp.x - this.pos.x, sp.z - this.pos.z) >= 9 && !live.some(c => Math.hypot(c.enemy.pos.x - sp.x, c.enemy.pos.z - sp.z) < 3));
    if (!free.length) { this.patrolT = 2; return; }
    this.spawnEnemy('sprout', free[Math.floor(Math.random() * free.length)], true);
    this.patrolT = PATROL_RESPAWN_S;
    if (!this.patrolTold) { this.patrolTold = true; this.hud.toast(this.strings.toast.patrol, 4800, 'sprout'); }
  }

  /** Runs every creature in whichever area the hero is in (the sprouts and Mossback in the woods; Shardlings and the Warden in the Hollow). */
  private updateEnemies(dt: number): void {
    const hollow = this.area === 'hollow', coast = this.area === 'shore';
    let bossBar: number | null = null; let bossName: string | undefined; let arenaGlow = 0.1; let boss: { x: number; z: number } | null = null; let focus = 0;
    for (const en of this.chars.all()) {
      const e = en.enemy;
      if (!e.defeated) {
        const ev = e.update(this.faintT === null ? dt : 0, this.pos);
        const solid = resolveCircles(this.grid, e.pos.x, e.pos.z, e.def.radius * 0.8);
        e.pos.x = solid.x; e.pos.z = solid.z;
        if (hollow) {   // the cave's creatures stay on the cave floor, and the Warden never leaves its chamber
          const c = e.def.kind === 'warden' ? clampToArena(e.pos.x, e.pos.z) : clampToFloor(e.pos.x, e.pos.z, 0.5); e.pos.x = c.x; e.pos.z = c.z;
        } else if (coast) {   // the shore: crabs keep to the sand, the Heron to its island; gulls roam over the water but not far from home
          if (e.def.kind === 'heron') { const c = clampShoreArena(e.pos.x, e.pos.z); e.pos.x = c.x; e.pos.z = c.z; }
          else if (e.def.kind === 'crab') { const c = clampShoreFloor(gatesOf(this.shore), e.pos.x, e.pos.z, 0.5); e.pos.x = c.x; e.pos.z = c.z; }
        } else { const dFromHome = Math.hypot(e.pos.x, e.pos.z); if (dFromHome > PLAY_RADIUS) { e.pos.x *= PLAY_RADIUS / dFromHome; e.pos.z *= PLAY_RADIUS / dFromHome; } }
        this.handleEnemyEvents(en, ev);
        if (e.dashing && Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z) < e.def.radius + 0.5) this.hurtHero(e.def.touchDamage, e.pos);   // a charge or a roll hurts to touch
        if (e.state === 'telegraph') en.marker.setProgress(e.telegraphProgress); else if (en.marker.root.visible) en.marker.hide();
        if (e.def.boss) {
          if (e.def.kind === 'mossback') arenaGlow = e.state === 'idle' ? 0.4 : 1;
          if (e.state !== 'idle' || Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z) < 16) {
            bossBar = e.hp / e.def.maxHp; boss = { x: e.pos.x, z: e.pos.z }; focus = clamp01((14 - Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z)) / 4);
            if (e.def.kind === 'heron') { bossName = SHORE_TEXT[this.lang].boss; if (!this.heronAnnounced && e.state !== 'idle') { this.heronAnnounced = true; this.hud.toast(SHORE_TEXT[this.lang].toast.heronWakes, 4200, 'sparkles'); } }
            if (e.def.kind === 'warden') { bossName = this.ht.boss; if (!this.wardenAnnounced && e.state !== 'idle') { this.wardenAnnounced = true; this.hud.toast(this.ht.toast.wardenWakes, 4200, 'sparkles'); } }
          }
        }
      } else {
        en.marker.hide();
        if (!en.finale && e.poof >= e.def.deathTime * (e.def.boss ? 0.6 : 0.5)) { en.finale = true; this.defeatFinale(en); }
      }
      en.view.update(this.time, dt, this.groundY(e.pos.x, e.pos.z));
      for (const c of en.view.takeCues()) this.enemyCue(c);
    }
    // the camera pulls back and looks a little toward the boss while it is awake, so the whole fight (not just its feet) is in view
    this.bossK += (focus - this.bossK) * smoothingFactor(1.6, dt); if (boss) this.bossAt = boss;
    this.chars.prune();
    this.hud.showBoss(this.faintT === null ? bossBar : null, bossName);
    if (!hollow && !coast) this.world.setArenaGlow(this.progress.bossDefeated || this.progress.stage === 'return' || this.progress.stage === 'complete' ? 0 : arenaGlow);
  }

  private updatePetals(dt: number): void {
    void dt;
    let count = this.progress.petalIds.length;
    for (const p of this.petals) {
      if (p.collected) continue;
      p.update(this.time);
      if (this.progress.stage === 'talk' || this.faintT !== null) continue;
      const sp = PETAL_SPOTS[p.id];
      if (Math.hypot(this.pos.x - sp.x, this.pos.z - sp.z) < PETAL_RANGE) {
        p.collected = true; p.root.visible = false; count++; this.hero.cheer();
        this.fx.burst(sp.x, this.groundY(sp.x, sp.z) + 0.8, sp.z, 0xffa8e8, 26, 3, 0.9, 1.5, 2.5); this.fx.flash(sp.x, this.groundY(sp.x, sp.z) + 0.9, sp.z, 0xff9fe0, 3.2, 0.5); this.fx.beam(sp.x, this.groundY(sp.x, sp.z), sp.z, 0xff9fe0, 3, 0.7, 0.3);
        this.sfx.play('petal', Math.min(count, PETALS_NEEDED) - 1);
        this.applyQuest({ kind: 'petal', id: p.id }, { x: sp.x, y: this.groundY(sp.x, sp.z) + 1.4, z: sp.z });
      }
    }
  }

  private updateElder(dt: number): void {
    const toHero = this.nearElder() || this.hud.dialogueOpen;
    const target = toHero ? headingOf(this.pos.x - ELDER_POS.x, this.pos.z - ELDER_POS.z) : 0;
    this.elderFacing = turnToward(this.elderFacing, target, 4 * dt);
    // a friendly wave when the hero walks up (once per visit)
    const d = Math.hypot(this.pos.x - ELDER_POS.x, this.pos.z - ELDER_POS.z);
    if (!this.elderGreeted && d < TALK_RANGE * 1.8 && !this.hud.dialogueOpen) { this.elderGreeted = true; this.elder.wave(); }
    else if (d > TALK_RANGE * 2.6) this.elderGreeted = false;
    this.tickElder();
  }
  private elderGreeted = false;
  /** Animates the Elder: he nods and gestures while the conversation is open, and sparkles when he cheers. */
  private tickElder(): void {
    this.elder.setTalking(this.hud.dialogueOpen && this.area === 'woods');
    this.elder.update(this.time, this.elderFacing);
    if (this.elder.takeCheerCue()) {
      const y = heightAt(ELDER_POS.x, ELDER_POS.z);
      this.fx.burst(ELDER_POS.x, y + 2.0, ELDER_POS.z, 0xffe066, 34, 3.2, 1.1, 0.6, 2.6); this.fx.flash(ELDER_POS.x, y + 1.7, ELDER_POS.z, 0xbfffd8, 3.6, 0.5, 0.8); this.fx.ring(ELDER_POS.x, y, ELDER_POS.z, 2.4, 0xbfffd8, 28);
    }
  }

  // ---------- v2.22 Crystal Hollow ----------
  /** True while the next thing to do is walk through the driftwood arch to Moonwake Shore. */
  private shoreNext(): boolean { return this.hollow.heartDone && this.progress.stage === 'complete' && !this.shore.visited; }
  private shoreBeamT = 0;
  private objectiveText(): string {
    if (this.area === 'woods' && this.shoreNext()) return this.wt.next.shoreObjective;
    if (this.area === 'shore') return shoreObjective(this.lang, this.shore, { inside: true, rung: this.ringAttempt.length, boardSeen: this.boardSeen });
    if (this.area === 'hollow') return hollowObjective(this.lang, this.hollow, { inside: true, step: this.echoStep, muralSeen: this.muralSeen });
    if (this.progress.stage === 'complete') { const t = hollowObjective(this.lang, this.hollow, { inside: false, step: 0, muralSeen: false }); if (t) return t; if (this.hollow.heartDone) { const u = shoreObjective(this.lang, this.shore, { inside: false, rung: 0, boardSeen: false }); if (u) return u; } } // until the Heartstone is touched the card points at the Hollow
    if (this.progress.stage === 'complete') return this.wildsObjective() ?? objectiveLine(this.lang, this.progress);
    return objectiveLine(this.lang, this.progress);
  }
  private objectiveCount(): { done: number; total: number } | null {
    if (this.area === 'shore') { const s = this.shore; if (!causewayOpen(s)) return this.boardSeen && s.mak > 0 ? { done: this.ringAttempt.length, total: 3 } : null; return s.mak === 1 && !s.lampLit ? null : null; }
    if (this.area !== 'hollow') return objectiveProgress(this.progress);
    const h = this.hollow;
    if (!h.doorOpen) return this.muralSeen ? { done: this.echoStep, total: ECHO_COLORS.length } : null;
    return h.heartDone ? { done: h.shards.length, total: SHARD_COUNT } : null;
  }
  private elderLines(stage: WoodsStage): string[] { return stage === 'complete' ? (this.hollow.heartDone ? (this.shore.lampLit ? SHORE_TEXT[this.lang].elderShoreDone : SHORE_TEXT[this.lang].elderToShore) : this.ht.elderComplete) : this.strings.elder[stage]; }

  // ---------- v2.31 the wider woods ----------
  private get wt() { return WILDS_TEXT[this.lang]; }
  private wildsFill(t: string, v: Record<string, string | number>): string { return t.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? '')); }
  private wildsXp(xp: number, at: { x: number; z: number }): void { if (xp > 0) this.applyQuest({ kind: 'wilds', xp }, { x: at.x, y: this.groundY(at.x, at.z) + 1.6, z: at.z }); }
  private saveWildsNow(): void { saveWilds(this.wilds); this.wildsSaveT = 0; }
  private wildsObjective(): string | null {
    const t = this.wt.objective, w = this.wilds;
    for (const who of WHO) { const sc = wildsScript(w, who); if (sc === 'report') return t.report[who]; if (sc === 'waiting') { const c = errandCount(w, who); return this.wildsFill(t.errand[who], { n: c.have, total: c.need }); } }
    if (w.acorns.length < ACORN_COUNT && w.zones.length >= 3) return this.wildsFill(t.acorns, { n: w.acorns.length, total: ACORN_COUNT });
    return w.zones.length >= ZONES.length && w.acorns.length >= ACORN_COUNT && w.chests.length >= CHEST_COUNT_ ? t.allDone : t.explore;
  }
  /** What the use button would do right now in the wider woods (nearest thing within reach), or null. */
  private wildsTarget(): { kind: 'chest' | 'lantern' | 'tablet' | 'sign' | 'gate' | 'door' | 'person'; id: number | string } | null {
    if (this.area !== 'woods' || this.transition || this.hud.dialogueOpen) return null;
    const px = this.pos.x, pz = this.pos.z; let best: { kind: 'chest' | 'lantern' | 'tablet' | 'sign' | 'gate' | 'door' | 'person'; id: number | string } | null = null, bd = Infinity;
    const test = (kind: 'chest' | 'lantern' | 'tablet' | 'sign' | 'gate' | 'door' | 'person', id: number | string, x: number, z: number, range: number): void => { const d = Math.hypot(px - x, pz - z); if (d < range && d < bd) { bd = d; best = { kind, id }; } };
    if (Math.abs(px) < 95 && Math.abs(pz) < 95) {
      CHEST_SPOTS.forEach((c, i) => test('chest', i, c.x, c.z, 2.5)); LANTERN_SPOTS.forEach((c, i) => test('lantern', i, c.x, c.z, 2.3)); WILDS_TABLET_SPOTS.forEach((c, i) => test('tablet', i, c.x, c.z, 2.3));
      SIGN_SPOTS.forEach(c => test('sign', c.id, c.x, c.z, 2.2)); PEOPLE.forEach(c => test('person', c.id, c.at.x, c.at.z, 2.7));
      test('gate', 'gate', MIST_GATE.x, MIST_GATE.z, MIST_GATE.trigger + 1.5); test('door', 'door', UNDERCROFT_DOOR.x, UNDERCROFT_DOOR.z, UNDERCROFT_DOOR.trigger + 1);
    }
    return best;
  }
  private wildsLabel(): string | null {
    const w = this.wildsTarget(); if (!w) return null; const u = this.wt.ui;
    return w.kind === 'chest' ? (this.wilds.chests.includes(w.id as number) ? u.look : u.open) : w.kind === 'lantern' ? (this.wilds.lanterns.includes(w.id as number) ? u.look : u.light) : w.kind === 'tablet' ? u.read : w.kind === 'person' ? u.talk : u.look;
  }
  private useWilds(w: { kind: 'chest' | 'lantern' | 'tablet' | 'sign' | 'gate' | 'door' | 'person'; id: number | string }): void {
    const T = this.wt;
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0; this.startHint = false; this.hud.setHint(null);
    const say = (name: string, lines: string[], at: { x: number; z: number }, after?: () => void): void => { this.talkAt = at; this.talkWho = 'wilds'; this.hud.openDialogue(name, lines, () => { this.talkAt = null; this.talkWho = null; this.wildsTalkWho = null; after?.(); }); this.sfx.play('talk'); };
    switch (w.kind) {
      case 'chest': {
        const id = w.id as number, c = CHEST_SPOTS[id];
        if (this.wilds.chests.includes(id)) { this.hud.toast(T.toast.chestEmpty, 2200, 'sparkles'); return; }
        const r = openChest(this.wilds, id); this.wilds = r.state; this.saveWildsNow(); this.wildsWorld.setChest(id, true);
        this.fx.burst(c.x, this.groundY(c.x, c.z) + 0.9, c.z, 0xffe08a, 40, 3.2, 1.1, 1.6, 2.8); this.fx.flash(c.x, this.groundY(c.x, c.z) + 1, c.z, 0xffe08a, 3.4, 0.6); this.sfx.play('fanfare'); this.hero.cheer(1.2);
        this.hud.toast(r.all ? T.toast.allChests : T.toast.chest, 3200, 'gift'); this.wildsXp(r.xp, c); this.pulseMapTile(); return;
      }
      case 'lantern': {
        const id = w.id as number, p = LANTERN_SPOTS[id]; if (this.wilds.lanterns.includes(id)) return;
        const r = lightLantern(this.wilds, id); this.wilds = r.state; this.saveWildsNow(); this.wildsWorld.setLantern(id, true);
        this.fx.burst(p.x, this.groundY(p.x, p.z) + 1.6, p.z, 0x9fe8ff, 26, 2.4, 1, 1.2, 2.2); this.sfx.play('petal', this.wilds.lanterns.length);
        this.hud.toast(r.all ? T.toast.lanternsDone : this.wildsFill(T.toast.lantern, { n: this.wilds.lanterns.length, total: LANTERN_COUNT }), 3000, 'sparkles'); this.wildsXp(r.xp, p); return;
      }
      case 'tablet': {
        const id = w.id as number, p = WILDS_TABLET_SPOTS[id], first = !this.wilds.tablets.includes(id);
        say(T.tablet.name, T.tablet.lines[id] ?? T.tablet.lines[0], p, () => {
          if (!first) return; const r = readWildsTablet(this.wilds, id); this.wilds = r.state; this.saveWildsNow();
          this.hud.toast(r.all ? T.toast.allTablets : this.wildsFill(T.toast.tablet, { n: this.wilds.tablets.length, total: WILDS_TABLET_COUNT }), 2800, 'sparkles'); this.wildsXp(r.xp, p);
        }); return;
      }
      case 'sign': { const sp = SIGN_SPOTS.find(q => q.id === w.id)!; say(T.sign.name, T.sign.lines[w.id as string] ?? [''], sp); return; }
      case 'gate': say(T.gate.name, T.gate.lines, MIST_GATE); return;
      case 'door': say(T.door.name, T.door.lines, UNDERCROFT_DOOR); return;
      case 'person': this.talkToWilds(w.id as Who); return;
    }
  }
  private pulseMapTile(): void { /* the map tile pulses with the rest of the bag tiles in refreshHud */ }
  private talkToWilds(who: Who): void {
    const T = this.wt, P = T[who], sc = wildsScript(this.wilds, who), at = PEOPLE.find(q => q.id === who)!.at, npc = this.wildsWorld.npcs[who], c = errandCount(this.wilds, who);
    this.talkAt = at; this.talkWho = 'wilds'; this.wildsTalkWho = who; npc.wave(1.2);
    const lines = sc === 'intro' ? P.intro : sc === 'waiting' ? P.waiting.map(l => this.wildsFill(l, { n: c.have, total: c.need })) : sc === 'report' ? P.report : P.thanks;
    const ask = sc === 'report' ? (P.ask ? this.gateQuestion(P.ask, who === 'din' ? 'clock' : 'money') : this.gateQuestion()) : undefined;
    this.hud.openDialogue(P.name, lines, () => {
      this.talkAt = null; this.talkWho = null; this.wildsTalkWho = null;
      if (sc === 'intro') { this.wilds = wildsAsked(this.wilds, who); this.saveWildsNow(); this.hud.toast(T.toast[`${who}Met` as 'taniMet'], 3200, 'sparkles'); this.refreshHud(); }
      else if (sc === 'report') {
        const r = wildsClaim(this.wilds, who); if (r.xp === 0) return;   // paid once
        this.wilds = r.state; this.saveWildsNow(); npc.setLit(true); this.hero.cheer(1.6); this.sfx.play('fanfare'); this.hud.toast(T.toast[`${who}Done` as 'taniDone'], 4200, 'sparkles');
        if (who === 'lumut') { this.wildsWorld.setThorns(true); setTimeout(() => this.hud.toast(T.toast.thorns, 3600, 'sparkles'), 1500); }
        this.wildsXp(r.xp, at); this.refreshHud();
      }
    }, ask);
    this.sfx.play('talk');
  }
  /** Per frame in the woods: pickups, region discovery, the map's fog of war, and the three people (turning, markers). */
  private updateWilds(dt: number): void {
    if (this.shoreNext()) { this.shoreBeamT -= dt; if (this.shoreBeamT <= 0) { this.shoreBeamT = 2.2; this.fx.beam(SHORE_ARCH.x, this.groundY(SHORE_ARCH.x, SHORE_ARCH.z), SHORE_ARCH.z, 0xbfe4ff, 9, 1.8, 0.6); } }
    if (this.faintT !== null) return;
    const px = this.pos.x, pz = this.pos.z, T = this.wt;
    const take = (spots: readonly { x: number; z: number }[], have: readonly number[], fn: (s: WildsState, id: number) => { state: WildsState; xp: number; first: boolean; all?: boolean }, kind: 'acorn' | 'pumpkin' | 'pearl', fx: number, text: string, bonusText?: string): void => {
      if (have.length >= spots.length) return;
      for (let i = 0; i < spots.length; i++) {
        if (have.includes(i)) continue; const sp = spots[i];
        if (Math.abs(px - sp.x) > 1.6 || Math.abs(pz - sp.z) > 1.6 || Math.hypot(px - sp.x, pz - sp.z) > 1.5) continue;
        const r = fn(this.wilds, i); if (!r.first) continue;
        this.wilds = r.state; this.saveWildsNow(); this.wildsWorld.collect(kind, i); this.hero.cheer();
        const gy = this.groundY(sp.x, sp.z); this.fx.burst(sp.x, gy + 0.7, sp.z, fx, 22, 2.6, 0.9, 1.3, 2.2); this.fx.flash(sp.x, gy + 0.8, sp.z, fx, 2.6, 0.45);
        const n = (kind === 'acorn' ? this.wilds.acorns : kind === 'pumpkin' ? this.wilds.pumpkins : this.wilds.pearls).length;
        this.sfx.play('petal', Math.min(n, 8) - 1);
        this.hud.toast(r.all && bonusText ? bonusText : this.wildsFill(text, { n, total: spots.length }), 2400, 'sparkles'); this.wildsXp(r.xp, sp);
        if (r.all && kind === 'pumpkin') this.hud.toast(T.toast.pumpkinsDone, 3600, 'sparkles'); if (r.all && kind === 'pearl') this.hud.toast(T.toast.pearlsDone, 3600, 'sparkles');
      }
    };
    take(ACORN_SPOTS, this.wilds.acorns, collectAcorn, 'acorn', 0xffd860, T.toast.acorn, T.toast.allAcorns);
    take(PUMPKIN_SPOTS, this.wilds.pumpkins, collectPumpkin, 'pumpkin', 0xffb040, T.toast.pumpkin);
    take(PEARL_SPOTS, this.wilds.pearls, collectPearl, 'pearl', 0x9fe8ff, T.toast.pearl);
    void ACORN_XP; void PUMPKIN_COUNT; void PEARL_COUNT;
    // discovery of regions
    const zid = zoneAt(px, pz);
    if (zid && !this.wilds.zones.includes(zid)) {
      const r = discoverZone(this.wilds, zid), z = zoneById(zid)!;
      if (r.first) { this.wilds = r.state; this.saveWildsNow(); this.sfx.play('fanfare'); this.hero.cheer(0.8); this.hud.toast(this.wildsFill(z.hidden ? T.toast.hiddenFound : T.toast.discover, { name: T.zones[z.id] }), 3600, z.hidden ? 'star' : 'sparkles'); this.wildsXp(r.xp, { x: px, z: pz }); this.refreshHud(); if (!this.wildsTipShown) { this.wildsTipShown = true; setTimeout(() => this.hud.toast(T.toast.fogHint, 3600, 'sparkles'), 3800); } }
    }
    // fog of war: mark what the hero can see, twice a second, and save a few seconds after anything changed
    this.wildsExploreT += dt; this.wildsSaveT += dt;
    if (this.wildsExploreT > 0.5) { this.wildsExploreT = 0; const n = markExplored(this.wilds, px, pz, 16); if (n !== this.wilds) { this.wilds = n; this.wildsSaveT = Math.max(this.wildsSaveT, 0) ; if (this.wildsSaveT > 6) this.saveWildsNow(); } }
    // the people: face the hero when close, show a marker when they have something to say
    for (const pe of PEOPLE) {
      const npc = this.wildsWorld.npcs[pe.id], d = Math.hypot(px - pe.at.x, pz - pe.at.z); if (d > 40) continue;
      const sc = wildsScript(this.wilds, pe.id), face = d < 6 ? Math.atan2(px - pe.at.x, pz - pe.at.z) : pe.facing;
      npc.setMarker(sc === 'intro' || sc === 'report'); npc.setTalking(this.hud.dialogueOpen && this.wildsTalkWho === pe.id); npc.setLit(this.wilds[pe.id] === 2);
      npc.update(this.time, face);
    }
    void exploredShare;
  }

  /** Updates whichever area the hero is in: the woods' gate and ruins glow, or the cave's crystals, water and motes. */
  private updateWorld(): void {
    this.updateShoreArch();
    if (this.area === 'shore' && this.shoreWorld) { this.shoreWorld.update(this.time, this.pos); this.world.follow(this.time, this.pos.x, this.pos.z, { y: 0, scenery: false }); }
    else if (this.area === 'hollow' && this.hollowWorld) { this.hollowWorld.update(this.time, this.pos); this.world.follow(this.time, this.pos.x, this.pos.z, { y: 0, scenery: false }); }
    else { this.world.update(this.time); this.world.follow(this.time, this.pos.x, this.pos.z); this.wildsWorld.update(this.time, this.pos.x, this.pos.z); }
  }
  private setWoodsVisible(v: boolean): void {
    this.world.group.visible = v; this.elder.root.visible = v; this.runeStone.root.visible = v; this.glim.root.visible = this.area === 'hollow'; this.mak.root.visible = this.keeper.root.visible = this.area === 'shore';
    for (const p of this.petals) p.root.visible = v && !p.collected;
  }
  /** The cave is built the first time it is needed. */
  private ensureHollow(): HollowWorld {
    if (this.hollowWorld) return this.hollowWorld;
    const hw = new HollowWorld(this.scene, this.quality), h = this.hollow;
    hw.setGates({ doorOpen: h.doorOpen, secretOpen: secretOpen(h) }, false); hw.setShards(h.shards); hw.setGlowcaps(h.glowcaps); hw.setEchoesDone(h.doorOpen); hw.setHeartLit(h.heartDone); hw.setTablets(h.tablets); hw.setWardenDown(!wardenAwake(h));
    this.glim.setLit(h.glim === 2);
    this.hollowWorld = hw; return hw;
  }
  private beginTransition(to: 'woods' | 'hollow' | 'shore'): void {
    if (this.transition) return;
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0;
    this.sfx.play(to === 'woods' ? 'tap' : 'wake', 0); this.transition = { to, t: 0, swapped: false }; this.hud.fadeTo(true);
  }
  private updateTransition(dt: number): void {
    const tr = this.transition; if (!tr) return;
    tr.t += dt;
    if (!tr.swapped && tr.t > 0.55) { tr.swapped = true; this.setArea(tr.to); this.hud.fadeTo(false); }
    if (tr.t > 1.15) this.transition = null;
  }
  /** Moves the hero into the Hollow or back to the woods, with their progress, equipment and quest untouched (only position and what is drawn change). */
  private setArea(a: 'woods' | 'hollow' | 'shore', quiet = false): void {
    if (a === 'woods' && this.area !== 'woods') this.cameFrom = this.area; const left = this.cameFrom;
    this.area = a; this.chars.clear(); this.portalArmed = false; this.input.releaseAll(); this.knock.x = this.knock.z = 0; this.vel.x = this.vel.z = 0;
    if (a === 'hollow') {
      const hw = this.ensureHollow(), first = !this.hollow.visited;
      this.setWoodsVisible(false); hw.visible = true; hw.resetEchoes(); hw.setEchoesDone(this.hollow.doorOpen);
      this.pos.x = HOLLOW_SPAWN.x; this.pos.z = HOLLOW_SPAWN.z; this.y = 0; this.heading = Math.PI;
      this.echoStep = 0; this.muralSeen = false; this.glimGreeted = false; this.talkAt = null; this.talkWho = null; this.wardenAnnounced = false; this.glimFacing = Math.PI * 0.85;
      this.applyWorldState(true);   // the creatures still owed to the Hollow (see spawnHollowCreatures)
      if (first) { this.hollow = markVisited(this.hollow); saveHollow(this.hollow); }
      if (!quiet) this.hud.toast(first ? this.ht.toast.enter : this.ht.name, 4200, 'sparkles');
    } else if (a === 'shore') {
      const sw = this.ensureShore(), first = !this.shore.visited;
      this.setWoodsVisible(false); if (this.hollowWorld) this.hollowWorld.visible = false; sw.visible = true;
      this.pos.x = SHORE_SPAWN.x; this.pos.z = SHORE_SPAWN.z; this.y = 0; this.heading = Math.PI;
      this.ringAttempt = []; this.boardSeen = false; this.makGreeted = false; this.keeperGreeted = false; this.talkAt = null; this.talkWho = null; this.heronAnnounced = false;
      this.applyWorldState(true);
      if (first) { this.shore = { ...this.shore, visited: true }; saveShore(this.shore); }
      if (!quiet) this.hud.toast(first ? SHORE_TEXT[this.lang].toast.enter : SHORE_TEXT[this.lang].name, 4200, 'sparkles');
    } else {
      if (this.hollowWorld) this.hollowWorld.visible = false; if (this.shoreWorld) this.shoreWorld.visible = false;
      this.setWoodsVisible(true);
      if (left === 'shore') { this.pos.x = SHORE_ARCH_TRIGGER.x + 3.0; this.pos.z = SHORE_ARCH_TRIGGER.z; this.heading = Math.PI / 2; } else { this.pos.x = MOONLIT_GATE_TRIGGER.x + 2.6; this.pos.z = MOONLIT_GATE_TRIGGER.z; this.heading = Math.PI / 2; } this.y = this.groundY(this.pos.x, this.pos.z);
      this.patrolT = 6;
      if (!quiet) this.hud.toast(left === 'shore' ? SHORE_TEXT[this.lang].toast.back : this.ht.toast.back, 2800, 'sprout');
      if (!quiet && left !== 'shore' && this.shoreNext()) setTimeout(() => this.hud.toast(this.wt.next.shoreToast, 8000, 'star'), 3000);
    }
    this.camYaw = 0; this.focus.init = false; this.camera.clearViewOffset();
    this.input.setLabels(this.labels()); this.map.setArea(a); this.refreshHud();
  }
  /** The two doorways: the Moonlit Gate into the Hollow (once it is open) and the glowing arch out of it. Each needs the hero to have stepped away first, so a return trip never bounces. */
  private updatePortals(): void {
    if (this.transition) return;
    const doors: { trig: { x: number; z: number; r: number }; to: 'woods' | 'hollow' | 'shore' }[] = this.area === 'woods'
      ? [...(this.progress.gateOpen ? [{ trig: MOONLIT_GATE_TRIGGER, to: 'hollow' as const }] : []), ...(this.hollow.heartDone && this.progress.stage === 'complete' ? [{ trig: SHORE_ARCH_TRIGGER, to: 'shore' as const }] : [])]
      : this.area === 'hollow' ? [{ trig: HOLLOW_EXIT, to: 'woods' as const }] : [{ trig: { x: SHORE_EXIT.x, z: SHORE_EXIT.z, r: SHORE_EXIT.r }, to: 'woods' as const }];
    if (!doors.length) return;
    const near = doors.map(dr => ({ dr, d: Math.hypot(this.pos.x - dr.trig.x, this.pos.z - dr.trig.z) }));
    if (near.every(n => n.d > n.dr.trig.r + 1.2)) this.portalArmed = true;
    const hit = near.find(n => n.d < n.dr.trig.r);
    if (this.portalArmed && hit) { this.portalArmed = false; this.beginTransition(hit.dr.to); }
  }

  private hollowTarget(): HollowTarget | null {
    if (this.area !== 'hollow' || this.transition) return null;
    return hollowTargetAt(this.hollow, this.pos);
  }
  private useHollow(): void {
    const t = this.hollowTarget(); if (!t) return;
    if (t.kind === 'echo') this.activateEcho(t.color); else if (t.kind === 'glim') this.talkToGlim(); else if (t.kind === 'tablet') this.readMoonTablet(t.id); else this.finishHeart();
  }
  /** A blade swing that reaches an Echo Crystal strikes it (the Use button does the same for anyone who prefers to tap). */
  private strikeCrystals(range: number, half: number): void {
    if (this.hollow.doorOpen || this.echoCool > 0) return;
    for (const c of ECHO_COLORS) if (inAttackArc(this.pos, this.heading, ECHO_SPOTS[c], range + 0.7, half, 0.6)) { this.activateEcho(c); break; }
  }
  private activateEcho(color: EchoColor): void {
    const hw = this.hollowWorld; if (!hw || this.echoCool > 0) return;
    this.echoCool = 0.45;
    const r = strikeEcho(this.hollow, this.echoStep, color), p = ECHO_SPOTS[color], hex = ECHO_HEX[color];
    this.hollow = r.state; this.echoStep = r.step; saveHollow(this.hollow);
    this.fx.burst(p.x, 1.4, p.z, hex, r.outcome === 'wrong' ? 8 : 24, 2.6, 0.7, 0.5, 2); this.fx.flash(p.x, 1.4, p.z, hex, 3.4, 0.4);
    switch (r.outcome) {
      case 'right': hw.strikeEcho(color, true); this.sfx.play('petal', this.echoStep * 2); this.hud.pulseTile('bag'); break;
      case 'wrong': {
        hw.strikeEcho(color, false); hw.resetEchoes(); this.sfx.play('wrong');
        if (this.time - this.lastWrongToast > 4) { this.lastWrongToast = this.time; this.hud.toast(this.ht.toast.echoWrong, 3800, 'sparkles'); }
        break;
      }
      case 'solved': {
        hw.strikeEcho(color, true); hw.setEchoesDone(true); hw.setGates({ doorOpen: true, secretOpen: secretOpen(this.hollow) });
        this.sfx.play('wake'); this.shake = 0.3; this.hud.toast(this.ht.toast.doorOpen, 4800, 'sparkles');
        this.fx.ring(DOOR_POS.x, 0.1, DOOR_POS.z, 5, 0xbfe4ff, 40); this.fx.beam(DOOR_POS.x, 0, DOOR_POS.z, 0xbfe4ff, 7, 1.2, 1.2);
        hw.setWardenDown(!wardenAwake(this.hollow)); this.spawnHollowCreatures(true);   // the Warden stirs behind the door
        this.applyQuest({ kind: 'hollow', xp: r.xp }, { x: DOOR_POS.x, y: 2.6, z: DOOR_POS.z + 2 });
        break;
      }
      case 'ignored': hw.strikeEcho(color, true); this.sfx.play('tap', 3); break;
    }
    this.refreshHud();
  }
  private finishHeart(): void {
    const r = touchHeart(this.hollow); if (r.xp === 0 || !this.hollowWorld) return;
    this.hollow = r.state; saveHollow(this.hollow); this.hollowWorld.setHeartLit(true);
    const x = HEART_POS.x, z = HEART_POS.z;
    this.sfx.play('fanfare'); this.shake = 0.25; this.hero.cheer(2.2);
    this.fx.burst(x, 2.4, z, 0xffb4e0, 70, 4.2, 1.4, 0.5, 3); this.fx.flash(x, 2.4, z, 0xffd0ec, 9, 0.9); this.fx.beam(x, 0, z, 0xffc8ea, 10, 1.6, 1.4); this.fx.ring(x, 0.1, z, 7, 0xffd0ec, 48);
    this.hud.toast(this.ht.toast.heartDone, 5200, 'sparkles');
    this.applyQuest({ kind: 'hollow', xp: r.xp, unlock: r.unlock }, { x, y: 3.6, z });
    this.refreshHud();
    if (!this.endSeen) { this.endSeen = true; setTimeout(() => { if (!this.hud.endOpen) { this.input.releaseAll(); this.hud.showEnd(); } }, 3200); }
  }
  /** Inside the Hollow each frame: the mural, glowcaps and Moon Shards react to the hero walking up to them. */
  /** Glim hovers in the Lantern Cavern: he turns to the hero, waves hello once, bounces while he talks, and floats a "!" while he has something to say. */
  private updateGlim(dt: number): void {
    const h = this.hollow, d = Math.hypot(this.pos.x - GLIM_POS.x, this.pos.z - GLIM_POS.z);
    this.glimFacing = turnToward(this.glimFacing, d < 12 ? headingOf(this.pos.x - GLIM_POS.x, this.pos.z - GLIM_POS.z) : Math.PI * 0.85, 4 * dt);
    if (!this.glimGreeted && d < GLIM_RANGE * 1.8 && !this.hud.dialogueOpen) { this.glimGreeted = true; this.glim.wave(); }
    const script = glimScript(h);
    this.glim.setMarker(script === 'intro' || script === 'report'); this.glim.setTalking(this.hud.dialogueOpen && this.talkWho === 'glim'); this.glim.setLit(h.glim === 2);
    this.glim.update(this.time, this.glimFacing);
    if (this.glim.takeCheerCue()) { this.fx.burst(GLIM_POS.x, 1.6, GLIM_POS.z, 0xffe066, 34, 3.2, 1.1, 0.6, 2.6); this.fx.flash(GLIM_POS.x, 1.4, GLIM_POS.z, 0xbfeaff, 3.6, 0.5, 0.8); this.sfx.play('levelup'); }
  }
  /** Talks with Glim (v2.28): his request, a reminder with the count, his report-and-sum once every Shardling is calm, then thanks. */
  private talkToGlim(): void {
    const script = glimScript(this.hollow), g = this.ht.glim, n = this.hollow.shardlings.length;
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0; this.hud.setHint(null);
    this.talkAt = GLIM_POS; this.talkWho = 'glim'; this.glim.wave(1.2);
    const lines = script === 'intro' ? g.intro : script === 'waiting' ? g.waiting.map(l => hollowFill(l, { n, total: SHARDLING_COUNT })) : script === 'report' ? g.report : g.thanks;
    this.hud.openDialogue(g.name, lines, () => {
      this.talkAt = null; this.talkWho = null;
      if (script === 'intro') { this.hollow = glimAsked(this.hollow); saveHollow(this.hollow); this.hud.toast(this.ht.toast.glimMet, 3200, 'sparkles'); this.refreshHud(); }
      else if (script === 'report') {
        const r = glimClaim(this.hollow); if (r.xp === 0) return;   // paid once: a second report (or a lost save) cannot pay again
        this.hollow = r.state; saveHollow(this.hollow); this.glim.cheer(); this.hero.cheer(1.6); this.sfx.play('fanfare');
        this.hud.toast(this.ht.toast.glimDone, 4200, 'sparkles'); this.applyQuest({ kind: 'hollow', xp: r.xp }, { x: GLIM_POS.x, y: 2.2, z: GLIM_POS.z }); this.refreshHud();
      }
    }, script === 'report' ? this.gateQuestion(g.ask) : undefined);
    this.sfx.play('talk');
  }
  /** Reads a Moon Tablet: shows its lines (a tip for the Warden fight) and pays once the first time. */
  private readMoonTablet(id: number): void {
    const t = TABLET_SPOTS[id], hw = this.hollowWorld; if (!t || !hw) return;
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0; this.hud.setHint(null);
    this.talkAt = t; this.talkWho = 'tablet';
    const r = readTablet(this.hollow, id);
    if (r.first) {
      this.hollow = r.state; saveHollow(this.hollow); hw.readTablet(id);
      this.fx.burst(t.x, 1.1, t.z, 0xbfeaff, 26, 2.6, 1, 1.2, 2.2); this.fx.flash(t.x, 1.1, t.z, 0xaee8ff, 3, 0.5); this.sfx.play('petal', 2 + id);
      this.hud.toast(hollowFill(this.ht.toast.tablet, { n: this.hollow.tablets.length, total: TABLET_COUNT }), 2600, 'star');
      this.applyQuest({ kind: 'hollow', xp: r.xp }, { x: t.x, y: 1.9, z: t.z });
      if (r.all) setTimeout(() => { this.hud.toast(this.ht.toast.allTablets, 4600, 'sparkles'); this.sfx.play('levelup'); }, 1200);
      this.refreshHud();
    }
    this.hud.openDialogue(this.ht.tablet.name, this.ht.tablet.lines[id], () => { this.talkAt = null; this.talkWho = null; });
    this.sfx.play('talk');
  }


  // ---------- v2.29 Moonwake Shore ----------
  private get st() { return SHORE_TEXT[this.lang]; }
  /** The driftwood arch in the woods that leads to the shore (shown once the Heartstone has been touched). */
  private shoreArch(): import('three').Group {
    const g = new Group(), k = new Kit();
    for (const sd of [-1, 1]) { k.cyl(0.3, 0.4, 3.8, 7, sd * 2.0, 1.9, 0, 0x8a6a48); k.ball(0.28, sd * 2.0, 0.35, 0.25, 0xe6dcc4, 1, 0.5, 1, 1); }
    k.box(4.8, 0.36, 0.5, 0, 3.8, 0, 0x7a5638); k.add(new TorusGeometry(0.5, 0.08, 6, 12), 0xe8e0d0, M(0, 2.9, 0.1)); k.ball(0.14, 0, 2.9, 0.1, 0xb8f0e8, 1, 1, 1, 1);
    const m = new Mesh(k.build(0.2, 1), mat()); m.castShadow = true; g.add(m);
    const glow = glowSprite(0xbfe4ff, 5, 0.35); glow.position.y = 2.2; g.add(glow);
    g.position.set(SHORE_ARCH.x, heightAt(SHORE_ARCH.x, SHORE_ARCH.z), SHORE_ARCH.z); g.rotation.y = Math.PI / 2; g.name = 'shore-arch'; g.visible = false;
    this.shoreArchGroup = g; return g;
  }
  private shoreArchGroup: import('three').Group | null = null;
  /** The arch only stands in the woods, and only once the Heartstone has been touched. */
  private updateShoreArch(): void { if (this.shoreArchGroup) this.shoreArchGroup.visible = this.area === 'woods' && this.hollow.heartDone && this.progress.stage === 'complete'; }

  private ensureShore(): ShoreWorld {
    if (this.shoreWorld) return this.shoreWorld;
    const sw = new ShoreWorld(this.scene, this.quality), s = this.shore;
    sw.setTide(s.tide, false); sw.setCauseway(causewayOpen(s), false); sw.setGlass(s.glass); sw.setBottles(s.bottles); sw.setSolved(tideSolved(s)); sw.setLampLit(s.lampLit, false);
    this.mak.setLit(s.mak === 2); this.keeper.setLit(s.lampLit);
    this.shoreWorld = sw; return sw;
  }
  /** Puts onto the shore every creature the save still owes (see systems/shoreEncounters.ts): never a calmed crab or gull, never one standing on ground that is under water now. Safe to call again. */
  private spawnShoreCreatures(burst: boolean): void {
    const g = gatesOf(this.shore);
    for (const sp of shoreSpawns(this.shore)) {
      if (this.chars.all().some(c => c.enemy.def.kind === sp.kind && c.enemy.tag === sp.tag)) continue;
      if (!onShoreFloor(g, sp.at.x, sp.at.z, 0.3)) continue;
      this.spawnEnemy(sp.kind, sp.at, burst && sp.kind === 'heron', sp.tag, sp.kind === 'heron');
      if (sp.kind === 'heron') { this.heronAnnounced = false; if (burst) { this.fx.ring(sp.at.x, 0.1, sp.at.z, 6, 0xbff4ff, 40); this.fx.beam(sp.at.x, 0, sp.at.z, 0xbff4ff, 6, 1.2, 1.0); } }
    }
  }
  private shoreTarget(): ShoreTarget | null { return this.area !== 'shore' || this.transition ? null : shoreTargetAt(this.shore, this.pos); }
  private shoreLabel(): string | null {
    const t = this.shoreTarget(); if (!t) return null;
    return t.kind === 'buoy' ? this.st.ui.ring : t.kind === 'bottle' || t.kind === 'board' ? this.strings.ui.read : t.kind === 'mak' || t.kind === 'keeper' ? this.strings.ui.talk : this.ht.ui.use;
  }
  private useShore(): void {
    const t = this.shoreTarget(); if (!t) return;
    if (t.kind === 'buoy') this.ringBell(t.id); else if (t.kind === 'mak') this.talkToMak(); else if (t.kind === 'keeper') this.talkToKeeper(); else if (t.kind === 'bottle') this.readShoreBottle(t.id); else if (t.kind === 'board') this.readBoard(); else this.lightTheLamp();
  }
  /** A blade swing that reaches a bell-buoy rings it (the Use button does the same). */
  private strikeBuoys(range: number, half: number): void {
    if (this.ringCool > 0) return;
    for (const b of SHORE_BUOYS) if (inAttackArc(this.pos, this.heading, BUOY_SPOTS[b], range + 0.9, half, 0.8)) { this.ringBell(b); break; }
  }
  private ringBell(id: BuoyId): void {
    const sw = this.shoreWorld; if (!sw || this.ringCool > 0) return;
    this.ringCool = 0.45;
    const r = ringBuoy(this.shore, this.ringAttempt, id), p = BUOY_SPOTS[id], hex = BUOY_HEX[id];
    this.shore = r.state; this.ringAttempt = r.attempt; saveShore(this.shore);
    sw.ringBuoy(id); this.fx.burst(p.x, 2.1, p.z, hex, r.outcome === 'wrong' ? 8 : 26, 2.6, 0.7, 0.5, 2); this.fx.flash(p.x, 2.1, p.z, hex, 3.4, 0.4); this.fx.ring(p.x, 0.1, p.z, 3.2, hex, 28);
    switch (r.outcome) {
      case 'right': this.sfx.play('petal', this.ringAttempt.length * 2); this.hud.pulseTile('bag'); break;
      case 'wrong': this.sfx.play('wrong'); if (this.time - this.lastBellWrong > 4) { this.lastBellWrong = this.time; this.hud.toast(this.st.toast.bellWrong, 3800, 'sparkles'); } break;
      case 'same': this.sfx.play('tap', 2); this.hud.toast(this.shore.tide === 'low' ? this.st.toast.sameLow : this.st.toast.sameHigh, 2400, 'sparkles'); break;
      case 'ebb': case 'flood': this.tideTurned(r.outcome, r.xp, r.solved, p); break;
    }
    this.refreshHud();
  }
  /** A whole tide song was rung: the sea moves, the ground that depends on it rises or sinks, creatures on drowned ground go, and a solved puzzle lifts the Moon Causeway. */
  private tideTurned(song: 'ebb' | 'flood', xp: number, solved: boolean, at: { x: number; z: number }): void {
    const sw = this.shoreWorld; if (!sw) return;
    sw.setTide(this.shore.tide); this.sfx.play('wake'); this.shake = Math.max(this.shake, 0.25); this.hero.cheer(1.2);
    this.fx.ring(at.x, 0.1, at.z, 8, 0xbfe4ff, 48); this.fx.beam(at.x, 0, at.z, 0xbfe4ff, 6, 1.1, 1.0);
    this.hud.toast(song === 'ebb' ? this.st.toast.ebb : this.st.toast.flood, 5200, 'sparkles');
    this.chars.clear(); this.spawnShoreCreatures(false);
    if (solved) {
      sw.setCauseway(true); sw.setSolved(true);
      setTimeout(() => { this.hud.toast(this.st.toast.solved, 5200, 'sparkles'); this.sfx.play('levelup'); }, 1800);
      this.spawnShoreCreatures(true);
    }
    this.applyQuest({ kind: 'shore', xp }, { x: at.x, y: 3.0, z: at.z });
  }
  private readBoard(): void {
    this.boardSeen = true; this.hud.toast(shoreFill(this.st.toast.boardRead, { ebb: ebbText(this.lang), flood: floodText(this.lang) }), 6500, 'sparkles'); this.sfx.play('tap', 1); this.refreshHud();
  }
  private beginTalk(at: { x: number; z: number }, who: 'mak' | 'keeper' | 'bottle'): void {
    this.input.releaseAll(); this.combat.clearBuffer(); this.vel.x = this.vel.z = 0; this.hud.setHint(null); this.talkAt = at; this.talkWho = who;
  }
  private talkToMak(): void {
    const script = makScript(this.shore), m = this.st.mak, n = this.shore.glass.length;
    this.beginTalk(MAK_POS, 'mak'); this.mak.wave(1.2);
    const lines = script === 'intro' ? m.intro : script === 'waiting' ? m.waiting.map(l => shoreFill(l, { n, total: GLASS_COUNT })) : script === 'report' ? m.report : m.thanks;
    this.hud.openDialogue(m.name, lines, () => {
      this.talkAt = null; this.talkWho = null;
      if (script === 'intro') { this.shore = makAsked(this.shore); saveShore(this.shore); this.hud.toast(this.st.toast.makMet, 3200, 'sparkles'); this.refreshHud(); }
      else if (script === 'report') {
        const r = makClaim(this.shore); if (r.xp === 0) return;   // paid once: a second report (or a lost save) cannot pay again
        this.shore = r.state; saveShore(this.shore); this.mak.setLit(true); this.hero.cheer(1.6); this.sfx.play('fanfare'); this.hud.toast(this.st.toast.makDone, 4200, 'sparkles');
        this.applyQuest({ kind: 'shore', xp: r.xp, unlocks: r.unlocks }, { x: MAK_POS.x, y: 2.2, z: MAK_POS.z }); this.refreshHud();
      }
    }, script === 'report' ? this.gateQuestion(m.ask, 'money') : undefined);
    this.sfx.play('talk');
  }
  private talkToKeeper(): void {
    const script = keeperScript(this.shore), k = this.st.keeper;
    this.beginTalk(KEEPER_POS, 'keeper');
    const lines = script === 'intro' ? k.intro : script === 'waiting' ? k.waiting : script === 'report' ? k.report : k.thanks;
    this.hud.openDialogue(k.name, lines, () => {
      this.talkAt = null; this.talkWho = null;
      if (script === 'intro') { this.shore = keeperAsked(this.shore); saveShore(this.shore); this.hud.toast(this.st.toast.keeperMet, 3200, 'sparkles'); this.refreshHud(); }
      else if (script === 'report') {
        const r = keeperClaim(this.shore); if (r.xp === 0) return;
        this.shore = r.state; saveShore(this.shore); this.hero.cheer(1.6); this.sfx.play('fanfare'); this.hud.toast(this.st.toast.keeperDone, 4200, 'sparkles');
        this.applyQuest({ kind: 'shore', xp: r.xp }, { x: KEEPER_POS.x, y: 2.4, z: KEEPER_POS.z }); this.refreshHud();
      }
    }, script === 'report' ? this.gateQuestion(k.ask, 'clock') : undefined);
    this.sfx.play('talk');
  }
  /** Reads a message bottle: shows its lines (a tip for the Heron fight) and pays once the first time. */
  private readShoreBottle(id: number): void {
    const b = BOTTLE_SPOTS[id], sw = this.shoreWorld; if (!b || !sw) return;
    this.beginTalk(b, 'bottle');
    const r = readBottle(this.shore, id);
    if (r.first) {
      this.shore = r.state; saveShore(this.shore); sw.readBottle(id);
      this.fx.burst(b.x, 1.1, b.z, 0xbff4e8, 26, 2.6, 1, 1.2, 2.2); this.fx.flash(b.x, 1.1, b.z, 0xbff4e8, 3, 0.5); this.sfx.play('petal', 2 + id);
      this.hud.toast(shoreFill(this.st.toast.bottle, { n: this.shore.bottles.length, total: BOTTLE_COUNT }), 2600, 'star');
      this.applyQuest({ kind: 'shore', xp: r.xp }, { x: b.x, y: 1.9, z: b.z });
      if (r.all) setTimeout(() => { this.hud.toast(this.st.toast.allBottles, 4600, 'sparkles'); this.sfx.play('levelup'); }, 1200);
      this.refreshHud();
    }
    this.hud.openDialogue(this.st.bottle.name, this.st.bottle.lines[id], () => { this.talkAt = null; this.talkWho = null; });
    this.sfx.play('talk');
  }
  /** A Pebble Crab or Gloom Gull has been calmed: its number is saved, so it never comes back for XP (see systems/shoreQuest.ts). */
  private shoreCreatureCalmed(kind: 'crab' | 'gull', id: number | null, at: { x: number; y: number; z: number }): void {
    const r = kind === 'crab' ? calmCrab(this.shore, id ?? -1) : calmGull(this.shore, id ?? -1); if (!r.first) return;
    this.shore = r.state; saveShore(this.shore);
    this.hud.toast(shoreFill(kind === 'crab' ? this.st.toast.crab : this.st.toast.gull, { n: kind === 'crab' ? this.shore.crabs.length : this.shore.gulls.length, total: kind === 'crab' ? CRAB_COUNT : GULL_COUNT }), 2600, 'sparkles');
    this.applyQuest({ kind: 'shore', xp: r.xp }, at); this.refreshHud();
  }
  /** The Tidecaller Heron has fallen: pays XP once and frees the lamp. */
  private heronFell(at: { x: number; y: number; z: number }): void {
    const r = defeatHeron(this.shore); if (r.xp === 0) return;
    this.shore = r.state; saveShore(this.shore);
    this.hud.toast(this.st.toast.heronDown, 5200, 'sparkles'); this.sfx.play('fanfare'); this.hero.cheer(2);
    this.applyQuest({ kind: 'shore', xp: r.xp }, at); this.refreshHud();
  }
  private lightTheLamp(): void {
    const r = lightLamp(this.shore); if (r.xp === 0 || !this.shoreWorld) return;
    this.shore = r.state; saveShore(this.shore); this.shoreWorld.setLampLit(true); this.keeper.setLit(true);
    const x = LAMP_POS.x, z = LAMP_POS.z;
    this.sfx.play('fanfare'); this.shake = 0.25; this.hero.cheer(2.2);
    this.fx.burst(x, 2.4, z, 0xffe9a0, 70, 4.2, 1.4, 0.5, 3); this.fx.flash(x, 2.4, z, 0xfff0c0, 9, 0.9); this.fx.beam(x, 0, z, 0xffe9a0, 12, 1.6, 1.4); this.fx.ring(x, 0.1, z, 8, 0xfff0c0, 48);
    this.hud.toast(this.st.toast.lampDone, 5200, 'sparkles');
    this.applyQuest({ kind: 'shore', xp: r.xp, unlocks: r.unlocks }, { x, y: 3.6, z }); this.refreshHud();
  }
  /** What the Heron's attacks look like when they land: a spout of seawater where the hero stood, a sweep of spray along a line, a ring rolling out over the water. */
  private heronStrikeFx(attack: string, shape: Shape, from: { x: number; z: number }): void {
    const water = 0x7fd6ff, foam = 0xe6faff;
    if (shape.type === 'circle' && attack === 'waterSpout') {
      const gy = this.groundY(shape.x, shape.z);
      this.fx.beam(shape.x, gy, shape.z, water, 8, 0.9, 0.9); this.fx.burst(shape.x, gy + 0.4, shape.z, water, 46, 4.6, 1, 5, 3.5); this.fx.burst(shape.x, gy + 0.3, shape.z, foam, 24, 3.4, 0.9, 3, 2);
      this.fx.ring(shape.x, gy, shape.z, shape.r * 1.15, water, 36); this.fx.flash(shape.x, gy + 0.6, shape.z, foam, 5, 0.3, 0.8); this.hitStop = Math.max(this.hitStop, 0.05); this.shake = Math.max(this.shake, 0.45);
    } else if (shape.type === 'circle') {
      const gy = this.groundY(shape.x, shape.z);
      this.fx.ring(shape.x, gy, shape.z, shape.r, water, 56); this.fx.ring(shape.x, gy, shape.z, shape.r * 0.6, foam, 36);
      this.fx.burst(shape.x, gy + 0.5, shape.z, water, 60, 5.5, 1.3, -0.2, 1.6); this.fx.flash(shape.x, gy + 0.9, shape.z, foam, 7, 0.6, 0.6); this.shake = Math.max(this.shake, 0.32);
    } else {
      for (let i = 1; i <= 6; i++) { const f = i / 6, x = shape.x + shape.dx * shape.length * f, z = shape.z + shape.dz * shape.length * f; this.fx.burst(x, this.groundY(x, z) + 0.5, z, i % 2 ? water : foam, 9, 2.4, 0.6, 1.4, 1.6); }
      this.fx.flash(from.x, this.groundY(from.x, from.z) + 1.6, from.z, foam, 6, 0.4, 0.8); this.shake = Math.max(this.shake, 0.3);
    }
    this.sfx.play('stomp', 2); this.sfx.play('hit', 2);
  }
  /** Each frame on the shore: creatures, the two people, the Tide Board, and the sea-glass the hero walks over. */
  private updateShore(dt: number): void {
    const sw = this.shoreWorld; if (!sw) return;
    this.ringCool = Math.max(0, this.ringCool - dt);
    this.updateEnemies(dt); this.updateShoreNpcs(dt);
    if (!this.boardSeen && !this.hud.dialogueOpen && Math.hypot(this.pos.x - TIDE_BOARD_POS.x, this.pos.z - TIDE_BOARD_POS.z) < BOARD_RANGE) this.readBoard();
    if (this.faintT !== null) return;
    for (let i = 0; i < GLASS_SPOTS.length; i++) {
      if (this.shore.glass.includes(i)) continue;
      const sp = GLASS_SPOTS[i];
      if (Math.hypot(this.pos.x - sp.x, this.pos.z - sp.z) < GLASS_RANGE) {
        const r = collectGlass(this.shore, i); if (!r.first) continue;
        this.shore = r.state; saveShore(this.shore); sw.setGlass(this.shore.glass); this.hero.cheer();
        this.fx.burst(sp.x, 0.9, sp.z, 0xbff4e8, 26, 3, 0.9, 1.5, 2.5); this.fx.flash(sp.x, 0.9, sp.z, 0xbff4e8, 3.2, 0.5); this.sfx.play('petal', Math.min(this.shore.glass.length, 8) - 1);
        this.hud.toast(shoreFill(this.st.toast.glass, { n: this.shore.glass.length, total: GLASS_COUNT }), 2200, 'star');
        this.applyQuest({ kind: 'shore', xp: r.xp }, { x: sp.x, y: 1.6, z: sp.z });
        if (r.all) setTimeout(() => { this.hud.toast(this.st.toast.allGlass, 4600, 'sparkles'); this.sfx.play('levelup'); }, 1100);
        this.refreshHud();
      }
    }
  }
  private updateShoreNpcs(dt: number): void {
    const s = this.shore, face = (npc: { x: number; z: number }, cur: number): number => turnToward(cur, Math.hypot(this.pos.x - npc.x, this.pos.z - npc.z) < 12 ? headingOf(this.pos.x - npc.x, this.pos.z - npc.z) : cur, 4 * dt);
    this.makFacing = face(MAK_POS, this.makFacing); this.keeperFacing = face(KEEPER_POS, this.keeperFacing);
    if (!this.makGreeted && Math.hypot(this.pos.x - MAK_POS.x, this.pos.z - MAK_POS.z) < 5.5 && !this.hud.dialogueOpen) { this.makGreeted = true; this.mak.wave(); }
    if (!this.keeperGreeted && Math.hypot(this.pos.x - KEEPER_POS.x, this.pos.z - KEEPER_POS.z) < 5.5 && !this.hud.dialogueOpen) { this.keeperGreeted = true; this.keeper.wave(); }
    const ms = makScript(s), ks = keeperScript(s);
    this.mak.setMarker(ms === 'intro' || ms === 'report'); this.keeper.setMarker(ks === 'intro' || ks === 'report');
    this.mak.setTalking(this.hud.dialogueOpen && this.talkWho === 'mak'); this.keeper.setTalking(this.hud.dialogueOpen && this.talkWho === 'keeper');
    this.mak.update(this.time, this.makFacing); this.keeper.update(this.time, this.keeperFacing);
  }

  private updateHollow(dt: number): void {
    const hw = this.hollowWorld; if (!hw) return;
    this.echoCool = Math.max(0, this.echoCool - dt);
    this.updateEnemies(dt); this.updateGlim(dt);
    if (this.faintT !== null || this.transition) return;
    const px = this.pos.x, pz = this.pos.z;
    if (!this.muralSeen && Math.hypot(px - MURAL_POS.x, pz - MURAL_POS.z) < MURAL_RANGE) {
      this.muralSeen = true; this.hud.toast(hollowFill(this.ht.toast.muralRead, { order: orderText(this.lang) }), 5200, 'sparkles'); this.refreshHud();
    }
    for (let i = 0; i < GLOWCAP_COUNT; i++) {
      if (Math.hypot(px - GLOWCAP_SPOTS[i].x, pz - GLOWCAP_SPOTS[i].z) >= GLOWCAP_RANGE) continue;
      const r = lightGlowcap(this.hollow, i); if (!r.first) continue;
      this.hollow = r.state; saveHollow(this.hollow); hw.lightGlowcap(i);
      const g = GLOWCAP_SPOTS[i]; this.fx.burst(g.x, 1.0, g.z, 0x7dffd0, 22, 2.4, 0.8, 0.8, 2); this.sfx.play('tap', 4 + this.hollow.glowcaps.length * 2);
      this.hud.toast(hollowFill(this.ht.toast.glowcap, { n: this.hollow.glowcaps.length, total: GLOWCAP_COUNT }), 2600, 'sparkles');
      if (r.opened) {
        hw.setGates({ doorOpen: this.hollow.doorOpen, secretOpen: true });
        const m = SECRET_COLLIDERS[0]; this.fx.burst(m.x, 1.4, m.z, 0xc9b0ff, 60, 4, 1.1, 1.5, 3); this.fx.ring(m.x, 0.1, m.z, 4, 0xc9b0ff, 36); this.sfx.play('wake'); this.shake = 0.2;
        setTimeout(() => this.hud.toast(this.ht.toast.secretOpen, 4200, 'sparkles'), 900);
      }
      this.refreshHud();
    }
    for (let i = 0; i < SHARD_COUNT; i++) {
      const s = SHARD_SPOTS[i]; if (this.hollow.shards.includes(i) || Math.hypot(px - s.x, pz - s.z) >= SHARD_RANGE) continue;
      const r = collectShard(this.hollow, i); if (!r.first) continue;
      this.hollow = r.state; saveHollow(this.hollow); hw.setShards(this.hollow.shards); this.hero.cheer();
      this.fx.burst(s.x, 1.0, s.z, 0xbfeaff, 26, 3, 0.9, 1.2, 2.5); this.fx.flash(s.x, 1.0, s.z, 0x9be8ff, 3, 0.5); this.fx.beam(s.x, 0, s.z, 0x9be8ff, 3, 0.7, 0.3);
      this.sfx.play('petal', Math.min(this.hollow.shards.length, 6) - 1);
      this.hud.toast(hollowFill(this.ht.toast.shard, { n: this.hollow.shards.length, total: SHARD_COUNT }), 2400, 'star');
      this.applyQuest({ kind: 'hollow', xp: r.xp }, { x: s.x, y: 1.8, z: s.z });
      if (r.all) setTimeout(() => { this.hud.toast(this.ht.toast.allShards, 4600, 'sparkles'); this.sfx.play('levelup'); }, 1100);
      this.refreshHud();
    }
  }

  private ambient(dt: number, speed: number): void {
    this.dustTimer -= dt; this.sparkleTimer -= dt;
    if (speed > 3 && this.dustTimer <= 0 && this.faintT === null) { this.dustTimer = 0.16; this.fx.burst(this.pos.x, this.y + 0.08, this.pos.z, 0xcbb98a, 3, 0.8, 0.45, 0.6, 0.5); }
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.25; const a = Math.random() * 6.28, d = 2 + Math.random() * 9;
      const x = this.pos.x + Math.sin(a) * d, z = this.pos.z + Math.cos(a) * d;
      this.fx.burst(x, this.groundY(x, z) + 0.6 + Math.random(), z, 0xfff0a0, 1, 0.3, 2.2, -0.15, 0.25);
    }
  }

  private updateCamera(dt: number): void {
    const base = cameraPreset(this.layoutName);
    const pre = { ...base, distance: base.distance * CAMERA_DISTANCE_SCALE * (1 + 0.5 * this.bossK) };
    // v2.9: the camera follows a smoothed copy of the hero's position (not the hero itself), so running feels smooth and terrain bumps
    // do not jolt the picture. It snaps to the hero for the wardrobe, after a respawn and at the start.
    const f = this.focus;
    if (!f.init || this.wardrobeK > 0 || this.wardrobe.isOpen || Math.hypot(this.pos.x - f.x, this.pos.z - f.z) > 3) { f.x = this.pos.x; f.z = this.pos.z; f.y = this.y; f.init = true; }
    else { const k = smoothingFactor(FOLLOW_RATE, dt), ky = smoothingFactor(FOLLOW_RATE_Y, dt); f.x += (this.pos.x - f.x) * k; f.z += (this.pos.z - f.z) * k; f.y += (this.y - f.y) * ky; }
    const hx = f.x, hz = f.z;
    const horizontalWanted = Math.cos(pre.pitch) * pre.distance;
    let clear = rayClearDistance(this.grid, hx, hz, Math.sin(this.camYaw), Math.cos(this.camYaw), horizontalWanted, 1.0);
    if (this.area === 'hollow') clear = Math.min(clear, floorRayClear(hx, hz, Math.sin(this.camYaw), Math.cos(this.camYaw), horizontalWanted)); // the rock walls are not circles: keep the camera inside the cave
    if (this.area === 'shore') clear = Math.min(clear, shoreRayClear(gatesOf(this.shore), hx, hz, Math.sin(this.camYaw), Math.cos(this.camYaw), horizontalWanted));   // open sea beyond the shore is not worth looking at
    // v2.11: never closer than MIN_CAMERA_RATIO of the preset distance; the rest of the "room" is made up by climbing (higher pitch).
    const target = Math.max(pre.distance * MIN_CAMERA_RATIO, Math.min(pre.distance, clear / Math.cos(pre.pitch)));
    this.camDist = target < this.camDist ? target : this.camDist + (target - this.camDist) * smoothingFactor(2.5, dt);
    const off = followCameraOffset(this.camYaw, blockedCameraPitch(pre.pitch, this.camDist / pre.distance), this.camDist);
    const lookY = f.y + 1.0;
    let cx = hx + off.x, cz = hz + off.z, cy = lookY + off.y;
    cy = Math.max(cy, this.groundY(cx, cz) + 0.9);
    let ly = f.y + 0.95;
    // wardrobe: glide round to the front of the hero and slide the picture clear of the panel
    const wantK = this.wardrobe.isOpen ? 1 : 0;
    this.wardrobeK += (wantK - this.wardrobeK) * smoothingFactor(5, dt); if (Math.abs(wantK - this.wardrobeK) < 0.002) this.wardrobeK = wantK;
    const k = this.wardrobeK;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    if (k > 0) {
      const box = this.wardrobe.box(this.host);
      const shift = box ? previewShift(box.screen, box.panel) : { x: 0, y: 0 };
      const free = box && box.panel.w >= box.screen.w * 0.8 ? (box.screen.h - box.panel.h) / box.screen.h : 1;
      const d = previewDistance(this.camera.fov, free) * this.wardrobeZoom;
      const wx = hx + Math.sin(this.wardrobeYaw) * d, wz = hz + Math.cos(this.wardrobeYaw) * d;
      const wy = Math.max(this.y + 1.0, this.groundY(wx, wz) + 0.6);
      const e = k * k * (3 - 2 * k);
      cx += (wx - cx) * e; cy += (wy - cy) * e; cz += (wz - cz) * e; ly += (this.y + 0.7 - ly) * e;
      this.camera.setViewOffset(w, h, shift.x * e, shift.y * e, w, h);
    } else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    if (k === 0) {
      const decay = Math.exp(-13 * dt); this.camKick.x *= decay; this.camKick.z *= decay; cx += this.camKick.x; cz += this.camKick.z;
      this.shake = Math.max(0, this.shake - dt * 1.2);
      if (this.shake > 0.001) { cx += (Math.random() - 0.5) * this.shake; cy += (Math.random() - 0.5) * this.shake; cz += (Math.random() - 0.5) * this.shake; }
    }
    this.camera.position.set(cx, cy, cz);
    const bk = this.bossK * (1 - k);
    this.camera.lookAt(hx + (this.bossAt.x - hx) * 0.4 * bk, ly + 1.7 * bk, hz + (this.bossAt.z - hz) * 0.4 * bk);
    if (this.debugCam) { this.camera.position.fromArray(this.debugCam.from); this.camera.lookAt(this.debugCam.to[0], this.debugCam.to[1], this.debugCam.to[2]); }
    if (this.camera.fov !== pre.fov) { this.camera.fov = pre.fov; this.camera.updateProjectionMatrix(); }
  }

  // ---------- sizing & perf ----------
  private sized = { w: 0, h: 0, ratio: 0 };
  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    // The resize observer, the window and a phone's moving toolbars all call this; re-sizing the canvas is only needed when something changed.
    const s = this.sized; if (s.w === w && s.h === h && s.ratio === this.pixelRatio) return;
    this.sized = { w, h, ratio: this.pixelRatio };
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const short = Math.min(w, h);
    const layout = short < 500 ? (h > w ? 'phone-portrait' : 'phone-landscape') : short < 900 ? 'tablet' : 'desktop';
    // Turning the phone can swallow the finger-up event: let go of the stick so the hero never keeps running by itself.
    if (layout !== this.layoutName) this.input?.releaseAll();
    this.layoutName = layout;
    // keep the hero's width on screen similar in portrait by widening the vertical field of view there
    this.camera.fov = cameraPreset(this.layoutName).fov; this.camera.updateProjectionMatrix();
  }
  private trackFps(dt: number): void {
    if (this.hud.blocking) { this.fpsFrames = 0; this.fpsTime = 0; return; }
    if (dt <= 0) return;
    this.fpsFrames++; this.fpsTime += dt;
    if (this.fpsTime < 2) return;
    const fps = this.fpsFrames / this.fpsTime;
    if (this.warm > 0) this.warm--; else if (!this.hud.blocking) {
      // a slow device first gives up some scenery detail and shadows, and only then some resolution
      const nq = nextQuality(this.quality, fps);
      if (nq !== this.quality) { this.quality = nq; this.world.setQuality(nq); this.hero.setOutline(outlineWanted(nq, this.outlineOverride)); this.warm = 1; }
      else {
        const next = nextPixelRatio(this.pixelRatio, fps);
        if (next !== this.pixelRatio) { this.pixelRatio = next; this.resize(); }
      }
    }
    if (this.fpsMeter) { const i = this.renderer.info.render; this.fpsMeter.textContent = `${fps.toFixed(0)} fps · ${this.quality}${this.hero.outlined ? ' +outline' : ''} · hero ${this.hero.isChibi ? 'chibi' : this.hero.failed ? 'simple' : 'loading/old'} · ratio ${this.pixelRatio} · ${i.calls} calls · ${(i.triangles / 1000).toFixed(0)}k tris`; }
    this.fpsFrames = 0; this.fpsTime = 0;
  }

  destroy(): void {
    this.running = false; this.renderer.setAnimationLoop(null); this.input.destroy(); document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize); window.removeEventListener('orientationchange', this.onResize); this.ro?.disconnect();
    this.renderer.dispose();
  }
}

