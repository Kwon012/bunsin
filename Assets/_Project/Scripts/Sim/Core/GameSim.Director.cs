using System;
using System.Collections.Generic;
using System.Globalization;

namespace Bunsin.Sim
{
    // 연출 감독: 해금 층 · 사건 카드 · 뉴스 · 개성 분신 · 버킷리스트 · 출근 도장 · 광고 보상
    public sealed partial class GameSim
    {
        // ------------------------------------------------------------------ 해금 층

        /// <summary>바로 연다(첫 분신·마을 공개·월급날·이사처럼 그 순간이 곧 연출인 층).</summary>
        void Unlock(int layer, bool again = false)
        {
            if (Has(layer) && !again) return;
            S.layerMask |= 1 << layer;
            S.layerQueue.Remove(layer);
            S.sinceLayerIntro = 0;
            MarkFirst("layer_" + layer);
            Emit(SimEventType.LayerUnlocked, layer);
        }

        /// <summary>
        /// 줄을 세워 연다. 한 번에 하나만 열고 사이에 간격을 둔다(v4 7.4: 두 시스템이 같은 세션에 겹쳐 열리지 않게).
        /// </summary>
        void Request(int layer)
        {
            if (Has(layer) || S.layerQueue.Contains(layer)) return;
            S.layerQueue.Add(layer);
            S.layerQueue.Sort();
        }

        void StepLayers()
        {
            // 조건 점검(가벼운 것만)
            if (Has(Layer.Deposit) && !Has(Layer.Property) && City.Properties.Count > 0
                && S.money + S.deposit >= City.Properties[0].Price * 0.3) Request(Layer.Property);
            if (Has(Layer.Property) && !Has(Layer.Status) && S.properties.Count > 0) Request(Layer.Status);
            if (Has(Layer.Property) && !Has(Layer.Stock))
                for (int slot = 1; slot <= City.Slots; slot++)
                    if (IsListed(slot)) { Request(Layer.Stock); break; }

            if (S.layerQueue.Count == 0) return;
            if (S.sinceLayerIntro < Data.E("layer_gap_sec")) return;
            Unlock(S.layerQueue[0]);
        }

        public LayerData LayerInfo(int layer) { return layer >= 0 && layer < Data.Layers.Count ? Data.Layers[layer] : null; }

        /// <summary>다음에 열릴 것 하나(실루엣 + 조건 한 줄). 없으면 null.</summary>
        public LayerData NextLayerHint()
        {
            for (int i = 1; i < Data.Layers.Count; i++)
                if (!Has(i) && i != Layer.CityRule) return Data.Layers[i];
            return null;
        }

        // ------------------------------------------------------------------ 감독 틱

        void StepDirector(double dt)
        {
            StepLayers();
            StepEvents(dt);
            if (Has(Layer.Village) && S.sinceNews >= Data.E("news_interval_sec"))
            {
                S.sinceNews = 0;
                S.newsText = NextNewsLine();
                Emit(SimEventType.News, 0, 0, 0, S.newsText);
            }
            _slowTimer += dt;
            if (_slowTimer >= 1)
            {
                _slowTimer = 0;
                CheckStatus();
                CheckUniques();
                CheckBuckets();
                CheckUnits();
                CheckClosing();
            }
        }
        double _slowTimer;

        // ------------------------------------------------------------------ 사건 카드

        public EventData ActiveEvent
        {
            get
            {
                EventData e;
                return S.eventId.Length > 0 && Data.EventsById.TryGetValue(S.eventId, out e) ? e : null;
            }
        }

        void StepEvents(double dt)
        {
            if (S.eventId.Length > 0)
            {
                S.eventLeft -= dt;
                if (S.eventLeft <= 0)
                {
                    S.eventId = "";
                    S.sinceEvent = 0;
                    Emit(SimEventType.EventExpired);
                }
                return;
            }
            if (!Has(Layer.FirstClone) || S.clones.Count == 0) return;
            double gap = S.sessionSec < Data.E("event_early_window_sec") ? Data.E("event_early_gap_sec") : Data.E("event_min_gap_sec");
            if (S.sinceEvent < gap || S.sinceAction < Data.E("event_idle_sec")) return;
            var e = PickEvent();
            if (e == null) return;
            S.eventId = e.Id;
            S.eventLeft = Data.E("event_bubble_sec");
            S.eventClone = S.clones[Rng.Range(ref S.rng, S.clones.Count)].id;
            S.stats.eventsShown++;
            Emit(SimEventType.EventBubble, S.eventClone, 0, 0, e.Id);
        }

