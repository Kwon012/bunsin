// 행동형 튜토리얼: 지시한 행동을 하면 다음 할 일을 알려 준다('다음' 버튼 없음). 손가락 가이드 1개 + 한 줄 코멘트.
import Phaser from 'phaser';
import { G } from '../game';
import { totalClones, hireCost, cityJobs, owned } from '../core/econ';
import { formatKR } from '../core/format';
import { currentHouse, houseFurniture, furnLevel } from '../core/home';
import { lineText } from '../data/content';
import { showCard } from './popup';
import { txt, W, C } from './kit';
import type { UIScene } from '../scenes/UIScene';

interface Step {
  say: string;               // 지시(상단 말풍선)
  done: () => boolean;       // 완료 조건
  praise: string;            // 완료 코멘트
  target: (ui: UIScene) => { x: number; y: number } | null; // 손가락 위치
  card?: (ui: UIScene, d: () => void) => void; // 정보 카드(행동 대신 확인)
}

const firstCost = () => hireCost(cityJobs(G.s)[0], owned(G.s, cityJobs(G.s)[0].id));
const furnitureLevels = () => houseFurniture(currentHouse(G.s).id).reduce((a, f) => a + furnLevel(G.s, f.id), 0);

export const STEPS: Step[] = [
  { say: '', done: () => G.s.totalHired >= 1 || G.s.money >= firstCost(), praise: '좋아요! 탭 한 번 = 알바 1시간치(약 1만 원)', target: () => ({ x: 180, y: 330 }) },
  { say: '아래 [고용]을 눌러 거울 속 나를 불러내요', done: () => G.s.totalHired >= 1, praise: '뿅! 분신은 가만히 있어도 초당 돈을 벌어요', target: (ui) => ui.sheet.recButtonPos() },
  { say: '분신을 5명까지 늘려 보세요', done: () => G.s.totalHired >= 5, praise: '분신이 늘수록 초당 수입이 올라요', target: (ui) => ui.sheet.recButtonPos() },
  { say: '', done: () => !!G.s.flags.tutPayday, praise: '', target: () => ({ x: 300, y: 14 }),
    card: (ui, d) => showCard(ui, { title: '💰 월급날이 있어요', doodle: true, lines: [lineText('payday_intro') ?? '', '위쪽 💰 시계가 0이 되면 월급봉투가 와요', '첫 월급날은 곧! 그때까지 분신을 모아 봐요'], buttons: [{ label: '기대된다', color: 0x06a77d, cb: () => { G.s.flags.tutPayday = 1; } }] }, d) },
  { say: '분신 15명이 모이면 홈이 꽉 차고 마을이 열려요', done: () => !!G.s.flags.villageRevealed || totalClones(G.s) >= 15, praise: '마을이 열렸어요! 홈에 다 못 있는 분신은 마을로 출근해요', target: (ui) => ui.sheet.recButtonPos() },
  { say: '고용 칸을 위로 끌어올려 [🛋️ 집]에서 가구를 키워요', done: () => furnitureLevels() >= 1, praise: '가구 1레벨 = 명성 +1 = 수입 +1%. 가구를 다 키우면 반지하 탈출!', target: (ui) => ui.sheet.tabButtonPos('home') },
];

export class Tutorial {
  private bubble: Phaser.GameObjects.Text;
  private shownCard = -1;
  constructor(private ui: UIScene) {
    this.bubble = txt(ui, W / 2, 194, '', 12, '#1d1f2b', { backgroundColor: '#fff3b0', padding: { x: 10, y: 6 }, align: 'center', wordWrap: { width: 300 }, fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(640).setVisible(false);
  }
  get step(): number { return G.s.flags.tut ?? 0; }
  get active(): boolean { return this.step < STEPS.length && !!G.s.flags.introDone; }

  /** 매 프레임: 완료 확인 → 다음 단계, 손가락 위치 반환 */
  update(): { x: number; y: number } | null {
    if (!this.active) { this.bubble.setVisible(false); return null; }
    const st = STEPS[this.step];
    if (st.done()) {
      if (st.praise) this.ui.toast(`👍 ${st.praise}`, C.gold);
      G.s.flags.tut = this.step + 1;
      return null;
    }
    if (st.card) {
      this.bubble.setVisible(false);
      if (this.shownCard !== this.step && !this.ui.queue.busy) { this.shownCard = this.step; this.ui.queue.push((d) => st.card!(this.ui, d), 'tut'); }
      return null;
    }
    if (this.ui.queue.busy) { this.bubble.setVisible(false); return null; }
    const say = this.step === 0 ? `화면 어디든 톡톡! 첫 분신 고용비를 모아요 (${formatKR(G.s.money)} / ${formatKR(firstCost())}원)` : st.say;
    this.bubble.setText(`${this.step + 1}/${STEPS.length}  ${say}`).setVisible(true);
    return st.target(this.ui);
  }
}
