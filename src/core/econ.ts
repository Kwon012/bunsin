// 경제 셀렉터(순수 함수): 고용가, 해금, 배수, 수입. 수치는 ECON(CSV)에서만 읽는다.
import { ECON, type City, type Job, type EconomyData, type Milestone } from '../data/economy';
import { A } from './assumptions';
import type { GameState } from './state';

export const D: EconomyData = ECON;
export const eco = (k: string): number => {
  const v = D.eco[k];
  if (v === undefined) throw new Error(`economy.csv 키 없음: ${k}`);
  return v;
};
export const acc = (k: string): number => {
  const v = D.accountNum[k];
  if (v === undefined) throw new Error(`account.csv 키 없음: ${k}`);
  return v;
};

const jobsByCity = new Map<number, Job[]>();
for (const c of D.cities) jobsByCity.set(c.city, D.jobs.filter((j) => j.city === c.city).sort((a, b) => a.slot - b.slot));
const jobById = new Map(D.jobs.map((j) => [j.id, j]));

export const city = (s: GameState): City => D.cities[s.cityIdx];
export const cityJobs = (s: GameState): Job[] => jobsByCity.get(city(s).city)!;
export const job = (id: string): Job => {
  const j = jobById.get(id);
  if (!j) throw new Error(`job 없음 ${id}`);
  return j;
};
export const owned = (s: GameState, id: string): number => s.owned[id] ?? 0;
export const totalClones = (s: GameState): number => cityJobs(s).reduce((a, j) => a + owned(s, j.id), 0);
export const fin = (n: number): number => (Number.isFinite(n) ? n : n > 0 ? Number.MAX_VALUE : 0);

/** 보유 k명일 때 다음 1명 고용가 */
export const hireCost = (j: Job, k: number): number => j.baseCost * j.costGrowth ** k;
/** 보유 k명에서 n명 일괄 고용 총액(등비합) */
export const hireCostN = (j: Job, k: number, n: number): number =>
  n <= 0 ? 0 : (j.baseCost * j.costGrowth ** k * (j.costGrowth ** n - 1)) / (j.costGrowth - 1);
/** 직종 정원(0 = 무제한) */
export const jobCap = (j: Job): number => (j.maxCount > 0 ? j.maxCount : Infinity);
export const capLeft = (j: Job, k: number): number => Math.max(0, jobCap(j) - k);
/** 돈 m으로 살 수 있는 최대 인원(정원까지) */
export function maxAffordable(j: Job, k: number, m: number): number {
  const first = hireCost(j, k);
  const left = capLeft(j, k);
  if (m < first || left <= 0) return 0;
  let n = Math.floor(Math.log((m * (j.costGrowth - 1)) / first + 1) / Math.log(j.costGrowth));
  while (n > 0 && hireCostN(j, k, n) > m * (1 + 1e-12)) n--;
  while (n < left && hireCostN(j, k, n + 1) <= m) n++;
  return Math.min(n, left);
}

/** 칸 해금 여부: 1칸은 항상, 이후는 이전 칸 unlock_prev_count(없으면 slot_unlock_default)명 */
export function isUnlocked(s: GameState, j: Job): boolean {
  if (j.slot === 1) return true;
  const prev = cityJobs(s)[j.slot - 2];
  const need = j.unlockPrevCount > 0 ? j.unlockPrevCount : eco('slot_unlock_default');
  return owned(s, prev.id) >= need;
}
export const unlockedJobs = (s: GameState): Job[] => cityJobs(s).filter((j) => isUnlocked(s, j));
export const nextLockedJob = (s: GameState): Job | undefined => cityJobs(s).find((j) => !isUnlocked(s, j));
export const unlockNeed = (j: Job): number => (j.unlockPrevCount > 0 ? j.unlockPrevCount : eco('slot_unlock_default'));

/** 단계 인원: milestone_count_pct=1이면 정원의 %, 아니면 절대 인원 */
export function stageCount(j: Job, m: Milestone): number {
  if ((D.eco.milestone_count_pct ?? 0) === 1 && j.maxCount > 0) return Math.max(1, Math.round((j.maxCount * m.count) / 100));
  return m.count;
}
export const teamCounts = (j: Job): number[] => D.team.map((m) => stageCount(j, m));
/** 팀 보너스: 합연산(1 + Σ(배수−1)) 또는 곱연산 */
export function teamMultFor(j: Job, n: number): number {
  const reached = D.team.filter((m) => n >= stageCount(j, m));
  if ((D.eco.team_bonus_additive ?? 0) === 1) return 1 + reached.reduce((a, m) => a + (m.multiplier - 1), 0);
  return reached.reduce((a, m) => a * m.multiplier, 1);
}
export const teamSteps = (j: Job, n: number): number => D.team.filter((m) => n >= stageCount(j, m)).length;
export const nextTeam = (j: Job, n: number): number | undefined => teamCounts(j).find((c) => n < c);

