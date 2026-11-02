import Phaser from 'phaser';
import { ECON, validateEconomy } from './data/economy';

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    const errs = validateEconomy(ECON);
    this.add.text(180, 300, errs.length ? `데이터 오류 ${errs.length}건` : `M0 OK · 도시 ${ECON.cities.length} · 직종 ${ECON.jobs.length}`, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    this.add.text(356, 636, `build ${__BUILD_ID__}`, { fontSize: '10px', color: '#5c6080' }).setOrigin(1, 1);
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#1d1f2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 360, height: 640 }, scene: [BootScene] });
