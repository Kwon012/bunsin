using System;
using System.Collections.Generic;
using UnityEngine;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>팝업 한 장의 틀. 제목·본문 줄·버튼을 위에서 아래로 쌓는다.</summary>
    public sealed class PopupFrame
    {
        public Popups Owner;
        public RectTransform Root, Panel, Body, ButtonRow;
        public CanvasGroup Group;
        public bool Dismissable = true;
        public Action OnClosed;
        bool _closed;

        public UText Title(string text, string icon = null, Color? color = null)
        {
            var row = Ui.Node("Title", Body);
            row.Size(-1, 96);
            if (icon != null)
            {
                var ic = Ui.Image(row, icon, Color.white, "Icon");
                ic.Rt().Place(0, 0.5f, 88, 88, 0, 0);
            }
            var t = Ui.FitLabel(row, text, 54, color ?? Palette.Ink, icon != null ? TextAnchor.MiddleLeft : TextAnchor.MiddleCenter);
            t.Rt().Fill(icon != null ? 104 : 0, 0, 0, 0);
            return t;
        }

        public UText Text(string text, int size = 36, Color? color = null, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var t = Ui.Label(Body, text, size, color ?? Palette.Ink, align, "Text");
            t.lineSpacing = 1.15f;
            return t;
        }

        /// <summary>왼쪽 이름 · 오른쪽 값 한 줄(명세서·정산서).</summary>
        public void Line(string left, string right, int size = 34, Color? rightColor = null)
        {
            var row = Ui.Node("Line", Body);
            row.Size(-1, size + 22);
            var l = Ui.FitLabel(row, left, size, Palette.Ink, TextAnchor.MiddleLeft, "Left");
            l.Rt().Span(0, 0, 0.64f, 1);
            var r = Ui.FitLabel(row, right, size, rightColor ?? Palette.Green, TextAnchor.MiddleRight, "Right");
            r.Rt().Span(0.64f, 0, 1, 1);
        }

        public void Divider()
        {
            var d = Ui.Box(Body, Palette.Alpha(Palette.Ink, 0.15f), "Divider");
            d.Size(-1, 4);
        }

        public void Space(float h) { Ui.Node("Space", Body).Size(-1, h); }

        public UImage Picture(string sprite, float height = 300)
        {
            var holder = Ui.Node("Picture", Body);
            holder.Size(-1, height);
            var img = Ui.Image(holder, sprite, Color.white, "Img");
            img.Rt().Fill();
            img.preserveAspect = true;
            return img;
        }

        /// <summary>색 바탕의 강조 상자(큰 금액 등).</summary>
        public UText Highlight(string text, Color back, int size = 64)
        {
            var box = Ui.Image(Body, "ui_pill_flat", back, "Highlight");
            box.Size(-1, size + 56);
            var t = Ui.FitLabel(box.transform, text, size, Palette.Ink);
            t.Rt().Fill(30, 8, 30, 8);
            return t;
        }

        public UButton Button(string label, Color color, Action onClick, bool close = true)
        {
            if (ButtonRow == null)
            {
                ButtonRow = Ui.Node("Buttons", Body);
                ButtonRow.Size(-1, 130);
                var h = Ui.HStack(ButtonRow, 20);
                h.childForceExpandWidth = true;
                h.childForceExpandHeight = true;
            }
            var b = Ui.Button(ButtonRow, label, color, () =>
            {
                if (onClick != null) onClick();
                if (close) Close();
            }, 44);
            b.Size(-1, 130, 1);
            return b;
        }

        public void Close()
        {
            if (_closed) return;
            _closed = true;
            Owner.CloseCurrent(this);
        }

        public bool Closed { get { return _closed; } }
    }

    /// <summary>
    /// 팝업 대기열. 동시에 생긴 사건은 겹쳐 띄우지 않고 하나씩 이어서 보여 준다(기획서 화면 규칙).
    /// </summary>
    public sealed class Popups : MonoBehaviour
    {
        RectTransform _layer, _toastLayer;
        readonly List<Action<PopupFrame>> _queue = new List<Action<PopupFrame>>();
        PopupFrame _current;
        float _gap;
        int _toasts;

        public bool Busy { get { return _current != null || _queue.Count > 0; } }
        public bool Showing { get { return _current != null; } }

        public static Popups Create(RectTransform layer, RectTransform toastLayer)
        {
            var p = layer.gameObject.AddComponent<Popups>();
            p._layer = layer;
            p._toastLayer = toastLayer;
            return p;
        }

        public void Enqueue(Action<PopupFrame> build, bool front = false)
        {
            if (front) _queue.Insert(0, build); else _queue.Add(build);
        }

        void Update()
        {
            if (_current != null || _queue.Count == 0) return;
            _gap -= Time.unscaledDeltaTime;
            if (_gap > 0) return;
            var build = _queue[0];
            _queue.RemoveAt(0);
            Show(build);
        }

        void Show(Action<PopupFrame> build)
        {
            var f = new PopupFrame { Owner = this };
            f.Root = Ui.Node("Popup", _layer);
            f.Root.Fill();
            f.Group = f.Root.gameObject.AddComponent<CanvasGroup>();
            var scrim = Ui.Box(f.Root, Palette.Scrim, "Scrim", true);
            scrim.Rt().Fill();
            var scrimBtn = scrim.gameObject.AddComponent<UButton>();
            scrimBtn.transition = UnityEngine.UI.Selectable.Transition.None;
            scrimBtn.onClick.AddListener(() => { if (f.Dismissable) f.Close(); });

            var panel = Ui.Image(f.Root, "ui_card", Palette.Paper, "Panel", true);
            f.Panel = panel.Rt();
            f.Panel.anchorMin = f.Panel.anchorMax = f.Panel.pivot = new Vector2(0.5f, 0.5f);
            f.Panel.sizeDelta = new Vector2(960, 400);
            var v = Ui.VStack(f.Panel, 18, 48, 44, 60);
            v.childAlignment = TextAnchor.UpperCenter;
            var fit = f.Panel.gameObject.AddComponent<UnityEngine.UI.ContentSizeFitter>();
            fit.verticalFit = UnityEngine.UI.ContentSizeFitter.FitMode.PreferredSize;
            f.Body = f.Panel;
            _current = f;
            try { build(f); }
            catch (Exception e) { Debug.LogException(e); }
            Tweens.Fade(f.Group, 0, 1, 0.18f);
            Tweens.Appear(f.Panel, 0.28f);
        }

        internal void CloseCurrent(PopupFrame f)
        {
            if (_current == f) { _current = null; _gap = 0.12f; }
            var root = f.Root;
            if (f.Group != null) f.Group.blocksRaycasts = false;
            Tweens.Fade(f.Group, 1, 0, 0.14f, () => { if (root != null) Destroy(root.gameObject); });
            if (f.OnClosed != null) f.OnClosed();
        }

        /// <summary>뒤로 가기(안드로이드): 닫을 수 있는 팝업이면 닫는다.</summary>
        public bool Back()
        {
            if (_current == null) return false;
            if (_current.Dismissable) _current.Close();
            return true;
        }

        /// <summary>화면 위쪽에 잠깐 뜨는 한 줄 알림.</summary>
        public void Toast(string text, string icon = null, Color? color = null)
        {
            if (_toasts >= 3) return;
            _toasts++;
            var pill = Ui.Image(_toastLayer, "ui_pill", color ?? Palette.White, "Toast");
            var rt = pill.Rt();
            float y = -250 - (_toasts - 1) * 110;
            rt.Place(0.5f, 1, 900, 96, 0, y, 0.5f, 1);
            float left = 36;
            if (icon != null)
            {
                var ic = Ui.Image(rt, icon, Color.white, "Icon");
                ic.Rt().Place(0, 0.5f, 64, 64, 24, 0);
                left = 100;
            }
            var t = Ui.FitLabel(rt, text, 34, Palette.Ink, icon != null ? TextAnchor.MiddleLeft : TextAnchor.MiddleCenter);
            t.Rt().Fill(left, 6, 30, 6);
            var g = pill.gameObject.AddComponent<CanvasGroup>();
            g.blocksRaycasts = false;
            Tweens.Move(rt, new Vector2(0, y + 80), new Vector2(0, y), 0.25f, Ease.OutBack);
            Tweens.Fade(g, 0, 1, 0.15f);
            Tweens.Delay(2.4f, () => Tweens.Fade(g, 1, 0, 0.3f, () => { _toasts--; if (rt != null) Destroy(rt.gameObject); }), rt);
        }
    }
}
