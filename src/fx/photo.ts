// 사진: renderer.snapshot을 작게 줄여 앨범(최대 30장)에 저장. 공유(Web Share / 이미지 저장).
import Phaser from 'phaser';

export interface Photo { id: string; caption: string; at: number; data: string }
const KEY = 'bunsin_album_v1';
const MAX = 30;
let mem: Photo[] | null = null;

export function album(): Photo[] {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { mem = []; }
  return mem!;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(album())); } catch { /* 메모리만 */ } }

/** 현재 화면을 찍어 앨범에 저장하고 dataURL을 돌려준다 */
export function takePhoto(game: Phaser.Game, caption: string, cb?: (p: Photo) => void) {
  game.renderer.snapshot((img) => {
    const el = img as HTMLImageElement;
    const tw = 180, th = 320;
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, th - 26, tw, 26);
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(caption.slice(0, 26), 6, th - 9);
    let data = '';
    try { data = cv.toDataURL('image/jpeg', 0.6); } catch { return; }
    const p: Photo = { id: `p${Date.now()}`, caption, at: Date.now(), data };
    const a = album(); a.push(p); while (a.length > MAX) a.shift();
    persist();
    cb?.(p);
  });
}

/** 공유: Web Share(파일) → 안 되면 이미지 다운로드 */
export async function sharePhoto(p: Photo, text: string) {
  try {
    const blob = await (await fetch(p.data)).blob();
    const file = new File([blob], 'bunsin.jpg', { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); return; }
  } catch { /* 다운로드로 */ }
  const a = document.createElement('a'); a.href = p.data; a.download = 'bunsin.jpg'; a.click();
}

/** dataURL을 Phaser 텍스처로 */
export function photoTexture(scene: Phaser.Scene, p: Photo, done: (key: string) => void) {
  const key = `photo_${p.id}`;
  if (scene.textures.exists(key)) { done(key); return; }
  const img = new Image();
  img.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, img); done(key); };
  img.src = p.data;
}
