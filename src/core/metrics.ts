// 지표 로그 요약(§8.1). 화면 오버레이와 JSON 내보내기에 쓴다.
import type { GameState } from './state';
import { cityJobs, jobIncomeBase, incomeBase } from './econ';

export function metricsSummary(s: GameState) {
  const m = s.metrics;
  const totalIncome = Object.values(m.income).reduce((a, b) => a + b, 0);
  const pt = Math.max(1, s.playTime);
  return {
    playTimeSec: Math.round(s.playTime),
    idleRatio: m.idleSec / pt,
    wallExposure: m.wallSec / pt,
    deadWallRatio: m.deadWallSec / pt,
    longestDeadWallSec: Math.round(m.longestDeadWall),
    eventsShown: m.eventsShown,
    eventMissRatio: m.eventsShown ? m.eventsMissed / m.eventsShown : 0,
    closingCards: m.closingCards,
    dividendShare: totalIncome > 0 ? ((m.income.dividend ?? 0) + (m.income.open ?? 0)) / totalIncome : 0,
    incomeBySource: m.income,
    pacing: m.firstAt,
    /** R-004 직종별 수입 비중(현재 초당 수입 기준). 최신 직종 90% 이상이면 경고 */
    jobShare: (() => {
      const tot = incomeBase(s); const res: Record<string, number> = {};
      if (tot > 0) for (const j of cityJobs(s)) { const v = jobIncomeBase(s, j); if (v > 0) res[j.id] = v / tot; }
      return res;
    })(),
  };
}
