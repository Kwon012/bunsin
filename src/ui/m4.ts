// M4 UI: 사건 말풍선·카드, 건물 카드, 개성 분신 카드, 숨은 장면 카드, 도감·앨범 섹션
import Phaser from 'phaser';
import { G } from '../game';
import { city, cityJobs, incomeNow, jobIncomeBase, feverMult, nextTeam, owned, job, eco } from '../core/econ';
import { resolveEvent, seriesProgress } from '../core/director';
import { placeUnique, renameUnique, hintLevel, discoverScene } from '../core/uniques';
import { hire } from '../core/actions';
import { formatKR } from '../core/format';
import { UNIQUES, SCENES, type EventCard } from '../data/content';
import { album, photoTexture } from '../fx/photo';
import { showCard } from './popup';
import { photoCard, type UiCtx } from './flows';
import { button, txt, W, R, C, TIER_COLOR } from './kit';
import { sfx } from '../fx/sound';

/** 말풍선 단 분신(사건 알림). 홈 창문/마을 건물 옆에 띄운다 */
export function eventBubble(scene: Phaser.Scene, x: number, y: number, onTap: () => void) {
  const c = scene.add.container(x, y).setDepth(400);
  const clone = scene.add.image(0, 0, 'clone_alba').setScale(1.4 / R);
  const bub = txt(scene, 0, -30, '❗ 무슨 일?', 11, '#222', { backgroundColor: '#ffffff', padding: { x: 5, y: 3 } }).setOrigin(0.5);
  c.add([clone, bub]);
  c.setSize(80, 70).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => onTap());
  scene.tweens.add({ targets: bub, y: -36, duration: 400, yoyo: true, repeat: -1 });
  c.setScale(0); scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
  return c;
}

export function eventCardFlow(ctx: UiCtx, e: EventCard, done: () => void) {
  const prog = seriesProgress(e);
  const pick = (ch: 'a' | 'b') => {
    const v = G.act(() => resolveEvent(G.s, e, ch));
    sfx.pop();
    ctx.toast(`+${formatKR(v)}원 (${ch === 'a' ? e.choice_a : e.choice_b})`, C.gold);
  };
  const buttons = e.type === 'choice'
    ? [{ label: e.choice_a, cb: () => pick('a'), color: 0x3a86ff }, { label: e.choice_b, cb: () => pick('b'), color: 0x8338ec }]
    : [{ label: e.choice_a || '받기', cb: () => pick('a'), color: 0x06a77d }];
  showCard(ctx.sc, { title: `💬 사건${prog ? ` (연작 ${prog})` : ''}`, lines: [e.text, e.type === 'choice' ? '어느 쪽을 골라도 손해 없음' : ''].filter(Boolean), doodle: true, buttons, width: 310 }, done);
}

export function buildingCard(ctx: UiCtx, jobId: string, done: () => void) {
  const s = G.s; const j = job(jobId);
  const k = owned(s, jobId); const t = nextTeam(k);
  const u = s.uniques.find((x) => x.placedJob === jobId);
  const lines = [
    `${j.tierLabel} · ${formatKR(k)}명 · 초당 ${formatKR(jobIncomeBase(s, j) * feverMult(s))}원`,
    t ? `다음 팀 보너스까지 ${t - k}명` : '팀 보너스 모두 달성',
    `개성 분신 칸: ${u ? `⭐ ${u.name}` : '비어 있음'}`,
  ];
  const buttons: { label: string; cb?: () => void; color?: number }[] = [
    { label: '고용 ×1', cb: () => { G.act((o) => hire(G.s, jobId, 1, o)); ctx.queue.push((d) => buildingCard(ctx, jobId, d), 'bcard', true); }, color: 0x06a77d },
  ];
  if (s.uniques.length) buttons.push({ label: '개성 분신 교체', color: 0x8338ec, cb: () => {
    const order = s.uniques;
    const cur = order.findIndex((x) => x.placedJob === jobId);
    const next = order[(cur + 1) % order.length];
    if (cur >= 0 && order.length === 1) placeUnique(s, order[0].id, null);
    else placeUnique(s, next.id, jobId);
    ctx.queue.push((d) => buildingCard(ctx, jobId, d), 'bcard', true);
  } });
  buttons.push({ label: '닫기', color: 0x4a4f6a });
  showCard(ctx.sc, { title: `🏢 ${j.name}`, lines, buttons, width: 330 }, done);
}

export function uniqueCard(ctx: UiCtx, id: string, done: () => void) {
  const d = UNIQUES.find((x) => x.id === id); const u = G.s.uniques.find((x) => x.id === id);
  if (!d || !u) { done(); return; }
  sfx.ding();
  const eff = d.passive === 'job' ? `배치한 건물 수입 +${Math.round(Number(d.value) * 100)}%` : d.passive === 'tap' ? `탭 수입 +${Math.round(Number(d.value) * 100)}%` : `월급날 보너스 +${Math.round(Number(d.value) * 100)}%`;
  showCard(ctx.sc, { title: `✨ 개성 분신: ${u.name}`, titleColor: '#b5651d', lines: [`같은 얼굴 + ${d.prop}`, eff, u.placedJob ? `자동 배치: ${job(u.placedJob).name}` : '빈 건물이 생기면 자동 배치', '이사해도 함께 갑니다'], doodle: true,
    buttons: [{ label: '이름 바꾸기', color: 0x8338ec, cb: () => { const n = window.prompt('개성 분신 이름', u.name); if (n) renameUnique(G.s, id, n); } }, { label: '좋아!', color: 0x06a77d }] }, done);
}

