import Phaser from 'phaser';
import { createMeadow } from '../art/painter';
import { applyOutfit, HERO_ATLAS_KEY } from '../art/hero';
import { defaultOutfit, PART_KEYS, PARTS, randomOutfit, outfitsEqual, type Outfit, type PartKey } from '../art/parts';
import { audioFor } from '../audio/GameAudio';
import { getLayout } from '../responsive';
import { advanceWalkPhase, FACINGS, HERO_ORIGIN, idleFrameName, walkFrameName, type Facing8 } from '../systems/heroFacing';
import { loadOutfit, saveOutfit } from '../systems/outfitStore';
import { textResolutionFor } from '../systems/viewport';
import { wardrobeSpecFor, type Box, type WardrobeSpec } from '../systems/wardrobeLayout';
import { paintPanel, setTextResolution, textStyle, UI } from '../ui/theme';

/** An unsaved choice survives the scene restarting on a window resize or a phone rotation. */
let draft: Outfit | null = null;

const IDLE_FRAMES = FACINGS.map(idleFrameName);
const walkFramesOf = (facing: Facing8) => Array.from({ length: 7 }, (_, i) => walkFrameName(facing, i / 7));
const AUTO_TURN_MS = 1500;
const PREVIEW_WALK_PX_PER_S = 120;

/**
 * Wardrobe: choose a colour for each part of the hero (hood and hair, tunic, trousers, boots, pack and belt, skin,
 * blade, eyes) and watch the change on the real sprite as it turns around or walks. Choices are saved on this
 * device and used by the game. The art is one flat image per frame, so parts are recoloured, not swapped: see
 * `art/parts.ts` and docs/V1_1_NOTES.md.
 */
export class WardrobeScene extends Phaser.Scene {
  private outfit!: Outfit;
  private part: PartKey = 'hood';
  private facingIndex = FACINGS.indexOf('south');
  private autoTurn = true;
  private turnClock = 0;
  private walking = false;
  private phase = 0;
  private leaving = false;
  /** Walk frames already recoloured for the current outfit, by facing. Idle frames are always redone. */
  private walkReady = new Set<Facing8>();

  private spec!: WardrobeSpec;
  private hero!: Phaser.GameObjects.Sprite;
  private tabGfx!: Phaser.GameObjects.Graphics;
  private swatchGfx!: Phaser.GameObjects.Graphics;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private label!: Phaser.GameObjects.Text;
  private walkText!: Phaser.GameObjects.Text;
  private walkGfx!: Phaser.GameObjects.Graphics;
  private swatchHits: Phaser.GameObjects.Rectangle[] = [];

  constructor() { super('WardrobeScene'); }

