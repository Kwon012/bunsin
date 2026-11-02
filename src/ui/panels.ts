// 하단 탭 패널: 분신(인원·팀 보너스·도감·앨범), 상점(항목만, PoC 미지원)
import Phaser from 'phaser';
import { G } from '../game';
import { cityJobs, isUnlocked, nextTeam, owned, totalClones, city } from '../core/econ';
import { formatKR } from '../core/format';
import { button, txt, W, C, TIER_COLOR } from './kit';

export const PANEL_TOP = 44, PANEL_BOTTOM = 600;

export abstract class Panel {
  root: Phaser.GameObjects.Container;
  constructor(protected scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(700).setVisible(false);
    const bg = scene.add.rectangle(W / 2, (PANEL_TOP + PANEL_BOTTOM) / 2, W, PANEL_BOTTOM - PANEL_TOP, 0x1d1f2b, 0.98).setInteractive();
    this.root.add(bg);
  }
  show() { this.root.setVisible(true); this.render(); }
  hide() { this.root.setVisible(false); }
  get visible() { return this.root.visible; }
  protected content?: Phaser.GameObjects.Container;
  protected fresh(): Phaser.GameObjects.Container {
    this.content?.destroy();
    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);
    return this.content;
  }
  abstract render(): void;
}

export class ClonesPanel extends Panel {
  /** M4에서 도감·앨범 섹션을 덧붙인다 */
  extraSections: ((c: Phaser.GameObjects.Container, y: number) => number)[] = [];
  render() {
    const c = this.fresh(); const s = G.s; const sc = this.scene;
    let y = PANEL_TOP + 10;
    c.add(txt(sc, 12, y, `전체 분신 ${formatKR(totalClones(s))}명 · ${city(s).name}`, 16, C.gold, { fontStyle: 'bold' })); y += 28;
    for (const j of cityJobs(s)) {
      if (!isUnlocked(s, j)) continue;
      const k = owned(s, j.id); const t = nextTeam(k);
      c.add(sc.add.rectangle(16, y + 8, 8, 14, TIER_COLOR[j.tier]));
      c.add(txt(sc, 26, y, `${j.name} ${formatKR(k)}명`, 12));
      c.add(txt(sc, W - 12, y, t ? `다음 팀 보너스까지 ${t - k}명` : '팀 보너스 완료', 11, C.dim).setOrigin(1, 0));
      y += 20;
    }
    y += 8;
    for (const f of this.extraSections) y = f(c, y);
  }
}

export class ShopPanel extends Panel {
  render() {
    const c = this.fresh(); const sc = this.scene;
    let y = PANEL_TOP + 10;
    c.add(txt(sc, 12, y, '상점', 18, C.gold, { fontStyle: 'bold' })); y += 30;
    c.add(txt(sc, 12, y, '확률 상품 없음 · 모든 상품 내용 확정 · PoC에서는 구매 불가', 11, C.dim)); y += 26;
    const items = [
      ['보상형 광고: 잠깐 수입 부스트', '오늘 남은 횟수 3'],
      ['광고 제거 패키지', '광고 없이 즉시 보상 + 상시 수입 부스트'],
      ['스타터팩', '재화 + 개성 분신 1종 + 매니저 즉시 해금'],
      ['시간 가속권', '즉시 몇 시간분 수입'],
      ['코스메틱', '본체·분신 의상, 마을 외관(효과 없음)'],
    ];
    for (const [name, desc] of items) {
      c.add(sc.add.rectangle(W / 2, y + 24, W - 20, 50, C.panel2).setStrokeStyle(1, C.line));
      c.add(txt(sc, 20, y + 6, name, 13, C.text, { fontStyle: 'bold' }));
      c.add(txt(sc, 20, y + 27, desc, 10, C.dim));
      c.add(button(sc, W - 60, y + 24, 86, 30, 'PoC 미지원', () => {}, 0x4a4f6a, 10).setEnabled(false));
      y += 58;
    }
  }
}
