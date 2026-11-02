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
