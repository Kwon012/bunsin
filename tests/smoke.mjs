// 헤드리스 스모크: 부팅 → 도입 → 첫 탭 → 고용 → 월급날(디버그) → 오류 없음. 사용: node tests/smoke.mjs [shotDir]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const shotDir = process.argv[2];
const url = pathToFileURL(path.resolve('dist/index.html')).href + '?debug=1';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: false });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.stack || e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url);
await p.waitForTimeout(1500);
const box = await p.locator('canvas').boundingBox();
const at = (x, y) => [box.x + (x / 360) * box.width, box.y + (y / 640) * box.height];
const click = async (x, y) => { const [cx, cy] = at(x, y); await p.mouse.click(cx, cy); };
const state = () => p.evaluate(() => { const s = window.__bunsin.G.s; return { money: s.money, hired: s.totalHired, paydays: s.paydayCount, intro: s.flags.introDone, reveal: s.flags.villageRevealed, q: window.__bunsin.game.scene.getScene('UI').queue.length }; });
const press = (label) => p.evaluate((label) => {
  const ui = window.__bunsin.game.scene.getScene('UI');
  const all = []; const walk = (o) => { all.push(o); (o.list || []).forEach(walk); }; ui.children.list.forEach(walk);
  const b = all.reverse().find((o) => o.label && o.label.text === label && o.visible !== false);
  if (b) b.emit('pointerdown'); return !!b;
}, label);
const step = async (name) => { const st = await state(); console.log(name, JSON.stringify(st)); if (shotDir) await p.screenshot({ path: `${shotDir}/${name}.png` }); };
await step('boot');
for (let i = 0; i < 3; i++) { await click(180, 320); await p.waitForTimeout(400); }
await p.waitForTimeout(6500);
await step('after_intro');
for (let i = 0; i < 14; i++) { await click(180, 300); await p.waitForTimeout(60); }
await step('after_taps');
await click(236, 567); // 추천 고용
await p.waitForTimeout(600);
await step('after_hire');
// 디버그로 돈을 늘리고 연속 고용 → 마을 공개
await p.evaluate(() => { window.__bunsin.G.s.money = 5000; });
for (let i = 0; i < 16; i++) { await click(236, 567); await p.waitForTimeout(120); }
await p.waitForTimeout(4500);
await step('after_reveal');
await step('photo');
console.log('press 앨범', await press('앨범에 저장됨'));
await p.waitForTimeout(800);
await p.evaluate(() => { window.__bunsin.G.s.paydayIn = 0.5; });
await p.waitForTimeout(4200);
await step('payday');
console.log('press 받기', await press('받기'));
await p.waitForTimeout(800);
await p.evaluate(() => { const G = window.__bunsin.G; G.s.lastSeen -= 8 * 3600e3; });
await p.waitForTimeout(300);
await step('pre_end');
await p.evaluate(() => { const G = window.__bunsin.G; G.s.lastSeen = Date.now() - 8 * 3600e3; document.dispatchEvent(new Event('visibilitychange')); });
await p.waitForTimeout(800);
await step('settle');
console.log('press 받기', await press('받기'));
await p.waitForTimeout(600);
await step('end');
// 팀 보너스(25명)·해금·자격증·피버
await p.evaluate(() => { const G = window.__bunsin.G; G.s.money = 1e6; });
await press('▲ 전체'); await p.waitForTimeout(300);
await step('sheet_open');
await press('×1'); await press('×10'); // → 최대
for (let i = 0; i < 2; i++) { await p.evaluate(() => { const ui = window.__bunsin.game.scene.getScene('UI'); ui.sheet.refresh(); }); }
await p.evaluate(() => { const b = window.__bunsin; const { G } = b; const ui = b.game.scene.getScene('UI'); ui.sheet.buyRecommended(); });
await p.waitForTimeout(1200);
await step('team');
for (let k = 0; k < 6; k++) { await press('앨범에 저장됨'); await p.waitForTimeout(700); }
await p.evaluate(() => { window.__bunsin.G.s.money = 1e9; });
await p.waitForTimeout(400);
const certOk = await p.evaluate(() => { const ui = window.__bunsin.game.scene.getScene('UI'); const all = []; const walk = (o) => { all.push(o); (o.list || []).forEach(walk); }; ui.children.list.forEach(walk); return all.filter((o) => o.label && o.label.text && o.label.text.startsWith('자격증')).length; });
console.log('cert buttons', certOk);
await press('▼ 접기'); await p.waitForTimeout(300);
for (let i = 0; i < 32; i++) { await click(180, 300); await p.waitForTimeout(40); }
await p.waitForTimeout(500);
console.log('fever', await p.evaluate(() => window.__bunsin.G.s.feverLeft > 0));
await step('fever');
await p.waitForTimeout(16000);
await step('after_fever');
console.log('ERRORS', errs.length ? errs.slice(0, 5).join('\n---\n') : 'none');
await b.close();
process.exit(errs.length ? 1 : 0);
