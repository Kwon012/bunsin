using System;
using System.Linq;
using NUnit.Framework;
using Bunsin.Sim;

namespace Bunsin.Sim.Tests
{
    public class DataTests
    {
        [Test]
        public void Data_Loads_And_Validates()
        {
            var d = TestData.Load();
            Assert.AreEqual(8, d.Cities.Count);
            Assert.AreEqual(58, d.JobsById.Count);
            CollectionAssert.AreEqual(new[] { 5, 6, 7, 8, 8, 8, 8, 8 }, d.Cities.Select(c => c.Slots).ToArray());
            Assert.AreEqual("분식집 사장", d.Job(1, 5).Name);
            Assert.IsTrue(d.Job(1, 5).IsTop);
            Assert.AreEqual(14, d.Layers.Count);
        }

        [Test]
        public void Next_City_First_Job_Earns_More_Than_Previous_Top()
        {
            var d = TestData.Load();
            for (int c = 2; c <= d.Cities.Count; c++)
                Assert.Greater(d.Job(c, 1).BaseIncome, d.Job(c - 1, d.City(c - 1).Slots).BaseIncome);
        }

        [Test]
        public void Promotion_Is_Always_A_Raise_Even_From_A_Maxed_Workplace()
        {
            // 아랫 일터를 끝까지 키워도(시설 최고 + 주식 한도 + 건물 보너스) 윗자리 기본 수입이 더 커야 한다.
            var d = TestData.Load();
            double maxLower = (1 + d.FacilityMaxLevel * d.E("facility_bonus"))
                              * (1 + d.FacilityMaxLevel * d.E("stock_bonus_per_lot") + 0.10);
            foreach (var city in d.Cities)
                for (int s = 1; s < city.Slots; s++)
                    Assert.Greater(city.Jobs[s].BaseIncome / city.Jobs[s - 1].BaseIncome, maxLower,
                        city.Name + " " + s + "칸 → " + (s + 1) + "칸");
        }

        [TestCase(0, "0")]
        [TestCase(9999, "9,999")]
        [TestCase(10000, "1만")]
        [TestCase(12345, "1.23만")]
        [TestCase(99999999, "9,999만")]
        [TestCase(100000000, "1억")]
        [TestCase(1234567890123.0, "1.23조")]
        [TestCase(1e16, "1경")]
        [TestCase(5.5e20, "5.5해")]
        public void Korean_Units(double v, string expected)
        {
            Assert.AreEqual(expected, NumberFormat.Money(v));
        }

        [Test]
        public void Csv_Handles_Quotes_And_Commas()
        {
            var t = new CsvTable("t", "a,b\n\"x, \"\"y\"\"\",2\n");
            Assert.AreEqual("x, \"y\"", t.S(0, "a"));
            Assert.AreEqual(2, t.I(0, "b"));
        }
    }

    public class CoreTests
    {
        static GameSim Rich(double money = 1e30)
        {
            var sim = TestData.NewSim();
            sim.S.money = money;
            return sim;
        }

        static void FillFirst(GameSim sim)
        {
            for (int i = 0; i < 5; i++) Assert.NotNull(sim.Hire());
        }

        [Test]
        public void First_Clone_Is_Free_And_Unlocks_Layer()
        {
            var sim = TestData.NewSim();
            Assert.AreEqual(0, sim.HireCost());
            var c = sim.Hire();
            Assert.NotNull(c);
            Assert.AreEqual(1, c.id);
            Assert.IsTrue(sim.Has(Layer.FirstClone));
            Assert.Greater(sim.HireCost(), 0);
            sim.S.money = 0;
            Assert.IsNull(sim.Hire(), "돈이 없으면 두 번째는 못 뽑는다");
        }

