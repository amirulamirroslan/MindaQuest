import './style.css';
import Phaser from 'phaser';
import { gameConfig } from './game/config';
const game = new Phaser.Game({ ...gameConfig, parent: 'game' });
window.addEventListener('beforeunload', () => game.destroy(true));
