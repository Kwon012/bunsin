using Bunsin.Sim;
using UnityEngine;
using UImage = UnityEngine.UI.Image;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 상점: 확률 없이 '시간·편의·꾸미기'만 판다. 결제하지 않아도 모든 직종과 도시에 닿는다.
    /// 광고는 유저가 골라 보는 보상형뿐(강제 전면 광고 없음). 과금으로 뚫을 수 있는 벽은 시간 벽뿐이다.
    /// </summary>
    public sealed class ShopScreen : ScreenBase
    {
        RectTransform _content;

        protected override void Setup()
        {
            var bg = Ui.Box(Root, Palette.Paper, "Bg");
            bg.Rt().Fill();
            var sr = Ui.Scroll(Root, out _content, 18, 24, 16, 40);
            sr.Rt().Fill();
        }

        protected override string Signature()
        {
            return (S.noAds ? "1" : "0") + (S.starterPack ? "1" : "0") + S.manager;
        }

        protected override void Build()
        {
            Ui.Clear(_content);
            Section(_content, "무료 보상", "i_ad");
            var ad = Row(_content, "i_ad", "수입 2배 부스트", WatchAd, 170);
            Updaters.Add(() =>
            {
                string day = SaveSystem.Today();
                int left = Sim.AdsLeft(day);
                ad.Sub.text = (S.noAds ? "광고 없이 바로 받기 · " : "광고 보고 받기 · ") + NumberFormat.Duration(Data.E("ad_boost_sec")) + "\n오늘 남은 횟수 " + left + "/" + (int)Data.E("ad_daily_cap") +
                              (S.boostLeft > 0 ? " · 남은 부스트 " + NumberFormat.Duration(S.boostLeft) : "");
                bool can = Sim.CanWatchAd(day);
                ad.SetButton(can ? (S.noAds ? "받기" : "광고 보기") : S.adCooldown > 0 ? NumberFormat.Clock(S.adCooldown) : "내일 다시", can ? 0 : 2);
            });

            var ticket = Row(_content, "i_ticket", "시간 가속권", () =>
            {
                if (Sim.UseTimeTicket()) G.Fx.CoinFly(Vector2.zero, G.Fx.LocalOf(G.MoneyTarget), 12);
                else G.Deny("가속권이 없어요");
            }, 170);
            Updaters.Add(() =>
            {
                ticket.Sub.text = "1장 = " + NumberFormat.Duration(Data.E("time_ticket_sec")) + "치 수입(지금 " + NumberFormat.Money(Sim.TimeTicketValue()) + ")\n보유 " + S.timeTickets + "장";
                ticket.SetButton("사용", S.timeTickets > 0 ? 0 : 2);
            });

            Section(_content, "패키지", "i_shop");
            Note(_content, "모든 상품은 내용이 확정된 직접 구매예요. 확률 상품은 없어요.");
            if (!S.starterPack)
            {
                var sp = Row(_content, "i_crown", "스타터팩", () => Buy(Products.Starter), 190);
                sp.Sub.text = "매니저 분신 즉시 해금 + 시간 가속권 3장 + 개성 '스타터 분신'";
                sp.SetButton(G.Iap.PriceText(Products.Starter), 0);
            }
            if (!S.noAds)
            {
                var na = Row(_content, "i_close", "광고 제거", () => Buy(Products.NoAds), 170);
                na.Sub.text = "보상형 광고를 보지 않고 바로 받기(정산서 2배 포함)";
                na.SetButton(G.Iap.PriceText(Products.NoAds), 0);
            }
            var tk = Row(_content, "i_ticket", "시간 가속권 5장", () => Buy(Products.Tickets5), 160);
            tk.Sub.text = "급할 때 바로 쓰는 수입";
            tk.SetButton(G.Iap.PriceText(Products.Tickets5), 0);

            Section(_content, "기타", "i_gear");
            var st = Row(_content, "i_gear", "설정", () => GamePopups.Settings(G), 140);
            st.Sub.text = "소리 · 큰 글씨 · 진동 · 저장";
            st.SetButton("열기", 1);
            var stamp = Row(_content, "i_stamp", "출근 도장", null, 130);
            Updaters.Add(() => stamp.Sub.text = S.stampDays + "일째 · 7일째에 기념 분신 · 끊겨도 초기화 없음");
        }

        void WatchAd()
        {
            string day = SaveSystem.Today();
            if (!Sim.CanWatchAd(day)) { G.Deny("오늘은 다 받았어요"); return; }
            if (S.noAds) { Sim.GrantAdBoost(day); return; }
            G.Ads.ShowRewarded("boost", ok => { if (ok) Sim.GrantAdBoost(day); });
        }

        void Buy(string product)
        {
            G.Iap.Purchase(product, ok =>
            {
                if (!ok) { G.Deny("결제가 완료되지 않았어요"); return; }
                switch (product)
                {
                    case Products.Starter: Sim.GrantStarterPack(); break;
                    case Products.NoAds: Sim.GrantNoAds(); break;
                    case Products.Tickets5: Sim.GrantTimeTickets(5); break;
                }
                Sfx.Play("promo");
                G.Popups.Toast("구매 완료! 고마워요", "i_heart", Palette.Cream);
                G.Save();
                Invalidate();
            });
        }
    }
}
