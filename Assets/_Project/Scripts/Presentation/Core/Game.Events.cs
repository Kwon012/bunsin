using System;
using Bunsin.Sim;
using UnityEngine;

namespace Bunsin.Presentation
{
    // 규칙 엔진이 낸 일(SimEvent)을 소리·글자·팝업·'순간'으로 바꾼다.
    // 원칙: 보이는 상태 변화에는 100ms 안에 보이고 들리는 답. 반복되는 작은 일은 가볍게, 처음 일어난 큰 일은 크게.
    public sealed partial class Game
    {
        int _maxSlotSeen = -1;
        bool _paydayQueued;
        int _promoReadyLast;
        float _promoCheckT;

        void ProcessEvents()
        {
            if (_maxSlotSeen < 0) _maxSlotSeen = MaxSlotNow();
            var list = Sim.Events;
            for (int i = 0; i < list.Count; i++)
            {
                try { Handle(list[i]); }
                catch (Exception e) { Debug.LogException(e); }
            }
            list.Clear();
            _promoCheckT -= Time.unscaledDeltaTime;
            if (_promoCheckT > 0) return;
            _promoCheckT = 1f;
            int ready = Sim.PromotionQueue().Count;
            if (ready > 0 && _promoReadyLast == 0 && S.stats.promotions < 30)
                Popups.Toast("승진할 수 있는 분신이 있어요!", "i_up");
            _promoReadyLast = ready;
        }

        int MaxSlotNow()
        {
            int m = 0;
            foreach (var c in S.clones) m = Math.Max(m, c.slot);
            return m;
        }

