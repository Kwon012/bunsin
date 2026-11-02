// M5 UI: 매니저 은퇴식, 배당주 통장 카드(입금·깨기·매도·자동 적립), 통장 깨서 지금 사기, 이사(트럭) 카드·연출
import Phaser from 'phaser';
import { G } from '../game';
import { city, D, job } from '../core/econ';
import { accountCap, deposit, withdraw, sellHeld } from '../core/account';
import { hire, buyCert } from '../core/actions';
import { wallInfo, accountTotal, topJob } from '../core/recommend';
import { moveCity, movePreview } from '../core/move';
import { formatKR } from '../core/format';
import { showCard } from './popup';
import { photoCard, type UiCtx } from './flows';
import { txt, W, H, R, C } from './kit';
import { sfx } from '../fx/sound';
import { takePhoto } from '../fx/photo';

export function managerFlow(ctx: UiCtx, done: () => void) {
  sfx.ding();
  showCard(ctx.sc, { title: '📋 매니저 분신 은퇴식', doodle: true, lines: [
    '월급날 4번을 함께 버틴 본체가 드디어 손을 놓고 커피를 든다 ☕',
    '이제 매니저 분신이 자동 고용 · 자동 응원을 맡습니다',
    '(직접 탭이 더 빠르면 알려 드려요)',
  ], buttons: [{ label: '수고했어 나', color: 0x06a77d }] }, done);
}

/** 저금통 깨기 2초 연출 */
function piggyBreakFx(sc: Phaser.Scene, amount: number) {
  const pig = txt(sc, W / 2, H / 2 - 20, '🐷', 64).setOrigin(0.5).setDepth(1200);
  sc.tweens.add({ targets: pig, angle: { from: -12, to: 12 }, duration: 80, yoyo: true, repeat: 7 });
  sc.time.delayedCall(1300, () => {
    pig.setText('💥');
    for (let i = 0; i < 18; i++) {
      const c = sc.add.image(W / 2, H / 2 - 20, 'coin').setScale(1.5 / R).setDepth(1201);
      sc.tweens.add({ targets: c, x: c.x + Phaser.Math.Between(-140, 140), y: c.y + Phaser.Math.Between(-120, 160), alpha: 0, duration: 700 });
    }
    const t = txt(sc, W / 2, H / 2 + 40, `+${formatKR(amount)}`, 24, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(1201);
    sc.time.delayedCall(700, () => { pig.destroy(); t.destroy(); });
  });
}

/** 벽에서: 통장 깨서 지금 사기(필요한 만큼만, 지금 종목 → 보유 종목 순) */
export function breakAndBuy(ctx: UiCtx) {
  const s = G.s; const w = wallInfo(s);
  if (!w.rec || !w.breakSuggest) return;
  const need = w.rec.cost - s.money;
  const got = withdraw(s, need);
  piggyBreakFx(ctx.sc, got);
  ctx.sc.time.delayedCall(2000, () => {
    const r = w.rec!;
    G.act((o) => (r.kind === 'hire' ? hire(G.s, r.jobId, 1, o) : buyCert(G.s, r.jobId, o)));
  });
}

export function accountCard(ctx: UiCtx, done: () => void) {
  const s = G.s; const a = s.account;
  if (!a.open) { showCard(ctx.sc, { title: '🐷 배당주 통장', lines: ['매니저 분신이 생긴 다음 월급날에 열려요', '넣어 두면 월급날마다 불어나요'] }, done); return; }
  const cur = a.current;
  const lines = [
    '넣어 두면 월급날마다 불어나요 (가격 변동 없음)',
    `지금 종목: ${city(s).stockName}  ${formatKR(cur?.balance ?? 0)} / 한도 ${formatKR(accountCap(s))}`,
    `자동 적립: ${a.autoSave ? '켜짐(초당 수입의 10%)' : '꺼짐'}`,
    ...a.held.map((h) => `보유 종목: ${D.cities[h.cityIdx].stockName}  ${formatKR(h.balance)} (월급날 10% 현금 배당)`),
  ];
  const reopen = () => ctx.queue.push((d) => accountCard(ctx, d), 'account', true);
  const buttons: { label: string; cb?: () => void; color?: number }[] = [
    { label: '절반 입금', color: 0x3a86ff, cb: () => { const v = deposit(s, s.money / 2); ctx.toast(v > 0 ? `입금 ${formatKR(v)}` : '한도가 찼어요'); reopen(); } },
    { label: a.autoSave ? '적립 끄기' : '적립 켜기', color: 0x4a4f6a, cb: () => { a.autoSave = !a.autoSave; reopen(); } },
    { label: '전부 깨기', color: 0xef476f, cb: () => { const v = withdraw(s, Infinity); piggyBreakFx(ctx.sc, v); } },
    { label: '닫기', color: 0x2a2d3e },
  ];
  showCard(ctx.sc, { title: `🐷 배당주 통장 ${formatKR(accountTotal(s))}`, lines, buttons, width: 340 }, () => {
    if (a.held.length) ctx.queue.push((d) => heldCard(ctx, d), 'held', true);
    done();
  });
}
function heldCard(ctx: UiCtx, done: () => void) {
  const s = G.s; const h = s.account.held[0];
  if (!h) { done(); return; }
  showCard(ctx.sc, { title: '보유 종목 매도', lines: s.account.held.map((x) => `${D.cities[x.cityIdx].stockName}  ${formatKR(x.balance)}`), buttons: [
    { label: `${D.cities[h.cityIdx].stockName} 매도`, color: 0xef476f, cb: () => { const v = sellHeld(s, h.stockId); ctx.toast(`매도 +${formatKR(v)}`, C.gold); } },
    { label: '닫기', color: 0x4a4f6a },
  ] }, done);
}

export function topHiredFlow(ctx: UiCtx, jobId: string, done: () => void) {
  const s = G.s;
  if (s.cityIdx >= D.cities.length - 1) {
    showCard(ctx.sc, { title: `🗽 ${job(jobId).name}!`, doodle: true, lines: ['마지막 도시의 꼭대기에 올랐다', '반지하에서 맨해튼 펜트하우스까지. (PoC 끝)'], buttons: [{ label: '만세!' }] }, done);
    return;
  }
  showCard(ctx.sc, { title: '🚚 이삿짐 트럭 도착!', doodle: true, lines: [
    `${job(jobId).name} 첫 고용! 마을 꼭대기에 이삿짐 트럭이 왔다`,
    `다음 도시: ${D.cities[s.cityIdx + 1].name}`, '이사는 선택. 더 키우다 가도 됩니다',
  ], buttons: [{ label: '알겠어', color: 0x06a77d }] }, done);
}

/** 도시 확장 카드: 얻는 것 크게, 초기화되는 것 작게, 도시 규칙 한 줄, 버튼 하나 */
export function moveCard(ctx: UiCtx, done: () => void) {
  const s = G.s;
  if (s.cityIdx >= D.cities.length - 1) { ctx.toast('마지막 도시입니다'); done(); return; }
  const top = topJob(s);
  if (!(s.owned[top.id] >= 1)) { ctx.toast(`꼭대기 직종 ★${top.name}을(를) 고용하면 이사할 수 있어요`); done(); return; }
  const pv = movePreview(s);
  const sc = ctx.sc;
  const { root, top: cardTop } = (() => { const r = sc.add.container(0, 0).setDepth(1000); return { root: r, top: 120 }; })();
  const dim = sc.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive();
  const g = sc.add.graphics().fillStyle(0xfffbea, 1).fillRoundedRect(20, cardTop, W - 40, 380, 12);
  root.add([dim, g]);
  const ink = '#222';
  root.add(txt(sc, W / 2, cardTop + 16, `🚚 ${pv.next!.name}(으)로 이사`, 20, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 56, `명성 +${pv.gain}`, 30, '#d62828', { fontStyle: 'bold' }).setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 98, `영구 수입 ×${pv.multNow.toFixed(1)} → ×${pv.multAfter.toFixed(1)}`, 16, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 126, `개성 분신 ${pv.uniques}명 동행 · 매니저·통장 유지\n정착금 ${formatKR(pv.settle)} (새 도시 첫 분신 3명치)`, 13, ink, { align: 'center' }).setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 180, `${pv.next!.theme} · 꼭대기: ${pv.next!.topBuilding}`, 12, '#555').setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 202, '도시 규칙: 미정(기획서에 구체 규칙 없음)', 11, '#888').setOrigin(0.5, 0));
  root.add(txt(sc, W / 2, cardTop + 230, '초기화: 돈 · 분신 · 자격증 (떠난 마을은 앨범에 보존)', 10, '#888').setOrigin(0.5, 0));
  const close = (go: boolean) => { root.destroy(); if (go) moveFlow(ctx, done); else done(); };
  const b1 = sc.add.rectangle(W / 2, cardTop + 290, 200, 46, 0xd62828).setInteractive({ useHandCursor: true });
  const l1 = txt(sc, W / 2, cardTop + 290, '이사하기', 18, '#fff', { fontStyle: 'bold' }).setOrigin(0.5);
  const b2 = txt(sc, W / 2, cardTop + 340, '나중에', 12, '#666').setOrigin(0.5).setInteractive({ useHandCursor: true });
  b1.on('pointerdown', () => close(true)); b2.on('pointerdown', () => close(false));
  root.add([b1, l1, b2]);
}

