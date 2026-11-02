// 홈(본체) 화면: 본체·거울·창문·가구·분신. 배경 어디든 탭 = 본체가 일함(꾹 누르기 = 느린 자동 탭).
// 분신은 거울에서 튀어나와 바닥에 떨어진 뒤 걸어간다. 홈에는 최대 home_clone_cap명만 있고 나머지는 문으로 마을과 출퇴근한다.
import Phaser from 'phaser';
import { G } from '../game';
import { tap } from '../core/actions';
import { city, cityJobs, eco, isUnlocked, job, owned, totalClones } from '../core/econ';
import { currentHouse, houseFurniture, furnLevel } from '../core/home';
import { A } from '../core/assumptions';
import { formatKR } from '../core/format';
import { lineText } from '../data/content';
import { sfx } from '../fx/sound';
import { setupCam, txt, W, R, C, TIER_COLOR } from '../ui/kit';
import type { GameEvent } from '../core/state';
import type { Tier } from '../data/economy';
import { eventBubble } from '../ui/m4';
import { directTapFaster } from '../ui/m5';

const BODY = { x: 180, y: 300 };
const MIRROR = { x: 300, y: 150 };
const DOOR = { x: 18, y: 470 };
const FLOOR = { top: 360, bottom: 515 };
const WALK_SPEED = 55; // px/s
const STAGES: { name: string; color: number }[] = [
  { name: '반지하', color: 0x2b2a35 }, { name: '편의점 카운터', color: 0x24384a }, { name: '사무실 책상', color: 0x29403a },
  { name: '사장실', color: 0x4a3d24 }, { name: '펜트하우스', color: 0x3d2a4a },
];

interface Walker { img: Phaser.GameObjects.Image; busy: boolean }

export class HomeScene extends Phaser.Scene {
  private room!: Phaser.GameObjects.Rectangle;
  private stageText!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private bodyBox!: Phaser.GameObjects.Container;
  private walkers: Walker[] = [];
  private countText!: Phaser.GameObjects.Text;
  private feverTint!: Phaser.GameObjects.Rectangle;
  private mirrorGlass!: Phaser.GameObjects.Rectangle;
  private windowGfx!: Phaser.GameObjects.Graphics;
  private windowLabel!: Phaser.GameObjects.Text;
  private furnLayer?: Phaser.GameObjects.Container;
  private holdTimer?: Phaser.Time.TimerEvent;
  private holdStart?: Phaser.Time.TimerEvent;
  private faceReset?: Phaser.Time.TimerEvent;
  private handlers: [string, (e: GameEvent) => void][] = [];
  playerTapTimes: number[] = [];
  onBubbleTap?: () => void;
  private bubble?: Phaser.GameObjects.Container;
  private uniqueLayer?: Phaser.GameObjects.Container;
  private manager?: Phaser.GameObjects.Container;
  private fasterText!: Phaser.GameObjects.Text;
  private combo = 0;
  private lastTapAt = 0;
  private commuteT = 0;
  private wanderT = 0;

  constructor() { super('Home'); }

  get homeCap() { return eco('home_clone_cap'); }

