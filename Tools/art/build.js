// 스프라이트 아틀라스 빌드: SVG → (Chromium 렌더) → atlas_0.png + atlas.csv
// 실행: node Tools/art/build.js   (playwright 필요)
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { list } = require('./sprites');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'Assets', '_Project', 'Resources', 'Art');
const PREVIEW = path.join(ROOT, 'Tools', '_out');
const SIZE = 2048, PAD = 4;

function pack(items) {
  const sorted = items.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  const pages = [];
  let page = { rects: [], x: PAD, y: PAD, rowH: 0 };
  for (const it of sorted) {
    if (page.x + it.w + PAD > SIZE) { page.x = PAD; page.y += page.rowH + PAD; page.rowH = 0; }
    if (page.y + it.h + PAD > SIZE) { pages.push(page); page = { rects: [], x: PAD, y: PAD, rowH: 0 }; }
    page.rects.push({ it, x: page.x, y: page.y });
    page.x += it.w + PAD;
    page.rowH = Math.max(page.rowH, it.h);
  }
  pages.push(page);
  return pages;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });
  const names = new Set();
  for (const it of list) { if (names.has(it.name)) throw new Error('중복 이름: ' + it.name); names.add(it.name); }
  const pages = pack(list);
  const browser = await chromium.launch();
  const rows = ['name,page,x,y,w,h,pivot_x,pivot_y,border_l,border_b,border_r,border_t'];
  for (let p = 0; p < pages.length; p++) {
    const imgs = pages[p].rects.map(r =>
      `<img style="position:absolute;left:${r.x}px;top:${r.y}px;width:${r.it.w}px;height:${r.it.h}px" src="data:image/svg+xml;base64,${Buffer.from(r.it.svg).toString('base64')}">`).join('');
    const html = `<html><body style="margin:0;background:transparent"><div id="a" style="position:relative;width:${SIZE}px;height:${SIZE}px">${imgs}</div></body></html>`;
    const pg = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    await pg.setContent(html);
    await pg.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
    await pg.locator('#a').screenshot({ path: path.join(OUT, `atlas_${p}.png`), omitBackground: true });
    // 확인용 미리보기(크림색 바탕)
    await pg.evaluate(() => { document.body.style.background = '#FFF4DC'; });
    await pg.locator('#a').screenshot({ path: path.join(PREVIEW, `atlas_preview_${p}.png`) });
    await pg.close();
    for (const r of pages[p].rects) {
      const it = r.it;
      // Unity 좌표는 아래에서 위로: y를 뒤집어 적는다
      rows.push([it.name, p, r.x, SIZE - r.y - it.h, it.w, it.h, it.pivotX ?? 0.5, it.pivotY ?? 0.5, it.bl || 0, it.bb || 0, it.br || 0, it.bt || 0].join(','));
    }
  }
  await browser.close();
  rows.sort((a, b) => (a.startsWith('name,') ? -1 : b.startsWith('name,') ? 1 : a.localeCompare(b)));
  fs.writeFileSync(path.join(OUT, 'atlas.csv'), rows.join('\n') + '\n');
  console.log(`sprites: ${list.length}, pages: ${pages.length}`);
})().catch(e => { console.error(e); process.exit(1); });
