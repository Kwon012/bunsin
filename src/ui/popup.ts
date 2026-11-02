// 팝업 대기열: 동시에 생긴 연출·카드는 겹치지 않고 하나씩 재생(기획서 §4.2 화면 규칙)
import Phaser from 'phaser';
import { button, cardBase, txt, W, C } from './kit';

export type QueueItem = (done: () => void) => void;

export class PopupQueue {
  private q: { item: QueueItem; tag?: string }[] = [];
  busy = false;
  constructor(private scene: Phaser.Scene) {}
  push(item: QueueItem, tag?: string, front = false) {
    if (front) this.q.unshift({ item, tag }); else this.q.push({ item, tag });
    this.next();
  }
  has(tag: string) { return this.q.some((x) => x.tag === tag); }
  get length() { return this.q.length + (this.busy ? 1 : 0); }
  private next() {
    if (this.busy || !this.q.length) return;
    this.busy = true;
    const { item } = this.q.shift()!;
    let finished = false;
    item(() => {
      if (finished) return;
      finished = true;
      this.busy = false;
      this.scene.time.delayedCall(120, () => this.next());
    });
  }
}

export interface CardOpts {
  title?: string; lines?: string[]; doodle?: boolean; buttons?: { label: string; cb?: () => void; color?: number }[];
  autoCloseMs?: number; width?: number; image?: { key: string; w: number; h: number }; titleColor?: string;
}
/** 텍스트 카드. 버튼 없으면 탭으로 닫힘 */
export function showCard(scene: Phaser.Scene, o: CardOpts, done: () => void) {
  const w = o.width ?? 300;
  const ink = o.doodle ? '#222222' : C.text;
  // 텍스트를 먼저 만들어 실제 높이를 잰다(줄바꿈 겹침 방지)
  const title = o.title ? txt(scene, W / 2, 0, o.title, 18, o.titleColor ?? (o.doodle ? '#222' : C.gold), { fontStyle: 'bold', align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5, 0) : null;
  const texts = (o.lines ?? []).map((l) => txt(scene, W / 2, 0, l, 13, ink, { align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5, 0));
  const imgH = o.image ? o.image.h + 10 : 0;
  const body = texts.reduce((a, t) => a + t.height + 4, 0);
  const h = Math.min(600, 26 + (title ? title.height + 12 : 0) + imgH + body + (o.buttons?.length ? 54 : 14));
  const { root, top, dim } = cardBase(scene, w, h, o.doodle);
  let y = top + 16;
  if (title) { title.setY(y); root.add(title); y += title.height + 12; }
  if (o.image) { root.add(scene.add.image(W / 2, y + o.image.h / 2, o.image.key).setDisplaySize(o.image.w, o.image.h)); y += imgH; }
  for (const t of texts) { t.setY(y); root.add(t); y += t.height + 4; }
  root.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
  let closed = false;
  const close = (cb?: () => void) => {
    if (closed) return; closed = true;
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => { root.destroy(); cb?.(); done(); } });
  };
  if (o.buttons?.length) {
    const bw = Math.min(130, (w - 30) / o.buttons.length - 8);
    o.buttons.forEach((b, i) => {
      const bx = W / 2 + (i - (o.buttons!.length - 1) / 2) * (bw + 10);
      root.add(button(scene, bx, top + h - 30, bw, 34, b.label, () => close(b.cb), b.color ?? 0x3a86ff));
    });
  } else dim.on('pointerdown', () => close());
  if (o.autoCloseMs) scene.time.delayedCall(o.autoCloseMs, () => close());
  return { close };
}

