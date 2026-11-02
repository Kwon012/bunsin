// 배당주 통장(account.csv). 지금 종목 + 보유 종목, 가격 변동 없음, 손해 없음.
import { acc, city, incomeBase } from './econ';
import { earn } from './ledger';
import type { GameEvent, GameState } from './state';

export const accountCap = (s: GameState): number => incomeBase(s) * acc('cap_income_sec');

export function openAccount(s: GameState, out: GameEvent[] = []): number {
  const c = city(s);
  const bonus = incomeBase(s) * acc('open_bonus_income_sec');
  s.account.open = true;
  s.account.current = { stockId: c.stockId, cityIdx: s.cityIdx, balance: bonus };
  s.cityEarned += bonus; s.totalEarned += bonus;
  s.metrics.income.open = (s.metrics.income.open ?? 0) + bonus;
  out.push({ t: 'account_open', bonus });
  return bonus;
}

/** 월급날 배당. ratio = 오프라인 배당 비율(1 또는 offline_dividend_after_ratio). 현금은 돌려주기만 한다 */
export function dividends(s: GameState, ratio = 1): { reinvest: number; cash: number; held: number } {
  const res = { reinvest: 0, cash: 0, held: 0 };
  if (!s.account.open) return res;
  const cur = s.account.current;
  if (cur && cur.balance > 0) {
    const div = cur.balance * acc('dividend_rate') * ratio;
    const room = Math.max(0, accountCap(s) - cur.balance);
    res.reinvest = Math.min(div, room);
    res.cash = div - res.reinvest;
    cur.balance += res.reinvest;
  }
  const heldSum = s.account.held.reduce((a, h) => a + h.balance * acc('held_stock_dividend_rate') * ratio, 0);
  res.held = Math.min(heldSum, incomeBase(s) * acc('held_stock_dividend_cap_income_sec'));
  if (res.reinvest > 0) { s.cityEarned += res.reinvest; s.totalEarned += res.reinvest; s.metrics.income.dividend = (s.metrics.income.dividend ?? 0) + res.reinvest; }
  return res;
}

/** 자동 적립(현금 수입 중 일부를 지금 종목으로). 실제로 적립한 금액을 돌려준다 */
export function autoSaveAmount(s: GameState, incomeEarned: number): number {
  const cur = s.account.current;
  if (!s.account.open || !s.account.autoSave || !cur) return 0;
  const room = Math.max(0, accountCap(s) - cur.balance);
  const save = Math.min(incomeEarned * acc('auto_save_ratio'), room);
  cur.balance += save;
  return save;
}

export function deposit(s: GameState, amount: number): number {
  const cur = s.account.current;
  if (!s.account.open || !cur) return 0;
  const room = Math.max(0, accountCap(s) - cur.balance);
  const v = Math.min(amount, s.money, room);
  if (v <= 0) return 0;
  s.money -= v; cur.balance += v;
  return v;
}

/** 통장 깨기: 지금 종목 → 보유 종목 순으로 amount만큼 꺼낸다(Infinity = 전부) */
export function withdraw(s: GameState, amount: number): number {
  let got = 0;
  const take = (h: { balance: number }) => {
    const v = Math.min(h.balance, amount - got);
    h.balance -= v; got += v;
  };
  if (s.account.current) take(s.account.current);
  for (const h of s.account.held) { if (got >= amount) break; take(h); }
  s.account.held = s.account.held.filter((h) => h.balance > 1e-9);
  s.money += got;
  return got;
}

/** 보유 종목 하나 매도 */
export function sellHeld(s: GameState, stockId: string): number {
  const h = s.account.held.find((x) => x.stockId === stockId);
  if (!h) return 0;
  const v = h.balance;
  s.account.held = s.account.held.filter((x) => x !== h);
  s.money += v;
  return v;
}

/** 이사: 지금 종목 → 보유 종목, 새 도시 종목 개설(잔액 0) */
export function accountOnMove(s: GameState) {
  if (!s.account.open) return;
  if (s.account.current && s.account.current.balance > 0) s.account.held.push(s.account.current);
  const c = city(s);
  s.account.current = { stockId: c.stockId, cityIdx: s.cityIdx, balance: 0 };
}

export { earn };
