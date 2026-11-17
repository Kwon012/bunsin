using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    // 추천 버튼 · 목표 바 · 매니저 자동화 · 벽 측정(R-015)
    // 고민 3단계: 몰라도 진행이 막히지 않게 모든 결정에 '그냥 눌러도 되는' 기본값을 준다.
    public sealed partial class GameSim
    {
        readonly List<SimAction> _acts = new List<SimAction>();

        /// <summary>지금 할 수 있는(또는 돈만 모으면 되는) 일 목록. includeAssets = 자산 구매 포함.</summary>
        public List<SimAction> Candidates(bool includeAssets)
        {
            var list = _acts;
            list.Clear();

            // 신입 고용
            if (CanHireSeat)
            {
                double gain = Job(1).BaseIncome * FacilityMult(1) * AssetMult(1) * FameMult;
                if (NextApt == Job(1).Tier) gain *= 1 + _aptBonus;
                list.Add(new SimAction { Kind = ActionKind.Hire, Slot = 1, Cost = HireCost(), Gain = gain, Label = "신입 분신 고용" });
            }

            // 승진: 윗자리마다 한 명(매니저 규칙으로 고름). 자격증이 막으면 자격증이 후보가 된다
            for (int slot = 1; slot < City.Slots; slot++)
            {
                var c = PromotionPick(slot);
                if (c == null) continue;
                var block = CheckPromotion(c, false);
                var up = Job(slot + 1);
                double gain = IncomeAt(c, slot + 1, c.level) - CloneIncome(c);
                // 자리가 비면 아래에서 또 올라오거나 새로 뽑을 수 있다: 빈자리의 가치도 조금 쳐 준다
                gain += Job(1).BaseIncome * FameMult * 0.5;
                if (block == PromoBlock.None)
                    list.Add(new SimAction { Kind = ActionKind.Promote, Slot = slot + 1, CloneId = c.id, Cost = up.PromoCost, Gain = gain, Label = CloneName(c) + " " + up.Name + " 승진" });
                else if (block == PromoBlock.Cert)
                    list.Add(new SimAction { Kind = ActionKind.Cert, Slot = slot + 1, CloneId = c.id, Cost = up.CertCost, Gain = gain * 0.5, Label = up.Cert + " 따기" });
            }

            // 일터 시설
            if (Has(Layer.Facility))
                for (int slot = 1; slot <= City.Slots; slot++)
                {
                    var wp = Workplace(slot);
                    if (!wp.open || wp.facility >= Data.FacilityMaxLevel) continue;
                    double inc = WorkplaceIncome(slot);
                    if (inc <= 0) continue;
                    double gain = inc / FacilityMult(slot) * _facBonus;
                    list.Add(new SimAction { Kind = ActionKind.Facility, Slot = slot, Cost = FacilityCost(slot), Gain = gain, Label = Job(slot).Name + " 시설 " + (wp.facility + 1) + "단계" });
                }

            // 훈련: 일터마다 승진에 가장 가까운 한 명
            if (Has(Layer.Train))
                for (int slot = 1; slot <= City.Slots; slot++)
                {
                    var c = TrainPick(slot);
                    if (c == null) continue;
                    double cost = TrainCost(c);
                    double gain = Job(slot).BaseIncome * _levelBonus * (AptMatches(c) ? 1 + _aptBonus : 1) * FacilityMult(slot) * AssetMult(slot) * FameMult;
                    int left = PromoLevel(slot) - c.level;
                    if (left > 0 && slot < City.Slots && Workplace(slot + 1).open && HasVacancy(slot + 1))
                        gain += (IncomeAt(c, slot + 1, c.level) - CloneIncome(c)) / left * 0.5;
                    list.Add(new SimAction { Kind = ActionKind.Train, Slot = slot, CloneId = c.id, Cost = cost, Gain = gain, Label = CloneName(c) + " 훈련" });
                }

            if (!includeAssets) return list;
            double period = Data.PaydayPeriod;

            // 주식: 배당 + 그 일터 수입 보너스
            if (Has(Layer.Stock))
                for (int slot = 1; slot <= City.Slots; slot++)
                {
                    var wp = Workplace(slot);
                    if (!IsListed(slot) || wp.lots >= LotCap(slot)) continue;
                    double price = LotPrice(slot);
                    double divRule = City.Rule == "ipo" ? City.RuleB : City.Rule == "angel" ? City.RuleA : 1;
                    double gain = WorkplaceIncome(slot) / AssetMult(slot) * _stockBonusPerLot + price * Data.E("stock_dividend_rate") * divRule / period;
                    list.Add(new SimAction { Kind = ActionKind.Stock, Slot = slot, Cost = price, Gain = gain, Label = Job(slot).Company + " 주식" });
                }

            // 부동산: 월세 + 입점 보너스
            if (Has(Layer.Property))
            {
                if (PlotsUsed < City.Plots)
                    for (int i = 0; i < City.Properties.Count; i++)
                    {
                        var p = City.Properties[i];
                        if (S.status < p.ReqStatus) continue;
                        double gain = p.Price * Data.E("property_rent_rate") * (City.Rule == "boom" ? City.RuleA : 1) / period;
                        if (p.BoostTier >= 0)
                            for (int slot = 1; slot <= City.Slots; slot++)
                                if (Job(slot).Tier == p.BoostTier) gain += WorkplaceIncome(slot) / AssetMult(slot) * p.BoostPct;
                        list.Add(new SimAction { Kind = ActionKind.Property, Id = p.Id, Cost = p.Price, Gain = gain, Label = p.Name + " 매입" });
                    }
                for (int i = 0; i < S.properties.Count; i++)
                {
                    var ps = S.properties[i];
                    if (ps.city != S.city) continue;
                    double cost = RemodelCost(ps);
                    if (double.IsInfinity(cost)) continue;
                    double gain = PropertyRent(ps) / (1 + ps.remodel * Data.E("property_remodel_rent_bonus")) * Data.E("property_remodel_rent_bonus") / period;
                    list.Add(new SimAction { Kind = ActionKind.Remodel, Slot = i, Id = ps.id, Cost = cost, Gain = gain, Label = Data.PropertiesById[ps.id].Name + " 리모델링" });
                }
            }
            return list;
        }

        /// <summary>slot 칸에서 윗자리로 올릴 한 명. 규칙 0 = 적성 일치 우선, 1 = 레벨 높은 순.</summary>
        CloneState PromotionPick(int slot)
        {
            if (slot >= City.Slots) return null;
            int upTier = Job(slot + 1).Tier;
            CloneState best = null;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot != slot) continue;
                var b = CheckPromotion(c, false);
                if (b != PromoBlock.None && b != PromoBlock.Cert) continue;
                if (best == null) { best = c; continue; }
                bool cm = c.apt == upTier, bm = best.apt == upTier;
                if (S.managerRule == 0 && cm != bm) { if (cm) best = c; continue; }
                if (c.level > best.level || (c.level == best.level && c.id < best.id)) best = c;
            }
            return best;
        }

        CloneState TrainPick(int slot)
        {
            int cap = LevelCap(slot);
            CloneState best = null;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot != slot || c.level >= cap) continue;
                if (best == null || c.level > best.level || (c.level == best.level && c.xp > best.xp)) best = c;
            }
            return best;
        }

        /// <summary>가장 빨리 본전을 뽑는 일(비용 ÷ 초당 수입 증가가 최소). 추천 버튼과 매니저가 쓴다.</summary>
        public SimAction Recommend(bool includeAssets)
        {
            var list = Candidates(includeAssets);
            var best = new SimAction();
            double bestScore = double.PositiveInfinity;
            for (int i = 0; i < list.Count; i++)
            {
                var a = list[i];
                if (a.Gain <= 0) continue;
                double score = a.Cost <= 0 ? 0 : a.Payback;
                if (score < bestScore) { bestScore = score; best = a; }
            }
            return best;
        }

        /// <summary>지금 돈으로 바로 할 수 있는 일 중 가장 좋은 것.</summary>
        public SimAction RecommendAffordable(bool includeAssets)
        {
            var list = Candidates(includeAssets);
            var best = new SimAction();
            double bestScore = double.PositiveInfinity;
            for (int i = 0; i < list.Count; i++)
            {
                var a = list[i];
                if (a.Gain <= 0 || a.Cost > S.money) continue;
                double score = a.Cost <= 0 ? 0 : a.Payback;
                if (score < bestScore) { bestScore = score; best = a; }
            }
            return best;
        }

        public bool Execute(SimAction a)
        {
            switch (a.Kind)
            {
                case ActionKind.Hire: return Hire() != null;
                case ActionKind.Train: return Train(a.CloneId);
                case ActionKind.Promote: return Promote(a.CloneId);
                case ActionKind.Cert: return BuyCert(a.Slot);
                case ActionKind.Facility: return UpgradeFacility(a.Slot);
                case ActionKind.Stock: return BuyLot(a.Slot);
                case ActionKind.Property: return BuyProperty(a.Id);
                case ActionKind.Remodel: return Remodel(a.Slot);
                case ActionKind.House: return BuyHouse();
                case ActionKind.Luxury: return BuyLuxury(a.Id);
                case ActionKind.License: return BuyLicense(a.Id);
                case ActionKind.Trophy: return BuyTrophy();
                case ActionKind.Move: return Move();
            }
            return false;
        }

        // ------------------------------------------------------------------ 목표 바

        public struct GoalInfo
        {
            public string Text;       // "3호 배달 라이더 승진"
            public string Sub;        // "2분 10초 뒤" / "지금 가능"
            public double Progress;   // 0~1
            public double Eta;        // 초
            public SimAction Action;
        }

        /// <summary>
        /// 목표는 하나만. 90초 안에 닿는 것 중 가장 좋은 일, 없으면 가장 빨리 닿는 일.
        /// 신분이 꼭대기 승진을 막고 있으면 그 조건(집·순자산)이 목표가 된다.
        /// </summary>
        public GoalInfo Goal()
        {
            var g = new GoalInfo { Text = "", Sub = "", Eta = double.PositiveInfinity };
            if (S.nextCloneId == 1)
            {
                g.Text = "거울을 눌러 첫 분신 부르기";
                g.Sub = "무료";
                g.Progress = 1; g.Eta = 0;
                g.Action = new SimAction { Kind = ActionKind.Hire, Slot = 1, Cost = 0, Gain = 1, Label = "첫 분신" };
                return g;
            }

            // 신분 벽: 윗자리가 신분을 요구하면 집 → 순자산 순으로 안내
            var statusGoal = StatusGoal();
            var list = Candidates(false);
            SimAction pick = new SimAction();
            double pickScore = double.PositiveInfinity, pickEta = double.PositiveInfinity;
            SimAction soonest = new SimAction();
            double soonestEta = double.PositiveInfinity;
            for (int i = 0; i < list.Count; i++)
            {
                var a = list[i];
                if (a.Gain <= 0) continue;
                double eta = SecondsUntil(a.Cost);
                if (eta < soonestEta) { soonestEta = eta; soonest = a; }
                if (eta <= 90 && a.Payback < pickScore) { pickScore = a.Payback; pick = a; pickEta = eta; }
            }
            if (!pick.Valid) { pick = soonest; pickEta = soonestEta; }
            if (statusGoal.Valid && (!pick.Valid || pickEta > 90 || pick.Kind == ActionKind.Train))
            {
                pick = statusGoal;
                pickEta = SecondsUntil(statusGoal.Cost);
            }
            if (!pick.Valid)
            {
                if (CanMove) { g.Text = "이삿짐 트럭이 기다리는 중"; g.Sub = "다음 도시로"; g.Progress = 1; g.Eta = 0; g.Action = new SimAction { Kind = ActionKind.Move, Label = "이사" }; }
                else { g.Text = "분신들이 자라는 중"; g.Sub = "레벨이 오르면 승진할 수 있어요"; g.Progress = NearestPromoProgress(); }
                return g;
            }
            g.Action = pick;
            g.Text = pick.Label;
            g.Eta = pickEta;
            g.Progress = pick.Cost <= 0 ? 1 : Math.Max(0, Math.Min(1, S.money / pick.Cost));
            g.Sub = pickEta <= 0 ? "지금 가능" : NumberFormat.Duration(pickEta) + " 뒤";
            return g;
        }

        SimAction StatusGoal()
        {
            if (!Has(Layer.Status)) return new SimAction();
            int need = 0;
            for (int slot = 1; slot <= City.Slots; slot++)
                if (Job(slot).ReqStatus > S.status && Workplace(slot).open) need = Math.Max(need, Job(slot).ReqStatus);
            if (need <= S.status) return new SimAction();
            int rank = S.status + 1;
            if (!HasStatusAsset(rank))
            {
                var h = NextHouse;
                if (h != null) return new SimAction { Kind = ActionKind.House, Cost = h.Price, Gain = 1, Label = h.Name + "(으)로 이사 → 신분 상승" };
            }
            double gap = Data.Status[rank].NetWorth - NetWorth();
            if (gap > 0) return new SimAction { Kind = ActionKind.None };
            return new SimAction();
        }

        double NearestPromoProgress()
        {
            double best = 0;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot <= 0) continue;
                best = Math.Max(best, Math.Min(1.0, (double)c.level / PromoLevel(c.slot)));
            }
            return best;
        }

        // ------------------------------------------------------------------ 매니저 분신

        /// <summary>
        /// 매니저: 추천 승진·자동 훈련·자동 시설·자동 고용. 자산 구매는 플레이어의 몫으로 남긴다.
        /// 훈련은 수입 대비 싼 것만 자동으로 한다(돈을 훈련에 다 쓰지 않게).
        /// </summary>
        void StepManager(double dt)
        {
            if (!S.manager || !S.managerOn) return;
            S.managerTimer += dt;
            if (S.managerTimer < Data.E("manager_interval_sec")) return;
            S.managerTimer = 0;
            var list = Candidates(false);
            var best = new SimAction();
            double bestScore = double.PositiveInfinity;
            for (int i = 0; i < list.Count; i++)
            {
                var a = list[i];
                if (a.Gain <= 0 || a.Cost > S.money) continue;
                if (a.Kind == ActionKind.Train && a.Payback > 900) continue;
                if (a.Payback < bestScore) { bestScore = a.Payback; best = a; }
            }
            if (!best.Valid) return;
            double keepSinceAction = S.sinceAction; // 매니저가 한 일은 '플레이어 반응'으로 치지 않는다
            if (Execute(best)) Emit(SimEventType.ManagerActed, 0, 0, best.Cost, best.Label);
            S.sinceAction = keepSinceAction;
        }

        // ------------------------------------------------------------------ 벽(R-015)

        public bool AtWall { get; private set; }

        /// <summary>
        /// 벽 = 접속 중 다음 진전까지 180초 이상 남고(예금으로 살 수 있으면 제외) 의미 있는 행동이 없는 상태.
        /// 꼭대기 첫 승진 전 = 막다른 벽, 후 = 출구 있는 벽(이사 가능).
        /// </summary>
        void StepWall(double dt)
        {
            _wallTimer += dt;
            if (_wallTimer >= 2)
            {
                _wallTimer = 0;
                var best = Recommend(false);
                double limit = Data.E("move_recommend_eta_sec");
                bool wall;
                if (!best.Valid) wall = PromotionQueue().Count == 0 && S.eventId.Length == 0 && !HasPendingPayday;
                else wall = best.Cost > S.money + S.deposit && SecondsUntil(best.Cost) >= limit;
                if (wall && S.paydayTimer < limit) wall = false; // 월급날이 곧 오면 벽이 아니다
                AtWall = wall;
            }
            if (!AtWall) { _deadRun = 0; return; }
            S.stats.wallSec += dt;
            if (!Has(Layer.Move))
            {
                S.stats.deadWallSec += dt;
                _deadRun += dt;
                if (_deadRun > S.stats.longestDeadWallSec) S.stats.longestDeadWallSec = _deadRun;
            }
        }
        double _wallTimer, _deadRun;

        /// <summary>이사 추천: 이사가 열려 있고 벽에 닿았을 때만(이사는 선택).</summary>
        public bool MoveRecommended { get { return CanMove && AtWall; } }
    }
}
