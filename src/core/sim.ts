// 시간 진행. 수입이 구간별로 일정하다는 점을 이용해 이벤트 경계(월급날·피버 종료·매니저 1초)까지 한 번에 계산한다.
import { A } from './assumptions';
import { cityJobs, feverMult, jobIncomeBase } from './econ';
import { autoSaveAmount } from './account';
import { doPayday, paydayInterval } from './payday';
import { earn } from './ledger';
import { checkUnit, tap } from './actions';
import { executePurchase } from './purchase';
import { recommend, wallInfo } from './recommend';
import type { GameEvent, GameState } from './state';
import { checkUniques } from './uniques';

const IDLE_ALLOW_SEC = 15; // 무반응 지표 허용 시간(기획서 §8.1의 15~45초 중 최솟값)

function accrue(s: GameState, seg: number) {
  const fm = feverMult(s);
  let total = 0;
  for (const j of cityJobs(s)) {
    const e = jobIncomeBase(s, j) * fm * seg;
    if (e <= 0) continue;
    s.sinceJob[j.id] = (s.sinceJob[j.id] ?? 0) + e;
    total += e;
  }
  const saved = autoSaveAmount(s, total);
  earn(s, 'income', total - saved);
  if (saved > 0) { s.cityEarned += saved; s.totalEarned += saved; s.metrics.income.income = (s.metrics.income.income ?? 0) + saved; }
}

/** 매니저 1회 행동: 자동 응원(느린 자동 탭) + 추천 구매 1회 */
export function managerAct(s: GameState, out: GameEvent[]) {
  for (let i = 0; i < A.X_managerTapsPerSec; i++) tap(s, out, true);
  const r = recommend(s);
  if (r && r.cost <= s.money) executePurchase(s, r, out);
}

/** 접속 중 dt초 진행 */
export function advance(s: GameState, dt: number, out: GameEvent[] = []) {
  if (!(dt > 0)) return;
  let rem = dt;
  let guard = 0;
  while (rem > 1e-9 && guard++ < 100000) {
    let seg = Math.min(rem, Math.max(0, s.paydayIn));
    if (s.feverLeft > 0) seg = Math.min(seg, s.feverLeft);
    const mgr = s.managerUnlocked && s.managerOn;
    if (mgr) seg = Math.min(seg, Math.max(0, s.managerTimer));
    accrue(s, seg);
    s.paydayIn -= seg;
    s.playTime += seg; s.sessionTime += seg;
    s.sinceTap += seg;
    if (mgr) s.managerTimer -= seg;
    if (s.feverLeft > 0) {
      s.feverLeft -= seg;
      if (s.feverLeft <= 1e-9) {
        s.feverLeft = 0; s.lastFeverEndAt = s.playTime;
        s.bestCombo = Math.max(s.bestCombo, s.feverCombo);
        out.push({ t: 'fever_end', combo: s.feverCombo });
      }
    } else if (s.sinceTap > A.X_gaugeDecayDelaySec && s.feverGauge > 0) {
      s.feverGauge = Math.max(0, s.feverGauge - A.X_gaugeDecayPerSec * seg);
    }
    if (s.paydayIn <= 1e-9) { doPayday(s, out, true); s.paydayIn += paydayInterval(); }
    if (mgr && s.managerTimer <= 1e-9) { managerAct(s, out); s.managerTimer += A.A9_managerIntervalSec; }
    rem -= seg;
  }
  // 지표(프레임 단위 근사)
  const d = s.director;
  const before = d.sinceHappening;
  d.sinceHappening += dt; d.sinceEvent += dt; d.sinceNews += dt;
  s.metrics.idleSec += Math.max(0, d.sinceHappening - Math.max(before, IDLE_ALLOW_SEC));
  const w = wallInfo(s);
  if (w.wall) s.metrics.wallSec += dt;
  if (w.dead) { s.metrics.deadWallSec += dt; s.metrics.curDeadWall += dt; s.metrics.longestDeadWall = Math.max(s.metrics.longestDeadWall, s.metrics.curDeadWall); }
  else s.metrics.curDeadWall = 0;
  d.sinceClosing += dt;
  checkUnit(s, out);
  checkUniques(s, out);
}
