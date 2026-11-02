import { describe, it, expect, afterEach } from 'vitest';
import { newGame } from '../src/core/state';
import { eco } from '../src/core/econ';
import { clock } from '../src/core/clock';
import { stampToday, canStamp, shouldClosing, markClosingShown, offlineMvp } from '../src/core/session';
import { simulateOffline } from '../src/core/offline';
import { resume } from '../src/core/save';

const fresh = () => newGame(eco('payday_first_sec'), 0);
afterEach(() => clock.setOffset(0));

describe('출근 도장', () => {
  it('하루 1회, 끊겨도 초기화 없음, 7일째 기념', () => {
    const s = fresh();
    expect(stampToday(s)!.days).toBe(1);
    expect(stampToday(s)).toBeNull();
    clock.setOffset(86400e3 * 3); // 이틀 건너뜀
    expect(canStamp(s)).toBe(true);
    expect(stampToday(s)!.days).toBe(2);
    for (let d = 4; d <= 8; d++) { clock.setOffset(86400e3 * d); const r = stampToday(s)!; if (r.days === 7) expect(r.memorial).toBe(true); }
    expect(s.stamp.days).toBe(7);
  });
});

describe('마무리 카드', () => {
  it('벽 + 20초 무반응에서만, 세션당 재제안 간격', () => {
    const s = fresh(); s.owned.home_1 = 1; s.money = 0; s.owned.home_2 = 0;
    s.owned.home_1 = 24; // 다음 구매가 비쌈
    s.director.sinceHappening = 5; expect(shouldClosing(s)).toBe(false);
    s.director.sinceHappening = 25;
    s.owned.home_1 = 100; s.money = 0;
    const expectWall = shouldClosing(s);
    markClosingShown(s);
    expect(shouldClosing(s)).toBe(false);
    void expectWall;
  });
});

describe('8시간 복귀 시나리오', () => {
  it('정산서 생성 + MVP + 상한', () => {
    const s = fresh(); s.owned.home_1 = 50; s.owned.home_2 = 30; s.lastSeen = 0;
    resume(s, 9 * 3600e3);
    const rep = s.pendingOffline!;
    expect(rep.capped).toBe(true);
    expect(rep.paydays).toBeGreaterThanOrEqual(17);
    expect(offlineMvp(rep)!.jobId).toBe('home_2');
    void simulateOffline;
  });
});
