// 스프라이트 정의(SVG). 아트 바이블: 치비 2D 플랫 + 굵은 낙서풍 외곽선, 전원 같은 얼굴, 순수한 검정 없음.
// 실행: node Tools/art/build.js  →  Assets/_Project/Resources/Art/atlas_*.png + atlas.csv
// 색을 바꿀 때는 아래 P(팔레트)만 고친다. Unity 쪽 Palette.cs와 같은 값이어야 한다.
'use strict';

const P = {
  ink: '#3A2E39', paper: '#FFF4DC', cream: '#FFE9BF', white: '#FFFFFF',
  yellow: '#FFC53D', orange: '#FF9F45', coral: '#FF6B5E', green: '#2BB673', mint: '#9ED8A0',
  sky: '#6EC5E9', blue: '#4A90D9', purple: '#A78BFA', pink: '#FF8FAB',
  skin: '#FFD9B8', skinShade: '#F4BE98', hair: '#4A3B47', blush: '#FF9E9E',
  wood: '#B98B5E', woodDark: '#8C6239', gray: '#B9B2BD', grayDark: '#7A7180', shadow: '#5B4B6B',
};
const TIER = { alba: P.sky, job: '#8BD17C', biz: P.orange, inv: P.purple };
const SW = 6; // 기본 외곽선 두께(160px 캔버스 기준)

const o = (w = SW) => `stroke="${P.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, body, vb) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb || `0 0 ${w} ${h}`}">${body}</svg>`;

// ------------------------------------------------------------------ 사람(본체·분신): 200×240 좌표계
function person({ outfit = 'tee', face = 'idle', arms = 'down', prop = '' }) {
  const body = [];
  // 다리
  body.push(`<rect x="76" y="196" width="18" height="30" rx="8" fill="${P.ink}"/><rect x="106" y="196" width="18" height="30" rx="8" fill="${P.ink}"/>`);
  body.push(`<ellipse cx="82" cy="228" rx="16" ry="8" fill="${P.ink}"/><ellipse cx="118" cy="228" rx="16" ry="8" fill="${P.ink}"/>`);
  // 팔(뒤)
  const armCol = outfit === 'inv' ? '#4B3F72' : outfit === 'job' ? P.white : outfit === 'tee' ? P.yellow : outfit === 'alba' ? P.white : P.white;
  if (arms === 'down') {
    body.push(`<path d="M62 150 Q46 168 52 190" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M62 150 Q46 168 52 190" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<path d="M138 150 Q154 168 148 190" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M138 150 Q154 168 148 190" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<circle cx="52" cy="192" r="9" fill="${P.skin}" ${o(5)}/><circle cx="148" cy="192" r="9" fill="${P.skin}" ${o(5)}/>`);
  } else if (arms === 'up') {
    body.push(`<path d="M62 152 Q36 136 34 108" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M62 152 Q36 136 34 108" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<path d="M138 152 Q164 136 166 108" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M138 152 Q164 136 166 108" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<circle cx="34" cy="104" r="10" fill="${P.skin}" ${o(5)}/><circle cx="166" cy="104" r="10" fill="${P.skin}" ${o(5)}/>`);
  } else if (arms === 'work') {
    body.push(`<path d="M62 152 Q44 160 40 176" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M62 152 Q44 160 40 176" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<path d="M138 152 Q168 150 172 128" fill="none" stroke="${P.ink}" stroke-width="22" stroke-linecap="round"/><path d="M138 152 Q168 150 172 128" fill="none" stroke="${armCol}" stroke-width="12" stroke-linecap="round"/>`);
    body.push(`<circle cx="40" cy="178" r="10" fill="${P.skin}" ${o(5)}/><circle cx="172" cy="124" r="10" fill="${P.skin}" ${o(5)}/>`);
  }
  // 몸통
  const torso = `M64 140 Q64 128 100 128 Q136 128 136 140 L140 200 Q100 212 60 200 Z`;
  const fills = { tee: P.yellow, alba: P.white, job: P.white, biz: P.white, inv: '#4B3F72', new: P.white };
  body.push(`<path d="${torso}" fill="${fills[outfit] || P.white}" ${o()}/>`);
  if (outfit === 'alba') {
    body.push(`<path d="M64 140 Q64 130 84 128 L80 204 Q68 202 60 200 Z" fill="${TIER.alba}" ${o(5)}/><path d="M136 140 Q136 130 116 128 L120 204 Q132 202 140 200 Z" fill="${TIER.alba}" ${o(5)}/>`);
    body.push(`<rect x="110" y="150" width="18" height="12" rx="3" fill="${P.white}" ${o(4)}/>`);
  } else if (outfit === 'job') {
    body.push(`<path d="M100 132 L92 146 L100 190 L108 146 Z" fill="${TIER.job}" ${o(5)}/><path d="M84 128 L100 142 L116 128" fill="none" ${o(5)}/>`);
    body.push(`<path d="M116 136 L122 162" fill="none" ${o(3)}/><rect x="112" y="160" width="20" height="26" rx="4" fill="${P.sky}" ${o(4)}/>`);
  } else if (outfit === 'biz') {
    body.push(`<path d="M78 136 L122 136 L128 204 Q100 210 72 204 Z" fill="${TIER.biz}" ${o(5)}/><path d="M84 136 Q100 118 116 136" fill="none" ${o(5)}/>`);
    body.push(`<rect x="88" y="164" width="24" height="18" rx="4" fill="${P.cream}" ${o(4)}/><rect x="104" y="142" width="20" height="10" rx="3" fill="${P.yellow}" ${o(3)}/>`);
  } else if (outfit === 'inv') {
    body.push(`<path d="M100 132 L84 128 L94 170 Z" fill="${P.white}" ${o(4)}/><path d="M100 132 L116 128 L106 170 Z" fill="${P.white}" ${o(4)}/>`);
    body.push(`<path d="M100 134 L95 146 L100 176 L105 146 Z" fill="${TIER.inv}" ${o(4)}/>`);
  } else if (outfit === 'tee') {
    body.push(`<path d="M84 130 Q100 144 116 130" fill="none" ${o(5)}/><circle cx="100" cy="170" r="12" fill="${P.white}" ${o(4)}/><path d="M94 170 h12 M100 164 v12" ${o(4)} fill="none"/>`);
  }
  // 머리
  body.push(`<ellipse cx="100" cy="78" rx="62" ry="58" fill="${P.skin}" ${o()}/>`);
  body.push(`<path d="M40 74 Q36 22 100 18 Q164 22 160 74 Q150 44 122 46 Q112 60 96 44 Q70 40 52 58 Q44 64 40 74 Z" fill="${P.hair}" ${o()}/>`);
  body.push(`<path d="M96 20 Q104 2 118 10" fill="none" stroke="${P.hair}" stroke-width="9" stroke-linecap="round"/>`);
  body.push(`<ellipse cx="40" cy="84" rx="9" ry="12" fill="${P.skin}" ${o(5)}/><ellipse cx="160" cy="84" rx="9" ry="12" fill="${P.skin}" ${o(5)}/>`);
  body.push(`<ellipse cx="66" cy="100" rx="12" ry="8" fill="${P.blush}" opacity="0.75"/><ellipse cx="134" cy="100" rx="12" ry="8" fill="${P.blush}" opacity="0.75"/>`);
  // 얼굴
  if (outfit === 'inv') {
    body.push(`<rect x="56" y="74" width="38" height="22" rx="8" fill="${P.ink}"/><rect x="106" y="74" width="38" height="22" rx="8" fill="${P.ink}"/><path d="M92 82 h16" ${o(5)} fill="none"/><path d="M64 80 l10 0" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.6"/><path d="M114 80 l10 0" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`);
    body.push(`<path d="M88 112 Q100 120 112 112" fill="none" ${o(5)}/>`);
  } else if (face === 'idle') {
    body.push(`<circle cx="76" cy="86" r="7" fill="${P.ink}"/><circle cx="124" cy="86" r="7" fill="${P.ink}"/><circle cx="78" cy="84" r="2.4" fill="#fff"/><circle cx="126" cy="84" r="2.4" fill="#fff"/>`);
    body.push(`<path d="M88 108 Q100 120 112 108" fill="none" ${o(5)}/>`);
  } else if (face === 'work') {
    body.push(`<path d="M64 74 L86 80" ${o(5)} fill="none"/><path d="M136 74 L114 80" ${o(5)} fill="none"/>`);
    body.push(`<circle cx="76" cy="90" r="7" fill="${P.ink}"/><circle cx="124" cy="90" r="7" fill="${P.ink}"/>`);
    body.push(`<ellipse cx="100" cy="114" rx="10" ry="8" fill="#B5505A" ${o(5)}/>`);
    body.push(`<path d="M154 48 q8 12 0 18 q-8 -6 0 -18 Z" fill="${P.sky}" ${o(4)}/>`);
  } else if (face === 'cheer') {
    body.push(`<path d="M66 90 Q76 78 86 90" fill="none" ${o(5)}/><path d="M114 90 Q124 78 134 90" fill="none" ${o(5)}/>`);
    body.push(`<path d="M84 106 Q100 130 116 106 Z" fill="#B5505A" ${o(5)}/>`);
  } else if (face === 'sleep') {
    body.push(`<path d="M66 88 Q76 94 86 88" fill="none" ${o(5)}/><path d="M114 88 Q124 94 134 88" fill="none" ${o(5)}/><ellipse cx="100" cy="112" rx="6" ry="5" fill="#B5505A" ${o(4)}/>`);
  }
  if (prop === 'megaphone') {
    body.push(`<g transform="translate(140 82) rotate(-18) scale(0.86)"><path d="M0 10 L44 -14 L44 44 L0 22 Z" fill="${P.coral}" ${o(5)}/><rect x="-12" y="8" width="14" height="16" rx="4" fill="${P.white}" ${o(5)}/><path d="M54 2 l14 -8 M56 16 h16 M54 30 l14 8" ${o(5)} fill="none"/></g>`);
  } else if (prop === 'coffee') {
    body.push(`<g transform="translate(158 104)"><rect x="-10" y="0" width="22" height="26" rx="5" fill="${P.white}" ${o(5)}/><path d="M12 6 q10 6 0 14" fill="none" ${o(4)}/><path d="M-4 -8 q4 -6 0 -12 M6 -8 q4 -6 0 -12" fill="none" stroke="${P.gray}" stroke-width="3" stroke-linecap="round"/></g>`);
  }
  return body.join('');
}
const personSvg = (w, h, opts) => svg(w, h, person(opts), '0 0 200 240');
const headSvg = (w, face = 'idle', outfit = 'tee') => svg(w, w, person({ outfit, face, arms: 'none' }), '28 6 144 144');

