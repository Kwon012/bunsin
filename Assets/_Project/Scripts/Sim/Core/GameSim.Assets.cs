using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    // 돈의 2·3층: 예금 · 부동산 · 주식 · 집 · 사치품 · 트로피 · 신분 등급 · 이사
    // 공통 규칙(v4 6.2): 손해 없음(가치는 떨어지지 않는다) · 확률 없음 · 자산 수입에는 보유 한도.
    public sealed partial class GameSim
    {
        // ------------------------------------------------------------------ 예금

        /// <summary>예금 한도 = 초당 수입 × deposit_cap_income_sec. 자산이 근로를 대체하지 않게 묶는다.</summary>
        public double DepositCap()
        {
            return Math.Max(IncomePerSec() * Data.E("deposit_cap_income_sec"), City.HireBase * 20);
        }

        /// <summary>현금의 ratio(0~1)만큼 넣는다. 한도까지만 들어간다.</summary>
        public double Deposit(double ratio)
        {
            if (!Has(Layer.Deposit)) return 0;
            double room = Math.Max(0, DepositCap() - S.deposit);
            double amount = Math.Min(room, S.money * Math.Max(0, Math.Min(1, ratio)));
            if (amount <= 0) return 0;
            S.money -= amount;
            S.deposit += amount;
            S.sinceAction = 0;
            MarkFirst("first_deposit");
            Emit(SimEventType.DepositChanged, 0, 0, S.deposit);
            return amount;
        }

        /// <summary>통장 깨기. 언제든 전액을 현금으로(수수료 없음).</summary>
        public double WithdrawAll()
        {
            double amount = S.deposit;
            if (amount <= 0) return 0;
            S.deposit = 0;
            S.money += amount;
            S.sinceAction = 0;
            Emit(SimEventType.DepositChanged, 1, 0, 0);
            return amount;
        }

        // ------------------------------------------------------------------ 부동산

        public int PlotsUsed
        {
            get
            {
                int n = 0;
                for (int i = 0; i < S.properties.Count; i++) if (S.properties[i].city == S.city) n++;
                return n;
            }
        }

        public bool CanBuyProperty(PropertyData p)
        {
            return Has(Layer.Property) && p.City == S.city && PlotsUsed < City.Plots && S.status >= p.ReqStatus;
        }

        public bool BuyProperty(string id)
        {
            PropertyData p;
            if (!Data.PropertiesById.TryGetValue(id, out p) || !CanBuyProperty(p)) return false;
            if (!Spend(p.Price)) return false;
            int plot = 0;
            for (; plot < City.Plots; plot++)
            {
                bool used = false;
                for (int i = 0; i < S.properties.Count; i++)
                    if (S.properties[i].city == S.city && S.properties[i].plot == plot) { used = true; break; }
                if (!used) break;
            }
            S.properties.Add(new PropertyState { id = id, city = S.city, plot = plot });
            MarkFirst("first_property");
            Request(Layer.Status);
            Emit(SimEventType.AssetBought, 0, 0, p.Price, p.Name);
            CheckStatus();
            return true;
        }

        public double RemodelCost(PropertyState ps)
        {
            if (ps.remodel >= (int)Data.E("property_remodel_max")) return double.PositiveInfinity;
            return Data.PropertiesById[ps.id].Price * Data.E("property_remodel_cost_ratio");
        }

        public bool Remodel(int index)
        {
            if (index < 0 || index >= S.properties.Count) return false;
            var ps = S.properties[index];
            double cost = RemodelCost(ps);
            if (double.IsInfinity(cost) || !Spend(cost)) return false;
            ps.remodel++;
            Emit(SimEventType.AssetBought, 5, 0, cost, Data.PropertiesById[ps.id].Name);
            return true;
        }

        public double PropertyValue(PropertyState ps)
        {
            PropertyData p;
            if (!Data.PropertiesById.TryGetValue(ps.id, out p)) return 0;
            return p.Price * (1 + ps.remodel * Data.E("property_remodel_cost_ratio"));
        }

        public double PropertyRent(PropertyState ps)
        {
            PropertyData p;
            if (!Data.PropertiesById.TryGetValue(ps.id, out p)) return 0;
            double rent = p.Price * Data.E("property_rent_rate") * (1 + ps.remodel * Data.E("property_remodel_rent_bonus"));
            var city = Data.City(ps.city);
            if (city.Rule == "boom") rent *= city.RuleA;
            return rent;
        }

        /// <summary>지금 도시 건물의 월세 합계(월급날마다).</summary>
        public double RentPerPayday()
        {
            double v = 0;
            for (int i = 0; i < S.properties.Count; i++)
                if (S.properties[i].city == S.city) v += PropertyRent(S.properties[i]);
            return v;
        }

        // ------------------------------------------------------------------ 주식

        public int StockListLevel
        {
            get { return City.Rule == "ipo" ? (int)City.RuleA : (int)Data.E("stock_list_level"); }
        }

        public bool IsListed(int slot) { return Workplace(slot).facility >= StockListLevel; }

        /// <summary>1주 가격. 시세는 일터 시설이 오를 때만 오른다(무작위 등락 없음).</summary>
        public double LotPrice(int slot)
        {
            return Job(slot).BaseIncome * Data.E("stock_lot_cost_sec") * (1 + 0.1 * Workplace(slot).facility);
        }

        /// <summary>보유 한도 = 그 일터 시설 단계(일터 규모에 묶는다).</summary>
        public int LotCap(int slot) { return Workplace(slot).facility; }

        public bool BuyLot(int slot)
        {
            var wp = Workplace(slot);
            if (!Has(Layer.Stock) || !IsListed(slot) || wp.lots >= LotCap(slot)) return false;
            double price = LotPrice(slot);
            if (!Spend(price)) return false;
            wp.lots++;
            MarkFirst("first_stock");
            Emit(SimEventType.AssetBought, 1, slot, price, Job(slot).Company);
            return true;
        }

        public bool SellLot(int slot)
        {
            var wp = Workplace(slot);
            if (wp.lots <= 0) return false;
            wp.lots--;
            double price = LotPrice(slot);
            S.money += price;
            S.sinceAction = 0;
            Emit(SimEventType.MoneyGain, 4, 0, price);
            return true;
        }

        public double StockValue()
        {
            double v = 0;
            for (int s = 1; s <= City.Slots; s++) v += Workplace(s).lots * LotPrice(s);
            return v;
        }

        public double DividendPerPayday()
        {
            double v = StockValue() * Data.E("stock_dividend_rate");
            if (City.Rule == "ipo") v *= City.RuleB;
            else if (City.Rule == "angel") v *= City.RuleA;
            return v;
        }

        public bool SellHeld(int index)
        {
            if (index < 0 || index >= S.heldStocks.Count) return false;
            double v = S.heldStocks[index].value;
            S.heldStocks.RemoveAt(index);
            S.money += v;
            S.sinceAction = 0;
            Emit(SimEventType.MoneyGain, 4, 0, v);
            return true;
        }

        /// <summary>
        /// 떠난 도시에 남긴 건물의 월세 + 보유 종목 배당. 합계에는 상한이 있다(지금 초당 수입 × old_city_asset_cap_income_sec).
        /// </summary>
        public double OldCityAssetPerPayday()
        {
            double v = 0;
            for (int i = 0; i < S.properties.Count; i++)
                if (S.properties[i].city != S.city) v += PropertyRent(S.properties[i]);
            double rate = Data.E("stock_dividend_rate");
            for (int i = 0; i < S.heldStocks.Count; i++) v += S.heldStocks[i].value * rate;
            if (v <= 0) return 0;
            double cap = IncomePerSec() * Data.E("old_city_asset_cap_income_sec");
            if (City.Rule == "royalty" || City.Rule == "holding") cap *= City.RuleA;
            return Math.Min(v, cap);
        }

        // ------------------------------------------------------------------ 집·사치품·트로피

        public HouseData NextHouse { get { return S.houseTier + 1 < Data.Houses.Count ? Data.Houses[S.houseTier + 1] : null; } }

        public bool BuyHouse()
        {
            var h = NextHouse;
            if (h == null || !Has(Layer.Status)) return false;
            if (!Spend(h.Price)) return false;
            S.houseTier = h.Tier;
            MarkFirst("house_" + h.Tier);
            Emit(SimEventType.AssetBought, 2, h.Tier, h.Price, h.Name);
            CheckStatus();
            return true;
        }

        public bool OwnsLuxury(string id) { return S.luxuries.Contains(id); }
        public bool HasLicense(string id) { return S.licenses.Contains(id); }

        public bool BuyLicense(string luxuryId)
        {
            LuxuryData l;
            if (!Data.LuxuriesById.TryGetValue(luxuryId, out l) || l.LicenseCost <= 0 || HasLicense(luxuryId)) return false;
            if (!Spend(l.LicenseCost)) return false;
            S.licenses.Add(luxuryId);
            Emit(SimEventType.AssetBought, 6, 0, l.LicenseCost, l.Name + " 면허");
            return true;
        }

        public bool CanBuyLuxury(LuxuryData l)
        {
            return Has(Layer.Status) && !OwnsLuxury(l.Id) && S.status >= l.ReqStatus
                   && (l.LicenseCost <= 0 || HasLicense(l.Id));
        }

        public bool BuyLuxury(string id)
        {
            LuxuryData l;
            if (!Data.LuxuriesById.TryGetValue(id, out l) || !CanBuyLuxury(l)) return false;
            if (!Spend(l.Price)) return false;
            S.luxuries.Add(id);
            Emit(SimEventType.AssetBought, 3, l.Set, l.Price, l.Name);
            if (SetComplete(l.Set)) Emit(SimEventType.SetComplete, l.Set, 0, 0, l.SetName);
            CheckStatus();
            return true;
        }

        public bool SetComplete(int set)
        {
            int have = 0, need = 0;
            for (int i = 0; i < Data.Luxuries.Count; i++)
            {
                if (Data.Luxuries[i].Set != set) continue;
                need++;
                if (OwnsLuxury(Data.Luxuries[i].Id)) have++;
            }
            return need > 0 && have == need;
        }

        public bool OwnsTrophy(int city) { return S.trophies.Contains(city); }

        public bool BuyTrophy()
        {
            var t = City.Trophy;
            if (!Has(Layer.Status) || OwnsTrophy(S.city) || S.status < t.ReqStatus) return false;
            if (!Spend(t.Price)) return false;
            S.trophies.Add(S.city);
            Emit(SimEventType.AssetBought, 4, S.city, t.Price, t.Name);
            return true;
        }

        // ------------------------------------------------------------------ 순자산·신분

        /// <summary>순자산 = 현금 + 예금 + 부동산 + 주식 + 집 + 사치품 + 트로피. 이 게임의 대표 숫자.</summary>
        public double NetWorth()
        {
            double v = S.money + S.deposit + StockValue();
            for (int i = 0; i < S.properties.Count; i++) v += PropertyValue(S.properties[i]);
            for (int i = 0; i < S.heldStocks.Count; i++) v += S.heldStocks[i].value;
            for (int t = 1; t <= S.houseTier && t < Data.Houses.Count; t++) v += Data.Houses[t].Price;
            for (int i = 0; i < S.luxuries.Count; i++)
            {
                LuxuryData l;
                if (Data.LuxuriesById.TryGetValue(S.luxuries[i], out l)) v += l.Price;
            }
            for (int i = 0; i < S.trophies.Count; i++) v += Data.City(S.trophies[i]).Trophy.Price;
            return v;
        }

        /// <summary>등급 r의 대표 자산 조건: 집 단계 또는 그 등급의 사치품 세트.</summary>
        public bool HasStatusAsset(int rank)
        {
            var st = Data.Status[rank];
            return S.houseTier >= st.HouseTier || (st.LuxurySets > 0 && SetComplete(rank));
        }

        public bool MeetsStatus(int rank)
        {
            if (rank <= 0) return true;
            if (rank >= Data.Status.Count) return false;
            return NetWorth() >= Data.Status[rank].NetWorth && HasStatusAsset(rank);
        }

        /// <summary>
        /// 신분은 화폐가 아니라 자격이다. 순자산만으로는 오르지 않고 대표 자산이 있어야 한다(쓰는 재미).
        /// 한 번 오른 등급은 내려가지 않는다(손해 없음).
        /// </summary>
        public void CheckStatus()
        {
            while (S.status + 1 < Data.Status.Count && MeetsStatus(S.status + 1))
            {
                S.status++;
                MarkFirst("status_" + S.status);
                Emit(SimEventType.StatusUp, S.status, 0, 0, Data.Status[S.status].Name);
            }
        }

        // ------------------------------------------------------------------ 이사(P1: 분신 동행 + 경력직 재취업)

        public bool CanMove { get { return Has(Layer.Move) && !IsLastCity; } }

        public int FameGainPreview()
        {
            int gain = (int)Math.Floor(Math.Sqrt(Math.Max(0, S.cityEarned) / City.FameUnit));
            if (OwnsTrophy(S.city)) gain += 2;
            return Math.Max(1, gain);
        }

        public double SettleMoney()
        {
            if (IsLastCity) return 0;
            return Data.City(S.city + 1).HireBase * Data.E("settle_hire_count");
        }

        /// <summary>
        /// 다음 도시로 이사. 가져가는 것: 분신 전원(레벨 일부·적성·개성·이력), 명성, 매니저, 예금, 집·사치품·신분,
        /// 떠난 도시의 건물과 주식(수입 상한 있음). 바뀌는 것: 현금 → 정착금, 일터·시설·자격증은 새 도시 것으로.
        /// </summary>
        public bool Move()
        {
            if (!CanMove) return false;
            int gain = FameGainPreview();
            S.fame += gain;

            // 주식은 '보유 종목'이 된다
            for (int s = 1; s <= City.Slots; s++)
            {
                var wp = Workplace(s);
                if (wp.lots > 0)
                    S.heldStocks.Add(new HeldStock { jobId = Job(s).Id, city = S.city, lots = wp.lots, value = wp.lots * LotPrice(s) });
            }

            double settle = SettleMoney();
            S.city++;
            S.money = settle;
            S.cityEarned = 0;
            S.workplaces = NewWorkplaces(City);
            double keep = Data.E("move_keep_level_ratio");
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                c.slot = 0; c.seat = -1;
                c.level = Math.Max(1, (int)Math.Floor(c.level * keep));
                c.xp = 0; c.bonusXp = 0; c.earnedSincePayday = 0;
                c.matchRewarded = false;
            }
            S.feverGauge = 0; S.feverLeft = 0; S.combo = 0;
            S.seasonLeft = 0;
            S.ruleTimer = (City.Rule == "season" || City.Rule == "trade") ? City.RuleA : 0;
            S.eventId = ""; S.eventLeft = 0;
            S.layerMask &= ~(1 << Layer.Move);
            S.layerMask &= ~(1 << Layer.Retire);
            S.stats.moves++;
            S.sinceAction = 0;
            MarkFirst("move_" + S.city);
            Emit(SimEventType.Moved, S.city, gain);
            if (City.Rule != "none") Unlock(Layer.CityRule, true);
            SeatBench();
            return true;
        }
    }
}
