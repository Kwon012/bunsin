// 경제 데이터 v0.3 생성기. 사용: node tools/gen_v03.mjs
// 도시 1·2는 직접 정한 파라미터(초반 30분 튜닝 대상), 도시 3~8은 템플릿(도시가 넘어갈수록 조금씩 오래 걸리게).
// 결과 CSV는 UTF-8 BOM + LF. 큰 수는 유효숫자 3자리.
import { readFileSync, writeFileSync } from 'node:fs';

const P = JSON.parse(readFileSync(new URL('./params_v03.json', import.meta.url), 'utf8'));
const v02jobs = readFileSync(new URL('../data/economy_v0.2/jobs.csv', import.meta.url), 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1).map((l) => l.split(','));
const v02cities = readFileSync(new URL('../data/economy_v0.2/cities.csv', import.meta.url), 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1).map((l) => l.split(','));

const sig = (x) => (x === 0 ? 0 : Number(x.toPrecision(4)));
const fmt = (x) => { const v = sig(x); return Math.abs(v) >= 1e15 ? v.toExponential(2).toUpperCase().replace('E+', 'E+') : String(v); };
const TIER = ['alba', 'alba', 'alba', 'job', 'biz', 'biz', 'inv', 'inv'];
const TIER_LABEL = { alba: '알바', job: '직장', biz: '사업', inv: '투자' };
const LINE = { alba: '주휴수당', job: '월급 상여', biz: '결산 보너스', inv: '운용 수익' };

const cities = [], jobs = [], assets = [], houses = [], furniture = [];
let prevTopCost = 0, prevTopInc = 0, prevTopPayback = 0;
for (let ci = 0; ci < 8; ci++) {
  const c = ci + 1;
  const vc = v02cities[ci];
  const slots = Number(vc[4]);
  const cp = { ...(P.cities[String(c)] ?? (() => {
    // 템플릿: 도시 2 파라미터를 기준으로 도시마다 조금씩 오래 걸리게
    const b = P.cities['2']; const k = c - 2;
    return { ...b, cap: b.cap + P.template.capPerCity * k, firstPayback: b.firstPayback * (1 + P.template.paybackGrowth * k) };
  })()) };
  // 도시 2~: 꼭대기 회수 기간 = 이전 도시 꼭대기 × topPaybackMul → 칸 사이 가격 배율을 역산(칸 수가 달라도 '조금씩 더')
  if (c > 1) {
    const topPayback = prevTopPayback * (c === 2 ? P.topPaybackMul : P.template.topPaybackGrowth);
    cp.costStep = cp.incStep * (topPayback / cp.firstPayback) ** (1 / (slots - 1));
  }
  const firstCost = c === 1 ? cp.firstCost : prevTopCost * cp.firstCostMul;
  // 도시 2~: 첫 분신 가격 = 이전 꼭대기 × firstCostMul, 수입은 '첫 분신 회수 기간(초)'으로 정한다
  const firstInc = c === 1 ? cp.firstInc : firstCost / cp.firstPayback;
  const cityJobs = [];
  for (let s = 1; s <= slots; s++) {
    const vj = v02jobs.find((j) => Number(j[0]) === c && Number(j[1]) === s);
    const tier = TIER[s - 1];
    const cost = firstCost * cp.costStep ** (s - 1) * (cp.costAdj?.[s - 1] ?? 1);
    const inc = firstInc * cp.incStep ** (s - 1) * (cp.incAdj?.[s - 1] ?? 1);
    const growth = cp.growth[s - 1] ?? (cp.growth[0] + 0.005 * (s - 1));
    const unlock = s === 1 ? 0 : s === 8 ? P.unlockSlot8 : Math.round(cp.cap * P.unlockPct);
    const share = P.paydayShare[tier];
    const off = tier === 'inv' ? 1.0 : 0.25;
    const isTop = s === slots ? 1 : 0;
    const row = { c, s, id: vj[2], name: vj[3], tier, cost, growth, inc, unlock, cap: cp.cap, share, off, isTop };
    cityJobs.push(row); jobs.push(row);
  }
  const top = cityJobs[cityJobs.length - 1];
  prevTopCost = top.cost; prevTopInc = top.inc; prevTopPayback = top.cost / top.inc;
  const fameUnit = cp.fameUnit ?? firstCost * P.fameUnitPerFirstCost;
  cities.push({ c, id: vc[1], name: vc[2], theme: vc[3], slots, firstCost, firstInc, settleClones: c === 1 ? 0 : 3,
    settle: c === 1 ? 0 : firstCost * 3.3, fameUnit, tapBase: c === 1 ? cp.tapBase : firstInc, stockId: vc[17], stockName: vc[18], top: vc[19] });
  // 자산: 직종별 일터 1개(판매 불가). 가격 = 그 직종 base_cost × assetMul
  const names = P.assetNames[String(c)];
  cityJobs.forEach((j, i) => {
    const name = names?.[i] ?? `${j.name.replace(/ (알바|사원|사장|대표|회장|오너|직원)$/, '')} 건물`;
    const price = P.assetPrice?.[String(c)]?.[i] ?? j.cost * P.assetMul * (1 + 0.5 * i);
    assets.push({ c, id: `as_${j.id}`, job: j.id, name, price, mult: P.assetIncomeMult });
  });
  // 집 3단계(2번 구매) + 가구 4종 × 3레벨
  const hn = P.houseNames[String(c)] ?? [`${vc[2]} 원룸`, `${vc[2]} 아파트`, `${vc[2]} 펜트하우스`];
  const hp = P.housePrice?.[String(c)] ?? [0, cityJobs[2].cost * P.houseMul[1], cityJobs[Math.min(4, slots - 1)].cost * P.houseMul[2]];
  hn.forEach((name, t) => {
    const hid = `h${c}_${t + 1}`;
    houses.push({ c, tier: t + 1, id: hid, name, price: hp[t], fame: t === 0 ? 0 : P.houseFame });
    const fb = (P.furnBase?.[String(c)]?.[t]) ?? (t === 0 ? cityJobs[1].cost * P.furnBaseMul[0] : hp[t] * P.furnBaseMul[t]);
    P.furniture[t].forEach((fname, k) => furniture.push({ house: hid, id: `${hid}_f${k + 1}`, name: fname, maxLv: P.furnMaxLevel, base: fb * (1 + 0.25 * k), growth: P.furnGrowth, fame: P.furnFame }));
  });
}

