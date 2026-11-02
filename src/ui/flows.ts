// 연출 시퀀스(대기열 아이템): 도입, 마을 공개, 월급날, 팀 보너스 단체 사진, 자격증, 출세 컷
import Phaser from 'phaser';
import { G } from '../game';
import { job, D, teamCounts } from '../core/econ';
import { formatKR, formatSec } from '../core/format';
import { collectOffline } from '../core/offline';
import { lineText, linesOf, pickLine } from '../data/content';
import { showCard, showLedger } from './popup';
import { txt, W, H, C, R, doodleRect } from './kit';
import { sfx } from '../fx/sound';
import { takePhoto, photoTexture, sharePhoto, type Photo } from '../fx/photo';
import type { PopupQueue } from './popup';
import type { PaydaySlip } from '../core/state';
import type { HomeScene } from '../scenes/HomeScene';
import type { VillageScene } from '../scenes/VillageScene';

export interface UiCtx {
  sc: Phaser.Scene;
  queue: PopupQueue;
  switchTab(t: 'home' | 'village' | 'clones' | 'shop', instant?: boolean): void;
  home(): HomeScene;
  village(): VillageScene;
  toast(text: string, color?: string): void;
}

/** 도입: 월세 고지서 → 쓰러짐 → 거울 속 내가 걸어 나옴 (각 컷 탭 또는 자동 진행) */
export function introFlow(ctx: UiCtx, done: () => void) {
  const lines = linesOf('intro').map((l) => l.text);
  let i = 0;
  const next = () => {
    if (i >= lines.length) { G.s.flags.introDone = 1; done(); return; }
    const t = lines[i++];
    showCard(ctx.sc, { lines: [t], doodle: true, autoCloseMs: 2200, width: 290 }, next);
  };
  next();
}

function flash(scene: Phaser.Scene, color = 0xffffff, ms = 300) {
  const f = scene.add.rectangle(W / 2, H / 2, W, H, color, 1).setDepth(950);
  scene.tweens.add({ targets: f, alpha: 0, duration: ms, onComplete: () => f.destroy() });
}

/** 사진 카드(+ 장면마다 1회 공유 제안) */
export function photoCard(ctx: UiCtx, caption: string, shareKey: string | null, done: () => void) {
  takePhoto(ctx.sc.game, caption, (p: Photo) => {
    flash(ctx.sc, 0xffffff, 400);
    photoTexture(ctx.sc, p, (key) => {
      const offer = !!shareKey && !G.s.flags[`share_${shareKey}`];
      if (offer) G.s.flags[`share_${shareKey}`] = 1;
      const buttons = offer
        ? [{ label: '공유하기', cb: () => void sharePhoto(p, caption), color: 0x8338ec }, { label: '앨범에 저장됨', color: 0x4a4f6a }]
        : [{ label: '앨범에 저장됨', color: 0x4a4f6a }];
      showCard(ctx.sc, { title: '📸 찰칵!', lines: [caption], image: { key, w: 135, h: 240 }, buttons, width: 260 }, done);
    });
  });
}

/** 마을 공개 줌아웃 → 첫 단체 사진 + 공유 제안 1회 → 홈 복귀 */
export function revealFlow(ctx: UiCtx, done: () => void) {
  const home = ctx.home();
  home.cameras.main.zoomTo(R * 2.4, 500, 'Cubic.easeIn');
  home.cameras.main.pan(75, 132, 500, 'Cubic.easeIn');
  ctx.sc.time.delayedCall(520, () => {
    ctx.switchTab('village', true);
    home.cameras.main.resetFX(); home.cameras.main.zoomEffect.reset(); home.cameras.main.setZoom(R).centerOn(W / 2, H / 2);
    ctx.village().playReveal(() => {
      ctx.toast('🏘️ 마을 공개! 아래 [마을] 탭이 열렸어요');
      photoCard(ctx, `분신 ${G.s.totalHired}명, 우리 마을 첫 단체 사진`, 'village', () => { ctx.switchTab('home'); done(); });
    });
  });
}

