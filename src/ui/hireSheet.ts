// 고용 시트(접힘 1줄 / 펼침 전체). 모든 구매가 여기서 일어난다. 경제 계산은 core 셀렉터만 호출.
import Phaser from 'phaser';
import { G } from '../game';
import { cityJobs, hireCostN, isUnlocked, jobIncomeBase, nextCert, nextTeam, owned, unlockNeed, feverMult, job } from '../core/econ';
import { hire, buyCert, hireQuote, type HireAmount } from '../core/actions';
import { wallInfo, etaFor } from '../core/recommend';
import { formatKR, formatSec } from '../core/format';
import { button, txt, W, C, TIER_COLOR, type Btn } from './kit';
import type { Job } from '../data/economy';

const COLLAPSED_Y = 536, BOTTOM = 598, ROW_H = 46;

interface Row { j: Job; c: Phaser.GameObjects.Container; name: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; hireB: Btn; certB: Btn; frame: Phaser.GameObjects.Rectangle; tag: Phaser.GameObjects.Text }

export class HireSheet {
  root: Phaser.GameObjects.Container;
  expanded = false;
  amount: HireAmount = 1;
  private bg!: Phaser.GameObjects.Rectangle;
  private rows: Row[] = [];
  private lockText!: Phaser.GameObjects.Text;
  private recName!: Phaser.GameObjects.Text;
  private recSub!: Phaser.GameObjects.Text;
  private recBtn!: Btn;
  private amtBtn!: Btn;
  private toggleBtn!: Btn;
  private extraBtn!: Btn;
  private collapsedBox!: Phaser.GameObjects.Container;
  private listBox!: Phaser.GameObjects.Container;
  private builtFor = '';
  /** 추가 버튼(통장 깨기·이사)을 UIScene이 설정 */
  extra: { label: string; cb: () => void } | null = null;
  onHireButton?: () => { x: number; y: number };

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(500);
    this.bg = scene.add.rectangle(W / 2, COLLAPSED_Y, W, BOTTOM - COLLAPSED_Y, C.panel, 0.97).setOrigin(0.5, 0).setInteractive();
    this.root.add(this.bg);
    this.collapsedBox = scene.add.container(0, 0);
    this.listBox = scene.add.container(0, 0);
    this.root.add([this.collapsedBox, this.listBox]);
    // 접힘 줄: 추천 구매
    this.recName = txt(scene, 12, COLLAPSED_Y + 8, '', 13, C.text, { fontStyle: 'bold' });
    this.recSub = txt(scene, 12, COLLAPSED_Y + 30, '', 11, C.dim);
    this.recBtn = button(scene, 236, COLLAPSED_Y + 31, 100, 42, '', () => this.buyRecommended(), 0x06a77d, 12);
    this.collapsedBox.add([this.recName, this.recSub, this.recBtn]);
    this.extraBtn = button(scene, 244, COLLAPSED_Y - 22, 160, 30, '', () => this.extra?.cb(), 0xef476f, 12);
    this.extraBtn.setVisible(false);
    this.root.add(this.extraBtn);
    this.amtBtn = button(scene, 318, COLLAPSED_Y + 12, 52, 20, '×1', () => this.cycleAmount(), 0x4a4f6a, 11);
    this.toggleBtn = button(scene, 318, COLLAPSED_Y + 38, 52, 26, '▲ 전체', () => this.setExpanded(!this.expanded), 0x4a4f6a, 11);
    this.root.add([this.amtBtn, this.toggleBtn]);
    this.lockText = txt(scene, 12, 0, '', 11, C.dim);
    this.listBox.add(this.lockText);
    this.listBox.setVisible(false);
  }

  cycleAmount() {
    this.amount = this.amount === 1 ? 10 : this.amount === 10 ? 'max' : 1;
    this.amtBtn.setLabel(this.amount === 'max' ? '최대' : `×${this.amount}`);
    this.refresh();
  }

  setExpanded(on: boolean) {
    this.expanded = on;
    this.layout();
  }

  private top(): number {
    if (!this.expanded) return COLLAPSED_Y;
    const n = this.visibleJobs().length + 1;
    return Math.max(120, BOTTOM - 36 - n * ROW_H);
  }
  private visibleJobs(): Job[] { return cityJobs(G.s).filter((j) => isUnlocked(G.s, j)); }

  private layout() {
    const top = this.top();
    this.bg.setPosition(W / 2, top).setSize(W, BOTTOM - top);
    this.bg.removeInteractive().setInteractive(new Phaser.Geom.Rectangle(0, 0, W, BOTTOM - top), Phaser.Geom.Rectangle.Contains);
    this.collapsedBox.setVisible(!this.expanded);
    this.listBox.setVisible(this.expanded);
    this.toggleBtn.setLabel(this.expanded ? '▼ 접기' : '▲ 전체');
    const yBtn = this.expanded ? top + 14 : COLLAPSED_Y + 38;
    this.toggleBtn.setPosition(318, yBtn);
    this.amtBtn.setPosition(this.expanded ? 252 : 318, this.expanded ? top + 14 : COLLAPSED_Y + 12);
    this.extraBtn.setPosition(W / 2 + 80, top - 20);
    if (this.expanded) this.rebuildRows();
    this.refresh();
  }

  private rebuildRows() {
    const key = `${G.s.cityIdx}:${this.visibleJobs().map((j) => j.id).join(',')}`;
    const top = this.top();
    if (key !== this.builtFor) {
      for (const r of this.rows) r.c.destroy();
      this.rows = [];
      this.builtFor = key;
      for (const j of this.visibleJobs()) this.rows.push(this.makeRow(j));
    }
    this.rows.forEach((r, i) => r.c.setPosition(0, top + 30 + i * ROW_H));
    this.lockText.setPosition(12, top + 30 + this.rows.length * ROW_H + 10);
  }

  private makeRow(j: Job): Row {
    const s = this.scene;
    const c = s.add.container(0, 0);
    const frame = s.add.rectangle(W / 2, ROW_H / 2, W - 8, ROW_H - 4, C.panel2).setStrokeStyle(1, C.line);
    const chip = s.add.rectangle(10, ROW_H / 2, 6, ROW_H - 12, TIER_COLOR[j.tier]);
    const name = txt(s, 20, 6, j.name, 12, C.text, { fontStyle: 'bold' });
    const sub = txt(s, 20, 25, '', 10, C.dim);
    const tag = txt(s, 160, 7, '추천', 10, '#1d1f2b', { backgroundColor: '#ffd166', padding: { x: 3, y: 1 } }).setVisible(false);
    const hireB = button(s, 300, ROW_H / 2, 96, ROW_H - 10, '', () => this.doHire(j.id), 0x06a77d, 11);
    const certB = button(s, 208, ROW_H / 2, 70, ROW_H - 10, '', () => G.act((o) => buyCert(G.s, j.id, o)), 0x8338ec, 10);
    c.add([frame, chip, name, sub, tag, certB, hireB]);
    this.listBox.add(c);
    return { j, c, name, sub, hireB, certB, frame, tag };
  }

  private doHire(id: string) {
    G.act((o) => hire(G.s, id, this.amount, o));
    this.refresh();
  }

  buyRecommended() {
    const w = wallInfo(G.s);
    const r = w.rec;
    if (!r) return;
    if (r.kind === 'hire') G.act((o) => hire(G.s, r.jobId, this.amount === 1 ? 1 : this.amount, o));
    else G.act((o) => buyCert(G.s, r.jobId, o));
    this.refresh();
  }

  /** 추천 버튼 화면 좌표(손가락 가이드용) */
  recButtonPos() { return this.expanded ? null : { x: this.recBtn.x, y: this.recBtn.y }; }

  refresh() {
    const s = G.s;
    const w = wallInfo(s);
    const fm = feverMult(s);
    // 추가 버튼
    if (this.extra) { this.extraBtn.setVisible(true).setLabel(this.extra.label); } else this.extraBtn.setVisible(false);
    if (!this.expanded) {
      const r = w.rec;
      if (!r) { this.recName.setText('고용할 직종 없음'); this.recSub.setText(''); this.recBtn.setEnabled(false); return; }
      const j = job(r.jobId);
      let label: string, cost: number;
      if (r.kind === 'hire') {
        const q = hireQuote(s, r.jobId, this.amount === 1 ? 1 : this.amount);
        const n = this.amount === 'max' ? Math.max(1, q.n) : q.n;
        cost = this.amount === 'max' && q.n === 0 ? r.cost : q.cost;
        label = `고용 ×${n}\n${formatKR(cost)}`;
        this.recName.setText(`추천: ${j.name} (${owned(s, j.id)}명)`);
      } else {
        cost = r.cost; label = `자격증\n${formatKR(cost)}`;
        this.recName.setText(`추천: ${j.name} 자격증 ×3`);
      }
      const eta = etaFor(s, cost);
      const t = nextTeam(j, owned(s, j.id));
      this.recSub.setText(eta > 0 ? `${formatSec(eta)} 뒤 가능` : t ? `팀 보너스까지 ${t - owned(s, j.id)}명` : '지금 고용 가능!');
      this.recBtn.setLabel(label).setEnabled(cost <= s.money);
      return;
    }
    this.rebuildRows();
    for (const r of this.rows) {
      const k = owned(s, r.j.id);
      const q = hireQuote(s, r.j.id, this.amount);
      const n = this.amount === 'max' ? q.n : (this.amount as number);
      const cost = this.amount === 'max' ? (q.n > 0 ? q.cost : hireCostN(r.j, k, 1)) : q.cost;
      const t = nextTeam(r.j, k);
      r.name.setText(`${r.j.name} · ${k}명`);
      r.sub.setText(`초당 ${formatKR(jobIncomeBase(s, r.j) * fm)}${t ? ` · 팀까지 ${t - k}명` : ''}`);
      r.hireB.setLabel(`고용 ×${Math.max(1, n)}\n${formatKR(cost)}`).setEnabled(cost <= s.money && (this.amount !== 'max' || q.n > 0));
      const c = nextCert(s, r.j);
      if (c && c.open) r.certB.setVisible(true).setLabel(`자격증×3\n${formatKR(c.price)}`).setEnabled(c.price <= s.money);
      else r.certB.setVisible(false);
      const isRec = !!w.rec && w.rec.jobId === r.j.id;
      r.tag.setVisible(isRec);
      r.frame.setStrokeStyle(isRec ? 2 : 1, isRec ? 0xffd166 : C.line);
    }
    const lock = cityJobs(s).find((j) => !isUnlocked(s, j));
    if (lock) {
      const prev = cityJobs(s)[lock.slot - 2];
      this.lockText.setText(`🔒 ${lock.name} — ${prev.name} ${unlockNeed(lock)}명에서 해금 (${Math.max(0, unlockNeed(lock) - owned(s, prev.id))}명 남음)`);
    } else this.lockText.setText('');
  }
}
