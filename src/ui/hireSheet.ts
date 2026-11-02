// 고용 시트(접힘 1줄 / 펼침: 고용·자산·집 탭). 손잡이를 끌어 올려 열 수 있고 최대 높이가 정해져 있다.
// 경제 계산은 core 셀렉터만 호출한다.
import Phaser from 'phaser';
import { G } from '../game';
import { cityJobs, hireCostN, isUnlocked, jobIncomeBase, nextCert, nextTeam, owned, unlockNeed, feverMult, job, jobCap, assetOf, ownsAsset, D } from '../core/econ';
import { hireQuote, type HireAmount } from '../core/actions';
import { wallInfo, etaFor, type Purchase } from '../core/recommend';
import { executePurchase } from '../core/purchase';
import { currentHouse, houseFurniture, furnLevel, furnCost, nextHouse, furnitureDone, canBuyAsset } from '../core/home';
import { formatKR, formatSec } from '../core/format';
import { button, txt, W, C, TIER_COLOR, type Btn } from './kit';

const COLLAPSED_Y = 536, BOTTOM = 598, ROW_H = 44, MAX_TOP = 150;
type Tab = 'hire' | 'asset' | 'home';

export function purchaseLabel(p: Purchase): string {
  if (p.kind === 'hire') return `${job(p.jobId).name} 고용`;
  if (p.kind === 'cert') return `${job(p.jobId).name} ${nextCert(G.s, job(p.jobId))?.label ?? '자격증'}`;
  if (p.kind === 'asset') return `${assetOf(p.jobId)?.name ?? ''} 매입`;
  if (p.kind === 'furniture') return `가구: ${D.furniture.find((f) => f.id === p.jobId)?.name ?? ''} 레벨업`;
  return `새 집: ${D.houses.find((h) => h.id === p.jobId)?.name ?? ''}`;
}

export class HireSheet {
  root: Phaser.GameObjects.Container;
  expanded = false;
  amount: HireAmount = 1;
  tab: Tab = 'hire';
  private bg: Phaser.GameObjects.Rectangle;
  private handle: Phaser.GameObjects.Rectangle;
  private handleZone: Phaser.GameObjects.Zone;
  private collapsedBox: Phaser.GameObjects.Container;
  private listBox: Phaser.GameObjects.Container;
  private recName: Phaser.GameObjects.Text;
  private recSub: Phaser.GameObjects.Text;
  private recBtn: Btn;
  private amtBtn: Btn;
  private toggleBtn: Btn;
  private extraBtn: Btn;
  private tabBtns: Record<Tab, Btn>;
  private rowsKey = '';
  private rows: { refresh: () => void; c: Phaser.GameObjects.Container }[] = [];
  private dragStartY: number | null = null;
  private dragTop = 0;
  extra: { label: string; cb: () => void } | null = null;