/** 이사 연출: 떠나는 마을 사진 → 분신들이 트럭으로 우르르 → 트럭 출발 → 새 도시 도착 */
export function moveFlow(ctx: UiCtx, done: () => void) {
  const s = G.s; const fromName = city(s).name;
  ctx.switchTab('village', true);
  const v = ctx.village();
  v.scrollTo(0);
  ctx.sc.time.delayedCall(300, () => {
    takePhoto(ctx.sc.game, `${fromName} 추억: 분신 ${formatKR(s.totalHired)}명이 일하던 마을`);
    const dots = v.buildings.flatMap((b) => b.dots).slice(0, 120);
    dots.forEach((d, i) => v.tweens.add({ targets: d, x: v.truck.x + Phaser.Math.Between(-30, 30), y: v.truck.y, duration: 900, delay: (i % 40) * 15, ease: 'Quad.easeIn' }));
    v.time.delayedCall(1300, () => {
      v.tweens.add({ targets: v.truck, x: W + 120, duration: 900, ease: 'Cubic.easeIn' });
      dots.forEach((d) => v.tweens.add({ targets: d, x: W + 120, duration: 900, ease: 'Cubic.easeIn' }));
    });
    v.time.delayedCall(2400, () => {
      const out: Parameters<typeof moveCity>[1] = [];
      moveCity(G.s, out);
      G.dispatch(out);
      ctx.switchTab('home');
      const nc = city(G.s);
      showCard(ctx.sc, { title: `🎉 ${nc.name} 도착!`, doodle: true, lines: [`이사 축하! 정착금 ${formatKR(nc.settleMoney)}`, `창문 너머: ${nc.topBuilding}`, '개성 분신들도 함께 왔다'], buttons: [{ label: '새 출발!', color: 0x06a77d }] }, done);
    });
  });
}

/** 홈: '직접 탭 = 더 빠름' 판단 */
export function directTapFaster(tapTimes: number[], windowSec: number, managerRate: number): boolean {
  return tapTimes.length / windowSec > managerRate;
}
export { photoCard };
