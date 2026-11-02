// 자동 플레이 봇(P2): core만으로 플레이해 §2.2 페이싱 목표와 비교한다. 탭·접속 패턴은 가정(아래 PERSONA).
import { describe, it, expect } from 'vitest';
import { newGame, type GameEvent, type GameState } from '../src/core/state';
import { eco } from '../src/core/econ';
import { advance } from '../src/core/sim';
import { tap, hire, buyCert } from '../src/core/actions';
import { recommend, canMove, wallInfo } from '../src/core/recommend';
import { moveCity } from '../src/core/move';
import { simulateOffline, collectOffline } from '../src/core/offline';
import { metricsSummary } from '../src/core/metrics';

// 가정: 첫 세션 10분은 초당 4탭, 이후 초당 1탭. 하루 3세션 × 30분, 세션 사이 오프라인 2시간 / 밤 8시간. 살 수 있으면 추천 구매.
const PERSONA = { firstTapsPerSec: 4, tapsPerSec: 1, sessionMin: 30, sessionsPerDay: 3, gapH: 2, nightH: 8 };

function playSession(s: GameState, sec: number, first: boolean) {
  const dt = 0.25;
  for (let t = 0; t < sec; t += dt) {
    const out: GameEvent[] = [];
    const rate = first && s.playTime < 600 ? PERSONA.firstTapsPerSec : PERSONA.tapsPerSec;
    if (Math.random() < rate * dt) tap(s, out);
    for (let k = 0; k < 5; k++) {
      const r = recommend(s);
      if (!r || r.cost > s.money) break;
      if (r.kind === 'hire') hire(s, r.jobId, 1, out); else buyCert(s, r.jobId, out);
    }
    if (canMove(s) && wallInfo(s).moveSuggest) moveCity(s, out);
    advance(s, dt, out);
  }
}

describe('자동 플레이 봇 페이싱(정보용)', () => {
  it('7일 시뮬레이션: 첫 분신 10초 안, 마을 공개 3분 안', () => {
    const s = newGame(eco('payday_first_sec'), 0);
    const t0 = performance.now();
    for (let day = 0; day < 7; day++) {
      for (let k = 0; k < PERSONA.sessionsPerDay; k++) {
        playSession(s, PERSONA.sessionMin * 60, day === 0 && k === 0);
        const rep = simulateOffline(s, (k === PERSONA.sessionsPerDay - 1 ? PERSONA.nightH : PERSONA.gapH) * 3600);
        collectOffline(s, rep);
        s.sessions++; s.sessionTime = 0;
      }
    }
    const m = metricsSummary(s);
    const min = (k: string) => (m.pacing[k] === undefined ? '-' : `${(m.pacing[k] / 60).toFixed(1)}분`);
    console.log(`[봇] 페이싱(누적 플레이): 첫 분신 ${m.pacing.first_clone}초 · 마을 공개 ${min('village_reveal')} · 첫 월급날 ${min('first_payday')} · 사무실 ${min('office')} · 매니저 ${min('manager')} · 가게 ${min('shop')} · 첫 이사 ${min('first_move')}`);
    console.log(`[봇] 7일 도시 ${s.cityIdx + 1}개 · 벽 노출 ${(m.wallExposure * 100).toFixed(0)}% · 최장 막다른 벽 ${(m.longestDeadWallSec / 60).toFixed(1)}분 · 배당 비중 ${(m.dividendShare * 100).toFixed(0)}% · 실행 ${Math.round(performance.now() - t0)}ms`);
    expect(m.pacing.first_clone).toBeLessThanOrEqual(10);
    expect(m.pacing.village_reveal).toBeLessThanOrEqual(180);
  }, 60000);
});
