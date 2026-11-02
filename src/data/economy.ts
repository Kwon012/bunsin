// 경제 CSV(v0.2) 로더와 일관성 검증. 수치는 이 파일을 통해서만 읽는다.
// v0.3: 사용자 피드백 1차 반영(docs/feedback-v1-review.md). v0.2는 data/economy_v0.2에 보관.
import citiesCsv from '../../data/economy_v0.3/cities.csv?raw';
import jobsCsv from '../../data/economy_v0.3/jobs.csv?raw';
import economyCsv from '../../data/economy_v0.3/economy.csv?raw';
import accountCsv from '../../data/economy_v0.3/account.csv?raw';
import milestonesCsv from '../../data/economy_v0.3/milestones.csv?raw';
import assetsCsv from '../../data/economy_v0.3/assets.csv?raw';
import housesCsv from '../../data/economy_v0.3/houses.csv?raw';
import furnitureCsv from '../../data/economy_v0.3/furniture.csv?raw';
import { parseCsvObjects, num } from './csv';

export type Tier = 'alba' | 'job' | 'biz' | 'inv';
export const TIERS: Tier[] = ['alba', 'job', 'biz', 'inv'];

export interface City {
  city: number; id: string; name: string; theme: string; slots: number;
  moveSlot: number; moveCount: number; firstCost: number; firstIncome: number;
  settleFirstClones: number; settleMoney: number; fameUnit: number; tapBase: number;
  stockId: string; stockName: string; topBuilding: string;
}
export interface Job {
  city: number; slot: number; id: string; name: string; tier: Tier; tierLabel: string;
  baseCost: number; costGrowth: number; incomePerSec: number; unlockPrevCount: number; maxCount: number;
  paydayShare: number; offlineRate: number; paydayLine: string; isTop: boolean;
}
export interface Milestone { type: 'team' | 'cert'; count: number; multiplier: number; label: string }
export interface Asset { city: number; id: string; jobId: string; name: string; price: number; incomeMult: number }
export interface House { city: number; tier: number; id: string; name: string; price: number; fame: number }
export interface Furniture { houseId: string; id: string; name: string; maxLevel: number; baseCost: number; levelGrowth: number; famePerLevel: number }
export interface EconomyData {
  cities: City[];
  jobs: Job[];
  /** economy.csv key → 숫자 값 */
  eco: Record<string, number>;
  /** account.csv key → 원문 값(숫자는 accountNum으로) */
  account: Record<string, string>;
  accountNum: Record<string, number>;
  team: Milestone[];
  cert: Milestone[];
  assets: Asset[];
  houses: House[];
  furniture: Furniture[];
}

export interface RawCsv { cities: string; jobs: string; economy: string; account: string; milestones: string; assets: string; houses: string; furniture: string }

