using System;
using System.Globalization;

namespace Bunsin.Sim
{
    /// <summary>한국식 큰 수 표기(만·억·조·경·해·자·양…). 유효숫자 3~4자리로 줄여 쓴다.</summary>
    public static class NumberFormat
    {
        public static readonly string[] Units =
        {
            "", "만", "억", "조", "경", "해", "자", "양", "구", "간", "정", "재", "극",
            "항하사", "아승기", "나유타", "불가사의", "무량대수"
        };

        /// <summary>값이 속한 단위의 번호(0 = 만 미만, 1 = 만, 2 = 억 …).</summary>
        public static int UnitIndex(double v)
        {
            v = Math.Abs(v);
            if (v < 1e4) return 0;
            int idx = (int)Math.Floor(Math.Log10(v) / 4.0);
            // 부동소수 경계 보정 (예: 9999.9999… 억)
            if (v / Math.Pow(10, idx * 4) >= 10000) idx++;
            if (v / Math.Pow(10, idx * 4) < 1) idx--;
            if (idx >= Units.Length) idx = Units.Length - 1;
            return idx < 0 ? 0 : idx;
        }

        /// <summary>"1,234", "12.3만", "1,234억", "5.67조".</summary>
        public static string Money(double v)
        {
            if (double.IsNaN(v) || double.IsInfinity(v)) return "∞";
            if (v < 0) return "-" + Money(-v);
            if (v < 1e4) return Math.Floor(v).ToString("N0", CultureInfo.InvariantCulture);
            int idx = UnitIndex(v);
            double m = v / Math.Pow(10, idx * 4);
            string num;
            if (m >= 1000) num = Math.Floor(m).ToString("N0", CultureInfo.InvariantCulture);
            else if (m >= 100) num = Math.Floor(m).ToString("0", CultureInfo.InvariantCulture);
            else if (m >= 10) num = (Math.Floor(m * 10) / 10).ToString("0.#", CultureInfo.InvariantCulture);
            else num = (Math.Floor(m * 100) / 100).ToString("0.##", CultureInfo.InvariantCulture);
            return num + Units[idx];
        }

        public static string Won(double v) { return Money(v) + "원"; }

        /// <summary>남은 시간: "45초", "3분 20초", "2시간 5분", "3일".</summary>
        public static string Duration(double sec)
        {
            if (double.IsInfinity(sec) || double.IsNaN(sec) || sec > 86400.0 * 999) return "아주 오래";
            if (sec < 0) sec = 0;
            long s = (long)Math.Ceiling(sec);
            if (s < 60) return s + "초";
            if (s < 3600)
            {
                long m = s / 60, r = s % 60;
                return r == 0 ? m + "분" : m + "분 " + r + "초";
            }
            if (s < 86400)
            {
                long h = s / 3600, m = (s % 3600) / 60;
                return m == 0 ? h + "시간" : h + "시간 " + m + "분";
            }
            long d = s / 86400, hh = (s % 86400) / 3600;
            return hh == 0 ? d + "일" : d + "일 " + hh + "시간";
        }

        /// <summary>"12:34" 타이머 표기.</summary>
        public static string Clock(double sec)
        {
            if (sec < 0) sec = 0;
            long s = (long)Math.Ceiling(sec);
            return (s / 60).ToString("00", CultureInfo.InvariantCulture) + ":" + (s % 60).ToString("00", CultureInfo.InvariantCulture);
        }

        public static string Percent(double ratio)
        {
            return Math.Round(ratio * 100).ToString("0", CultureInfo.InvariantCulture) + "%";
        }
    }
}
