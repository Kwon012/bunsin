// 경제 셀렉터(순수 함수): 고용가, 해금, 배수, 수입. 수치는 ECON(CSV)에서만 읽는다.
import { ECON, type City, type Job, type EconomyData } from '../data/economy';
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
/** 돈 m으로 살 수 있는 최대 인원 */
export function maxAffordable(j: Job, k: number, m: number): number {
  const first = hireCost(j, k);
  if (m < first) return 0;
  let n = Math.floor(Math.log((m * (j.costGrowth - 1)) / first + 1) / Math.log(j.costGrowth));
  while (n > 0 && hireCostN(j, k, n) > m * (1 + 1e-12)) n--;
  while (hireCostN(j, k, n + 1) <= m) n++;
  return n;
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

/** 팀 보너스 단계 수 */
export const teamSteps = (n: number): number => D.team.filter((m) => n >= m.count).length;
export const teamMult = (n: number): number => D.team.filter((m) => n >= m.count).reduce((a, m) => a * m.multiplier, 1);
export const nextTeam = (n: number): number | undefined => D.team.find((m) => n < m.count)?.count;

/** 자격증: level = 산 개수. 다음 자격증 인원 N, 열림 여부, 가격 */
export const certLevel = (s: GameState, id: string): number => s.certs[id] ?? 0;
export const certMult = (s: GameState, id: string): number => {
  const lv = certLevel(s, id);
  return D.cert.slice(0, lv).reduce((a, m) => a * m.multiplier, 1);
};
export function nextCert(s: GameState, j: Job): { level: number; count: number; open: boolean; price: number } | null {
  const lv = certLevel(s, j.id);
  const m = D.cert[lv];
  if (!m) return null;
  const price = j.baseCost * j.costGrowth ** (m.count + A.A6_certExpOffset) * eco('cert_price_mult');
  return { level: lv, count: m.count, open: owned(s, j.id) >= m.count, price };
}

export const totalFame = (s: GameState): number => s.fameByCity.reduce((a, b) => a + b, 0);
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
export function jobIncomeBase(s: GameState, j: Job, n = owned(s, j.id), certs = certMult(s, j.id)): number {
  if (n <= 0) return 0;
  return fin(j.incomePerSec * n * teamMult(n) * certs * fameMult(s) * uniqueMult(s, 'job', j.id));
}
/** 피버 제외 총 초당 수입 */
export const incomeBase = (s: GameState): number => cityJobs(s).reduce((a, j) => a + jobIncomeBase(s, j), 0);
/** 피버 포함 현재 초당 수입 */
export const incomeNow = (s: GameState): number => incomeBase(s) * feverMult(s);
/** 탭 1회 수입 */
export const tapValue = (s: GameState): number =>
  fin((city(s).tapBase + (A.X_tapUsesFever ? incomeNow(s) : incomeBase(s)) * eco('tap_income_ratio')) * uniqueMult(s, 'tap'));
