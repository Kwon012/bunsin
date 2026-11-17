using System;
using System.IO;
using System.Text;
using NUnit.Framework;
using Bunsin.Sim;

namespace Bunsin.Sim.Tests
{
    /// <summary>
    /// 봇으로 페이싱을 잰다. 수치는 임시값이므로 단언은 느슨하게 '구조가 깨지지 않았는가'만 본다.
    /// 보고서는 Tools/_out/balance_report.txt에 남는다.
    /// </summary>
    public class BalanceTests
    {
        static readonly string[] Keys =
        {
            "first_clone", "village_reveal", "layer_2", "first_promo", "first_payday", "layer_5", "open_1_3",
            "first_cert", "open_1_4", "manager", "layer_7", "layer_8", "first_property", "layer_9", "first_stock",
            "layer_10", "house_1", "status_1", "open_1_5", "top_1", "first_retire", "move_2", "top_2", "move_3", "top_3", "move_4",
        };

        static string Report(SimBot bot, string title)
        {
            var sim = bot.Sim;
            var sb = new StringBuilder();
            sb.AppendLine("== " + title);
            foreach (var k in Keys)
            {
                double at = sim.FirstAt(k);
                if (at >= 0) sb.AppendLine(string.Format("  {0,-16} 접속 {1,7:0.0}분", k, at / 60));
            }
            var s = sim.S;
            sb.AppendLine(string.Format("  도시 {0} · 분신 {1} · 명성 {2} · 신분 {3} · 순자산 {4} · 월 수입 {5}",
                s.city, s.clones.Count, s.fame, sim.Data.Status[s.status].Name, NumberFormat.Money(sim.NetWorth()), NumberFormat.Money(sim.MonthlyIncome())));
            sb.AppendLine(string.Format("  접속 {0:0}분 · 벽 노출 {1:0.0}% · 막다른 벽 최장 {2:0.0}분 · 자산 수입 비중 {3:0.0}% · 탭 비중 {4:0.0}% · 은퇴 {5} · 사건 {6}/{7}",
                s.playSec / 60, 100 * s.stats.wallSec / Math.Max(1, s.playSec), s.stats.longestDeadWallSec / 60,
                100 * s.stats.assetIncome / Math.Max(1, s.totalEarned), 100 * s.stats.tapIncome / Math.Max(1, s.totalEarned),
                s.stats.retirements, s.stats.eventsTaken, s.stats.eventsShown));
            foreach (var l in bot.Log) sb.AppendLine("  " + l);
            return sb.ToString();
        }

        static SimBot Run(double sessionMin, int sessionsPerDay, int days, double taps, bool assets = true)
        {
            var bot = new SimBot(TestData.NewSim(11)) { TapsPerSec = taps, BuyAssets = assets };
            double dayGap = (24 * 3600 - sessionsPerDay * sessionMin * 60) / sessionsPerDay;
            for (int d = 0; d < days; d++)
                for (int i = 0; i < sessionsPerDay; i++)
                {
                    bot.Play(sessionMin * 60);
                    bot.Away(i == sessionsPerDay - 1 ? dayGap * 1.6 : dayGap * 0.7);
                }
            return bot;
        }

        [Test]
        public void First_Session_Pacing()
        {
            var bot = new SimBot(TestData.NewSim(11));
            bot.Play(30 * 60);
            var sim = bot.Sim;
            string report = Report(bot, "첫 세션 30분(초당 탭 4 → 2)");
            Write("first_session", report);
            Assert.That(sim.FirstAt("first_clone"), Is.InRange(0, 10), "첫 분신 10초 안");
            Assert.That(sim.FirstAt("village_reveal"), Is.InRange(20, 180), "마을 공개 3분 안");
            Assert.That(sim.FirstAt("first_promo"), Is.InRange(60, 330), "첫 승진 5분 남짓 안(v4 재미 점검 ①)");
            Assert.That(sim.FirstAt("first_payday"), Is.InRange(170, 190), "첫 월급날 3분");
            Assert.Less(sim.S.stats.wallSec / sim.S.playSec, 0.35, "첫 세션 벽 노출 35% 이하(R-015 목표)");
        }

        [Test]
        public void Week_Pacing_Mid_Player()
        {
            var bot = Run(30, 3, 7, 2);
            Write("week_mid", Report(bot, "미드 유저: 30분 × 3회/일 × 7일"));
            Assert.GreaterOrEqual(bot.Sim.S.city, 2, "일주일 안에 첫 이사");
            Assert.That(bot.Sim.FirstAt("top_1") / 60, Is.InRange(60, 600), "첫 꼭대기 승진: 누적 접속 1~10시간");
        }

        [Test]
        public void Week_Pacing_Light_Player()
        {
            var bot = Run(8, 3, 7, 1);
            Write("week_light", Report(bot, "라이트 유저: 8분 × 3회/일 × 7일"));
            Assert.Greater(bot.Sim.S.stats.promotions, 10);
            Assert.IsTrue(bot.Sim.Has(Layer.Deposit), "라이트 유저도 일주일 안에 자산 탭");
        }

        [Test]
        public void Idle_Only_Player_Is_Never_Stuck()
        {
            // 고민 0단계: 탭도 안 하고 매니저에게 맡겨도 끝까지 진행되는가(자산은 직접 사야 하므로 봇이 최소로만 산다)
            var bot = Run(10, 2, 10, 0.2);
            Write("idle_only", Report(bot, "방치 위주: 10분 × 2회/일 × 10일, 탭 거의 없음"));
            Assert.IsTrue(bot.Sim.S.manager);
            Assert.GreaterOrEqual(bot.Sim.S.city, 2);
        }

        static void Write(string name, string text)
        {
            TestContext.Out.WriteLine(text);
            try
            {
                var dir = new DirectoryInfo(TestData.DataDir());
                string root = dir.Parent.Parent.Parent.Parent.FullName;
                string outDir = Path.Combine(root, "Tools", "_out");
                Directory.CreateDirectory(outDir);
                File.WriteAllText(Path.Combine(outDir, "balance_" + name + ".txt"), text);
            }
            catch (IOException) { }
        }
    }
}
