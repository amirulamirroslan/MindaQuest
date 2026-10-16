import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { WorldScene } from './scenes/WorldScene';
import { PauseScene } from './scenes/PauseScene';
export const GAME_WIDTH=960; export const GAME_HEIGHT=600;
export const gameConfig: Phaser.Types.Core.GameConfig={type:Phaser.AUTO,width:GAME_WIDTH,height:GAME_HEIGHT,parent:'game',backgroundColor:'#163c2c',pixelArt:true,roundPixels:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:GAME_WIDTH,height:GAME_HEIGHT},physics:{default:'arcade',arcade:{debug:false}},scene:[BootScene,MainMenuScene,WorldScene,PauseScene]};