export function sceneCard(ctx: UiCtx, sceneId: string, done: () => void) {
  const sc = SCENES.find((x) => x.id === sceneId)!;
  const cid = city(G.s).id;
  const isNew = discoverScene(G.s, cid, sceneId);
  const n = G.s.scenesFound[cid]?.length ?? 0;
  if (!isNew) { ctx.toast(`${sc.name} (이미 발견 · ${n}/${eco('hidden_scenes_per_city')})`); done(); return; }
  photoCard(ctx, `숨은 장면: ${sc.name} — ${sc.text} (${city(G.s).name} ${n}/${eco('hidden_scenes_per_city')})`, null, done);
}

/** 분신 탭: 개성 분신 도감 + 숨은 장면 + 떠난 마을 + 앨범 버튼 */
export function clonesExtra(ctx: UiCtx) {
  return (c: Phaser.GameObjects.Container, y0: number): number => {
    const s = G.s; const sc = ctx.sc; let y = y0;
    c.add(txt(sc, 12, y, `개성 분신 도감 ${s.uniques.length}/${UNIQUES.length} (${city(s).name})`, 14, C.gold, { fontStyle: 'bold' })); y += 22;
    for (const d of UNIQUES) {
      const u = s.uniques.find((x) => x.id === d.id);
      if (u) {
        c.add(sc.add.image(20, y + 8, 'clone_biz').setScale(1 / R));
        c.add(txt(sc, 32, y, `⭐ ${u.name} · ${d.prop}${u.placedJob ? ` · ${job(u.placedJob).name}` : ''}`, 11));
        c.add(button(sc, W - 34, y + 8, 52, 16, '이름', () => { const n = window.prompt('개성 분신 이름', u.name); if (n) { renameUnique(G.s, d.id, n); ctx.toast(`이름 변경: ${n}`); } }, 0x4a4f6a, 9));
      } else {
        c.add(sc.add.image(20, y + 8, 'clone_alba').setScale(1 / R).setTintFill(0x111111));
        c.add(txt(sc, 32, y, `??? · 힌트: ${hintLevel(s, d.id) === 2 ? d.hint2 : d.hint1}`, 11, C.dim));
      }
      y += 19;
    }
    y += 6;
    const cid = city(s).id;
    c.add(txt(sc, 12, y, `숨은 장면 ${(s.scenesFound[cid] ?? []).length}/${eco('hidden_scenes_per_city')} · 마을을 구경하면 발견`, 12, C.text)); y += 20;
    if (s.cityHistory.length) {
      c.add(txt(sc, 12, y, `떠난 마을: ${s.cityHistory.map((h) => `${G_cityName(h.cityIdx)}(분신 ${formatKR(h.clones)}·명성 +${h.fame})`).join(', ')}`, 11, C.dim, { wordWrap: { width: W - 24 } })); y += 34;
    }
    c.add(button(sc, W / 2, y + 16, 200, 30, `📷 추억 앨범 (${album().length}/30)`, () => ctx.queue.push((d) => albumCard(ctx, 0, d), 'album'), 0x3a86ff, 12));
    return y + 40;
  };
}
import { D } from '../core/econ';
const G_cityName = (i: number) => D.cities[i]?.name ?? '';

export function albumCard(ctx: UiCtx, page: number, done: () => void) {
  const photos = album().slice().reverse();
  if (!photos.length) { showCard(ctx.sc, { title: '추억 앨범', lines: ['아직 사진이 없어요. 팀 보너스·마을 공개 때 자동으로 찍힙니다'] }, done); return; }
  const per = 4; const pages = Math.ceil(photos.length / per);
  const list = photos.slice(page * per, page * per + per);
  const keys: string[] = [];
  const render = () => {
    const root = ctx.sc.add.container(0, 0).setDepth(1001);
    const dim = ctx.sc.add.rectangle(W / 2, 320, W, 640, 0x000000, 0.85).setInteractive();
    root.add(dim);
    root.add(txt(ctx.sc, W / 2, 60, `추억 앨범 ${page + 1}/${pages}`, 16, C.gold, { fontStyle: 'bold' }).setOrigin(0.5));
    list.forEach((p, i) => {
      const x = 95 + (i % 2) * 170, y = 90 + Math.floor(i / 2) * 250;
      root.add(ctx.sc.add.image(x, y + 110, keys[i]).setDisplaySize(124, 220));
      root.add(txt(ctx.sc, x, y + 224, p.caption, 9, C.text, { wordWrap: { width: 150 }, align: 'center' }).setOrigin(0.5, 0));
    });
    const close = (next?: number) => { root.destroy(); done(); if (next !== undefined) ctx.queue.push((d) => albumCard(ctx, next, d), 'album', true); };
    if (page > 0) root.add(button(ctx.sc, 70, 600, 100, 30, '◀ 이전', () => close(page - 1), 0x4a4f6a));
    root.add(button(ctx.sc, W / 2, 600, 80, 30, '닫기', () => close(), 0x3a86ff));
    if (page < pages - 1) root.add(button(ctx.sc, W - 70, 600, 100, 30, '다음 ▶', () => close(page + 1), 0x4a4f6a));
  };
  let loaded = 0;
  list.forEach((p, i) => photoTexture(ctx.sc, p, (k) => { keys[i] = k; if (++loaded === list.length) render(); }));
}

export { TIER_COLOR, cityJobs, incomeNow };
