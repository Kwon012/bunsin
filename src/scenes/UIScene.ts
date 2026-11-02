// UI 씬(항상 맨 위): 시간 진행 루프, HUD, 고용 시트, 하단 탭, 팝업 대기열, 연출 시퀀스, 디버그
import Phaser from 'phaser';
import { G } from '../game';
import { wallInfo } from '../core/recommend';
import { UNITS } from '../core/format';
import { lineText } from '../data/content';
import { setupCam, txt, button, W, H, R, C, type Btn } from '../ui/kit';
import { PopupQueue } from '../ui/popup';
import { Hud } from '../ui/hud';
import { HireSheet } from '../ui/hireSheet';
import { ClonesPanel, ShopPanel } from '../ui/panels';
import { introFlow, revealFlow, paydayFlow, teamFlow, certFlow, drawFinger, firstJobFlow, type UiCtx } from '../ui/flows';
import { paradeFlow, settlementFlow, stampFlow, closingFlow, settingsCard, photoModeFlow } from '../ui/m6';
import { canStamp, shouldClosing } from '../core/session';
import { totalClones } from '../core/econ';
import { sound } from '../fx/sound';
import { DebugPanel } from '../debug/debug';
import { Tutorial } from '../ui/tutorial';
import { shouldSpawnEvent, pickEvent, markEventShown, missEvent, shouldNews, nextNews } from '../core/director';
import { A } from '../core/assumptions';
import { cityJobs, job } from '../core/econ';
import { eventCardFlow, buildingCard, uniqueCard, sceneCard, clonesExtra } from '../ui/m4';
import { photoCard } from '../ui/flows';
import { managerFlow, topHiredFlow, moveCard, accountCard, breakAndBuy } from '../ui/m5';
import { debugExtra } from '../debug/debug';
import { debugPrepareMove } from '../core/move';
import { D } from '../core/econ';
import type { EventCard } from '../data/content';
import type { GameEvent } from '../core/state';
import type { HomeScene } from './HomeScene';
import type { VillageScene } from './VillageScene';

export type Tab = 'home' | 'village' | 'clones' | 'shop';

export class UIScene extends Phaser.Scene implements UiCtx {
  queue!: PopupQueue;
  hud!: Hud;
  sheet!: HireSheet;
  clonesPanel!: ClonesPanel;
  shopPanel!: ShopPanel;
  debug!: DebugPanel;
  tab: Tab = 'home';
  private tabBtns: Record<string, Btn> = {};
  private finger!: Phaser.GameObjects.Container;
  private toasts: Phaser.GameObjects.Text[] = [];
  private refreshT = 0;
  private hiddenTaps: number[] = [];
  private pendingEvent: { e: EventCard; left: number } | null = null;
  tutorial!: Tutorial;
  private villageBar!: Phaser.GameObjects.Container;
  private newsText!: Phaser.GameObjects.Text;
  private jumpBar!: Phaser.GameObjects.Container;

  constructor() { super('UI'); }
  get sc(): Phaser.Scene { return this; }
  home() { return this.scene.get('Home') as HomeScene; }
  village() { return this.scene.get('Village') as VillageScene; }

