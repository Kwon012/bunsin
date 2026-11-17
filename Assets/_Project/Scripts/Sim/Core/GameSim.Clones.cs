using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    // 분신: 고용 · 경험 · 훈련 · 승진 · 은퇴 · 일터 시설 · 자격증
    public sealed partial class GameSim
    {
        // ------------------------------------------------------------------ 고용

        /// <summary>다음에 나올 분신의 적성(확률 없이 순환, 미리 보인다).</summary>
        public int NextApt { get { return S.aptCursor % Tier.Count; } }

        /// <summary>신입 고용가. 첫 분신은 무료(거울에서 걸어 나온다). 이후 지금 분신 수에 따라 오른다.</summary>
        public double HireCost()
        {
            if (S.nextCloneId == 1) return 0;
            int n = Math.Max(0, S.clones.Count - 1);
            return City.HireBase * Math.Pow(Data.E("hire_growth"), n);
        }

        /// <summary>신입은 맨 아래 일터의 빈자리로만 들어온다. 대기실에 분신이 있으면 그쪽이 먼저다.</summary>
        public bool CanHireSeat { get { return BenchCount == 0 && HasVacancy(1); } }

        public CloneState Hire()
        {
            if (!CanHireSeat) return null;
            double cost = HireCost();
            if (!Spend(cost)) return null;
            var c = new CloneState
            {
                id = S.nextCloneId++, apt = NextApt, slot = 1, seat = FreeSeat(1), bornCity = S.city,
            };
            S.aptCursor++;
            c.history.Add(Job(1).Id);
            S.clones.Add(c);
            S.stats.hires++;
            S.sinceAction = 0;
            Workplace(1).everStaffed = true;
            if (c.id == 1) { Unlock(Layer.FirstClone); MarkFirst("first_clone"); }
            Emit(SimEventType.CloneHired, c.id);
            AfterSeated(c);
            return c;
        }

        /// <summary>대기실(이사 직후)의 분신을 맨 아래 빈자리에 무료로 앉힌다. 레벨 높은 순.</summary>
        void SeatBench()
        {
            while (true)
            {
                int seat = FreeSeat(1);
                if (seat < 0) return;
                CloneState best = null;
                for (int i = 0; i < S.clones.Count; i++)
                {
                    var c = S.clones[i];
                    if (c.slot != 0) continue;
                    if (best == null || c.level > best.level || (c.level == best.level && c.id < best.id)) best = c;
                }
                if (best == null) return;
                best.slot = 1;
                best.seat = seat;
                best.history.Add(Job(1).Id);
                Workplace(1).everStaffed = true;
                Emit(SimEventType.CloneSeated, best.id);
                AfterSeated(best);
            }
        }

        /// <summary>자리에 앉은 직후: 적성 첫 일치 보상, 일터 만석이면 윗 일터 개업.</summary>
        void AfterSeated(CloneState c)
        {
            if (AptMatches(c) && !c.matchRewarded)
            {
                c.matchRewarded = true;
                double reward = SecondValue() * Data.E("apt_first_match_reward_sec");
                Earn(reward, 5);
                Emit(SimEventType.AptMatch, c.id, 0, reward);
            }
            ApplyBonusXp(c);
            if (!HasVacancy(c.slot)) OnWorkplaceFull(c.slot);
        }

        void OnWorkplaceFull(int slot)
        {
            if (slot == 1 && !Has(Layer.Village))
            {
                Unlock(Layer.Village);
                MarkFirst("village_reveal");
                Emit(SimEventType.VillageReveal);
            }
            if (slot < City.Slots)
            {
                var up = Workplace(slot + 1);
                if (!up.open)
                {
                    up.open = true;
                    MarkFirst("open_" + S.city + "_" + (slot + 1));
                    Emit(SimEventType.WorkplaceOpened, slot + 1);
                }
            }
        }

        // ------------------------------------------------------------------ 경험·훈련

        public double XpRate(CloneState c)
        {
            if (c.slot <= 0) return 0;
            double r = 1;
            if (AptMatches(c)) r += _aptXpBonus;
            r += UniquePassive(c, "xp");
            return r;
        }

        double BonusXpCap(int level)
        {
            double v = 0;
            for (int i = 0; i < _bonusCapLevels; i++) v += XpNeed(level + i);
            return v;
        }

        /// <summary>근무 경험을 더한다. 상한에 닿으면 넘친 만큼은 '보너스 훈련'으로 저장된다(버려지지 않는다).</summary>
        int AddXp(CloneState c, double amount)
        {
            if (amount <= 0 || c.slot <= 0) return 0;
            int cap = LevelCap(c.slot);
            int ups = 0;
            if (c.level >= cap)
            {
                c.bonusXp = Math.Min(BonusXpCap(c.level), c.bonusXp + amount);
                return 0;
            }
            c.xp += amount;
            int promo = PromoLevel(c.slot);
            while (c.level < cap)
            {
                double need = XpNeed(c.level);
                if (c.xp < need) break;
                c.xp -= need;
                c.level++;
                ups++;
                Emit(SimEventType.LevelUp, c.id, c.level);
                if (c.level == promo) Emit(SimEventType.PromoReady, c.id);
            }
            if (c.level >= cap && c.xp > 0)
            {
                c.bonusXp = Math.Min(BonusXpCap(c.level), c.bonusXp + c.xp);
                c.xp = 0;
            }
            if (ups > 0)
            {
                if (c.level >= 3) Request(Layer.Train);
                if (c.slot == City.Slots && c.level >= promo) Request(Layer.Retire);
            }
            return ups;
        }

        /// <summary>상한이 오르거나 승진하면 저장해 둔 보너스 훈련을 경험으로 돌려준다.</summary>
        void ApplyBonusXp(CloneState c)
        {
            if (c.bonusXp <= 0 || c.slot <= 0 || c.level >= LevelCap(c.slot)) return;
            double b = c.bonusXp;
            c.bonusXp = 0;
            AddXp(c, b);
        }

        /// <summary>훈련 한 번 = 다음 레벨까지 남은 경험을 돈으로 채운다.</summary>
        public double TrainCost(CloneState c)
        {
            if (c == null || c.slot <= 0 || c.level >= LevelCap(c.slot)) return double.PositiveInfinity;
            double remain = Math.Max(1, XpNeed(c.level) - c.xp);
            // 훈련은 '돈으로 시간을 사는' 일이다. 전체 수입에 비례시켜, 수입이 커져도 훈련만으로 사다리를 건너뛰지 못하게 한다.
            double own = Math.Max(CloneIncome(c), Job(c.slot).BaseIncome) * 2;
            double share = IncomePerSec() * Data.E("train_cost_factor");
            return Math.Max(own, share) * remain;
        }

        public bool Train(int cloneId)
        {
            var c = Clone(cloneId);
            if (c == null || !Has(Layer.Train)) return false;
            double cost = TrainCost(c);
            if (double.IsInfinity(cost) || !Spend(cost)) return false;
            AddXp(c, XpNeed(c.level) - c.xp + 1e-9);
            S.stats.trainings++;
            Emit(SimEventType.Trained, c.id);
            return true;
        }

        // ------------------------------------------------------------------ 승진

        /// <summary>승진을 막는 첫 번째 이유. 벽에는 이유가 한 줄로 보여야 한다(v4 5.3).</summary>
        public PromoBlock CheckPromotion(CloneState c, bool checkMoney = true)
        {
            if (c == null || c.slot <= 0) return PromoBlock.NotSeated;
            if (c.slot >= City.Slots) return PromoBlock.IsTop;
            if (c.level < PromoLevel(c.slot)) return PromoBlock.Level;
            int up = c.slot + 1;
            var job = Job(up);
            var wp = Workplace(up);
            if (!wp.open) return PromoBlock.Closed;
            if (!HasVacancy(up)) return PromoBlock.Full;
            if (job.Cert.Length > 0 && !wp.cert) return PromoBlock.Cert;
            if (S.status < job.ReqStatus) return PromoBlock.Status;
            if (checkMoney && S.money + 1e-6 < job.PromoCost) return PromoBlock.Money;
            return PromoBlock.None;
        }

        public string PromoBlockText(CloneState c)
        {
            var b = CheckPromotion(c);
            if (c == null || c.slot <= 0) return "대기실에서 자리를 기다리는 중";
            int up = Math.Min(City.Slots, c.slot + 1);
            switch (b)
            {
                case PromoBlock.None: return "승진 가능";
                case PromoBlock.IsTop: return c.level >= PromoLevel(c.slot) ? "은퇴 가능" : "꼭대기 자리";
                case PromoBlock.Level: return "Lv." + PromoLevel(c.slot) + "이면 승진";
                case PromoBlock.Closed: return Job(c.slot).Name + " 5칸이 차면 " + Job(up).Name + " 개업";
                case PromoBlock.Full: return "윗자리 만석 — " + Job(up).Name + "에서 누가 올라가면 열림";
                case PromoBlock.Cert: return Job(up).Cert + " 필요";
                case PromoBlock.Status: return "신분 '" + Data.Status[Job(up).ReqStatus].Name + "' 필요";
                case PromoBlock.Money: return "승진비 " + NumberFormat.Money(Job(up).PromoCost) + "원";
            }
            return "";
        }

        public bool Promote(int cloneId)
        {
            var c = Clone(cloneId);
            if (CheckPromotion(c) != PromoBlock.None) return false;
            int from = c.slot, up = c.slot + 1;
            var job = Job(up);
            if (!Spend(job.PromoCost)) return false;
            c.slot = up;
            c.seat = FreeSeat(up);
            c.promotions++;
            c.history.Add(job.Id);
            Workplace(up).everStaffed = true;
            S.stats.promotions++;
            MarkFirst("first_promo");
            MarkFirst("staff_" + S.city + "_" + up);
            Emit(SimEventType.Promoted, c.id, up);
            Request(Layer.Facility);
            if (up >= City.Slots - 1) Request(Layer.Status);
            if (job.IsTop && !Has(Layer.Move))
            {
                Unlock(Layer.Move);
                MarkFirst("move_ready_" + S.city);
            }
            if (job.IsTop) MarkFirst("top_" + S.city);
            AfterSeated(c);
            return true;
        }

        public double CertCost(int slot) { return Job(slot).CertCost; }

        public bool BuyCert(int slot)
        {
            var job = Job(slot);
            var wp = Workplace(slot);
            if (job.Cert.Length == 0 || wp.cert) return false;
            if (!Spend(job.CertCost)) return false;
            wp.cert = true;
            MarkFirst("first_cert");
            Emit(SimEventType.CertBought, slot, 0, 0, job.Cert);
            return true;
        }

        // ------------------------------------------------------------------ 은퇴

        public bool CanRetire(CloneState c)
        {
            return c != null && Has(Layer.Retire) && c.slot == City.Slots && c.level >= PromoLevel(c.slot);
        }

        /// <summary>꼭대기 자리에서 기준 레벨에 닿은 분신의 은퇴(선택). 자리가 비고 명예의 전당에 영구 보너스가 쌓인다.</summary>
        public bool Retire(int cloneId)
        {
            var c = Clone(cloneId);
            if (!CanRetire(c)) return false;
            S.hall.Add(new HallEntry
            {
                id = c.id, name = c.name, apt = c.apt, unique = c.unique, city = S.city, level = c.level,
                history = new List<string>(c.history),
            });
            S.clones.Remove(c);
            S.stats.retirements++;
            S.sinceAction = 0;
            MarkFirst("first_retire");
            Emit(SimEventType.Retired, c.id);
            return true;
        }

        public bool Rename(int cloneId, string name)
        {
            var c = Clone(cloneId);
            if (c == null) return false;
            name = (name ?? "").Trim();
            if (name.Length > 8) name = name.Substring(0, 8);
            c.name = name;
            return true;
        }

        // ------------------------------------------------------------------ 일터 시설

        public double FacilityCost(int slot)
        {
            var wp = Workplace(slot);
            if (wp.facility >= Data.FacilityMaxLevel) return double.PositiveInfinity;
            return Job(slot).FacilityBaseCost * Math.Pow(_facGrowth, wp.facility);
        }

        public bool UpgradeFacility(int slot)
        {
            var wp = Workplace(slot);
            if (!Has(Layer.Facility) || !wp.open) return false;
            double cost = FacilityCost(slot);
            if (double.IsInfinity(cost) || !Spend(cost)) return false;
            wp.facility++;
            S.stats.facilityUps++;
            Emit(SimEventType.FacilityUp, slot, wp.facility);
            if (wp.facility % Data.FacilityStageLevels == 0)
                for (int i = 0; i < S.clones.Count; i++)
                    if (S.clones[i].slot == slot) ApplyBonusXp(S.clones[i]);
            return true;
        }

        /// <summary>승진 대기 줄: 지금 승진시킬 수 있거나 돈만 모자란 분신.</summary>
        public List<CloneState> PromotionQueue()
        {
            var list = new List<CloneState>();
            for (int i = 0; i < S.clones.Count; i++)
            {
                var b = CheckPromotion(S.clones[i]);
                if (b == PromoBlock.None || b == PromoBlock.Money) list.Add(S.clones[i]);
            }
            return list;
        }
    }
}