        [Test]
        public void Clones_Are_Capped_By_Seats()
        {
            var sim = Rich();
            FillFirst(sim);
            Assert.IsNull(sim.Hire(), "첫 일터 5칸이 차면 더 못 뽑는다(분신 총수 = 자리 수)");
            Assert.IsTrue(sim.Has(Layer.Village), "첫 일터가 차면 마을 공개");
            Assert.IsTrue(sim.Workplace(2).open, "첫 일터가 차면 두 번째 일터 개업");
        }

        [Test]
        public void Aptitude_Cycles_Without_Randomness()
        {
            var sim = Rich();
            FillFirst(sim);
            CollectionAssert.AreEqual(new[] { 0, 1, 2, 3, 0 }, sim.S.clones.Select(c => c.apt).ToArray());
        }

        [Test]
        public void Promotion_Needs_Level_Vacancy_And_Money()
        {
            var sim = Rich();
            FillFirst(sim);
            var c = sim.S.clones[0];
            Assert.AreEqual(PromoBlock.Level, sim.CheckPromotion(c));
            c.level = sim.PromoLevel(1);
            Assert.AreEqual(PromoBlock.None, sim.CheckPromotion(c));
            sim.S.money = 0;
            Assert.AreEqual(PromoBlock.Money, sim.CheckPromotion(c));
            sim.S.money = 1e30;
            double before = sim.CloneIncome(c);
            Assert.IsTrue(sim.Promote(c.id));
            Assert.AreEqual(2, c.slot);
            Assert.Greater(sim.CloneIncome(c), before * 2, "승진은 큰 계단이어야 한다");
            Assert.IsTrue(sim.HasVacancy(1), "승진하면 아랫자리가 빈다");
            Assert.AreEqual(2, c.history.Count);
        }

        [Test]
        public void Promotion_Blocked_When_Upper_Seats_Full()
        {
            var sim = Rich();
            for (int round = 0; round < 2; round++)
            {
                while (sim.Hire() != null) { }
                foreach (var c in sim.S.clones.Where(x => x.slot == 1).ToList())
                {
                    c.level = sim.PromoLevel(1);
                    sim.Promote(c.id);
                }
            }
            Assert.AreEqual(5, sim.CountAt(2));
            while (sim.Hire() != null) { }
            var waiting = sim.S.clones.First(x => x.slot == 1);
            waiting.level = sim.PromoLevel(1);
            Assert.AreEqual(PromoBlock.Full, sim.CheckPromotion(waiting));
            StringAssert.Contains("만석", sim.PromoBlockText(waiting));
        }

        [Test]
        public void Certificate_And_Status_Gate_Upper_Jobs()
        {
            var sim = Rich();
            FillFirst(sim);
            foreach (var w in sim.S.workplaces) w.open = true;
            var c = sim.S.clones[0];
            c.level = 30; c.slot = 3;
            Assert.AreEqual(PromoBlock.Cert, sim.CheckPromotion(c));
            Assert.IsTrue(sim.BuyCert(4));
            Assert.IsTrue(sim.Promote(c.id));
            c.level = 40;
            Assert.AreEqual(PromoBlock.Status, sim.CheckPromotion(c), "꼭대기 자리는 신분이 필요하다");
            sim.S.layerMask |= 1 << Layer.Status;
            Assert.IsTrue(sim.BuyHouse());
            Assert.AreEqual(1, sim.S.status);
            Assert.IsTrue(sim.Promote(c.id));
            Assert.IsTrue(sim.Has(Layer.Move), "꼭대기 첫 승진으로 이사가 열린다");
        }

        [Test]
        public void Xp_Levels_Up_And_Overflow_Is_Stored()
        {
            var sim = Rich();
            sim.Hire();
            var c = sim.S.clones[0];
            sim.Tick(sim.XpNeed(1) + 0.5);
            Assert.AreEqual(2, c.level);
            sim.Tick(5000);
            Assert.AreEqual(sim.LevelCap(1), c.level, "상한에서 멈춘다");
            Assert.Greater(c.bonusXp, 0, "넘친 경험은 보너스 훈련으로 저장");
            FillFirst4(sim);
            sim.Promote(c.id);
            Assert.Greater(c.level, sim.PromoLevel(1), "승진하면 저장한 경험이 레벨로 돌아온다");
        }

