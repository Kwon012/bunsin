// 재접속·세션: 출근 도장, 마무리 카드 조건, 정산서 요약(MVP·부재중 뉴스)
import { clock } from './clock';
import { job } from './econ';
import { wallInfo } from './recommend';
import { happening } from './ledger';
import type { GameState, OfflineReport } from './state';

export const STAMP_MEMORIAL_DAY = 7;
export const CLOSING_IDLE_SEC = 20;
export const CLOSING_REPEAT_SEC = 600; // X-31 같은 세션에서 마무리 카드 재제안 간격
export const PARADE_MIN_SEC = 3600;     // X-32 귀가 행렬: 1시간 이상 비웠거나
export const PARADE_MIN_INCOME_SEC = 1800; // 초당 수입 30분치 이상 받을 때

/** 하루 첫 1탭. 끊겨도 초기화 없음(누적 일수만 센다), 놓친 날 표시 없음 */
export function canStamp(s: GameState): boolean { return s.stamp.lastDay !== clock.dayKey(); }
export function stampToday(s: GameState): { days: number; memorial: boolean } | null {
  if (!canStamp(s)) return null;
  s.stamp.lastDay = clock.dayKey();
  s.stamp.days++;
  happening(s);
  return { days: s.stamp.days, memorial: s.stamp.days === STAMP_MEMORIAL_DAY };
}

/** 마무리 카드: 다음 구매가 멀고(벽) 20초 넘게 아무 일 없음 */
export function shouldClosing(s: GameState): boolean {
  if (s.director.sinceHappening < CLOSING_IDLE_SEC) return false;
  if (s.director.sinceClosing < CLOSING_REPEAT_SEC && s.flags.closingShownSession === s.sessions) return false;
  return wallInfo(s).wall;
}
export function markClosingShown(s: GameState) { s.director.sinceClosing = 0; s.flags.closingShownSession = s.sessions; }

export function offlineMvp(rep: OfflineReport): { jobId: string; amount: number } | null {
  let best: { jobId: string; amount: number } | null = null;
  for (const [id, v] of Object.entries(rep.byJob)) if (!best || v > best.amount) best = { jobId: id, amount: v };
  return best;
}
export function mvpLine(s: GameState, rep: OfflineReport): string {
  const m = offlineMvp(rep);
  if (!m) return '';
  return `오늘의 MVP: ${job(m.jobId).name} 분신 #${1 + (7919 % Math.max(1, s.totalHired))}`;
}
export function absentNews(s: GameState): string[] { return s.director.news.slice(-3); }
