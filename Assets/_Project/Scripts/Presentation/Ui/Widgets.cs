using System;
using Bunsin.Sim;
using UnityEngine;
using UnityEngine.EventSystems;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>열려 있는 동안 0.2초마다 Tick을 부른다(팝업·카드의 숫자를 살아 있게).</summary>
    public sealed class Live : MonoBehaviour
    {
        public Action Tick;
        float _t;

        public static Live On(Component c, Action tick)
        {
            var l = c.gameObject.AddComponent<Live>();
            l.Tick = tick;
            if (tick != null) tick();
            return l;
        }

        void Update()
        {
            _t += Time.unscaledDeltaTime;
            if (_t < 0.2f) return;
            _t = 0;
            if (Tick != null) Tick();
        }
    }

    /// <summary>안전 영역(노치·홈 바) 안에 UI를 맞춘다.</summary>
    public sealed class SafeArea : MonoBehaviour
    {
        Rect _last;
        RectTransform _rt;

        void Awake() { _rt = (RectTransform)transform; Apply(); }
        void Update() { if (Screen.safeArea != _last) Apply(); }

        void Apply()
        {
            _last = Screen.safeArea;
            if (Screen.width <= 0 || Screen.height <= 0) return;
            var min = _last.position;
            var max = _last.position + _last.size;
            min.x /= Screen.width; min.y /= Screen.height;
            max.x /= Screen.width; max.y /= Screen.height;
            _rt.anchorMin = min; _rt.anchorMax = max;
            _rt.offsetMin = Vector2.zero; _rt.offsetMax = Vector2.zero;
        }
    }

    /// <summary>방 안을 어슬렁거리는 분신(같은 얼굴이 잔뜩 보이는 웃음 포인트).</summary>
    public sealed class Walker : MonoBehaviour
    {
        public float MinX = -400, MaxX = 400, Speed = 60;
        RectTransform _rt;
        float _target, _wait, _bobT;
        float _baseY;
        Vector3 _scale;

        void Start()
        {
            _rt = (RectTransform)transform;
            _baseY = _rt.anchoredPosition.y;
            _scale = _rt.localScale;
            _bobT = UnityEngine.Random.value * 10;
            Pick();
        }

        void Pick()
        {
            _target = UnityEngine.Random.Range(MinX, MaxX);
            _wait = UnityEngine.Random.Range(0.5f, 3f);
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            var p = _rt.anchoredPosition;
            if (_wait > 0) { _wait -= dt; p.y = _baseY; _rt.anchoredPosition = p; return; }
            float dir = Mathf.Sign(_target - p.x);
            p.x += dir * Speed * dt;
            _bobT += dt * 9;
            p.y = _baseY + Mathf.Abs(Mathf.Sin(_bobT)) * 8;
            _rt.localScale = new Vector3(Mathf.Abs(_scale.x) * (dir < 0 ? -1 : 1), _scale.y, 1);
            _rt.anchoredPosition = p;
            if (Mathf.Abs(_target - p.x) < 4) Pick();
        }
    }

    /// <summary>
    /// 본체 화면의 '아무 데나 탭'. 누르면 그 자리에서 일하고, 꾹 누르면 초당 몇 번씩 자동 탭(게이지는 느리게).
    /// 여러 손가락 탭을 모두 받는다.
    /// </summary>
    public sealed class TapSurface : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public Action<Vector2, bool> OnTap; // 화면 좌표, hold
        public float HoldDelay = 0.4f, HoldRate = 3f;
        int _downId = int.MinValue;
        Vector2 _pos;
        float _downAt, _acc;

        public void OnPointerDown(PointerEventData e)
        {
            if (OnTap != null) OnTap(e.position, false);
            _downId = e.pointerId;
            _pos = e.position;
            _downAt = Time.unscaledTime;
            _acc = 0;
        }

        public void OnPointerUp(PointerEventData e) { if (e.pointerId == _downId) _downId = int.MinValue; }
        public void OnPointerExit(PointerEventData e) { if (e.pointerId == _downId) _downId = int.MinValue; }
        void OnDisable() { _downId = int.MinValue; }

        void Update()
        {
            if (_downId == int.MinValue || Time.unscaledTime - _downAt < HoldDelay) return;
            _acc += Time.unscaledDeltaTime * HoldRate;
            while (_acc >= 1)
            {
                _acc -= 1;
                if (OnTap != null) OnTap(_pos, true);
            }
        }
    }

    /// <summary>손가락 가이드: 텍스트 튜토리얼 대신 손가락 하나와 한 줄(기획서 UX 규칙).</summary>
    public sealed class Finger : MonoBehaviour
    {
        public RectTransform Target;
        RectTransform _rt, _hand, _bubble;
        UText _text;

        public static Finger Create(RectTransform layer)
        {
            var root = Ui.Node("Finger", layer);
            root.anchorMin = root.anchorMax = root.pivot = new Vector2(0.5f, 0.5f);
            root.sizeDelta = new Vector2(10, 10);
            var f = root.gameObject.AddComponent<Finger>();
            f._rt = root;
            var hand = Ui.Image(root, "ui_finger", Color.white, "Hand");
            f._hand = hand.Rt();
            f._hand.Place(0.5f, 0.5f, 120, 140, 30, -80, 0.3f, 1f);
            var bubble = Ui.Image(root, "ui_pill", Palette.White, "Bubble");
            f._bubble = bubble.Rt();
            f._bubble.Place(0.5f, 0.5f, 760, 96, 0, 120, 0.5f, 0);
            f._text = Ui.FitLabel(bubble.transform, "", 36, Palette.Ink);
            f._text.Rt().Fill(28, 6, 28, 6);
            var g = root.gameObject.AddComponent<CanvasGroup>();
            g.blocksRaycasts = false; g.interactable = false;
            root.gameObject.SetActive(false);
            return f;
        }

        public void Show(RectTransform target, string text, float bubbleY = 120)
        {
            Target = target;
            _text.text = text;
            _bubble.anchoredPosition = new Vector2(0, bubbleY);
            if (!gameObject.activeSelf) { gameObject.SetActive(true); Tweens.Appear(_bubble, 0.25f); }
        }

        public void Hide() { Target = null; gameObject.SetActive(false); }

        void LateUpdate()
        {
            if (Target == null || !Target.gameObject.activeInHierarchy) { _rt.localScale = Vector3.zero; return; }
            _rt.localScale = Vector3.one;
            Vector2 local;
            var parent = (RectTransform)_rt.parent;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(parent,
                RectTransformUtility.WorldToScreenPoint(null, Target.TransformPoint(Target.rect.center)), null, out local);
            // 말풍선이 화면 밖으로 나가지 않게 가로 위치를 가둔다
            float half = parent.rect.width * 0.5f - 400;
            _rt.anchoredPosition = local;
            _bubble.anchoredPosition = new Vector2(Mathf.Clamp(0, -half - local.x, half - local.x), _bubble.anchoredPosition.y);
            float s = Mathf.Sin(Time.unscaledTime * 6);
            _hand.anchoredPosition = new Vector2(30, -80 - s * 14);
        }
    }

    /// <summary>분신 한 명(머리 + 적성 색 + 레벨 + 경험 막대 + 승진 표시). 마을·명단에서 쓴다.</summary>
    public sealed class CloneChip
    {
        public RectTransform Root;
        public int CloneId;
        UImage _bg, _head, _badge, _crown;
        UText _level;
        RectTransform _xpFill;

        public static CloneChip Create(Transform parent, float w, float h, Action<int> onTap)
        {
            var c = new CloneChip();
            var btn = Ui.HitArea(parent, null, "CloneChip");
            c.Root = btn.Rt();
            c.Root.sizeDelta = new Vector2(w, h);
            c._bg = Ui.Image(c.Root, "ui_round", Palette.Cream, "Bg");
            c._bg.Rt().Fill(4, 34, 4, 0);
            c._head = Ui.Image(c.Root, "head", Color.white, "Head");
            c._head.Rt().Span(0.08f, 0.32f, 0.92f, 0.98f);
            c._head.preserveAspect = true;
            var pill = Ui.Image(c.Root, "ui_pill_flat", Palette.Ink, "LvPill");
            pill.Rt().Bottom(40, 0, 2, 2);
            c._level = Ui.FitLabel(pill.transform, "", 26, Palette.White);
            c._level.Rt().Fill(6, 2, 6, 2);
            var bar = Ui.Bar(c.Root, Palette.Alpha(Palette.Ink, 0.2f), Palette.Yellow, out c._xpFill, "Xp");
            bar.Bottom(12, 42, 14, 14);
            c._badge = Ui.Image(c.Root, "i_up", Color.white, "Badge");
            c._badge.Rt().Place(1, 1, 46, 46, 4, 4, 1, 1);
            c._crown = Ui.Image(c.Root, "i_crown", Color.white, "Crown");
            c._crown.Rt().Place(0, 1, 42, 42, -2, 6, 0, 1);
            c._crown.Rt().localRotation = Quaternion.Euler(0, 0, 18);
            btn.onClick.AddListener(() => { if (onTap != null) onTap(c.CloneId); });
            btn.gameObject.AddComponent<PressFeel>().Button = btn;
            return c;
        }

        public void Set(GameSim sim, CloneState c)
        {
            CloneId = c != null ? c.id : 0;
            Root.gameObject.SetActive(c != null);
            if (c == null) return;
            _bg.color = Palette.Mix(Palette.Tier[c.apt], Palette.White, 0.45f);
            Ui.SetSprite(_head, c.apt == Tier.Inv && c.slot > 0 && sim.Job(c.slot).Tier == Tier.Inv ? "head_inv" : "head");
            _head.preserveAspect = true;
            _level.text = "Lv." + c.level;
            int cap = c.slot > 0 ? sim.LevelCap(c.slot) : c.level;
            float xp = c.level >= cap ? 1f : (float)(c.xp / sim.XpNeed(c.level));
            Ui.SetBar(_xpFill, xp);
            _xpFill.GetComponent<UImage>().color = c.level >= cap ? Palette.Green : Palette.Yellow;
            var b = sim.CheckPromotion(c);
            bool ready = b == PromoBlock.None || (b == PromoBlock.IsTop && sim.CanRetire(c));
            bool almost = b == PromoBlock.Money;
            _badge.gameObject.SetActive(ready || almost);
            Ui.SetSprite(_badge, b == PromoBlock.IsTop ? "i_retire" : "i_up");
            _badge.color = ready ? Color.white : new Color(1, 1, 1, 0.45f);
            _crown.gameObject.SetActive(!string.IsNullOrEmpty(c.unique));
        }
    }
}
