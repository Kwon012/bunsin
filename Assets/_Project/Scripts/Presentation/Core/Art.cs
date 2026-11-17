using System.Collections.Generic;
using Bunsin.Sim;
using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 스프라이트 아틀라스. Resources/Art/atlas_N.png와 atlas.csv(이름·좌표·피벗·9-slice 경계)를 읽어
    /// 실행 중에 Sprite를 만든다. 텍스처 한 장이라 UI가 한 번에 그려진다(배칭).
    /// </summary>
    public static class Art
    {
        static readonly Dictionary<string, Sprite> _sprites = new Dictionary<string, Sprite>();
        static readonly List<Texture2D> _pages = new List<Texture2D>();
        static bool _loaded;

        public static void Load()
        {
            if (_loaded) return;
            _loaded = true;
            var csv = Resources.Load<TextAsset>("Art/atlas");
            if (csv == null) { Debug.LogError("[Art] Resources/Art/atlas.csv를 찾지 못했습니다."); return; }
            var table = new CsvTable("atlas", csv.text);
            for (int r = 0; r < table.Count; r++)
            {
                int page = table.I(r, "page");
                while (_pages.Count <= page)
                {
                    var tex = Resources.Load<Texture2D>("Art/atlas_" + _pages.Count);
                    if (tex == null) Debug.LogError("[Art] atlas_" + _pages.Count + ".png를 찾지 못했습니다.");
                    else { tex.filterMode = FilterMode.Bilinear; tex.wrapMode = TextureWrapMode.Clamp; }
                    _pages.Add(tex);
                }
                var t = _pages[page];
                if (t == null) continue;
                // 가져오기 설정에 따라 텍스처 크기가 원본(2048)과 다를 수 있어 비율로 맞춘다
                float k = t.width / 2048f;
                var rect = new Rect((float)table.D(r, "x") * k, (float)table.D(r, "y") * k, (float)table.D(r, "w") * k, (float)table.D(r, "h") * k);
                var pivot = new Vector2((float)table.D(r, "pivot_x"), (float)table.D(r, "pivot_y"));
                var border = new Vector4((float)table.D(r, "border_l"), (float)table.D(r, "border_b"), (float)table.D(r, "border_r"), (float)table.D(r, "border_t")) * k;
                string name = table.S(r, "name");
                var sp = Sprite.Create(t, rect, pivot, 100f * k, 0, SpriteMeshType.FullRect, border);
                sp.name = name;
                _sprites[name] = sp;
            }
        }

        public static Sprite Get(string name)
        {
            Load();
            Sprite s;
            if (name != null && _sprites.TryGetValue(name, out s)) return s;
            if (!string.IsNullOrEmpty(name)) Debug.LogWarning("[Art] 스프라이트 없음: " + name);
            _sprites.TryGetValue("ui_white", out s);
            return s;
        }

        public static bool Has(string name) { Load(); return name != null && _sprites.ContainsKey(name); }

        public static string CloneSprite(int tier, bool cheer = false)
        {
            string key = tier >= 0 && tier < Tier.Keys.Length ? Tier.Keys[tier] : "new";
            return "clone_" + key + (cheer ? "_cheer" : "");
        }

        public static string AptIcon(int apt) { return "i_apt_" + Tier.Keys[Mathf.Clamp(apt, 0, Tier.Count - 1)]; }
    }
}
