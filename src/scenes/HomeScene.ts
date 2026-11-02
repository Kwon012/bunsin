// 홈(본체) 화면: 본체·거울·창문·분신 무리. 탭/꾹 누르기 입력, 뿅·피버 연출.
import Phaser from 'phaser';
import { G } from '../game';
import { tap } from '../core/actions';
import { city, cityJobs, isUnlocked, job, owned, totalClones } from '../core/econ';
import { A } from '../core/assumptions';
import { formatKR } from '../core/format';
import { lineText } from '../data/content';
import { sfx } from '../fx/sound';
import { setupCam, txt, W, R, C } from '../ui/kit';
import type { GameEvent } from '../core/state';
import type { Tier } from '../data/economy';
import { eventBubble } from '../ui/m4';

const CAP = 150; // 홈 표시 상한
const BODY = { x: 180, y: 300 };
const MIRROR = { x: 300, y: 150 };
const STAGES: { tier: Tier | 'basement'; name: string; color: number }[] = [
  { tier: 'basement', name: '반지하', color: 0x2b2a35 },
  { tier: 'alba', name: '편의점 카운터', color: 0x24384a },
  { tier: 'job', name: '사무실 책상', color: 0x29403a },
  { tier: 'biz', name: '사장실', color: 0x4a3d24 },
  { tier: 'inv', name: '펜트하우스', color: 0x3d2a4a },
];

export class HomeScene extends Phaser.Scene {
  private room!: Phaser.GameObjects.Rectangle;
  private stageText!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private torso!: Phaser.GameObjects.Rectangle;
  private bodyBox!: Phaser.GameObjects.Container;
  private clones: Phaser.GameObjects.Image[] = [];
  private overflow!: Phaser.GameObjects.Text;
  private feverTint!: Phaser.GameObjects.Rectangle;
  private mirrorGlass!: Phaser.GameObjects.Rectangle;
  private windowGfx!: Phaser.GameObjects.Graphics;
  private windowLabel!: Phaser.GameObjects.Text;
  private holdTimer?: Phaser.Time.TimerEvent;
  private holdStart?: Phaser.Time.TimerEvent;
  private faceReset?: Phaser.Time.TimerEvent;
  private handlers: [string, (e: GameEvent) => void][] = [];
  playerTapTimes: number[] = [];
  onBubbleTap?: () => void;
  private bubble?: Phaser.GameObjects.Container;
  private uniqueLayer?: Phaser.GameObjects.Container;

  constructor() { super('Home'); }