const BOM = '﻿';
const w = (f, head, rows) => writeFileSync(new URL(`../data/economy_v0.3/${f}`, import.meta.url), BOM + [head, ...rows].join('\n') + '\n');
w('cities.csv', 'city,id,name,theme,slots,move_slot,move_count,first_cost,first_income,settle_first_clones,settle_money,fame_unit,tap_base,stock_id,stock_name_placeholder,top_building',
  cities.map((c) => [c.c, c.id, c.name, c.theme, c.slots, c.slots, 1, fmt(c.firstCost), fmt(c.firstInc), c.settleClones, fmt(c.settle), fmt(c.fameUnit), fmt(c.tapBase), c.stockId, c.stockName, c.top].join(',')));
w('jobs.csv', 'city,slot,id,name,tier,tier_label,base_cost,cost_growth,income_per_sec,unlock_prev_count,max_count,payday_share,offline_rate,payday_line,is_top',
  jobs.map((j) => [j.c, j.s, j.id, j.name, j.tier, TIER_LABEL[j.tier], fmt(j.cost), j.growth.toFixed(3), fmt(j.inc), j.unlock, j.cap, j.share, j.off.toFixed(2), LINE[j.tier], j.isTop].join(',')));
w('assets.csv', 'city,id,job_id,name,price,income_mult', assets.map((a) => [a.c, a.id, a.job, a.name, fmt(a.price), a.mult].join(',')));
w('houses.csv', 'city,tier,id,name,price,fame', houses.map((h) => [h.c, h.tier, h.id, h.name, fmt(h.price), h.fame].join(',')));
w('furniture.csv', 'house_id,id,name,max_level,base_cost,level_growth,fame_per_level', furniture.map((f) => [f.house, f.id, f.name, f.maxLv, fmt(f.base), f.growth, f.fame].join(',')));
console.log(`cities ${cities.length}, jobs ${jobs.length}, assets ${assets.length}, houses ${houses.length}, furniture ${furniture.length}`);
