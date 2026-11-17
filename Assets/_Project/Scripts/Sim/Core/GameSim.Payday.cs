using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    // 월급날(명세서) · 재접속 정산서
    public sealed partial class GameSim
    {
        public double PaydayProgress { get { return 1 - S.paydayTimer / (S.paydaysTotal == 0 ? Data.PaydayFirst : Data.PaydayPeriod); } }
        public bool HasPendingPayday { get { return S.pendingPayday.count > 0; } }

        void StepPayday(double dt)
        {
            double before = S.paydayTimer;
            S.paydayTimer -= dt;
            if (before > 10 && S.paydayTimer <= 10) Emit(SimEventType.PaydaySoon);
            if (S.paydayTimer > 0) return;
            S.paydayTimer += Data.PaydayPeriod;
            if (S.paydayTimer <= 0) S.paydayTimer = Data.PaydayPeriod;
            AccruePayday(S.pendingPayday, 1.0);
            S.paydaysTotal++;
            Unlock(Layer.Payday);
            MarkFirst("first_payday");
            Emit(SimEventType.PaydayReady);
        }

        static void AddLine(PaydayReport r, string label, double amount, int kind)
        {
            if (amount <= 0) return;
            for (int i = 0; i < r.lines.Count; i++)
                if (r.lines[i].label == label && r.lines[i].kind == kind) { r.lines[i].amount += amount; return; }
            r.lines.Add(new PaydayLine { label = label, amount = amount, kind = kind });
        }

        /// <summary>
        /// 월급날 한 번의 몫을 명세서에 쌓는다. 근로 상여(분신별 줄) + 월세 + 예금 이자 + 배당 + 떠난 도시 자산.
        /// 월세는 월급날과 같은 리듬으로 받는다(새 타이머를 만들지 않는다).
        /// </summary>
        /// <param name="workScale">최소 보장에 곱할 비율(오프라인은 야간 근무 비율만큼 줄인다).</param>
        void AccruePayday(PaydayReport r, double workScale)
        {
            double paydayBonus = 1 + UniquePassiveAll("payday");
            double bonus = 0;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot <= 0) { c.earnedSincePayday = 0; continue; }
                var job = Job(c.slot);
                double b = c.earnedSincePayday * job.PaydayShare * paydayBonus;
                c.earnedSincePayday = 0;
                if (b <= 0) continue;
                bonus += b;
                AddLine(r, CloneName(c) + " " + job.Name + " · " + job.PaydayLine, b, 0);
            }
            double min = IncomePerSec() * Data.E("payday_min_income_sec") * workScale;
            if (bonus < min)
            {
                AddLine(r, "성실 근무 보장 수당", min - bonus, 4);
                bonus = min;
            }

            double rent = RentPerPayday();
            if (rent > 0) AddLine(r, "월세 수입", rent, 1);
            double interest = S.deposit * Data.E("deposit_rate");
            if (interest > 0) AddLine(r, "예금 이자", interest, 2);
            double dividend = DividendPerPayday();
            if (dividend > 0) AddLine(r, "주식 배당", dividend, 3);
            double old = OldCityAssetPerPayday();
            if (old > 0) AddLine(r, "떠난 도시 자산 수입", old, 5);

            r.count++;
            r.bonus += bonus;
            r.rent += rent;
            r.interest += interest;
            r.dividend += dividend;
            r.oldCity += old;
            r.total += bonus + rent + interest + dividend + old;
            var pool = Data.LinePool("deduction");
            if (pool.Count > 0) r.deduction = pool[Rng.Range(ref S.rng, pool.Count)].Value;
        }

        /// <summary>명세서를 받는다. 받지 않고 둔 월급날은 사라지지 않고 여기에 묶여 있다.</summary>
        public PaydayReport CollectPayday()
        {
            var r = S.pendingPayday;
            if (r.count <= 0) return null;
            Earn(r.total, 2);
            S.stats.assetIncome += r.rent + r.interest + r.dividend + r.oldCity;
            S.paydaysOnline += r.count;
            S.pendingPayday = new PaydayReport();
            S.sinceAction = 0;
            Emit(SimEventType.PaydayCollected, r.count, 0, r.total);
            Emit(SimEventType.MoneyGain, 2, 0, r.total);
            if (!S.manager && S.paydaysOnline >= (int)Data.E("manager_unlock_paydays")) GrantManager();
            if (S.manager && S.paydaysOnline > (int)Data.E("manager_unlock_paydays")) Request(Layer.Deposit);
            return r;
        }

        /// <summary>한 달(월급날 주기) 예상 수입 = 근로 + 월급날 상여 + 자산 수입. 상단 바의 '월 수입'.</summary>
        public double MonthlyIncome()
        {
            double work = IncomePerSec() * Data.PaydayPeriod;
            double bonus = 0;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot > 0) bonus += CloneIncome(c) * Data.PaydayPeriod * Job(c.slot).PaydayShare;
            }
            bonus = Math.Max(bonus, IncomePerSec() * Data.E("payday_min_income_sec"));
            return work + bonus + AssetIncomePerPayday();
        }

        public double AssetIncomePerPayday()
        {
            return RentPerPayday() + S.deposit * Data.E("deposit_rate") + DividendPerPayday() + OldCityAssetPerPayday();
        }

        // ------------------------------------------------------------------ 오프라인 정산

        /// <summary>
        /// 앱을 끈 동안의 정산을 계산해 pendingOffline에 쌓는다(받기는 CollectOffline).
        /// 투자 직종 100%, 나머지 25%('분신 야간 근무'). 상한 이후에도 25% 속도로 계속 쌓인다(하드 컷 없음).
        /// 경험은 그대로 쌓여 돌아오면 승진 대기 줄이 된다(귀환 벽 0).
        /// </summary>
        public OfflineReport ApplyOffline(double seconds)
        {
            if (seconds < Data.E("offline_min_sec") || S.clones.Count == 0) return null;
            double cap = Data.E("offline_cap_sec");
            double eff = Math.Min(seconds, cap) + Math.Max(0, seconds - cap) * Data.E("offline_after_cap_ratio");

            var r = S.hasPendingOffline ? S.pendingOffline : new OfflineReport();
            r.seconds += seconds;

            // 월급날 횟수
            int paydays = 0;
            if (eff >= S.paydayTimer)
            {
                double rest = eff - S.paydayTimer;
                paydays = 1 + (int)Math.Floor(rest / Data.PaydayPeriod);
                S.paydayTimer = Data.PaydayPeriod - (rest % Data.PaydayPeriod);
            }
            else S.paydayTimer -= eff;

            // 야간 근무 수입
            double work = 0, best = -1;
            double rateSum = 0, incSum = 0;
            var earned = new double[S.clones.Count];
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot <= 0) continue;
                var job = Job(c.slot);
                double inc = CloneIncome(c);
                double e = inc * job.OfflineRate * eff;
                earned[i] = e;
                work += e;
                incSum += inc;
                rateSum += inc * job.OfflineRate;
                if (e > best) { best = e; r.mvpClone = c.id; }
                AddLine(ToPayday(r), job.Name + " 야간 근무", e, 0);
            }
            r.workIncome += work;

            // 밀린 월급봉투: 월급날마다 같은 공식으로 쌓는다
            if (paydays > 0)
            {
                var env = new PaydayReport();
                double scale = incSum > 0 ? rateSum / incSum : 0.25;
                for (int p = 0; p < paydays; p++)
                {
                    for (int i = 0; i < S.clones.Count; i++)
                        S.clones[i].earnedSincePayday += earned[i] / paydays;
                    AccruePayday(env, scale);
                }
                r.envelope += env.total;
                r.paydays += paydays;
                S.paydaysTotal += paydays;
                for (int i = 0; i < env.lines.Count; i++)
                    if (env.lines[i].kind != 0 && env.lines[i].kind != 4)
                        AddLine(ToPayday(r), env.lines[i].label, env.lines[i].amount, env.lines[i].kind);
                AddLine(ToPayday(r), "밀린 월급봉투 " + paydays + "개", env.bonus, 4);
                Unlock(Layer.Payday);
            }

            // 무역 입항(상하이 규칙)은 오프라인에도 쌓인다
            if (Has(Layer.CityRule) && City.Rule == "trade" && City.RuleA > 0)
            {
                int ships = 0;
                if (eff >= S.ruleTimer)
                {
                    double rest = eff - S.ruleTimer;
                    ships = 1 + (int)Math.Floor(rest / City.RuleA);
                    S.ruleTimer = City.RuleA - (rest % City.RuleA);
                }
                else S.ruleTimer -= eff;
                if (ships > 0)
                {
                    double v = rateSum * City.RuleB * ships;
                    r.envelope += v;
                    AddLine(ToPayday(r), "무역 입항 " + ships + "회", v, 6);
                }
            }

            // 경험
            double xpRate = Data.E("offline_xp_rate");
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot > 0) r.levelUps += AddXp(c, eff * xpRate * XpRate(c));
            }
            r.promotable = PromotionQueue().Count;

            // 부재중 뉴스 3줄
            r.news.Clear();
            for (int i = 0; i < 3 && Data.News.Count > 0; i++) r.news.Add(NextNewsLine());

            // 시간이 흐르며 끝나는 것들
            S.feverLeft = 0; S.feverGauge = 0; S.combo = 0; S.seasonLeft = 0;
            S.boostLeft = Math.Max(0, S.boostLeft - seconds);
            S.adCooldown = Math.Max(0, S.adCooldown - seconds);
            S.eventId = ""; S.eventLeft = 0;
            S.sinceAction = 0; S.sinceEvent = 999;
            // 화면이 놓친 사건 알림(레벨업 등)은 정산서가 대신한다
            Events.Clear();

            S.pendingOffline = r;
            S.hasPendingOffline = true;
            return r;
        }

        // OfflineReport의 줄 목록을 PaydayReport의 AddLine으로 다루기 위한 얇은 포장
        readonly PaydayReport _lineWrap = new PaydayReport();
        PaydayReport ToPayday(OfflineReport r) { _lineWrap.lines = r.lines; return _lineWrap; }

        /// <summary>정산서를 받는다. 광고 2배는 야간 근무 수입에만 적용된다(월급봉투·자산 수입 제외).</summary>
        public double CollectOffline(bool doubled)
        {
            if (!S.hasPendingOffline) return 0;
            var r = S.pendingOffline;
            double total = r.workIncome * (doubled ? Data.E("ad_boost_mult") : 1) + r.envelope;
            Earn(total, 3);
            S.pendingOffline = new OfflineReport();
            S.hasPendingOffline = false;
            S.sinceAction = 0;
            Emit(SimEventType.MoneyGain, 3, 0, total);
            return total;
        }
    }
}