// ------------------------------------------------------------------ 건물(일터 단면): 256×220
function building(kind) {
  const b = [];
  const base = (wall, roof, sign) => {
    b.push(`<rect x="24" y="64" width="208" height="140" rx="10" fill="${wall}" ${o()}/>`);
    b.push(`<path d="M12 70 L28 34 H228 L244 70 Z" fill="${roof}" ${o()}/>`);
    if (sign) b.push(`<rect x="70" y="14" width="116" height="34" rx="10" fill="${sign}" ${o()}/>`);
    b.push(`<rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
  };
  const win = (x, y, w, h, c = '#CFEFFF') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c}" ${o(5)}/><path d="M${x + 8} ${y + h - 8} L${x + w - 8} ${y + 8}" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`;
  const door = (x, c = P.wood) => `<rect x="${x}" y="130" width="44" height="72" rx="6" fill="${c}" ${o(5)}/><circle cx="${x + 34}" cy="168" r="4" fill="${P.yellow}" ${o(3)}/>`;
  const awning = (c1, c2) => { let s = ''; for (let i = 0; i < 6; i++) s += `<path d="M${28 + i * 34} 70 h34 v20 q-17 14 -34 0 Z" fill="${i % 2 ? c1 : c2}" ${o(5)}/>`; return s; };
  switch (kind) {
    case 'b_store':
      base(P.white, TIER.alba, P.green); b.push(awning(P.white, TIER.alba)); b.push(win(40, 112, 96, 70)); b.push(door(160, '#CFEFFF'));
      b.push(`<text x="128" y="39" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" font-family="sans-serif">24</text>`);
      break;
    case 'b_delivery':
      base(P.cream, P.coral, P.yellow); b.push(win(40, 96, 70, 52)); b.push(`<rect x="130" y="110" width="86" height="92" rx="6" fill="${P.grayDark}" ${o(5)}/><path d="M138 130 h70 M138 150 h70 M138 170 h70" stroke="${P.gray}" stroke-width="5"/>`);
      b.push(`<g transform="translate(40 150)"><circle cx="14" cy="40" r="12" fill="${P.ink}"/><circle cx="62" cy="40" r="12" fill="${P.ink}"/><path d="M8 34 L28 12 H52 L66 34 Z" fill="${P.coral}" ${o(5)}/><rect x="0" y="-2" width="30" height="24" rx="4" fill="${P.yellow}" ${o(5)}/></g>`);
      break;
    case 'b_cafe':
      base('#F6E3C8', P.woodDark, P.wood); b.push(awning(P.cream, P.wood)); b.push(win(150, 112, 68, 56)); b.push(door(44, P.woodDark));
      b.push(`<g transform="translate(112 22)"><rect x="0" y="0" width="22" height="18" rx="4" fill="#fff" ${o(4)}/><path d="M22 4 q10 5 0 10" fill="none" ${o(3)}/></g>`);
      break;
    case 'b_office':
      b.push(`<rect x="36" y="20" width="184" height="184" rx="10" fill="#DCEBD6" ${o()}/>`);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.push(win(52 + c * 54, 36 + r * 50, 40, 34));
      b.push(`<rect x="100" y="162" width="56" height="42" rx="6" fill="${TIER.job}" ${o(5)}/><rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      break;
    case 'b_shop':
      base('#FFE3C2', TIER.biz, P.coral); b.push(awning(P.coral, P.white)); b.push(win(40, 112, 110, 70, '#FFF6D8')); b.push(door(170, P.coral));
      b.push(`<g transform="translate(64 128)"><ellipse cx="30" cy="36" rx="30" ry="10" fill="${P.grayDark}" ${o(4)}/><path d="M4 30 Q30 -6 56 30 Z" fill="${P.coral}" ${o(4)}/><circle cx="20" cy="22" r="5" fill="#fff"/><circle cx="38" cy="18" r="5" fill="#fff"/></g>`);
      break;
    case 'b_tower':
      b.push(`<rect x="70" y="10" width="116" height="194" rx="10" fill="#D8ECF7" ${o()}/>`);
      for (let r = 0; r < 5; r++) b.push(`<rect x="84" y="${24 + r * 34}" width="88" height="22" rx="5" fill="${P.sky}" ${o(4)}/>`);
      b.push(`<rect x="24" y="130" width="50" height="74" rx="8" fill="${P.cream}" ${o()}/><rect x="182" y="110" width="50" height="94" rx="8" fill="${P.cream}" ${o()}/><rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      break;
    case 'b_hq':
      b.push(`<path d="M40 204 V70 L128 16 L216 70 V204 Z" fill="#E7DFFB" ${o()}/>`);
      for (let c = 0; c < 4; c++) b.push(`<rect x="${58 + c * 38}" y="84" width="24" height="104" rx="6" fill="${TIER.inv}" ${o(4)}/>`);
      b.push(`<circle cx="128" cy="54" r="16" fill="${P.yellow}" ${o(5)}/><rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      break;
    case 'b_penthouse':
      b.push(`<rect x="84" y="60" width="88" height="144" rx="8" fill="#F3E9FF" ${o()}/>`);
      for (let r = 0; r < 4; r++) b.push(`<rect x="96" y="${72 + r * 32}" width="64" height="20" rx="5" fill="${P.purple}" ${o(4)}/>`);
      b.push(`<rect x="60" y="30" width="136" height="38" rx="10" fill="${P.yellow}" ${o()}/><path d="M112 30 L128 6 L144 30 Z" fill="${P.coral}" ${o(5)}/><rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      b.push(`<circle cx="40" cy="170" r="24" fill="${P.mint}" ${o(5)}/><rect x="36" y="186" width="8" height="18" fill="${P.woodDark}"/><circle cx="216" cy="170" r="24" fill="${P.mint}" ${o(5)}/><rect x="212" y="186" width="8" height="18" fill="${P.woodDark}"/>`);
      break;
    case 'p_villa':
      base(P.cream, P.coral, null); b.push(win(44, 90, 50, 40)); b.push(win(162, 90, 50, 40)); b.push(win(44, 146, 50, 40)); b.push(door(106));
      break;
    case 'p_mall':
      base(P.white, P.sky, P.yellow); b.push(awning(P.yellow, P.white)); b.push(win(40, 112, 80, 70)); b.push(win(136, 112, 80, 70));
      break;
    case 'p_mixed':
      b.push(`<rect x="40" y="26" width="176" height="178" rx="10" fill="#FFE3C2" ${o()}/>`); b.push(win(56, 42, 60, 40)); b.push(win(140, 42, 60, 40)); b.push(win(56, 92, 60, 40)); b.push(win(140, 92, 60, 40));
      b.push(awning(P.orange, P.white).replace(/70 h34 v20/g, '142 h34 v16')); b.push(door(106, P.orange)); b.push(`<rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      break;
    case 'p_building':
      b.push(`<rect x="56" y="8" width="144" height="196" rx="10" fill="#DCE6F5" ${o()}/>`);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) b.push(`<rect x="${70 + c * 42}" y="${22 + r * 34}" width="30" height="22" rx="5" fill="${P.blue}" ${o(4)}/>`);
      b.push(`<rect x="12" y="200" width="232" height="14" rx="6" fill="${P.grayDark}" ${o(5)}/>`);
      break;
    case 'plot_empty':
      b.push(`<rect x="24" y="150" width="208" height="54" rx="10" fill="#E9D9B8" stroke="${P.ink}" stroke-width="5" stroke-dasharray="14 12"/>`);
      b.push(`<rect x="110" y="96" width="36" height="60" fill="${P.wood}" ${o(5)}/><rect x="70" y="60" width="116" height="52" rx="8" fill="${P.white}" ${o()}/><path d="M112 86 h32 M128 70 v32" ${o()} fill="none"/>`);
      break;
  }
  return svg(256, 220, b.join(''));
}

// ------------------------------------------------------------------ 아이콘: 96×96
const ICONS = {
  coin: `<circle cx="48" cy="48" r="36" fill="${P.yellow}" ${o()}/><circle cx="48" cy="48" r="25" fill="none" stroke="#E0A019" stroke-width="5"/><path d="M36 38 l6 22 l6 -16 l6 16 l6 -22 M34 46 h28" fill="none" ${o(5)}/>`,
  cash: `<rect x="10" y="26" width="76" height="46" rx="8" fill="${P.mint}" ${o()}/><circle cx="48" cy="49" r="13" fill="${P.green}" ${o(5)}/><circle cx="22" cy="49" r="4" fill="${P.green}"/><circle cx="74" cy="49" r="4" fill="${P.green}"/>`,
  networth: `<path d="M12 80 V52 l18 -14 l16 10 l20 -26 l18 10 V80 Z" fill="${P.mint}" ${o()}/><path d="M12 52 l18 -14 l16 10 l20 -26 l18 10" fill="none" stroke="${P.green}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="66" cy="22" r="8" fill="${P.yellow}" ${o(5)}/>`,
  clone: `<circle cx="34" cy="40" r="20" fill="${P.skin}" ${o()}/><path d="M16 38 Q14 16 34 16 Q54 16 52 38 Q44 26 34 28 Q24 26 16 38Z" fill="${P.hair}" ${o(5)}/><circle cx="64" cy="48" r="20" fill="${P.skin}" ${o()}/><path d="M46 46 Q44 24 64 24 Q84 24 82 46 Q74 34 64 36 Q54 34 46 46Z" fill="${P.hair}" ${o(5)}/><circle cx="58" cy="52" r="3" fill="${P.ink}"/><circle cx="70" cy="52" r="3" fill="${P.ink}"/><path d="M20 84 Q48 60 78 84" fill="${P.yellow}" ${o()}/>`,
  level: `<path d="M48 8 L59 34 L88 37 L66 56 L73 84 L48 69 L23 84 L30 56 L8 37 L37 34 Z" fill="${P.yellow}" ${o()}/>`,
  apt_alba: `<circle cx="48" cy="48" r="38" fill="${TIER.alba}" ${o()}/><path d="M30 66 L58 38" ${o(10)} fill="none"/><path d="M52 24 a16 16 0 1 0 20 20 l-12 2 l-10 -10 Z" fill="${P.white}" ${o(5)}/>`,
  apt_job: `<circle cx="48" cy="48" r="38" fill="${TIER.job}" ${o()}/><rect x="24" y="38" width="48" height="34" rx="6" fill="${P.white}" ${o(5)}/><path d="M38 38 v-8 h20 v8 M24 52 h48" fill="none" ${o(5)}/>`,
  apt_biz: `<circle cx="48" cy="48" r="38" fill="${TIER.biz}" ${o()}/><path d="M24 44 l6 -16 h36 l6 16 Z" fill="${P.white}" ${o(5)}/><rect x="28" y="44" width="40" height="28" fill="${P.white}" ${o(5)}/><rect x="42" y="54" width="12" height="18" fill="${P.coral}" ${o(4)}/>`,
  apt_inv: `<circle cx="48" cy="48" r="38" fill="${TIER.inv}" ${o()}/><path d="M24 66 l14 -16 l12 8 l20 -26" fill="none" stroke="${P.white}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 30 h14 v14" fill="none" stroke="${P.white}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  payday: `<rect x="10" y="24" width="76" height="52" rx="8" fill="${P.white}" ${o()}/><path d="M10 30 L48 58 L86 30" fill="none" ${o()}/><circle cx="48" cy="60" r="14" fill="${P.coral}" ${o(5)}/><path d="M42 56 l3 9 l3 -7 l3 7 l3 -9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  piggy: `<ellipse cx="48" cy="52" rx="34" ry="26" fill="${P.pink}" ${o()}/><rect x="26" y="70" width="10" height="14" rx="4" fill="${P.pink}" ${o(5)}/><rect x="60" y="70" width="10" height="14" rx="4" fill="${P.pink}" ${o(5)}/><ellipse cx="78" cy="52" rx="9" ry="8" fill="#FFB7C8" ${o(5)}/><circle cx="62" cy="42" r="4" fill="${P.ink}"/><rect x="38" y="24" width="20" height="6" rx="3" fill="${P.ink}"/><path d="M52 28 l-10 -14" ${o(5)} fill="none"/><circle cx="40" cy="12" r="9" fill="${P.yellow}" ${o(4)}/>`,
  house: `<path d="M10 48 L48 14 L86 48" fill="none" ${o(9)}/><path d="M20 44 V82 H76 V44 L48 20 Z" fill="${P.cream}" ${o()}/><rect x="40" y="54" width="16" height="28" rx="3" fill="${P.coral}" ${o(5)}/><path d="M10 48 L48 14 L86 48" fill="none" stroke="${P.coral}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  building: `<rect x="22" y="12" width="52" height="72" rx="6" fill="#DCE6F5" ${o()}/><g fill="${P.blue}"><rect x="30" y="20" width="14" height="12" rx="2"/><rect x="52" y="20" width="14" height="12" rx="2"/><rect x="30" y="38" width="14" height="12" rx="2"/><rect x="52" y="38" width="14" height="12" rx="2"/></g><rect x="40" y="62" width="16" height="22" rx="3" fill="${P.yellow}" ${o(5)}/>`,
  stock: `<rect x="10" y="14" width="76" height="68" rx="10" fill="${P.white}" ${o()}/><path d="M22 64 l14 -16 l12 8 l22 -28" fill="none" stroke="${P.coral}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 26 h14 v14" fill="none" stroke="${P.coral}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  luxury: `<rect x="34" y="6" width="28" height="20" rx="5" fill="${P.woodDark}" ${o(5)}/><rect x="34" y="70" width="28" height="20" rx="5" fill="${P.woodDark}" ${o(5)}/><circle cx="48" cy="48" r="28" fill="${P.yellow}" ${o()}/><circle cx="48" cy="48" r="18" fill="${P.white}" ${o(5)}/><path d="M48 36 v12 l8 6" fill="none" ${o(5)}/>`,
  trophy: `<path d="M26 14 h44 v22 a22 22 0 0 1 -44 0 Z" fill="${P.yellow}" ${o()}/><path d="M26 20 h-12 q0 18 16 20 M70 20 h12 q0 18 -16 20" fill="none" ${o()}/><rect x="42" y="56" width="12" height="14" fill="${P.yellow}" ${o(5)}/><rect x="28" y="70" width="40" height="14" rx="5" fill="${P.woodDark}" ${o()}/>`,
  truck: `<rect x="6" y="26" width="52" height="40" rx="6" fill="${P.sky}" ${o()}/><path d="M58 38 h18 l14 14 v14 h-32 Z" fill="${P.white}" ${o()}/><rect x="64" y="42" width="12" height="10" rx="2" fill="${P.sky}" ${o(4)}/><circle cx="24" cy="70" r="11" fill="${P.ink}"/><circle cx="24" cy="70" r="4" fill="${P.gray}"/><circle cx="72" cy="70" r="11" fill="${P.ink}"/><circle cx="72" cy="70" r="4" fill="${P.gray}"/>`,
  megaphone: `<path d="M14 40 L64 16 V80 L14 56 Z" fill="${P.coral}" ${o()}/><rect x="6" y="38" width="14" height="20" rx="5" fill="${P.white}" ${o(5)}/><path d="M74 30 l12 -8 M76 48 h14 M74 66 l12 8" fill="none" ${o()}/>`,
  lock: `<path d="M30 44 V32 a18 18 0 0 1 36 0 V44" fill="none" ${o(9)}/><rect x="20" y="42" width="56" height="42" rx="10" fill="${P.gray}" ${o()}/><circle cx="48" cy="60" r="6" fill="${P.ink}"/><rect x="45" y="60" width="6" height="14" rx="3" fill="${P.ink}"/>`,
  check: `<circle cx="48" cy="48" r="38" fill="${P.green}" ${o()}/><path d="M28 50 l14 14 l28 -30" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  gear: `<path d="M48 10 l8 4 l2 10 l9 4 l9 -6 l7 7 l-6 9 l4 9 l10 2 v10 l-10 2 l-4 9 l6 9 l-7 7 l-9 -6 l-9 4 l-2 10 h-10 l-2 -10 l-9 -4 l-9 6 l-7 -7 l6 -9 l-4 -9 l-10 -2 v-10 l10 -2 l4 -9 l-6 -9 l7 -7 l9 6 l9 -4 l2 -10 Z" fill="${P.gray}" ${o(5)} transform="translate(4.8 4.8) scale(0.9)"/><circle cx="48" cy="48" r="13" fill="${P.paper}" ${o(5)}/>`,
  shop: `<path d="M12 38 l8 -22 h56 l8 22 Z" fill="${P.coral}" ${o()}/><rect x="18" y="38" width="60" height="44" rx="4" fill="${P.white}" ${o()}/><rect x="40" y="52" width="16" height="30" fill="${P.sky}" ${o(5)}/><path d="M12 38 q9 12 18 0 q9 12 18 0 q9 12 18 0 q9 12 18 0" fill="${P.white}" ${o(5)}/>`,
  home: `<path d="M12 46 L48 14 L84 46 V82 H12 Z" fill="${P.yellow}" ${o()}/><rect x="38" y="54" width="20" height="28" rx="4" fill="${P.white}" ${o(5)}/>`,
  village: `<path d="M4 84 Q30 30 56 60 Q72 40 92 84 Z" fill="${P.mint}" ${o()}/><rect x="22" y="50" width="20" height="18" fill="${P.white}" ${o(4)}/><path d="M18 52 l14 -12 l14 12" fill="${P.coral}" ${o(4)}/><rect x="58" y="58" width="16" height="14" fill="${P.white}" ${o(4)}/><path d="M54 60 l12 -10 l12 10" fill="${P.sky}" ${o(4)}/><circle cx="76" cy="20" r="10" fill="${P.yellow}" ${o(4)}/>`,
  asset: `<path d="M48 8 L84 26 V34 H12 V26 Z" fill="${P.sky}" ${o()}/><rect x="18" y="40" width="10" height="30" fill="${P.white}" ${o(5)}/><rect x="43" y="40" width="10" height="30" fill="${P.white}" ${o(5)}/><rect x="68" y="40" width="10" height="30" fill="${P.white}" ${o(5)}/><rect x="10" y="72" width="76" height="12" rx="4" fill="${P.sky}" ${o()}/>`,
  up: `<circle cx="48" cy="48" r="38" fill="${P.green}" ${o()}/><path d="M48 70 V30 M30 46 L48 28 L66 46" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<circle cx="48" cy="48" r="38" fill="${P.white}" stroke="${P.ink}" stroke-width="6" stroke-dasharray="12 10"/><path d="M48 28 v40 M28 48 h40" fill="none" stroke="${P.grayDark}" stroke-width="10" stroke-linecap="round"/>`,
  ad: `<rect x="10" y="18" width="76" height="56" rx="10" fill="${P.purple}" ${o()}/><path d="M40 32 L62 46 L40 60 Z" fill="#fff" ${o(5)}/><rect x="30" y="78" width="36" height="8" rx="4" fill="${P.ink}"/>`,
  clock: `<circle cx="48" cy="50" r="34" fill="${P.white}" ${o()}/><path d="M48 30 v20 l14 8" fill="none" ${o(7)}/><rect x="40" y="6" width="16" height="10" rx="4" fill="${P.coral}" ${o(5)}/>`,
  cert: `<rect x="14" y="12" width="68" height="60" rx="6" fill="${P.white}" ${o()}/><path d="M26 28 h44 M26 40 h32" fill="none" stroke="${P.gray}" stroke-width="6" stroke-linecap="round"/><circle cx="62" cy="62" r="14" fill="${P.coral}" ${o(5)}/><path d="M54 72 l-4 16 l12 -6 l12 6 l-4 -16" fill="${P.coral}" ${o(5)}/>`,
  train: `<rect x="34" y="42" width="28" height="12" fill="${P.grayDark}" ${o(5)}/><rect x="16" y="26" width="18" height="44" rx="6" fill="${P.coral}" ${o()}/><rect x="62" y="26" width="18" height="44" rx="6" fill="${P.coral}" ${o()}/><rect x="6" y="36" width="12" height="24" rx="5" fill="${P.grayDark}" ${o(5)}/><rect x="78" y="36" width="12" height="24" rx="5" fill="${P.grayDark}" ${o(5)}/>`,
  manager: `<rect x="20" y="16" width="56" height="70" rx="8" fill="${P.wood}" ${o()}/><rect x="28" y="26" width="40" height="52" rx="4" fill="${P.white}" ${o(4)}/><rect x="36" y="8" width="24" height="16" rx="5" fill="${P.gray}" ${o(5)}/><path d="M34 42 l5 5 l9 -10 M34 60 l5 5 l9 -10" fill="none" stroke="${P.green}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 44 h8 M54 62 h8" stroke="${P.gray}" stroke-width="5" stroke-linecap="round"/>`,
  news: `<rect x="10" y="18" width="66" height="62" rx="6" fill="${P.white}" ${o()}/><path d="M76 34 h10 v38 a8 8 0 0 1 -16 0" fill="${P.gray}" ${o()}/><rect x="20" y="28" width="46" height="14" fill="${P.ink}"/><path d="M20 52 h46 M20 64 h30" stroke="${P.gray}" stroke-width="6" stroke-linecap="round"/>`,
  crown: `<path d="M12 70 L8 30 L30 46 L48 18 L66 46 L88 30 L84 70 Z" fill="${P.yellow}" ${o()}/><rect x="12" y="66" width="72" height="14" rx="5" fill="${P.orange}" ${o()}/>`,
  heart: `<path d="M48 82 C10 56 10 26 30 20 C40 17 46 24 48 30 C50 24 56 17 66 20 C86 26 86 56 48 82 Z" fill="${P.coral}" ${o()}/>`,
  alert: `<circle cx="48" cy="48" r="38" fill="${P.coral}" ${o()}/><rect x="42" y="22" width="12" height="32" rx="6" fill="#fff"/><circle cx="48" cy="68" r="7" fill="#fff"/>`,
  retire: `<circle cx="48" cy="40" r="26" fill="${P.yellow}" ${o()}/><path d="M34 62 l-8 26 l22 -10 l22 10 l-8 -26" fill="${P.coral}" ${o()}/><path d="M48 26 l5 10 l11 1 l-8 8 l2 11 l-10 -6 l-10 6 l2 -11 l-8 -8 l11 -1 Z" fill="${P.white}" ${o(4)}/>`,
  facility: `<path d="M16 80 V40 l22 -14 v14 l22 -14 v54 Z" fill="${P.gray}" ${o()}/><rect x="60" y="14" width="18" height="66" fill="${P.grayDark}" ${o()}/><rect x="24" y="52" width="12" height="12" fill="${P.yellow}" ${o(4)}/><rect x="42" y="52" width="12" height="12" fill="${P.yellow}" ${o(4)}/><path d="M66 10 q6 -8 14 -2" fill="none" stroke="${P.gray}" stroke-width="5" stroke-linecap="round"/>`,
  bank: `<circle cx="48" cy="48" r="38" fill="${P.sky}" ${o()}/><path d="M48 20 L72 34 H24 Z" fill="#fff" ${o(4)}/><rect x="28" y="38" width="8" height="24" fill="#fff" ${o(4)}/><rect x="44" y="38" width="8" height="24" fill="#fff" ${o(4)}/><rect x="60" y="38" width="8" height="24" fill="#fff" ${o(4)}/><rect x="22" y="64" width="52" height="8" rx="3" fill="#fff" ${o(4)}/>`,
  close: `<circle cx="48" cy="48" r="38" fill="${P.coral}" ${o()}/><path d="M32 32 L64 64 M64 32 L32 64" stroke="#fff" stroke-width="11" stroke-linecap="round"/>`,
  ticket: `<path d="M8 28 h80 v14 a8 8 0 0 0 0 16 v14 h-80 v-14 a8 8 0 0 0 0 -16 Z" fill="${P.yellow}" ${o()}/><path d="M40 40 l18 10 l-18 10 Z" fill="${P.ink}"/><path d="M64 40 l18 10 l-18 10 Z" fill="${P.ink}" transform="translate(-10 0)"/>`,
  camera: `<rect x="10" y="26" width="76" height="52" rx="10" fill="${P.white}" ${o()}/><rect x="32" y="16" width="32" height="14" rx="5" fill="${P.gray}" ${o(5)}/><circle cx="48" cy="52" r="16" fill="${P.sky}" ${o()}/><circle cx="48" cy="52" r="7" fill="${P.ink}"/>`,
  stamp: `<circle cx="48" cy="48" r="36" fill="none" stroke="${P.coral}" stroke-width="8"/><circle cx="48" cy="48" r="26" fill="none" stroke="${P.coral}" stroke-width="4"/><path d="M34 50 l10 10 l20 -22" fill="none" stroke="${P.coral}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const icon = (name) => svg(96, 96, ICONS[name]);

// ------------------------------------------------------------------ UI 조각(흰색 기반: Unity에서 색을 입힌다)
const UI = {
  // 9-slice 패널: 외곽선 + 흰 바탕. border 28
  panel: { w: 96, h: 96, border: 30, body: `<rect x="4" y="4" width="88" height="88" rx="24" fill="#fff" ${o()}/>` },
  // 그림자 달린 카드(아래로 살짝 뜬 느낌)
  card: { w: 96, h: 104, border: 30, borderB: 38, body: `<rect x="4" y="12" width="88" height="88" rx="24" fill="${P.ink}" opacity="0.28"/><rect x="4" y="4" width="88" height="88" rx="24" fill="#fff" ${o()}/>` },
  // 버튼: 아래 입술(어두운 띠)로 눌리는 깊이를 표현
  btn: { w: 96, h: 104, border: 30, borderB: 40, body: `<rect x="4" y="4" width="88" height="96" rx="24" fill="#fff" ${o()}/><path d="M7 70 V76 a21 21 0 0 0 21 21 H68 a21 21 0 0 0 21 -21 V70 a21 21 0 0 1 -21 21 H28 a21 21 0 0 1 -21 -21 Z" fill="${P.ink}" opacity="0.22"/><rect x="18" y="12" width="60" height="10" rx="5" fill="#fff" opacity="0.55"/>` },
  pill: { w: 64, h: 64, border: 30, body: `<rect x="4" y="4" width="56" height="56" rx="28" fill="#fff" ${o()}/>` },
  pill_flat: { w: 64, h: 64, border: 30, body: `<rect x="0" y="0" width="64" height="64" rx="32" fill="#fff"/>` },
  round: { w: 48, h: 48, border: 22, body: `<rect x="0" y="0" width="48" height="48" rx="22" fill="#fff"/>` },
  bubble: { w: 112, h: 112, border: 34, borderB: 50, body: `<path d="M28 6 H84 a22 22 0 0 1 22 22 V60 a22 22 0 0 1 -22 22 H64 L48 104 L44 82 H28 a22 22 0 0 1 -22 -22 V28 a22 22 0 0 1 22 -22 Z" fill="#fff" ${o()}/>` },
  circle: { w: 96, h: 96, body: `<circle cx="48" cy="48" r="48" fill="#fff"/>` },
  ring: { w: 128, h: 128, body: `<circle cx="64" cy="64" r="54" fill="none" stroke="#fff" stroke-width="12"/>` },
  glow: { w: 128, h: 128, body: `<defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/>` },
  shadow: { w: 128, h: 48, body: `<defs><radialGradient id="s"><stop offset="0" stop-color="${P.shadow}" stop-opacity="0.45"/><stop offset="1" stop-color="${P.shadow}" stop-opacity="0"/></radialGradient></defs><ellipse cx="64" cy="24" rx="64" ry="24" fill="url(#s)"/>` },
  grad_v: { w: 8, h: 128, body: `<defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="8" height="128" fill="url(#gv)"/>` },
  white: { w: 8, h: 8, body: `<rect width="8" height="8" fill="#fff"/>` },
  spark: { w: 64, h: 64, body: `<path d="M32 2 L38 26 L62 32 L38 38 L32 62 L26 38 L2 32 L26 26 Z" fill="#fff"/>` },
  confetti: { w: 24, h: 32, body: `<rect x="2" y="2" width="20" height="28" rx="5" fill="#fff"/>` },
  cloud: { w: 200, h: 90, body: `<path d="M40 78 a30 30 0 0 1 6 -58 a40 40 0 0 1 74 -4 a32 32 0 0 1 44 62 Z" fill="#fff"/>` },
  hill: { w: 512, h: 160, body: `<path d="M0 160 V80 Q120 -10 256 60 Q400 130 512 40 V160 Z" fill="#fff"/>` },
  finger: { w: 96, h: 112, body: `<path d="M36 100 V54 l-10 8 a8 8 0 0 1 -12 -10 l22 -24 V16 a10 10 0 0 1 20 0 V44 l22 6 a12 12 0 0 1 8 12 l-4 38 Z" fill="${P.skin}" ${o()}/>` },
};

// ------------------------------------------------------------------ 소품·장면
const PROPS = {
  mirror: { w: 200, h: 300, body: `<ellipse cx="100" cy="286" rx="70" ry="12" fill="${P.shadow}" opacity="0.3"/><rect x="24" y="8" width="152" height="270" rx="70" fill="${P.wood}" ${o(7)}/><rect x="40" y="26" width="120" height="234" rx="56" fill="#CFEFFF" ${o()}/><path d="M60 200 L130 60 M84 220 L140 110" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity="0.8"/>` },
  window: { w: 240, h: 200, body: `<rect x="8" y="8" width="224" height="184" rx="14" fill="${P.wood}" ${o(7)}/><rect x="24" y="24" width="192" height="152" rx="6" fill="#BFE6FA" ${o(5)}/><path d="M24 150 Q70 96 120 132 Q170 104 216 150 V176 H24 Z" fill="${P.mint}"/><rect x="96" y="96" width="26" height="40" fill="#fff" ${o(4)}/><path d="M90 98 L109 80 L128 98" fill="${P.coral}" ${o(4)}/><circle cx="182" cy="54" r="16" fill="${P.yellow}"/><path d="M120 24 V176 M24 100 H216" stroke="${P.ink}" stroke-width="6"/>` },
  window_low: { w: 240, h: 110, body: `<rect x="8" y="8" width="224" height="94" rx="12" fill="${P.grayDark}" ${o(7)}/><rect x="22" y="22" width="196" height="66" rx="6" fill="#9FB8C8" ${o(5)}/><rect x="52" y="58" width="22" height="30" rx="8" fill="${P.ink}"/><rect x="82" y="58" width="22" height="30" rx="8" fill="${P.ink}"/><rect x="150" y="58" width="22" height="30" rx="8" fill="${P.ink}"/><path d="M70 22 V88 M120 22 V88 M170 22 V88" stroke="${P.ink}" stroke-width="6"/>` },
  bed: { w: 260, h: 130, body: `<rect x="8" y="60" width="244" height="50" rx="12" fill="${P.cream}" ${o()}/><rect x="8" y="30" width="26" height="86" rx="8" fill="${P.wood}" ${o()}/><rect x="40" y="44" width="70" height="34" rx="14" fill="#fff" ${o()}/><path d="M112 62 H252 V104 H112 Z" fill="${P.sky}" ${o()}/><rect x="16" y="108" width="14" height="16" fill="${P.woodDark}"/><rect x="230" y="108" width="14" height="16" fill="${P.woodDark}"/>` },
  desk: { w: 220, h: 150, body: `<rect x="8" y="60" width="204" height="18" rx="6" fill="${P.wood}" ${o()}/><rect x="20" y="78" width="14" height="64" fill="${P.woodDark}" ${o(4)}/><rect x="186" y="78" width="14" height="64" fill="${P.woodDark}" ${o(4)}/><rect x="70" y="8" width="84" height="50" rx="6" fill="${P.ink}"/><rect x="78" y="14" width="68" height="38" rx="3" fill="${P.sky}"/><rect x="104" y="54" width="16" height="8" fill="${P.ink}"/>` },
  plant: { w: 110, h: 170, body: `<path d="M55 120 Q20 90 30 40 Q50 70 55 110 Q60 40 86 20 Q94 80 55 120" fill="${P.green}" ${o()}/><path d="M26 112 H84 L76 162 H34 Z" fill="${P.coral}" ${o()}/>` },
  sofa: { w: 280, h: 150, body: `<rect x="20" y="20" width="240" height="80" rx="24" fill="${P.purple}" ${o()}/><rect x="8" y="60" width="264" height="60" rx="20" fill="#BBA4FF" ${o()}/><rect x="8" y="52" width="44" height="74" rx="18" fill="${P.purple}" ${o()}/><rect x="228" y="52" width="44" height="74" rx="18" fill="${P.purple}" ${o()}/><rect x="30" y="122" width="14" height="20" fill="${P.woodDark}"/><rect x="236" y="122" width="14" height="20" fill="${P.woodDark}"/>` },
  lamp: { w: 90, h: 220, body: `<rect x="40" y="70" width="10" height="130" fill="${P.grayDark}" ${o(4)}/><ellipse cx="45" cy="204" rx="32" ry="9" fill="${P.grayDark}" ${o(5)}/><path d="M20 76 L32 14 H58 L70 76 Z" fill="${P.yellow}" ${o()}/>` },
  frame: { w: 130, h: 110, body: `<rect x="6" y="6" width="118" height="98" rx="8" fill="${P.yellow}" ${o()}/><rect x="20" y="20" width="90" height="70" fill="#CFEFFF" ${o(4)}/><circle cx="50" cy="52" r="12" fill="${P.skin}" ${o(4)}/><circle cx="82" cy="52" r="12" fill="${P.skin}" ${o(4)}/><path d="M34 84 q16 -20 32 0 q16 -20 32 0" fill="${P.sky}" ${o(4)}/>` },
  tv: { w: 220, h: 150, body: `<rect x="8" y="8" width="204" height="112" rx="10" fill="${P.ink}"/><rect x="18" y="18" width="184" height="92" rx="4" fill="${P.blue}"/><path d="M40 90 l30 -30 l24 18 l40 -44" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/><rect x="92" y="120" width="36" height="12" fill="${P.ink}"/><rect x="60" y="130" width="100" height="10" rx="5" fill="${P.ink}"/>` },
  box: { w: 120, h: 100, body: `<rect x="8" y="26" width="104" height="66" rx="6" fill="${P.wood}" ${o()}/><path d="M8 26 l14 -18 h76 l14 18" fill="#D2A77A" ${o()}/><path d="M60 26 v66" stroke="${P.woodDark}" stroke-width="5"/><rect x="48" y="40" width="24" height="12" fill="${P.cream}" ${o(3)}/>` },
  truck_big: { w: 360, h: 220, body: `<rect x="10" y="30" width="220" height="140" rx="14" fill="${P.sky}" ${o(8)}/><path d="M230 70 h66 l52 52 v48 h-118 Z" fill="${P.white}" ${o(8)}/><rect x="250" y="86" width="44" height="36" rx="6" fill="#BFE6FA" ${o(5)}/><rect x="30" y="56" width="180" height="60" rx="8" fill="#fff" opacity="0.5"/><circle cx="80" cy="180" r="32" fill="${P.ink}"/><circle cx="80" cy="180" r="12" fill="${P.gray}"/><circle cx="280" cy="180" r="32" fill="${P.ink}"/><circle cx="280" cy="180" r="12" fill="${P.gray}"/><rect x="336" y="140" width="18" height="14" rx="4" fill="${P.yellow}" ${o(4)}/>` },
  envelope: { w: 160, h: 120, body: `<rect x="8" y="14" width="144" height="98" rx="12" fill="${P.white}" ${o(7)}/><path d="M8 22 L80 72 L152 22" fill="none" ${o(7)}/><circle cx="80" cy="74" r="20" fill="${P.coral}" ${o()}/><path d="M70 68 l5 14 l5 -11 l5 11 l5 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` },
  receipt: { w: 96, h: 120, border: 30, borderB: 44, body: `<path d="M8 6 H88 V100 l-10 12 l-10 -12 l-10 12 l-10 -12 l-10 12 l-10 -12 l-10 12 l-10 -12 Z" fill="#fff" ${o()}/>` },
  tree: { w: 120, h: 170, body: `<rect x="52" y="110" width="16" height="52" fill="${P.woodDark}" ${o(4)}/><circle cx="60" cy="68" r="52" fill="${P.green}" ${o()}/><circle cx="42" cy="54" r="10" fill="#fff" opacity="0.25"/>` },
  cat: { w: 100, h: 90, body: `<ellipse cx="50" cy="62" rx="36" ry="24" fill="${P.orange}" ${o()}/><circle cx="34" cy="38" r="22" fill="${P.orange}" ${o()}/><path d="M16 30 L14 8 L32 20 Z M52 30 L56 8 L38 20 Z" fill="${P.orange}" ${o(5)}/><circle cx="27" cy="38" r="3" fill="${P.ink}"/><circle cx="41" cy="38" r="3" fill="${P.ink}"/><path d="M84 60 q18 -10 6 -30" fill="none" ${o(8)}/><path d="M84 60 q18 -10 6 -30" fill="none" stroke="${P.orange}" stroke-width="4" stroke-linecap="round"/>` },
};

// ------------------------------------------------------------------ 목록
const list = [];
const add = (name, w, h, markup, extra) => list.push(Object.assign({ name, w, h, svg: markup }, extra || {}));

add('hero_idle', 400, 480, personSvg(400, 480, { outfit: 'tee', face: 'idle', arms: 'down' }), { pivotY: 0.03 });
add('hero_work', 400, 480, personSvg(400, 480, { outfit: 'tee', face: 'work', arms: 'work' }), { pivotY: 0.03 });
add('hero_cheer', 400, 480, personSvg(400, 480, { outfit: 'tee', face: 'cheer', arms: 'up' }), { pivotY: 0.03 });
add('hero_fever', 400, 480, personSvg(400, 480, { outfit: 'tee', face: 'cheer', arms: 'work', prop: 'megaphone' }), { pivotY: 0.03 });
add('hero_rest', 400, 480, personSvg(400, 480, { outfit: 'tee', face: 'sleep', arms: 'work', prop: 'coffee' }), { pivotY: 0.03 });
for (const t of ['alba', 'job', 'biz', 'inv', 'new']) {
  add('clone_' + t, 160, 192, personSvg(160, 192, { outfit: t, face: 'idle', arms: 'down' }), { pivotY: 0.03 });
  add('clone_' + t + '_cheer', 160, 192, personSvg(160, 192, { outfit: t, face: 'cheer', arms: 'up' }), { pivotY: 0.03 });
}
add('head', 96, 96, headSvg(96, 'idle'));
add('head_cheer', 96, 96, headSvg(96, 'cheer'));
add('head_work', 96, 96, headSvg(96, 'work'));
add('head_inv', 96, 96, headSvg(96, 'idle', 'inv'));
for (const b of ['b_store', 'b_delivery', 'b_cafe', 'b_office', 'b_shop', 'b_tower', 'b_hq', 'b_penthouse', 'p_villa', 'p_mall', 'p_mixed', 'p_building', 'plot_empty'])
  add(b, 256, 220, building(b), { pivotY: 0.03 });
for (const k of Object.keys(ICONS)) add('i_' + k, 96, 96, icon(k));
for (const k of Object.keys(UI)) {
  const u = UI[k];
  const extra = u.border ? { bl: u.border, br: u.border, bt: u.border, bb: u.borderB || u.border } : {};
  add('ui_' + k, u.w, u.h, svg(u.w, u.h, u.body), extra);
}
for (const k of Object.keys(PROPS)) {
  const u = PROPS[k];
  const extra = u.border ? { bl: u.border, br: u.border, bt: u.border, bb: u.borderB || u.border } : {};
  add('o_' + k, u.w, u.h, svg(u.w, u.h, u.body), extra);
}

module.exports = { list, P, TIER };