  constructor(private scene: Phaser.Scene) {
    const s = scene;
    this.root = s.add.container(0, 0).setDepth(500);
    this.bg = s.add.rectangle(W / 2, COLLAPSED_Y, W, BOTTOM - COLLAPSED_Y, C.panel, 0.97).setOrigin(0.5, 0);
    this.handle = s.add.rectangle(W / 2, COLLAPSED_Y + 5, 44, 4, 0x8a8fb0).setOrigin(0.5);
    this.handleZone = s.add.zone(W / 2, COLLAPSED_Y + 6, W, 20).setInteractive({ useHandCursor: true });
    this.root.add([this.bg, this.handle, this.handleZone]);
    this.collapsedBox = s.add.container(0, 0);
    this.listBox = s.add.container(0, 0).setVisible(false);
    this.root.add([this.collapsedBox, this.listBox]);
    this.recName = txt(s, 12, COLLAPSED_Y + 12, '', 13, C.text, { fontStyle: 'bold' });
    this.recSub = txt(s, 12, COLLAPSED_Y + 33, '', 11, C.dim);
    this.recBtn = button(s, 236, COLLAPSED_Y + 33, 100, 40, '', () => this.buyRecommended(), 0x06a77d, 12);
    this.collapsedBox.add([this.recName, this.recSub, this.recBtn]);
    this.extraBtn = button(s, W / 2 + 80, COLLAPSED_Y - 20, 170, 28, '', () => this.extra?.cb(), 0xef476f, 12).setVisible(false);
    this.amtBtn = button(s, 318, COLLAPSED_Y + 18, 44, 20, '×1', () => this.cycleAmount(), 0x4a4f6a, 11);
    this.toggleBtn = button(s, 318, COLLAPSED_Y + 42, 52, 24, '▲ 전체', () => this.setExpanded(!this.expanded), 0x4a4f6a, 11);
    this.root.add([this.extraBtn, this.amtBtn, this.toggleBtn]);
    this.tabBtns = {
      hire: button(s, 44, 0, 80, 26, '👥 고용', () => this.setTab('hire'), 0x2a2d3e, 12),
      asset: button(s, 128, 0, 80, 26, '🏢 자산', () => this.setTab('asset'), 0x2a2d3e, 12),
      home: button(s, 212, 0, 80, 26, '🛋️ 집', () => this.setTab('home'), 0x2a2d3e, 12),
    };
    this.listBox.add(Object.values(this.tabBtns));
    // 손잡이 드래그: 위로 끌면 열림, 아래로 끌면 닫힘(최대 높이 MAX_TOP)
    this.handleZone.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragStartY = p.worldY; this.dragTop = this.top(); });
    s.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragStartY === null || !p.isDown) return;
      const t = Phaser.Math.Clamp(this.dragTop + (p.worldY - this.dragStartY), MAX_TOP, COLLAPSED_Y);
      this.bg.setY(t).setSize(W, BOTTOM - t); this.handle.setY(t + 5);
    });
    s.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragStartY === null) return;
      const dy = p.worldY - this.dragStartY;
      this.dragStartY = null;
      if (Math.abs(dy) < 6) this.setExpanded(!this.expanded);
      else this.setExpanded(dy < 0 ? true : this.dragTop + dy < (COLLAPSED_Y + MAX_TOP) / 2);
    });
    this.layout();
  }

  cycleAmount() {
    this.amount = this.amount === 1 ? 10 : this.amount === 10 ? 'max' : 1;
    this.amtBtn.setLabel(this.amount === 'max' ? '최대' : `×${this.amount}`);
    this.refresh();
  }
  setTab(t: Tab) { this.tab = t; this.rowsKey = ''; this.layout(); }
  setExpanded(on: boolean) { this.expanded = on; this.rowsKey = ''; this.layout(); G.bus.emit('sheet', on); }

  private rowCount(): number {
    if (this.tab === 'hire') return cityJobs(G.s).filter((j) => isUnlocked(G.s, j)).length + 1;
    if (this.tab === 'asset') return cityJobs(G.s).length;
    return houseFurniture(currentHouse(G.s).id).length + 2;
  }
  top(): number {
    if (!this.expanded) return COLLAPSED_Y;
    return Math.max(MAX_TOP, BOTTOM - 50 - this.rowCount() * ROW_H);
  }

  private layout() {
    const top = this.top();
    this.bg.setPosition(W / 2, top).setSize(W, BOTTOM - top);
    this.bg.removeInteractive().setInteractive(new Phaser.Geom.Rectangle(0, 0, W, BOTTOM - top), Phaser.Geom.Rectangle.Contains);
    this.handle.setY(top + 5); this.handleZone.setY(top + 6);
    this.collapsedBox.setVisible(!this.expanded);
    this.listBox.setVisible(this.expanded);
    // 펼침: 수량·접기 버튼은 탭 줄 오른쪽(목록과 겹치지 않게)
    this.toggleBtn.setLabel(this.expanded ? '▼ 접기' : '▲ 전체').setPosition(318, this.expanded ? top + 26 : COLLAPSED_Y + 42);
    this.amtBtn.setPosition(this.expanded ? 272 : 318, this.expanded ? top + 26 : COLLAPSED_Y + 18).setVisible(!this.expanded || this.tab === 'hire');
    for (const [k, b] of Object.entries(this.tabBtns)) { b.setY(top + 26); b.bg.setFillStyle(k === this.tab ? 0x3a86ff : 0x2a2d3e); }
    this.extraBtn.setPosition(W / 2 + 80, top - 18);
    if (this.expanded) this.rebuildRows();
    this.refresh();
  }

  private rebuildRows() {
    const key = `${this.tab}:${G.s.cityIdx}:${this.rowCount()}:${currentHouse(G.s).id}`;
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    for (const r of this.rows) r.c.destroy();
    this.rows = [];
    const y0 = this.top() + 46;
    const add = (i: number, build: (c: Phaser.GameObjects.Container) => () => void) => {
      const c = this.scene.add.container(0, y0 + i * ROW_H);
      c.add(this.scene.add.rectangle(W / 2, ROW_H / 2, W - 8, ROW_H - 4, C.panel2).setStrokeStyle(1, C.line));
      const refresh = build(c);
      this.listBox.add(c);
      this.rows.push({ c, refresh });
    };
    const s = this.scene;
    if (this.tab === 'hire') {
      const jobs = cityJobs(G.s).filter((j) => isUnlocked(G.s, j));
      jobs.forEach((j, i) => add(i, (c) => {
        c.add(s.add.rectangle(10, ROW_H / 2, 6, ROW_H - 12, TIER_COLOR[j.tier]));
        const name = txt(s, 20, 5, '', 12, C.text, { fontStyle: 'bold' });
        const sub = txt(s, 20, 24, '', 10, C.dim);
        const hireB = button(s, 300, ROW_H / 2, 96, ROW_H - 10, '', () => this.doPurchase({ kind: 'hire', jobId: j.id, cost: 0, gain: 0, ratio: 0 }), 0x06a77d, 11);
        const certB = button(s, 206, ROW_H / 2, 76, ROW_H - 10, '', () => this.doPurchase({ kind: 'cert', jobId: j.id, cost: 0, gain: 0, ratio: 0 }), 0x8338ec, 10);
        c.add([name, sub, certB, hireB]);
        return () => {
          const k = owned(G.s, j.id); const cap = jobCap(j); const full = k >= cap;
          const q = hireQuote(G.s, j.id, this.amount);
          const n = this.amount === 'max' ? q.n : Math.min(this.amount as number, cap - k);
          const cost = this.amount === 'max' ? (q.n > 0 ? q.cost : hireCostN(j, k, 1)) : q.cost;
          const t = nextTeam(j, k);
          name.setText(`${j.name} ${k}/${Number.isFinite(cap) ? cap : '∞'}명`);
          sub.setText(`초당 ${formatKR(jobIncomeBase(G.s, j) * feverMult(G.s))}${t ? ` · 팀 보너스까지 ${t - k}명` : full ? ' · 정원 가득 ✔' : ''}`);
          if (full) hireB.setLabel('정원 가득').setEnabled(false);
          else hireB.setLabel(`고용 ×${Math.max(1, n)}\n${formatKR(cost)}`).setEnabled(cost <= G.s.money && n > 0);
          const ce = nextCert(G.s, j);
          if (ce && ce.open) certB.setVisible(true).setLabel(`${ce.label}\n${formatKR(ce.price)}`).setEnabled(ce.price <= G.s.money);
          else certB.setVisible(false);
        };
      }));
      add(jobs.length, (c) => {
        const t = txt(s, 12, 14, '', 11, C.dim);
        c.add(t);
        return () => {
          const lock = cityJobs(G.s).find((j) => !isUnlocked(G.s, j));
          if (!lock) { t.setText('이 도시의 모든 직종이 열렸어요'); return; }
          const prev = cityJobs(G.s)[lock.slot - 2];
          t.setText(`🔒 ${lock.name} — ${prev.name} ${unlockNeed(lock)}명에서 해금 (${Math.max(0, unlockNeed(lock) - owned(G.s, prev.id))}명 남음)`);
        };
      });
    } else if (this.tab === 'asset') {
      cityJobs(G.s).forEach((j, i) => add(i, (c) => {
        const a = assetOf(j.id)!;
        const name = txt(s, 14, 5, `${a.name}`, 12, C.text, { fontStyle: 'bold' });
        const sub = txt(s, 14, 24, `${j.name} 수입 ×${a.incomeMult} · 판매 없음`, 10, C.dim);
        const b = button(s, 300, ROW_H / 2, 96, ROW_H - 10, '', () => this.doPurchase({ kind: 'asset', jobId: j.id, cost: 0, gain: 0, ratio: 0 }), 0xd4a017, 11);
        c.add([name, sub, b]);
        return () => {
          if (ownsAsset(G.s, a.id)) b.setLabel('보유 ✔').setEnabled(false);
          else if (!canBuyAsset(G.s, j.id)) b.setLabel('🔒 직종 해금').setEnabled(false);
          else b.setLabel(`매입\n${formatKR(a.price)}`).setEnabled(a.price <= G.s.money);
        };
      }));
    } else {
      const h = currentHouse(G.s);
      add(0, (c) => {
        c.add(txt(s, 14, 5, `🏠 ${h.name}`, 13, C.gold, { fontStyle: 'bold' }));
        c.add(txt(s, 14, 25, '가구를 모두 최고 레벨로 키우면 다음 집을 살 수 있어요 · 가구 1레벨 = 명성 +1', 9, C.dim));
        return () => {};
      });
      houseFurniture(h.id).forEach((f, i) => add(i + 1, (c) => {
        const name = txt(s, 14, 5, '', 12, C.text, { fontStyle: 'bold' });
        const bar = s.add.graphics();
        const b = button(s, 300, ROW_H / 2, 96, ROW_H - 10, '', () => this.doPurchase({ kind: 'furniture', jobId: f.id, cost: 0, gain: 0, ratio: 0 }), 0x3a86ff, 11);
        c.add([name, bar, b]);
        return () => {
          const lv = furnLevel(G.s, f.id);
          name.setText(`${f.name}  Lv ${lv}/${f.maxLevel}`);
          bar.clear();
          for (let k = 0; k < f.maxLevel; k++) bar.fillStyle(k < lv ? 0xffd166 : 0x4a4f6a, 1).fillRect(14 + k * 26, 27, 22, 6);
          if (lv >= f.maxLevel) b.setLabel('최고 레벨 ✔').setEnabled(false);
          else { const cost = furnCost(f, lv); b.setLabel(`레벨업 ★+${f.famePerLevel}\n${formatKR(cost)}`).setEnabled(cost <= G.s.money); }
        };
      }));
      add(houseFurniture(h.id).length + 1, (c) => {
        const t = txt(s, 14, 5, '', 12, C.text, { fontStyle: 'bold' });
        const sub = txt(s, 14, 24, '', 10, C.dim);
        const b = button(s, 300, ROW_H / 2, 96, ROW_H - 10, '', () => this.doPurchase({ kind: 'house', jobId: nextHouse(G.s)?.id ?? '', cost: 0, gain: 0, ratio: 0 }), 0xd62828, 11);
        c.add([t, sub, b]);
        return () => {
          const nh = nextHouse(G.s);
          if (!nh) { t.setText('이 도시 최고의 집에 살고 있어요'); sub.setText('다음 도시로 이사하면 새 집을 꾸밀 수 있어요'); b.setVisible(false); return; }
          t.setText(`다음 집: ${nh.name}`); sub.setText(`명성 +${nh.fame} · ${furnitureDone(G.s) ? '구매 가능' : '가구를 모두 키우면 열림'}`);
          b.setVisible(true).setLabel(`구매\n${formatKR(nh.price)}`).setEnabled(furnitureDone(G.s) && nh.price <= G.s.money);
        };
      });
    }
  }

  private doPurchase(p: Purchase) {
    G.act((o) => executePurchase(G.s, p, o, this.amount));
    this.refresh();
  }

  buyRecommended() {
    const r = wallInfo(G.s).rec;
    if (!r) return;
    G.act((o) => executePurchase(G.s, r, o, r.kind === 'hire' ? this.amount : 1));
    this.refresh();
  }

  /** 추천 버튼 화면 좌표(손가락 가이드용) */
  recButtonPos() { return this.expanded ? null : { x: this.recBtn.x, y: this.recBtn.y }; }
  tabButtonPos(t: Tab) { return this.expanded ? { x: this.tabBtns[t].x, y: this.tabBtns[t].y } : { x: this.toggleBtn.x, y: this.toggleBtn.y }; }

  refresh() {
    const s = G.s;
    if (this.extra) this.extraBtn.setVisible(true).setLabel(this.extra.label); else this.extraBtn.setVisible(false);
    if (this.expanded) {
      this.rebuildRows();
      for (const r of this.rows) r.refresh();
      return;
    }
    const r = wallInfo(s).rec;
    if (!r) { this.recName.setText('살 수 있는 것이 없어요'); this.recSub.setText(''); this.recBtn.setEnabled(false); return; }
    let cost = r.cost, label: string;
    if (r.kind === 'hire') {
      const q = hireQuote(s, r.jobId, this.amount);
      const n = this.amount === 'max' ? Math.max(1, q.n) : q.n;
      cost = this.amount === 'max' && q.n === 0 ? r.cost : q.cost;
      label = `고용 ×${n}\n${formatKR(cost)}`;
      this.recName.setText(`추천: ${job(r.jobId).name} (${owned(s, r.jobId)}/${jobCap(job(r.jobId))})`);
    } else {
      label = `${r.kind === 'furniture' ? '레벨업' : r.kind === 'house' ? '구매' : r.kind === 'asset' ? '매입' : '취득'}\n${formatKR(cost)}`;
      this.recName.setText(`추천: ${purchaseLabel(r)}`);
    }
    const eta = etaFor(s, cost);
    this.recSub.setText(eta > 0 ? `${formatSec(eta)} 뒤 가능` : '지금 살 수 있어요!');
    this.recBtn.setLabel(label).setEnabled(cost <= s.money);
  }
}