/** 월급날: (10초 카운트다운은 HUD) → 플래시 → 월급봉투 흩날림 → 큰 숫자 카운트업 → 명세서 */
export function paydayFlow(ctx: UiCtx, slip: PaydaySlip, done: () => void) {
  const sc = ctx.sc;
  sfx.ding();
  flash(sc, 0xfff3b0, 500);
  for (let i = 0; i < 24; i++) {
    const e = sc.add.image(Phaser.Math.Between(0, W), -20, 'envelope').setScale(1.4 / R).setDepth(940).setAngle(Phaser.Math.Between(-40, 40));
    sc.tweens.add({ targets: e, y: H + 30, x: e.x + Phaser.Math.Between(-60, 60), angle: e.angle + Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(900, 1600), delay: i * 35, onComplete: () => e.destroy() });
  }
  const big = txt(sc, W / 2, 214, '0', 30, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(945);
  const lbl = txt(sc, W / 2, 180, slip.index === 1 ? '🎉 첫 월급날!' : '💰 월급날!', 22, '#fff', { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(945);
  sc.tweens.addCounter({ from: 0, to: slip.total, duration: 1300, ease: 'Cubic.easeOut',
    onUpdate: (tw) => big.setText(`+${formatKR(tw.getValue() ?? 0)}`),
    onComplete: () => sc.time.delayedCall(500, () => {
      big.destroy(); lbl.destroy();
      // 명세서: 큰 합계 → 한 줄 한 정보(큰 금액 위) → 개그 공제 1줄은 맨 아래 작게
      const rows = slip.lines.map((l) => ({ label: l.label, amount: l.amount }));
      if (slip.dividendCash + slip.dividendReinvest > 0) rows.push({ label: slip.dividendReinvest > 0 ? '배당금(통장에서 불어남)' : '배당금', amount: slip.dividendCash + slip.dividendReinvest });
      if (slip.heldDividend > 0) rows.push({ label: '보유 종목 배당', amount: slip.heldDividend });
      const foot = [`(공제) ${pickLine('deduction', [])} 0원 — 분신들이 대신 냄`];
      if (slip.accountOpened) foot.unshift(`🐷 배당주 통장 개설! 축하금 ${formatKR(slip.openBonus)} 입금`);
      showLedger(sc, { title: `월급 명세서 #${slip.index}`, total: slip.total, totalNote: chickenNote(slip.total), rows, foot,
        buttons: [{ label: '받기', color: 0x06a77d }] }, formatKR, done);
    }) });
}

export function teamFlow(ctx: UiCtx, jobId: string, count: number, done: () => void) {
  const j = job(jobId);
  sfx.ding();
  const first = teamCounts(j)[0] === count;
  photoCard(ctx, `${j.name} ${count}명 단체 사진! 그 직종 수입 +20% · 사진첩 +1%`, first ? `team_${j.slot}` : null, done);
}

export function certFlow(ctx: UiCtx, jobId: string, level: number, done: () => void) {
  const j = job(jobId);
  const m = D.cert[level - 1];
  showCard(ctx.sc, { title: `🎓 ${j.name} ${m?.label ?? '자격증'}`, lines: [pickLine('cert', G.s.director.lastLines), `그 직종 수입 ×${m?.multiplier ?? 1}`, lineText('cert_fact') ?? ''].filter(Boolean), doodle: true, autoCloseMs: 3200 }, done);
}

/** 출세 만화 컷 + 비포·애프터 + 엄마 문자 */
export function unlockFlow(ctx: UiCtx, jobId: string, done: () => void) {
  const j = job(jobId);
  const lines = [`새 직종 해금: ${j.name} (${j.tierLabel})`];
  const prev = D.jobs.find((x) => x.city === j.city && x.slot === j.slot - 1);
  const firstOfTier = (j.tier === 'alba' && j.slot === 2) || (j.tier !== 'alba' && prev?.tier !== j.tier);
  const promo = lineText('promo', j.tier);
  if (promo && firstOfTier) lines.push(`본체의 자리: ${promo}`);
  const mom = lineText('mom', j.tier);
  if (mom && firstOfTier) lines.push(mom);
  sfx.pop();
  showCard(ctx.sc, { title: '📰 출세!', lines, doodle: true, autoCloseMs: 2600, width: 300 }, done);
}

export function drawFinger(scene: Phaser.Scene) {
  const c = scene.add.container(0, 0).setDepth(980);
  const ring = scene.add.circle(0, 0, 18, 0xffffff, 0).setStrokeStyle(3, 0xffffff);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1).fillTriangle(-9, -44, 9, -44, 0, -26).fillRect(-4, -64, 8, 22);
  doodleRect(g, -6, -66, 12, 2, 0xffffff, 1);
  c.add([ring, g]);
  scene.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 800, repeat: -1 });
  scene.tweens.add({ targets: g, y: 8, duration: 400, yoyo: true, repeat: -1 });
  return c;
}

