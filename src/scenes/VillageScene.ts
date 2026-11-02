// 언덕 마을: 아래(1칸 알바 골목) → 위(꼭대기). 구역·건물을 데이터 표 순서대로 배치. 세로 스크롤.
import Phaser from 'phaser';
import { G } from '../game';
import { city, cityJobs, isUnlocked, owned, totalClones } from '../core/econ';
import { canMove } from '../core/recommend';
import { formatKR } from '../core/format';
import { setupCam, txt, W, H, R, TIER_COLOR } from '../ui/kit';
import type { GameEvent } from '../core/state';
import type { Job } from '../data/economy';
import { SCENES, pickLine } from '../data/content';
import { eventBubble } from '../ui/m4';

export const ZONE_H = 170;
const DOT_CAP = 300; // 마을 표시 상한

export interface BuildingView { j: Job; x: number; y: number; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; dots: Phaser.GameObjects.Image[]; count: Phaser.GameObjects.Text }

export class VillageScene extends Phaser.Scene {
  worldH = 1000;
  cy = 0;
  buildings: BuildingView[] = [];
  layer!: Phaser.GameObjects.Container;
  truck!: Phaser.GameObjects.Container;
  private dragY: number | null = null;
  private dragMoved = 0;
  private handlers: [string, (e: GameEvent) => void][] = [];
  onBuildingTap?: (j: Job) => void;
  onTruckTap?: () => void;
  onSceneTap?: (id: string) => void;
  onBubbleTap?: () => void;
  private bubble?: Phaser.GameObjects.Container;
  private recentLines: string[] = [];

  constructor() { super('Village'); }

