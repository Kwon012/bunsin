import { describe, it, expect } from 'vitest';
import { newGame } from '../src/core/state';
import { eco, hireCost, hireCostN, incomeBase, isUnlocked, job, maxAffordable, nextCert, tapValue, teamMult, fameMult } from '../src/core/econ';
import { hire, buyCert, tap } from '../src/core/actions';
import { recommend, wallInfo, updateGoal, goalProgress } from '../src/core/recommend';
import { formatKR, unitIndex } from '../src/core/format';

const fresh = () => newGame(eco('payday_first_sec'));

describe('고용가', () => {
  it('home_1 보유 10명 고용가 ≈ 19.6715', () => expect(hireCost(job('home_1'), 10)).toBeCloseTo(19.6715, 3));
  it('×10 일괄 = 개별 합', () => {
    const j = job('home_2');
    let sum = 0; for (let i = 5; i < 15; i++) sum += hireCost(j, i);
    expect(hireCostN(j, 5, 10)).toBeCloseTo(sum, 6);
  });
  it('최대 고용: 경계 정확', () => {
    const j = job('home_1');
    const m = hireCostN(j, 3, 7);
    expect(maxAffordable(j, 3, m)).toBe(7);
    expect(maxAffordable(j, 3, m - 0.01)).toBe(6);
  });
  it('고용 상한 없음 + 돈 차감', () => {
    const s = fresh(); s.money = 1e30;
    expect(hire(s, 'home_1', 'max')).toBe(true);
    expect(s.owned.home_1).toBeGreaterThan(900);
  });
  it('돈 부족이면 실패', () => { const s = fresh(); expect(hire(s, 'home_1', 1)).toBe(false); });
});

describe('해금·팀 보너스·자격증', () => {
  it('2칸은 1칸 25명에서 해금', () => {
    const s = fresh(); s.owned.home_1 = 24;
    expect(isUnlocked(s, job('home_2'))).toBe(false);
    s.money = 1e9; const out: any[] = [];
    hire(s, 'home_1', 1, out);
    expect(isUnlocked(s, job('home_2'))).toBe(true);
    expect(out.some((e) => e.t === 'unlock' && e.jobId === 'home_2')).toBe(true);
    expect(out.some((e) => e.t === 'team' && e.count === 25)).toBe(true);
  });
  it('8칸은 7칸 10명에서 해금(도쿄)', () => {
    const s = fresh(); s.cityIdx = 3;
    s.owned.tokyo_7 = 9; expect(isUnlocked(s, job('tokyo_8'))).toBe(false);
    s.owned.tokyo_7 = 10; expect(isUnlocked(s, job('tokyo_8'))).toBe(true);
  });
  it('팀 보너스 16단계 = ×2^16', () => {
    expect(teamMult(24)).toBe(1); expect(teamMult(25)).toBe(2); expect(teamMult(1000)).toBe(2 ** 16);
  });
  it('자격증: 25명에서 열림, 가격 = base × g^(N+10) × 4, ×3', () => {
    const s = fresh(); const j = job('home_1');
    s.owned.home_1 = 24; expect(nextCert(s, j)!.open).toBe(false);
    s.owned.home_1 = 25; const c = nextCert(s, j)!;
    expect(c.open).toBe(true);
    expect(c.price).toBeCloseTo(10 * 1.07 ** 35 * 4, 6);
    const before = incomeBase(s); s.money = c.price;
    expect(buyCert(s, 'home_1')).toBe(true);
    expect(incomeBase(s)).toBeCloseTo(before * 3, 6);
    expect(nextCert(s, j)!.count).toBe(50);
  });
});

describe('탭·피버·명성', () => {
  it('탭 = tap_base + 초당 수입 × 0.12', () => {
    const s = fresh(); s.owned.home_1 = 10;
    expect(tapValue(s)).toBeCloseTo(1 + 10 * 0.12, 9);
    const m = s.money; tap(s); expect(s.money - m).toBeCloseTo(2.2, 9);
  });
  it('연타 30회 → 피버, 수입 ×3', () => {
    const s = fresh(); s.owned.home_1 = 10; const out: any[] = [];
    for (let i = 0; i < 30; i++) tap(s, out);
    expect(s.feverLeft).toBe(eco('fever_duration_sec'));
    expect(out.some((e) => e.t === 'fever_start')).toBe(true);
  });
  it('명성 1당 +20% (더하기)', () => {
    const s = fresh(); s.fameByCity = [3, 2];
    expect(fameMult(s)).toBeCloseTo(2.0, 9);
  });
});

describe('추천·벽·목표', () => {
  it('추천은 비용/증가량 최소', () => {
    const s = fresh(); s.owned.home_1 = 25; s.owned.home_2 = 0;
    const r = recommend(s)!;
    expect(r).not.toBeNull();
    expect(['home_1', 'home_2']).toContain(r.jobId);
  });
  it('벽: 수입 대비 비싼 다음 구매', () => {
    const s = fresh(); s.owned.home_1 = 1; s.money = 0;
    s.owned.home_1 = 200; s.money = 0; // 초당 수입 크지만 비용이 더 큼
    const w = wallInfo(s);
    expect(w.eta).toBeGreaterThan(0);
  });
  it('목표 바: 새 게임 첫 목표는 마을 공개 또는 팀 보너스, 15%에서 시작', () => {
    const s = fresh(); s.money = 0; s.owned.home_1 = 1;
    const g = updateGoal(s)!;
    expect(g).not.toBeNull();
    expect(goalProgress(s, g)).toBeCloseTo(0.15, 9);
  });
  it('마을 공개 15명', () => {
    const s = fresh(); s.money = 1e6; const out: any[] = [];
    hire(s, 'home_1', 10, out); expect(out.some((e) => e.t === 'reveal')).toBe(false);
    hire(s, 'home_1', 10, out); expect(out.some((e) => e.t === 'reveal')).toBe(true);
  });
});

describe('한국식 단위', () => {
  it('경계', () => {
    expect(formatKR(9999)).toBe('9999');
    expect(formatKR(1e4)).toBe('1만');
    expect(formatKR(12345)).toBe('1만 2345');
    expect(formatKR(1e8)).toBe('1억');
    expect(formatKR(123456789)).toBe('1억 2345만');
    expect(formatKR(1e12)).toBe('1조');
    expect(formatKR(1e16)).toBe('1경');
    expect(formatKR(2.5e16)).toBe('2경 5000조');
    expect(formatKR(1e64)).toBe('1불가사의');
    expect(formatKR(2.4e67)).toBe('2400불가사의');
    expect(formatKR(Infinity)).toBe('∞');
    expect(formatKR(NaN)).toBe('0');
    expect(unitIndex(9999)).toBe(-1); expect(unitIndex(1e16)).toBe(3);
  });
});