/** 자격증: level = 산 개수. 배수는 '가진 최고 단계의 값'(cert_level_absolute=1) 또는 곱 */
export const certLevel = (s: GameState, id: string): number => s.certs[id] ?? 0;
export const certMult = (s: GameState, id: string): number => {
  const lv = certLevel(s, id);
  if (lv <= 0) return 1;
  if ((D.eco.cert_level_absolute ?? 0) === 1) return D.cert[Math.min(lv, D.cert.length) - 1].multiplier;
  return D.cert.slice(0, lv).reduce((a, m) => a * m.multiplier, 1);
};
/** 다음 단계로 올렸을 때 배수 */
export const certMultNext = (s: GameState, id: string): number => {
  const lv = certLevel(s, id);
  const m = D.cert[lv];
  if (!m) return certMult(s, id);
  return (D.eco.cert_level_absolute ?? 0) === 1 ? m.multiplier : certMult(s, id) * m.multiplier;
};
export function nextCert(s: GameState, j: Job): { level: number; count: number; open: boolean; price: number; label: string; mult: number } | null {
  const lv = certLevel(s, j.id);
  const m = D.cert[lv];
  if (!m) return null;
  const count = stageCount(j, m);
  const price = j.baseCost * j.costGrowth ** (count + A.A6_certExpOffset) * eco('cert_price_mult');
  return { level: lv, count, open: owned(s, j.id) >= count, price, label: m.label, mult: certMultNext(s, j.id) };
}

// ---------- 자산(직종별 일터 1개, 판매 불가) ----------
export const assetOf = (jobId: string) => D.assets.find((a) => a.jobId === jobId);
export const ownsAsset = (s: GameState, id: string): boolean => s.assets.includes(id);
export const assetMult = (s: GameState, jobId: string): number => {
  const a = assetOf(jobId);
  return a && ownsAsset(s, a.id) ? a.incomeMult : 1;
};
// ---------- 단체 사진 수집 보너스 ----------
export const albumCount = (s: GameState): number => Object.keys(s.teamPhotos).length;
export const albumMult = (s: GameState): number => 1 + Math.min(eco('album_bonus_cap'), albumCount(s) * eco('album_bonus_per_photo'));

export const totalFame = (s: GameState): number => s.fameByCity.reduce((a, b) => a + b, 0) + (s.home?.fame ?? 0);
export const fameMult = (s: GameState): number => 1 + eco('fame_income_bonus') * totalFame(s);
export const feverMult = (s: GameState): number => (s.feverLeft > 0 ? eco('fever_mult') : 1);

/** 개성 분신 패시브(배치된 것만). kind: job(배치 건물 수입) / tap / payday */
export interface UniquePassive { kind: 'job' | 'tap' | 'payday'; value: number }
let passiveLookup: (id: string) => UniquePassive | undefined = () => undefined;
export function setUniquePassiveLookup(fn: (id: string) => UniquePassive | undefined) { passiveLookup = fn; }
export function uniqueMult(s: GameState, kind: UniquePassive['kind'], jobId?: string): number {
  let m = 1;
  for (const u of s.uniques) {
    if (!u.placedJob) continue;
    const p = passiveLookup(u.id);
    if (!p || p.kind !== kind) continue;
    if (kind === 'job' && u.placedJob !== jobId) continue;
    m *= 1 + p.value;
  }
  return m;
}

/** 직종 1개의 초당 수입(피버 제외). n을 주면 그 인원 기준 */
export function jobIncomeBase(s: GameState, j: Job, n = owned(s, j.id), certs = certMult(s, j.id), asset = assetMult(s, j.id), fame = fameMult(s)): number {
  if (n <= 0) return 0;
  return fin(j.incomePerSec * n * teamMultFor(j, n) * certs * asset * fame * albumMult(s) * uniqueMult(s, 'job', j.id));
}
/** 피버 제외 총 초당 수입 */
export const incomeBase = (s: GameState): number => cityJobs(s).reduce((a, j) => a + jobIncomeBase(s, j), 0);
/** 피버 포함 현재 초당 수입 */
export const incomeNow = (s: GameState): number => incomeBase(s) * feverMult(s);
/** 탭 1회 수입 */
export const tapValue = (s: GameState): number =>
  fin((city(s).tapBase + (A.X_tapUsesFever ? incomeNow(s) : incomeBase(s)) * eco('tap_income_ratio')) * uniqueMult(s, 'tap'));