        void Handle(SimEvent e)
        {
            var home = GetScreen<HomeScreen>();
            switch (e.Type)
            {
                case SimEventType.MoneyGain:
                    if (e.A == 1 || e.A == 5 || e.A == 4)
                        Fx.FloatText(Fx.LocalOf(MoneyTarget) + new Vector2(240, -60), "+" + NumberFormat.Money(e.V), Palette.Green, 40);
                    if (e.A == 1 || e.A == 3) Sfx.Play("coin", 0.8f, 0.05f);
                    break;

                case SimEventType.CloneHired:
                    Sfx.Play("pop", 1f, 0.06f);
                    if (home != null) home.OnHired(e.A);
                    if (e.A <= 5)
                    {
                        string line = Data.Line("first5", e.A.ToString());
                        if (line.Length > 0) Popups.Toast(line, "head_cheer");
                    }
                    break;

                case SimEventType.LevelUp:
                    Sfx.Play("levelup", 0.35f, 0.05f, 0.4f);
                    break;

                case SimEventType.Promoted:
                {
                    var c = Sim.Clone(e.A);
                    var job = Sim.Job(e.B);
                    if (e.B > _maxSlotSeen)
                    {
                        _maxSlotSeen = e.B;
                        string line = Data.Line("promo", e.B.ToString());
                        Moment((c != null ? Sim.CloneName(c) : "분신") + " 승진! " + job.Name, line.Length > 0 ? line : job.Company + " 출근", Art.CloneSprite(job.Tier, true), Palette.Tier[job.Tier]);
                        Haptic();
                    }
                    else
                    {
                        Sfx.Play("levelup", 0.8f, 0.05f);
                        Popups.Toast((c != null ? Sim.CloneName(c) : "분신") + " → " + job.Name, "i_up");
                    }
                    break;
                }

                case SimEventType.AptMatch:
                {
                    var c = Sim.Clone(e.A);
                    if (c != null) Popups.Toast(Sim.CloneName(c) + " 적성 딱 맞음! +" + NumberFormat.Money(e.V), Art.AptIcon(c.apt));
                    break;
                }

                case SimEventType.Retired:
                {
                    var pool = Data.LinePool("retire");
                    string line = pool.Count > 0 ? pool[UnityEngine.Random.Range(0, pool.Count)].Value : "";
                    Moment(e.A + "호 은퇴식", line, "i_retire", Palette.Yellow, "unlock");
                    break;
                }

                case SimEventType.FacilityUp:
                    Sfx.Play("buy", 0.6f, 0.05f);
                    if (e.B % Data.FacilityStageLevels == 0)
                        Popups.Toast(Sim.Job(e.A).Name + " 시설 " + e.B + "단계: 레벨 상한 +2", "i_facility");
                    break;

                case SimEventType.WorkplaceOpened:
                    Sfx.Play("unlock", 0.8f);
                    Popups.Toast("새 일터 개업: " + Sim.Job(e.A).Name, "i_shop");
                    break;

                case SimEventType.CertBought:
                    Moment(e.S + " 취득!", "이제 " + Sim.Job(e.A).Name + " 자리로 승진할 수 있어요", "i_cert", Palette.Coral, "levelup");
                    break;

                case SimEventType.VillageReveal:
                    Moment("마을 공개!", "분신들이 골목으로 출근합니다", "i_village", Palette.Mint, "unlock");
                    Tweens.Delay(1.6f, () => { if (TabUnlocked(TabVillage)) ShowTab(TabVillage); }, this);
                    break;

                case SimEventType.PaydaySoon:
                    if (home != null) home.PaydayCountdown();
                    break;

                case SimEventType.PaydayReady:
                    Sfx.Play("payday");
                    if (home != null) home.Cheer(2f);
                    if (!_paydayQueued) { _paydayQueued = true; GamePopups.Payday(this); }
                    break;

                case SimEventType.PaydayCollected:
                    _paydayQueued = false;
                    Fx.CoinFly(new Vector2(0, -200), Fx.LocalOf(MoneyTarget), 14, () => Tweens.Pop(MoneyTarget, 1f, 0.2f, 1.3f));
                    break;

                case SimEventType.FeverStart:
                    Sfx.Play("fever");
                    Fx.Flash(Palette.Coral, 0.3f, 0.15f);
                    Haptic();
                    break;

                case SimEventType.FeverEnd:
                    if (e.A > 0) Popups.Toast("피버 끝! 콤보 " + e.A + "회 (최고 " + Math.Max(e.A, S.stats.bestCombo) + ")", "i_megaphone");
                    break;

                case SimEventType.LayerUnlocked:
                    Sfx.Play("unlock", 0.8f);
                    if (e.A == Layer.Tap || e.A == Layer.FirstClone || e.A == Layer.Village || e.A == Layer.Payday) break;
                    GamePopups.LayerIntro(this, e.A);
                    break;

                case SimEventType.EventBubble:
                    Sfx.Play("bubble", 0.7f);
                    break;

                case SimEventType.UniqueGained:
                    GamePopups.Unique(this, e.S, e.A);
                    break;

                case SimEventType.SceneFound:
                    Sfx.Play("shutter");
                    foreach (var sc in Data.Scenes)
                        if (sc.Id == e.S) Popups.Toast("숨은 장면 발견: " + sc.Name + " (" + Sim.ScenesFoundHere + "/" + Data.Scenes.Count + ")", "i_camera");
                    break;

                case SimEventType.BucketDone:
                    foreach (var b in Data.Buckets)
                        if (b.Id == e.S)
                        {
                            Sfx.Play("levelup", 0.7f);
                            Popups.Toast("버킷리스트 달성: " + b.Name, "i_heart", Palette.Cream);
                        }
                    break;

                case SimEventType.UnitSeen:
                {
                    var line = Data.Line("unit", e.S);
                    if (line.Length > 0) Popups.Toast(line, "i_coin", Palette.Cream);
                    break;
                }

                case SimEventType.StatusUp:
                {
                    string line = Data.Line("status", e.A.ToString());
                    Moment("신분 상승: " + e.S, line, "i_house", Palette.Green, "promo");
                    string mom = Data.Line("mom", e.A.ToString());
                    if (mom.Length > 0) Tweens.Delay(2f, () => Popups.Toast(mom, "i_heart", Palette.Cream), this);
                    Haptic();
                    break;
                }

                case SimEventType.AssetBought:
                    Sfx.Play("buy", 0.9f);
                    if (e.A == 0) Popups.Toast("매입 완료: " + e.S + " · 월급날마다 월세", "i_building");
                    else if (e.A == 2) Moment("이사 완료: " + e.S, "새 집, 새 거울", "i_house", Palette.Yellow, "unlock");
                    else if (e.A == 4) Moment("트로피 획득: " + e.S, "이 도시 완전 정복", "i_trophy", Palette.Yellow, "promo");
                    else if (e.A == 3 || e.A == 1 || e.A == 6) Popups.Toast("구매: " + e.S, e.A == 1 ? "i_stock" : "i_luxury");
                    break;

                case SimEventType.SetComplete:
                    Moment(e.S + " 완성!", "거울 앞에서 한참 서 있었다", "i_luxury", Palette.Purple, "promo");
                    break;

                case SimEventType.ManagerUnlocked:
                    if (home != null) home.Cheer(1.5f);
                    break;

                case SimEventType.ManagerActed:
                    ManagerSays(e.S);
                    break;

                case SimEventType.Moved:
                {
                    var city = Data.City(e.A);
                    _maxSlotSeen = MaxSlotNow();
                    Moment(city.Name + " 도착!", "명성 +" + e.B + " · " + city.RuleText, "o_truck_big", Palette.Sky, "truck");
                    foreach (var s in _screens) s.Invalidate();
                    ShowTab(TabVillage, false);
                    break;
                }

                case SimEventType.SeasonStart:
                    Sfx.Play("unlock", 0.7f);
                    Popups.Toast("관광 시즌 시작! 알바 수입 2배", "i_coin", Palette.Cream);
                    break;

                case SimEventType.TradeArrived:
                    Sfx.Play("truck", 0.6f);
                    Popups.Toast("무역선 입항: +" + NumberFormat.Money(e.V), "i_truck", Palette.Cream);
                    break;

                case SimEventType.ClosingCard:
                    GamePopups.Closing(this);
                    break;

                case SimEventType.Stamp:
                    Sfx.Play("shutter", 0.7f);
                    Popups.Toast("출근 도장 " + e.A + "일째 · 끊겨도 초기화되지 않아요", "i_stamp", Palette.Cream);
                    break;

                case SimEventType.Boost:
                    Popups.Toast("수입 2배 부스트 " + NumberFormat.Duration(e.V), "i_ad");
                    break;
            }
        }

        public void Haptic() { Sfx.Haptic(S.haptics); }
    }
}
