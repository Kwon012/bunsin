// 추천 구매(A7), ETA, 벽(R-015), 목표 바(A8)
import { A } from './assumptions';
import { acc, certMult, cityJobs, eco, hireCost, hireCostN, incomeBase, incomeNow, isUnlocked, jobIncomeBase, nextCert, nextLockedJob, nextTeam, owned, totalClones, unlockNeed, job, D } from './econ';
import type { Job } from '../data/economy';
import type { GameState, Goal } from './state';

export interface Purchase { kind: 'hire' | 'cert'; jobId: string; cost: number; gain: number; ratio: number }

export function purchases(s: GameState): Purchase[] {
  const res: Purchase[] = [];
  for (const j of cityJobs(s)) {
    if (!isUnlocked(s, j)) continue;
    const k = owned(s, j.id);
    const now = jobIncomeBase(s, j);
    const cost = hireCost(j, k);
    const gain = jobIncomeBase(s, j, k + 1) - now;
    res.push({ kind: 'hire', jobId: j.id, cost, gain, ratio: gain > 0 ? cost / gain : Infinity });
    const c = nextCert(s, j);
    if (c && c.open) {
      const cg = now * (D.cert[c.level].multiplier - 1);
      res.push({ kind: 'cert', jobId: j.id, cost: c.price, gain: cg, ratio: cg > 0 ? c.price / cg : Infinity });
    }
  }
  return res;
}

export function recommend(s: GameState): Purchase | null {
  let best: Purchase | null = null;
  for (const p of purchases(s)) if (!best || p.ratio < best.ratio) best = p;
  return best;
}

export const accountTotal = (s: GameState): number =>
  (s.account.current?.balance ?? 0) + s.account.held.reduce((a, h) => a + h.balance, 0);

/** 비용까지 남은 시간(초). 이미 살 수 있으면 0 */
export function etaFor(s: GameState, cost: number): number {
  const need = cost - s.money;
  if (need <= 0) return 0;
  const inc = incomeNow(s);
  return inc > 0 ? need / inc : Infinity;
}

export const topJob = (s: GameState): Job => cityJobs(s).find((j) => j.isTop)!;
export const canMove = (s: GameState): boolean => s.cityIdx < D.cities.length - 1 && owned(s, topJob(s).id) >= 1;

export interface WallInfo { rec: Purchase | null; eta: number; wall: boolean; dead: boolean; breakSuggest: boolean; moveSuggest: boolean }
/** 벽 = 다음 추천 구매까지 move_recommend_eta_sec 이상(통장으로 살 수 있으면 제외) */
export function wallInfo(s: GameState): WallInfo {
  const rec = recommend(s);
  const eta = rec ? etaFor(s, rec.cost) : Infinity;
  const coverable = !!rec && s.money + accountTotal(s) >= rec.cost && accountTotal(s) > 0;
  const longWait = eta >= eco('move_recommend_eta_sec');
  const wall = longWait && !coverable;
  const topOwned = owned(s, topJob(s).id) >= 1;
  return {
    rec, eta, wall, dead: wall && !topOwned,
    breakSuggest: !!rec && eta > acc('break_suggest_eta_sec') && coverable,
    moveSuggest: canMove(s) && longWait,
  };
}

// ---------- 목표 바 ----------
function goalCandidates(s: GameState): Goal[] {
  const out: Goal[] = [];
  const total = totalClones(s);
  if (!s.flags.villageRevealed) {
    const j = cityJobs(s)[0];
    out.push({ kind: 'reveal', jobId: j.id, target: eco('village_reveal_clones'), start: total, label: '마을 공개' });
  }
  for (const j of cityJobs(s)) {
    if (!isUnlocked(s, j)) continue;
    const k = owned(s, j.id);
    const t = nextTeam(k);
    if (t !== undefined) out.push({ kind: 'team', jobId: j.id, target: t, start: k, label: `${j.name} 팀 보너스` });
    const c = nextCert(s, j);
    if (c && !c.open) out.push({ kind: 'cert', jobId: j.id, target: c.count, start: k, label: `${j.name} 자격증` });
    if (j.isTop && k === 0) out.push({ kind: 'top', jobId: j.id, target: 1, start: 0, label: `${j.name} 첫 고용(이사)` });
  }
  const lock = nextLockedJob(s);
  if (lock) {
    const prev = cityJobs(s)[lock.slot - 2];
    out.push({ kind: 'unlock', jobId: prev.id, target: unlockNeed(lock), start: owned(s, prev.id), label: `${lock.name} 해금` });
  }
  return out;
}

/** 목표까지 남은 인원과 그 비용 */
export function goalRemaining(s: GameState, g: Goal): { left: number; cost: number } {
  if (g.kind === 'reveal') {
    const left = Math.max(0, g.target - totalClones(s));
    const j = job(g.jobId);
    return { left, cost: hireCostN(j, owned(s, j.id), left) };
  }
  const j = job(g.jobId);
  const k = owned(s, j.id);
  const left = Math.max(0, g.target - k);
  return { left, cost: hireCostN(j, k, left) };
}
export const goalEta = (s: GameState, g: Goal): number => etaFor(s, goalRemaining(s, g).cost);
export const goalDone = (s: GameState, g: Goal): boolean => {
  if (g.kind === 'reveal') return !!s.flags.villageRevealed;
  return goalRemaining(s, g).left <= 0;
};

/** 현재 목표 유지, 끝났거나 없으면 새로 고른다 */
export function updateGoal(s: GameState): Goal | null {
  if (s.goal && !goalDone(s, s.goal)) return s.goal;
  const cands = goalCandidates(s).filter((g) => !goalDone(s, g));
  if (!cands.length) { s.goal = null; return null; }
  const scored = cands.map((g) => ({ g, eta: goalEta(s, g) }));
  const within = scored.filter((x) => x.eta <= A.A8_goalMaxEtaSec);
  const pool = within.length ? within : scored;
  pool.sort((a, b) => a.eta - b.eta || goalRemaining(s, a.g).left - goalRemaining(s, b.g).left);
  s.goal = { ...pool[0].g };
  return s.goal;
}

/** 표시용 진행률: A8_goalStartFill에서 시작해 목표 달성 시 1 */
export function goalProgress(s: GameState, g: Goal): number {
  const cur = g.kind === 'reveal' ? totalClones(s) : owned(s, g.jobId);
  const span = Math.max(1, g.target - g.start);
  const f = Math.min(1, Math.max(0, (cur - g.start) / span));
  return A.A8_goalStartFill + (1 - A.A8_goalStartFill) * f;
}

export { incomeBase, certMult };