export function loadEconomy(raw: RawCsv = { cities: citiesCsv, jobs: jobsCsv, economy: economyCsv, account: accountCsv, milestones: milestonesCsv, assets: assetsCsv, houses: housesCsv, furniture: furnitureCsv }): EconomyData {
  const cities: City[] = parseCsvObjects(raw.cities).map((r) => ({
    city: num(r.city), id: r.id, name: r.name, theme: r.theme, slots: num(r.slots),
    moveSlot: num(r.move_slot), moveCount: num(r.move_count), firstCost: num(r.first_cost),
    firstIncome: num(r.first_income), settleFirstClones: num(r.settle_first_clones),
    settleMoney: num(r.settle_money), fameUnit: num(r.fame_unit),
    tapBase: num(r.tap_base), stockId: r.stock_id, stockName: r.stock_name_placeholder, topBuilding: r.top_building,
  }));
  const jobs: Job[] = parseCsvObjects(raw.jobs).map((r) => ({
    city: num(r.city), slot: num(r.slot), id: r.id, name: r.name, tier: r.tier as Tier,
    tierLabel: r.tier_label, baseCost: num(r.base_cost, r.id), costGrowth: num(r.cost_growth, r.id),
    incomePerSec: num(r.income_per_sec, r.id), unlockPrevCount: num(r.unlock_prev_count, r.id), maxCount: r.max_count ? num(r.max_count, r.id) : 0,
    paydayShare: num(r.payday_share, r.id), offlineRate: num(r.offline_rate, r.id),
    paydayLine: r.payday_line, isTop: r.is_top === '1',
  }));
  const eco: Record<string, number> = {};
  for (const r of parseCsvObjects(raw.economy)) eco[r.key] = num(r.value, r.key);
  const account: Record<string, string> = {};
  const accountNum: Record<string, number> = {};
  for (const r of parseCsvObjects(raw.account)) {
    account[r.key] = r.value;
    const n = Number(r.value);
    if (r.value !== '' && Number.isFinite(n)) accountNum[r.key] = n;
  }
  const ms: Milestone[] = parseCsvObjects(raw.milestones).map((r) => ({
    type: r.type as 'team' | 'cert', count: num(r.count), multiplier: num(r.multiplier), label: r.label ?? '',
  }));
  const assets: Asset[] = parseCsvObjects(raw.assets).map((r) => ({ city: num(r.city), id: r.id, jobId: r.job_id, name: r.name, price: num(r.price, r.id), incomeMult: num(r.income_mult, r.id) }));
  const houses: House[] = parseCsvObjects(raw.houses).map((r) => ({ city: num(r.city), tier: num(r.tier), id: r.id, name: r.name, price: num(r.price, r.id), fame: num(r.fame, r.id) }));
  const furniture: Furniture[] = parseCsvObjects(raw.furniture).map((r) => ({ houseId: r.house_id, id: r.id, name: r.name, maxLevel: num(r.max_level, r.id), baseCost: num(r.base_cost, r.id), levelGrowth: num(r.level_growth, r.id), famePerLevel: num(r.fame_per_level, r.id) }));
  const team = ms.filter((m) => m.type === 'team').sort((a, b) => a.count - b.count);
  const cert = ms.filter((m) => m.type === 'cert').sort((a, b) => a.count - b.count);
  return { cities, jobs, eco, account, accountNum, team, cert, assets, houses, furniture };
}

const REQUIRED_ECO = ['tap_income_ratio', 'fever_mult', 'fever_duration_sec', 'payday_first_sec', 'payday_interval_sec',
  'payday_min_income_sec', 'offline_cap_sec', 'offline_after_cap_ratio', 'manager_unlock_paydays', 'cert_price_mult',
  'team_bonus_additive', 'cert_level_absolute', 'milestone_count_pct', 'album_bonus_per_photo', 'album_bonus_cap',
  'offline_payday_floor_ratio', 'home_clone_cap', 'move_recommend_eta_sec', 'fame_income_bonus', 'village_reveal_clones',
  'event_idle_sec', 'event_min_gap_sec', 'news_interval_sec', 'hidden_scenes_per_city', 'slot_unlock_default'];
const REQUIRED_ACCOUNT = ['open_bonus_income_sec', 'auto_save_ratio', 'dividend_rate', 'cap_income_sec',
  'offline_dividend_full_paydays', 'offline_dividend_after_ratio', 'break_suggest_eta_sec',
  'held_stock_dividend_rate', 'held_stock_dividend_cap_income_sec'];

