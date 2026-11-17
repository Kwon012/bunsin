using System.Collections.Generic;
using UnityEngine;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 손맛 연출(주스). 원칙: 눈에 보이는 상태 변화에는 100ms 안에 보이고 들리는 답을 준다.
    /// 반복 탭 게임이라 과하면 피로하므로 화면 흔들림은 쓰지 않고, 무작위 '대박'도 넣지 않는다(확률 연상).
    /// </summary>
    public sealed class Fx : MonoBehaviour
    {
        RectTransform _layer;
        readonly Stack<UImage> _pool = new Stack<UImage>();
        static readonly Color[] ConfettiColors = { Palette.Yellow, Palette.Coral, Palette.Sky, Palette.Green, Palette.Purple, Palette.Pink };

        public static Fx Create(RectTransform layer)
        {
            var fx = layer.gameObject.AddComponent<Fx>();
            fx._layer = layer;
            return fx;
        }

        UImage Rent(string sprite, Color color, float size)
        {
            UImage img = _pool.Count > 0 ? _pool.Pop() : Ui.Image(_layer, sprite, color, "Fx");
            img.gameObject.SetActive(true);
            Ui.SetSprite(img, sprite);
            img.color = color;
            var rt = img.Rt();
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(size, size);
            rt.localScale = Vector3.one;
            rt.localRotation = Quaternion.identity;
            rt.SetAsLastSibling();
            return img;
        }

        void Return(UImage img)
        {
            if (img == null) return;
            img.gameObject.SetActive(false);
            _pool.Push(img);
        }

        /// <summary>화면 좌표(픽셀)를 이 레이어의 로컬 좌표로.</summary>
        public Vector2 ToLocal(Vector2 screen)
        {
            Vector2 p;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_layer, screen, null, out p);
            return p;
        }

        public Vector2 LocalOf(RectTransform target)
        {
            return ToLocal(RectTransformUtility.WorldToScreenPoint(null, target.TransformPoint(target.rect.center)));
        }

        /// <summary>위로 떠오르며 사라지는 글자("+1,200").</summary>
        public void FloatText(Vector2 local, string text, Color color, int size = 44, float rise = 150, float life = 0.7f)
        {
            var t = Ui.Label(_layer, text, size, color, TextAnchor.MiddleCenter, "FloatText");
            t.Outline(Palette.Ink, 2.5f);
            var rt = t.Rt();
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(600, 80);
            rt.anchoredPosition = local;
            rt.localScale = Vector3.one * 0.6f;
            Tweens.To(0.14f, k => rt.localScale = Vector3.one * Mathf.LerpUnclamped(0.6f, 1f, k), Ease.OutBack, null, rt);
            Tweens.To(life, k =>
            {
                rt.anchoredPosition = local + new Vector2(0, rise * k);
                t.color = Palette.Alpha(color, 1 - Mathf.Clamp01((k - 0.6f) / 0.4f));
            }, Ease.OutCubic, () => Destroy(rt.gameObject), rt);
        }

        /// <summary>탭한 자리에서 퍼지는 고리.</summary>
        public void Ring(Vector2 local, Color color, float size = 220)
        {
            var img = Rent("ui_ring", color, size);
            var rt = img.Rt();
            rt.anchoredPosition = local;
            Tweens.To(0.32f, k =>
            {
                rt.localScale = Vector3.one * Mathf.Lerp(0.3f, 1f, k);
                img.color = Palette.Alpha(color, 0.8f * (1 - k));
            }, Ease.OutCubic, () => Return(img), img);
        }

        /// <summary>동전이 from에서 튀어 올랐다가 to(상단 금액)로 날아간다.</summary>
        public void CoinFly(Vector2 from, Vector2 to, int count = 1, System.Action onArrive = null)
        {
            for (int i = 0; i < count; i++)
            {
                var img = Rent("i_coin", Color.white, 64);
                var rt = img.Rt();
                Vector2 start = from + new Vector2(Random.Range(-40f, 40f), Random.Range(-10f, 30f));
                Vector2 mid = start + new Vector2(Random.Range(-120f, 120f), Random.Range(80f, 200f));
                rt.anchoredPosition = start;
                bool last = i == count - 1;
                float delay = i * 0.03f;
                Tweens.To(0.55f, k =>
                {
                    Vector2 a = Vector2.Lerp(start, mid, k), b = Vector2.Lerp(mid, to, k);
                    rt.anchoredPosition = Vector2.Lerp(a, b, k);
                    rt.localScale = Vector3.one * Mathf.Lerp(1f, 0.6f, k);
                }, Ease.InOut, () => { Return(img); if (last && onArrive != null) onArrive(); }, img, delay);
            }
        }

        /// <summary>색종이 터짐(승진·월급날·해금 같은 '순간').</summary>
        public void Confetti(Vector2 local, int count = 36, float power = 900)
        {
            for (int i = 0; i < count; i++)
            {
                var color = ConfettiColors[i % ConfettiColors.Length];
                var img = Rent("ui_confetti", color, 26);
                var rt = img.Rt();
                rt.sizeDelta = new Vector2(20, 28);
                float ang = Random.Range(20f, 160f) * Mathf.Deg2Rad;
                Vector2 vel = new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * Random.Range(power * 0.4f, power);
                float spin = Random.Range(-720f, 720f);
                float life = Random.Range(0.9f, 1.4f);
                Tweens.To(life, k =>
                {
                    float t = k * life;
                    rt.anchoredPosition = local + vel * t + new Vector2(0, -1400f * t * t);
                    rt.localRotation = Quaternion.Euler(0, 0, spin * t);
                    img.color = Palette.Alpha(color, 1 - Mathf.Clamp01((k - 0.7f) / 0.3f));
                }, Ease.Linear, () => Return(img), img);
            }
        }

        /// <summary>반짝이 몇 개(레벨업·구매).</summary>
        public void Sparkle(Vector2 local, Color color, int count = 6, float radius = 90)
        {
            for (int i = 0; i < count; i++)
            {
                var img = Rent("ui_spark", color, Random.Range(28f, 52f));
                var rt = img.Rt();
                float ang = (i / (float)count) * Mathf.PI * 2 + Random.Range(-0.3f, 0.3f);
                Vector2 dir = new Vector2(Mathf.Cos(ang), Mathf.Sin(ang));
                Tweens.To(0.45f, k =>
                {
                    rt.anchoredPosition = local + dir * radius * k;
                    rt.localScale = Vector3.one * Mathf.Sin(k * Mathf.PI);
                }, Ease.OutCubic, () => Return(img), img);
            }
        }

        /// <summary>화면 전체를 한 번 번쩍(강조색, 0.6 → 0).</summary>
        public void Flash(Color color, float alpha = 0.5f, float duration = 0.18f)
        {
            var img = Rent("ui_white", Palette.Alpha(color, alpha), 10);
            var rt = img.Rt();
            rt.Fill();
            Tweens.To(duration, k => img.color = Palette.Alpha(color, alpha * (1 - k)), Ease.OutCubic, () => Return(img), img);
        }
    }

    /// <summary>숫자가 '딱' 바뀌지 않고 0.5초쯤 세어 올라가는 금액 표시.</summary>
    public sealed class CountUpText
    {
        readonly UText _text;
        readonly System.Func<double, string> _format;
        double _shown, _target;
        bool _first = true;

        public CountUpText(UText text, System.Func<double, string> format) { _text = text; _format = format; }

        public void Set(double value, float dt)
        {
            _target = value;
            if (_first) { _shown = value; _first = false; }
            else
            {
                double diff = _target - _shown;
                double step = diff * System.Math.Min(1.0, dt * 8.0);
                if (System.Math.Abs(diff) < System.Math.Abs(_target) * 1e-4 + 1) _shown = _target; else _shown += step;
            }
            _text.text = _format(_shown);
        }

        public UText Text { get { return _text; } }
    }
}