  create() {
    setupCam(this);
    this.queue = new PopupQueue(this);
    this.hud = new Hud(this);
    this.sheet = new HireSheet(this);
    this.clonesPanel = new ClonesPanel(this);
    this.shopPanel = new ShopPanel(this);
    // 하단 탭
    this.add.rectangle(W / 2, 620, W, 40, 0x14151f).setDepth(800).setInteractive();
    const tabs: [Tab, string][] = [['home', '🏠 홈'], ['village', '🏘️ 마을'], ['clones', '👥 분신'], ['shop', '🛒 상점']];
    tabs.forEach(([t, label], i) => {
      this.tabBtns[t] = button(this, 45 + i * 90, 620, 86, 34, label, () => this.switchTab(t), 0x2a2d3e, 12);
      this.tabBtns[t].setDepth(801);
    });
    this.finger = drawFinger(this).setVisible(false);
    this.tutorial = new Tutorial(this);
    this.debug = new DebugPanel(this);
    // 숨은 영역 3탭 → 디버그
    const hz = this.add.zone(14, 14, 28, 28).setInteractive().setDepth(2000);
    hz.on('pointerdown', () => {
      const n = performance.now(); this.hiddenTaps = this.hiddenTaps.filter((t) => n - t < 1500); this.hiddenTaps.push(n);
      if (this.hiddenTaps.length >= 3) { this.hiddenTaps = []; this.debug.toggle(); }
    });
    txt(this, W - 4, 598, `build ${__BUILD_ID__}`, 8, '#5c6080').setOrigin(1, 1).setDepth(802);
    this.bindEvents();
    this.buildVillageBar();
    // 탭 동전 → 상단 금액으로 날아감(동시에 최대 12개), 도착하면 금액 '펌프'
    let inFlight = 0; let lastPump = 0;
    G.bus.on('coin', (x: number, y: number) => {
      if (inFlight >= 12) return;
      inFlight++;
      const a = this.hud.moneyAnchor();
      const coin = this.add.image(x, y, 'coin').setScale(1.2 / R).setDepth(620);
      const midX = (x + a.x) / 2 + Phaser.Math.Between(-40, 40), midY = Math.min(y, a.y) - 30;
      this.tweens.addCounter({ from: 0, to: 1, duration: 420, ease: 'Cubic.easeIn', onUpdate: (tw) => {
        const t = tw.getValue() ?? 0; const u = 1 - t;
        coin.setPosition(u * u * x + 2 * u * t * midX + t * t * a.x, u * u * y + 2 * u * t * midY + t * t * a.y);
      }, onComplete: () => {
        coin.destroy(); inFlight--;
        const n = performance.now(); if (n - lastPump > 90) { lastPump = n; this.hud.pump(1.06); }
      } });
    });
    this.clonesPanel.extraSections.push(clonesExtra(this));
    const openEvent = () => {
      const pe = this.pendingEvent; if (!pe) return;
      this.pendingEvent = null; G.bus.emit('event_bubble_end');
      this.queue.push((d) => eventCardFlow(this, pe.e, d), 'event');
    };
    this.home().onBubbleTap = openEvent;
    this.village().onBubbleTap = openEvent;
    this.village().onBuildingTap = (j) => this.queue.push((d) => buildingCard(this, j.id, d), 'bcard');
    this.village().onTruckTap = () => this.queue.push((d) => moveCard(this, d), 'move');
    this.hud.piggy.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.queue.push((d) => accountCard(this, d), 'account'));
    debugExtra.push({ label: '도시+1 준비', fn: () => {
      const n = Math.min(D.cities.length, G.s.cityIdx + 2);
      debugPrepareMove(G.s, n);
      G.dispatch([{ t: 'move', fromCity: G.s.cityIdx, toCity: G.s.cityIdx, fameGain: 0, settle: 0 }]);
      this.toast(`${D.cities[G.s.cityIdx].name}: 꼭대기 첫 고용 상태 → 트럭으로 ${D.cities[G.s.cityIdx + 1]?.name ?? '-'} 이사 가능`);
    } });
    this.village().onSceneTap = (id) => this.queue.push((d) => sceneCard(this, id, d), 'scene');
    // 사운드 끄기
    const snd = button(this, W - 22, 88, 34, 22, G.s.settings.sound ? '🔊' : '🔇', () => {
      G.s.settings.sound = !G.s.settings.sound; sound.enabled = G.s.settings.sound; snd.setLabel(G.s.settings.sound ? '🔊' : '🔇');
    }, 0x2a2d3e, 11).setDepth(610);
    this.sessionStart();
    if (G.s.pendingOffline) this.queueSettlement();
    else if (!G.isNew) this.time.delayedCall(3000, () => this.maybeStamp());
    // 설정
    button(this, W - 60, 88, 34, 22, '⚙️', () => this.queue.push((d) => settingsCard(this, d), 'settings'), 0x2a2d3e, 11).setDepth(610);
    // 시작 화면
    if (G.isNew && !G.s.flags.introDone) this.queue.push((d) => introFlow(this, d), 'intro');
    const last = G.s.flags.lastTab === 1 && G.s.flags.villageRevealed ? 'village' : 'home';
    this.switchTab(last, true);
  }

  private bindEvents() {
    const on = (k: string, f: (e: GameEvent) => void) => G.bus.on(k, f);
    on('reveal', () => this.queue.push((d) => revealFlow(this, d), 'reveal'));
    on('payday', (e) => e.t === 'payday' && this.queue.push((d) => paydayFlow(this, e.slip, d), 'payday'));
    on('team', (e) => e.t === 'team' && this.queue.push((d) => teamFlow(this, e.jobId, e.count, d), 'team'));
    on('cert', (e) => e.t === 'cert' && this.queue.push((d) => certFlow(this, e.jobId, e.level, d), 'cert'));
    on('unlock', (e) => { if (e.t === 'unlock') this.toast(`🔓 ${job(e.jobId).name} 해금! 고용 시트에서 고용하세요`, C.gold); });
    on('first_job', (e) => e.t === 'first_job' && this.queue.push((d) => firstJobFlow(this, e.jobId, d), 'firstjob'));
    on('unit', (e) => { if (e.t !== 'unit') return; const u = UNITS[e.index]; if (u) this.toast(`새 단위! ${lineText('unit', u.name) ?? u.name}`, C.gold); });
    on('fever_end', (e) => e.t === 'fever_end' && this.toast(`피버 끝! 이번 콤보 ${e.combo} · 오늘 최고 콤보 ${Math.max(G.s.bestCombo, e.combo)}`));
    G.bus.on('resumed', () => { this.sessionStart(); if (G.s.pendingOffline && !this.queue.has('settle')) this.queueSettlement(); else this.maybeStamp(); });
    on('manager', () => this.queue.push((d) => managerFlow(this, d), 'manager'));
    on('top_hired', (e) => e.t === 'top_hired' && this.queue.push((d) => topHiredFlow(this, e.jobId, d), 'top'));
    on('unique', (e) => e.t === 'unique' && this.queue.push((d) => uniqueCard(this, e.id, d), 'unique'));
    on('crown', (e) => e.t === 'crown' && this.toast(`👑 ${e.total}번째 분신! 왕관 쓴 기념 분신`, C.gold));
  }

  private sessEarned = 0; private sessHired = 0;
  sessionStart() { this.sessEarned = G.s.totalEarned; this.sessHired = G.s.totalHired; }
  /** 귀가 행렬 → 정산서 → (하루 첫) 출근 도장 */
  queueSettlement() {
    this.queue.push((d) => paradeFlow(this, d), 'parade');
    this.queue.push((d) => settlementFlow(this, d), 'settle');
    this.queue.push((d) => { this.maybeStamp(); d(); }, 'stampcheck');
  }
  maybeStamp() { if (canStamp(G.s) && !this.queue.has('stamp') && G.s.flags.introDone) this.queue.push((d) => stampFlow(this, d), 'stamp'); }

  /** 짧은 알림(겹치면 아래로 쌓임, 대기열 밖) */
  toast(text: string, color = '#ffffff') {
    const t = txt(this, W / 2, 0, text, 12, color, { backgroundColor: '#000000cc', padding: { x: 8, y: 5 }, align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5, 0).setDepth(990);
    this.toasts.push(t);
    this.layoutToasts();
    this.time.delayedCall(2600, () => this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => { t.destroy(); this.toasts = this.toasts.filter((x) => x !== t); this.layoutToasts(); } }));
  }
  private layoutToasts() { this.toasts.forEach((t, i) => t.setY(76 + i * 28)); }

  switchTab(t: Tab, instant = false) {
    if (t === 'village' && !G.s.flags.villageRevealed) { this.toast('분신 15명이 모이면 마을이 공개돼요'); return; }
    this.tab = t;
    this.clonesPanel.hide(); this.shopPanel.hide();
    if (t === 'home') {
      if (this.scene.isSleeping('Home')) this.scene.wake('Home');
      if (!this.scene.isSleeping('Village')) this.scene.sleep('Village');
      G.s.flags.lastTab = 0;
    } else if (t === 'village') {
      if (this.scene.isSleeping('Village')) this.scene.wake('Village');
      if (!this.scene.isSleeping('Home')) this.scene.sleep('Home');
      if (!instant) this.village().zoomIn();
      this.village().refresh();
      G.s.flags.lastTab = 1;
    } else if (t === 'clones') this.clonesPanel.show();
    else if (t === 'shop') this.shopPanel.show();
    for (const [k, b] of Object.entries(this.tabBtns)) b.bg.setFillStyle(k === t ? 0x3a86ff : 0x2a2d3e);
    this.tabBtns.village.setAlpha(G.s.flags.villageRevealed ? 1 : 0.4);
    this.hud.gaugeBox.setVisible(t === 'home');
    this.villageBar.setVisible(t === 'village');
    this.sheet.root.setVisible(t === 'home' || t === 'village');
  }

  update(_time: number, delta: number) {
    G.update(delta);
    this.hud.update();
    this.refreshT += delta;
    if (this.refreshT > 200) {
      this.refreshT = 0;
      const w = wallInfo(G.s);
      this.sheet.extra = w.breakSuggest ? { label: '🐷 통장 깨서 지금 사기', cb: () => breakAndBuy(this) }
        : w.moveSuggest ? { label: '🚚 이사 추천! (선택)', cb: () => this.queue.push((d) => moveCard(this, d), 'move') } : null;
      this.sheet.refresh();
      this.tabBtns.village.setAlpha(G.s.flags.villageRevealed ? 1 : 0.4);
      if (this.clonesPanel.visible) this.clonesPanel.render();
      this.debug.refresh();
      this.directorTick(0.2 * (delta > 0 ? 1 : 1) * G.speed);
    }
    this.updateFinger();
  }

  /** 사건 말풍선 등장/놓침, 마을 뉴스 */
  private directorTick(dt: number) {
    const s = G.s;
    if (this.pendingEvent) {
      this.pendingEvent.left -= dt;
      if (this.pendingEvent.left <= 0) { missEvent(s); this.pendingEvent = null; G.bus.emit('event_bubble_end'); }
    } else if (s.flags.introDone && !this.tutorial.active && !this.queue.busy && shouldSpawnEvent(s, false)) {
      const e = pickEvent(s);
      if (e) { markEventShown(s, e.id); this.pendingEvent = { e, left: A.X_eventBubbleLifeSec }; G.bus.emit('event_bubble', e); }
    }
    if (!this.queue.busy && !this.tutorial.active && !this.pendingEvent && s.flags.villageRevealed && shouldClosing(s)) {
      this.queue.push((d) => closingFlow(this, s.totalEarned - this.sessEarned, s.totalHired - this.sessHired, d), 'closing');
    }
    // 첫날 출근 도장: 첫 5분 경험 뒤
    if (G.isNew && s.sessionTime > 300 && canStamp(s) && !this.queue.busy) this.maybeStamp();
    if (shouldNews(s)) {
      const t = nextNews(s);
      this.newsText.setText(`📰 ${t}`);
      if (this.tab === 'village') this.tweens.add({ targets: this.newsText, alpha: { from: 0, to: 1 }, duration: 400 });
    }
  }

  /** 마을 상단: 뉴스 한 줄 + 사진 모드, 오른쪽 구역 점프 바 */
  private buildVillageBar() {
    this.villageBar = this.add.container(0, 0).setDepth(590).setVisible(false);
    const bg = this.add.rectangle(W / 2, 84, W, 22, 0x000000, 0.55);
    this.newsText = txt(this, 8, 84, `📰 ${G.s.director.news[G.s.director.news.length - 1] ?? '마을 뉴스가 곧 도착합니다'}`, 10, '#fff').setOrigin(0, 0.5);
    this.newsText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.queue.push((d) => photoCard(this, this.newsText.text, 'news', d), 'newsshare');
    });
    const cam = button(this, W - 60, 108, 44, 22, '📷', () => this.queue.push((d) => photoModeFlow(this, d), 'photo'), 0x2a2d3e, 12);
    this.jumpBar = this.add.container(0, 0);
    this.villageBar.add([bg, this.newsText, cam, this.jumpBar]);
    this.rebuildJumpBar();
    G.bus.on('move', () => this.rebuildJumpBar());
  }
  private rebuildJumpBar() {
    this.jumpBar.removeAll(true);
    const jobs = cityJobs(G.s);
    jobs.slice().reverse().forEach((j, i) => {
      const b = button(this, W - 16, 140 + i * 34, 26, 28, String(j.slot), () => this.village().scrollTo(this.village().zoneY(j.slot)), 0x2a2d3e, 10);
      this.jumpBar.add(b);
    });
    const top = button(this, W - 16, 140 + jobs.length * 34, 26, 28, '🚚', () => this.village().scrollTo(0), 0x2a2d3e, 10);
    this.jumpBar.add(top);
  }

  /** 손가락 가이드 1개: 첫 분신 전 본체 → 처음 몇 번은 추천 고용 버튼 */
  private updateFinger() {
    let pos = this.tutorial.update();
    if (this.queue.busy || this.tab !== 'home' && this.tab !== 'village') pos = null;
    this.finger.setVisible(!!pos);
    if (pos) this.finger.setPosition(pos.x, pos.y);
  }
}
