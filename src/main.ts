import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { VillageScene } from './scenes/VillageScene';
import { UIScene } from './scenes/UIScene';
import { W, H, R } from './ui/kit';
import { G } from './game';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1f2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W * R, height: H * R },
  input: { activePointers: 3 },
  render: { preserveDrawingBuffer: true },
  scene: [BootScene, HomeScene, VillageScene, UIScene],
});
(window as unknown as Record<string, unknown>).__bunsin = { game, G };