        int MaxLayer()
        {
            int m = 0;
            for (int i = 0; i < 31; i++) if (Has(i)) m = i;
            return m;
        }

        EventData PickEvent()
        {
            // 이어지는 연작이 있으면 그것부터
            for (int i = 0; i < S.seriesNext.Count; i++)
            {
                EventData e;
                if (Data.EventsById.TryGetValue(S.seriesNext[i], out e)) { S.seriesNext.RemoveAt(i); return e; }
            }
            int maxLayer = MaxLayer();
            double repeat = Data.E("event_repeat_gap_sec");
            var pool = _eventPool;
            pool.Clear();
            for (int i = 0; i < Data.Events.Count; i++)
            {
                var e = Data.Events[i];
                if (e.MinLayer > maxLayer) continue;
                if (e.Series.Length > 0 && !IsSeriesHead(e)) continue; // 연작 중간은 앞 사건을 봐야 나온다
                int seen = S.eventSeen.IndexOf(e.Id);
                if (seen >= 0)
                {
                    if (e.Series.Length > 0) continue;                // 연작은 한 번만
                    if (S.playSec - S.eventSeenAt[seen] < repeat) continue;
                }
                pool.Add(e);
            }
            return pool.Count == 0 ? null : pool[Rng.Range(ref S.rng, pool.Count)];
        }
        readonly List<EventData> _eventPool = new List<EventData>();

        bool IsSeriesHead(EventData e)
        {
            for (int i = 0; i < Data.Events.Count; i++) if (Data.Events[i].Next == e.Id) return false;
            return true;
        }

        /// <summary>사건 카드의 보상(초당 수입 × 초). 어느 선택도 손해가 없다.</summary>
        public double EventReward(EventData e, int choice)
        {
            double sec = choice == 1 && e.ChoiceB.Length > 0 ? e.ResultB : e.ResultA;
            return SecondValue() * sec;
        }

        public double ResolveEvent(int choice)
        {
            var e = ActiveEvent;
            if (e == null) return 0;
            double reward = EventReward(e, choice);
            Earn(reward, 1);
            int seen = S.eventSeen.IndexOf(e.Id);
            if (seen >= 0) S.eventSeenAt[seen] = S.playSec;
            else { S.eventSeen.Add(e.Id); S.eventSeenAt.Add(S.playSec); }
            if (e.Next.Length > 0) S.seriesNext.Add(e.Next);
            S.eventId = "";
            S.eventLeft = 0;
            S.sinceEvent = 0;
            S.sinceAction = 0;
            S.stats.eventsTaken++;
            Emit(SimEventType.EventResolved, choice, 0, reward, e.Id);
            Emit(SimEventType.MoneyGain, 1, 0, reward);
            return reward;
        }

        // ------------------------------------------------------------------ 뉴스

        public string NextNewsLine()
        {
            if (Data.News.Count == 0) return "";
            S.newsCursor = (S.newsCursor + 1 + Rng.Range(ref S.rng, 3)) % Data.News.Count;
            return FillTemplate(Data.News[S.newsCursor]);
        }

        public string FillTemplate(string t)
        {
            if (t.IndexOf('{') < 0) return t;
            string clone = S.clones.Count > 0 ? CloneName(S.clones[Rng.Range(ref S.rng, S.clones.Count)]) : "1호";
            string job = Job(1 + Rng.Range(ref S.rng, City.Slots)).Name;
            return t.Replace("{n}", S.clones.Count.ToString(CultureInfo.InvariantCulture))
                .Replace("{city}", City.Name)
                .Replace("{job}", job)
                .Replace("{clone}", clone)
                .Replace("{income}", NumberFormat.Money(MonthlyIncome()))
                .Replace("{status}", Data.Status[S.status].Name)
                .Replace("{worth}", NumberFormat.Money(NetWorth()));
        }