        static void FillFirst4(GameSim sim) { while (sim.Hire() != null) { } }

        [Test]
        public void Facility_Raises_Income_And_Level_Cap()
        {
            var sim = Rich();
            FillFirst(sim);
            sim.S.layerMask |= 1 << Layer.Facility;
            double before = sim.WorkplaceIncome(1);
            int cap = sim.LevelCap(1);
            for (int i = 0; i < 5; i++) Assert.IsTrue(sim.UpgradeFacility(1));
            Assert.AreEqual(before * 1.2, sim.WorkplaceIncome(1), before * 1e-9);
            Assert.AreEqual(cap + 2, sim.LevelCap(1));
            Assert.AreEqual(sim.PromoLevel(1), 10, "승진 기준은 시설과 무관하게 그대로");
        }

        [Test]
        public void Multipliers_Stay_Within_Six_Sources()
        {
            var sim = Rich();
            sim.Hire();
            var c = sim.S.clones[0];           // 적성 0(현장) = 편의점(알바) 일치
            var job = sim.Job(1);
            c.level = 6;
            sim.S.fame = 4;
            sim.Workplace(1).facility = 3;
            sim.Workplace(1).lots = 2;
            double expected = job.BaseIncome * (1 + 0.04 * 5) * 1.25 * 1.12 * 1.02 * 1.2;
            Assert.AreEqual(expected, sim.CloneIncome(c), expected * 1e-9);
        }

        [Test]
        public void Payday_Accrues_And_Is_Not_Lost_When_Uncollected()
        {
            var sim = Rich(0);
            sim.Hire();
            sim.Tick(sim.Data.PaydayFirst + 1);
            Assert.IsTrue(sim.HasPendingPayday);
            double first = sim.S.pendingPayday.total;
            Assert.Greater(first, 0);
            sim.Tick(sim.Data.PaydayPeriod);
            Assert.AreEqual(2, sim.S.pendingPayday.count, "안 받은 월급날은 쌓인다");
            Assert.Greater(sim.S.pendingPayday.total, first);
            double money = sim.S.money;
            var r = sim.CollectPayday();
            Assert.AreEqual(money + r.total, sim.S.money, 1e-6);
            Assert.IsFalse(sim.HasPendingPayday);
        }

        [Test]
        public void Manager_Unlocks_After_Four_Paydays_And_Then_Deposit()
        {
            var sim = Rich(0);
            sim.Hire();
            for (int i = 0; i < 4; i++)
            {
                sim.Tick(sim.Data.PaydayPeriod);
                sim.CollectPayday();
            }
            Assert.IsTrue(sim.S.manager);
            sim.Tick(sim.Data.PaydayPeriod);
            sim.CollectPayday();
            sim.Tick(200);
            Assert.IsTrue(sim.Has(Layer.Deposit));
        }

        [Test]
        public void Offline_Pays_Reduced_Work_Envelopes_And_Xp()
        {
            var sim = Rich(0);
            sim.Hire();
            sim.Tick(10);
            var c = sim.S.clones[0];
            double perSec = sim.CloneIncome(c);
            double money = sim.S.money;
            var r = sim.ApplyOffline(3600);
            Assert.NotNull(r);
            Assert.AreEqual(perSec * 0.25 * 3600, r.workIncome, perSec, "알바는 야간 근무 25%");
            Assert.GreaterOrEqual(r.paydays, 5);
            Assert.Greater(r.envelope, 0);
            Assert.Greater(c.level, 5, "경험은 오프라인에도 쌓인다");
            Assert.AreEqual(money, sim.S.money, 1e-6, "받기 전에는 돈이 들어오지 않는다");
            double got = sim.CollectOffline(true);
            Assert.AreEqual(r.workIncome * 2 + r.envelope, got, 1e-3, "광고 2배는 야간 근무에만");
            Assert.IsNull(sim.ApplyOffline(30), "60초 미만 부재는 정산서 없음");
        }

