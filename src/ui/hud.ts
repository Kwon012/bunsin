// 상단 바(보유 금액·초당 수입·월급날), 목표 바, 피버 게이지, 월급날 카운트다운
import Phaser from 'phaser';
import { G } from '../game';
import { incomeNow, eco } from '../core/econ';
import { goalProgress, goalRemaining, goalEta, updateGoal, accountTotal } from '../core/recommend';
import { formatKR, formatSec } from '../core/format';
import { txt, W, C } from './kit';

export class Hud {
  money: Phaser.GameObjects.Text;
  income: Phaser.GameObjects.Text;
  payday: Phaser.GameObjects.Text;
  piggy: Phaser.GameObjects.Text;
  goalLabel: Phaser.GameObjects.Text;
  goalFill: Phaser.GameObjects.Rectangle;
  goalBox: Phaser.GameObjects.Container;
  gaugeBox: Phaser.GameObjects.Container;
  gaugeFill: Phaser.GameObjects.Rectangle;
  gaugeText: Phaser.GameObjects.Text;
  countdown: Phaser.GameObjects.Text;
  private halfShownFor = '';
  private lastCount = -1;

  constructor(private scene: Phaser.Scene) {
    const s = scene;
    s.add.rectangle(W / 2, 22, W, 44, 0x14151f, 0.95).setDepth(600);
    this.money = txt(s, 12, 4, '0', 20, C.gold, { fontStyle: 'bold' }).setDepth(601);
    this.income = txt(s, 12, 27, '', 11, C.dim).setDepth(601);
    this.payday = txt(s, W - 12, 6, '', 11, C.text).setOrigin(1, 0).setDepth(601);
    this.piggy = txt(s, W - 12, 25, '', 10, '#ffb3c6').setOrigin(1, 0).setDepth(601);
    // 목표 바
    const gb = s.add.rectangle(W / 2, 58, W - 16, 22, 0x2a2d3e).setStrokeStyle(1, 0x4a4f6a);
    this.goalFill = s.add.rectangle(8, 58, 0, 22, 0x06d6a0, 0.55).setOrigin(0, 0.5);
    this.goalLabel = txt(s, W / 2, 58, '', 11, C.text, { fontStyle: 'bold' }).setOrigin(0.5);
    this.goalBox = s.add.container(0, 0, [gb, this.goalFill, this.goalLabel]).setDepth(600);
    // 피버 게이지(홈 탭에서만)
    const bg = s.add.rectangle(W / 2, 524, W - 120, 12, 0x2a2d3e).setStrokeStyle(1, 0x4a4f6a);
    this.gaugeFill = s.add.rectangle(60, 524, 0, 12, 0xffd166).setOrigin(0, 0.5);
    this.gaugeText = txt(s, W / 2, 524, '응원 게이지', 9, C.text).setOrigin(0.5);
    this.gaugeBox = s.add.container(0, 0, [bg, this.gaugeFill, this.gaugeText]).setDepth(450);
    this.countdown = txt(s, W / 2, 250, '', 64, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(900).setVisible(false);
  }

  update() {
    const s = G.s;
    this.money.setText(`${formatKR(s.money)}원`);
    this.income.setText(`초당 ${formatKR(incomeNow(s))}원${s.feverLeft > 0 ? ' 🔥×3' : ''}`);
    this.payday.setText(`월급날까지 ${formatSec(s.paydayIn)}`);
    this.piggy.setText(s.account.open ? `🐷 ${formatKR(accountTotal(s))}` : '');
    // 목표 바
    const g = updateGoal(s);
    if (g) {
      const rem = goalRemaining(s, g);
      const eta = goalEta(s, g);
      const p = goalProgress(s, g);
      this.goalFill.width = (W - 16) * p;
      this.goalLabel.setText(`🎯 ${g.label} · ${rem.left}명 남음${eta > 0 && Number.isFinite(eta) ? ` · 약 ${formatSec(eta)}` : ''}`);
      // 자금이 절반 찼을 때 작은 연출
      const key = `${g.kind}:${g.jobId}:${g.target}:${rem.left}`;
      if (rem.cost > 0 && s.money >= rem.cost / 2 && this.halfShownFor !== key) {
        this.halfShownFor = key;
        this.scene.tweens.add({ targets: this.goalLabel, scale: 1.12, duration: 120, yoyo: true });
      }
    } else { this.goalLabel.setText('🎯 다음 목표 준비 중'); this.goalFill.width = 0; }
    // 피버 게이지 3단계 색
    if (s.feverLeft > 0) {
      this.gaugeFill.width = (W - 120) * (s.feverLeft / eco('fever_duration_sec'));
      this.gaugeFill.setFillStyle(0xff006e);
      this.gaugeText.setText(`응원 피버! ×3  콤보 ${s.feverCombo}`);
    } else {
      this.gaugeFill.width = (W - 120) * s.feverGauge;
      this.gaugeFill.setFillStyle(s.feverGauge >= 2 / 3 ? 0xff9f1c : s.feverGauge >= 1 / 3 ? 0xffd166 : 0x80ed99);
      this.gaugeText.setText('연타로 응원 게이지 충전');
    }
    // 월급날 10초 카운트다운
    const left = Math.ceil(s.paydayIn);
    if (s.paydayIn <= 10 && s.paydayIn > 0) {
      this.countdown.setVisible(true);
      if (left !== this.lastCount) {
        this.lastCount = left;
        this.countdown.setText(`월급날 ${left}`).setScale(1.3);
        this.scene.tweens.add({ targets: this.countdown, scale: 1, duration: 250 });
      }
    } else { this.countdown.setVisible(false); this.lastCount = -1; }
  }
}
