import Phaser from 'phaser';
import { G } from '../game';
import { makeTextures } from '../fx/textures';
import { ECON, validateEconomy } from '../data/economy';
import { setupCam, txt, W, H } from '../ui/kit';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    setupCam(this);
    const errs = validateEconomy(ECON);
    if (errs.length) {
      txt(this, W / 2, H / 2, `경제 데이터 오류 ${errs.length}건\n${errs.slice(0, 5).join('\n')}`, 12, '#ef476f', { align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
      return;
    }
    makeTextures(this);
    G.boot();
    this.scene.launch('Home');
    this.scene.launch('Village');
    this.scene.sleep('Village');
    this.scene.launch('UI');
    this.scene.stop();
  }
}