export interface LedgerOpts {
  title: string; total: number; totalNote?: string; sub?: string;
  rows: { label: string; amount: number }[];
  news?: string[]; foot?: string[];
  buttons: { label: string; cb?: () => void; color?: number }[];
}
/** 명세서·정산서: 맨 위 큰 합계 → 한 줄 한 정보(큰 금액 위) → 작은 신문 상자 → 작은 글씨. 낙서풍 테두리 유지 */
export function showLedger(scene: Phaser.Scene, o: LedgerOpts, fmt: (n: number) => string, done: () => void) {
  const w = 320, ink = '#222222', dim = '#777777';
  const rows = [...o.rows].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const parts: Phaser.GameObjects.GameObject[] = [];
  const title = txt(scene, W / 2, 0, o.title, 15, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0);
  const total = txt(scene, W / 2, 0, `+${fmt(o.total)}원`, 28, '#b5651d', { fontStyle: 'bold' }).setOrigin(0.5, 0);
  const note = o.totalNote ? txt(scene, W / 2, 0, o.totalNote, 11, dim).setOrigin(0.5, 0) : null;
  const sub = o.sub ? txt(scene, W / 2, 0, o.sub, 11, dim).setOrigin(0.5, 0) : null;
  const rowObjs = rows.map((r) => [txt(scene, W / 2 - w / 2 + 24, 0, r.label, 13, ink), txt(scene, W / 2 + w / 2 - 24, 0, `+${fmt(r.amount)}`, 13, ink, { fontStyle: 'bold' }).setOrigin(1, 0)] as const);
  const newsObjs = (o.news ?? []).slice(0, 3).map((n) => txt(scene, W / 2 - w / 2 + 34, 0, `· ${n}`, 10, '#333', { wordWrap: { width: w - 70 } }));
  const footObjs = (o.foot ?? []).map((f) => txt(scene, W / 2, 0, f, 10, dim, { align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5, 0));
  const newsH = newsObjs.length ? 24 + newsObjs.reduce((a, t) => a + t.height + 2, 0) + 8 : 0;
  const h = 18 + title.height + 6 + total.height + (note ? note.height : 0) + (sub ? sub.height + 4 : 0) + 10 + rows.length * 22 + (newsH ? newsH + 8 : 0)
    + footObjs.reduce((a, t) => a + t.height + 2, 0) + 58;
  const { root, top } = cardBase(scene, w, Math.min(610, h), true);
  let y = top + 16;
  title.setY(y); y += title.height + 6;
  total.setY(y); y += total.height;
  if (note) { note.setY(y); y += note.height; }
  if (sub) { sub.setY(y + 2); y += sub.height + 4; }
  const g = scene.add.graphics();
  g.lineStyle(1, 0x999999, 0.6).lineBetween(W / 2 - w / 2 + 20, y + 4, W / 2 + w / 2 - 20, y + 4);
  y += 10;
  for (const [l, r] of rowObjs) { l.setY(y); r.setY(y); y += 22; }
  parts.push(g, title, total, ...(note ? [note] : []), ...(sub ? [sub] : []), ...rowObjs.flat());
  if (newsObjs.length) {
    // 작은 신문: 회색 종이 + 제호
    y += 6;
    const paper = scene.add.rectangle(W / 2, y + newsH / 2, w - 40, newsH, 0xeeeae0).setStrokeStyle(1, 0x999999);
    const head = txt(scene, W / 2, y + 4, '📰 동네 신문 · 부재중 소식', 10, '#333', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    parts.push(paper, head);
    let ny = y + 22;
    for (const t of newsObjs) { t.setY(ny); ny += t.height + 2; parts.push(t); }
    y += newsH + 6;
  }
  for (const f of footObjs) { f.setY(y); y += f.height + 2; parts.push(f); }
  root.add(parts);
  root.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
  let closed = false;
  const bw = Math.min(130, (w - 30) / o.buttons.length - 8);
  const hh = Math.min(610, h);
  o.buttons.forEach((b, i) => {
    const bx = W / 2 + (i - (o.buttons.length - 1) / 2) * (bw + 10);
    root.add(button(scene, bx, top + hh - 28, bw, 34, b.label, () => {
      if (closed) return; closed = true;
      scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => { root.destroy(); b.cb?.(); done(); } });
    }, b.color ?? 0x3a86ff));
  });
}