  create() {
    this.leaving = false;
    this.walkReady.clear();
    this.tabTexts = []; this.swatchHits = [];
    this.outfit = draft ?? loadOutfit();
    const layout = getLayout(this);
    const spec = this.spec = wardrobeSpecFor(layout, PART_KEYS.length);
    const res = textResolutionFor(spec.zoom);
    setTextResolution(res);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#92ad41').setZoom(spec.zoom).centerOn(spec.designW / 2, spec.designH / 2);

    const visibleW = layout.width / spec.zoom, visibleH = layout.height / spec.zoom;
    const gw = Math.ceil(visibleW) + 64, gh = Math.ceil(visibleH) + 32;
    createMeadow(this.textures, 'paint-wardrobe-meadow', gw, gh, Math.min(1.5, Math.max(1, 3000 / gw)));
    this.add.image(spec.designW / 2 - gw / 2, spec.designH / 2 - gh / 2, 'paint-wardrobe-meadow').setOrigin(0).setDisplaySize(gw, gh).setDepth(-6);

    this.buildPreview(spec, res);
    this.buildControls(spec);
    this.refreshOutfit(true);
    this.refreshControls();

    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    const onResize = () => this.scene.restart();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.walking) this.phase = advanceWalkPhase(this.phase, (PREVIEW_WALK_PX_PER_S * dt) / 1000);
    else if (this.autoTurn) {
      this.turnClock += dt;
      if (this.turnClock >= AUTO_TURN_MS) { this.turnClock = 0; this.facingIndex = (this.facingIndex + 1) % FACINGS.length; }
    }
    const facing = FACINGS[this.facingIndex];
    this.hero.setFrame(this.walking ? walkFrameName(facing, this.phase) : idleFrameName(facing));
  }

  // ------------------------------------------------------------------ building

  private panel(box: Box, radius = 18) {
    const g = this.add.graphics().setDepth(1);
    paintPanel(g, box.x, box.y, box.w, box.h, radius, 0.92);
    return g;
  }

  private hit(box: Box, action: () => void) {
    const r = this.add.rectangle(box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, 0xffffff, 0.001).setDepth(20).setInteractive({ useHandCursor: true });
    r.on('pointerdown', () => { audioFor(this).click(); action(); });
    return r;
  }

  private text(x: number, y: number, value: string, size: number, color: string, bold = true) {
    return this.add.text(x, y, value, textStyle(size, color, bold)).setOrigin(0.5).setDepth(10);
  }

  private buildPreview(spec: WardrobeSpec, res: number) {
    void res;
    this.panel(spec.preview, 22);
    this.text(spec.title.x, spec.title.y, 'YOUR HERO', spec.title.size, UI.cream);
    const foot = spec.heroFoot;
    this.add.image(foot.x, foot.y + 2, 'paint-shadow').setScale(0.62 * spec.heroScale).setDepth(5);
    this.hero = this.add.sprite(foot.x, foot.y, HERO_ATLAS_KEY('hi'), idleFrameName('south')).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setScale(spec.heroScale).setDepth(6);
    // Tap the hero to turn it, or use the arrows. Turning by hand stops the slow automatic turn.
    const heroBox = { x: foot.x - 70, y: foot.y - 150 * spec.heroScale, w: 140, h: 160 * spec.heroScale };
    this.hit(heroBox, () => this.turn(1));
    this.arrow(spec.turnLeft, -1);
    this.arrow(spec.turnRight, 1);

    this.walkGfx = this.add.graphics().setDepth(9);
    this.walkText = this.text(spec.walk.x + spec.walk.w / 2, spec.walk.y + spec.walk.h / 2, 'WALK', 14, UI.cream);
    this.hit(spec.walk, () => this.toggleWalk());
  }

  private arrow(box: Box, dir: -1 | 1) {
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x2b5a42, 0.92).fillRoundedRect(box.x, box.y, box.w, box.h, 14).lineStyle(1.5, UI.border, 0.7).strokeRoundedRect(box.x, box.y, box.w, box.h, 14);
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    g.fillStyle(0xfff1c9, 1).fillTriangle(cx + dir * 8, cy, cx - dir * 7, cy - 11, cx - dir * 7, cy + 11);
    this.hit(box, () => this.turn(dir));
  }

  private buildControls(spec: WardrobeSpec) {
    this.panel(spec.controls, 22);
    this.tabGfx = this.add.graphics().setDepth(9);
    this.swatchGfx = this.add.graphics().setDepth(9);
    PART_KEYS.forEach((key, i) => {
      const box = spec.tabs[i];
      this.tabTexts.push(this.text(box.x + box.w / 2, box.y + box.h / 2, PARTS[key].label.toUpperCase(), 11, UI.cream));
      this.hit(box, () => { this.part = key; this.refreshControls(); });
    });
    this.label = this.text(spec.label.x, spec.label.y, '', spec.label.size, UI.cream);
    spec.swatches.forEach((box, i) => this.swatchHits.push(this.hit(box, () => this.choose(i))));

    const { reset, random, done } = spec.buttons;
    this.button(reset, 'RESET', false, () => { this.setOutfit(defaultOutfit()); });
    this.button(random, 'SURPRISE', false, () => { this.setOutfit(randomOutfit()); });
    this.button(done, 'DONE', true, () => this.finish());
  }

  private button(box: Box, label: string, primary: boolean, action: () => void) {
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(primary ? 0xf0c969 : 0x2b5a42, 1).fillRoundedRect(box.x, box.y, box.w, box.h, 16).lineStyle(2, primary ? 0xffe9a5 : UI.border, primary ? 1 : 0.7).strokeRoundedRect(box.x, box.y, box.w, box.h, 16);
    this.text(box.x + box.w / 2, box.y + box.h / 2, label, 15, primary ? '#284f3b' : UI.cream);
    this.hit(box, action);
  }

  // ------------------------------------------------------------------ behaviour

  private turn(dir: -1 | 1) {
    this.autoTurn = false;
    this.facingIndex = (this.facingIndex + dir + FACINGS.length) % FACINGS.length;
    this.ensureFrames();
  }

  private toggleWalk() {
    this.walking = !this.walking;
    this.phase = 0;
    this.autoTurn = !this.walking && this.autoTurn;
    this.ensureFrames();
    this.drawWalkButton();
  }

  private choose(index: number) {
    if (index >= PARTS[this.part].swatches.length) return;
    this.setOutfit({ ...this.outfit, [this.part]: index });
  }

  private setOutfit(next: Outfit) {
    if (outfitsEqual(next, this.outfit)) return;
    this.outfit = next;
    draft = { ...next };
    this.refreshOutfit(false);
    this.refreshControls();
  }

  /** Recolours the frames the preview can show right now: all 8 idle frames, plus the walk frames when walking. */
  private refreshOutfit(first: boolean) {
    this.walkReady.clear();
    const frames = [...IDLE_FRAMES];
    if (this.walking) { frames.push(...walkFramesOf(FACINGS[this.facingIndex])); this.walkReady.add(FACINGS[this.facingIndex]); }
    applyOutfit(this.outfit, frames);
    void first;
  }

  private ensureFrames() {
    const facing = FACINGS[this.facingIndex];
    if (!this.walking || this.walkReady.has(facing)) return;
    applyOutfit(this.outfit, walkFramesOf(facing));
    this.walkReady.add(facing);
  }

  private finish() {
    if (this.leaving) return;
    this.leaving = true;
    saveOutfit(this.outfit);
    draft = null;
    // The in-game sprite needs every frame in the chosen colours, not just the ones the preview showed.
    applyOutfit(this.outfit);
    this.scene.start('MainMenuScene');
  }

  // ------------------------------------------------------------------ drawing

  private drawWalkButton() {
    const b = this.spec.walk;
    this.walkGfx.clear().fillStyle(this.walking ? 0xf0c969 : 0x2b5a42, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 14)
      .lineStyle(1.5, UI.border, 0.8).strokeRoundedRect(b.x, b.y, b.w, b.h, 14);
    this.walkText.setText(this.walking ? 'STOP' : 'WALK').setColor(this.walking ? '#284f3b' : UI.cream);
  }

  private refreshControls() {
    const def = PARTS[this.part];
    this.tabGfx.clear();
    PART_KEYS.forEach((key, i) => {
      const b = this.spec.tabs[i], on = key === this.part;
      this.tabGfx.fillStyle(on ? 0xf0c969 : 0x2b5a42, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 12).lineStyle(1.5, on ? 0xffe9a5 : UI.border, on ? 1 : 0.6).strokeRoundedRect(b.x, b.y, b.w, b.h, 12);
      this.tabTexts[i].setColor(on ? '#284f3b' : UI.cream);
    });
    this.swatchGfx.clear();
    const chosen = this.outfit[this.part];
    this.spec.swatches.forEach((b, i) => {
      const swatch = def.swatches[i];
      this.swatchHits[i].setVisible(!!swatch).setActive(!!swatch);
      if (!swatch) return;
      this.swatchGfx.fillStyle(swatch.hex, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 16);
      this.swatchGfx.lineStyle(1.5, 0x06190f, 0.55).strokeRoundedRect(b.x, b.y, b.w, b.h, 16);
      if (i === chosen) {
        this.swatchGfx.lineStyle(4, 0xfff1c9, 1).strokeRoundedRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 19);
        this.swatchGfx.lineStyle(2, 0x284f3b, 1).strokeRoundedRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, 17);
      }
    });
    this.label.setText(`${def.label}: ${def.swatches[chosen].name}`);
    this.drawWalkButton();
  }
}
