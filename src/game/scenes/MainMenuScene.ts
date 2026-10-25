import Phaser from 'phaser';
import { getLayout } from '../responsive';
import { createMeadow, OBJ, tuftKey } from '../art/painter';
import { HERO_ATLAS_KEY } from '../art/hero';
import { HERO_ORIGIN, idleFrameName } from '../systems/heroFacing';
import { LEAF_FRAME_NAMES } from '../data/frames';
import { seededRandom } from '../systems/forestLayout';
import { menuSpecFor, type MenuSpec } from '../systems/uiLayout';
import { textResolutionFor } from '../systems/viewport';
import { setTextResolution } from '../ui/theme';
import { audioFor } from '../audio/GameAudio';

const FONT = 'Trebuchet MS, Verdana, Arial, sans-serif';

/**
 * The title screen is drawn in a fixed "design space" centred on (0, 0) and the camera zooms to fit it, so
 * text and the card keep their proportions at any size. Scenery fills whatever space is left over.
 * A resize simply rebuilds the scene: it is tiny and static.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    const layout = getLayout(this);
    const spec = menuSpecFor(layout);
    const res = textResolutionFor(spec.zoom);
    setTextResolution(res);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#92ad41').setZoom(spec.zoom).centerOn(0, 0);
    const visibleW = layout.width / spec.zoom, visibleH = layout.height / spec.zoom;

    this.addGround(visibleW, visibleH);
    this.addScenery(spec, visibleW, visibleH);
    this.addCard(spec, res, layout.touch);

    const onResize = () => this.scene.restart();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private addGround(visibleW: number, visibleH: number) {
    const w = Math.ceil(visibleW) + 64, h = Math.ceil(visibleH) + 32;
    const key = 'paint-menu-meadow';
    createMeadow(this.textures, key, w, h, Math.min(1.5, Math.max(1, 3000 / w)));
    this.add.image(-w / 2, -h / 2, key).setOrigin(0).setDisplaySize(w, h).setDepth(-6);
  }

  private addScenery(spec: MenuSpec, visibleW: number, visibleH: number) {
    const random = seededRandom(404);
    const top = -spec.designH / 2, cardTop = this.cardTop(spec);
    const card = { x0: -spec.cardW / 2 - 24, x1: spec.cardW / 2 + 24, y0: cardTop - 20, y1: cardTop + spec.cardH + 20 };
    const spots: Array<{ x: number; y: number }> = [];
    const cell = 150;
    for (let y = -visibleH / 2 + 40; y < visibleH / 2 - 10; y += cell) {
      for (let x = -visibleW / 2 + 30; x < visibleW / 2 - 10; x += cell) {
        const px = x + random() * (cell - 40), py = y + random() * (cell - 40);
        if (px > card.x0 && px < card.x1 && py > card.y0 - 40 && py < card.y1 + (spec.hero ? 120 : 50)) continue;
        spots.push({ x: px, y: py });
      }
    }
    spots.forEach((spot, index) => {
      if (index % 2 === 0) {
        const type = index % 3;
        const size = (0.9 + random() * 0.45) * (type === 2 ? 0.9 : 1);
        this.add.ellipse(spot.x + 8, spot.y, 120 * size, 36 * size, 0x0c2c26, 0.25).setDepth(-5.5);
        this.add.image(spot.x, spot.y, type === 2 ? 'paint-pine-0' : `paint-tree-${type}`).setOrigin(0.5, 0.96).setScale(size / OBJ).setDepth(-5 + (spot.y + 1500) / 1000);
      } else {
        const art = tuftKey(LEAF_FRAME_NAMES[index % LEAF_FRAME_NAMES.length]);
        this.add.image(spot.x, spot.y, art.key).setOrigin(0.5, 0.9).setScale((1.5 * art.scale) / OBJ).setDepth(-5 + (spot.y + 1499) / 1000);
      }
    });
    void top;
  }

  private cardTop(spec: MenuSpec) { return -(spec.cardH + (spec.hero ? 80 : 0)) / 2; }

  private addCard(spec: MenuSpec, res: number, touch: boolean) {
    const cx = 0, top = this.cardTop(spec), left = -spec.cardW / 2;
    const frame = this.add.graphics().setDepth(10);
    frame.fillStyle(0x0d302b, 0.46).fillRoundedRect(left + 7, top + 9, spec.cardW, spec.cardH, 30);
    frame.fillStyle(0x164536, 0.92).fillRoundedRect(left, top, spec.cardW, spec.cardH, 30);
    frame.lineStyle(3, 0xa6d389, 0.9).strokeRoundedRect(left, top, spec.cardW, spec.cardH, 30);
    frame.lineStyle(1, 0xf0d995, 0.72).strokeRoundedRect(left + 10, top + 10, spec.cardW - 20, spec.cardH - 20, 24);
    frame.fillStyle(0x6db568, 0.24).fillEllipse(cx, top + spec.y.title + 12, spec.cardW * 0.52, 124);

    const text = (y: number, value: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
      this.add.text(cx, top + y, value, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: res, align: 'center', wordWrap: { width: spec.cardW - 56 }, ...extra }).setOrigin(0.5).setDepth(11);
    text(spec.y.title, 'MINDAQUEST', spec.titleSize, '#fff1be', {
      fontStyle: 'bold', stroke: '#315c42', strokeThickness: Math.round(spec.titleSize / 7), shadow: { color: '#0d302b', blur: 12, fill: true, offsetY: 4 }, letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    text(spec.y.subtitle, 'A little hero. A big world of wonder.', spec.subtitleSize, '#e1f2d1');
    if (spec.y.welcome !== null) text(spec.y.welcome, '✦   WELCOME TO THE EMERALD WILDS   ✦', spec.smallSize, '#c5e6a3', { fontStyle: 'bold', letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle);

    const by = top + spec.y.button;
    const glow = this.add.graphics().setDepth(11);
    glow.fillStyle(0xd69b44, 0.23).fillRoundedRect(cx - spec.buttonW / 2 - 18, by - spec.buttonH / 2 - 8, spec.buttonW + 36, spec.buttonH + 16, 24);
    const button = this.add.container(cx, by).setDepth(12);
    const plate = this.add.rectangle(0, 0, spec.buttonW, spec.buttonH, 0xf0c969, 1).setStrokeStyle(2, 0xffe9a5, 1).setInteractive({ useHandCursor: true });
    button.add(plate);
    button.add(this.add.text(0, -1, 'BEGIN ADVENTURE', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#284f3b', letterSpacing: 0.8, resolution: res } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5));
    plate.on('pointerover', () => plate.setFillStyle(0xffd985));
    plate.on('pointerout', () => plate.setFillStyle(0xf0c969));
    plate.on('pointerdown', () => {
      // This tap is the browser's cue that sound is allowed: wake the audio now, start the music in the world.
      const audio = audioFor(this);
      audio.resume();
      audio.click();
      this.scene.start('WorldScene');
    });

    // Secondary button: opens the wardrobe. It does not start the game or touch the audio.
    const cy = top + spec.y.custom;
    const wardrobe = this.add.container(cx, cy).setDepth(12);
    const wPlate = this.add.rectangle(0, 0, spec.customW, spec.customH, 0x2b5a42, 1).setStrokeStyle(2, 0xe2bf6a, 0.85).setInteractive({ useHandCursor: true });
    wardrobe.add(wPlate);
    wardrobe.add(this.add.text(0, -1, 'CUSTOMISE HERO', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#fff1c9', letterSpacing: 0.8, resolution: res } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5));
    wPlate.on('pointerover', () => wPlate.setFillStyle(0x37704f));
    wPlate.on('pointerout', () => wPlate.setFillStyle(0x2b5a42));
    wPlate.on('pointerdown', () => { const audio = audioFor(this); audio.resume(); audio.click(); this.scene.start('WardrobeScene'); });

    text(spec.y.hint, touch ? 'DRAG THE STICK TO MOVE  ·  TAP USE TO INTERACT' : 'WASD  /  ARROW KEYS  ·  E TO INTERACT  ·  ESC TO PAUSE', spec.smallSize, '#c4e3c0', { fontStyle: 'bold', letterSpacing: 0.5 } as Phaser.Types.GameObjects.Text.TextStyle);
    if (spec.y.tagline !== null) text(spec.y.tagline, 'A bright forest adventure for curious young explorers', spec.smallSize, '#a6ccb1');
    if (spec.hero) {
      const heroY = top + spec.cardH + 44;
      // Feet at heroY + 20, as in the old layout; the Adventurer is drawn at 0.5 x 204 px = a ~67 px figure.
      this.add.image(cx, heroY + 21, 'paint-shadow').setScale(0.5).setDepth(11.8);
      this.add.image(cx, heroY + 20, HERO_ATLAS_KEY('hi'), idleFrameName('south')).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setScale(0.38).setDepth(12);
    }
  }
}