  create() {
    setupCam(this);
    this.room = this.add.rectangle(W / 2, 330, W, 580, STAGES[0].color);
    this.add.rectangle(W / 2, 455, W, 150, 0x000000, 0.18); // 바닥
    // 문(출퇴근)
    this.add.rectangle(DOOR.x, DOOR.y - 28, 30, 60, 0x6b4f35).setStrokeStyle(2, 0x3b2a20);
    this.add.circle(DOOR.x + 9, DOOR.y - 26, 2.5, 0xffd166);
    this.stageText = txt(this, 12, 196, '', 10, C.dim);
    this.windowGfx = this.add.graphics();
    this.windowLabel = txt(this, 75, 182, '', 9, '#cfd3ea', { align: 'center', wordWrap: { width: 150 } }).setOrigin(0.5, 0);
    this.drawWindow();
    this.add.rectangle(MIRROR.x, MIRROR.y, 72, 118, 0x8d6e4a).setStrokeStyle(3, 0x5c4630);
    this.mirrorGlass = this.add.rectangle(MIRROR.x, MIRROR.y, 60, 104, 0xbfe6ff, 0.9);
    txt(this, MIRROR.x, MIRROR.y + 66, '거울', 10, C.dim).setOrigin(0.5, 0);
    this.countText = txt(this, W - 10, 520, '', 11, C.gold, { fontStyle: 'bold' }).setOrigin(1, 1).setDepth(50);
    // 본체
    const torso = this.add.rectangle(0, 52, 70, 56, 0xff8fab).setStrokeStyle(2, 0x3b2a20);
    this.face = this.add.image(0, 0, 'face_default').setScale(1 / R);
    this.bodyBox = this.add.container(BODY.x, BODY.y, [torso, this.face]).setDepth(40);
    // 배경 전체 탭(버튼·시트·말풍선은 UI가 먼저 받는다)
    const hit = this.add.zone(W / 2, 300, W, 460).setInteractive().setDepth(1);
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    hit.on('pointerup', () => this.stopHold());
    hit.on('pointerout', () => this.stopHold());
    this.feverTint = this.add.rectangle(W / 2, 320, W, 640, 0xff006e, 0).setDepth(5);
    this.drawFurniture();
    this.fillHome();
    this.refreshStage();
    this.on2('hire', (e) => e.t === 'hire' && this.onHire(e.jobId, e.n));
    this.on2('unlock', () => this.refreshStage());
    this.on2('fever_start', () => this.feverStart());
    this.on2('fever_end', () => this.feverEnd());
    this.on2('payday', () => this.cheer());
    this.on2('crown', () => this.time.delayedCall(1300, () => { const w = this.walkers[this.walkers.length - 1]; if (w) this.add.image(0, 0, 'crown').setScale(1 / R).setData('follow', w.img).setDepth(60); }));
    this.on2('move', () => { this.clearWalkers(); this.fillHome(); this.refreshStage(); this.drawWindow(); this.drawUniques(); this.drawFurniture(); });
    this.on2('tap', (e) => { if (e.t === 'tap' && e.auto) this.tapFx(BODY.x + Phaser.Math.Between(-30, 30), BODY.y - 40, e.amount, true); });
    this.on2('unique', () => this.drawUniques());
    this.on2('furniture', () => { this.drawFurniture(); sfx.pop(); });
    this.on2('house', () => { this.drawFurniture(); this.refreshStage(); this.cheer(); });
    G.bus.on('event_bubble', () => { this.bubble?.destroy(); this.bubble = eventBubble(this, 100, 250, () => this.onBubbleTap?.()); }, this);
    G.bus.on('event_bubble_end', () => { this.bubble?.destroy(); this.bubble = undefined; }, this);
    this.drawUniques();
    this.fasterText = txt(this, BODY.x, BODY.y - 70, ' ', 11, '#06d6a0', { fontStyle: 'bold', backgroundColor: '#000000aa', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(60).setVisible(false);
    this.drawManager();
    this.on2('manager', () => this.drawManager());
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.handlers.forEach(([k, f]) => G.bus.off(k, f)));
  }

  private on2(k: string, f: (e: GameEvent) => void) { G.bus.on(k, f); this.handlers.push([k, f]); }

  drawWindow() {
    const g = this.windowGfx; g.clear();
    g.fillStyle(0x87ceeb, 1).fillRect(20, 86, 110, 92);
    g.fillStyle(0x6b8f5e, 1).fillTriangle(20, 178, 75, 120, 130, 178);
    g.fillStyle(0x223344, 0.45).fillRect(64, 98, 22, 42).fillTriangle(60, 100, 75, 88, 90, 100);
    g.lineStyle(4, 0x8d6e4a, 1).strokeRect(20, 86, 110, 92).lineBetween(75, 86, 75, 178).lineBetween(20, 132, 130, 132);
    this.windowLabel.setText(`잠긴 구역: ${city(G.s).topBuilding}`);
  }

  /** 집 가구(레벨이 오를수록 진해지고 별이 붙는다) */
  drawFurniture() {
    this.furnLayer?.destroy();
    this.furnLayer = this.add.container(0, 0).setDepth(8);
    const fs = houseFurniture(currentHouse(G.s).id);
    const xs = [48, 112, 248, 312];
    fs.forEach((f, i) => {
      const lv = furnLevel(G.s, f.id);
      const x = xs[i % xs.length], y = 250;
      const w = 34 + lv * 6, h = 22 + lv * 4;
      const box = this.add.rectangle(x, y + 30 - h / 2, w, h, lv ? 0xc8a27a : 0x000000, lv ? 0.35 + lv * 0.2 : 0.15).setStrokeStyle(1, 0xffffff, lv ? 0.6 : 0.25);
      const label = txt(this, x, y + 34, `${f.name}${lv ? ' ' + '★'.repeat(lv) : ''}`, 8, lv ? '#ffe8b0' : '#777').setOrigin(0.5, 0);
      this.furnLayer!.add([box, label]);
    });
  }

  drawManager() {
    this.manager?.destroy();
    if (!G.s.managerUnlocked) return;
    const m = this.add.image(26, 10, 'clone_job').setScale(1.8 / R);
    const clip = txt(this, 40, 4, '📋', 12).setOrigin(0.5);
    const coffee = txt(this, BODY.x + 42 - (W / 2 + 60), 0, '☕', 16).setOrigin(0.5);
    this.manager = this.add.container(W / 2 + 60, BODY.y + 30, [m, clip, coffee]).setDepth(46);
  }

  drawUniques() {
    this.uniqueLayer?.destroy();
    this.uniqueLayer = this.add.container(0, 0).setDepth(45);
    if (G.s.flags.memorial7) {
      this.uniqueLayer.add(this.add.image(BODY.x, BODY.y + 92, 'clone_inv').setScale(1.4 / R));
      this.uniqueLayer.add(this.add.image(BODY.x, BODY.y + 76, 'crown').setScale(1 / R));
    }
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
    this.stageText.setText(`🏠 ${currentHouse(s).name} · 본체의 자리: ${STAGES[i].name} · ${city(s).name}`);
  }

  // ---------- 분신(걷기·출퇴근) ----------
  private floorPos(): { x: number; y: number } {
    for (let k = 0; k < 20; k++) {
      const x = Phaser.Math.Between(40, W - 16), y = Phaser.Math.Between(FLOOR.top, FLOOR.bottom);
      if (Math.abs(x - BODY.x) < 46 && y < 400) continue;
      return { x, y };
    }
    return { x: 100, y: 500 };
  }
  /** 보유 직종 중 인원 비율로 무작위 등급 */
  private randomTier(): Tier {
    const s = G.s; const total = totalClones(s);
    let r = Math.random() * Math.max(1, total);
    for (const j of cityJobs(s)) { r -= owned(s, j.id); if (r <= 0) return j.tier; }
    return 'alba';
  }
  private spawn(tier: Tier, x: number, y: number): Walker {
    const img = this.add.image(x, y, `clone_${tier}`).setScale(1 / R).setDepth(10 + y / 100);
    const w = { img, busy: false };
    this.walkers.push(w);
    return w;
  }
  /** 걸어서 이동(거리 비례 시간 + 뒤뚱거림) */
  private walkTo(w: Walker, x: number, y: number, done?: () => void) {
    w.busy = true;
    const dist = Phaser.Math.Distance.Between(w.img.x, w.img.y, x, y);
    const dur = Math.max(250, (dist / WALK_SPEED) * 1000);
    w.img.setFlipX(x < w.img.x);
    const wob = this.tweens.add({ targets: w.img, angle: { from: -7, to: 7 }, duration: 160, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: w.img, x, y, duration: dur, ease: 'Linear',
      onUpdate: () => w.img.setDepth(10 + w.img.y / 100),
      onComplete: () => { wob.stop(); w.img.setAngle(0); w.busy = false; done?.(); } });
  }
  private leave(w: Walker) {
    this.walkTo(w, DOOR.x, DOOR.y, () => {
      this.tweens.add({ targets: w.img, alpha: 0, duration: 200, onComplete: () => w.img.destroy() });
      this.walkers = this.walkers.filter((x) => x !== w);
    });
  }
  private arrive(tier: Tier) {
    const w = this.spawn(tier, DOOR.x, DOOR.y);
    w.img.setAlpha(0);
    this.tweens.add({ targets: w.img, alpha: 1, duration: 200 });
    const p = this.floorPos();
    this.walkTo(w, p.x, p.y);
  }
  private clearWalkers() { this.walkers.forEach((w) => w.img.destroy()); this.walkers = []; }
  /** 처음 열 때: 홈 정원만큼 배치 */
  fillHome() {
    const n = Math.min(this.homeCap, totalClones(G.s));
    for (let i = 0; i < n; i++) { const p = this.floorPos(); this.spawn(this.randomTier(), p.x, p.y); }
    this.updateCount();
  }
  private updateCount() {
    const total = totalClones(G.s);
    this.countText.setText(total > this.walkers.length ? `홈 ${this.walkers.length}명 · 마을 ${formatKR(total - this.walkers.length)}명` : '');
  }

  /** 고용: 거울 반짝 → 튀어나옴 → 바닥에 착지(먼지) → 걸어서 자리로(홈이 가득이면 문으로 출근) */
  private onHire(jobId: string, n: number) {
    const tier = job(jobId).tier;
    sfx.pop();
    this.mirrorGlass.setFillStyle(0xffffff, 1);
    this.time.delayedCall(110, () => this.mirrorGlass.setFillStyle(0xbfe6ff, 0.9));
    if (n >= 10) this.walkers.forEach((w) => { if (!w.busy) this.tweens.add({ targets: w.img, y: w.img.y - 16, duration: 150, yoyo: true }); });
    const k = Math.min(n, 10);
    for (let i = 0; i < k; i++) this.time.delayedCall(n >= 10 ? i * 50 : i * 120, () => this.popOne(tier));
    const line = G.s.sessions <= 1 ? lineText('first5', String(G.s.totalHired)) : undefined;
    if (line) this.time.delayedCall(900, () => { const w = this.walkers[this.walkers.length - 1]; this.say(w ? w.img.x : MIRROR.x, (w ? w.img.y : MIRROR.y) - 20, line, 2600); });
  }
  private popOne(tier: Tier) {
    const w = this.spawn(tier, MIRROR.x, MIRROR.y);
    w.busy = true;
    w.img.setScale(0).setDepth(70);
    const landX = MIRROR.x - Phaser.Math.Between(20, 70), landY = FLOOR.top + Phaser.Math.Between(0, 20);
    this.tweens.add({ targets: w.img, scale: 1.5 / R, duration: 140, ease: 'Back.easeOut', onComplete: () => {
      // 포물선 낙하: x는 일정, y는 위로 살짝 → 아래로 가속
      this.tweens.add({ targets: w.img, x: landX, duration: 420, ease: 'Linear' });
      this.tweens.add({ targets: w.img, y: MIRROR.y - 24, duration: 150, ease: 'Quad.easeOut', onComplete: () => {
        this.tweens.add({ targets: w.img, y: landY, duration: 270, ease: 'Quad.easeIn', onComplete: () => {
          // 착지: 찌그러짐 + 먼지
          this.tweens.add({ targets: w.img, scaleY: 0.7 / R, scaleX: 1.25 / R, duration: 70, yoyo: true, onComplete: () => w.img.setScale(1 / R) });
          for (const dx of [-8, 8]) {
            const d = this.add.circle(landX + dx, landY + 9, 3, 0xdddddd, 0.7).setDepth(69);
            this.tweens.add({ targets: d, x: d.x + dx, scale: 2, alpha: 0, duration: 350, onComplete: () => d.destroy() });
          }
          this.time.delayedCall(160, () => {
            w.busy = false;
            if (this.walkers.length > this.homeCap) this.leave(w); // 홈이 가득 → 마을로 출근
            else { const p = this.floorPos(); this.walkTo(w, p.x, p.y); }
            this.updateCount();
          });
        } });
      } });
    } });
  }

  say(x: number, y: number, text: string, ms = 2000) {
    const t = txt(this, 0, 0, text, 11, '#222', { backgroundColor: '#ffffff', padding: { x: 6, y: 4 }, wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5, 1);
    const cx = Phaser.Math.Clamp(x, t.width / 2 + 4, W - t.width / 2 - 4);
    t.setPosition(cx, Math.max(60, y)).setDepth(300).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: t, alpha: 0, duration: 200, onComplete: () => t.destroy() }));
  }

  // ---------- 탭 ----------
  private onTap(p: Phaser.Input.Pointer) {
    const now = performance.now();
    this.combo = now - this.lastTapAt < 600 ? this.combo + 1 : 1;
    this.lastTapAt = now;
    this.playerTapTimes.push(now);
    while (this.playerTapTimes.length && now - this.playerTapTimes[0] > A.X_tapRateWindowSec * 1000) this.playerTapTimes.shift();
    const v = G.act((o) => tap(G.s, o));
    this.tapFx(p.worldX, p.worldY, v, false);
    this.holdStart?.remove();
    this.holdStart = this.time.delayedCall(400, () => {
      this.holdTimer = this.time.addEvent({ delay: 1000 / A.X_holdTapsPerSec, loop: true, callback: () => {
        const v2 = G.act((o) => tap(G.s, o, true));
        this.tapFx(p.worldX + Phaser.Math.Between(-12, 12), p.worldY - 10, v2, true);
      } });
    });
    G.bus.emit('first_tap');
  }
  private stopHold() { this.holdStart?.remove(); this.holdTimer?.remove(); this.holdStart = undefined; this.holdTimer = undefined; }

  /** 탭 손맛: 충격 링 + 숫자(콤보가 오를수록 크게) + 본체 찌그러짐 + 동전이 상단 금액으로 + 소리 음높이 상승 + 약한 진동. 10콤보마다 큰 연출 */
  tapFx(x: number, y: number, v: number, auto: boolean) {
    this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_work');
    this.faceReset?.remove();
    this.faceReset = this.time.delayedCall(240, () => this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_default'));
    this.tweens.killTweensOf(this.bodyBox);
    this.bodyBox.setScale(1);
    this.tweens.add({ targets: this.bodyBox, scaleY: 0.9, scaleX: 1.07, duration: 45, yoyo: true });
    const size = auto ? 11 : 13 + Math.min(7, Math.floor(this.combo / 5));
    const t = txt(this, x + Phaser.Math.Between(-8, 8), y - 12, `+${formatKR(v)}`, size, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    if (auto) return;
    sfx.tap(1 + Math.min(0.5, this.combo * 0.02));
    try { if (G.s.settings.sound) navigator.vibrate?.(6); } catch { /* 미지원 */ }
    const ring = this.add.circle(x, y, 9).setStrokeStyle(3, 0xffd166).setDepth(199);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    G.bus.emit('coin', x, y);
    if (this.combo % 10 === 0) {
      const big = this.add.circle(x, y, 16).setStrokeStyle(4, 0xff9f1c).setDepth(199);
      this.tweens.add({ targets: big, scale: 3.2, alpha: 0, duration: 380, onComplete: () => big.destroy() });
      const ct = txt(this, x, y - 40, `${this.combo} 콤보!`, 16, '#ff9f1c', { fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(201);
      this.tweens.add({ targets: ct, y: ct.y - 24, alpha: 0, scale: 1.3, duration: 700, onComplete: () => ct.destroy() });
      try { if (G.s.settings.sound) navigator.vibrate?.(15); } catch { /* 미지원 */ }
    }
  }

  private feverStart() {
    sfx.fever();
    this.cameras.main.shake(90, 0.003);
    this.face.setTexture('face_cheer');
    this.say(BODY.x, BODY.y - 60, '📣 다 같이 힘내자!', 1500);
    this.walkers.forEach((w, i) => { if (!w.busy) this.tweens.add({ targets: w.img, y: w.img.y - 8, duration: 180, yoyo: true, repeat: 40, delay: (i % 10) * 30 }); });
  }
  private feverEnd() { this.face.setTexture('face_default'); this.feverTint.setAlpha(0); }
  cheer() {
    this.face.setTexture('face_cheer');
    this.time.delayedCall(1500, () => this.face.setTexture(G.s.feverLeft > 0 ? 'face_cheer' : 'face_default'));
    this.walkers.forEach((w, i) => { if (!w.busy) this.tweens.add({ targets: w.img, y: w.img.y - 14, duration: 200, yoyo: true, repeat: 2, delay: (i % 12) * 25 }); });
  }

  update(_t: number, delta: number) {
    const s = G.s;
    if (s.managerUnlocked) {
      const now = performance.now();
      while (this.playerTapTimes.length && now - this.playerTapTimes[0] > A.X_tapRateWindowSec * 1000) this.playerTapTimes.shift();
      const f = directTapFaster(this.playerTapTimes, A.X_tapRateWindowSec, A.X_managerTapsPerSec);
      if (f) this.fasterText.setText('직접 탭 = 더 빠름!');
      this.fasterText.setVisible(f);
    }
    if (s.feverLeft > 0) this.feverTint.setFillStyle(0xff006e, 0.12 + 0.08 * Math.sin(this.time.now / 120));
    else {
      const stage = s.feverGauge >= 2 / 3 ? 0.09 : s.feverGauge >= 1 / 3 ? 0.05 : 0;
      this.feverTint.setFillStyle(s.feverGauge >= 2 / 3 ? 0xff9f1c : 0xffd166, stage);
    }
    // 왕관 따라다니기
    this.children.list.forEach((o) => { const f = o.getData?.('follow') as Phaser.GameObjects.Image | undefined; if (f) { if (!f.active) o.destroy(); else (o as Phaser.GameObjects.Image).setPosition(f.x, f.y - 14); } });
    // 어슬렁거리기(조금씩 다른 타이밍)
    this.wanderT += delta;
    if (this.wanderT > 1200) {
      this.wanderT = 0;
      const idle = this.walkers.filter((w) => !w.busy);
      const w = idle[Math.floor(Math.random() * idle.length)];
      if (w) { const p = this.floorPos(); const nx = Phaser.Math.Clamp(w.img.x + (p.x - w.img.x) * 0.3, 40, W - 16); const ny = Phaser.Math.Clamp(w.img.y + (p.y - w.img.y) * 0.3, FLOOR.top, FLOOR.bottom); this.walkTo(w, nx, ny); }
    }
    // 출퇴근: 분신이 홈 정원보다 많으면 몇 초마다 1명 퇴근 → 다른 직종 분신이 출근
    this.commuteT += delta;
    const total = totalClones(s);
    if (this.commuteT > 3500) {
      this.commuteT = 0;
      if (this.walkers.length < Math.min(this.homeCap, total)) this.arrive(this.randomTier());
      else if (total > this.homeCap) {
        const idle = this.walkers.filter((w) => !w.busy);
        const w = idle[Math.floor(Math.random() * idle.length)];
        if (w) { this.leave(w); this.time.delayedCall(1500, () => this.arrive(this.randomTier())); }
      }
      this.updateCount();
    }
  }
}
export { TIER_COLOR };
