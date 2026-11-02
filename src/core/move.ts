// 이사(프레스티지): 꼭대기 직종 첫 고용 후 가능. 초기화 = 돈·분신·자격증 / 유지 = 명성·매니저·통장·개성 분신
import { city, cityJobs, totalFame, totalClones, eco, D } from './econ';
import { accountOnMove } from './account';
import { autoPlace } from './uniques';
import { canMove } from './recommend';
import { earn, firstAt, happening } from './ledger';
import type { GameEvent, GameState } from './state';

/** 이번 이사로 얻을 명성: floor(√(그 도시 누적 수입 ÷ fame_unit)) */
export const fameGainNow = (s: GameState): number => Math.floor(Math.sqrt(Math.max(0, s.cityEarned) / city(s).fameUnit));

export function movePreview(s: GameState) {
  const gain = fameGainNow(s);
  const bonus = eco('fame_income_bonus');
  const next = D.cities[s.cityIdx + 1];
  return {
    next, gain,
    multNow: 1 + bonus * totalFame(s),
    multAfter: 1 + bonus * (totalFame(s) + gain),
    settle: next?.settleMoney ?? 0,
    uniques: s.uniques.length,
  };
}

export function moveCity(s: GameState, out: GameEvent[] = []): boolean {
  if (!canMove(s)) return false;
  const from = s.cityIdx;
  const gain = fameGainNow(s);
  s.fameByCity[from] = (s.fameByCity[from] ?? 0) + gain;
  s.cityHistory.push({ cityIdx: from, clones: totalClones(s), earned: s.cityEarned, fame: gain });
  s.cityIdx = from + 1;
  // 초기화
  s.money = 0; s.owned = {}; s.certs = {}; s.cityEarned = 0; s.sinceJob = {};
  s.feverLeft = 0; s.feverGauge = 0; s.goal = null; s.teamSeen = {};
  for (const u of s.uniques) u.placedJob = null;
  // 유지: 명성(fameByCity), 매니저, 통장(지금 종목 → 보유 종목), 개성 분신
  accountOnMove(s);
  autoPlace(s);
  const nc = city(s);
  earn(s, 'settle', nc.settleMoney);
  firstAt(s, 'first_move');
  happening(s);
  out.push({ t: 'move', fromCity: from, toCity: s.cityIdx, fameGain: gain, settle: nc.settleMoney });
  return true;
}

/** 디버그: 도시 n(1-based)의 직전 도시에서 꼭대기 직종을 막 첫 고용한 상태를 만든다 */
export function debugPrepareMove(s: GameState, targetCity: number) {
  const idx = Math.max(0, Math.min(D.cities.length - 2, targetCity - 2));
  s.cityIdx = idx; s.owned = {}; s.certs = {}; s.money = 0; s.cityEarned = 0; s.sinceJob = {};
  const jobs = cityJobs(s);
  jobs.forEach((j, i) => {
    const nxt = jobs[i + 1];
    s.owned[j.id] = j.isTop ? 1 : nxt ? nxt.unlockPrevCount : 1;
  });
  for (const u of s.uniques) u.placedJob = null;
  autoPlace(s);
}
