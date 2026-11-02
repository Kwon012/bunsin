import { describe, it, expect } from 'vitest';
import { newGame, type GameEvent } from '../src/core/state';
import { eco, acc, city, incomeBase, totalFame, fameMult, D } from '../src/core/econ';
import { hire, buyCert } from '../src/core/actions';
import { advance } from '../src/core/sim';
import { moveCity, fameGainNow, debugPrepareMove, movePreview } from '../src/core/move';
import { canMove, wallInfo } from '../src/core/recommend';
import { openAccount, withdraw, sellHeld } from '../src/core/account';
import { clock } from '../src/core/clock';
import { checkUniques } from '../src/core/uniques';

const fresh = () => newGame(eco('payday_first_sec'), 0);

describe('이사', () => {
  it('조건 = 꼭대기 직종 첫 고용', () => {
    const s = fresh(); s.money = 1e30;
    hire(s, 'home_1', 25); hire(s, 'home_2', 25); hire(s, 'home_3', 25); hire(s, 'home_4', 25);
    expect(canMove(s)).toBe(false);
    const out: GameEvent[] = [];
    hire(s, 'home_5', 1, out);
    expect(out.some((e) => e.t === 'top_hired')).toBe(true);
    expect(canMove(s)).toBe(true);
  });
  it('초기화: 돈·분신·자격증 / 유지: 명성·매니저·통장·개성 분신 + 정착금', () => {
    const s = fresh(); s.money = 1e30;
    hire(s, 'home_1', 'max'); buyCert(s, 'home_1'); hire(s, 'home_2', 'max'); hire(s, 'home_3', 'max'); hire(s, 'home_4', 'max'); hire(s, 'home_5', 1);
    s.managerUnlocked = true; openAccount(s); s.account.current!.balance = 500;
    clock.setHour(23); checkUniques(s); clock.setHour(null);
    s.cityEarned = city(s).fameUnit * 49; // fame = floor(√49) = 7
    expect(fameGainNow(s)).toBe(7);
    const pv = movePreview(s);
    expect(pv.multAfter).toBeCloseTo(1 + 0.01 * 7, 9);
    const uniq = s.uniques.length;
    expect(moveCity(s)).toBe(true);
    expect(s.cityIdx).toBe(1);
    expect(s.owned).toEqual({}); expect(s.certs).toEqual({});
    expect(s.money).toBe(city(s).settleMoney);
    expect(totalFame(s)).toBe(7); expect(fameMult(s)).toBeCloseTo(1.07, 9);
    expect(s.managerUnlocked).toBe(true);
    expect(s.account.held.map((h) => h.stockId)).toEqual(['stock_home']);
    expect(s.account.current!.stockId).toBe('stock_busan');
    expect(s.uniques.length).toBe(uniq);
    expect(s.uniques[0].placedJob).toBe('busan_1');
    expect(s.cityEarned).toBe(0); // 정착금은 도시 누적 수입에 넣지 않음
  });
  it('8개 도시 순서대로, 마지막 도시에서는 이사 불가', () => {
    const s = fresh();
    for (let c = 2; c <= 8; c++) { debugPrepareMove(s, c); expect(canMove(s)).toBe(true); moveCity(s); expect(city(s).city).toBe(c); }
    expect(D.cities[s.cityIdx].id).toBe('newyork');
    s.owned.newyork_8 = 1; expect(canMove(s)).toBe(false);
  });
  it('이사 추천은 벽에서만', () => {
    const s = fresh(); debugPrepareMove(s, 2); s.money = 0;
    const w = wallInfo(s);
    expect(w.moveSuggest).toBe(w.eta >= eco('move_recommend_eta_sec'));
  });
});

describe('통장 + 이사 후 보유 종목', () => {
  it('보유 종목: 월급날마다 잔액 10% 현금 배당(상한 초당 수입 × 360), 매도, 깨기 순서', () => {
    const s = fresh(); debugPrepareMove(s, 2); s.managerUnlocked = true; openAccount(s);
    s.account.current!.balance = 1000;
    moveCity(s); s.money = 1e30; hire(s, 'busan_1', 30); s.money = 0;
    s.paydayIn = 0.1; s.managerOn = false; s.account.autoSave = false;
    const out: GameEvent[] = [];
    advance(s, 0.2, out);
    const slip = (out.find((e) => e.t === 'payday') as any).slip;
    expect(slip.heldDividend).toBeCloseTo(Math.min(1000 * acc('held_stock_dividend_rate'), incomeBase(s) * 360), 6);
    expect(s.account.held[0].balance).toBe(1000); // 현금 배당, 잔액은 그대로
    s.account.current!.balance = 50;
    expect(withdraw(s, 80)).toBe(80);
    expect(s.account.current!.balance).toBe(0); expect(s.account.held[0].balance).toBe(970);
    expect(sellHeld(s, 'stock_home')).toBe(970); expect(s.account.held.length).toBe(0);
  });
});