        [Test]
        public void Offline_Beyond_Cap_Keeps_Accruing_Slowly()
        {
            var a = Rich(0); a.Hire(); a.S.clones[0].level = 10;
            var b = Rich(0); b.Hire(); b.S.clones[0].level = 10;
            double r8 = a.ApplyOffline(8 * 3600).workIncome;
            double r16 = b.ApplyOffline(16 * 3600).workIncome;
            Assert.AreEqual(r8 * 1.25, r16, r8 * 1e-6, "상한 뒤에도 25% 속도로 계속 쌓인다");
        }

        [Test]
        public void Assets_Never_Lose_Value()
        {
            var sim = Rich(1e12);
            FillFirst(sim);
            sim.S.layerMask |= (1 << Layer.Deposit) | (1 << Layer.Property) | (1 << Layer.Stock) | (1 << Layer.Status) | (1 << Layer.Facility);
            double worth = sim.NetWorth();
            sim.Deposit(0.5);
            Assert.AreEqual(worth, sim.NetWorth(), 1, "예금은 순자산을 바꾸지 않는다");
            Assert.IsTrue(sim.BuyProperty("home_p1"));
            Assert.AreEqual(worth, sim.NetWorth(), 1, "건물은 산 값 그대로 순자산");
            Assert.Greater(sim.RentPerPayday(), 0);
            for (int i = 0; i < 10; i++) sim.UpgradeFacility(1);
            double w2 = sim.NetWorth();
            Assert.IsTrue(sim.BuyLot(1));
            Assert.AreEqual(w2, sim.NetWorth(), 1);
            double m = sim.S.money;
            sim.SellLot(1);
            Assert.AreEqual(m + sim.LotPrice(1), sim.S.money, 1, "주식은 산 값에 되판다");
            sim.WithdrawAll();
            Assert.AreEqual(0, sim.S.deposit);
        }

        [Test]
        public void Stock_Cap_Is_Tied_To_Facility()
        {
            var sim = Rich();
            FillFirst(sim);
            sim.S.layerMask |= (1 << Layer.Stock) | (1 << Layer.Facility);
            Assert.IsFalse(sim.BuyLot(1), "상장 전에는 못 산다");
            for (int i = 0; i < 10; i++) sim.UpgradeFacility(1);
            int bought = 0;
            while (sim.BuyLot(1)) bought++;
            Assert.AreEqual(10, bought, "보유 한도 = 시설 단계");
        }

        [Test]
        public void Status_Needs_Asset_Not_Only_Money()
        {
            var sim = Rich(1e15);
            sim.Hire();
            sim.CheckStatus();
            Assert.AreEqual(0, sim.S.status, "순자산만으로는 신분이 오르지 않는다");
            sim.S.layerMask |= 1 << Layer.Status;
            sim.BuyHouse();
            Assert.AreEqual(1, sim.S.status);
        }

        [Test]
        public void Retirement_Frees_Seat_And_Adds_Permanent_Bonus()
        {
            var sim = Rich();
            FillFirst(sim);
            var c = sim.S.clones[0];
            c.slot = 5; c.seat = 0; c.level = 50;
            sim.S.layerMask |= 1 << Layer.Retire;
            double fame = sim.FameMult;
            Assert.IsTrue(sim.Retire(c.id));
            Assert.AreEqual(4, sim.S.clones.Count);
            Assert.AreEqual(1, sim.S.hall.Count);
            Assert.Greater(sim.FameMult, fame);
        }

