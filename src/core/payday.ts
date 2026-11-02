// 월급날(A2·A3) + 통장 개설/배당 + 매니저 해금
import { acc, cityJobs, eco, incomeBase, uniqueMult, fin } from './econ';
import { dividends, openAccount } from './account';
import { earn, firstAt, happening } from './ledger';
import type { GameEvent, GameState, PaydayLine, PaydaySlip } from './state';

/** 지난 월급날 이후 직종별로 번 돈(s.sinceJob) 기준 보너스 */
export function paydayBonus(s: GameState): { lines: PaydayLine[]; bonus: number; floorApplied: boolean } {
  const byLine = new Map<string, PaydayLine>();
  let base = 0;
  for (const j of cityJobs(s)) {
    const amt = (s.sinceJob[j.id] ?? 0) * j.paydayShare;
    if (amt <= 0) continue;
    base += amt;
    const l = byLine.get(j.paydayLine) ?? { label: j.paydayLine, amount: 0, tier: j.tier };
    l.amount += amt;
    byLine.set(j.paydayLine, l);
  }
  const floor = incomeBase(s) * eco('payday_min_income_sec');
  const floorApplied = base < floor;
  const um = uniqueMult(s, 'payday');
  const bonus = fin((floorApplied ? floor : base) * um);
  const lines = [...byLine.values()].map((l) => ({ ...l, amount: l.amount * um }));
  if (floorApplied && floor > 0) lines.push({ label: '기본 보너스(최소 보장)', amount: (floor - base) * um });
  return { lines, bonus, floorApplied };
}

/** 월급날 처리. online=false면 보너스는 밀린 월급봉투로, 배당 현금은 돌려준다(정산서에서 지급) */
export function doPayday(s: GameState, out: GameEvent[], online: boolean, divRatio = 1): PaydaySlip {
  const { lines, bonus, floorApplied } = paydayBonus(s);
  s.sinceJob = {};
  s.paydayCount++;
  if (online) s.onlinePaydays++;
  const slip: PaydaySlip = { online, index: s.paydayCount, lines, floorApplied, bonus, dividendReinvest: 0, dividendCash: 0,
    heldDividend: 0, total: 0, accountOpened: false, openBonus: 0, managerUnlocked: false };
  // 통장: 매니저 해금 '다음' 월급날 개설, 개설한 월급날에는 배당 없음
  if (s.managerUnlocked && !s.account.open) {
    slip.openBonus = openAccount(s, out);
    slip.accountOpened = true;
  } else if (s.account.open) {
    const d = dividends(s, divRatio);
    slip.dividendReinvest = d.reinvest; slip.dividendCash = d.cash; slip.heldDividend = d.held;
  }
  slip.total = bonus + slip.dividendCash + slip.heldDividend;
  if (online) {
    earn(s, 'payday', bonus);
    earn(s, 'dividend', slip.dividendCash + slip.heldDividend);
    firstAt(s, 'first_payday');
    happening(s);
    // 매니저: 접속 중 월급날 manager_unlock_paydays회째
    if (!s.managerUnlocked && s.onlinePaydays >= eco('manager_unlock_paydays')) {
      s.managerUnlocked = true;
      slip.managerUnlocked = true;
      firstAt(s, 'manager');
      out.push({ t: 'manager' });
    }
    out.push({ t: 'payday', slip });
  } else {
    s.envelopes += bonus;
  }
  return slip;
}

export const paydayInterval = (): number => eco('payday_interval_sec');
export { acc };
