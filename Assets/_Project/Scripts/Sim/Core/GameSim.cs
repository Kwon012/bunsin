using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    /// <summary>
    /// 게임 규칙 전체(순수 C#). 화면은 이 클래스의 조회·행동 메서드만 부르고, 일어난 일은 Events로 받는다.
    /// 수입 배수의 원천은 6개로 고정한다(기획서 v4 5.5): 자리 · 레벨 · 적성 · 시설 · 자산 · 명성.
    /// 같은 원천 안에서는 더하고 원천끼리만 곱한다.
    /// </summary>
    public sealed partial class GameSim
    {
        public readonly GameData Data;
        public GameState S;
        public readonly List<SimEvent> Events = new List<SimEvent>();

        /// <summary>기기 시각의 '시'(0~23). 화면 쪽에서 넣어 준다. 숨은 조건(밤 접속)에 쓴다.</summary>
        public int LocalHour = 12;

        // economy.csv 값 캐시
        readonly double _levelBonus, _aptBonus, _aptXpBonus, _xpBase, _xpGrowth, _facBonus, _facGrowth,
            _fameBonus, _retireBonus, _stockBonusPerLot, _tapRatio, _feverMult, _boostMult;
        readonly int _capPerStage, _bonusCapLevels;
        double[] _xpNeed = new double[0];

        public GameSim(GameData data, GameState state)
        {
            Data = data;
            S = state;
            _levelBonus = data.E("level_bonus");
            _aptBonus = data.E("apt_bonus");
            _aptXpBonus = data.E("apt_xp_bonus");
            _xpBase = data.E("xp_base_sec");
            _xpGrowth = data.E("xp_growth");
            _facBonus = data.E("facility_bonus");
            _facGrowth = data.E("facility_growth");
            _fameBonus = data.E("fame_bonus");
            _retireBonus = data.E("retire_bonus");
            _stockBonusPerLot = data.E("stock_bonus_per_lot");
            _tapRatio = data.E("tap_income_ratio");
            _feverMult = data.E("fever_mult");
            _boostMult = data.E("ad_boost_mult");
            _capPerStage = (int)data.E("cap_per_facility_stage");
            _bonusCapLevels = (int)data.E("bonus_xp_cap_levels");
            Repair();
        }

        public static GameState NewGame(GameData data, long seed)
        {
            var s = new GameState { rng = seed == 0 ? 1 : seed, dataVersion = data.DataVersion };
            s.paydayTimer = data.PaydayFirst;
            s.workplaces = NewWorkplaces(data.City(1));
            return s;
        }

        static List<WorkplaceState> NewWorkplaces(CityData city)
        {
            var list = new List<WorkplaceState>();
            for (int i = 1; i <= city.Slots; i++) list.Add(new WorkplaceState { slot = i, open = i == 1 });
            return list;
        }

        /// <summary>불러온 저장이 데이터와 어긋나도 게임이 돌게 맞춘다.</summary>
        void Repair()
        {
            if (S.city < 1) S.city = 1;
            if (S.city > Data.Cities.Count) S.city = Data.Cities.Count;
            var city = City;
            if (S.workplaces == null) S.workplaces = new List<WorkplaceState>();
            while (S.workplaces.Count < city.Slots)
                S.workplaces.Add(new WorkplaceState { slot = S.workplaces.Count + 1, open = S.workplaces.Count == 0 });
            if (S.workplaces.Count > city.Slots) S.workplaces.RemoveRange(city.Slots, S.workplaces.Count - city.Slots);
            if (S.clones == null) S.clones = new List<CloneState>();
            if (S.pendingPayday == null) S.pendingPayday = new PaydayReport();
            if (S.pendingOffline == null) S.pendingOffline = new OfflineReport();
            if (S.stats == null) S.stats = new StatBlock();
            if (S.paydayTimer <= 0 || S.paydayTimer > Data.PaydayPeriod) S.paydayTimer = Math.Min(Data.PaydayPeriod, Math.Max(1, S.paydayTimer));
            if (S.status >= Data.Status.Count) S.status = Data.Status.Count - 1;
            if (S.houseTier >= Data.Houses.Count) S.houseTier = Data.Houses.Count - 1;
            foreach (var c in S.clones)
            {
                if (c.history == null) c.history = new List<string>();
                if (c.name == null) c.name = "";
                if (c.unique == null) c.unique = "";
                if (c.level < 1) c.level = 1;
                if (c.slot > city.Slots) { c.slot = 0; c.seat = -1; }
            }
            S.dataVersion = Data.DataVersion;
        }

        // ------------------------------------------------------------------ 조회

        public CityData City { get { return Data.City(S.city); } }
        public JobData Job(int slot) { return City.Jobs[slot - 1]; }
        public WorkplaceState Workplace(int slot) { return S.workplaces[slot - 1]; }
        public bool Has(int layer) { return (S.layerMask & (1 << layer)) != 0; }
        public bool InFever { get { return S.feverLeft > 0; } }
        public bool InSeason { get { return S.seasonLeft > 0; } }
        public bool IsLastCity { get { return S.city >= Data.Cities.Count; } }

        public CloneState Clone(int id)
        {
            for (int i = 0; i < S.clones.Count; i++) if (S.clones[i].id == id) return S.clones[i];
            return null;
        }

        public string CloneName(CloneState c) { return string.IsNullOrEmpty(c.name) ? c.id + "호" : c.name; }

        public int CountAt(int slot)
        {
            int n = 0;
            for (int i = 0; i < S.clones.Count; i++) if (S.clones[i].slot == slot) n++;
            return n;
        }

        public int BenchCount { get { return CountAt(0); } }
        public bool HasVacancy(int slot) { return CountAt(slot) < Data.SeatsPerJob; }

        public CloneState SeatedAt(int slot, int seat)
        {
            for (int i = 0; i < S.clones.Count; i++)
                if (S.clones[i].slot == slot && S.clones[i].seat == seat) return S.clones[i];
            return null;
        }

        int FreeSeat(int slot)
        {
            for (int seat = 0; seat < Data.SeatsPerJob; seat++)
                if (SeatedAt(slot, seat) == null) return seat;
            return -1;
        }

        /// <summary>이 칸에서 윗자리로 승진할 수 있는 기준 레벨(꼭대기에서는 은퇴 기준).</summary>
        public int PromoLevel(int slot) { return Data.LevelPerSlot * slot; }

        public int FacilityStage(int slot) { return Workplace(slot).facility / Data.FacilityStageLevels; }

        /// <summary>이 칸에 머무는 동안의 레벨 상한 = 승진 기준 + 시설 등급 보너스.</summary>
        public int LevelCap(int slot) { return PromoLevel(slot) + FacilityStage(slot) * _capPerStage; }

        public double XpNeed(int level)
        {
            if (level < 1) level = 1;
            if (level >= _xpNeed.Length)
            {
                int old = _xpNeed.Length;
                Array.Resize(ref _xpNeed, level + 32);
                for (int i = old; i < _xpNeed.Length; i++) _xpNeed[i] = _xpBase * Math.Pow(_xpGrowth, i - 1);
            }
            return _xpNeed[level];
        }

        public bool AptMatches(CloneState c) { return c.slot > 0 && Job(c.slot).Tier == c.apt; }

        /// <summary>명성 원천: 이사로 얻은 명성 + 명예의 전당.</summary>
        public double FameMult { get { return 1 + S.fame * _fameBonus + S.hall.Count * _retireBonus; } }

        /// <summary>자산 원천: 그 일터 주식 + 그 계층을 돕는 내 건물.</summary>
        public double AssetMult(int slot)
        {
            var wp = Workplace(slot);
            double m = 1 + wp.lots * _stockBonusPerLot;
            int tier = Job(slot).Tier;
            for (int i = 0; i < S.properties.Count; i++)
            {
                var p = S.properties[i];
                if (p.city != S.city) continue;
                PropertyData pd;
                if (Data.PropertiesById.TryGetValue(p.id, out pd) && pd.BoostTier == tier) m += pd.BoostPct;
            }
            return m;
        }

        public double FacilityMult(int slot) { return 1 + Workplace(slot).facility * _facBonus; }

        double UniquePassive(CloneState c, string kind)
        {
            if (string.IsNullOrEmpty(c.unique)) return 0;
            UniqueData u;
            return Data.UniquesById.TryGetValue(c.unique, out u) && u.Passive == kind ? u.Value : 0;
        }

        double UniquePassiveAll(string kind)
        {
            double v = 0;
            for (int i = 0; i < S.clones.Count; i++) v += UniquePassive(S.clones[i], kind);
            return v;
        }

        /// <summary>분신 한 명이 slot·level에서 버는 초당 수입(피버·부스트·시즌 제외).</summary>
        public double IncomeAt(CloneState c, int slot, int level)
        {
            if (slot <= 0) return 0;
            var job = Job(slot);
            double v = job.BaseIncome;                                   // 자리
            v *= 1 + _levelBonus * (level - 1) + UniquePassive(c, "job"); // 레벨(+개성)
            if (job.Tier == c.apt) v *= 1 + _aptBonus;                   // 적성
            v *= FacilityMult(slot);                                     // 시설
            v *= AssetMult(slot);                                        // 자산
            v *= FameMult;                                               // 명성
            return v;
        }

        public double CloneIncome(CloneState c) { return IncomeAt(c, c.slot, c.level); }

        public double WorkplaceIncome(int slot)
        {
            double v = 0;
            for (int i = 0; i < S.clones.Count; i++) if (S.clones[i].slot == slot) v += CloneIncome(S.clones[i]);
            return v;
        }

        /// <summary>근로 초당 수입 합계(일시 배수 제외). 가격·한도·보상의 기준 단위.</summary>
        public double IncomePerSec()
        {
            double v = 0;
            for (int i = 0; i < S.clones.Count; i++) v += CloneIncome(S.clones[i]);
            return v;
        }

        /// <summary>지금 적용 중인 일시 배수를 넣은 초당 수입(화면 표시용).</summary>
        public double IncomePerSecNow()
        {
            double v = 0;
            for (int i = 0; i < S.clones.Count; i++) v += CloneIncome(S.clones[i]) * TempMult(S.clones[i].slot);
            return v;
        }

        double TempMult(int slot)
        {
            if (slot <= 0) return 0;
            double m = 1;
            if (S.feverLeft > 0) m *= _feverMult;
            if (S.boostLeft > 0) m *= _boostMult;
            if (S.seasonLeft > 0 && Job(slot).Tier == Tier.Alba) m *= 2;
            return m;
        }

        public double TapValue()
        {
            double v = City.TapBase + IncomePerSec() * _tapRatio;
            v *= 1 + UniquePassiveAll("tap");
            if (S.boostLeft > 0) v *= _boostMult;
            return v;
        }

        /// <summary>수입이 0일 때도 쓸 수 있는 '1초의 가치'(보상·한도 계산용).</summary>
        public double SecondValue() { return Math.Max(IncomePerSec(), City.TapBase); }

        public double SecondsUntil(double cost)
        {
            if (cost <= S.money) return 0;
            double inc = IncomePerSecNow();
            return inc <= 0 ? double.PositiveInfinity : (cost - S.money) / inc;
        }

        // ------------------------------------------------------------------ 내부 도구

        void Emit(SimEventType type, int a = 0, int b = 0, double v = 0, string s = null)
        {
            if (Events.Count > 400) Events.RemoveRange(0, 200); // 화면이 비우지 않아도 무한히 쌓이지 않게
            Events.Add(new SimEvent { Type = type, A = a, B = b, V = v, S = s });
        }

        void Earn(double amount, int source)
        {
            if (amount <= 0) return;
            S.money += amount;
            S.totalEarned += amount;
            S.cityEarned += amount;
            switch (source)
            {
                case 0: S.stats.tapIncome += amount; break;
                case 1: S.stats.eventIncome += amount; break;
                case 2: S.stats.paydayIncome += amount; break;
                case 3: S.stats.offlineIncome += amount; break;
            }
        }

        bool Spend(double cost)
        {
            if (cost > S.money + 1e-6) return false;
            S.money -= cost;
            if (S.money < 0) S.money = 0;
            S.sinceAction = 0;
            return true;
        }

        void MarkFirst(string key)
        {
            if (S.stats.firsts.Contains(key)) return;
            S.stats.firsts.Add(key);
            S.stats.firstsAt.Add(S.playSec);
        }

        public double FirstAt(string key)
        {
            int i = S.stats.firsts.IndexOf(key);
            return i < 0 ? -1 : S.stats.firstsAt[i];
        }

        // ------------------------------------------------------------------ 시간

        /// <summary>접속 중 시간 진행. 긴 dt는 1초 이하 조각으로 나눠 처리한다.</summary>
        public void Tick(double dt)
        {
            while (dt > 0)
            {
                double step = dt > 1 ? 1 : dt;
                Step(step);
                dt -= step;
            }
        }

        void Step(double dt)
        {
            S.playSec += dt;
            S.sessionSec += dt;
            S.sinceTap += dt;
            S.sinceAction += dt;
            S.sinceEvent += dt;
            S.sinceNews += dt;
            S.sinceLayerIntro += dt;
            S.sinceClosing += dt;
            if (S.adCooldown > 0) S.adCooldown = Math.Max(0, S.adCooldown - dt);

            // 근로 수입과 경험
            double earned = 0;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (c.slot <= 0) continue;
                double inc = CloneIncome(c) * TempMult(c.slot) * dt;
                c.earnedSincePayday += inc;
                earned += inc;
                AddXp(c, dt * XpRate(c));
            }
            if (earned > 0)
            {
                S.money += earned;
                S.totalEarned += earned;
                S.cityEarned += earned;
                S.stats.workIncome += earned;
            }

            StepFever(dt);
            if (S.boostLeft > 0) S.boostLeft = Math.Max(0, S.boostLeft - dt);
            StepCityRule(dt);
            StepPayday(dt);
            SeatBench();
            StepDirector(dt);
            StepManager(dt);
            StepWall(dt);
        }

        void StepFever(double dt)
        {
            if (S.feverLeft > 0)
            {
                S.feverLeft -= dt;
                if (S.feverLeft <= 0)
                {
                    S.feverLeft = 0;
                    S.feverGauge = 0;
                    if (S.combo > S.stats.bestCombo) S.stats.bestCombo = S.combo;
                    Emit(SimEventType.FeverEnd, S.combo);
                    S.combo = 0;
                }
                return;
            }
            if (S.feverGauge > 0 && S.sinceTap > Data.E("fever_decay_delay_sec"))
            {
                S.feverGauge = Math.Max(0, S.feverGauge - Data.E("fever_decay_per_sec") * dt);
                if (S.feverGauge <= 0) S.combo = 0;
            }
            if (S.feverGauge <= 0 && S.sinceTap > 8) S.feverStreak = 0;
        }

        void StepCityRule(double dt)
        {
            var city = City;
            if (!Has(Layer.CityRule)) return;
            if (city.Rule == "season")
            {
                if (S.seasonLeft > 0)
                {
                    S.seasonLeft -= dt;
                    if (S.seasonLeft <= 0) { S.seasonLeft = 0; Emit(SimEventType.SeasonEnd); }
                    return;
                }
                S.ruleTimer -= dt;
                if (S.ruleTimer <= 0)
                {
                    S.ruleTimer = city.RuleA;
                    S.seasonLeft = city.RuleB;
                    Emit(SimEventType.SeasonStart);
                }
            }
            else if (city.Rule == "trade")
            {
                S.ruleTimer -= dt;
                if (S.ruleTimer <= 0)
                {
                    S.ruleTimer = city.RuleA;
                    double v = IncomePerSec() * city.RuleB;
                    Earn(v, 5);
                    Emit(SimEventType.TradeArrived, 0, 0, v);
                }
            }
        }

        // ------------------------------------------------------------------ 탭·피버

        /// <summary>본체 탭. 꾹 누르기 자동 탭이면 hold = true(게이지를 느리게 채운다).</summary>
        public double Tap(bool hold = false)
        {
            double v = TapValue();
            Earn(v, 0);
            S.stats.taps++;
            S.sinceTap = 0;
            S.sinceAction = 0;
            S.combo++;
            if (S.feverLeft <= 0)
            {
                S.feverGauge += (hold ? Data.E("fever_hold_charge") : 1.0) / Data.E("fever_taps");
                if (S.feverGauge >= 1 - 1e-9)
                {
                    S.feverGauge = 1;
                    S.feverLeft = Data.E("fever_duration_sec");
                    S.stats.feverCount++;
                    S.feverStreak++;
                    MarkFirst("fever");
                    Emit(SimEventType.FeverStart);
                }
            }
            return v;
        }
    }
}