  create() {
    setupCam(this);
    this.room = this.add.rectangle(W / 2, 330, W, 580, STAGES[0].color);
    this.add.rectangle(W / 2, 470, W, 130, 0x000000, 0.18); // 바닥
    this.stageText = txt(this, 12, 218, '', 11, C.dim);
    // 창문 너머: 그 도시 꼭대기 건물 실루엣(잠긴 구역 미리보기)
    this.windowGfx = this.add.graphics();
    this.windowLabel = txt(this, 75, 182, '', 9, '#cfd3ea', { align: 'center', wordWrap: { width: 150 } }).setOrigin(0.5, 0);
    this.drawWindow();
    // 거울
    this.add.rectangle(MIRROR.x, MIRROR.y, 72, 118, 0x8d6e4a).setStrokeStyle(3, 0x5c4630);
    this.mirrorGlass = this.add.rectangle(MIRROR.x, MIRROR.y, 60, 104, 0xbfe6ff, 0.9);
    txt(this, MIRROR.x, MIRROR.y + 66, '거울', 10, C.dim).setOrigin(0.5, 0);
    // 분신 무리
    this.overflow = txt(this, W - 12, 520, '', 12, C.gold, { fontStyle: 'bold' }).setOrigin(1, 1).setDepth(50);
    // 본체
    this.torso = this.add.rectangle(0, 52, 70, 56, 0xff8fab).setStrokeStyle(2, 0x3b2a20);
    this.face = this.add.image(0, 0, 'face_default').setScale(1 / R);
    this.bodyBox = this.add.container(BODY.x, BODY.y, [this.torso, this.face]).setDepth(40);
    const hit = this.add.zone(BODY.x, BODY.y + 20, 130, 150).setInteractive({ useHandCursor: true }).setDepth(41);
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    hit.on('pointerup', () => this.stopHold());
    hit.on('pointerout', () => this.stopHold());
    this.feverTint = this.add.rectangle(W / 2, H2, W, 640, 0xff006e, 0).setDepth(5);
    this.rebuildClones();
    this.refreshStage();
    // 이벤트
    this.on2('hire', (e) => e.t === 'hire' && this.onHire(e.jobId, e.n));
    this.on2('unlock', () => this.refreshStage());
    this.on2('fever_start', () => this.feverStart());
    this.on2('fever_end', () => this.feverEnd());
    this.on2('payday', () => this.cheer());
    this.on2('crown', () => this.time.delayedCall(800, () => { const c = this.clones[this.clones.length - 1]; if (c) this.add.image(c.x, c.y - 14, 'crown').setScale(1 / R).setDepth(c.depth + 1); }));
    this.on2('move', () => { this.rebuildClones(); this.refreshStage(); this.drawWindow(); this.drawUniques(); });
    this.on2('tap', (e) => { if (e.t === 'tap' && e.auto) this.tapFx(BODY.x + Phaser.Math.Between(-30, 30), BODY.y - 40, e.amount, true); });
    this.on2('unique', () => this.drawUniques());
    G.bus.on('event_bubble', () => { this.bubble?.destroy(); this.bubble = eventBubble(this, 100, 250, () => this.onBubbleTap?.()); }, this);
    G.bus.on('event_bubble_end', () => { this.bubble?.destroy(); this.bubble = undefined; }, this);
    this.drawUniques();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.handlers.forEach(([k, f]) => G.bus.off(k, f)));
  }

  private on2(k: string, f: (e: GameEvent) => void) { G.bus.on(k, f); this.handlers.push([k, f]); }

  drawWindow() {
    const g = this.windowGfx; g.clear();
    g.fillStyle(0x87ceeb, 1).fillRect(20, 86, 110, 92);
    g.fillStyle(0x6b8f5e, 1).fillTriangle(20, 178, 75, 120, 130, 178);
    // 꼭대기 건물 실루엣(흐리게)
    g.fillStyle(0x223344, 0.45).fillRect(64, 98, 22, 42).fillTriangle(60, 100, 75, 88, 90, 100);
    g.lineStyle(4, 0x8d6e4a, 1).strokeRect(20, 86, 110, 92).lineBetween(75, 86, 75, 178).lineBetween(20, 132, 130, 132);
    this.windowLabel.setText(`잠긴 구역: ${city(G.s).topBuilding}`);
  }

  /** 개성 분신은 홈에서도 본체 곁에 보인다(이사 후 새 도시 첫 화면부터) */
  drawUniques() {
    this.uniqueLayer?.destroy();
    this.uniqueLayer = this.add.container(0, 0).setDepth(45);
    G.s.uniques.forEach((u, i) => {
      const x = i % 2 === 0 ? BODY.x - 70 - Math.floor(i / 2) * 22 : BODY.x + 70 + Math.floor(i / 2) * 22;
      const y = BODY.y + 60;
      this.uniqueLayer!.add(this.add.image(x, y, 'clone_biz').setScale(1.3 / R));
      this.uniqueLayer!.add(txt(this, x, y - 22, '⭐', 9).setOrigin(0.5));
    });
  }

  refreshStage() {
    const s = G.s;
    const unlocked = cityJobs(s).filter((j) => isUnlocked(s, j));
    const top = unlocked[unlocked.length - 1];
    let i = 0;
    if (top) i = top.tier === 'alba' ? (top.slot >= 2 ? 1 : 0) : top.tier === 'job' ? 2 : top.tier === 'biz' ? 3 : 4;
    this.room.setFillStyle(STAGES[i].color);
    this.stageText.setText(`본체의 자리: ${STAGES[i].name} · ${city(s).name}`);
  }

  private floorPos(): { x: number; y: number } {
    for (let k = 0; k < 20; k++) {
      const x = Phaser.Math.Between(14, W - 14), y = Phaser.Math.Between(345, 520);
      if (Math.abs(x - BODY.x) < 50 && y < 400) continue;
      return { x, y };
    }
    return { x: Phaser.Math.Between(14, 100), y: 500 };
  }

  private addClone(tier: Tier, animate: boolean, delay = 0) {
    const p = this.floorPos();
    const img = this.add.image(animate ? MIRROR.x : p.x, animate ? MIRROR.y : p.y, `clone_${tier}`).setScale(1 / R).setDepth(10 + p.y / 100);
    this.clones.push(img);
    if (animate) {
      img.setScale(0);
      this.tweens.add({ targets: img, scale: 1.4 / R, duration: 160, delay, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: img, x: p.x, duration: 420, ease: 'Sine.easeInOut' });
          this.tweens.add({ targets: img, y: { from: img.y, to: p.y }, duration: 420, ease: 'Back.easeIn' });
          this.tweens.add({ targets: img, scale: 1 / R, duration: 420 });
        } });
    }
    return img;
  }

  rebuildClones() {
    for (const c of this.clones) c.destroy();
    this.clones = [];
    const s = G.s;
    const total = totalClones(s);
    const show = Math.min(total, CAP);
    for (const j of cityJobs(s)) {
      const n = Math.round((owned(s, j.id) / Math.max(1, total)) * show);
      for (let i = 0; i < n && this.clones.length < CAP; i++) this.addClone(j.tier, false);
    }
    this.updateOverflow();
  }
  private updateOverflow() {
    const total = totalClones(G.s);
    this.overflow.setText(total > this.clones.length ? `+${formatKR(total - this.clones.length)}명` : '');
  }

  private onHire(jobId: string, n: number) {
    const tier = job(jobId).tier;
    sfx.pop();
    const room = Math.max(0, CAP - this.clones.length);
    const k = Math.min(n, room, 10);
    // ×10은 기존 분신 동시 점프 + 새 분신 동시 뿅
    if (n >= 10) this.clones.slice(-30).forEach((c) => { if (!this.tweens.isTweening(c)) this.tweens.add({ targets: c, y: c.y - 18, duration: 160, yoyo: true }); });
    for (let i = 0; i < k; i++) this.addClone(tier, true, n >= 10 ? 0 : i * 40);
    this.updateOverflow();
    // 거울 컷 변주
    const colors = [0xbfe6ff, 0xffe0f0, 0xe0ffe0, 0xfff3c4];
    this.mirrorGlass.setFillStyle(0xffffff, 1);
    this.time.delayedCall(90, () => this.mirrorGlass.setFillStyle(colors[G.s.totalHired % colors.length], 0.9));
    // 첫 5분 대사(10~36초 같은 고용 구간 변주)
    const line = G.s.sessions <= 1 ? lineText('first5', String(G.s.totalHired)) : undefined;
    if (line) {
      const c = this.clones[this.clones.length - 1];
      this.say(c ? c.x : MIRROR.x, (c ? c.y : MIRROR.y) - 20, line, 2600);
      if (G.s.totalHired === 5) this.clones.forEach((c2, i) => this.tweens.add({ targets: c2, angle: { from: -15, to: 15 }, duration: 120, yoyo: true, repeat: 2, delay: i * 30 }));
    }
  }

  say(x: number, y: number, text: string, ms = 2000) {
    const t = txt(this, 0, 0, text, 11, '#222', { backgroundColor: '#ffffff', padding: { x: 6, y: 4 }, wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5, 1);
    const cx = Phaser.Math.Clamp(x, t.width / 2 + 4, W - t.width / 2 - 4);
    t.setPosition(cx, Math.max(60, y)).setDepth(300).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: t, alpha: 0, duration: 200, onComplete: () => t.destroy() }));
  }

  private onTap(p: Phaser.Input.Pointer) {
    const now = performance.now();
    this.playerTapTimes.push(now);
    while (this.playerTapTimes.length && now - this.playerTapTimes[0] > A.X_tapRateWindowSec * 1000) this.playerTapTimes.shift();
    const v = G.act((o) => tap(G.s, o));
    this.tapFx(p.worldX, p.worldY, v, false);
    this.holdStart?.remove();
    this.holdStart = this.time.delayedCall(400, () => {
      this.holdTimer = this.time.addEvent({ delay: 1000 / A.X_holdTapsPerSec, loop: true, callback: () => {
        const v2 = G.act((o) => tap(G.s, o, true));
        this.tapFx(BODY.x + Phaser.Math.Between(-20, 20), BODY.y - 30, v2, true);
      } });
    });
    this.bus('first_tap');
  }
  private bus(k: string) { G.bus.emit(k); }
  private stopHold() { this.holdStart?.remove(); this.holdTimer?.remove(); this.holdStart = undefined; this.holdTimer = undefined; }

  tapFx(x: number, y: number, v: number, auto: boolean) {
    if (!auto) sfx.tap();
    this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_work');
    this.faceReset?.remove();
    this.faceReset = this.time.delayedCall(260, () => this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_default'));
    this.tweens.add({ targets: this.bodyBox, scaleY: 0.9, scaleX: 1.06, duration: 50, yoyo: true });
    const t = txt(this, x, y - 10, `+${formatKR(v)}`, auto ? 11 : 14, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    if (!auto) {
      const coin = this.add.image(BODY.x, BODY.y - 10, 'coin').setScale(1 / R).setDepth(60);
      this.tweens.add({ targets: coin, x: coin.x + Phaser.Math.Between(-70, 70), y: coin.y - Phaser.Math.Between(30, 70), duration: 250, ease: 'Quad.easeOut',
        onComplete: () => this.tweens.add({ targets: coin, y: coin.y + 80, alpha: 0, duration: 300, onComplete: () => coin.destroy() }) });
    }
  }

  private feverStart() {
    sfx.fever();
    this.face.setTexture('face_cheer');
    this.say(BODY.x, BODY.y - 60, '📣 다 같이 힘내자!', 1500);
    this.clones.forEach((c, i) => { c.setData('baseY', c.y); this.tweens.add({ targets: c, y: c.y - 8, duration: 180, yoyo: true, repeat: -1, delay: (i % 10) * 30 }); });
  }
  private feverEnd() {
    this.tweens.killTweensOf(this.clones);
    this.clones.forEach((c) => { const y = c.getData('baseY'); if (typeof y === 'number') c.y = y; });
    this.face.setTexture('face_default');
    this.feverTint.setAlpha(0);
  }
  cheer() {
    this.face.setTexture('face_cheer');
    this.time.delayedCall(1500, () => this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_default'));
    this.clones.forEach((c, i) => this.tweens.add({ targets: c, y: c.y - 14, duration: 200, yoyo: true, repeat: 2, delay: (i % 12) * 25 }));
  }

  update() {
    const s = G.s;
    // 피버 3단계 색 변화(충전 중 게이지 단계 / 피버 중 맥동)
    if (s.feverLeft > 0) this.feverTint.setFillStyle(0xff006e, 0.12 + 0.08 * Math.sin(this.time.now / 120));
    else {
      const stage = s.feverGauge >= 2 / 3 ? 0.09 : s.feverGauge >= 1 / 3 ? 0.05 : 0;
      this.feverTint.setFillStyle(s.feverGauge >= 2 / 3 ? 0xff9f1c : 0xffd166, stage);
    }
  }
}
const H2 = 320;