        // ------------------------------------------------------------------ 개성 분신(비확률, 숨은 조건)

        bool UniqueCondition(string cond)
        {
            switch (cond)
            {
                case "night_23": return LocalHour >= 23 || LocalHour < 4;
                case "morning_6": return LocalHour >= 5 && LocalHour < 8;
                case "fever_streak": return S.feverStreak >= 2;
                case "first_payday": return S.paydaysOnline >= 1;
                case "full_house": return Has(Layer.Village);
                case "clones_10": return S.clones.Count >= 10;
                case "clones_25": return S.clones.Count >= 25;
                case "first_cert": return FirstAt("first_cert") >= 0;
                case "first_deposit": return FirstAt("first_deposit") >= 0;
                case "first_property": return FirstAt("first_property") >= 0;
                case "first_promo": return S.stats.promotions >= 1;
                case "first_retire": return S.hall.Count >= 1;
                case "stamp_3": return S.stampDays >= 3;
                case "stamp_7": return S.stampDays >= (int)Data.E("stamp_gift_day");
                case "taps_500": return S.stats.taps >= 500;
                case "events_10": return S.stats.eventsTaken >= 10;
                case "starter": return S.starterPack;
            }
            return false;
        }

        void CheckUniques()
        {
            for (int i = 0; i < Data.Uniques.Count; i++)
            {
                var u = Data.Uniques[i];
                if (S.uniques.Contains(u.Id) || !UniqueCondition(u.Condition)) continue;
                GrantUnique(u);
                return; // 한 번에 하나씩
            }
        }

        void GrantUnique(UniqueData u)
        {
            S.uniques.Add(u.Id);
            // 아직 개성이 없는 분신 중 가장 레벨이 높은 분신이 받는다(자동 추천 배치)
            CloneState best = null;
            for (int i = 0; i < S.clones.Count; i++)
            {
                var c = S.clones[i];
                if (!string.IsNullOrEmpty(c.unique)) continue;
                if (best == null || c.level > best.level) best = c;
            }
            if (best != null) best.unique = u.Id;
            // 다른 개성을 얻으면 남은 실루엣의 힌트가 구체화된다
            for (int i = 0; i < Data.Uniques.Count; i++)
                if (!S.uniqueHint2.Contains(Data.Uniques[i].Id)) S.uniqueHint2.Add(Data.Uniques[i].Id);
            MarkFirst("first_unique");
            Emit(SimEventType.UniqueGained, best != null ? best.id : 0, 0, 0, u.Id);
        }

        // ------------------------------------------------------------------ 버킷리스트·단위·숨은 장면

        double BucketValue(string cond)
        {
            switch (cond)
            {
                case "paydays": return S.paydaysOnline;
                case "clones": return S.clones.Count;
                case "promotions": return S.stats.promotions;
                case "status": return S.status;
                case "house": return S.houseTier;
                case "properties": return S.properties.Count;
                case "stocks": { int n = 0; for (int i = 0; i < S.workplaces.Count; i++) n += S.workplaces[i].lots; return n + S.heldStocks.Count; }
                case "luxuries": return S.luxuries.Count;
                case "moves": return S.stats.moves;
                case "hall": return S.hall.Count;
                case "uniques": return S.uniques.Count;
                case "deposit": return S.deposit > 0 ? 1 : 0;
                case "trophies": return S.trophies.Count;
                case "manager": return S.manager ? 1 : 0;
                case "networth": return NetWorth();
            }
            return 0;
        }

        public double BucketProgress(BucketData b)
        {
            return b.Param <= 0 ? 1 : Math.Min(1, BucketValue(b.Condition) / b.Param);
        }

        void CheckBuckets()
        {
            for (int i = 0; i < Data.Buckets.Count; i++)
            {
                var b = Data.Buckets[i];
                if (S.buckets.Contains(b.Id) || BucketValue(b.Condition) < b.Param) continue;
                S.buckets.Add(b.Id);
                Emit(SimEventType.BucketDone, 0, 0, 0, b.Id);
                return;
            }
        }

