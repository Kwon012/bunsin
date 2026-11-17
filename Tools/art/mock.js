// 화면 구성 시안(HTML로 근사). Unity 실행 화면이 아니다. 실행: node Tools/art/mock.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const { list } = require(root + '/Tools/art/sprites.js');
const sp = {}; for (const it of list) sp[it.name] = 'data:image/svg+xml;base64,' + Buffer.from(it.svg).toString('base64');
const font = 'data:font/ttf;base64,' + fs.readFileSync(root + '/Assets/_Project/Resources/Fonts/Jua-Regular.ttf').toString('base64');
const img = (n, x, y, w, h, extra = '') => `<img src="${sp[n]}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:contain;${extra}">`;
const css = `@font-face{font-family:Jua;src:url(${font})} *{box-sizing:border-box} body{margin:0;font-family:Jua;color:#3A2E39}
.s{position:relative;flex:none;width:1080px;height:1920px;overflow:hidden;background:#FFF4DC}
.card{position:absolute;background:#fff;border:6px solid #3A2E39;border-radius:28px;box-shadow:0 10px 0 rgba(58,46,57,.25)}
.pill{position:absolute;border-radius:999px;display:flex;align-items:center;justify-content:center}
.t{position:absolute;white-space:nowrap}`;
function hud(title) {
  return `<div class="card" style="left:20px;top:12px;width:1040px;height:214px">
   <div class="pill" style="left:26px;top:18px;width:330px;height:56px;background:#FFE9BF;justify-content:flex-start;padding-left:70px;font-size:30px">반지하 세입자</div>${img('i_house',36,24,46,46)}
   ${img('i_networth',26,104,84,84)}<div class="t" style="left:120px;top:96px;font-size:26px;color:#7A7180">순자산</div>
   <div class="t" style="left:118px;top:120px;font-size:66px">${title}</div>
   <div class="t" style="right:24px;top:18px;font-size:26px;color:#7A7180;right:120px">월 수입</div>
   <div class="t" style="right:26px;top:52px;font-size:40px;color:#2BB673">1.97억원</div>
   ${img('i_payday',640,140,54,54)}<div class="pill" style="left:702px;top:148px;width:316px;height:40px;background:#FFE9BF;font-size:28px;overflow:hidden"><div style="position:absolute;left:4px;top:4px;bottom:4px;width:60%;border-radius:99px;background:#FF6B5E"></div><span style="position:relative">월급날 03:58</span></div>
  </div>
  <div class="card" style="left:20px;top:236px;width:1040px;height:112px">
   <div style="position:absolute;left:8px;top:8px;bottom:14px;width:62%;border-radius:99px;background:rgba(255,197,61,.35)"></div>
   ${img('i_up',22,20,64,64)}<div class="t" style="left:100px;top:12px;font-size:34px">3호 배달 라이더 승진</div><div class="t" style="left:100px;top:56px;font-size:26px;color:#7A7180">42초 뒤</div>
   <div class="t" style="right:28px;top:16px;font-size:30px;text-align:right;line-height:1">현금<br>1,427만</div></div>`;
}
function tabs(sel) {
  const names = ['홈', '마을', '분신', '자산', '상점'], icons = ['i_home', 'i_village', 'i_clone', 'i_asset', 'i_shop'];
  let s = `<div class="card" style="left:12px;bottom:10px;width:1056px;height:166px">`;
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 206;
    s += (i === sel ? `<div class="pill" style="left:${x}px;top:10px;width:196px;height:134px;background:#FFC53D;border-radius:40px"></div>` : '') +
      img(icons[i], x + 56, 12, 84, 84) + `<div class="t" style="left:${x}px;top:98px;width:196px;text-align:center;font-size:28px">${names[i]}</div>`;
  }
  return s + '</div>';
}
const home = `<div class="s">${hud('1,427만원')}
 <div style="position:absolute;left:0;top:372px;width:1080px;height:1372px">
  <div style="position:absolute;inset:0 0 34% 0;background:#B9C3CF"></div><div style="position:absolute;left:0;right:0;bottom:0;height:34%;background:#8C8A93"></div>
  <div class="t" style="left:30px;top:16px;font-size:28px;color:#7A7180">반지하 월세방 · 창문으로 발만 보인다</div>
  ${img('o_window_low', 520, 40, 420, 200)}
  ${img('o_box', 840, 760, 180, 150)}
  ${img('clone_alba',330,850,130,156)}${img('clone_alba',90,880,130,156,'transform:scaleX(-1)')}${img('clone_job',780,860,130,156)}${img('clone_alba',900,830,130,156,'transform:scaleX(-1)')}
  ${img('ui_shadow',410,1050,360,70)}${img('hero_work',360,500,470,564)}
  ${img('o_mirror',42,560,240,340)}<div class="pill" style="left:32px;top:896px;width:260px;height:76px;background:#FFC53D;border:6px solid #3A2E39;font-size:30px">1.15만</div>
  <div class="t" style="left:12px;top:976px;width:300px;text-align:center;font-size:24px">신입 분신 고용</div>${img('i_apt_job',232,550,70,70)}
  <div class="pill" style="left:40px;top:1110px;width:1000px;height:64px;background:rgba(58,46,57,.25);overflow:hidden"><div style="position:absolute;left:6px;top:6px;bottom:6px;width:45%;border-radius:99px;background:#FF6B5E"></div><span style="position:relative;color:#fff;font-size:30px;-webkit-text-stroke:1px #3A2E39">연타해서 응원 게이지를 채우세요</span></div>${img('i_megaphone',20,1102,80,80)}
  <div class="card" style="left:30px;top:1192px;width:1020px;height:160px;background:#FFC53D"><div class="t" style="left:140px;top:22px;font-size:38px">추천: 신입 분신 고용</div><div class="t" style="left:140px;top:78px;font-size:28px">1.15만원 · 지금 가능</div></div>${img('i_clone',56,1218,100,100)}
  <div class="t" style="left:420px;top:430px;font-size:44px;color:#FFC53D;-webkit-text-stroke:2px #3A2E39">+4,380</div>
 </div>${tabs(0)}</div>`;
