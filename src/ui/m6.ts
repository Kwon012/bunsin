// M6 UI: 귀가 행렬, 정산서(부재중 뉴스·MVP·공유·광고 2배 1곳), 출근 도장, 마무리 카드, 세션 끝 예고, 설정, 시간대
import Phaser from 'phaser';
import { G } from '../game';
import { incomeBase, job } from '../core/econ';
import { collectOffline } from '../core/offline';
import { stampToday, mvpLine, absentNews, PARADE_MIN_SEC, PARADE_MIN_INCOME_SEC, markClosingShown } from '../core/session';
import { formatKR, formatSec } from '../core/format';
import { clock } from '../core/clock';
import { lineText } from '../data/content';
import { showCard } from './popup';
import { type UiCtx } from './flows';
import { button, txt, W, H, R, C } from './kit';
import { sfx, sound } from '../fx/sound';
import { takePhoto, sharePhoto } from '../fx/photo';

/** 귀가 행렬: 분신들이 돈 봉투를 들고 귀가(오래 비웠거나 금액이 클 때만, 언제든 스킵) */
export function paradeFlow(ctx: UiCtx, done: () => void) {
  const rep = G.s.pendingOffline;
  const big = !!rep && (rep.sec >= PARADE_MIN_SEC || rep.income >= incomeBase(G.s) * PARADE_MIN_INCOME_SEC);
  if (!rep || !big) { done(); return; }
  ctx.switchTab('home', true);
  const sc = ctx.sc;
  const root = sc.add.container(0, 0).setDepth(960);
  root.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25).setInteractive());
  root.add(txt(sc, W / 2, 130, rep.capped ? '분신들이 집 앞에서 기다리고 있었어요' : '분신들이 퇴근해서 돌아왔어요!', 15, '#fff', { fontStyle: 'bold', backgroundColor: '#000000aa', padding: { x: 8, y: 5 } }).setOrigin(0.5));
  for (let i = 0; i < 24; i++) {
    const y = 360 + (i % 6) * 26;
    const c = sc.add.container(-30 - Math.floor(i / 6) * 40, y, [sc.add.image(0, 0, 'clone_alba').setScale(1 / R), sc.add.image(0, -16, 'envelope').setScale(1 / R)]);
    root.add(c);
    sc.tweens.add({ targets: c, x: 180 + Phaser.Math.Between(-20, 20), y: 330, duration: 1600, delay: i * 70, ease: 'Sine.easeInOut', onComplete: () => c.setVisible(false) });
  }
  let ended = false;
  const end = () => { if (ended) return; ended = true; root.destroy(); done(); };
  root.add(button(sc, W - 60, 110, 90, 26, '건너뛰기 ▶', end, 0x4a4f6a, 11));
  sc.time.delayedCall(3600, end);
}

export function settlementFlow(ctx: UiCtx, done: () => void) {
  const s = G.s; const rep = s.pendingOffline;
  if (!rep) { done(); return; }
  const lines: string[] = [`비운 시간 ${formatSec(rep.sec)}${rep.capped ? ' · 8시간 이후는 25% 속도로 계속 쌓임' : ''}`];
  for (const [id, v] of Object.entries(rep.byJob)) if (v > 0) lines.push(`${job(id).name} 야간 근무  +${formatKR(v)}`);
  if (s.envelopes > 0) lines.push(`밀린 월급봉투 ${rep.paydays}장  +${formatKR(s.envelopes)}`);
  if (rep.dividendCash + rep.heldDividend > 0) lines.push(`배당금(현금)  +${formatKR(rep.dividendCash + rep.heldDividend)}`);
  if (rep.dividendReinvest > 0) lines.push(`통장에서 불어난 돈  +${formatKR(rep.dividendReinvest)}`);
  const total = rep.income + s.envelopes + rep.dividendCash + rep.heldDividend;
  lines.push(`합계  +${formatKR(total)}`);
  const mvp = mvpLine(s, rep); if (mvp) lines.push(`🏅 ${mvp}`);
  const news = absentNews(s); if (news.length) lines.push('— 부재중 마을 뉴스 —', ...news.map((n) => `· ${n}`));
  const collect = (double: boolean) => {
    G.act(() => collectOffline(G.s, rep, double));
    sfx.ding();
    ctx.toast(`정산 완료 +${formatKR(total + (double ? rep.income : 0))}`, C.gold);
  };
  showCard(ctx.sc, { title: '🧾 정산서', lines, doodle: true, width: 330, buttons: [
    { label: '받기', color: 0x06a77d, cb: () => { collect(false); done(); } },
    { label: '광고 보고 2배', color: 0x8338ec, cb: () => {
      const t = txt(ctx.sc, W / 2, H / 2, '광고 시청 중… (PoC 가짜 1초)', 14, '#fff', { backgroundColor: '#000', padding: { x: 10, y: 8 } }).setOrigin(0.5).setDepth(1500);
      ctx.sc.time.delayedCall(1000, () => { t.destroy(); collect(true); done(); });
    } },
    { label: '공유', color: 0x3a86ff, cb: () => {
      takePhoto(ctx.sc.game, `영수증: ${formatSec(rep.sec)} 동안 +${formatKR(total)}`, (p) => void sharePhoto(p, '분신 키우기 정산서'));
      collect(false); done();
    } },
  ] }, () => {});
}

