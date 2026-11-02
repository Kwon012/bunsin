import { describe, it, expect } from 'vitest';
import { newGame } from '../src/core/state';
import { eco, hireCost, hireCostN, incomeBase, isUnlocked, job, maxAffordable, nextCert, tapValue, teamMultFor, teamCounts, fameMult, certMult, jobCap, albumMult, D } from '../src/core/econ';
import { hire, buyCert, tap } from '../src/core/actions';
import { recommend, wallInfo, updateGoal, goalProgress } from '../src/core/recommend';
import { formatKR, unitIndex } from '../src/core/format';

const fresh = () => newGame(eco('payday_first_sec'));
const j1 = job('home_1');

describe('고용가·정원', () => {
  it('고용가 = base × growth^보유수', () => expect(hireCost(j1, 10)).toBeCloseTo(j1.baseCost * j1.costGrowth ** 10, 6));
  it('×10 일괄 = 개별 합', () => {
    const j = job('home_2'); let sum = 0; for (let i = 5; i < 15; i++) sum += hireCost(j, i);
    expect(hireCostN(j, 5, 10)).toBeCloseTo(sum, 6);
  });
  it('최대 고용: 경계 정확', () => {
    const m = hireCostN(j1, 3, 7);
    expect(maxAffordable(j1, 3, m)).toBe(7);
    expect(maxAffordable(j1, 3, m * 0.999)).toBe(6);
  });
  it('정원까지만 고용(최대·×10 모두)', () => {
    const s = fresh(); s.money = 1e30;
    expect(hire(s, 'home_1', 'max')).toBe(true);
    expect(s.owned.home_1).toBe(jobCap(j1));
    expect(hire(s, 'home_1', 1)).toBe(false);
  });
  it('돈 부족이면 실패', () => { const s = fresh(); expect(hire(s, 'home_1', 1)).toBe(false); });
});

describe('해금·팀 보너스(합연산)·자격증(현실 배수)', () => {
  it('2칸은 1칸 정원 50%에서 해금 + 첫 고용 이벤트 + 단체 사진 수집', () => {
    const need = job('home_2').unlockPrevCount;
    const s = fresh(); s.money = 1e12; const out: any[] = [];
    hire(s, 'home_1', need - 1, out);
    expect(isUnlocked(s, job('home_2'))).toBe(false);
    expect(out.some((e) => e.t === 'first_job' && e.jobId === 'home_1')).toBe(true);
    hire(s, 'home_1', 1, out);
    expect(isUnlocked(s, job('home_2'))).toBe(true);
    expect(out.some((e) => e.t === 'unlock' && e.jobId === 'home_2')).toBe(true);
    expect(Object.keys(s.teamPhotos).length).toBeGreaterThan(0);
  });
  it('팀 보너스: 정원의 20·40·60·80·100%마다 +20%, 정원 가득 = ×2', () => {
    const cap = jobCap(j1);
    expect(teamCounts(j1)).toEqual([0.2, 0.4, 0.6, 0.8, 1].map((p) => Math.round(cap * p)));
    expect(teamMultFor(j1, teamCounts(j1)[0] - 1)).toBe(1);
    expect(teamMultFor(j1, teamCounts(j1)[0])).toBeCloseTo(1.2, 9);
    expect(teamMultFor(j1, cap)).toBeCloseTo(2, 9);
  });
  it('자격증: 단계 배수 = OECD 상대임금(1.101 → 1.318 → 1.735), 가격 = N명째 고용가 × 1.5', () => {
    const s = fresh(); s.money = 1e30;
    const c0 = nextCert(s, j1)!;
    expect(c0.open).toBe(false);
    hire(s, 'home_1', c0.count);
    const c = nextCert(s, j1)!;
    expect(c.open).toBe(true);
    expect(c.price).toBeCloseTo(j1.baseCost * j1.costGrowth ** c.count * 1.5, 3);
    const before = incomeBase(s);
    expect(buyCert(s, 'home_1')).toBe(true);
    expect(certMult(s, 'home_1')).toBeCloseTo(1.101, 9);
    expect(incomeBase(s)).toBeCloseTo(before * 1.101, 3);
    hire(s, 'home_1', 'max'); buyCert(s, 'home_1'); buyCert(s, 'home_1');
    expect(certMult(s, 'home_1')).toBeCloseTo(1.735, 9);
  });
  it('단체 사진 수집 보너스: 1장 +1%, 상한 +50%', () => {
    const s = fresh();
    s.teamPhotos = { a: 1, b: 1 }; expect(albumMult(s)).toBeCloseTo(1.02, 9);
    for (let i = 0; i < 80; i++) s.teamPhotos[`x${i}`] = 1;
    expect(albumMult(s)).toBeCloseTo(1.5, 9);
  });
});

describe('탭·피버·명성', () => {
  it('탭 = 도시 tap_base + 초당 수입 × 0.12', () => {
    const s = fresh(); s.owned.home_1 = 10;
    const inc = incomeBase(s);
    expect(tapValue(s)).toBeCloseTo(D.cities[0].tapBase + inc * 0.12, 6);
    const m = s.money; tap(s); expect(s.money - m).toBeCloseTo(D.cities[0].tapBase + inc * 0.12, 6);
  });
  it('연타 30회 → 피버', () => {
    const s = fresh(); s.owned.home_1 = 10; const out: any[] = [];
    for (let i = 0; i < 30; i++) tap(s, out);
    expect(s.feverLeft).toBe(eco('fever_duration_sec'));
  });
  it('명성 1당 +1% (더하기), 집 명성 포함', () => {
    const s = fresh(); s.fameByCity = [3, 2]; s.home.fame = 5;
    expect(fameMult(s)).toBeCloseTo(1 + 0.01 * 10, 9);
  });
});

describe('추천·벽·목표', () => {
  it('추천은 비용/증가량 최소이며 정원 가득 찬 직종 고용은 제외', () => {
    const s = fresh(); s.owned.home_1 = jobCap(j1); s.money = 0;
    const r = recommend(s)!;
    expect(!(r.kind === 'hire' && r.jobId === 'home_1')).toBe(true);
  });
  it('벽 정보 계산', () => { const s = fresh(); s.owned.home_1 = 20; expect(wallInfo(s).eta).toBeGreaterThan(0); });
  it('목표 바 15%에서 시작', () => {
    const s = fresh(); s.owned.home_1 = 1;
    const g = updateGoal(s)!;
    expect(goalProgress(s, g)).toBeCloseTo(0.15, 9);
  });
  it('마을 공개 15명', () => {
    const s = fresh(); s.money = 1e12; const out: any[] = [];
    hire(s, 'home_1', 10, out); expect(out.some((e) => e.t === 'reveal')).toBe(false);
    hire(s, 'home_1', 5, out); expect(out.some((e) => e.t === 'reveal')).toBe(true);
  });
});

describe('한국식 단위', () => {
  it('경계', () => {
    expect(formatKR(9999)).toBe('9999');
    expect(formatKR(1e4)).toBe('1만');
    expect(formatKR(10320)).toBe('1만 320');
    expect(formatKR(123456789)).toBe('1억 2345만');
    expect(formatKR(1e12)).toBe('1조');
    expect(formatKR(2.5e16)).toBe('2경 5000조');
    expect(formatKR(Infinity)).toBe('∞');
    expect(unitIndex(9999)).toBe(-1); expect(unitIndex(1e16)).toBe(3);
  });
});
