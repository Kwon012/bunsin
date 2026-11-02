// 밸런스 리포트(정보용) + 최소 기준(첫 분신 10초, 마을 공개 3분). 상세 출력: BAL=1 npx vitest run tests/balance.test.ts
import { describe, it, expect } from 'vitest';
import { newBot, play, offline, mm } from './botlib';
import { formatKR } from '../src/core/format';
import { incomeBase, totalFame } from '../src/core/econ';
import { netWorth } from '../src/core/home';

const verbose = !!(globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.BAL;
// 페르소나 가정: 첫 3분 초당 4탭, 이후 접속 중 초당 1.5탭
const taps = (t: number) => (t < 180 ? 4 : 1.5);

describe('밸런스 v0.3', () => {
  it('첫 30분', () => {
    const b = newBot();
    const marks: string[] = [];
    for (let m = 1; m <= 30; m++) {
      play(b.s, 60, taps, b);
      if ([1, 2, 3, 5, 10, 15, 20, 30].includes(m)) marks.push(`${m}분: 현금 ${formatKR(b.s.money)} · 초당 ${formatKR(incomeBase(b.s))} · 총자산 ${formatKR(netWorth(b.s).total)} · 명성 ${totalFame(b.s)}`);
    }
    if (verbose) {
      console.log(b.log.map((l) => `${mm(l.t)} ${l.what}`).join('\n'));
      console.log(marks.join('\n'));
      console.log(`벽 ${Math.round(b.wallSec)}초 (최신 직종 벽 ${Math.round(b.wallNewestSec)}초) · 1분+ 벽: ${b.walls.map((w) => `${mm(w.start)} ${Math.round(w.len)}s ${w.rec}`).join(' / ')}`);
      const inc = b.s.metrics.income; const tot = Object.values(inc).reduce((a, x) => a + x, 0);
      console.log('수입 비중', Object.entries(inc).map(([k, v]) => `${k} ${(v / tot * 100).toFixed(0)}%`).join(' · '));
    }
    const f = b.s.metrics.firstAt;
    expect(f.first_clone).toBeLessThanOrEqual(10);
    expect(f.village_reveal).toBeLessThanOrEqual(180);
    expect(f.office).toBeLessThanOrEqual(30 * 60); // 사무실(직장) 첫 30분 안
    expect(f.first_house).toBeLessThanOrEqual(15 * 60); // 반지하 탈출이 첫 큰 목표
  });
  it('도시 1~3 완주(하루 3세션 × 30분, 사이 2시간·밤 8시간)', () => {
    const b = newBot();
    let day = 0;
    while (b.s.cityIdx < 3 && day < 40) {
      for (let k = 0; k < 3; k++) { play(b.s, 1800, taps, b, { move: true }); offline(b.s, k === 2 ? 8 * 3600 : 2 * 3600); }
      day++;
    }
    if (verbose) console.log(b.log.filter((l) => /첫 |이사|house/.test(l.what)).map((l) => `${(l.t / 60).toFixed(0)}분 ${l.what}`).join('\n'));
    if (verbose) console.log('1분+ 벽(도시1·2):', b.walls.filter((w) => w.start < 400 * 60).map((w) => `${Math.round(w.start / 60)}분 ${Math.round(w.len)}s ${w.rec}`).join(' / '));
    if (verbose) console.log(`일수 ${day} · 벽 ${(b.wallSec / b.s.playTime * 100).toFixed(0)}% (최신 직종 ${(b.wallNewestSec / Math.max(1, b.wallSec) * 100).toFixed(0)}%)`);
    const moves = b.log.filter((l) => l.what.startsWith('이사')).map((l) => l.t);
    expect(moves.length).toBeGreaterThanOrEqual(3);
    const d1 = moves[0], d2 = moves[1] - moves[0], d3 = moves[2] - moves[1];
    expect(d2).toBeGreaterThan(d1); expect(d3).toBeGreaterThan(d2 * 0.9); // 도시를 넘을수록 조금씩 더
    expect(b.wallNewestSec / Math.max(1, b.wallSec)).toBeGreaterThan(0.3);
  }, 60000);
});