/** 출근 도장: 하루 첫 1탭. 7일째 기념 분신 */
export function stampFlow(ctx: UiCtx, done: () => void) {
  showCard(ctx.sc, { title: '🪪 출근 도장', doodle: true, lines: ['본체가 출근 카드를 찍습니다', '(끊겨도 초기화 없음)'], buttons: [{ label: '쾅! 찍기', color: 0xd62828, cb: () => {
    const r = stampToday(G.s);
    sfx.pop();
    if (!r) return;
    ctx.toast(`출근 도장 ${r.days}일째`, C.gold);
    if (r.memorial) ctx.queue.push((d) => showCard(ctx.sc, { title: '👑 출근 7일 기념 분신!', doodle: true, lines: ['왕관 쓴 기념 분신이 홈에 함께합니다'], buttons: [{ label: '고마워' }] }, d), 'memorial', true);
    if (r.memorial) G.s.flags.memorial7 = 1;
  } }] }, done);
}

/** 마무리 카드(제안): 오늘의 결산 + 다음 월급날 예고. 받을지는 유저 선택 */
export function closingFlow(ctx: UiCtx, sessionEarned: number, sessionHired: number, done: () => void) {
  markClosingShown(G.s);
  showCard(ctx.sc, { title: '🌙 오늘의 결산', doodle: true, lines: [
    `이번 접속에서 +${formatKR(sessionEarned)}원 · 분신 ${formatKR(sessionHired)}명 고용`,
    `다음 월급날까지 ${formatSec(G.s.paydayIn)}`, '지금은 다음 구매까지 시간이 걸려요',
  ], buttons: [
    { label: '오늘은 여기까지', color: 0x3a86ff, cb: () => { G.s.metrics.closingCards++; ctx.queue.push((d) => sessionEndFlow(ctx, d), 'end', true); } },
    { label: '계속 구경', color: 0x4a4f6a },
  ] }, done);
}

/** 세션 끝 예고 */
export function sessionEndFlow(ctx: UiCtx, done: () => void) {
  G.save();
  showCard(ctx.sc, { title: '👋 수고했어요', doodle: true, lines: [lineText('session_end') ?? '앱을 꺼도 분신들은 일합니다', `다음 월급날까지 ${formatSec(G.s.paydayIn)}`] }, done);
}

export function settingsCard(ctx: UiCtx, done: () => void) {
  const st = G.s.settings;
  const reopen = () => ctx.queue.push((d) => settingsCard(ctx, d), 'settings', true);
  showCard(ctx.sc, { title: '⚙️ 설정', lines: [
    `사운드: ${st.sound ? '켜짐' : '꺼짐'} · 큰 글씨: ${st.bigText ? '켜짐' : '꺼짐'}`,
    `통장 자동 적립: ${G.s.account.autoSave ? '켜짐' : '꺼짐'}`,
    '알림(월급날·정산 상한) · 클라우드 백업 · 우편함: PoC 미지원',
    '저장: 이 기기 브라우저에 자동 저장',
  ], buttons: [
    { label: '사운드', color: 0x4a4f6a, cb: () => { st.sound = !st.sound; sound.enabled = st.sound; reopen(); } },
    { label: '큰 글씨', color: 0x4a4f6a, cb: () => { st.bigText = !st.bigText; G.save(); location.reload(); } },
    { label: '자동 적립', color: 0x4a4f6a, cb: () => { G.s.account.autoSave = !G.s.account.autoSave; reopen(); } },
    { label: '닫기', color: 0x3a86ff },
  ], width: 340 }, done);
}

/** 시간대 tint(기기 시각): 아침 출근 행렬, 밤 야근 불빛 */
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export function timeOfDay(h = clock.hour()): TimeOfDay { return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; }
export const TINT: Record<TimeOfDay, [number, number]> = { morning: [0xffd59e, 0.18], day: [0xffffff, 0], evening: [0xff7b00, 0.22], night: [0x0b1a40, 0.45] };
export const TOD_LABEL: Record<TimeOfDay, string> = { morning: '아침', day: '낮', evening: '저녁', night: '밤' };

/** 사진 모드: 시간대를 골라 찍기 */
export function photoModeFlow(ctx: UiCtx, done: () => void) {
  const v = ctx.village();
  const opts: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];
  showCard(ctx.sc, { title: '📷 사진 모드', lines: ['시간대를 고르면 찍습니다'], buttons: opts.map((t) => ({ label: TOD_LABEL[t], color: 0x3a86ff, cb: () => {
    v.setTimeOfDay(t);
    ctx.sc.time.delayedCall(150, () => {
      takePhoto(ctx.sc.game, `사진 모드(${TOD_LABEL[t]}): 분신 ${formatKR(G.s.totalHired)}명의 마을`, (p) => {
        v.setTimeOfDay(null);
        ctx.toast('📷 앨범에 저장됨');
        if (!G.s.flags.share_photo) { G.s.flags.share_photo = 1; ctx.queue.push((d) => showCard(ctx.sc, { title: '공유할까요?', lines: [p.caption], buttons: [{ label: '공유', cb: () => void sharePhoto(p, p.caption) }, { label: '괜찮아요', color: 0x4a4f6a }] }, d), 'share', true); }
      });
    });
  } })), width: 340 }, done);
}
