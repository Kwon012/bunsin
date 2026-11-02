import { describe, it, expect } from 'vitest';
import { newGame, type GameEvent } from '../src/core/state';
import { eco, acc, incomeBase, job } from '../src/core/econ';
import { advance } from '../src/core/sim';
import { simulateOffline, collectOffline } from '../src/core/offline';
import { serialize, deserialize, resume } from '../src/core/save';
import { withdraw, accountOnMove, deposit } from '../src/core/account';

const fresh = () => newGame(eco('payday_first_sec'), 0);

describe('월급날', () => {
  it('첫 월급날 240초, 이후 1800초', () => {
    const s = fresh(); s.owned.home_1 = 10; const out: GameEvent[] = [];
    advance(s, 239.9, out); expect(out.some((e) => e.t === 'payday')).toBe(false);
    advance(s, 0.2, out); expect(out.filter((e) => e.t === 'payday').length).toBe(1);
    advance(s, 1799.8, out); expect(out.filter((e) => e.t === 'payday').length).toBe(1);
    advance(s, 0.2, out); expect(out.filter((e) => e.t === 'payday').length).toBe(2);
  });
  it('직장 몫 60%, 하한 120초치', () => {
    const s = fresh(); s.owned.home_4 = 1; s.paydayIn = 1800; const out: GameEvent[] = [];
    advance(s, 1800, out);
    const slip = (out.find((e) => e.t === 'payday') as any).slip;
    expect(slip.bonus).toBeCloseTo(729 * 1800 * 0.6, 3);
    const a = fresh(); a.owned.home_1 = 10; const o2: GameEvent[] = [];
    advance(a, 240, o2);
    const sl2 = (o2.find((e) => e.t === 'payday') as any).slip;
    expect(sl2.floorApplied).toBe(true);
    expect(sl2.bonus).toBeCloseTo(10 * 120, 6);
  });
  it('매니저: 접속 중 4번째 월급날, 통장: 그다음 월급날 개설(축하금 600초치), 이후 배당 10%', () => {
    const s = fresh(); s.owned.home_1 = 10; const out: GameEvent[] = [];
    advance(s, 240 + 1800 * 2, out); expect(s.managerUnlocked).toBe(false);
    s.managerOn = false;
    advance(s, 1800, out); expect(s.managerUnlocked).toBe(true); expect(s.account.open).toBe(false);
    advance(s, 1800, out); expect(s.account.open).toBe(true);
    const inc = incomeBase(s);
    expect(s.account.current!.balance).toBeCloseTo(inc * 600, 3);
    s.account.autoSave = false;
    const bal = s.account.current!.balance;
    advance(s, 1800, out);
    expect(s.account.current!.balance).toBeCloseTo(bal * 1.1, 3);
  });
});

describe('통장', () => {
  it('자동 적립 10%, 한도 초당 수입 × 7200', () => {
    const s = fresh(); s.owned.home_1 = 10; s.account.open = true;
    s.account.current = { stockId: 'stock_home', cityIdx: 0, balance: 0 }; s.paydayIn = 1e9;
    advance(s, 100); expect(s.account.current!.balance).toBeCloseTo(10 * 100 * 0.1, 6);
    advance(s, 1e6); expect(s.account.current!.balance).toBeCloseTo(10 * 7200, 6);
  });
  it('깨기 순서: 지금 종목 → 보유 종목', () => {
    const s = fresh(); s.account.open = true;
    s.account.current = { stockId: 'a', cityIdx: 0, balance: 100 };
    s.account.held = [{ stockId: 'b', cityIdx: 0, balance: 50 }];
    expect(withdraw(s, 120)).toBe(120);
    expect(s.account.current!.balance).toBe(0); expect(s.account.held[0].balance).toBe(30);
  });
  it('보유 종목 배당 합계 상한 = 초당 수입 × 360', () => {
    const s = fresh(); s.owned.home_1 = 1; s.account.open = true;
    s.account.current = { stockId: 'a', cityIdx: 0, balance: 0 };
    s.account.held = [{ stockId: 'b', cityIdx: 0, balance: 1e9 }];
    s.paydayIn = 0.1; const out: GameEvent[] = []; s.managerOn = false;
    advance(s, 0.2, out);
    const slip = (out.find((e) => e.t === 'payday') as any).slip;
    expect(slip.heldDividend).toBeCloseTo(1 * 360, 6);
  });
  it('이사 시 지금 종목 → 보유 종목', () => {
    const s = fresh(); s.account.open = true; s.account.current = { stockId: 'stock_home', cityIdx: 0, balance: 77 };
    s.cityIdx = 1; accountOnMove(s);
    expect(s.account.held[0].balance).toBe(77); expect(s.account.current!.stockId).toBe('stock_busan');
  });
  it('직접 입금은 한도까지', () => {
    const s = fresh(); s.owned.home_1 = 1; s.money = 1e6; s.account.open = true;
    s.account.current = { stockId: 'a', cityIdx: 0, balance: 0 };
    expect(deposit(s, 1e6)).toBeCloseTo(7200, 6);
  });
});

