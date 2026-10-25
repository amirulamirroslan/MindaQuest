import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { WorldScene } from './scenes/WorldScene';
import { PauseScene } from './scenes/PauseScene';
import { WardrobeScene } from './scenes/WardrobeScene';
import { LAYOUT_KEY } from './responsive';
import { MAX_FRAME_DELTA_MS } from './systems/movement';
import type { ViewportLayout } from './systems/viewport';

// `?renderer=canvas` is a developer switch for machines without WebGL (used for automated screenshots).
const forceCanvas = typeof location !== 'undefined' && new URLSearchParams(location.search).get('renderer') === 'canvas';

/**
 * The canvas is created at the real viewport size (in device pixels) and kept in sync by `ResponsiveViewport`.
 * `Scale.NONE` + `zoom` shows it at CSS size without any stretching or letterboxing.
 */
export function createGameConfig(layout: ViewportLayout, parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    width: layout.width,
    height: layout.height,
    parent,
    backgroundColor: '#163c2c',
    pixelArt: true,
    roundPixels: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / layout.renderScale, autoCenter: Phaser.Scale.NO_CENTER },
    // Frames longer than this are treated as the last sane frame time (tab resumes, hitches), never as a huge jump.
    fps: { min: 1000 / MAX_FRAME_DELTA_MS },
    // Physics steps once per rendered frame with the real frame time instead of a fixed 60 Hz step that
    // aliases against 90/120/144 Hz displays and uneven frames.
    physics: { default: 'arcade', arcade: { debug: false, fixedStep: false } },
    input: { activePointers: 3 },
    callbacks: { preBoot: (game) => game.registry.set(LAYOUT_KEY, layout) },
    scene: [BootScene, MainMenuScene, WardrobeScene, WorldScene, PauseScene],
  };
}
