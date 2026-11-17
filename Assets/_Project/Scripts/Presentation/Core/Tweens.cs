using System;
using System.Collections;
using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>이징 곡선과 코루틴 트윈. UI는 정지·배속과 무관하게 움직여야 하므로 기본은 unscaled 시간.</summary>
    public static class Ease
    {
        public static float OutCubic(float t) { t = 1 - t; return 1 - t * t * t; }
        public static float InCubic(float t) { return t * t * t; }
        public static float InOut(float t) { return t < 0.5f ? 4 * t * t * t : 1 - Mathf.Pow(-2 * t + 2, 3) / 2; }

        public static float OutBack(float t)
        {
            const float c1 = 1.70158f, c3 = c1 + 1;
            return 1 + c3 * Mathf.Pow(t - 1, 3) + c1 * Mathf.Pow(t - 1, 2);
        }

        public static float OutElastic(float t)
        {
            if (t <= 0) return 0;
            if (t >= 1) return 1;
            return Mathf.Pow(2, -10 * t) * Mathf.Sin((t * 10 - 0.75f) * (2 * Mathf.PI / 3)) + 1;
        }

        public static float Linear(float t) { return t; }
    }

    public sealed class Tweens : MonoBehaviour
    {
        static Tweens _inst;

        static Tweens Inst
        {
            get
            {
                if (_inst == null)
                {
                    var go = new GameObject("Tweens");
                    DontDestroyOnLoad(go);
                    _inst = go.AddComponent<Tweens>();
                }
                return _inst;
            }
        }

        public static Coroutine Run(IEnumerator routine) { return Inst.StartCoroutine(routine); }

        /// <summary>0→1을 duration 동안 흘려보낸다. 대상이 사라지면 조용히 멈춘다.</summary>
        public static Coroutine To(float duration, Action<float> apply, Func<float, float> ease = null, Action done = null, UnityEngine.Object guard = null, float delay = 0)
        {
            return Inst.StartCoroutine(ToRoutine(duration, apply, ease ?? Ease.OutCubic, done, guard, guard != null, delay));
        }

        static IEnumerator ToRoutine(float duration, Action<float> apply, Func<float, float> ease, Action done, UnityEngine.Object guard, bool guarded, float delay)
        {
            if (delay > 0)
            {
                float d = 0;
                while (d < delay) { d += Time.unscaledDeltaTime; yield return null; }
            }
            if (duration <= 0) duration = 0.0001f;
            for (float t = 0; t < 1f; t += Time.unscaledDeltaTime / duration)
            {
                if (guarded && guard == null) yield break;
                apply(ease(t));
                yield return null;
            }
            if (guarded && guard == null) yield break;
            apply(1f);
            if (done != null) done();
        }

        public static Coroutine Delay(float seconds, Action action, UnityEngine.Object guard = null)
        {
            return To(0.0001f, _ => { }, Ease.Linear, action, guard, seconds);
        }

        /// <summary>크기 팝: from배에서 원래 크기로 튕겨 돌아온다.</summary>
        public static void Pop(Transform t, float baseScale = 1f, float duration = 0.18f, float from = 1.25f)
        {
            if (t == null) return;
            To(duration, k => t.localScale = Vector3.one * Mathf.LerpUnclamped(from * baseScale, baseScale, k), Ease.OutBack, null, t);
        }

        /// <summary>0에서 커지며 등장.</summary>
        public static void Appear(Transform t, float duration = 0.3f, float delay = 0)
        {
            if (t == null) return;
            t.localScale = Vector3.zero;
            To(duration, k => t.localScale = Vector3.one * k, Ease.OutBack, null, t, delay);
        }

        public static void Fade(CanvasGroup g, float from, float to, float duration, Action done = null)
        {
            if (g == null) return;
            g.alpha = from;
            To(duration, k => g.alpha = Mathf.Lerp(from, to, k), Ease.OutCubic, done, g);
        }

        public static void Move(RectTransform rt, Vector2 from, Vector2 to, float duration, Func<float, float> ease = null, Action done = null, float delay = 0)
        {
            if (rt == null) return;
            rt.anchoredPosition = from;
            To(duration, k => rt.anchoredPosition = Vector2.LerpUnclamped(from, to, k), ease ?? Ease.OutCubic, done, rt, delay);
        }

        /// <summary>좌우로 짧게 흔든다(불가·알림).</summary>
        public static void Shake(RectTransform rt, float amount = 14, float duration = 0.3f)
        {
            if (rt == null) return;
            var p = rt.anchoredPosition;
            To(duration, k => rt.anchoredPosition = p + new Vector2(Mathf.Sin(k * Mathf.PI * 6) * amount * (1 - k), 0), Ease.Linear, () => rt.anchoredPosition = p, rt);
        }
    }

    /// <summary>숨쉬기: 서 있는 캐릭터는 조각상이 아니다. 사인 곡선으로 위아래·찌그러짐을 준다.</summary>
    public sealed class Breathe : MonoBehaviour
    {
        public float Period = 2.2f, Amount = 0.025f, Phase;
        Vector3 _base;

        void Awake() { _base = transform.localScale; Phase = UnityEngine.Random.value * 6.28f; }

        void Update()
        {
            float s = Mathf.Sin(Time.unscaledTime * (2 * Mathf.PI / Period) + Phase);
            transform.localScale = new Vector3(_base.x * (1 - s * Amount * 0.6f), _base.y * (1 + s * Amount), 1);
        }

        public void Rebase(Vector3 scale) { _base = scale; }
    }

    /// <summary>알파가 천천히 오르내린다(눌러 달라는 표시).</summary>
    public sealed class Pulse : MonoBehaviour
    {
        public float Min = 0.5f, Max = 1f, Period = 1.6f;
        CanvasGroup _g;

        void Awake() { _g = GetComponent<CanvasGroup>(); if (_g == null) _g = gameObject.AddComponent<CanvasGroup>(); _g.blocksRaycasts = false; _g.interactable = false; }

        void Update()
        {
            float s = (Mathf.Sin(Time.unscaledTime * (2 * Mathf.PI / Period)) + 1) * 0.5f;
            _g.alpha = Mathf.Lerp(Min, Max, s);
        }
    }
}
