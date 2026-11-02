// 오프라인 정산(A3·A4): 투자 100%·나머지 25%(offline_rate), 상한 이후 모두 offline_after_cap_ratio. 밀린 월급봉투·통장 배당 포함.
import { acc, cityJobs, eco, jobIncomeBase } from './econ';
import { doPayday, paydayInterval } from './payday';
import { earn } from './ledger';
import type { GameEvent, GameState, OfflineReport } from './state';

export function simulateOffline(s: GameState, sec: number, out: GameEvent[] = []): OfflineReport {
  const rep: OfflineReport = { sec, capped: sec > eco('offline_cap_sec'), byJob: {}, income: 0, paydays: 0, envelopes: 0,
    dividendCash: 0, dividendReinvest: 0, heldDividend: 0, accountOpened: false, managerUnlocked: false };
  if (!(sec > 0)) return rep;
  s.feverLeft = 0;
  const cap = eco('offline_cap_sec');
  const after = eco('offline_after_cap_ratio');
  const fullPaydays = acc('offline_dividend_full_paydays');
  const afterDiv = acc('offline_dividend_after_ratio');
  const jobs = cityJobs(s).map((j) => ({ j, inc: jobIncomeBase(s, j) })).filter((x) => x.inc > 0);
  const envBefore = s.envelopes;
  const onlineCarry = { ...s.sinceJob };
  let accum: Record<string, number> = { ...s.sinceJob };
  let t = 0;
  while (t < sec - 1e-9) {
    let next = Math.min(sec, t + Math.max(0, s.paydayIn));
    if (t < cap) next = Math.min(next, cap);
    const seg = next - t;
    for (const { j, inc } of jobs) {
      const rate = t < cap ? j.offlineRate : after;
      const e = inc * rate * seg;
      rep.byJob[j.id] = (rep.byJob[j.id] ?? 0) + e;
      accum[j.id] = (accum[j.id] ?? 0) + e;
    }
    s.paydayIn -= seg;
    t = next;
    if (s.paydayIn <= 1e-9) {
      s.sinceJob = accum;
      const slip = doPayday(s, out, false, rep.paydays < fullPaydays ? 1 : afterDiv);
      rep.paydays++;
      rep.dividendCash += slip.dividendCash; rep.dividendReinvest += slip.dividendReinvest; rep.heldDividend += slip.heldDividend;
      if (slip.accountOpened) rep.accountOpened = true;
      accum = {};
      s.paydayIn += paydayInterval();
    }
  }
  // 오프라인 수입은 다음 접속 중 월급날 계산에서 제외(A2). 오프라인 월급날이 있었다면 접속 중 몫도 이미 정산됨.
  s.sinceJob = rep.paydays > 0 ? {} : onlineCarry;
  rep.income = Object.values(rep.byJob).reduce((a, b) => a + b, 0);
  rep.envelopes = s.envelopes - envBefore;
  return rep;
}

/** 정산서 수령. double = 보상형 광고 2배(오프라인 수입만, X-07) */
export function collectOffline(s: GameState, rep: OfflineReport, double = false) {
  earn(s, 'offline', rep.income * (double ? 2 : 1));
  earn(s, 'payday', s.envelopes);
  earn(s, 'dividend', rep.dividendCash + rep.heldDividend);
  s.envelopes = 0;
  s.pendingOffline = null;
}
