using System.Linq;
using System.Text;
using Bunsin.Sim;
using UnityEngine;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 자산 탭: 돈의 2층(굴려서 불린다: 예금·부동산·주식)과 3층(써서 올라선다: 집·사치품·트로피·신분).
    /// 모든 자산은 가치가 떨어지지 않고 확률이 없다. 시스템은 해금 층 순서대로 하나씩 보인다.
    /// </summary>
    public sealed class AssetsScreen : ScreenBase
    {
        RectTransform _content;
        readonly StringBuilder _sb = new StringBuilder();

        protected override void Setup()
        {
            var bg = Ui.Box(Root, Palette.Paper, "Bg");
            bg.Rt().Fill();
            var sr = Ui.Scroll(Root, out _content, 18, 24, 16, 40);
            sr.Rt().Fill();
        }

        protected override string Signature()
        {
            _sb.Length = 0;
            _sb.Append(S.city).Append('|').Append(S.layerMask).Append('|').Append(S.status).Append('|').Append(S.houseTier).Append('|')
               .Append(S.properties.Count).Append('|').Append(S.luxuries.Count).Append('|').Append(S.licenses.Count).Append('|')
               .Append(S.trophies.Count).Append('|').Append(S.heldStocks.Count).Append('|');
            foreach (var w in S.workplaces) _sb.Append(Sim.IsListed(w.slot) ? 'L' : '-');
            foreach (var p in S.properties) _sb.Append(p.remodel);
            return _sb.ToString();
        }

        protected override void Build()
        {
            Ui.Clear(_content);
            BuildStatus();
            BuildDeposit();
            if (Sim.Has(Layer.Property)) BuildProperties();
            if (Sim.Has(Layer.Stock)) BuildStocks();
            if (Sim.Has(Layer.Status)) { BuildHouse(); BuildLuxury(); BuildTrophy(); }
            if (S.heldStocks.Count > 0 || S.properties.Any(p => p.city != S.city)) BuildOldCity();
            var next = Sim.NextLayerHint();
            if (next != null && next.Id >= Layer.Property)
            {
                var r = Row(_content, "i_lock", "다음에 열릴 것: " + next.Name, null, 140);
                r.Sub.text = next.Hint;
                r.Root.GetComponent<UImage>().color = Palette.Alpha(Palette.White, 0.7f);
            }
        }

        // ------------------------------------------------------------------ 신분 등급

        void BuildStatus()
        {
            var st = Data.Status[S.status];
            var card = Ui.Card(_content, 330, Palette.Mix(Palette.Green, Palette.White, 0.75f), "Status");
            var ic = Ui.Image(card, "i_house", Color.white, "Icon");
            ic.Rt().Place(0, 1, 120, 120, 26, -24, 0, 1);
            var title = Ui.FitLabel(card, "신분: " + st.Name, 48, Palette.Ink, TextAnchor.MiddleLeft);
            title.Rt().Top(70, 30, 170, 30);
            var desc = Ui.FitLabel(card, st.Desc, 28, Palette.InkSoft, TextAnchor.MiddleLeft);
            desc.Rt().Top(40, 100, 170, 30);
            var reqA = Ui.FitLabel(card, "", 30, Palette.Ink, TextAnchor.MiddleLeft, "ReqWorth");
            reqA.Rt().Top(44, 168, 40, 30);
            RectTransform fill;
            var bar = Ui.Bar(card, Palette.White, Palette.Green, out fill, "WorthBar");
            bar.Top(26, 216, 40, 40);
            var reqB = Ui.FitLabel(card, "", 30, Palette.Ink, TextAnchor.MiddleLeft, "ReqAsset");
            reqB.Rt().Top(44, 254, 40, 30);
            Updaters.Add(() =>
            {
                if (S.status + 1 >= Data.Status.Count)
                {
                    reqA.text = "최고 등급입니다. 축하합니다!";
                    Ui.SetBar(fill, 1);
                    reqB.text = "";
                    return;
                }
                var next = Data.Status[S.status + 1];
                double worth = Sim.NetWorth();
                reqA.text = "다음 '" + next.Name + "': 순자산 " + NumberFormat.Money(worth) + " / " + NumberFormat.Money(next.NetWorth);
                Ui.SetBar(fill, (float)(worth / next.NetWorth));
                bool asset = Sim.HasStatusAsset(S.status + 1);
                string setName = Data.Luxuries.Where(l => l.Set == S.status + 1).Select(l => l.SetName).FirstOrDefault() ?? "";
                reqB.text = (asset ? "<color=#2BB673>✓</color> " : "• ") + "대표 자산: '" + Data.Houses[next.HouseTier].Name + "' 이상" +
                            (setName.Length > 0 ? " 또는 '" + setName + "' 완성" : "");
            });
        }

        // ------------------------------------------------------------------ 예금

        void BuildDeposit()
        {
            Section(_content, "은행 예금", "i_bank");
            var r = Row(_content, "i_piggy", "예금", () => { if (Sim.Deposit(1) > 0) Sfx.Play("coin"); else G.Deny("넣을 현금이 없거나 한도가 찼어요"); }, 180);
            var w = Row(_content, "i_cash", "통장 깨기", () => { if (Sim.WithdrawAll() > 0) Sfx.Play("coin"); }, 130);
            Updaters.Add(() =>
            {
                r.Title.text = "예금 " + NumberFormat.Money(S.deposit) + "원";
                r.Sub.text = "월급날마다 이자 " + NumberFormat.Percent(Data.E("deposit_rate")) + " · 한도 " + NumberFormat.Money(Sim.DepositCap()) + "\n넣어 두면 월급날마다 불어나요";
                r.SetButton("전부\n넣기", S.money > 0 && S.deposit < Sim.DepositCap() ? 0 : 2);
                w.Sub.text = "언제든 수수료 없이 현금으로";
                w.SetButton("깨기", S.deposit > 0 ? 1 : 2);
            });
        }

        // ------------------------------------------------------------------ 부동산

        void BuildProperties()
        {
            var city = Sim.City;
            Section(_content, "부동산 · " + city.Name + " 부지 " + Sim.PlotsUsed + "/" + city.Plots, "i_building");
            Note(_content, "월세는 월급날마다 들어와요. 건물 값은 떨어지지 않아요." + (city.Rule == "boom" ? " (개발 붐: 월세 ×" + city.RuleA + ")" : ""));
            for (int i = 0; i < S.properties.Count; i++)
            {
                var ps = S.properties[i];
                if (ps.city != S.city) continue;
                int idx = i;
                var pd = Data.PropertiesById[ps.id];
                var r = Row(_content, pd.Sprite, pd.Name + (ps.remodel > 0 ? " ★" + ps.remodel : ""), () =>
                {
                    double cost = Sim.RemodelCost(S.properties[idx]);
                    G.Do(new SimAction { Kind = ActionKind.Remodel, Slot = idx, Cost = cost, Gain = 1, Label = pd.Name + " 리모델링" });
                }, 170);
                Updaters.Add(() =>
                {
                    var p = S.properties[idx];
                    double cost = Sim.RemodelCost(p);
                    r.Sub.text = "월세 " + NumberFormat.Money(Sim.PropertyRent(p)) + " · 가치 " + NumberFormat.Money(Sim.PropertyValue(p)) + Boost(pd);
                    if (double.IsInfinity(cost)) r.SetButton("완성", 2);
                    else r.SetButton("리모델링\n" + NumberFormat.Money(cost), RowCard.State(Sim, cost));
                });
            }
            if (Sim.PlotsUsed < city.Plots)
                foreach (var pd in city.Properties)
                {
                    var p = pd;
                    var r = Row(_content, p.Sprite, p.Name, () =>
                    {
                        if (S.status < p.ReqStatus) { G.Deny("신분 '" + Data.Status[p.ReqStatus].Name + "'이(가) 필요해요"); return; }
                        G.Do(new SimAction { Kind = ActionKind.Property, Id = p.Id, Cost = p.Price, Gain = 1, Label = p.Name + " 매입" });
                    }, 170);
                    Updaters.Add(() =>
                    {
                        bool ok = S.status >= p.ReqStatus;
                        double rent = p.Price * Data.E("property_rent_rate") * (city.Rule == "boom" ? city.RuleA : 1);
                        r.Sub.text = ok ? "월세 " + NumberFormat.Money(rent) + Boost(p) : "신분 '" + Data.Status[p.ReqStatus].Name + "' 필요";
                        r.SetButton("매입\n" + NumberFormat.Money(p.Price), RowCard.State(Sim, p.Price, ok));
                    });
                }
        }

        string Boost(PropertyData p)
        {
            if (p.BoostTier < 0 || p.BoostPct <= 0) return "";
            return "\n입점 효과: " + Tier.Labels[p.BoostTier] + " 일터 수입 +" + NumberFormat.Percent(p.BoostPct);
        }

        // ------------------------------------------------------------------ 주식

        void BuildStocks()
        {
            Section(_content, "주식 · 내 일터가 상장하면", "i_stock");
            Note(_content, "시세는 일터 시설이 오를 때만 올라요(무작위 등락 없음). 보유 한도 = 시설 단계. 1주당 그 일터 수입 +" + NumberFormat.Percent(Data.E("stock_bonus_per_lot")) + ", 월급날 배당.");
            for (int s = 1; s <= Sim.City.Slots; s++)
            {
                if (!Sim.IsListed(s)) continue;
                int slot = s;
                var job = Sim.Job(slot);
                var r = Row(_content, job.Sprite, job.Company, () => G.Do(new SimAction { Kind = ActionKind.Stock, Slot = slot, Cost = Sim.LotPrice(slot), Gain = 1, Label = job.Company + " 주식" }), 170);
                Updaters.Add(() =>
                {
                    var wp = Sim.Workplace(slot);
                    r.Sub.text = "보유 " + wp.lots + "/" + Sim.LotCap(slot) + "주 · 1주 " + NumberFormat.Money(Sim.LotPrice(slot));
                    r.SetButton(wp.lots >= Sim.LotCap(slot) ? "한도" : "1주 사기", wp.lots >= Sim.LotCap(slot) ? 2 : RowCard.State(Sim, Sim.LotPrice(slot)));
                });
            }
            if (!Enumerable.Range(1, Sim.City.Slots).Any(Sim.IsListed))
                Note(_content, "일터 시설을 " + Sim.StockListLevel + "단계까지 올리면 상장해요.");
        }

        // ------------------------------------------------------------------ 집·사치품·트로피

        void BuildHouse()
        {
            Section(_content, "본체의 집", "i_house");
            var cur = Data.Houses[S.houseTier];
            var next = Sim.NextHouse;
            var r = Row(_content, "i_house", "지금: " + cur.Name, next == null ? null : (System.Action)(() =>
                G.Do(new SimAction { Kind = ActionKind.House, Cost = next.Price, Gain = 1, Label = next.Name })), 170);
            Updaters.Add(() =>
            {
                if (next == null) { r.Sub.text = cur.Desc + " · 최고의 집"; return; }
                r.Sub.text = "다음: " + next.Name + " — " + next.Desc + "\n집을 옮기면 홈 배경이 바뀌고 신분 조건이 채워져요";
                r.SetButton("이사\n" + NumberFormat.Money(next.Price), RowCard.State(Sim, next.Price));
            });
        }

        void BuildLuxury()
        {
            int setNo = Mathf.Clamp(S.status + 1, 1, Data.Cities.Count);
            for (int set = 1; set <= setNo; set++)
            {
                var items = Data.Luxuries.Where(l => l.Set == set).ToList();
                if (items.Count == 0) continue;
                if (set < setNo && Sim.SetComplete(set)) continue; // 끝낸 세트는 접는다
                Section(_content, "사치품 · " + items[0].SetName + (Sim.SetComplete(set) ? " ✓" : ""), "i_luxury");
                foreach (var l in items)
                {
                    var item = l;
                    bool needsLicense = item.LicenseCost > 0 && !Sim.HasLicense(item.Id);
                    var r = Row(_content, item.Part == "car" ? "i_truck" : item.Part == "watch" ? "i_luxury" : "i_clone", item.Name, () =>
                    {
                        if (Sim.OwnsLuxury(item.Id)) return;
                        if (S.status < item.ReqStatus) { G.Deny("신분 '" + Data.Status[item.ReqStatus].Name + "' 필요"); return; }
                        if (item.LicenseCost > 0 && !Sim.HasLicense(item.Id))
                            G.Do(new SimAction { Kind = ActionKind.License, Id = item.Id, Cost = item.LicenseCost, Gain = 1, Label = "면허" });
                        else G.Do(new SimAction { Kind = ActionKind.Luxury, Id = item.Id, Cost = item.Price, Gain = 1, Label = item.Name });
                    }, 150);
                    Updaters.Add(() =>
                    {
                        if (Sim.OwnsLuxury(item.Id)) { r.Sub.text = "보유 중"; r.SetButton("보유", 2); return; }
                        bool lic = item.LicenseCost > 0 && !Sim.HasLicense(item.Id);
                        r.Sub.text = lic ? "먼저 면허가 필요해요(" + NumberFormat.Money(item.LicenseCost) + ")" : "수입은 없지만 신분이 올라요";
                        double cost = lic ? item.LicenseCost : item.Price;
                        r.SetButton((lic ? "면허\n" : "구매\n") + NumberFormat.Money(cost), RowCard.State(Sim, cost, S.status >= item.ReqStatus));
                    });
                }
            }
        }

        void BuildTrophy()
        {
            var t = Sim.City.Trophy;
            Section(_content, "도시 트로피", "i_trophy");
            var r = Row(_content, "i_trophy", t.Name, () =>
            {
                if (S.status < t.ReqStatus) { G.Deny("신분 '" + Data.Status[t.ReqStatus].Name + "' 필요"); return; }
                G.Do(new SimAction { Kind = ActionKind.Trophy, Cost = t.Price, Gain = 1, Label = t.Name });
            }, 160);
            Updaters.Add(() =>
            {
                if (Sim.OwnsTrophy(S.city)) { r.Sub.text = "이 도시 완전 정복! 이사할 때 명성 +2"; r.SetButton("보유", 2); return; }
                r.Sub.text = "이 도시의 끝 목표 · 이사할 때 명성 +2";
                r.SetButton("구매\n" + NumberFormat.Money(t.Price), RowCard.State(Sim, t.Price, S.status >= t.ReqStatus));
            });
        }

        void BuildOldCity()
        {
            Section(_content, "떠난 도시의 자산", "i_truck");
            var info = Row(_content, "i_building", "월급날마다 따라오는 수입", null, 150);
            Updaters.Add(() => info.Sub.text = NumberFormat.Money(Sim.OldCityAssetPerPayday()) + "원 (지금 수입에 비례한 상한 있음)");
            for (int i = 0; i < S.heldStocks.Count; i++)
            {
                int idx = i;
                var h = S.heldStocks[i];
                string name = Data.JobsById.ContainsKey(h.jobId) ? Data.JobsById[h.jobId].Company : h.jobId;
                var r = Row(_content, "i_stock", name + " " + h.lots + "주", () => { if (idx < S.heldStocks.Count && Sim.SellHeld(idx)) Sfx.Play("coin"); }, 140);
                r.Sub.text = Data.City(h.city).Name + " · 평가액 " + NumberFormat.Money(h.value);
                r.SetButton("매도", 1);
            }
        }
    }
}