/** 일관성 검증. 문제 목록을 돌려준다(빈 배열 = 통과). */
export function validateEconomy(d: EconomyData): string[] {
  const errs: string[] = [];
  if (d.cities.length !== 8) errs.push(`도시 수 ${d.cities.length} ≠ 8`);
  if (d.jobs.length !== 58) errs.push(`직종 수 ${d.jobs.length} ≠ 58`);
  const ids = new Set<string>();
  for (const j of d.jobs) {
    if (ids.has(j.id)) errs.push(`직종 id 중복 ${j.id}`);
    ids.add(j.id);
    if (!['alba', 'job', 'biz', 'inv'].includes(j.tier)) errs.push(`${j.id} tier 이상: ${j.tier}`);
    if (!(j.costGrowth > 1)) errs.push(`${j.id} cost_growth ≤ 1`);
    if (!(j.baseCost > 0 && j.incomePerSec > 0)) errs.push(`${j.id} 가격/수입 ≤ 0`);
  }
  for (const c of d.cities) {
    const js = d.jobs.filter((j) => j.city === c.city).sort((a, b) => a.slot - b.slot);
    if (js.length !== c.slots) errs.push(`도시 ${c.city} 칸 수 ${js.length} ≠ slots ${c.slots}`);
    js.forEach((j, i) => { if (j.slot !== i + 1) errs.push(`도시 ${c.city} 칸 번호 불연속 (${j.id})`); });
    const tops = js.filter((j) => j.isTop);
    if (tops.length !== 1) errs.push(`도시 ${c.city} is_top ${tops.length}개`);
    else if (tops[0].slot !== c.moveSlot) errs.push(`도시 ${c.city} is_top 칸 ${tops[0].slot} ≠ move_slot ${c.moveSlot}`);
    if (js[0] && js[0].unlockPrevCount !== 0) errs.push(`도시 ${c.city} 1칸 unlock_prev_count ≠ 0`);
    for (const j of js.slice(1)) if (!(j.unlockPrevCount > 0)) errs.push(`${j.id} 해금 조건 없음(체인 끊김)`);
    if (js[0] && js[0].baseCost !== c.firstCost) errs.push(`도시 ${c.city} first_cost ≠ 1칸 base_cost`);
    if (js[0] && js[0].incomePerSec !== c.firstIncome) errs.push(`도시 ${c.city} first_income ≠ 1칸 수입`);
    // 칸 계층: 1~3 알바, 4 직장, 5~6 사업, 7~8 투자
    const expectTier: Tier[] = ['alba', 'alba', 'alba', 'job', 'biz', 'biz', 'inv', 'inv'];
    for (const j of js) if (expectTier[j.slot - 1] !== j.tier) errs.push(`${j.id} tier ${j.tier} ≠ 칸 계층 ${expectTier[j.slot - 1]}`);
  }
  const slots = d.cities.map((c) => c.slots).join(',');
  if (slots !== '5,6,7,8,8,8,8,8') errs.push(`도시별 칸 수 ${slots}`);
  for (const k of REQUIRED_ECO) if (!(k in d.eco)) errs.push(`economy.csv 키 없음: ${k}`);
  for (const k of REQUIRED_ACCOUNT) if (!(k in d.accountNum)) errs.push(`account.csv 키 없음: ${k}`);
  if (!d.team.length) errs.push('팀 보너스 단계 없음');
  if (!d.cert.length) errs.push('자격증 단계 없음');
  for (const j of d.jobs) {
    if (!d.assets.some((a) => a.jobId === j.id)) errs.push(`${j.id} 자산 없음`);
    if (j.maxCount > 0 && j.unlockPrevCount > 0) {
      const prev = d.jobs.find((x) => x.city === j.city && x.slot === j.slot - 1);
      if (prev && prev.maxCount > 0 && j.unlockPrevCount > prev.maxCount) errs.push(`${j.id} 해금 조건 ${j.unlockPrevCount} > 이전 칸 정원 ${prev.maxCount}`);
    }
  }
  for (const c of d.cities) {
    const hs = d.houses.filter((h) => h.city === c.city).sort((a, b) => a.tier - b.tier);
    if (hs.length < 2) errs.push(`도시 ${c.city} 집 단계 ${hs.length}`);
    if (hs[0] && hs[0].price !== 0) errs.push(`도시 ${c.city} 첫 집은 무료(시작 집)여야 함`);
    for (const h of hs) if (!d.furniture.some((f) => f.houseId === h.id)) errs.push(`${h.id} 가구 없음`);
  }
  return errs;
}

/** 앱 전역에서 쓰는 단일 인스턴스 */
export const ECON: EconomyData = loadEconomy();
