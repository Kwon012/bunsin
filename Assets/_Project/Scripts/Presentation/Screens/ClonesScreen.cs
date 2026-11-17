using System.Collections.Generic;
using System.Linq;
using System.Text;
using Bunsin.Sim;
using UnityEngine;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 분신 탭: 승진 대기 줄(한 곳에 모은다) · 매니저 · 명단 · 명예의 전당 · 개성 도감 · 버킷리스트.
    /// </summary>
    public sealed class ClonesScreen : ScreenBase
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
            _sb.Append(S.city).Append('|').Append(S.clones.Count).Append('|').Append(S.hall.Count).Append('|')
               .Append(S.uniques.Count).Append('|').Append(S.buckets.Count).Append('|').Append(S.manager ? 1 : 0).Append('|')
               .Append(Sim.Has(Layer.Retire) ? 1 : 0).Append('|');
            foreach (var c in Sim.PromotionQueue()) _sb.Append(c.id).Append(',');
            foreach (var c in S.clones) _sb.Append(c.slot);
            return _sb.ToString();
        }

        protected override void Build()
        {
            Ui.Clear(_content);

            // 승진 대기 줄
            var queue = Sim.PromotionQueue();
            Section(_content, "승진 대기 줄 " + queue.Count + "명", "i_up");
            if (queue.Count == 0) Note(_content, "레벨이 차고 윗자리가 비면 여기에 줄을 서요.");
            else
            {
                var all = Row(_content, "i_check", "가능한 분신 모두 승진", PromoteAll, 140);
                Updaters.Add(() =>
                {
                    int n = 0; double cost = 0;
                    foreach (var c in Sim.PromotionQueue())
                        if (Sim.CheckPromotion(c) == PromoBlock.None) { n++; cost += Sim.Job(c.slot + 1).PromoCost; }
                    all.Sub.text = n > 0 ? n + "명 · 약 " + NumberFormat.Money(cost) + "원" : "돈이 모이면 가능";
                    all.SetButton("모두\n승진", n > 0 ? 0 : 1);
                });
                foreach (var c in queue.Take(12)) PromoRow(c);
            }

            // 은퇴 후보
            if (Sim.Has(Layer.Retire))
            {
                var ret = S.clones.Where(c => Sim.CanRetire(c)).ToList();
                if (ret.Count > 0)
                {
                    Section(_content, "은퇴 가능 " + ret.Count + "명", "i_retire");
                    Note(_content, "은퇴하면 꼭대기 자리가 비고, 명예의 전당에서 전체 수입 +" + NumberFormat.Percent(Data.E("retire_bonus")) + "씩 영원히 응원해요.");
                    foreach (var c in ret.Take(5))
                    {
                        int id = c.id;
                        var r = Row(_content, "head_cheer", Sim.CloneName(c) + " · " + G.JobLine(c) + " Lv." + c.level, () => GamePopups.ConfirmRetire(G, id), 150);
                        r.Sub.text = "거친 자리 " + c.history.Count + "곳";
                        r.SetButton("은퇴식", 0);
                    }
                }
            }

            // 매니저
            if (S.manager)
            {
                Section(_content, "매니저 분신", "i_manager");
                var r = Row(_content, "i_manager", "자동 고용·훈련·승진·시설", () => { S.managerOn = !S.managerOn; Sfx.Play("click"); }, 160);
                var rule = Row(_content, "i_up", "자동 승진 규칙", () => { S.managerRule = 1 - S.managerRule; Sfx.Play("click"); }, 150);
                Updaters.Add(() =>
                {
                    r.Sub.text = S.managerOn ? "본체는 커피를 마시는 중. 자산은 직접 고르세요" : "꺼져 있어요";
                    r.SetButton(S.managerOn ? "켜짐" : "꺼짐", S.managerOn ? 0 : 1);
                    rule.Sub.text = S.managerRule == 0 ? "적성이 맞는 분신부터 올린다" : "레벨이 높은 분신부터 올린다";
                    rule.SetButton(S.managerRule == 0 ? "적성 우선" : "레벨 우선", 1);
                });
            }

            // 분신 명단
            Section(_content, "분신 명단 " + S.clones.Count + "명", "i_clone");
            Note(_content, "적성: " + string.Join(" · ", Enumerable.Range(0, Tier.Count).Select(i => Tier.AptNames[i] + "→" + Tier.Labels[i])) + " 일이 맞으면 수입·성장 +" + NumberFormat.Percent(Data.E("apt_bonus")));
            var grid = Ui.Node("Roster", _content);
            int rows = Mathf.CeilToInt(S.clones.Count / 5f);
            grid.Size(-1, Mathf.Max(1, rows) * 196);
            var g = grid.gameObject.AddComponent<UnityEngine.UI.GridLayoutGroup>();
            g.cellSize = new Vector2(180, 186);
            g.spacing = new Vector2(10, 10);
            g.childAlignment = TextAnchor.UpperCenter;
            var chips = new List<KeyValuePair<CloneChip, int>>();
            foreach (var c in S.clones.OrderByDescending(x => x.slot).ThenByDescending(x => x.level))
            {
                var chip = CloneChip.Create(grid, 180, 186, id => GamePopups.CloneCard(G, id));
                chips.Add(new KeyValuePair<CloneChip, int>(chip, c.id));
            }
            Updaters.Add(() => { foreach (var kv in chips) kv.Key.Set(Sim, Sim.Clone(kv.Value)); });

            // 명예의 전당
            if (S.hall.Count > 0)
            {
                Section(_content, "명예의 전당 " + S.hall.Count + "명 · 수입 +" + NumberFormat.Percent(S.hall.Count * Data.E("retire_bonus")), "i_retire");
                foreach (var h in S.hall.Skip(System.Math.Max(0, S.hall.Count - 5)))
                {
                    var r = Row(_content, "head_cheer", (string.IsNullOrEmpty(h.name) ? h.id + "호" : h.name) + " · Lv." + h.level, null, 130);
                    r.Sub.text = Data.City(h.city).Name + "에서 은퇴 · 거친 자리 " + h.history.Count + "곳";
                }
            }

            // 개성 도감(비확률, 숨은 조건)
            Section(_content, "개성 분신 도감 " + S.uniques.Count + "/" + Data.Uniques.Count, "i_crown");
            foreach (var u in Data.Uniques)
            {
                bool owned = S.uniques.Contains(u.Id);
                var r = Row(_content, owned ? "head_cheer" : "head", owned ? u.Name + " · " + u.Prop : "???", null, 140);
                if (!owned) r.Icon.color = Palette.Alpha(Palette.Ink, 0.5f);
                string effect = u.Passive == "job" ? "일하는 곳 수입" : u.Passive == "tap" ? "탭 수입" : u.Passive == "payday" ? "월급날 보너스" : "경험";
                r.Sub.text = owned ? "\"" + u.Line + "\" · " + effect + " +" + NumberFormat.Percent(u.Value)
                                   : "힌트: " + (S.uniqueHint2.Contains(u.Id) ? u.Hint2 : u.Hint1);
            }

            // 버킷리스트(효도 리스트): 일일 퀘스트 대신 생활 꿈 목표
            Section(_content, "버킷리스트 " + S.buckets.Count + "/" + Data.Buckets.Count, "i_heart");
            foreach (var b in Data.Buckets)
            {
                bool done = S.buckets.Contains(b.Id);
                var r = Row(_content, done ? "i_check" : "i_heart", b.Name, null, 132);
                if (!done) r.Icon.color = Palette.Alpha(Color.white, 0.5f);
                var bb = b;
                Updaters.Add(() => r.Sub.text = done ? b.Text : "진행 " + NumberFormat.Percent(Sim.BucketProgress(bb)));
            }
        }

        void PromoRow(CloneState c)
        {
            int id = c.id;
            var up = Sim.Job(c.slot + 1);
            var r = Row(_content, Art.AptIcon(c.apt), Sim.CloneName(c) + " → " + up.Name, () =>
            {
                var cc = Sim.Clone(id);
                if (cc == null) return;
                var b = Sim.CheckPromotion(cc);
                if (b == PromoBlock.None) { Sim.Promote(id); Sfx.Play("buy"); }
                else G.Do(new SimAction { Kind = ActionKind.Promote, CloneId = id, Cost = up.PromoCost, Gain = 1, Label = "승진" });
            }, 150);
            Updaters.Add(() =>
            {
                var cc = Sim.Clone(id);
                if (cc == null || cc.slot + 1 > Sim.City.Slots) { r.Root.gameObject.SetActive(false); return; }
                double gain = Sim.IncomeAt(cc, cc.slot + 1, cc.level) - Sim.CloneIncome(cc);
                r.Sub.text = "Lv." + cc.level + " · 초당 +" + NumberFormat.Money(gain) + (cc.apt == up.Tier ? " · 적성 일치!" : "");
                r.SetButton("승진\n" + NumberFormat.Money(up.PromoCost), RowCard.State(Sim, up.PromoCost));
            });
        }

        void PromoteAll()
        {
            int n = 0;
            for (int guard = 0; guard < 60; guard++)
            {
                bool any = false;
                foreach (var c in Sim.PromotionQueue())
                    if (Sim.CheckPromotion(c) == PromoBlock.None && Sim.Promote(c.id)) { any = true; n++; break; }
                if (!any) break;
            }
            if (n > 0) Sfx.Play("buy"); else G.Deny("돈이 조금 모자라요");
        }
    }
}