        void CheckUnits()
        {
            int idx = NumberFormat.UnitIndex(NetWorth());
            if (idx <= 0) return;
            string unit = NumberFormat.Units[idx];
            if (S.unitsSeen.Contains(unit)) return;
            S.unitsSeen.Add(unit);
            Emit(SimEventType.UnitSeen, idx, 0, 0, unit);
        }

        public bool FindScene(string sceneId)
        {
            string key = S.city + ":" + sceneId;
            if (S.scenes.Contains(key)) return false;
            S.scenes.Add(key);
            S.sinceAction = 0;
            Emit(SimEventType.SceneFound, 0, 0, 0, sceneId);
            return true;
        }

        public int ScenesFoundHere
        {
            get
            {
                int n = 0;
                string prefix = S.city + ":";
                for (int i = 0; i < S.scenes.Count; i++) if (S.scenes[i].StartsWith(prefix, StringComparison.Ordinal)) n++;
                return n;
            }
        }

        // ------------------------------------------------------------------ 세션: 마무리 카드 · 출근 도장

        void CheckClosing()
        {
            if (!Has(Layer.Payday)) return;
            if (S.sinceAction < Data.E("closing_idle_sec") || S.sinceClosing < Data.E("closing_gap_sec")) return;
            if (S.eventId.Length > 0 || HasPendingPayday) return;
            var best = Recommend(false);
            if (best.Valid && SecondsUntil(best.Cost) < 90) return;
            S.sinceClosing = 0;
            Emit(SimEventType.ClosingCard);
        }

        /// <summary>하루 첫 접속의 출근 도장. 끊겨도 초기화되지 않고 놓친 날 표시도 없다.</summary>
        public bool TryStamp(string dateKey)
        {
            if (string.IsNullOrEmpty(dateKey) || S.stampDate == dateKey || !S.introDone) return false;
            S.stampDate = dateKey;
            S.stampDays++;
            Emit(SimEventType.Stamp, S.stampDays);
            return true;
        }

        public void StartSession()
        {
            S.sessionSec = 0;
            S.sinceEvent = 999;
            S.sinceAction = 0;
        }

        // ------------------------------------------------------------------ 매니저

        void GrantManager()
        {
            if (S.manager) return;
            S.manager = true;
            S.managerOn = true;
            Unlock(Layer.Manager);
            MarkFirst("manager");
            Emit(SimEventType.ManagerUnlocked);
        }

        // ------------------------------------------------------------------ 상점: 보상형 광고 · 가속권 · 패키지
        // 실제 광고·결제 SDK는 화면 쪽 서비스가 맡고, 여기서는 '보상이 지급됐다'만 처리한다.

        public bool CanWatchAd(string dateKey)
        {
            if (S.adsDate != dateKey) return true;
            return S.adsToday < (int)Data.E("ad_daily_cap") && S.adCooldown <= 0;
        }

        public int AdsLeft(string dateKey)
        {
            int cap = (int)Data.E("ad_daily_cap");
            return S.adsDate != dateKey ? cap : Math.Max(0, cap - S.adsToday);
        }

        public bool GrantAdBoost(string dateKey)
        {
            if (!CanWatchAd(dateKey)) return false;
            if (S.adsDate != dateKey) { S.adsDate = dateKey; S.adsToday = 0; }
            S.adsToday++;
            S.adCooldown = Data.E("ad_cooldown_sec");
            S.boostLeft += Data.E("ad_boost_sec");
            Emit(SimEventType.Boost, 0, 0, S.boostLeft);
            return true;
        }

        public double TimeTicketValue() { return SecondValue() * Data.E("time_ticket_sec"); }

        public bool UseTimeTicket()
        {
            if (S.timeTickets <= 0) return false;
            S.timeTickets--;
            double v = TimeTicketValue();
            Earn(v, 5);
            Emit(SimEventType.MoneyGain, 5, 0, v);
            return true;
        }

        public void GrantTimeTickets(int n) { S.timeTickets += Math.Max(0, n); }

        /// <summary>스타터팩: 매니저 즉시 해금 + 시간 가속권 3장 + 외형 위주 개성 1종(확률 없음).</summary>
        public void GrantStarterPack()
        {
            if (S.starterPack) return;
            S.starterPack = true;
            GrantTimeTickets(3);
            GrantManager();
        }

        public void GrantNoAds() { S.noAds = true; }
    }
}
