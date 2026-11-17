using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 아트 바이블의 색. 프로젝트의 모든 색은 여기서만 읽는다(Tools/art/sprites.js의 P와 같은 값).
    /// 스타일: 치비 2D 플랫 + 굵은 낙서풍 외곽선, 전원 같은 얼굴. 분위기: 늦은 오후 골목의 따뜻한 빛, 그림자는 보랏빛.
    /// 순수한 검정·회색 기본값은 쓰지 않는다.
    /// </summary>
    public static class Palette
    {
        public static readonly Color Ink = Hex("3A2E39");        // 외곽선·본문 글자
        public static readonly Color InkSoft = Hex("7A7180");    // 보조 글자
        public static readonly Color Paper = Hex("FFF4DC");      // 기본 바탕
        public static readonly Color Cream = Hex("FFE9BF");      // 카드 안쪽·구분
        public static readonly Color White = Hex("FFFFFF");
        public static readonly Color Yellow = Hex("FFC53D");     // 주 행동·돈
        public static readonly Color Orange = Hex("FF9F45");     // 사업
        public static readonly Color Coral = Hex("FF6B5E");      // 알림·강조
        public static readonly Color Green = Hex("2BB673");      // 가능·수입
        public static readonly Color Mint = Hex("9ED8A0");       // 언덕
        public static readonly Color Sky = Hex("6EC5E9");        // 알바·하늘
        public static readonly Color Blue = Hex("4A90D9");
        public static readonly Color Purple = Hex("A78BFA");     // 투자
        public static readonly Color Pink = Hex("FF8FAB");
        public static readonly Color Leaf = Hex("8BD17C");       // 직장
        public static readonly Color Wood = Hex("B98B5E");
        public static readonly Color Gray = Hex("B9B2BD");       // 비활성
        public static readonly Color Shadow = Hex("5B4B6B");     // 그림자·가림막(검정 대신)
        public static readonly Color Night = Hex("2E2A4F");

        /// <summary>직종 계층 색 = 적성 색 = 일터 색 = 도감 색(설명 없이 연결된다).</summary>
        public static readonly Color[] Tier = { Sky, Leaf, Orange, Purple };

        public static Color Scrim { get { return new Color(Shadow.r * 0.5f, Shadow.g * 0.45f, Shadow.b * 0.6f, 0.72f); } }

        public static Color Alpha(Color c, float a) { return new Color(c.r, c.g, c.b, a); }
        public static Color Mix(Color a, Color b, float t) { return Color.Lerp(a, b, t); }

        public static Color Hex(string hex)
        {
            if (hex.StartsWith("#")) hex = hex.Substring(1);
            int r = System.Convert.ToInt32(hex.Substring(0, 2), 16);
            int g = System.Convert.ToInt32(hex.Substring(2, 2), 16);
            int b = System.Convert.ToInt32(hex.Substring(4, 2), 16);
            return new Color(r / 255f, g / 255f, b / 255f, 1f);
        }
    }
}
