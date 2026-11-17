using System;
using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>보상형 광고. 강제 전면 광고는 없다(설계 원칙 5). 실제 SDK는 이 인터페이스 뒤에 붙인다.</summary>
    public interface IAdService
    {
        bool IsReady { get; }
        /// <summary>광고를 보여 주고 끝까지 봤으면 onDone(true).</summary>
        void ShowRewarded(string placement, Action<bool> onDone);
    }

    /// <summary>인앱 결제. 모든 상품은 내용이 확정된 직접 구매다(확률 없음, 설계 원칙 1).</summary>
    public interface IIapService
    {
        string PriceText(string productId);
        void Purchase(string productId, Action<bool> onDone);
    }

    public static class Products
    {
        public const string NoAds = "no_ads";
        public const string Starter = "starter_pack";
        public const string Tickets5 = "time_tickets_5";
    }

    /// <summary>
    /// 개발용 가짜 광고: 1초 기다렸다가 '시청 완료'로 처리한다.
    /// 출시 전 LevelPlay 등 실제 광고 SDK 구현으로 바꾼다(Game.Ads에 넣으면 된다).
    /// </summary>
    public sealed class MockAdService : IAdService
    {
        public bool IsReady { get { return true; } }

        public void ShowRewarded(string placement, Action<bool> onDone)
        {
            Debug.Log("[Ads] (가짜 광고) " + placement);
            Tweens.Delay(1f, () => { if (onDone != null) onDone(true); });
        }
    }

    /// <summary>
    /// 개발용 가짜 결제: 에디터·개발 빌드에서만 바로 성공한다. 출시 빌드에서는 실패로 답해 무료 지급을 막는다.
    /// 출시 전 Unity IAP 구현으로 바꾼다(Game.Iap에 넣으면 된다).
    /// </summary>
    public sealed class MockIapService : IIapService
    {
        public string PriceText(string productId)
        {
            switch (productId)
            {
                case Products.NoAds: return "가격 미정";
                case Products.Starter: return "가격 미정";
                case Products.Tickets5: return "가격 미정";
            }
            return "";
        }

        public void Purchase(string productId, Action<bool> onDone)
        {
            bool ok = Debug.isDebugBuild || Application.isEditor;
            Debug.Log("[IAP] (가짜 결제) " + productId + " → " + (ok ? "성공" : "출시 빌드에서는 결제 SDK가 필요합니다"));
            if (onDone != null) onDone(ok);
        }
    }
}