/** 정산서(복귀): 직종별 오프라인 수입 + 밀린 월급봉투 + 배당. 광고 2배 제안은 이곳 한 곳만(가짜 1초 시청) */
export function settlementFlow(ctx: UiCtx, done: () => void) {
  const rep = G.s.pendingOffline;
  if (!rep) { done(); return; }
  const lines: string[] = [`비운 시간 ${formatSec(rep.sec)}${rep.capped ? ' (8시간 넘음 → 이후 25% 속도)' : ''}`];
  for (const [id, v] of Object.entries(rep.byJob)) if (v > 0) lines.push(`${job(id).name} 야간 근무  +${formatKR(v)}`);
  if (G.s.envelopes > 0) lines.push(`밀린 월급봉투 ${rep.paydays}장  +${formatKR(G.s.envelopes)}`);
  if (rep.dividendCash + rep.heldDividend > 0) lines.push(`배당금(현금)  +${formatKR(rep.dividendCash + rep.heldDividend)}`);
  if (rep.dividendReinvest > 0) lines.push(`통장에서 불어난 돈  +${formatKR(rep.dividendReinvest)}`);
  const total = rep.income + G.s.envelopes + rep.dividendCash + rep.heldDividend;
  lines.push(`합계  +${formatKR(total)}`);
  const collect = (double: boolean) => {
    G.act(() => collectOffline(G.s, rep, double));
    ctx.toast(`정산 완료 +${formatKR(total + (double ? rep.income : 0))}`, C.gold);
  };
  showCard(ctx.sc, { title: '🧾 정산서', lines, doodle: true, width: 320, buttons: [
    { label: '받기', color: 0x06a77d, cb: () => { collect(false); done(); } },
    { label: '광고 보고 2배', color: 0x8338ec, cb: () => {
      const t = txt(ctx.sc, W / 2, H / 2, '광고 시청 중… (PoC 가짜 1초)', 14, '#fff', { backgroundColor: '#000', padding: { x: 10, y: 8 } }).setOrigin(0.5).setDepth(1500);
      ctx.sc.time.delayedCall(1000, () => { t.destroy(); collect(true); done(); });
    } },
  ] }, () => {});
}

/** 직종별 첫 분신 컷씬(2.5초, 탭으로 넘김): 같은 얼굴 분신이 크게 + 현실 경제 한 줄 */
export function firstJobFlow(ctx: UiCtx, jobId: string, done: () => void) {
  const j = job(jobId);
  const lines = [lineText('firstjob', jobId) ?? lineText('firstjob', j.tier) ?? `${j.name} 첫 출근!`];
  // 출세 컷(본체의 자리 비포·애프터 + 엄마 문자)은 그 등급의 첫 직종일 때만
  const prev = D.jobs.find((x) => x.city === j.city && x.slot === j.slot - 1);
  const firstOfTier = (j.tier === 'alba' && j.slot === 2) || (j.tier !== 'alba' && prev?.tier !== j.tier);
  if (firstOfTier) {
    const promo = lineText('promo', j.tier); if (promo) lines.push(`본체의 자리: ${promo}`);
    const mom = lineText('mom', j.tier); if (mom) lines.push(mom);
  }
  sfx.pop();
  showCard(ctx.sc, { title: `🎬 ${j.name} 첫 출근`, doodle: true, image: { key: `clone_${j.tier}`, w: 48, h: 66 }, lines, autoCloseMs: firstOfTier ? 3600 : 2600, width: 310 }, done);
}

/** 현실 물가 환산 한 줄(치킨 1마리 2만 원 가정) */
export function chickenNote(amount: number): string {
  const n = Math.floor(amount / 20000);
  return n >= 1 ? `= 치킨 ${formatKR(n)}마리 🍗` : '';
}
