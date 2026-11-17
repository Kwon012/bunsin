using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Bunsin.Sim
{
    /// <summary>헤더가 있는 CSV 표. 큰따옴표·줄바꿈·BOM을 처리한다.</summary>
    public sealed class CsvTable
    {
        public readonly string Name;
        public readonly string[] Header;
        public readonly List<string[]> Rows = new List<string[]>();
        readonly Dictionary<string, int> _col = new Dictionary<string, int>();

        public CsvTable(string name, string text)
        {
            Name = name;
            var all = Parse(text);
            if (all.Count == 0) throw new FormatException(name + ": 빈 CSV");
            Header = all[0];
            for (int i = 0; i < Header.Length; i++) _col[Header[i].Trim()] = i;
            for (int r = 1; r < all.Count; r++)
            {
                var row = all[r];
                if (row.Length == 1 && row[0].Trim().Length == 0) continue; // 빈 줄
                Rows.Add(row);
            }
        }

        public int Count { get { return Rows.Count; } }

        public bool Has(string col) { return _col.ContainsKey(col); }

        public string S(int row, string col)
        {
            int c;
            if (!_col.TryGetValue(col, out c)) throw new KeyNotFoundException(Name + ": 열 없음 '" + col + "'");
            var r = Rows[row];
            return c < r.Length ? r[c] : "";
        }

        public double D(int row, string col)
        {
            var s = S(row, col).Trim();
            if (s.Length == 0) return 0;
            double v;
            if (!double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v))
                throw new FormatException(Name + " " + (row + 2) + "행 '" + col + "': 숫자가 아님 '" + s + "'");
            return v;
        }

        public int I(int row, string col) { return (int)Math.Round(D(row, col)); }

        public static List<string[]> Parse(string text)
        {
            var rows = new List<string[]>();
            if (string.IsNullOrEmpty(text)) return rows;
            int i = 0, n = text.Length;
            if (text[0] == '﻿') i = 1;
            var cur = new List<string>();
            var sb = new StringBuilder();
            bool inQ = false, any = false;
            for (; i < n; i++)
            {
                char ch = text[i];
                if (inQ)
                {
                    if (ch == '"')
                    {
                        if (i + 1 < n && text[i + 1] == '"') { sb.Append('"'); i++; }
                        else inQ = false;
                    }
                    else sb.Append(ch);
                    continue;
                }
                if (ch == '"') { inQ = true; any = true; }
                else if (ch == ',') { cur.Add(sb.ToString()); sb.Length = 0; any = true; }
                else if (ch == '\r') { }
                else if (ch == '\n')
                {
                    if (any || sb.Length > 0) { cur.Add(sb.ToString()); rows.Add(cur.ToArray()); }
                    cur.Clear(); sb.Length = 0; any = false;
                }
                else sb.Append(ch);
            }
            if (any || sb.Length > 0) { cur.Add(sb.ToString()); rows.Add(cur.ToArray()); }
            return rows;
        }
    }
}
