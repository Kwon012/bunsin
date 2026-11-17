using System;
using System.Collections.Generic;
using Bunsin.Sim;

namespace Bunsin.Sim.Tests
{
    /// <summary>
    /// 자동 플레이 봇. 사람 대신 '탭 → 추천 구매 → 수령'을 반복해 페이싱을 잰다.
    /// 가정: 접속 중 초당 tapsPerSec번 탭, 살 수 있으면 가장 좋은 일을 바로 한다, 월급날·사건은 바로 받는다.
    /// </summary>
    public sealed class SimBot
    {
        public readonly GameSim Sim;
        public double TapsPerSec = 2;
        public double EarlyTapsPerSec = 4;
        public double EarlySec = 180;
        public bool BuyAssets = true;
        public bool AutoMove = true;
        public double RealSec;                 // 접속 + 오프라인을 합친 실제 시간
        public readonly List<string> Log = new List<string>();
        double _tapAcc;

        public SimBot(GameSim sim) { Sim = sim; }

        public void Play(double seconds)
        {
            Sim.StartSession();
            if (Sim.S.hasPendingOffline) Sim.CollectOffline(false);
            Sim.S.introDone = true;
            for (double t = 0; t < seconds; t += 1)
            {
                StepActions();
                Sim.Tick(1);
                RealSec += 1;
            }
        }

        public void Away(double seconds)
        {
            Sim.ApplyOffline(seconds);
            RealSec += seconds;
        }

        void StepActions()
        {
            var s = Sim.S;
            _tapAcc += s.sessionSec < EarlySec ? EarlyTapsPerSec : TapsPerSec;
            while (_tapAcc >= 1) { Sim.Tap(); _tapAcc -= 1; }

            if (Sim.HasPendingPayday) Sim.CollectPayday();
            if (Sim.ActiveEvent != null && s.eventLeft < Sim.Data.E("event_bubble_sec") - 3) Sim.ResolveEvent(0);

            // 신분 벽: 집이 대표 자산이면 먼저 산다
            if (Sim.Has(Layer.Status))
            {
                var h = Sim.NextHouse;
                if (h != null && NeedsStatus() && !Sim.HasStatusAsset(s.status + 1) && Reach(h.Price)) Sim.BuyHouse();
            }

            // 예금은 언제든 깰 수 있으므로 '현금 + 예금'으로 살 수 있는 일이 있으면 깬다
            if (s.deposit > 0)
            {
                var list = Sim.Candidates(BuyAssets);
                for (int i = 0; i < list.Count; i++)
                    if (list[i].Gain > 0 && list[i].Cost > s.money && list[i].Cost <= s.money + s.deposit
                        && (list[i].Payback < 6 * 3600 || list[i].Kind == ActionKind.Promote || list[i].Kind == ActionKind.Cert))
                    { Sim.WithdrawAll(); break; }
            }
            for (int guard = 0; guard < 20; guard++)
            {
                var a = Sim.RecommendAffordable(BuyAssets);
                if (!a.Valid) break;
                if (a.Payback > 6 * 3600 && a.Kind != ActionKind.Promote && a.Kind != ActionKind.Hire) break;
                if (!Sim.Execute(a)) break;
            }

            // 은퇴: 꼭대기가 만석이고 아래에 승진 대기가 있으면 한 명 보낸다
            if (Sim.Has(Layer.Retire) && !Sim.HasVacancy(Sim.City.Slots))
            {
                for (int i = 0; i < s.clones.Count; i++)
                    if (Sim.CanRetire(s.clones[i])) { Sim.Retire(s.clones[i].id); break; }
            }

            // 남는 돈은 예금에(다음 살 것이 멀 때)
            if (Sim.Has(Layer.Deposit) && s.deposit < Sim.DepositCap())
            {
                var best = Sim.Recommend(BuyAssets);
                if (!best.Valid || Sim.SecondsUntil(best.Cost) > 120) Sim.Deposit(1);
            }

            if (AutoMove && Sim.CanMove && ((Sim.MoveRecommended && Sim.FameGainPreview() >= 5) || MoveReadySince() > 3600))
            {
                int city = s.city;
                Sim.WithdrawAll();
                if (Sim.Move()) Log.Add(Stamp() + " 이사: 도시 " + city + " → " + s.city + " (명성 " + s.fame + ")");
            }
        }

        bool NeedsStatus()
        {
            for (int slot = 1; slot <= Sim.City.Slots; slot++)
                if (Sim.Job(slot).ReqStatus > Sim.S.status && Sim.Workplace(slot).open) return true;
            return false;
        }

        bool Reach(double cost)
        {
            if (Sim.S.money >= cost) return true;
            if (Sim.S.money + Sim.S.deposit >= cost) { Sim.WithdrawAll(); return true; }
            return false;
        }

        double MoveReadySince()
        {
            double at = Sim.FirstAt("move_ready_" + Sim.S.city);
            return at < 0 ? -1 : Sim.S.playSec - at;
        }

        public string Stamp()
        {
            return "[접속 " + (Sim.S.playSec / 60).ToString("0.0") + "분 · 실제 " + (RealSec / 3600).ToString("0.0") + "시간]";
        }
    }
}
