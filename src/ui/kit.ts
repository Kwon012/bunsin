// UI 공통: 해상도, 폰트, 색, 텍스트·버튼·카드 헬퍼
import Phaser from 'phaser';
import type { Tier } from '../data/economy';

export const W = 360;
export const H = 640;
export const R = Math.min(3, Math.max(2, Math.round(typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)));
export const FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
export const TIER_COLOR: Record<Tier, number> = { alba: 0x4cc9f0, job: 0x80ed99, biz: 0xffd166, inv: 0xc77dff };
export const TIER_CSS: Record<Tier, string> = { alba: '#4cc9f0', job: '#80ed99', biz: '#ffd166', inv: '#c77dff' };
export const C = { bg: 0x1d1f2b, panel: 0x2a2d3e, panel2: 0x353950, text: '#ffffff', dim: '#a0a4c0', gold: '#ffd166', green: '#06d6a0', red: '#ef476f', line: 0x4a4f6a };

export const ui = { fontScale: 1 };

export function setupCam(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(R).centerOn(W / 2, H / 2);
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 14, color = C.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${Math.round(size * ui.fontScale)}px`, color, resolution: R, ...extra });
}

/** 낙서풍 테두리 사각형(약간 흔들린 선) */
export function doodleRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color = 0xffffff, width = 2, seed = 1) {
  let r = seed;
  const j = () => { r = (r * 9301 + 49297) % 233280; return (r / 233280 - 0.5) * 3; };
  g.lineStyle(width, color, 1);
  const pts: [number, number][] = [];
  const seg = 8;
  for (let i = 0; i <= seg; i++) pts.push([x + (w * i) / seg + j(), y + j()]);
  for (let i = 1; i <= seg; i++) pts.push([x + w + j(), y + (h * i) / seg + j()]);
  for (let i = 1; i <= seg; i++) pts.push([x + w - (w * i) / seg + j(), y + h + j()]);
  for (let i = 1; i <= seg; i++) pts.push([x + j(), y + h - (h * i) / seg + j()]);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.strokePath();
}

export interface Btn extends Phaser.GameObjects.Container {
  label: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle;
  setEnabled(on: boolean): Btn; setLabel(s: string): Btn;
}
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, color = 0x3a86ff, size = 13): Btn {
  const c = scene.add.container(x, y) as Btn;
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(1, 0xffffff, 0.25).setOrigin(0.5);
  const t = txt(scene, 0, 0, label, size, '#ffffff', { align: 'center' }).setOrigin(0.5);
  c.add([bg, t]);
  c.label = t; c.bg = bg;
  c.setSize(w, h);
  let enabled = true;
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    if (!enabled) return;
    scene.tweens.add({ targets: c, scale: 0.93, duration: 60, yoyo: true });
    onClick();
  });
  c.setEnabled = (on: boolean) => { enabled = on; bg.setAlpha(on ? 1 : 0.35); t.setAlpha(on ? 1 : 0.6); return c; };
  c.setLabel = (s: string) => { if (t.text !== s) t.setText(s); return c; };
  return c;
}

/** 전체 화면을 막는 반투명 배경 + 카드 컨테이너 */
export function cardBase(scene: Phaser.Scene, w: number, h: number, doodle = false, cy = H / 2) {
  const root = scene.add.container(0, 0).setDepth(1000);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(doodle ? 0xfffbea : C.panel, 1);
  g.fillRoundedRect(W / 2 - w / 2, cy - h / 2, w, h, 10);
  if (doodle) doodleRect(g, W / 2 - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8, 0x222222, 2, Math.floor(Math.random() * 1000));
  root.add([dim, g]);
  return { root, top: cy - h / 2, left: W / 2 - w / 2, dim };
}