describe('오프라인', () => {
  it('8시간: 투자 100%·나머지 25%, 월급날 16회, 빠름', () => {
    const s = fresh(); s.cityIdx = 3; s.owned.tokyo_1 = 10; s.owned.tokyo_7 = 1; s.paydayIn = 1800;
    const t0 = performance.now();
    const rep = simulateOffline(s, 28800);
    expect(performance.now() - t0).toBeLessThan(50);
    const i1 = job('tokyo_1').incomePerSec * 10, i7 = job('tokyo_7').incomePerSec;
    expect(rep.byJob.tokyo_1).toBeCloseTo(i1 * 0.25 * 28800, -10);
    expect(rep.byJob.tokyo_7 / (i7 * 28800)).toBeCloseTo(1, 9);
    expect(rep.paydays).toBe(16);
    expect(rep.capped).toBe(false);
    expect(rep.envelopes).toBeGreaterThan(0);
  });
  it('30일: 상한 이후 25% 속도, 빠르게 끝남', () => {
    const s = fresh(); s.cityIdx = 3; s.owned.tokyo_7 = 1; s.paydayIn = 1800;
    const t0 = performance.now();
    const rep = simulateOffline(s, 30 * 86400);
    expect(performance.now() - t0).toBeLessThan(200);
    const i7 = job('tokyo_7').incomePerSec;
    expect(rep.byJob.tokyo_7 / (i7 * (28800 + (30 * 86400 - 28800) * 0.25))).toBeCloseTo(1, 9);
    expect(rep.capped).toBe(true);
    expect(rep.paydays).toBe(1440);
  });
  it('오프라인 배당: 16회 100%, 이후 25%', () => {
    const s = fresh(); s.owned.home_1 = 1000; s.account.open = true; s.managerUnlocked = true;
    s.account.current = { stockId: 'a', cityIdx: 0, balance: 1 }; s.paydayIn = 1800;
    const rep = simulateOffline(s, 1800 * 17);
    // 17번째 배당은 25%: 잔액 1 → 1.1^16 → ×(1 + 0.025)
    expect(s.account.current!.balance).toBeCloseTo(1.1 ** 16 * 1.025, 9);
    expect(rep.paydays).toBe(17);
  });
  it('매니저 해금은 접속 중 월급날만 셈', () => {
    const s = fresh(); s.owned.home_1 = 10;
    simulateOffline(s, 1800 * 10);
    expect(s.managerUnlocked).toBe(false); expect(s.onlinePaydays).toBe(0); expect(s.paydayCount).toBe(10);
  });
  it('정산서 수령 + 광고 2배는 오프라인 수입만', () => {
    const s = fresh(); s.owned.home_4 = 1; s.paydayIn = 1800;
    const rep = simulateOffline(s, 3600);
    const env = s.envelopes;
    collectOffline(s, rep, true);
    expect(s.money).toBeCloseTo(rep.income * 2 + env, 3);
  });
});

describe('저장/복귀', () => {
  it('직렬화 왕복 일치', () => {
    const s = fresh(); s.owned.home_1 = 33; s.money = 1234.5; s.flags.villageRevealed = 1;
    advance(s, 500);
    const r = deserialize(serialize(s));
    expect(r).toEqual(s);
  });
  it('복귀: 1시간 부재 → 정산서 생성', () => {
    const s = fresh(); s.owned.home_1 = 10; s.lastSeen = 0;
    resume(s, 3600 * 1000);
    expect(s.pendingOffline).not.toBeNull();
    expect(s.pendingOffline!.sec).toBeCloseTo(3600, 6);
  });
});
