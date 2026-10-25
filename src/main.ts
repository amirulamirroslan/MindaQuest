import './style.css';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { measureLayout, ResponsiveViewport } from './game/responsive';
import { GameAudio } from './game/audio/GameAudio';
import { wantsFpsMeter } from './game/systems/features';

const parent = document.getElementById('game') as HTMLElement;
const game = new Phaser.Game(createGameConfig(measureLayout(parent), parent));
const responsive = new ResponsiveViewport(game, parent, game.registry.get('layout'));
// Developer hook for automated checks; only active with ?debug in the URL.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __game: game, __GameAudio: GameAudio });
if (wantsFpsMeter(location.search)) {
  // A tiny readout for finding slow devices: frames per second, the renderer in use (WebGL is the fast one) and the effects tier.
  const meter = document.createElement('div');
  meter.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:9;font:11px monospace;color:#fff;background:rgba(0,0,0,.65);padding:2px 6px;border-radius:4px;pointer-events:none';
  document.body.appendChild(meter);
  window.setInterval(() => {
    const world = game.scene.getScene('WorldScene') as unknown as { profile?: { tier: string } };
    meter.textContent = `${game.loop.actualFps.toFixed(0)} fps · ${game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'CANVAS (slow)'} · ${world.profile?.tier ?? 'menu'}`;
  }, 500);
}
window.addEventListener('beforeunload', () => { responsive.destroy(); game.destroy(true); });
