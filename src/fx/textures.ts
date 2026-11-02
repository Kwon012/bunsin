// 코드로 만든 텍스처(이미지 파일 없음). 해상도 R배로 그리고 스프라이트는 1/R로 축소해 쓴다.
import Phaser from 'phaser';
import { R, TIER_COLOR } from '../ui/kit';
import { TIERS } from '../data/economy';

export const SKIN = 0xffd7b5;
export type Expr = 'default' | 'work' | 'cheer';

function face(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, expr: Expr) {
  g.fillStyle(SKIN, 1).fillCircle(cx, cy, r);
  g.lineStyle(Math.max(1, r * 0.06), 0x3b2a20, 1).strokeCircle(cx, cy, r);
  // 앞머리(같은 얼굴 식별용)
  g.fillStyle(0x3b2a20, 1).fillEllipse(cx - r * 0.2, cy - r * 0.78, r * 1.3, r * 0.45);
  const ex = r * 0.36, ey = cy - r * 0.05, er = Math.max(1, r * 0.1);
  g.fillStyle(0x222222, 1);
  if (expr === 'work') {
    g.lineStyle(Math.max(1, r * 0.08), 0x222222, 1);
    g.lineBetween(cx - ex - er, ey - er, cx - ex + er, ey + er * 0.3); g.lineBetween(cx - ex - er, ey + er * 1.3, cx - ex + er, ey + er * 0.3);
    g.lineBetween(cx + ex + er, ey - er, cx + ex - er, ey + er * 0.3); g.lineBetween(cx + ex + er, ey + er * 1.3, cx + ex - er, ey + er * 0.3);
    g.fillStyle(0x66ccff, 1).fillCircle(cx + r * 0.75, cy - r * 0.35, r * 0.1);
  } else {
    g.fillCircle(cx - ex, ey, er); g.fillCircle(cx + ex, ey, er);
  }
  if (expr === 'cheer') {
    g.fillStyle(0x8b2c2c, 1).fillEllipse(cx, cy + r * 0.42, r * 0.5, r * 0.36);
  } else if (expr === 'default' && r > 12) {
    g.lineStyle(Math.max(1, r * 0.06), 0x222222, 1);
    g.beginPath(); g.arc(cx, cy + r * 0.2, r * 0.25, 0.2 * Math.PI, 0.8 * Math.PI); g.strokePath();
  }
}

export function makeTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 본체 얼굴 3종
  for (const e of ['default', 'work', 'cheer'] as Expr[]) {
    g.clear(); face(g, 40 * R, 40 * R, 38 * R, e); g.generateTexture(`face_${e}`, 80 * R, 80 * R);
  }
  // 분신(등급 색 몸통 + 같은 얼굴)
  for (const t of TIERS) {
    g.clear();
    g.fillStyle(TIER_COLOR[t], 1).fillRoundedRect(2 * R, 10 * R, 12 * R, 11 * R, 3 * R);
    face(g, 8 * R, 7 * R, 6 * R, 'default');
    g.generateTexture(`clone_${t}`, 16 * R, 22 * R);
  }
  // 실루엣 점(인파)
  g.clear(); g.fillStyle(0xffffff, 1).fillCircle(3 * R, 3 * R, 3 * R); g.generateTexture('dot', 6 * R, 6 * R);
  // 월급봉투
  g.clear(); g.fillStyle(0xf4e4c1, 1).fillRect(0, 0, 14 * R, 9 * R);
  g.lineStyle(R, 0xb08850, 1).strokeRect(0, 0, 14 * R, 9 * R).lineBetween(0, 0, 7 * R, 5 * R).lineBetween(14 * R, 0, 7 * R, 5 * R);
  g.generateTexture('envelope', 14 * R, 9 * R);
  // 동전
  g.clear(); g.fillStyle(0xffd166, 1).fillCircle(4 * R, 4 * R, 4 * R); g.lineStyle(R * 0.6, 0xb8860b, 1).strokeCircle(4 * R, 4 * R, 3.4 * R);
  g.generateTexture('coin', 8 * R, 8 * R);
  // 왕관
  g.clear(); g.fillStyle(0xffd700, 1).fillTriangle(0, 6 * R, 3 * R, 0, 5 * R, 6 * R).fillTriangle(4 * R, 6 * R, 7 * R, 0, 10 * R, 6 * R).fillRect(0, 5 * R, 10 * R, 3 * R);
  g.generateTexture('crown', 10 * R, 8 * R);
  g.destroy();
}