        [Test]
        public void Move_Keeps_Clones_And_Assets_Resets_Workplaces()
        {
            var sim = Rich(1e13);
            FillFirst(sim);
            sim.S.layerMask |= (1 << Layer.Move) | (1 << Layer.Property) | (1 << Layer.Deposit) | (1 << Layer.Status);
            foreach (var c in sim.S.clones) c.level = 40;
            sim.BuyProperty("home_p1");
            sim.Deposit(0.1);
            sim.BuyHouse();
            double deposit = sim.S.deposit;
            sim.S.cityEarned = sim.City.FameUnit * 100;
            int preview = sim.FameGainPreview();
            Assert.AreEqual(10, preview);
            Assert.IsTrue(sim.Move());
            Assert.AreEqual(2, sim.S.city);
            Assert.AreEqual(10, sim.S.fame);
            Assert.AreEqual(5, sim.S.clones.Count, "분신 전원 동행");
            Assert.IsTrue(sim.S.clones.All(c => c.slot == 1 && c.level == 12), "새 도시 맨 아래부터, 레벨 일부 유지");
            Assert.AreEqual(deposit, sim.S.deposit, "예금 유지");
            Assert.AreEqual(1, sim.S.houseTier);
            Assert.GreaterOrEqual(sim.S.money, sim.Data.City(2).HireBase * 3, "현금은 정착금으로");
            Assert.Less(sim.S.money, 1e12, "가져온 현금은 남지 않는다");
            Assert.Greater(sim.OldCityAssetPerPayday(), 0, "떠난 도시 건물의 월세가 따라온다");
            Assert.LessOrEqual(sim.OldCityAssetPerPayday(), sim.IncomePerSec() * 300 + 1, "떠난 도시 자산 수입에는 상한");
            Assert.IsTrue(sim.Workplace(2).open, "경력직 5명이 첫 일터를 채우면 바로 다음 일터 개업");
            Assert.IsFalse(sim.CanMove);
        }

        [Test]
        public void Events_Have_No_Loss_And_Series_Continue()
        {
            var sim = Rich(0);
            sim.Hire();
            sim.StartSession();
            sim.Tick(20);
            var e = sim.ActiveEvent;
            Assert.NotNull(e, "무반응 12초 + 간격이 지나면 사건이 뜬다");
            Assert.Greater(sim.EventReward(e, 0), 0);
            if (e.ChoiceB.Length > 0) Assert.Greater(sim.EventReward(e, 1), 0, "어느 선택도 손해가 없다");
            double money = sim.S.money;
            sim.ResolveEvent(0);
            Assert.Greater(sim.S.money, money);
        }

        [Test]
        public void Fever_Triples_Work_Income()
        {
            var sim = Rich(0);
            sim.Hire();
            double baseInc = sim.IncomePerSecNow();
            for (int i = 0; i < 30; i++) sim.Tap();
            Assert.IsTrue(sim.InFever);
            Assert.AreEqual(baseInc * 3, sim.IncomePerSecNow(), baseInc * 0.2);
            sim.Tick(16);
            Assert.IsFalse(sim.InFever);
        }

        [Test]
        public void Goal_Always_Exists_And_Manager_Acts()
        {
            var sim = Rich(0);
            Assert.IsNotEmpty(sim.Goal().Text);
            sim.Hire();
            Assert.IsNotEmpty(sim.Goal().Text);
            sim.S.manager = true;
            sim.S.money = 1e9;
            sim.Tick(5);
            Assert.Greater(sim.S.clones.Count, 1, "매니저가 자동으로 고용한다");
        }

        [Test]
        public void State_Survives_Json_Round_Trip()
        {
            var sim = Rich();
            FillFirst(sim);
            sim.Tick(400);
            var opt = new System.Text.Json.JsonSerializerOptions { IncludeFields = true };
            string json = System.Text.Json.JsonSerializer.Serialize(sim.S, opt);
            var back = System.Text.Json.JsonSerializer.Deserialize<GameState>(json, opt);
            var sim2 = new GameSim(sim.Data, back);
            Assert.AreEqual(sim.IncomePerSec(), sim2.IncomePerSec(), 1e-6);
            Assert.AreEqual(sim.NetWorth(), sim2.NetWorth(), 1e-6);
            Assert.AreEqual(sim.S.clones.Count, sim2.S.clones.Count);
        }
    }
}
