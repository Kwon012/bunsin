using System;
using System.Collections.Generic;
using Bunsin.Sim;
using UnityEngine;
using UButton = UnityEngine.UI.Button;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 탭 화면의 공통 틀. 구조(무엇이 몇 개 있나)가 바뀌면 다시 만들고, 아니면 숫자만 고친다(가비지·깜빡임 방지).
    /// </summary>
    public abstract class ScreenBase
    {
        protected Game G;
        protected GameSim Sim { get { return G.Sim; } }
        protected GameState S { get { return G.Sim.S; } }
        protected GameData Data { get { return G.Data; } }
        public RectTransform Root;
        protected readonly List<Action> Updaters = new List<Action>();
        string _sig;

        public void Init(Game g, RectTransform host)
        {
            G = g;
            Root = Ui.Node(GetType().Name, host);
            Root.Fill();
            Root.gameObject.AddComponent<CanvasGroup>();
            Setup();
        }

        /// <summary>한 번만 만드는 것(배경 등).</summary>
        protected virtual void Setup() { }

        /// <summary>구조 서명. 이 문자열이 바뀌면 Build를 다시 부른다.</summary>
        protected abstract string Signature();

        /// <summary>구조를 만든다. 숫자를 고치는 일은 Updaters에 넣는다.</summary>
        protected abstract void Build();

        public void Invalidate() { _sig = null; }

        public virtual void OnShow() { Refresh(); }

        public void Refresh()
        {
            if (!Root.gameObject.activeInHierarchy) return;
            string sig = Signature();
            if (sig != _sig)
            {
                _sig = sig;
                Updaters.Clear();
                Build();
            }
            for (int i = 0; i < Updaters.Count; i++)
            {
                try { Updaters[i](); }
                catch (Exception e) { Debug.LogException(e); }
            }
        }

        public void Destroy()
        {
            if (Root != null) UnityEngine.Object.Destroy(Root.gameObject);
        }

        // ------------------------------------------------------------------ 목록 화면에서 자주 쓰는 조각

        protected UText Section(Transform content, string title, string icon = null)
        {
            var row = Ui.Node("Section", content);
            row.Size(-1, 84);
            float left = 8;
            if (icon != null)
            {
                var ic = Ui.Image(row, icon, Color.white, "Icon");
                ic.Rt().Place(0, 0.5f, 64, 64, 4, -4, 0, 0.5f);
                left = 80;
            }
            var t = Ui.FitLabel(row, title, 44, Palette.Ink, TextAnchor.MiddleLeft, "Title");
            t.Rt().Fill(left, 0, 0, 8);
            return t;
        }

        protected UText Note(Transform content, string text, int size = 30)
        {
            var t = Ui.Label(content, text, size, Palette.InkSoft, TextAnchor.MiddleLeft, "Note");
            t.Size(-1, -1);
            return t;
        }

        /// <summary>
        /// 아이콘 · 제목 · 설명 · 오른쪽 버튼 한 줄 카드. 버튼 글자와 색은 updater에서 매번 고친다.
        /// </summary>
        protected RowCard Row(Transform content, string icon, string title, Action onClick, float height = 168)
        {
            var r = new RowCard();
            r.Root = Ui.Card(content, height, Palette.White);
            if (icon != null)
            {
                r.Icon = Ui.Image(r.Root, icon, Color.white, "Icon");
                r.Icon.Rt().Place(0, 0.5f, 104, 104, 28, 4, 0, 0.5f);
            }
            float left = icon != null ? 150 : 34;
            r.Title = Ui.FitLabel(r.Root, title, 38, Palette.Ink, TextAnchor.MiddleLeft, "Title");
            r.Title.Rt().Fill(left, height * 0.5f, 300, 18);
            r.Sub = Ui.Label(r.Root, "", 28, Palette.InkSoft, TextAnchor.UpperLeft, "Sub");
            r.Sub.Rt().Fill(left, 24, 300, height * 0.5f + 2);
            r.Sub.verticalOverflow = VerticalWrapMode.Truncate;
            if (onClick != null)
            {
                r.Button = Ui.Button(r.Root, "", Palette.Yellow, onClick, 32, "Action");
                r.Button.Rt().Place(1, 0.5f, 264, 116, -24, 6, 1, 0.5f);
                r.ButtonText = Ui.ButtonLabel(r.Button);
                r.ButtonText.lineSpacing = 0.85f;
            }
            return r;
        }

        protected void Spacer(Transform content, float h) { Ui.Node("Space", content).Size(-1, h); }
    }

    public sealed class RowCard
    {
        public RectTransform Root;
        public UnityEngine.UI.Image Icon;
        public UText Title, Sub, ButtonText;
        public UButton Button;

        /// <summary>버튼 상태: 살 수 있으면 노랑, 돈만 모자라면 크림, 막혀 있으면 회색.</summary>
        public void SetButton(string text, int state)
        {
            if (Button == null) return;
            ButtonText.text = text;
            Ui.SetEnabledLook(Button, state != 2, state == 0 ? Palette.Yellow : Palette.Cream);
            Button.gameObject.SetActive(state >= 0);
        }

        public static int State(GameSim sim, double cost, bool allowed = true)
        {
            if (!allowed) return 2;
            return cost <= sim.S.money ? 0 : 1;
        }
    }
}
