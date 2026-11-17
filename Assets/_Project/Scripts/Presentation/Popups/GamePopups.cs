using System.Linq;
using Bunsin.Sim;
using UnityEngine;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>게임의 팝업들. 모두 대기열로 하나씩 뜬다.</summary>
    public static class GamePopups
    {
        // ------------------------------------------------------------------ 도입(만화 컷 3장)

        public static void ShowIntroCut(Game g, int i, System.Action done)
        {
            string[] pics = { "o_receipt", "hero_rest", "o_mirror" };
            g.Popups.Enqueue(f =>
            {
                f.Dismissable = false;
                f.Picture(pics[i], 360);
                f.Text(g.Data.Line("intro", (i + 1).ToString()), 42);
                f.Button(i < 2 ? "다음" : "…나를 늘리자!", Palette.Yellow, () =>
                {
                    if (i < 2) ShowIntroCut(g, i + 1, done);
                    else done();
                });
            });
        }

        // ------------------------------------------------------------------ 월급날 명세서

        public static void Payday(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                var r = sim.S.pendingPayday;
                if (r.count <= 0) { f.Close(); return; }
                f.Dismissable = false;
                f.Title(r.count > 1 ? "월급 명세서 (" + r.count + "번 밀림)" : "월급 명세서", "i_payday", Palette.Coral);
                f.Highlight("+" + NumberFormat.Money(r.total) + "원", Palette.Mix(Palette.Yellow, Palette.White, 0.4f), 66);
                // 한 줄에 한 정보, 큰 금액이 위로
                foreach (var line in r.lines.OrderByDescending(l => l.amount).Take(6))
                    f.Line(line.label, NumberFormat.Money(line.amount), 32);
                if (r.lines.Count > 6) f.Text("외 " + (r.lines.Count - 6) + "줄", 26, Palette.InkSoft);
                if (!string.IsNullOrEmpty(r.deduction)) f.Line("공제: " + r.deduction, "0원", 26, Palette.InkSoft);
                double chicken = r.total / 20000.0;
                if (chicken >= 1 && chicken < 1e8) f.Text("치킨 " + NumberFormat.Money(chicken) + "마리 값", 28, Palette.InkSoft);
                f.Button("받기", Palette.Yellow, () => sim.CollectPayday());
            });
        }

        // ------------------------------------------------------------------ 재접속 정산서

        public static void Offline(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                var S = sim.S;
                if (!S.hasPendingOffline) { f.Close(); return; }
                var r = S.pendingOffline;
                f.Dismissable = false;
                f.Title("정산서 · " + NumberFormat.Duration(r.seconds) + " 동안", "i_payday");
                double total = r.workIncome + r.envelope;
                f.Highlight("+" + NumberFormat.Money(total) + "원", Palette.Mix(Palette.Yellow, Palette.White, 0.4f), 64);
                f.Line("야간 근무 합계", NumberFormat.Money(r.workIncome), 34);
                if (r.envelope > 0) f.Line("밀린 월급봉투 " + r.paydays + "개", NumberFormat.Money(r.envelope), 34);
                if (r.levelUps > 0) f.Line("레벨 업", r.levelUps + "번", 30, Palette.Ink);
                if (r.promotable > 0) f.Line("승진 대기", r.promotable + "명", 30, Palette.Coral);
                var mvp = sim.Clone(r.mvpClone);
                if (mvp != null) f.Line("오늘의 MVP", sim.CloneName(mvp) + " (" + g.JobLine(mvp) + ")", 28, Palette.Ink);
                if (r.news.Count > 0)
                {
                    f.Divider();
                    foreach (var n in r.news) f.Text("· " + n, 26, Palette.InkSoft, TextAnchor.MiddleLeft);
                }
                bool doubleFree = S.noAds;
                if (r.workIncome > 0)
                    f.Button(doubleFree ? "2배 받기" : "광고 보고 2배", Palette.Purple, () =>
                    {
                        if (doubleFree) { sim.CollectOffline(true); return; }
                        g.Ads.ShowRewarded("offline_x2", ok => sim.CollectOffline(ok));
                    });
                f.Button("받기", Palette.Yellow, () => sim.CollectOffline(false));
            }, true);
        }

        // ------------------------------------------------------------------ 사건 카드

        public static void EventCard(Game g, EventData e)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                f.Dismissable = false;
                var c = sim.Clone(sim.S.eventClone);
                f.Picture(c != null ? Art.CloneSprite(c.slot > 0 ? sim.Job(c.slot).Tier : -1, true) : "head", 220);
                f.Text(sim.FillTemplate(e.Text), 40);
                if (e.Series.Length > 0) f.Text("이어지는 이야기", 26, Palette.InkSoft);
                f.Button(e.ChoiceA + "\n<size=28>+" + NumberFormat.Money(sim.EventReward(e, 0)) + "</size>", Palette.Yellow, () => sim.ResolveEvent(0));
                if (e.ChoiceB.Length > 0)
                    f.Button(e.ChoiceB + "\n<size=28>+" + NumberFormat.Money(sim.EventReward(e, 1)) + "</size>", Palette.Sky, () => sim.ResolveEvent(1));
            }, true);
        }

        // ------------------------------------------------------------------ 분신 카드(훈련·승진·은퇴)

        public static void CloneCard(Game g, int id)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                var c = sim.Clone(id);
                if (c == null) { f.Close(); return; }
                var title = f.Title(sim.CloneName(c), Art.AptIcon(c.apt));
                var job = f.Text("", 32);
                var lv = f.Text("", 32);
                var bar = Ui.Node("XpBar", f.Body);
                bar.Size(-1, 34);
                RectTransform fill;
                Ui.Bar(bar, Palette.Cream, Palette.Yellow, out fill).Fill();
                var inc = f.Text("", 30, Palette.Green);
                var hist = f.Text("", 26, Palette.InkSoft);
                var block = f.Text("", 30, Palette.Coral);
                if (!string.IsNullOrEmpty(c.unique) && g.Data.UniquesById.ContainsKey(c.unique))
                {
                    var u = g.Data.UniquesById[c.unique];
                    f.Text("개성: " + u.Name + " · \"" + u.Line + "\"", 28, Palette.Purple);
                }
                var train = f.Button("", Palette.Sky, () => { if (!sim.Train(id)) g.Deny("훈련할 수 없어요"); else Sfx.Play("levelup"); }, false);
                var promo = f.Button("", Palette.Yellow, () =>
                {
                    var cc = sim.Clone(id);
                    if (cc == null) return;
                    if (sim.CanRetire(cc)) { f.Close(); ConfirmRetire(g, id); return; }
                    var b = sim.CheckPromotion(cc);
                    if (b == PromoBlock.None) { sim.Promote(id); f.Close(); }
                    else if (b == PromoBlock.Money) g.Do(new SimAction { Kind = ActionKind.Promote, CloneId = id, Cost = sim.Job(cc.slot + 1).PromoCost, Gain = 1, Label = "승진" });
                    else if (b == PromoBlock.Cert) { f.Close(); Workplace(g, cc.slot + 1); }
                    else if (b == PromoBlock.Status && g.TabUnlocked(Game.TabAssets)) { f.Close(); g.ShowTab(Game.TabAssets); }
                    else g.Deny(sim.PromoBlockText(cc));
                }, false);
                Live.On(f.Panel, () =>
                {
                    var cc = sim.Clone(id);
                    if (cc == null) { f.Close(); return; }
                    title.text = sim.CloneName(cc) + " · 적성 " + Tier.AptNames[cc.apt];
                    var jd = cc.slot > 0 ? sim.Job(cc.slot) : null;
                    job.text = jd != null ? cc.slot + "칸 " + jd.Name + (sim.AptMatches(cc) ? " <color=#2BB673>(적성 일치 +" + NumberFormat.Percent(g.Data.E("apt_bonus")) + ")</color>" : "") : "대기실";
                    int cap = cc.slot > 0 ? sim.LevelCap(cc.slot) : cc.level;
                    lv.text = "Lv." + cc.level + " / 상한 " + cap + (cc.bonusXp > 0 ? " · 보너스 훈련 저장 중" : "");
                    Ui.SetBar(fill, cc.level >= cap ? 1 : (float)(cc.xp / sim.XpNeed(cc.level)));
                    inc.text = "초당 " + NumberFormat.Money(sim.CloneIncome(cc)) + "원";
                    hist.text = "이력: " + string.Join(" → ", cc.history.Select(h => g.Data.JobsById.ContainsKey(h) ? g.Data.JobsById[h].Name : h).Distinct().Reverse().Take(4).Reverse());
                    var b = sim.CheckPromotion(cc);
                    block.text = b == PromoBlock.None ? "" : sim.PromoBlockText(cc);
                    double tc = sim.TrainCost(cc);
                    train.gameObject.SetActive(sim.Has(Layer.Train));
                    Ui.ButtonLabel(train).text = double.IsInfinity(tc) ? "상한 도달" : "훈련 +1레벨\n<size=28>" + NumberFormat.Money(tc) + "</size>";
                    Ui.SetEnabledLook(train, !double.IsInfinity(tc) && tc <= sim.S.money, Palette.Sky);
                    if (sim.CanRetire(cc)) { Ui.ButtonLabel(promo).text = "은퇴식"; Ui.SetEnabledLook(promo, true, Palette.Yellow); }
                    else if (cc.slot >= sim.City.Slots) { Ui.ButtonLabel(promo).text = "꼭대기 자리"; Ui.SetEnabledLook(promo, false, Palette.Yellow); }
                    else
                    {
                        double pc = sim.Job(cc.slot + 1).PromoCost;
                        Ui.ButtonLabel(promo).text = "승진: " + sim.Job(cc.slot + 1).Name + "\n<size=28>" + NumberFormat.Money(pc) + "</size>";
                        Ui.SetEnabledLook(promo, b == PromoBlock.None, Palette.Yellow);
                    }
                });
            });
        }

        public static void ConfirmRetire(Game g, int id)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                var c = sim.Clone(id);
                if (c == null) { f.Close(); return; }
                f.Title(sim.CloneName(c) + " 은퇴식", "i_retire");
                f.Text("꼭대기 자리가 비고, 명예의 전당에 올라\n전체 수입 +" + NumberFormat.Percent(g.Data.E("retire_bonus")) + "를 영원히 응원해요.", 34);
                f.Text("은퇴한 분신은 단골손님으로 가끔 놀러 와요.", 28, Palette.InkSoft);
                f.Button("조금 더 일하기", Palette.White, null);
                f.Button("은퇴시키기", Palette.Yellow, () => sim.Retire(id));
            }, true);
        }

        // ------------------------------------------------------------------ 일터 카드(시설·자격증·주식)

        public static void Workplace(Game g, int slot)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                var job = sim.Job(slot);
                f.Title(job.Name, null);
                f.Picture(job.Sprite, 240);
                f.Text(job.Company + " · " + job.TierLabel + " · 월급날 '" + job.PaydayLine + "'", 28, Palette.InkSoft);
                var info = f.Text("", 32);
                var cert = job.Cert.Length > 0 ? f.Text("", 30, Palette.Coral) : null;
                UnityEngine.UI.Button facBtn = null, certBtn = null, stockBtn = null;
                if (sim.Has(Layer.Facility))
                    facBtn = f.Button("", Palette.Yellow, () => g.Do(new SimAction { Kind = ActionKind.Facility, Slot = slot, Cost = sim.FacilityCost(slot), Gain = 1, Label = "시설" }), false);
                if (job.Cert.Length > 0)
                    certBtn = f.Button("", Palette.Coral, () => g.Do(new SimAction { Kind = ActionKind.Cert, Slot = slot, Cost = job.CertCost, Gain = 1, Label = job.Cert }), false);
                if (sim.Has(Layer.Stock))
                    stockBtn = f.Button("", Palette.Purple, () => g.Do(new SimAction { Kind = ActionKind.Stock, Slot = slot, Cost = sim.LotPrice(slot), Gain = 1, Label = "주식" }), false);
                Live.On(f.Panel, () =>
                {
                    var wp = sim.Workplace(slot);
                    info.text = "분신 " + sim.CountAt(slot) + "/5 · 초당 " + NumberFormat.Money(sim.WorkplaceIncome(slot)) +
                                "\n시설 " + wp.facility + "단계(수입 +" + NumberFormat.Percent(sim.FacilityMult(slot) - 1) + ") · 레벨 상한 " + sim.LevelCap(slot) +
                                (sim.Has(Layer.Stock) ? "\n" + (sim.IsListed(slot) ? "상장 · 보유 " + wp.lots + "/" + sim.LotCap(slot) + "주" : "시설 " + sim.StockListLevel + "단계에 상장") : "");
                    if (cert != null) cert.text = wp.cert ? job.Cert + " 보유 ✓" : "이 자리로 승진하려면 '" + job.Cert + "'이(가) 필요해요";
                    if (facBtn != null)
                    {
                        double fc = sim.FacilityCost(slot);
                        Ui.ButtonLabel(facBtn).text = double.IsInfinity(fc) ? "시설 최고 단계" : "시설 업그레이드\n<size=28>" + NumberFormat.Money(fc) + "</size>";
                        Ui.SetEnabledLook(facBtn, wp.open && fc <= sim.S.money, Palette.Yellow);
                    }
                    if (certBtn != null)
                    {
                        certBtn.gameObject.SetActive(!wp.cert);
                        Ui.ButtonLabel(certBtn).text = "자격증\n<size=28>" + NumberFormat.Money(job.CertCost) + "</size>";
                        Ui.SetEnabledLook(certBtn, job.CertCost <= sim.S.money, Palette.Coral);
                    }
                    if (stockBtn != null)
                    {
                        bool can = sim.IsListed(slot) && wp.lots < sim.LotCap(slot);
                        stockBtn.gameObject.SetActive(sim.IsListed(slot));
                        Ui.ButtonLabel(stockBtn).text = "주식 1주\n<size=28>" + NumberFormat.Money(sim.LotPrice(slot)) + "</size>";
                        Ui.SetEnabledLook(stockBtn, can && sim.LotPrice(slot) <= sim.S.money, Palette.Purple);
                    }
                });
            });
        }

        // ------------------------------------------------------------------ 이사(얻는 것은 크게, 초기화되는 것은 작게)

        public static void Move(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                var sim = g.Sim;
                if (!sim.CanMove) { f.Close(); return; }
                var next = g.Data.City(sim.S.city + 1);
                f.Title(next.Name + "(으)로 이사", "i_truck");
                f.Picture("o_truck_big", 220);
                int fame = sim.FameGainPreview();
                f.Highlight("명성 +" + fame + " → 영구 수입 +" + NumberFormat.Percent(fame * g.Data.E("fame_bonus")), Palette.Mix(Palette.Green, Palette.White, 0.5f), 46);
                f.Line("분신 " + sim.S.clones.Count + "명 전원 동행", "레벨 " + NumberFormat.Percent(g.Data.E("move_keep_level_ratio")) + " 유지", 30, Palette.Green);
                f.Line("정착금", NumberFormat.Money(sim.SettleMoney()) + "원", 30);
                f.Line("가져가는 것", "예금·집·사치품·신분·매니저", 28, Palette.Green);
                f.Line("남겨도 수입이 오는 것", "건물 월세·주식(보유 종목)", 28, Palette.Green);
                f.Text("새 도시 규칙: " + next.RuleText, 30, Palette.Purple);
                f.Text("현금·일터 시설·자격증은 새 도시 것으로 바뀌어요", 24, Palette.InkSoft);
                if (!sim.MoveRecommended) f.Text("지금도 성장 중이에요. 더 키우다 가도 손해는 없어요.", 26, Palette.InkSoft);
                f.Button("더 키우기", Palette.White, null);
                f.Button("이사하기!", Palette.Yellow, () => { sim.WithdrawAll(); sim.Move(); g.Save(); });
            });
        }

        // ------------------------------------------------------------------ 새 시스템 소개(사람이 소개한다)

        public static void LayerIntro(Game g, int layer)
        {
            var info = g.Sim.LayerInfo(layer);
            if (info == null) return;
            g.Popups.Enqueue(f =>
            {
                f.Dismissable = false;
                f.Title(info.Name + " 열림!", LayerIcon(layer), Palette.Ink);
                f.Picture(SpeakerPic(layer), 220);
                f.Text(info.Speaker, 28, Palette.InkSoft);
                string text = info.Text;
                if (layer == Layer.CityRule) text += "\n" + g.Sim.City.RuleText;
                f.Text("\"" + text + "\"", 36);
                f.Button(layer == Layer.Manager ? "커피 마시러 간다" : "좋아요", Palette.Yellow, () =>
                {
                    if (layer == Layer.Deposit || layer == Layer.Property || layer == Layer.Stock || layer == Layer.Status)
                        if (g.TabUnlocked(Game.TabAssets)) g.ShowTab(Game.TabAssets);
                });
            });
        }

        static string LayerIcon(int layer)
        {
            switch (layer)
            {
                case Layer.Train: return "i_train";
                case Layer.Facility: return "i_facility";
                case Layer.Manager: return "i_manager";
                case Layer.Deposit: return "i_bank";
                case Layer.Property: return "i_building";
                case Layer.Stock: return "i_stock";
                case Layer.Status: return "i_house";
                case Layer.Retire: return "i_retire";
                case Layer.Move: return "i_truck";
                case Layer.CityRule: return "i_village";
            }
            return "i_level";
        }

        static string SpeakerPic(int layer)
        {
            switch (layer)
            {
                case Layer.Manager: return "hero_rest";
                case Layer.Deposit: return "i_piggy";
                case Layer.Property: return "p_building";
                case Layer.Stock: return "b_office";
                case Layer.Status: return "o_frame";
                case Layer.Retire: return "clone_inv_cheer";
                case Layer.Move: return "o_truck_big";
                case Layer.Facility: return "b_delivery";
            }
            return "clone_alba_cheer";
        }

        // ------------------------------------------------------------------ 개성 분신·마무리·설정

        public static void Unique(Game g, string uniqueId, int cloneId)
        {
            UniqueData u;
            if (!g.Data.UniquesById.TryGetValue(uniqueId, out u)) return;
            g.Popups.Enqueue(f =>
            {
                Sfx.Play("unlock");
                f.Title("개성 분신 발견!", "i_crown", Palette.Purple);
                f.Picture("clone_new_cheer", 240);
                f.Highlight(u.Name, Palette.Mix(Palette.Purple, Palette.White, 0.6f), 54);
                f.Text("\"" + u.Line + "\"", 34);
                var c = g.Sim.Clone(cloneId);
                string effect = u.Passive == "job" ? "일하는 곳 수입" : u.Passive == "tap" ? "탭 수입" : u.Passive == "payday" ? "월급날 보너스" : "경험";
                f.Text((c != null ? g.Sim.CloneName(c) + "에게 깃들었어요 · " : "") + effect + " +" + NumberFormat.Percent(u.Value), 28, Palette.InkSoft);
                f.Button("반가워!", Palette.Yellow, null);
            });
        }

        public static void Closing(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                f.Title("오늘의 결산", "i_clock");
                f.Line("이번 접속에 번 돈", NumberFormat.Money(g.SessionEarned) + "원", 34);
                f.Line("다음 월급날까지", NumberFormat.Duration(g.S.paydayTimer), 34, Palette.Coral);
                var pool = g.Data.LinePool("closing");
                if (pool.Count > 0) f.Text(pool[Random.Range(0, pool.Count)].Value, 30, Palette.InkSoft);
                f.Button("좀 더 할래요", Palette.Yellow, null);
            });
        }

        public static void StatusInfo(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                var st = g.Data.Status[g.S.status];
                f.Title("신분: " + st.Name, "i_house");
                f.Text(st.Desc, 32);
                f.Text("은행·부동산이 열리면 집을 옮기고 신분을 올릴 수 있어요.", 28, Palette.InkSoft);
                f.Button("확인", Palette.Yellow, null);
            });
        }

        public static void Settings(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                var S = g.S;
                f.Title("설정", "i_gear");
                var music = f.Button("", Palette.White, () => { Sfx.MusicVolume = Sfx.MusicVolume > 0 ? 0 : 0.6f; S.musicVol = Sfx.MusicVolume; }, false);
                f.ButtonRow = null;
                var sfx = f.Button("", Palette.White, () => { Sfx.SfxVolume = Sfx.SfxVolume > 0 ? 0 : 1; S.sfxVol = Sfx.SfxVolume; }, false);
                f.ButtonRow = null;
                var big = f.Button("", Palette.White, () => { S.bigText = !S.bigText; f.Close(); g.RebuildAll(); }, false);
                f.ButtonRow = null;
                var vib = f.Button("", Palette.White, () => S.haptics = !S.haptics, false);
                f.ButtonRow = null;
                f.Text("데이터 " + g.Data.DataVersion + " · 앱 " + Application.version, 24, Palette.InkSoft);
                f.Text("글꼴: 주아체(배달의민족, SIL OFL 1.1)", 22, Palette.InkSoft);
                f.Button("처음부터", Palette.Coral, () => ConfirmReset(g));
                f.Button("닫기", Palette.Yellow, () => g.Save());
                Live.On(f.Panel, () =>
                {
                    Ui.ButtonLabel(music).text = "배경음: " + (Sfx.MusicVolume > 0 ? "켬" : "끔");
                    Ui.ButtonLabel(sfx).text = "효과음: " + (Sfx.SfxVolume > 0 ? "켬" : "끔");
                    Ui.ButtonLabel(big).text = "큰 글씨: " + (S.bigText ? "켬" : "끔");
                    Ui.ButtonLabel(vib).text = "진동: " + (S.haptics ? "켬" : "끔");
                });
            }, true);
        }

        static void ConfirmReset(Game g)
        {
            g.Popups.Enqueue(f =>
            {
                f.Title("정말 처음부터?", "i_alert", Palette.Coral);
                f.Text("모든 진행이 지워지고 되돌릴 수 없어요.", 34);
                f.Button("아니요", Palette.Yellow, null);
                f.Button("지우기", Palette.Coral, () => g.ResetGame());
            }, true);
        }
    }
}
