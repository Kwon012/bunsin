using System;
using System.Collections.Generic;
using Bunsin.Sim;
using UnityEngine;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    // 상단 바(순자산·월 수입·월급날) · 목표 바 · 하단 탭 · 사건 말풍선 · 손가락 가이드 · '순간' 배너
    public sealed partial class Game
    {
        RectTransform _hudRoot, _tabRoot, _bubbleRoot, _goalFill, _paydayFill, _netIcon;
        CountUpText _netWorth;
        UText _monthly, _status, _paydayText, _goalText, _goalSub, _cash, _managerLine;
        UImage _goalIcon, _statusIcon, _bubbleHead;
        UButton _goalBtn;
        float _managerLineT;
        readonly List<UImage> _tabBg = new List<UImage>();
        readonly List<UImage> _tabDot = new List<UImage>();
        readonly List<RectTransform> _tabBtn = new List<RectTransform>();
        Finger _finger;

        static readonly string[] TabNames = { "홈", "마을", "분신", "자산", "상점" };
        static readonly string[] TabIcons = { "i_home", "i_village", "i_clone", "i_asset", "i_shop" };

        public RectTransform MoneyTarget { get { return _netIcon; } }

        // ------------------------------------------------------------------ 상단 바

        void BuildHud()
        {
            _hudRoot = Ui.Node("Hud", Safe);
            _hudRoot.Top(Layout.HudH + Layout.GoalH + 24, 0);

            var panel = Ui.Image(_hudRoot, "ui_card", Palette.White, "Panel");
            panel.Rt().Top(Layout.HudH, 12, 20, 20);

            // 신분 칩 + 설정
            var chip = Ui.Image(panel.transform, "ui_pill_flat", Palette.Cream, "Status");
            chip.Rt().Place(0, 1, 420, 56, 26, -18, 0, 1);
            _statusIcon = Ui.Image(chip.transform, "i_house", Color.white, "Icon");
            _statusIcon.Rt().Place(0, 0.5f, 46, 46, 10, 0, 0, 0.5f);
            _status = Ui.FitLabel(chip.transform, "", 30, Palette.Ink, TextAnchor.MiddleLeft);
            _status.Rt().Fill(64, 2, 14, 2);
            var statusBtn = chip.gameObject.AddComponent<UButton>();
            chip.raycastTarget = true;
            statusBtn.onClick.AddListener(() => { if (TabUnlocked(TabAssets)) ShowTab(TabAssets); else GamePopups.StatusInfo(this); });

            var gear = Ui.Button(panel.transform, null, Palette.Cream, () => GamePopups.Settings(this), 30, "Settings");
            gear.Rt().Place(1, 1, 84, 88, -18, -12, 1, 1);
            var gi = Ui.Image(gear.transform, "i_gear", Color.white, "Icon");
            gi.Rt().Fill(14, 22, 14, 10);

            // 순자산(대표 숫자)
            _netIcon = Ui.Image(panel.transform, "i_networth", Color.white, "NetIcon").Rt();
            _netIcon.Place(0, 0, 84, 84, 26, 26, 0, 0);
            var cap = Ui.Label(panel.transform, "순자산", 26, Palette.InkSoft, TextAnchor.LowerLeft, "NetCaption");
            cap.Rt().Place(0, 0, 200, 34, 120, 98, 0, 0);
            var net = Ui.FitLabel(panel.transform, "0", 66, Palette.Ink, TextAnchor.MiddleLeft, "NetWorth");
            net.Rt().Place(0, 0, 470, 80, 118, 20, 0, 0);
            _netWorth = new CountUpText(net, v => NumberFormat.Money(v) + "원");

            // 월 수입 + 월급날
            var right = Ui.Node("Right", panel.transform);
            right.Place(1, 0, 420, 150, -22, 20, 1, 0);
            var mcap = Ui.Label(right, "월 수입", 26, Palette.InkSoft, TextAnchor.MiddleRight, "MonthlyCaption");
            mcap.Rt().Top(34, 0);
            _monthly = Ui.FitLabel(right, "", 40, Palette.Green, TextAnchor.MiddleRight, "Monthly");
            _monthly.Rt().Top(52, 32);
            var pay = Ui.Node("Payday", right);
            pay.Bottom(54, 0);
            var envelope = Ui.Image(pay, "i_payday", Color.white, "Icon");
            envelope.Rt().Place(0, 0.5f, 54, 54, 0, 0, 0, 0.5f);
            var bar = Ui.Bar(pay, Palette.Cream, Palette.Coral, out _paydayFill, "Bar");
            bar.Fill(62, 8, 0, 8);
            _paydayText = Ui.FitLabel(bar, "", 28, Palette.Ink);
            _paydayText.Rt().Fill(10, 0, 10, 0);

            // 목표 바: 목표는 하나만, 남은 시간과 함께
            var goal = Ui.Image(_hudRoot, "ui_btn", Palette.White, "Goal", true);
            goal.Rt().Top(Layout.GoalH, Layout.HudH + 22, 20, 20);
            _goalBtn = goal.gameObject.AddComponent<UButton>();
            _goalBtn.transition = UnityEngine.UI.Selectable.Transition.None;
            goal.gameObject.AddComponent<PressFeel>().Button = _goalBtn;
            _goalBtn.onClick.AddListener(OnGoalTap);
            var mask = Ui.Node("FillMask", goal.transform);
            mask.Fill(8, 18, 8, 8);
            var fill = Ui.Image(mask, "ui_pill_flat", Palette.Alpha(Palette.Yellow, 0.35f), "Fill");
            _goalFill = fill.Rt();
            _goalFill.anchorMin = Vector2.zero; _goalFill.anchorMax = new Vector2(0, 1);
            _goalFill.offsetMin = _goalFill.offsetMax = Vector2.zero;
            _goalIcon = Ui.Image(goal.transform, "i_level", Color.white, "Icon");
            _goalIcon.Rt().Place(0, 0.5f, 64, 64, 22, 5, 0, 0.5f);
            _goalText = Ui.FitLabel(goal.transform, "", 34, Palette.Ink, TextAnchor.MiddleLeft, "Text");
            _goalText.Rt().Fill(100, 46, 300, 12);
            _goalSub = Ui.FitLabel(goal.transform, "", 26, Palette.InkSoft, TextAnchor.MiddleLeft, "Sub");
            _goalSub.Rt().Fill(100, 16, 300, 54);
            _cash = Ui.FitLabel(goal.transform, "", 30, Palette.Ink, TextAnchor.MiddleRight, "Cash");
            _cash.Rt().Place(1, 0.5f, 280, 70, -28, 5, 1, 0.5f);

            _managerLine = Ui.FitLabel(_hudRoot, "", 24, Palette.InkSoft, TextAnchor.MiddleCenter, "Manager");
            _managerLine.Rt().Place(0.5f, 0, 900, 30, 0, -30, 0.5f, 0);
        }

        SimAction _goalAction;

        float _hudSlowT;

        void UpdateHud(float dt)
        {
            if (_managerLineT > 0)
            {
                _managerLineT -= dt;
                _managerLine.color = Palette.Alpha(Palette.InkSoft, Mathf.Clamp01(_managerLineT));
            }
            _netWorth.Set(Sim.NetWorth(), dt);
            _monthly.text = NumberFormat.Money(Sim.MonthlyIncome()) + "원" + (Sim.InFever ? "  <color=#FF6B5E>피버×3</color>" : S.boostLeft > 0 ? "  <color=#A78BFA>부스트×2</color>" : "");
            _status.text = Data.Status[S.status].Name;
            Ui.SetBar(_paydayFill, (float)Sim.PaydayProgress);
            _paydayText.text = Sim.HasPendingPayday ? "월급 받기!" : "월급날 " + NumberFormat.Clock(S.paydayTimer);
            _cash.text = "현금\n" + NumberFormat.Money(S.money);
            _cash.lineSpacing = 0.9f;

            _hudSlowT -= dt;
            if (_hudSlowT > 0) return;
            _hudSlowT = 0.2f;
            var g = Sim.Goal();
            _goalAction = g.Action;
            _goalText.text = g.Text;
            _goalSub.text = g.Sub;
            float p = (float)g.Progress;
            _goalFill.anchorMax = new Vector2(Mathf.Clamp01(p), 1);
            _goalFill.offsetMin = _goalFill.offsetMax = Vector2.zero;
            Ui.SetSprite(_goalIcon, ActionIcon(g.Action.Kind));
            _goalIcon.preserveAspect = true;

        }

        void OnGoalTap()
        {
            var a = _goalAction;
            if (!a.Valid)
            {
                if (TabUnlocked(TabVillage)) ShowTab(TabVillage);
                return;
            }
            switch (a.Kind)
            {
                case ActionKind.Move: GamePopups.Move(this); return;
                case ActionKind.House:
                    if (TabUnlocked(TabAssets)) { ShowTab(TabAssets); return; }
                    break;
            }
            if (a.Kind == ActionKind.Hire && CurrentTab != TabHome && S.clones.Count > 0) { ShowTab(TabHome); return; }
            Do(a, null);
        }

        public static string ActionIcon(ActionKind k)
        {
            switch (k)
            {
                case ActionKind.Hire: return "i_clone";
                case ActionKind.Train: return "i_train";
                case ActionKind.Promote: return "i_up";
                case ActionKind.Cert: return "i_cert";
                case ActionKind.Facility: return "i_facility";
                case ActionKind.Stock: return "i_stock";
                case ActionKind.Property: return "i_building";
                case ActionKind.Remodel: return "i_building";
                case ActionKind.House: return "i_house";
                case ActionKind.Luxury: return "i_luxury";
                case ActionKind.Trophy: return "i_trophy";
                case ActionKind.Move: return "i_truck";
            }
            return "i_level";
        }

        public void ManagerSays(string text)
        {
            _managerLine.text = "매니저: " + text;
            _managerLineT = 2.5f;
        }

        // ------------------------------------------------------------------ 하단 탭

        void BuildTabBar()
        {
            _tabRoot = Ui.Node("TabBar", Safe);
            _tabRoot.Bottom(Layout.TabBarH, 0);
            var bg = Ui.Image(_tabRoot, "ui_card", Palette.White, "Bg");
            bg.Rt().Fill(12, 10, 12, 0);
            var row = Ui.Node("Row", bg.transform);
            row.Fill(12, 18, 12, 10);
            var h = Ui.HStack(row, 6);
            h.childForceExpandWidth = true; h.childForceExpandHeight = true;
            _tabBg.Clear(); _tabDot.Clear(); _tabBtn.Clear();
            for (int i = 0; i < TabNames.Length; i++)
            {
                int tab = i;
                var btn = Ui.HitArea(row, () => ShowTab(tab), "Tab" + i);
                btn.Size(-1, -1, 1, 1);
                btn.gameObject.AddComponent<PressFeel>().Button = btn;
                var sel = Ui.Image(btn.transform, "ui_pill_flat", Palette.Yellow, "Selected");
                sel.Rt().Fill(4, 4, 4, 4);
                var ic = Ui.Image(btn.transform, TabIcons[i], Color.white, "Icon");
                ic.Rt().Place(0.5f, 1, 84, 84, 0, -6, 0.5f, 1);
                var t = Ui.FitLabel(btn.transform, TabNames[i], 28, Palette.Ink, TextAnchor.MiddleCenter, "Name");
                t.Rt().Bottom(38, 4);
                var dot = Ui.Image(btn.transform, "ui_circle", Palette.Coral, "Dot");
                dot.Rt().Place(0.5f, 1, 30, 30, 40, -4, 0.5f, 1);
                _tabBg.Add(sel); _tabDot.Add(dot); _tabBtn.Add(btn.Rt());
            }
            RefreshTabs();
        }

        public RectTransform TabButton(int tab) { return tab >= 0 && tab < _tabBtn.Count ? _tabBtn[tab] : null; }

        void RefreshTabs()
        {
            if (_tabBg.Count == 0 || Sim == null) return;
            // 알림 점은 화면에 하나만: 지금 가장 중요한 행동
            int dot = -1;
            if (Sim.PromotionQueue().Count > 0 && CurrentTab != TabVillage && CurrentTab != TabClones) dot = TabVillage;
            else if (Sim.CanMove && CurrentTab != TabVillage) dot = TabVillage;
            for (int i = 0; i < _tabBg.Count; i++)
            {
                bool unlocked = TabUnlocked(i);
                _tabBtn[i].gameObject.SetActive(unlocked);
                _tabBg[i].enabled = i == CurrentTab;
                _tabDot[i].gameObject.SetActive(i == dot);
            }
        }

        // ------------------------------------------------------------------ 사건 말풍선

        bool _bubbleShown;

        void BuildBubble()
        {
            var btn = Ui.HitArea(BubbleLayer, OpenEvent, "EventBubble");
            _bubbleRoot = btn.Rt();
            _bubbleRoot.Place(1, 0, 190, 210, -24, Layout.TabBarH + 210, 1, 0);
            btn.gameObject.AddComponent<PressFeel>().Button = btn;
            var b = Ui.Image(_bubbleRoot, "ui_bubble", Palette.White, "Bubble");
            b.Rt().Fill();
            _bubbleHead = Ui.Image(b.transform, "head", Color.white, "Head");
            _bubbleHead.Rt().Fill(30, 70, 30, 18);
            var ex = Ui.Image(_bubbleRoot, "i_alert", Color.white, "Alert");
            ex.Rt().Place(0, 1, 70, 70, -10, 10, 0, 1);
            _bubbleRoot.gameObject.SetActive(false);
            _bubbleShown = false;
        }

        void UpdateBubble()
        {
            bool want = Sim.ActiveEvent != null && S.introDone && !Popups.Showing;
            if (want == _bubbleShown) return;
            _bubbleShown = want;
            _bubbleRoot.gameObject.SetActive(want);
            if (want)
            {
                Tweens.Appear(_bubbleRoot, 0.3f);
                var c = Sim.Clone(S.eventClone);
                Ui.SetSprite(_bubbleHead, "head");
                _bubbleHead.color = Color.white;
                if (c != null) _bubbleRoot.GetComponentInChildren<UImage>().color = Palette.Mix(Palette.Tier[c.apt], Palette.White, 0.6f);
            }
        }

        void OpenEvent()
        {
            var e = Sim.ActiveEvent;
            if (e == null) return;
            S.eventLeft = 9999; // 카드를 읽는 동안에는 사라지지 않게
            GamePopups.EventCard(this, e);
        }

        // ------------------------------------------------------------------ 손가락 가이드(튜토리얼)

        void BuildTutorial()
        {
            _finger = Finger.Create(TutorialLayer);
        }

        void UpdateTutorial()
        {
            if (!S.introDone || Popups.Showing || S.tutorialStep >= 4) { if (_finger.gameObject.activeSelf) _finger.Hide(); return; }
            var home = GetScreen<HomeScreen>();
            // 단계 완료 판정
            switch (S.tutorialStep)
            {
                case 0: if (S.stats.taps >= 5) S.tutorialStep = 1; break;
                case 1: if (S.clones.Count >= 1) S.tutorialStep = 2; break;
                case 2: if (Sim.Has(Layer.Village)) S.tutorialStep = 3; break;
                case 3: if (S.stats.promotions >= 1) S.tutorialStep = 4; break;
            }
            switch (S.tutorialStep)
            {
                case 0:
                    if (CurrentTab == TabHome) _finger.Show(home.HeroRt, Data.Line("tutorial", "0"), 330); else _finger.Hide();
                    break;
                case 1:
                case 2:
                    if (CurrentTab == TabHome && (S.tutorialStep == 1 || S.money >= Sim.HireCost()))
                        _finger.Show(home.MirrorRt, Data.Line("tutorial", S.tutorialStep.ToString()), 220);
                    else _finger.Hide();
                    break;
                case 3:
                    if (Sim.PromotionQueue().Count == 0) { _finger.Hide(); break; }
                    if (CurrentTab != TabVillage) _finger.Show(TabButton(TabVillage), Data.Line("tutorial", "3"), 160);
                    else
                    {
                        var target = GetScreen<VillageScreen>().FirstPromotableChip();
                        if (target != null) _finger.Show(target, "레벨이 찬 분신을 눌러 승진!", 200); else _finger.Hide();
                    }
                    break;
            }
        }

        // ------------------------------------------------------------------ '순간' 배너(절정 연출)

        readonly Queue<Action> _moments = new Queue<Action>();
        float _momentBusyUntil;

        /// <summary>
        /// 절정 연출: 번쩍 → 효과음 → 배너가 튕겨 나옴 → 색종이 → 1.5초 뒤 사라짐. 입력은 막지 않는다.
        /// </summary>
        public void Moment(string title, string sub, string sprite, Color accent, string sound = "promo")
        {
            _moments.Enqueue(() => PlayMoment(title, sub, sprite, accent, sound));
            if (Time.unscaledTime >= _momentBusyUntil) NextMoment();
        }

        void NextMoment()
        {
            if (_moments.Count == 0) return;
            _momentBusyUntil = Time.unscaledTime + 1.7f;
            _moments.Dequeue()();
            Tweens.Delay(1.75f, NextMoment, this);
        }

        void PlayMoment(string title, string sub, string sprite, Color accent, string sound)
        {
            Fx.Flash(accent, 0.45f, 0.12f);
            Sfx.Play(sound);
            var root = Ui.Node("Moment", MomentLayer);
            root.Place(0.5f, 0.58f, 900, 420, 0, 0, 0.5f, 0.5f);
            var g = root.gameObject.AddComponent<CanvasGroup>();
            g.blocksRaycasts = false; g.interactable = false;
            var glow = Ui.Image(root, "ui_glow", Palette.Alpha(accent, 0.8f), "Glow");
            glow.Rt().Place(0.5f, 0.5f, 900, 900, 0, 60);
            var card = Ui.Image(root, "ui_card", Palette.White, "Card");
            card.Rt().Place(0.5f, 0.5f, 860, 230, 0, -70);
            if (!string.IsNullOrEmpty(sprite))
            {
                var pic = Ui.Image(root, sprite, Color.white, "Pic");
                pic.Rt().Place(0.5f, 0.5f, 260, 260, 0, 140);
                Tweens.Appear(pic.Rt(), 0.4f, 0.05f);
            }
            var t = Ui.FitLabel(card.transform, title, 60, Palette.Ink, TextAnchor.MiddleCenter, "Title");
            t.Rt().Fill(30, 96, 30, 20);
            var s = Ui.FitLabel(card.transform, sub, 34, Palette.InkSoft, TextAnchor.MiddleCenter, "Sub");
            s.Rt().Fill(30, 26, 30, 132);
            Tweens.Appear(card.Rt(), 0.35f, 0.05f);
            Fx.Confetti(Fx.LocalOf(card.Rt()), 40);
            Tweens.To(1.6f, k => glow.Rt().localRotation = Quaternion.Euler(0, 0, k * 40), Ease.Linear, null, glow);
            Tweens.Delay(1.5f, () => Tweens.Fade(g, 1, 0, 0.2f, () => { if (root != null) Destroy(root.gameObject); }), root);
        }
    }
}
