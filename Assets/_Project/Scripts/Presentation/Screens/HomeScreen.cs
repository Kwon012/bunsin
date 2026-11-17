using System.Collections.Generic;
using Bunsin.Sim;
using UnityEngine;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 홈(본체의 방). 화면 아무 데나 탭 = 본체가 일함, 거울 = 신입 분신 고용, 창문 = 마을.
    /// 본체의 자리(반지하 → 펜트하우스)는 집 단계에 따라 바뀐다.
    /// </summary>
    public sealed class HomeScreen : ScreenBase
    {
        public RectTransform HeroRt, MirrorRt;
        UImage _wall, _floor, _hero, _window, _fever, _feverFill, _truck;
        RectTransform _room, _crowd, _feverFillRt, _countdown;
        UText _mirrorLabel, _mirrorSub, _feverText, _recText, _countText, _houseName;
        UImage _nextApt, _recIcon;
        UButton _recBtn;
        Breathe _heroBreathe;
        float _workT, _cheerT, _slowT;
        int _shownHouse = -1;
        readonly List<RectTransform> _furniture = new List<RectTransform>();
        readonly List<RectTransform> _walkers = new List<RectTransform>();

        static readonly string[] WallHex = { "B9C3CF", "FFE3B8", "FFD6C2", "D8F0D2", "D6E8FF", "E8DDFF", "FFE7A8", "2E2A4F" };
        static readonly string[] FloorHex = { "8C8A93", "D2A77A", "C08A5C", "B98B5E", "A7764C", "8C6239", "7A4E2D", "3D3560" };

        protected override void Setup()
        {
            _room = Ui.Node("Room", Root);
            _room.Fill();
            _wall = Ui.Box(_room, Palette.Cream, "Wall");
            _wall.Rt().Span(0, 0.26f, 1, 1);
            _floor = Ui.Box(_room, Palette.Wood, "Floor");
            _floor.Rt().Span(0, 0, 1, 0.26f);
            var skirting = Ui.Box(_room, Palette.Alpha(Palette.Ink, 0.25f), "Skirting");
            skirting.Rt().anchorMin = new Vector2(0, 0.26f); skirting.Rt().anchorMax = new Vector2(1, 0.26f);
            skirting.Rt().sizeDelta = new Vector2(0, 10);

            // 탭 영역: 방 전체. 거울·창문·버튼은 위에 있어서 먼저 받는다
            var surface = Ui.Box(_room, new Color(1, 1, 1, 0), "TapSurface", true);
            surface.Rt().Fill();
            surface.gameObject.AddComponent<TapSurface>().OnTap = OnTap;

            // 창문(잠긴 구역 미리보기: 그 도시 꼭대기 건물이 보인다)
            var winBtn = Ui.HitArea(_room, () => { if (G.TabUnlocked(Game.TabVillage)) G.ShowTab(Game.TabVillage); else G.Popups.Toast("창밖으로 " + Sim.City.TopBuilding + "이(가) 보여요", "i_village"); }, "Window");
            winBtn.Rt().Place(0.68f, 0.86f, 420, 350, 0, 0, 0.5f, 1);
            _window = Ui.Image(winBtn.transform, "o_window", Color.white, "Img");
            _window.Rt().Fill();
            _truck = Ui.Image(winBtn.transform, "i_truck", Color.white, "Truck");
            _truck.Rt().Place(0.5f, 0.2f, 120, 120, 40, 0);
            _houseName = Ui.FitLabel(_room, "", 28, Palette.InkSoft, TextAnchor.MiddleLeft, "HouseName");
            _houseName.Rt().Place(0, 1, 520, 40, 30, -18, 0, 1);

            _crowd = Ui.Node("Crowd", _room);
            _crowd.Span(0, 0.08f, 1, 0.3f);

            // 거울 = 고용
            var mirrorBtn = Ui.HitArea(_room, OnMirror, "Mirror");
            MirrorRt = mirrorBtn.Rt();
            MirrorRt.Place(0.15f, 0.22f, 240, 380, 0, 0, 0.5f, 0);
            mirrorBtn.gameObject.AddComponent<PressFeel>().Button = mirrorBtn;
            var mirror = Ui.Image(MirrorRt, "o_mirror", Color.white, "Img");
            mirror.Rt().Fill(0, 40, 0, 0);
            var pill = Ui.Image(MirrorRt, "ui_pill", Palette.Yellow, "Cost");
            pill.Rt().Place(0.5f, 0, 260, 76, 0, -6, 0.5f, 0);
            _mirrorLabel = Ui.FitLabel(pill.transform, "", 30, Palette.Ink);
            _mirrorLabel.Rt().Fill(16, 4, 16, 4);
            _mirrorSub = Ui.FitLabel(MirrorRt, "", 24, Palette.Ink, TextAnchor.MiddleCenter, "Sub");
            _mirrorSub.Rt().Place(0.5f, 0, 300, 34, 0, -40, 0.5f, 0);
            _nextApt = Ui.Image(MirrorRt, "i_apt_alba", Color.white, "NextApt");
            _nextApt.Rt().Place(1, 1, 70, 70, 10, -6, 1, 1);

            // 본체
            var heroHolder = Ui.Node("HeroHolder", _room);
            heroHolder.Place(0.55f, 0.13f, 470, 564, 0, 0, 0.5f, 0);
            _hero = Ui.Image(heroHolder, "hero_idle", Color.white, "Hero");
            HeroRt = _hero.Rt();
            HeroRt.Fill();
            HeroRt.pivot = new Vector2(0.5f, 0);
            _heroBreathe = _hero.gameObject.AddComponent<Breathe>();
            var shadow = Ui.Image(heroHolder, "ui_shadow", Color.white, "Shadow");
            shadow.Rt().Place(0.5f, 0, 360, 70, 0, -26);
            shadow.Rt().SetAsFirstSibling();

            // 월급날 카운트다운(본체 머리 위, 화면을 가리지 않게)
            var cd = Ui.Image(heroHolder, "ui_bubble", Palette.White, "Countdown");
            _countdown = cd.Rt();
            _countdown.Place(0.5f, 1, 300, 150, 120, 10, 0.5f, 0);
            _countText = Ui.FitLabel(cd.transform, "", 44, Palette.Coral);
            _countText.Rt().Fill(20, 56, 20, 14);
            _countdown.gameObject.SetActive(false);

            // 피버 게이지
            var feverRoot = Ui.Node("Fever", Root);
            feverRoot.Bottom(64, 196, 40, 40);
            _fever = Ui.Image(feverRoot, "ui_pill_flat", Palette.Alpha(Palette.Ink, 0.25f), "Bg");
            _fever.Rt().Fill();
            var fm = Ui.Node("Mask", feverRoot); fm.Fill(6, 6, 6, 6);
            _feverFill = Ui.Image(fm, "ui_pill_flat", Palette.Coral, "Fill");
            _feverFillRt = _feverFill.Rt();
            _feverFillRt.anchorMin = Vector2.zero; _feverFillRt.anchorMax = new Vector2(0, 1); _feverFillRt.offsetMin = _feverFillRt.offsetMax = Vector2.zero;
            var meg = Ui.Image(feverRoot, "i_megaphone", Color.white, "Icon");
            meg.Rt().Place(0, 0.5f, 80, 80, -20, 0, 0, 0.5f);
            _feverText = Ui.FitLabel(feverRoot, "", 30, Palette.White, TextAnchor.MiddleCenter, "Text");
            _feverText.Rt().Fill(60, 0, 20, 0);
            _feverText.Outline(Palette.Ink, 2);

            // 추천 버튼(고민 0단계의 기본값)
            _recBtn = Ui.Button(Root, "", Palette.Yellow, OnRecommend, 38, "Recommend");
            _recBtn.Rt().Bottom(160, 20, 30, 30);
            _recIcon = Ui.Image(_recBtn.transform, "i_clone", Color.white, "Icon");
            _recIcon.Rt().Place(0, 0.5f, 100, 100, 26, 8, 0, 0.5f);
            _recText = Ui.ButtonLabel(_recBtn);
            _recText.Rt().Fill(140, 30, 30, 18);
            _recText.alignment = TextAnchor.MiddleLeft;
        }

        protected override string Signature()
        {
            int n = Mathf.Min(S.clones.Count, 8);
            return S.houseTier + ":" + n + ":" + S.city;
        }

        protected override void Build()
        {
            // 집 단계: 벽·바닥 색과 가구
            int tier = Mathf.Clamp(S.houseTier, 0, WallHex.Length - 1);
            if (_shownHouse != tier)
            {
                _shownHouse = tier;
                _wall.color = Palette.Hex(WallHex[tier]);
                _floor.color = Palette.Hex(FloorHex[tier]);
                Ui.SetSprite(_window, tier == 0 ? "o_window_low" : "o_window");
                _window.preserveAspect = true;
                foreach (var f in _furniture) Object.Destroy(f.gameObject);
                _furniture.Clear();
                AddFurniture(tier);
            }
            _houseName.text = Data.Houses[tier].Name + " · " + Data.Houses[tier].Desc;

            // 방 안을 어슬렁거리는 분신(최대 8명)
            foreach (var w in _walkers) Object.Destroy(w.gameObject);
            _walkers.Clear();
            int n = Mathf.Min(S.clones.Count, 8);
            for (int i = 0; i < n; i++)
            {
                var c = S.clones[S.clones.Count - 1 - i];
                int tierOf = c.slot > 0 ? Sim.Job(c.slot).Tier : -1;
                var img = Ui.Image(_crowd, Art.CloneSprite(tierOf), Color.white, "Walker");
                var rt = img.Rt();
                rt.Place(0.5f, 0, 130, 156, Random.Range(-380f, 380f), Random.Range(0f, 50f), 0.5f, 0);
                var w = img.gameObject.AddComponent<Walker>();
                w.MinX = -420; w.MaxX = 420; w.Speed = Random.Range(40f, 80f);
                _walkers.Add(rt);
            }
        }

        void AddFurniture(int tier)
        {
            // 출세할수록 방이 채워진다(본체의 자리)
            Add("o_box", 0.92f, 0.26f, 180, 150, tier == 0);
            Add("o_bed", 0.82f, 0.26f, 330, 165, tier >= 0 && tier < 3);
            Add("o_plant", 0.97f, 0.26f, 130, 200, tier >= 1);
            Add("o_desk", 0.85f, 0.26f, 300, 205, tier >= 2);
            Add("o_frame", 0.36f, 0.78f, 170, 145, tier >= 2);
            Add("o_lamp", 0.03f, 0.26f, 110, 270, tier >= 3);
            Add("o_sofa", 0.84f, 0.26f, 360, 190, tier >= 3);
            Add("o_tv", 0.35f, 0.58f, 230, 160, tier >= 4);
        }

        void Add(string sprite, float ax, float ay, float w, float h, bool show)
        {
            if (!show) return;
            var img = Ui.Image(_room, sprite, Color.white, sprite);
            var rt = img.Rt();
            rt.Place(ax, ay, w, h, 0, -8, 0.5f, 0);
            rt.SetSiblingIndex(3); // 벽·바닥 바로 위, 분신·본체 아래
            _furniture.Add(rt);
        }

        // ------------------------------------------------------------------ 매 프레임 갱신은 Refresh 대신 여기서(손맛이 중요한 화면)

        public void Tick(float dt)
        {
            if (!Root.gameObject.activeInHierarchy) return;
            // 본체 표정
            string pose = "hero_idle";
            if (Sim.InFever) pose = "hero_fever";
            else if (_cheerT > 0) pose = "hero_cheer";
            else if (_workT > 0) pose = "hero_work";
            else if (S.manager && S.sinceTap > 8) pose = "hero_rest";
            _cheerT -= dt; _workT -= dt;
            if (_hero.sprite == null || _hero.sprite.name != pose) { Ui.SetSprite(_hero, pose); _hero.preserveAspect = true; }

            // 거울(고용)
            bool first = S.nextCloneId == 1;
            double cost = Sim.HireCost();
            if (Sim.BenchCount > 0) { _mirrorLabel.text = "대기실 " + Sim.BenchCount + "명"; _mirrorSub.text = "빈자리에 자동 출근"; }
            else if (!Sim.HasVacancy(1)) { _mirrorLabel.text = "자리 없음"; _mirrorSub.text = "승진시키면 빈자리가 생겨요"; }
            else { _mirrorLabel.text = first ? "무료!" : NumberFormat.Money(cost); _mirrorSub.text = first ? "거울을 눌러 보세요" : "신입 분신 고용"; }
            _mirrorLabel.color = Sim.CanHireSeat && cost <= S.money ? Palette.Ink : Palette.InkSoft;
            Ui.SetSprite(_nextApt, Art.AptIcon(Sim.NextApt));

            // 창문 너머 이삿짐 트럭
            _truck.gameObject.SetActive(Sim.CanMove);

            // 피버 게이지
            float gauge = Sim.InFever ? (float)(S.feverLeft / Data.E("fever_duration_sec")) : (float)S.feverGauge;
            _feverFillRt.anchorMax = new Vector2(Mathf.Clamp01(gauge), 1);
            _feverFillRt.offsetMin = _feverFillRt.offsetMax = Vector2.zero;
            _feverFill.color = Sim.InFever ? Palette.Mix(Palette.Coral, Palette.Yellow, Mathf.PingPong(Time.unscaledTime * 3, 1)) : Palette.Coral;
            _feverText.text = Sim.InFever ? "피버! 전원 수입 ×3 · " + Mathf.CeilToInt((float)S.feverLeft) + "초" : "연타해서 응원 게이지를 채우세요";

            // 월급날 카운트다운
            bool cd = S.paydayTimer <= 10 && S.introDone && !Sim.HasPendingPayday;
            if (cd != _countdown.gameObject.activeSelf) { _countdown.gameObject.SetActive(cd); if (cd) Tweens.Appear(_countdown); }
            if (cd) _countText.text = "월급날 " + Mathf.CeilToInt((float)S.paydayTimer);

            // 추천 버튼(계산이 무거워 0.2초마다)
            _slowT -= dt;
            if (_slowT > 0) return;
            _slowT = 0.2f;
            var a = Sim.Recommend(false);
            if (!a.Valid)
            {
                if (Sim.CanMove) { _recText.text = "이삿짐 트럭 대기 중\n<size=28>다음 도시로 이사하기</size>"; Ui.SetSprite(_recIcon, "i_truck"); Ui.SetEnabledLook(_recBtn, true, Palette.Sky); }
                else { _recText.text = "분신들이 자라는 중\n<size=28>탭해서 돈을 벌어요</size>"; Ui.SetSprite(_recIcon, "i_level"); Ui.SetEnabledLook(_recBtn, false, Palette.Yellow); }
            }
            else
            {
                bool can = a.Cost <= S.money;
                string sub = can ? NumberFormat.Money(a.Cost) + "원 · 지금 가능" : NumberFormat.Money(a.Cost) + "원 · " + NumberFormat.Duration(Sim.SecondsUntil(a.Cost)) + " 뒤";
                _recText.text = "추천: " + a.Label + "\n<size=28>" + sub + "</size>";
                Ui.SetSprite(_recIcon, Game.ActionIcon(a.Kind));
                Ui.SetEnabledLook(_recBtn, can, Palette.Yellow);
            }
            _recIcon.preserveAspect = true;
        }

        // ------------------------------------------------------------------ 입력

        void OnTap(Vector2 screen, bool hold)
        {
            if (!S.introDone) return;
            double v = Sim.Tap(hold);
            _workT = 0.15f;
            var local = G.Fx.ToLocal(screen);
            if (!hold || Random.value < 0.4f)
            {
                G.Fx.Ring(local, Sim.InFever ? Palette.Coral : Palette.Yellow, hold ? 140 : 220);
                int size = Mathf.Clamp(36 + (int)(NumberFormat.UnitIndex(v) * 2), 36, 52);
                G.Fx.FloatText(local + new Vector2(0, 40), "+" + NumberFormat.Money(v), Palette.Yellow, size);
            }
            Sfx.Play("tap", 0.5f, 0.08f, 0.02f);
            Tweens.Pop(HeroRt.parent, 1f, 0.12f, 0.94f);
            if (S.combo % 10 == 0 && S.combo > 0)
            {
                G.Fx.Sparkle(G.Fx.LocalOf(HeroRt) + new Vector2(0, 220), Palette.Yellow, 8, 160);
                G.Fx.CoinFly(local, G.Fx.LocalOf(G.MoneyTarget), 3);
                Sfx.Play("coin", 0.6f, 0.05f);
            }
        }

        void OnMirror()
        {
            if (!S.introDone) return;
            if (Sim.BenchCount > 0) { G.Popups.Toast("대기실 분신이 빈자리에 먼저 들어가요", "i_clone"); return; }
            if (!Sim.HasVacancy(1))
            {
                G.Deny("첫 일터 5칸이 꽉 찼어요. 승진시키면 자리가 비어요");
                return;
            }
            double cost = Sim.HireCost();
            if (cost > S.money) { G.Deny(NumberFormat.Duration(Sim.SecondsUntil(cost)) + " 뒤에 고용할 수 있어요"); Tweens.Shake(MirrorRt); return; }
            Sim.Hire();
        }

        void OnRecommend()
        {
            var a = Sim.Recommend(false);
            if (!a.Valid)
            {
                if (Sim.CanMove) GamePopups.Move(G);
                return;
            }
            G.Do(a);
        }

        // ------------------------------------------------------------------ 연출 훅

        public void OnHired(int id)
        {
            Tweens.Pop(MirrorRt, 1f, 0.25f, 1.12f);
            if (!Root.gameObject.activeInHierarchy) return;
            // 거울에서 뿅: 튀어나와 바닥에 떨어진 뒤 걸어간다
            var c = Sim.Clone(id);
            var img = Ui.Image(_room, Art.CloneSprite(c != null && c.slot > 0 ? Sim.Job(c.slot).Tier : -1, true), Color.white, "NewClone");
            var rt = img.Rt();
            var from = G.Fx.LocalOf(MirrorRt);
            rt.SetParent(G.FxLayer, false);
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0);
            rt.sizeDelta = new Vector2(150, 180);
            Vector2 start = from + new Vector2(0, 40);
            Vector2 land = from + new Vector2(170, -170);
            G.Fx.Sparkle(start + new Vector2(0, 80), Palette.Sky, 8, 120);
            Tweens.To(0.45f, k =>
            {
                Vector2 p = Vector2.Lerp(start, land, k);
                p.y += Mathf.Sin(k * Mathf.PI) * 200;
                rt.anchoredPosition = p;
                rt.localScale = Vector3.one * Mathf.Lerp(0.3f, 1f, Mathf.Min(1, k * 2));
            }, Ease.Linear, () =>
            {
                Tweens.To(0.12f, k => rt.localScale = new Vector3(1 + 0.2f * (1 - k), 1 - 0.2f * (1 - k), 1), Ease.OutCubic, null, rt);
                Tweens.Move(rt, land, land + new Vector2(260, -40), 0.9f, Ease.InOut, () => Object.Destroy(rt.gameObject), 0.25f);
            }, rt);
            Invalidate();
        }

        public void Cheer(float seconds) { _cheerT = seconds; }

        public void PaydayCountdown() { Tweens.Appear(_countdown); }
    }
}
