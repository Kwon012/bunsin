// 유저 액션: 고용, 자격증, 탭, 꾹 누르기, 피버. 이벤트는 out에 쌓는다.
import { A } from './assumptions';
import { cityJobs, eco, hireCost, hireCostN, isUnlocked, job, maxAffordable, nextCert, owned, tapValue, totalClones, D } from './econ';
import type { GameEvent, GameState } from './state';
import { earn, firstAt, happening } from './ledger';
import { unitIndex } from './format';

export type HireAmount = 1 | 10 | 'max';

export function hireQuote(s: GameState, jobId: string, amt: HireAmount): { n: number; cost: number } {
  const j = job(jobId);
  const k = owned(s, jobId);
  if (amt === 'max') {
    const n = maxAffordable(j, k, s.money);
    return { n, cost: hireCostN(j, k, n) };
  }
  return { n: amt, cost: hireCostN(j, k, amt) };
}

export function hire(s: GameState, jobId: string, amt: HireAmount, out: GameEvent[] = []): boolean {
  const j = job(jobId);
  if (!isUnlocked(s, j)) return false;
  const { n, cost } = hireQuote(s, jobId, amt);
  if (n <= 0 || cost > s.money * (1 + 1e-12)) return false;
  const before = owned(s, jobId);
  const lockedBefore = cityJobs(s).filter((x) => !isUnlocked(s, x)).map((x) => x.id);
  const clonesBefore = totalClones(s);
  s.money = Math.max(0, s.money - cost);
  s.owned[jobId] = before + n;
  s.totalHired += n;
  out.push({ t: 'hire', jobId, n });
  happening(s);
  firstAt(s, 'first_clone');
  // 팀 보너스 단계
  for (const m of D.team) if (before < m.count && before + n >= m.count) out.push({ t: 'team', jobId, count: m.count });
  // 새 칸 해금
  for (const id of lockedBefore) if (isUnlocked(s, job(id))) {
    out.push({ t: 'unlock', jobId: id });
    const tier = job(id).tier;
    if (tier === 'job') firstAt(s, 'office');
    if (tier === 'biz') firstAt(s, 'shop');
  }
  // 기념 분신(100·1000번째)
  const after = totalClones(s);
  for (const c of [100, 1000, 10000]) if (clonesBefore < c && after >= c) out.push({ t: 'crown', total: c });
  // 마을 공개(최초 1회)
  if (!s.flags.villageRevealed && after >= eco('village_reveal_clones')) {
    s.flags.villageRevealed = 1;
    firstAt(s, 'village_reveal');
    out.push({ t: 'reveal' });
  }
  if (j.isTop && before === 0) out.push({ t: 'top_hired', jobId });
  return true;
}

export function buyCert(s: GameState, jobId: string, out: GameEvent[] = []): boolean {
  const j = job(jobId);
  const c = nextCert(s, j);
  if (!c || !c.open || c.price > s.money * (1 + 1e-12)) return false;
  s.money = Math.max(0, s.money - c.price);
  s.certs[jobId] = c.level + 1;
  out.push({ t: 'cert', jobId, level: c.level + 1 });
  happening(s);
  firstAt(s, 'first_cert');
  return true;
}

/** 본체 탭. auto = 꾹 누르기/매니저 자동 탭(게이지 충전 느림) */
export function tap(s: GameState, out: GameEvent[] = [], auto = false, gaugeFactor = 1): number {
  const v = tapValue(s);
  earn(s, 'tap', v);
  s.taps++;
  s.sinceTap = 0;
  if (s.feverLeft > 0) s.feverCombo++;
  else {
    s.feverGauge = Math.min(1, s.feverGauge + (gaugeFactor * (auto ? A.X_holdGaugeFactor : 1)) / A.X_feverTapsToFill);
    if (s.feverGauge >= 1 - 1e-9) startFever(s, out);
  }
  out.push({ t: 'tap', amount: v, auto });
  checkUnit(s, out);
  return v;
}

export function startFever(s: GameState, out: GameEvent[] = []) {
  s.feverGauge = 0;
  s.feverLeft = eco('fever_duration_sec');
  s.feverCount++;
  s.feverCombo = 0;
  s.feverStreak = s.playTime - s.lastFeverEndAt <= A.X_feverStreakGapSec ? s.feverStreak + 1 : 1;
  firstAt(s, 'first_fever');
  happening(s);
  out.push({ t: 'fever_start' });
}

/** 새 한국식 단위를 처음 봤으면 이벤트 */
export function checkUnit(s: GameState, out: GameEvent[]) {
  const i = unitIndex(s.money);
  if (i > s.maxUnitSeen) {
    for (let k = s.maxUnitSeen + 1; k <= i; k++) if (k >= 0) out.push({ t: 'unit', index: k });
    s.maxUnitSeen = i;
  }
}