  create() {
    setupCam(this);
    this.build();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragY = p.y; this.dragMoved = 0; });
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.dragY = null;
      if (!this.dragging && !over.length) this.cloneReact(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || !p.isDown) return;
      const dy = (p.y - this.dragY) / R / this.cameras.main.zoom * R;
      this.dragY = p.y; this.dragMoved += Math.abs(dy);
      this.scrollTo(this.cy - dy);
    });
    const on = (k: string, f: (e: GameEvent) => void) => { G.bus.on(k, f); this.handlers.push([k, f]); };
    on('hire', () => this.refresh());
    on('unlock', () => this.build());
    on('move', () => { this.cy = 0; this.build(); });
    on('top_hired', () => this.build());
    on('unique', () => this.build());
    G.bus.on('event_bubble', this.showBubble, this);
    G.bus.on('event_bubble_end', this.hideBubble, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.handlers.forEach(([k, f]) => G.bus.off(k, f)));
  }

  showBubble() {
    this.hideBubble();
    const opts = this.buildings.filter((b) => isUnlocked(G.s, b.j));
    const b = opts[Math.floor(Math.random() * opts.length)];
    if (!b) return;
    this.bubble = eventBubble(this, Phaser.Math.Clamp(b.x + (b.x < W / 2 ? 90 : -90), 40, W - 40), b.y + 10, () => this.onBubbleTap?.());
    this.layer.add(this.bubble);
  }
  hideBubble() { this.bubble?.destroy(); this.bubble = undefined; }

  /** 분신 탭 반응: 가장 가까운 분신이 한마디(같은 대사 재등장 간격) */
  cloneReact(x: number, y: number) {
    let best: Phaser.GameObjects.Image | null = null; let bd = 26 * 26;
    for (const b of this.buildings) for (const d of b.dots) { const dd = (d.x - x) ** 2 + (d.y - y) ** 2; if (dd < bd) { bd = dd; best = d; } }
    if (!best) return;
    const d = best;
    this.tweens.add({ targets: d, y: d.y - 10, duration: 120, yoyo: true });
    const t = txt(this, d.x, d.y - 12, pickLine('clone_tap', this.recentLines), 10, '#222', { backgroundColor: '#ffffff', padding: { x: 4, y: 2 } }).setOrigin(0.5, 1).setDepth(300);
    this.layer.add(t);
    this.time.delayedCall(1500, () => t.destroy());
  }

  get dragging() { return this.dragMoved > 6; }

  zoneY(slot: number) { return this.worldH - 140 - (slot - 1) * ZONE_H; }

  build() {
    this.layer?.destroy();
    this.buildings = [];
    const s = G.s;
    const jobs = cityJobs(s);
    this.worldH = 260 + jobs.length * ZONE_H;
    this.layer = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x87ceeb, 1).fillRect(0, 0, W, this.worldH);
    // 언덕
    g.fillStyle(0x7fb069, 1).fillTriangle(-200, this.worldH, W / 2, 60, W + 200, this.worldH);
    this.layer.add(g);
    jobs.forEach((j, i) => {
      const y = this.zoneY(j.slot);
      const unlocked = isUnlocked(s, j);
      const x = i % 2 === 0 ? 110 : 250;
      const zone = this.add.rectangle(W / 2, y + 30, W, ZONE_H - 10, TIER_COLOR[j.tier], unlocked ? 0.22 : 0.08);
      const rect = this.add.rectangle(x, y, 130, 80, unlocked ? TIER_COLOR[j.tier] : 0x555a70, unlocked ? 1 : 0.5).setStrokeStyle(2, 0x222222);
      // 컷어웨이: 앞면이 반쯤 열린 단면
      const inner = this.add.rectangle(x, y + 8, 110, 50, 0xfff8e7, unlocked ? 0.9 : 0.3);
      const label = txt(this, x, y - 52, unlocked ? j.name : `🔒 ${j.name}`, 12, unlocked ? '#1d1f2b' : '#555', { fontStyle: 'bold', backgroundColor: '#ffffffcc', padding: { x: 4, y: 2 } }).setOrigin(0.5);
      const count = txt(this, x, y + 46, '', 11, '#1d1f2b', { backgroundColor: '#ffffffaa', padding: { x: 3, y: 1 } }).setOrigin(0.5, 0);
      this.layer.add([zone, rect, inner, label, count]);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerup', () => { if (!this.dragging && unlocked) this.onBuildingTap?.(j); });
      this.buildings.push({ j, x, y, rect, label, dots: [], count });
    });
    // 꼭대기: 이삿짐 트럭 + 꼭대기 건물
    const topY = 70;
    const tb = txt(this, W / 2, topY - 40, `★ ${city(s).topBuilding}`, 12, '#1d1f2b', { fontStyle: 'bold', backgroundColor: '#ffffffcc', padding: { x: 4, y: 2 } }).setOrigin(0.5);
    const truckBody = this.add.rectangle(0, 0, 90, 40, 0xe63946).setStrokeStyle(2, 0x222222);
    const cab = this.add.rectangle(56, 6, 26, 28, 0xf1faee).setStrokeStyle(2, 0x222222);
    const w1 = this.add.circle(-26, 22, 8, 0x222222), w2 = this.add.circle(46, 22, 8, 0x222222);
    const tl = txt(this, 0, 0, '이삿짐 트럭', 11, '#fff', { fontStyle: 'bold' }).setOrigin(0.5);
    this.truck = this.add.container(W / 2, topY + 10, [truckBody, cab, w1, w2, tl]).setSize(120, 50);
    this.truck.setInteractive({ useHandCursor: true });
    this.truck.on('pointerup', () => { if (!this.dragging) this.onTruckTap?.(); });
    this.layer.add([tb, this.truck]);
    // 숨은 장면 6개(도시마다 같은 목록, 위치는 도시별 고정 시드)
    const rnd = new Phaser.Math.RandomDataGenerator([`${s.cityIdx}`]);
    const found = s.scenesFound[city(s).id] ?? [];
    SCENES.forEach((sc, i) => {
      const y = 140 + ((i + 0.5) / SCENES.length) * (this.worldH - 260) + rnd.between(-30, 30);
      const x = rnd.pick([28, 330, rnd.between(150, 210)]);
      const got = found.includes(sc.id);
      const spot = txt(this, x, y, got ? `✔ ${sc.name}` : '?', got ? 9 : 14, got ? '#1d1f2b' : '#ffffff', { backgroundColor: got ? '#ffffffaa' : '#00000055', padding: { x: 4, y: 2 } }).setOrigin(0.5).setAlpha(got ? 0.9 : 0.55);
      spot.setInteractive({ useHandCursor: true });
      spot.on('pointerup', () => { if (!this.dragging) this.onSceneTap?.(sc.id); });
      this.layer.add(spot);
    });
    // 개성 분신 표시(건물당 1칸)
    for (const b of this.buildings) {
      const u = s.uniques.find((x) => x.placedJob === b.j.id);
      if (!u) continue;
      const img = this.add.image(b.x - 55, b.y - 20, 'clone_biz').setScale(1.5 / R);
      const lb = txt(this, b.x - 55, b.y - 42, `⭐${u.name}`, 9, '#1d1f2b', { backgroundColor: '#ffd166', padding: { x: 2, y: 1 } }).setOrigin(0.5);
      this.layer.add([img, lb]);
    }
    this.cameras.main.setBounds(0, 0, W, this.worldH);
    this.refresh();
    if (!this.cy) this.scrollTo(this.worldH);
    else this.scrollTo(this.cy);
  }

  refresh() {
    const s = G.s;
    const total = Math.max(1, totalClones(s));
    const show = Math.min(totalClones(s), DOT_CAP);
    for (const b of this.buildings) {
      const n = owned(s, b.j.id);
      b.count.setText(n > 0 ? `${formatKR(n)}명` : '');
      const want = Math.round((n / total) * show);
      while (b.dots.length < want) {
        const d = this.add.image(b.x + Phaser.Math.Between(-75, 75), b.y + Phaser.Math.Between(-10, 60), 'dot')
          .setScale(1 / R).setTint(TIER_COLOR[b.j.tier]).setAlpha(0.9);
        this.layer.add(d); b.dots.push(d);
      }
      while (b.dots.length > want) b.dots.pop()!.destroy();
    }
    this.truck.setAlpha(canMove(s) ? 1 : 0.35);
  }

  scrollTo(cy: number) {
    const cam = this.cameras.main;
    const half = H / 2 / (cam.zoom / R);
    this.cy = Phaser.Math.Clamp(cy, half, this.worldH - half);
    cam.centerOn(W / 2, this.cy);
  }

  /** 마을 공개 줌아웃: 골목에서 시작해 언덕 전체 공개, 분신들이 골목 편의점으로 뛰어감 */
  playReveal(done: () => void) {
    const cam = this.cameras.main;
    const first = this.buildings[0];
    cam.setZoom(R * 3);
    this.cy = first.y; cam.centerOn(W / 2, first.y);
    const runners: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 15; i++) {
      const r = this.add.image(W / 2 + Phaser.Math.Between(-30, 30), this.worldH - 20, 'clone_alba').setScale(1 / R);
      runners.push(r);
      this.tweens.add({ targets: r, x: first.x + Phaser.Math.Between(-60, 60), y: first.y + Phaser.Math.Between(20, 50), duration: 1400, delay: i * 70, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: r, angle: { from: -10, to: 10 }, duration: 120, yoyo: true, repeat: 10 });
    }
    this.tweens.addCounter({ from: R * 3, to: R, duration: 1800, delay: 300, ease: 'Cubic.easeInOut',
      onUpdate: (tw) => { cam.setZoom(tw.getValue() ?? R); this.scrollTo(Phaser.Math.Linear(first.y, this.worldH * 0.62, tw.progress)); },
      onComplete: () => { this.time.delayedCall(900, () => { runners.forEach((r) => r.destroy()); this.refresh(); done(); }); } });
  }

  /** 탭 전환용 짧은 줌 */
  zoomIn() {
    const cam = this.cameras.main;
    cam.setZoom(R * 1.4);
    this.tweens.addCounter({ from: R * 1.4, to: R, duration: 260, onUpdate: (tw) => { cam.setZoom(tw.getValue() ?? R); this.scrollTo(this.cy); } });
  }
}
