using System;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// uGUI를 코드로 조립하는 도구 모음. 기준 해상도 1080×1920(세로), 글자는 한 곳(Label)에서만 만든다.
    /// 나중에 TextMeshPro로 바꿀 때는 Label 한 곳만 고치면 된다.
    /// </summary>
    public static class Ui
    {
        public static Font Font;
        public static float TextScale = 1f; // 큰 글씨 옵션(1.15)

        public static void Init()
        {
            if (Font != null) return;
            Font = Resources.Load<Font>("Fonts/Jua-Regular");
            if (Font == null)
            {
                Debug.LogWarning("[Ui] Jua 폰트를 찾지 못해 기기 기본 글꼴을 씁니다.");
                Font = Font.CreateDynamicFontFromOSFont(new[] { "Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic", "Arial" }, 32);
            }
        }

        // ------------------------------------------------------------------ RectTransform

        public static RectTransform Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = 5; // UI
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.localScale = Vector3.one;
            return rt;
        }

        /// <summary>부모를 가득 채운다(안쪽 여백 지정).</summary>
        public static RectTransform Fill(this RectTransform rt, float left = 0, float bottom = 0, float right = 0, float top = 0)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(left, bottom); rt.offsetMax = new Vector2(-right, -top);
            return rt;
        }

        /// <summary>부모의 (ax, ay) 지점에 고정 크기로 둔다. 피벗은 기본으로 같은 지점.</summary>
        public static RectTransform Place(this RectTransform rt, float ax, float ay, float w, float h, float x = 0, float y = 0, float px = -1, float py = -1)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(ax, ay);
            rt.pivot = new Vector2(px < 0 ? ax : px, py < 0 ? ay : py);
            rt.sizeDelta = new Vector2(w, h);
            rt.anchoredPosition = new Vector2(x, y);
            return rt;
        }

        /// <summary>위쪽에 가로로 붙인다.</summary>
        public static RectTransform Top(this RectTransform rt, float height, float y = 0, float left = 0, float right = 0)
        {
            rt.anchorMin = new Vector2(0, 1); rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0.5f, 1);
            rt.offsetMin = new Vector2(left, 0); rt.offsetMax = new Vector2(-right, 0);
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, height);
            rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, -y);
            return rt;
        }

        /// <summary>아래쪽에 가로로 붙인다.</summary>
        public static RectTransform Bottom(this RectTransform rt, float height, float y = 0, float left = 0, float right = 0)
        {
            rt.anchorMin = new Vector2(0, 0); rt.anchorMax = new Vector2(1, 0); rt.pivot = new Vector2(0.5f, 0);
            rt.offsetMin = new Vector2(left, 0); rt.offsetMax = new Vector2(-right, 0);
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, height);
            rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, y);
            return rt;
        }

        /// <summary>부모 안에서 비율로 영역을 잡는다.</summary>
        public static RectTransform Span(this RectTransform rt, float x0, float y0, float x1, float y1, float pad = 0)
        {
            rt.anchorMin = new Vector2(x0, y0); rt.anchorMax = new Vector2(x1, y1); rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(pad, pad); rt.offsetMax = new Vector2(-pad, -pad);
            return rt;
        }

        public static RectTransform Rt(this Component c) { return (RectTransform)c.transform; }

        // ------------------------------------------------------------------ 그림·글자

        public static UImage Image(Transform parent, string sprite, Color color, string name = null, bool raycast = false)
        {
            var rt = Node(name ?? sprite ?? "Image", parent);
            var img = rt.gameObject.AddComponent<UImage>();
            SetSprite(img, sprite);
            img.color = color;
            img.raycastTarget = raycast;
            return img;
        }

        public static void SetSprite(UImage img, string sprite)
        {
            var sp = Art.Get(sprite ?? "ui_white");
            img.sprite = sp;
            img.type = sp != null && sp.border.sqrMagnitude > 0 ? UImage.Type.Sliced : UImage.Type.Simple;
            img.preserveAspect = img.type == UImage.Type.Simple && sprite != null && !sprite.StartsWith("ui_");
        }

        /// <summary>단색 사각형.</summary>
        public static UImage Box(Transform parent, Color color, string name = "Box", bool raycast = false)
        {
            return Image(parent, "ui_white", color, name, raycast);
        }

        public static UText Label(Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter, string name = "Label")
        {
            Init();
            var rt = Node(name, parent);
            var t = rt.gameObject.AddComponent<UText>();
            t.font = Font;
            t.fontSize = Mathf.RoundToInt(size * TextScale);
            t.color = color;
            t.alignment = align;
            t.text = text ?? "";
            t.raycastTarget = false;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        /// <summary>칸에 맞춰 글자 크기를 줄이는 한 줄 글자(숫자·짧은 이름).</summary>
        public static UText FitLabel(Transform parent, string text, int maxSize, Color color, TextAnchor align = TextAnchor.MiddleCenter, string name = "Label")
        {
            var t = Label(parent, text, maxSize, color, align, name);
            t.resizeTextForBestFit = true;
            t.resizeTextMinSize = Mathf.Max(14, maxSize / 3);
            t.resizeTextMaxSize = Mathf.RoundToInt(maxSize * TextScale);
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            return t;
        }

        public static UnityEngine.UI.Outline Outline(this UText t, Color color, float width = 3)
        {
            var o = t.gameObject.AddComponent<UnityEngine.UI.Outline>();
            o.effectColor = color;
            o.effectDistance = new Vector2(width, -width);
            return o;
        }

        // ------------------------------------------------------------------ 버튼

        /// <summary>아트 바이블 버튼(아래 입술이 있는 9-slice). 누르면 살짝 눌리고 소리가 난다.</summary>
        public static UButton Button(Transform parent, string label, Color color, Action onClick, int fontSize = 40, string name = "Button")
        {
            var img = Image(parent, "ui_btn", color, name, true);
            var btn = img.gameObject.AddComponent<UButton>();
            btn.targetGraphic = img;
            btn.transition = UnityEngine.UI.Selectable.Transition.None;
            var press = img.gameObject.AddComponent<PressFeel>();
            press.Button = btn;
            if (!string.IsNullOrEmpty(label))
            {
                var t = FitLabel(img.transform, label, fontSize, Palette.Ink);
                t.Rt().Fill(18, 22, 18, 10);
            }
            if (onClick != null) btn.onClick.AddListener(new UnityAction(onClick));
            return btn;
        }

        public static UText ButtonLabel(UButton b) { return b.GetComponentInChildren<UText>(); }

        /// <summary>버튼을 '가능/불가' 모양으로 바꾼다(불가여도 눌러서 이유를 볼 수 있게 interactable은 유지).</summary>
        public static void SetEnabledLook(UButton b, bool enabled, Color color)
        {
            var img = (UImage)b.targetGraphic;
            img.color = enabled ? color : Palette.Gray;
        }

        /// <summary>그림이 없는 투명 터치 영역.</summary>
        public static UButton HitArea(Transform parent, Action onClick, string name = "Hit")
        {
            var img = Box(parent, new Color(1, 1, 1, 0), name, true);
            var btn = img.gameObject.AddComponent<UButton>();
            btn.transition = UnityEngine.UI.Selectable.Transition.None;
            btn.targetGraphic = img;
            if (onClick != null) btn.onClick.AddListener(new UnityAction(onClick));
            return btn;
        }

        // ------------------------------------------------------------------ 배치 도구

        public static UnityEngine.UI.VerticalLayoutGroup VStack(RectTransform rt, float spacing, int padX = 0, int padTop = 0, int padBottom = 0)
        {
            var v = rt.gameObject.AddComponent<UnityEngine.UI.VerticalLayoutGroup>();
            v.spacing = spacing;
            v.padding = new RectOffset(padX, padX, padTop, padBottom);
            v.childAlignment = TextAnchor.UpperCenter;
            v.childControlWidth = true; v.childControlHeight = true;
            v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            return v;
        }

        public static UnityEngine.UI.HorizontalLayoutGroup HStack(RectTransform rt, float spacing, int pad = 0, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var h = rt.gameObject.AddComponent<UnityEngine.UI.HorizontalLayoutGroup>();
            h.spacing = spacing;
            h.padding = new RectOffset(pad, pad, pad, pad);
            h.childAlignment = align;
            h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandWidth = false; h.childForceExpandHeight = false;
            return h;
        }

        /// <summary>레이아웃 그룹 안에서의 크기(선호 크기·늘어남 비율).</summary>
        public static UnityEngine.UI.LayoutElement Size(this Component c, float w = -1, float h = -1, float flexW = -1, float flexH = -1)
        {
            var le = c.GetComponent<UnityEngine.UI.LayoutElement>();
            if (le == null) le = c.gameObject.AddComponent<UnityEngine.UI.LayoutElement>();
            if (w >= 0) { le.preferredWidth = w; le.minWidth = w; }
            if (h >= 0) { le.preferredHeight = h; le.minHeight = h; }
            if (flexW >= 0) le.flexibleWidth = flexW;
            if (flexH >= 0) le.flexibleHeight = flexH;
            return le;
        }

        /// <summary>세로 스크롤 목록. content에 줄을 추가하면 된다(VerticalLayoutGroup + ContentSizeFitter).</summary>
        public static UnityEngine.UI.ScrollRect Scroll(Transform parent, out RectTransform content, float spacing = 16, int padX = 24, int padTop = 16, int padBottom = 40)
        {
            var root = Node("Scroll", parent);
            var hit = root.gameObject.AddComponent<UImage>();
            hit.color = new Color(1, 1, 1, 0);
            hit.raycastTarget = true;
            var sr = root.gameObject.AddComponent<UnityEngine.UI.ScrollRect>();
            var viewport = Node("Viewport", root);
            viewport.Fill();
            viewport.gameObject.AddComponent<UnityEngine.UI.RectMask2D>();
            content = Node("Content", viewport);
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1); content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = Vector2.zero; content.offsetMax = Vector2.zero;
            VStack(content, spacing, padX, padTop, padBottom);
            var fit = content.gameObject.AddComponent<UnityEngine.UI.ContentSizeFitter>();
            fit.verticalFit = UnityEngine.UI.ContentSizeFitter.FitMode.PreferredSize;
            fit.horizontalFit = UnityEngine.UI.ContentSizeFitter.FitMode.Unconstrained;
            sr.viewport = viewport;
            sr.content = content;
            sr.horizontal = false; sr.vertical = true;
            sr.movementType = UnityEngine.UI.ScrollRect.MovementType.Elastic;
            sr.scrollSensitivity = 40;
            return sr;
        }

        public static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
            {
                var c = t.GetChild(i).gameObject;
                c.SetActive(false);
                UnityEngine.Object.Destroy(c);
            }
        }

        /// <summary>둥근 카드 한 줄(목록의 기본 단위).</summary>
        public static RectTransform Card(Transform parent, float height, Color color, string name = "Card")
        {
            var img = Image(parent, "ui_card", color, name, false);
            img.Size(-1, height);
            return img.Rt();
        }

        /// <summary>아이콘 + 글자 한 줄.</summary>
        public static UText IconLabel(Transform parent, string icon, string text, int size, Color color, float iconSize = 56)
        {
            var row = Node("IconLabel", parent);
            var ic = Image(row, icon, Color.white, "Icon");
            ic.Rt().Place(0, 0.5f, iconSize, iconSize, 0, 0);
            var t = FitLabel(row, text, size, color, TextAnchor.MiddleLeft);
            t.Rt().Fill(iconSize + 10, 0, 0, 0);
            return t;
        }

        /// <summary>진행 막대. 반환값의 fillAmount 대신 SetBar로 채운다.</summary>
        public static RectTransform Bar(Transform parent, Color back, Color fill, out RectTransform fillRt, string name = "Bar")
        {
            var bg = Image(parent, "ui_pill_flat", back, name);
            var mask = Node("Mask", bg.transform);
            mask.Fill(4, 4, 4, 4);
            var f = Image(mask, "ui_pill_flat", fill, "Fill");
            fillRt = f.Rt();
            fillRt.anchorMin = new Vector2(0, 0); fillRt.anchorMax = new Vector2(0, 1); fillRt.pivot = new Vector2(0, 0.5f);
            fillRt.offsetMin = Vector2.zero; fillRt.offsetMax = Vector2.zero;
            return bg.Rt();
        }

        public static void SetBar(RectTransform fill, float t)
        {
            t = Mathf.Clamp01(t);
            fill.anchorMax = new Vector2(Mathf.Max(0.001f, t), 1);
            fill.offsetMin = Vector2.zero; fill.offsetMax = Vector2.zero;
            fill.gameObject.SetActive(t > 0.005f);
        }
    }

    /// <summary>버튼을 누르는 순간의 손맛: 0.92배로 눌렸다 튕겨 나오고 클릭음이 난다.</summary>
    public sealed class PressFeel : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        public UButton Button;
        public bool Silent;
        Vector3 _base = Vector3.one;
        bool _down;

        void Awake() { _base = transform.localScale; }

        public void OnPointerDown(PointerEventData e)
        {
            if (Button != null && !Button.interactable) return;
            _down = true;
            transform.localScale = _base * 0.93f;
            if (!Silent) Sfx.Play("click", 0.7f);
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (!_down) return;
            _down = false;
            Tweens.Pop(transform, _base.x, 0.16f, 0.93f);
        }

        void OnDisable() { transform.localScale = _base; _down = false; }
    }
}
