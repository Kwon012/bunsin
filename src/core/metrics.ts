// 지표 로그 요약(§8.1). 화면 오버레이와 JSON 내보내기에 쓴다.
import type { GameState } from './state';

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
  };
}