const chip = (apt, lv, up) => `<div style="position:relative;width:140px;height:180px;display:inline-block;margin-right:8px">
  <div style="position:absolute;left:4px;right:4px;top:0;bottom:34px;border-radius:22px;background:${['#B9E3F4', '#C9EABF', '#FFCFA2', '#D7CAFC'][apt]}"></div>${img('head', 12, 6, 116, 116)}
  <div style="position:absolute;left:14px;right:14px;bottom:42px;height:12px;border-radius:9px;background:rgba(58,46,57,.2)"><div style="width:${up ? 100 : 55}%;height:100%;border-radius:9px;background:${up ? '#2BB673' : '#FFC53D'}"></div></div>
  <div class="pill" style="left:2px;right:2px;bottom:0;height:40px;background:#3A2E39;color:#fff;font-size:26px;position:absolute">Lv.${lv}</div>${up ? img('i_up', 96, -4, 46, 46) : ''}</div>`;
const wp = (y, slot, name, b, color, chips, status) => `<div class="card" style="left:24px;top:${y}px;width:1032px;height:360px">
  <div class="pill" style="left:18px;top:16px;width:990px;height:64px;background:${color};justify-content:flex-start;padding-left:24px;font-size:34px">${slot}칸 · ${name}<span style="position:absolute;right:22px;font-size:28px">초당 2.1만</span></div>
  ${img(b, 14, 96, 230, 230)}<div class="pill" style="left:44px;top:300px;width:170px;height:44px;background:#3A2E39;color:#fff;font-size:26px">시설 3단계</div>
  <div style="position:absolute;left:254px;top:96px">${chips}</div><div class="t" style="left:254px;top:290px;font-size:28px;color:${status.c || '#7A7180'}">${status.t}</div></div>`;
const village = `<div class="s" style="background:linear-gradient(#CFEFFF,#FFF4DC)">${hud('3.21억원')}
 <div style="position:absolute;left:-100px;right:-100px;bottom:0;height:40%;background:#9ED8A0;border-radius:50% 50% 0 0"></div>
 <div class="card" style="left:20px;top:372px;width:1040px;height:130px">${img('i_news',20,26,70,70)}<div class="t" style="left:104px;top:12px;font-size:28px;color:#7A7180">우리 동네 · 생계·골목 장사</div><div class="t" style="left:104px;top:56px;font-size:32px">편의점 점주 "알바생이 다 똑같이 생겼는데 일은 잘해"</div><div class="t" style="right:24px;top:12px;font-size:26px;color:#7A7180">숨은 장면 2/6</div></div>
 <div class="card" style="left:24px;top:526px;width:1032px;height:200px;background:rgba(255,255,255,.6)">${img('b_cafe',20,10,210,180,'opacity:.35;filter:brightness(0)')}${img('i_lock',90,64,64,64)}<div class="t" style="left:250px;top:40px;font-size:36px;color:#7A7180">다음 일터: 카페 알바</div><div class="t" style="left:250px;top:100px;font-size:28px;color:#7A7180">배달 라이더 5칸이 차면 개업</div></div>
 ${wp(750, 2, '배달 라이더', 'b_delivery', '#B9E3F4', chip(1, 12, 0) + chip(0, 10, 0) + chip(3, 11, 0), { t: '2호: Lv.20이면 승진 · 약 3분 20초' })}
 ${img('o_cat', 700, 1124, 110, 100)}
 ${wp(1240, 1, '편의점 알바', 'b_store', '#B9E3F4', chip(0, 10, 1) + chip(2, 9, 0) + chip(1, 8, 0) + chip(3, 6, 0) + chip(0, 3, 0), { t: '1호: 승진 가능', c: '#2BB673' })}
 ${tabs(1)}</div>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1920 } });
  await p.setContent(`<html><head><style>${css}</style></head><body style="background:#3A2E39;padding:0;width:2200px;display:flex;gap:40px">${home}${village}</body></html>`);
  await p.waitForTimeout(500);
  const out = path.join(root, 'docs', 'previews');
  fs.mkdirSync(out, { recursive: true });
  await p.screenshot({ path: out + '/mock_home_village.png', clip: { x: 0, y: 0, width: 2200, height: 1920 } });
  await b.close();
})();
