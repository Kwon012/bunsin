// 수입 기록·페이싱 지표 헬퍼
import type { GameState } from './state';

/** 돈을 벌 때 항상 이 함수를 거친다(출처별 지표 + 도시 누적 수입) */
export function earn(s: GameState, source: string, amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  s.money += amount;
  if (source !== 'settle') { s.cityEarned += amount; s.totalEarned += amount; }
  s.metrics.income[source] = (s.metrics.income[source] ?? 0) + amount;
}
/** 페이싱 시점 기록(처음 한 번) */
export function firstAt(s: GameState, key: string) {
  if (s.metrics.firstAt[key] === undefined) s.metrics.firstAt[key] = Math.round(s.playTime * 10) / 10;
}
/** '새 일이 일어남' → 무반응 타이머 초기화 */
export function happening(s: GameState) { s.director.sinceHappening = 0; }
