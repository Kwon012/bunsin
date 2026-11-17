using System.Collections.Generic;
using System.Text;
using Bunsin.Sim;
using UnityEngine;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 언덕 마을. 아래(첫 일터)에서 위(꼭대기 직종)로 올라가는 세로 마을이 곧 출세 사다리다.
    /// 일터마다 자리 5칸. 분신을 누르면 훈련·승진, 건물을 누르면 시설·자격증·주식.
    /// 잠긴 것은 숨기고, 다음에 열릴 일터 하나만 실루엣으로 보여 준다.
    /// </summary>
    public sealed class VillageScreen : ScreenBase
    {
        UnityEngine.UI.ScrollRect _scroll;
        RectTransform _content;
        UText _news, _cityName, _scenes;
        readonly List<CloneChip> _chips = new List<CloneChip>();
        readonly StringBuilder _sb = new StringBuilder();
        bool _scrollToBottom;

        protected override void Setup()
        {
            var sky = Ui.Image(Root, "ui_grad_v", Palette.Hex("CFEFFF"), "Sky");
            sky.Rt().Fill();
            var hillBack = Ui.Image(Root, "ui_hill", Palette.Mix(Palette.Mint, Palette.White, 0.4f), "HillBack");
            hillBack.Rt().Span(-0.2f, 0, 1.2f, 0.55f);
            var hill = Ui.Image(Root, "ui_hill", Palette.Mint, "Hill");
            hill.Rt().Span(-0.1f, 0, 1.1f, 0.35f);
            hill.Rt().localScale = new Vector3(-1, 1, 1);

            // 마을 뉴스 한 줄 + 도시 이름 + 숨은 장면 카운터
            var top = Ui.Image(Root, "ui_card", Palette.White, "NewsCard");
            top.Rt().Top(130, 6, 20, 20);
            var ni = Ui.Image(top.transform, "i_news", Color.white, "Icon");
            ni.Rt().Place(0, 0.5f, 70, 70, 20, 4, 0, 0.5f);
            _cityName = Ui.FitLabel(top.transform, "", 28, Palette.InkSoft, TextAnchor.MiddleLeft, "City");
            _cityName.Rt().Fill(104, 64, 260, 12);
            _news = Ui.FitLabel(top.transform, "", 32, Palette.Ink, TextAnchor.MiddleLeft, "News");
            _news.Rt().Fill(104, 18, 24, 56);
            _scenes = Ui.FitLabel(top.transform, "", 26, Palette.InkSoft, TextAnchor.MiddleRight, "Scenes");
            _scenes.Rt().Place(1, 1, 260, 40, -24, -12, 1, 1);
            var newsBtn = top.gameObject.AddComponent<UButton>();
            top.raycastTarget = true;
            newsBtn.onClick.AddListener(() => G.Popups.Toast("뉴스를 탭하면 공유 카드가 만들어져요(출시 전 추가 예정)", "i_news"));

            var holder = Ui.Node("ScrollHolder", Root);
            holder.Fill(0, 0, 0, 146);
            _scroll = Ui.Scroll(holder, out _content, 22, 24, 20, 30);
            _scroll.Rt().Fill();
        }

        protected override string Signature()
        {
            _sb.Length = 0;
            _sb.Append(S.city).Append('|').Append(Sim.Has(Layer.Move) ? 1 : 0).Append(Sim.Has(Layer.Property) ? 1 : 0).Append('|');
            for (int i = 0; i < S.workplaces.Count; i++) _sb.Append(S.workplaces[i].open ? '1' : '0');
            _sb.Append('|').Append(S.clones.Count).Append('|').Append(S.properties.Count).Append('|').Append(S.scenes.Count);
            return _sb.ToString();
        }

        public override void OnShow()
        {
            _scrollToBottom = true;
            base.OnShow();
        }

        protected override void Build()
        {
            Ui.Clear(_content);
            _chips.Clear();
            var city = Sim.City;

            // 맨 위: 이삿짐 트럭(이사가 열렸을 때) 또는 꼭대기 건물 실루엣
            BuildTruck(city);

            // 다음에 열릴 일터 하나만 실루엣
            int highestOpen = 1;
            for (int s = 1; s <= city.Slots; s++) if (Sim.Workplace(s).open) highestOpen = s;
            if (highestOpen < city.Slots) BuildLocked(highestOpen + 1);

            int sceneIdx = 0;
            for (int s = highestOpen; s >= 1; s--)
            {
                BuildWorkplace(s);
                // 일터 사이사이 숨은 장면(구경하면 발견)
                if (sceneIdx < Data.Scenes.Count && s % 1 == 0) BuildScene(Data.Scenes[sceneIdx++]);
            }
            while (sceneIdx < Data.Scenes.Count && sceneIdx < 6) BuildScene(Data.Scenes[sceneIdx++]);

            if (Sim.Has(Layer.Property)) BuildPlots(city);
            Spacer(_content, 20);

            Updaters.Add(() =>
            {
                _cityName.text = city.Name + " · " + city.Theme;
                _news.text = string.IsNullOrEmpty(S.newsText) ? Sim.FillTemplate(Data.News.Count > 0 ? Data.News[0] : "") : S.newsText;
                _scenes.text = "숨은 장면 " + Sim.ScenesFoundHere + "/" + Data.Scenes.Count;
                if (_scrollToBottom) { _scrollToBottom = false; Canvas.ForceUpdateCanvases(); _scroll.verticalNormalizedPosition = 0; }
            });
        }

        void BuildTruck(CityData city)
        {
            if (Sim.Has(Layer.Move) && !Sim.IsLastCity)
            {
                var next = Data.City(S.city + 1);
                var r = Row(_content, "i_truck", "이삿짐 트럭: " + next.Name + "(으)로", () => GamePopups.Move(G), 190);
                r.Root.GetComponent<UImage>().color = Palette.Mix(Palette.Sky, Palette.White, 0.6f);
                Tweens.Pop(r.Icon.Rt(), 1f, 0.5f, 1.3f);
                Updaters.Add(() =>
                {
                    r.Sub.text = "명성 +" + Sim.FameGainPreview() + " · 분신 전원 동행" + (Sim.MoveRecommended ? " · <color=#2BB673>지금 추천!</color>" : "");
                    r.SetButton("이사\n살펴보기", Sim.MoveRecommended ? 0 : 1);
                });
            }
            else if (Sim.IsLastCity && Sim.Has(Layer.Move))
            {
                var r = Row(_content, "i_trophy", "마지막 도시", null, 150);
                r.Sub.text = "다음 도시는 업데이트로 찾아옵니다";
            }
            else
            {
                var r = Row(_content, "i_lock", "꼭대기: " + city.TopBuilding, null, 150);
                r.Root.GetComponent<UImage>().color = Palette.Alpha(Palette.White, 0.7f);
                r.Sub.text = "꼭대기 자리에 처음 오르면 이사가 열려요";
            }
        }

        void BuildLocked(int slot)
        {
            var job = Sim.Job(slot);
            var card = Ui.Card(_content, 200, Palette.Alpha(Palette.White, 0.6f), "Locked" + slot);
            var b = Ui.Image(card, job.Sprite, Palette.Alpha(Palette.Ink, 0.35f), "Building");
            b.Rt().Place(0, 0.5f, 210, 180, 20, 6, 0, 0.5f);
            var t = Ui.FitLabel(card, "다음 일터: " + job.Name, 36, Palette.InkSoft, TextAnchor.MiddleLeft);
            t.Rt().Fill(250, 100, 24, 20);
            var lock2 = Ui.Image(card, "i_lock", Color.white, "Lock");
            lock2.Rt().Place(0, 0.5f, 64, 64, 90, 10, 0, 0.5f);
            var sub = Ui.Label(card, Sim.Job(slot - 1).Name + " 5칸이 차면 개업", 28, Palette.InkSoft, TextAnchor.UpperLeft);
            sub.Rt().Fill(250, 20, 24, 104);
        }

        void BuildWorkplace(int slot)
        {
            var job = Sim.Job(slot);
            var wp = Sim.Workplace(slot);
            Color tierColor = Palette.Tier[job.Tier];
            var card = Ui.Card(_content, 360, Palette.White, "Workplace" + slot);

            // 직종 이름 띠(직종 색 = 적성 색)
            var band = Ui.Image(card, "ui_pill_flat", Palette.Mix(tierColor, Palette.White, 0.35f), "Band");
            band.Rt().Top(64, 16, 18, 18);
            var name = Ui.FitLabel(band.transform, slot + "칸 · " + job.Name + (job.IsTop ? " ★" : ""), 34, Palette.Ink, TextAnchor.MiddleLeft, "Name");
            name.Rt().Fill(24, 0, 300, 0);
            var inc = Ui.FitLabel(band.transform, "", 28, Palette.Ink, TextAnchor.MiddleRight, "Income");
            inc.Rt().Fill(300, 0, 22, 0);

            // 건물(누르면 일터 카드)
            var bBtn = Ui.HitArea(card, () => GamePopups.Workplace(G, slot), "Building");
            bBtn.Rt().Place(0, 0, 230, 230, 14, 30, 0, 0);
            bBtn.gameObject.AddComponent<PressFeel>().Button = bBtn;
            var bImg = Ui.Image(bBtn.transform, job.Sprite, Color.white, "Img");
            bImg.Rt().Fill();
            var fac = Ui.Image(bBtn.transform, "ui_pill_flat", Palette.Ink, "Facility");
            fac.Rt().Place(0.5f, 0, 170, 44, 0, -18, 0.5f, 0);
            var facT = Ui.FitLabel(fac.transform, "", 26, Palette.White);
            facT.Rt().Fill(8, 2, 8, 2);
            var listed = Ui.Image(bBtn.transform, "i_stock", Color.white, "Listed");
            listed.Rt().Place(1, 1, 60, 60, 4, 4, 1, 1);

            // 자리 5칸
            var seats = Ui.Node("Seats", card);
            seats.Fill(254, 64, 14, 90);
            var h = Ui.HStack(seats, 8, 0, TextAnchor.MiddleLeft);
            h.childForceExpandWidth = true; h.childForceExpandHeight = true;
            var seatChips = new CloneChip[Data.SeatsPerJob];
            var empties = new GameObject[Data.SeatsPerJob];
            for (int seat = 0; seat < Data.SeatsPerJob; seat++)
            {
                var cell = Ui.Node("Seat" + seat, seats);
                cell.Size(-1, -1, 1, 1);
                int seatIdx = seat;
                var empty = Ui.HitArea(cell, () => OnEmptySeat(slot), "Empty");
                empty.Rt().Fill(2, 40, 2, 4);
                var plus = Ui.Image(empty.transform, "i_plus", Palette.Alpha(Color.white, 0.8f), "Plus");
                plus.Rt().Fill(8, 8, 8, 8);
                empties[seat] = empty.gameObject;
                var chip = CloneChip.Create(cell, 140, 180, id => GamePopups.CloneCard(G, id));
                chip.Root.Fill();
                seatChips[seat] = chip;
                _chips.Add(chip);
            }

            // 상태 한 줄(벽에는 이유가 한 줄로 보인다)
            var status = Ui.FitLabel(card, "", 28, Palette.InkSoft, TextAnchor.MiddleLeft, "Status");
            status.Rt().Bottom(52, 24, 254, 20);

            Updaters.Add(() =>
            {
                inc.text = "초당 " + NumberFormat.Money(Sim.WorkplaceIncome(slot)) + (S.seasonLeft > 0 && job.Tier == Tier.Alba ? " ×2" : "");
                facT.text = "시설 " + wp.facility + "단계";
                fac.gameObject.SetActive(Sim.Has(Layer.Facility));
                listed.gameObject.SetActive(Sim.Has(Layer.Stock) && Sim.IsListed(slot));
                for (int seat = 0; seat < seatChips.Length; seat++)
                {
                    var c = Sim.SeatedAt(slot, seat);
                    seatChips[seat].Set(Sim, c);
                    empties[seat].SetActive(c == null);
                }
                status.text = StatusLine(slot);
            });
        }

        string StatusLine(int slot)
        {
            int n = Sim.CountAt(slot);
            if (n == 0) return slot == 1 ? "거울에서 신입을 뽑아 채워요" : "아래에서 승진하면 채워져요";
            // 이 일터에서 승진을 기다리는 가장 높은 레벨 분신의 사정
            CloneState best = null;
            foreach (var c in S.clones)
                if (c.slot == slot && (best == null || c.level > best.level)) best = c;
            if (best == null) return "";
            string text = Sim.CloneName(best) + ": " + Sim.PromoBlockText(best);
            var b = Sim.CheckPromotion(best);
            if (b == PromoBlock.None) return "<color=#2BB673>" + text + "</color>";
            if (b == PromoBlock.Level)
            {
                double left = 0;
                int lv = best.level;
                left += Sim.XpNeed(lv) - best.xp;
                for (int l = lv + 1; l < Sim.PromoLevel(slot); l++) left += Sim.XpNeed(l);
                text += " · 약 " + NumberFormat.Duration(left / Mathf.Max(0.01f, (float)Sim.XpRate(best)));
            }
            return text;
        }

        void OnEmptySeat(int slot)
        {
            if (slot == 1) { G.ShowTab(Game.TabHome); G.Popups.Toast("거울을 눌러 신입을 뽑아요", "i_clone"); }
            else G.Popups.Toast("아랫자리 분신이 승진하면 이 자리가 채워져요", "i_up");
        }

        void BuildScene(SceneData sc)
        {
            string key = S.city + ":" + sc.Id;
            bool found = S.scenes.Contains(key);
            var holder = Ui.Node("Scene_" + sc.Id, _content);
            holder.Size(-1, 110);
            string sprite = SceneSprite(sc.Id);
            var btn = Ui.HitArea(holder, () =>
            {
                if (Sim.FindScene(sc.Id)) Invalidate();
                else G.Popups.Toast(sc.Name + ": " + sc.Text, "i_camera");
            }, "Hotspot");
            float x = (sc.Id.GetHashCode() & 0xff) / 255f * 600 - 300;
            btn.Rt().Place(0.5f, 0.5f, 110, 100, x, 0);
            var img = Ui.Image(btn.transform, sprite, found ? Color.white : Palette.Alpha(Palette.Ink, 0.22f), "Img");
            img.Rt().Fill();
            if (found)
            {
                var t = Ui.FitLabel(holder, sc.Name, 26, Palette.InkSoft, TextAnchor.MiddleLeft);
                t.Rt().Place(0.5f, 0.5f, 300, 40, x + 70, 0, 0, 0.5f);
            }
        }

        static string SceneSprite(string id)
        {
            switch (id)
            {
                case "sc_cat": return "o_cat";
                case "sc_love": return "i_heart";
                case "sc_nap": return "head_work";
                case "sc_band": return "i_megaphone";
                case "sc_lost": return "head";
                case "sc_selfie": return "i_camera";
            }
            return "i_camera";
        }

        void BuildPlots(CityData city)
        {
            Section(_content, "내 건물 · 부지 " + Sim.PlotsUsed + "/" + city.Plots, "i_building");
            var grid = Ui.Node("Plots", _content);
            int rows = Mathf.CeilToInt(city.Plots / 4f);
            grid.Size(-1, rows * 236);
            var g = grid.gameObject.AddComponent<UnityEngine.UI.GridLayoutGroup>();
            g.cellSize = new Vector2(236, 226);
            g.spacing = new Vector2(10, 10);
            g.childAlignment = TextAnchor.UpperCenter;
            for (int p = 0; p < city.Plots; p++)
            {
                PropertyState owned = null;
                foreach (var ps in S.properties) if (ps.city == S.city && ps.plot == p) owned = ps;
                var cell = Ui.HitArea(grid, () => G.ShowTab(Game.TabAssets), "Plot" + p);
                cell.gameObject.AddComponent<PressFeel>().Button = cell;
                string sprite = owned != null ? Data.PropertiesById[owned.id].Sprite : "plot_empty";
                var img = Ui.Image(cell.transform, sprite, Color.white, "Img");
                img.Rt().Fill(6, 40, 6, 0);
                var t = Ui.FitLabel(cell.transform, owned != null ? Data.PropertiesById[owned.id].Name : "빈 부지", 24, Palette.Ink);
                t.Rt().Bottom(38, 0);
            }
        }

        /// <summary>튜토리얼용: 승진 가능한 첫 분신 칩.</summary>
        public RectTransform FirstPromotableChip()
        {
            foreach (var chip in _chips)
            {
                if (chip.CloneId == 0 || !chip.Root.gameObject.activeInHierarchy) continue;
                var c = Sim.Clone(chip.CloneId);
                if (c != null && Sim.CheckPromotion(c) == PromoBlock.None) return chip.Root;
            }
            return null;
        }
    }
}
