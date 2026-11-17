using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    /// <summary>적성 4계열 = 직종 계층 4개(알바·직장·사업·투자).</summary>
    public static class Tier
    {
        public const int Alba = 0, Job = 1, Biz = 2, Inv = 3;
        public const int Count = 4;
        public static readonly string[] Keys = { "alba", "job", "biz", "inv" };
        public static readonly string[] AptNames = { "현장", "사무", "장사", "투자" };
        public static readonly string[] Labels = { "알바", "직장", "사업", "투자" };

        public static int Parse(string key)
        {
            for (int i = 0; i < Keys.Length; i++) if (Keys[i] == key) return i;
            return -1;
        }
    }

    public sealed class CityData
    {
        public int Index;            // 1부터
        public string Id, Name, Theme;
        public int Slots;
        public double TapBase, HireBase, FameUnit;
        public int Plots;
        public string Rule;          // none·season·ipo·royalty·trade·boom·angel·holding
        public double RuleA, RuleB;
        public string RuleText, TopBuilding, Color;
        public readonly List<JobData> Jobs = new List<JobData>();
        public readonly List<PropertyData> Properties = new List<PropertyData>();
        public TrophyData Trophy;
    }

    public sealed class JobData
    {
        public int City, Slot;
        public string Id, Name, TierLabel, PaydayLine, Cert, Company, Sprite;
        public int Tier;
        public double BaseIncome, PromoCost, FacilityBaseCost, PaydayShare, OfflineRate, CertCost;
        public int ReqStatus;
        public bool IsTop;
    }

    public sealed class StatusData
    {
        public int Rank;
        public string Name, Desc;
        public double NetWorth;
        public int HouseTier, LuxurySets;
    }

    public sealed class HouseData
    {
        public int Tier;
        public string Name, Bg, Desc;
        public double Price;
    }

    public sealed class PropertyData
    {
        public string Id, Name, Sprite;
        public int City, ReqStatus, BoostTier; // BoostTier -1 = 없음
        public double Price, BoostPct;
    }

    public sealed class LuxuryData
    {
        public string Id, SetName, Part, Name;
        public int Set, ReqStatus;
        public double Price, LicenseCost;
    }

    public sealed class TrophyData
    {
        public int City, ReqStatus;
        public string Name;
        public double Price;
    }

    public sealed class LayerData
    {
        public int Id;               // L0~L13
        public string Key, Name, Speaker, Text, Hint;
    }

    public sealed class EventData
    {
        public string Id, Type, Text, ChoiceA, ChoiceB, Series, Next;
        public double ResultA, ResultB; // 보상 = 초당 수입 × 이 초
        public int MinLayer;
    }

    public sealed class UniqueData
    {
        public string Id, Name, Condition, Hint1, Hint2, Passive, Prop, Line;
        public double Value;
    }

    public sealed class BucketData
    {
        public string Id, Name, Condition, Text;
        public double Param;
    }

    public sealed class SceneData { public string Id, Name, Text; }

    /// <summary>CSV에서 읽은 읽기 전용 게임 데이터. 수치는 코드가 아니라 표에 둔다.</summary>
    public sealed class GameData
    {
        public static readonly string[] Files =
        {
            "economy", "cities", "jobs", "status", "houses", "properties", "luxury", "trophies",
            "layers", "events", "uniques", "bucket", "scenes", "news", "lines"
        };

        public readonly Dictionary<string, double> Econ = new Dictionary<string, double>();
        public string DataVersion = "";
        public readonly List<CityData> Cities = new List<CityData>();
        public readonly Dictionary<string, JobData> JobsById = new Dictionary<string, JobData>();
        public readonly List<StatusData> Status = new List<StatusData>();
        public readonly List<HouseData> Houses = new List<HouseData>();
        public readonly Dictionary<string, PropertyData> PropertiesById = new Dictionary<string, PropertyData>();
        public readonly List<LuxuryData> Luxuries = new List<LuxuryData>();
        public readonly Dictionary<string, LuxuryData> LuxuriesById = new Dictionary<string, LuxuryData>();
        public readonly List<LayerData> Layers = new List<LayerData>();
        public readonly List<EventData> Events = new List<EventData>();
        public readonly Dictionary<string, EventData> EventsById = new Dictionary<string, EventData>();
        public readonly List<UniqueData> Uniques = new List<UniqueData>();
        public readonly Dictionary<string, UniqueData> UniquesById = new Dictionary<string, UniqueData>();
        public readonly List<BucketData> Buckets = new List<BucketData>();
        public readonly List<SceneData> Scenes = new List<SceneData>();
        public readonly List<string> News = new List<string>();
        /// <summary>kind → (key, text) 목록. 대사·문구 풀.</summary>
        public readonly Dictionary<string, List<KeyValuePair<string, string>>> Lines =
            new Dictionary<string, List<KeyValuePair<string, string>>>();

        // 자주 쓰는 상수 (economy.csv에서 채움)
        public int SeatsPerJob, LevelPerSlot, FacilityMaxLevel, FacilityStageLevels;
        public double PaydayPeriod, PaydayFirst;

        public double E(string key)
        {
            double v;
            if (!Econ.TryGetValue(key, out v)) throw new KeyNotFoundException("economy.csv에 키가 없음: " + key);
            return v;
        }

        public CityData City(int index) { return Cities[index - 1]; }

        public JobData Job(int city, int slot) { return Cities[city - 1].Jobs[slot - 1]; }

        public string Line(string kind, string key)
        {
            List<KeyValuePair<string, string>> list;
            if (!Lines.TryGetValue(kind, out list)) return "";
            for (int i = 0; i < list.Count; i++) if (list[i].Key == key) return list[i].Value;
            return "";
        }

        public List<KeyValuePair<string, string>> LinePool(string kind)
        {
            List<KeyValuePair<string, string>> list;
            return Lines.TryGetValue(kind, out list) ? list : _empty;
        }
        static readonly List<KeyValuePair<string, string>> _empty = new List<KeyValuePair<string, string>>();

        /// <param name="read">파일 이름(확장자 없음) → CSV 원문. Unity에서는 Resources, 테스트에서는 파일.</param>
        public static GameData Load(Func<string, string> read)
        {
            var d = new GameData();

            var econ = new CsvTable("economy", read("economy"));
            for (int r = 0; r < econ.Count; r++)
            {
                string key = econ.S(r, "key").Trim();
                if (key == "data_version") { d.DataVersion = econ.S(r, "value").Trim(); continue; }
                d.Econ[key] = econ.D(r, "value");
            }
            d.SeatsPerJob = (int)d.E("seats_per_job");
            d.LevelPerSlot = (int)d.E("level_per_slot");
            d.FacilityMaxLevel = (int)d.E("facility_max_level");
            d.FacilityStageLevels = (int)d.E("facility_stage_levels");
            d.PaydayPeriod = d.E("payday_period_sec");
            d.PaydayFirst = d.E("payday_first_sec");

            var cities = new CsvTable("cities", read("cities"));
            for (int r = 0; r < cities.Count; r++)
            {
                d.Cities.Add(new CityData
                {
                    Index = cities.I(r, "city"), Id = cities.S(r, "id"), Name = cities.S(r, "name"),
                    Theme = cities.S(r, "theme"), Slots = cities.I(r, "slots"),
                    TapBase = cities.D(r, "tap_base"), HireBase = cities.D(r, "hire_base"),
                    FameUnit = cities.D(r, "fame_unit"), Plots = cities.I(r, "plots"),
                    Rule = cities.S(r, "rule"), RuleA = cities.D(r, "rule_a"), RuleB = cities.D(r, "rule_b"),
                    RuleText = cities.S(r, "rule_text"), TopBuilding = cities.S(r, "top_building"),
                    Color = cities.S(r, "color"),
                });
            }

            var jobs = new CsvTable("jobs", read("jobs"));
            for (int r = 0; r < jobs.Count; r++)
            {
                var j = new JobData
                {
                    City = jobs.I(r, "city"), Slot = jobs.I(r, "slot"), Id = jobs.S(r, "id"), Name = jobs.S(r, "name"),
                    Tier = Tier.Parse(jobs.S(r, "tier")), TierLabel = jobs.S(r, "tier_label"),
                    BaseIncome = jobs.D(r, "base_income"), PromoCost = jobs.D(r, "promo_cost"),
                    FacilityBaseCost = jobs.D(r, "facility_base_cost"), PaydayShare = jobs.D(r, "payday_share"),
                    OfflineRate = jobs.D(r, "offline_rate"), PaydayLine = jobs.S(r, "payday_line"),
                    Cert = jobs.S(r, "cert"), CertCost = jobs.D(r, "cert_cost"), ReqStatus = jobs.I(r, "req_status"),
                    IsTop = jobs.I(r, "is_top") == 1, Company = jobs.S(r, "company"), Sprite = jobs.S(r, "sprite"),
                };
                d.City(j.City).Jobs.Add(j);
                d.JobsById[j.Id] = j;
            }

            var status = new CsvTable("status", read("status"));
            for (int r = 0; r < status.Count; r++)
                d.Status.Add(new StatusData
                {
                    Rank = status.I(r, "rank"), Name = status.S(r, "name"), NetWorth = status.D(r, "net_worth"),
                    HouseTier = status.I(r, "house_tier"), LuxurySets = status.I(r, "luxury_sets"), Desc = status.S(r, "desc"),
                });

            var houses = new CsvTable("houses", read("houses"));
            for (int r = 0; r < houses.Count; r++)
                d.Houses.Add(new HouseData
                {
                    Tier = houses.I(r, "tier"), Name = houses.S(r, "name"), Price = houses.D(r, "price"),
                    Bg = houses.S(r, "bg"), Desc = houses.S(r, "desc"),
                });

            var props = new CsvTable("properties", read("properties"));
            for (int r = 0; r < props.Count; r++)
            {
                var p = new PropertyData
                {
                    Id = props.S(r, "id"), City = props.I(r, "city"), Name = props.S(r, "name"),
                    Price = props.D(r, "price"), ReqStatus = props.I(r, "req_status"),
                    BoostTier = Tier.Parse(props.S(r, "boost_tier")), BoostPct = props.D(r, "boost_pct"),
                    Sprite = props.S(r, "sprite"),
                };
                d.City(p.City).Properties.Add(p);
                d.PropertiesById[p.Id] = p;
            }

            var lux = new CsvTable("luxury", read("luxury"));
            for (int r = 0; r < lux.Count; r++)
            {
                var l = new LuxuryData
                {
                    Id = lux.S(r, "id"), Set = lux.I(r, "set"), SetName = lux.S(r, "set_name"), Part = lux.S(r, "part"),
                    Name = lux.S(r, "name"), Price = lux.D(r, "price"), ReqStatus = lux.I(r, "req_status"),
                    LicenseCost = lux.D(r, "license_cost"),
                };
                d.Luxuries.Add(l);
                d.LuxuriesById[l.Id] = l;
            }

            var trophies = new CsvTable("trophies", read("trophies"));
            for (int r = 0; r < trophies.Count; r++)
            {
                var t = new TrophyData
                {
                    City = trophies.I(r, "city"), Name = trophies.S(r, "name"), Price = trophies.D(r, "price"),
                    ReqStatus = trophies.I(r, "req_status"),
                };
                d.City(t.City).Trophy = t;
            }

            var layers = new CsvTable("layers", read("layers"));
            for (int r = 0; r < layers.Count; r++)
                d.Layers.Add(new LayerData
                {
                    Id = layers.I(r, "id"), Key = layers.S(r, "key"), Name = layers.S(r, "name"),
                    Speaker = layers.S(r, "speaker"), Text = layers.S(r, "text"), Hint = layers.S(r, "hint"),
                });

            var events = new CsvTable("events", read("events"));
            for (int r = 0; r < events.Count; r++)
            {
                var e = new EventData
                {
                    Id = events.S(r, "id"), Type = events.S(r, "type"), Text = events.S(r, "text"),
                    ChoiceA = events.S(r, "choice_a"), ResultA = events.D(r, "result_a"),
                    ChoiceB = events.S(r, "choice_b"), ResultB = events.D(r, "result_b"),
                    Series = events.S(r, "series"), Next = events.S(r, "next"), MinLayer = events.I(r, "min_layer"),
                };
                d.Events.Add(e);
                d.EventsById[e.Id] = e;
            }

            var uniques = new CsvTable("uniques", read("uniques"));
            for (int r = 0; r < uniques.Count; r++)
            {
                var u = new UniqueData
                {
                    Id = uniques.S(r, "id"), Name = uniques.S(r, "name"), Condition = uniques.S(r, "condition"),
                    Hint1 = uniques.S(r, "hint1"), Hint2 = uniques.S(r, "hint2"), Passive = uniques.S(r, "passive"),
                    Value = uniques.D(r, "value"), Prop = uniques.S(r, "prop"), Line = uniques.S(r, "line"),
                };
                d.Uniques.Add(u);
                d.UniquesById[u.Id] = u;
            }

            var bucket = new CsvTable("bucket", read("bucket"));
            for (int r = 0; r < bucket.Count; r++)
                d.Buckets.Add(new BucketData
                {
                    Id = bucket.S(r, "id"), Name = bucket.S(r, "name"), Condition = bucket.S(r, "condition"),
                    Param = bucket.D(r, "param"), Text = bucket.S(r, "text"),
                });

            var scenes = new CsvTable("scenes", read("scenes"));
            for (int r = 0; r < scenes.Count; r++)
                d.Scenes.Add(new SceneData { Id = scenes.S(r, "id"), Name = scenes.S(r, "name"), Text = scenes.S(r, "text") });

            var news = new CsvTable("news", read("news"));
            for (int r = 0; r < news.Count; r++) d.News.Add(news.S(r, "text"));

            var lines = new CsvTable("lines", read("lines"));
            for (int r = 0; r < lines.Count; r++)
            {
                string kind = lines.S(r, "kind");
                List<KeyValuePair<string, string>> list;
                if (!d.Lines.TryGetValue(kind, out list)) d.Lines[kind] = list = new List<KeyValuePair<string, string>>();
                list.Add(new KeyValuePair<string, string>(lines.S(r, "key"), lines.S(r, "text")));
            }

            d.Validate();
            return d;
        }

        /// <summary>표끼리 어긋난 곳이 있으면 예외로 알린다(잘못된 데이터로 게임이 조용히 깨지지 않게).</summary>
        public void Validate()
        {
            if (Cities.Count == 0) throw new FormatException("cities.csv: 도시가 없음");
            for (int c = 0; c < Cities.Count; c++)
            {
                var city = Cities[c];
                if (city.Index != c + 1) throw new FormatException("cities.csv: 도시 번호가 순서대로가 아님 (" + city.Id + ")");
                if (city.Jobs.Count != city.Slots)
                    throw new FormatException("jobs.csv: " + city.Name + " 칸 수 " + city.Jobs.Count + " ≠ " + city.Slots);
                int tops = 0;
                for (int s = 0; s < city.Jobs.Count; s++)
                {
                    var j = city.Jobs[s];
                    if (j.Slot != s + 1) throw new FormatException("jobs.csv: " + city.Name + " 칸 순서 오류");
                    if (j.Tier < 0) throw new FormatException("jobs.csv: " + j.Id + " tier 오류");
                    if (j.BaseIncome <= 0) throw new FormatException("jobs.csv: " + j.Id + " 수입이 0 이하");
                    if (s > 0 && j.BaseIncome <= city.Jobs[s - 1].BaseIncome)
                        throw new FormatException("jobs.csv: " + j.Id + " 윗자리 수입이 아랫자리보다 작음");
                    if (j.IsTop) tops++;
                    if (j.ReqStatus >= Status.Count) throw new FormatException("jobs.csv: " + j.Id + " 신분 조건이 범위를 벗어남");
                }
                if (tops != 1 || !city.Jobs[city.Jobs.Count - 1].IsTop)
                    throw new FormatException("jobs.csv: " + city.Name + " 꼭대기 직종은 마지막 칸 하나여야 함");
                if (c > 0 && city.Jobs[0].BaseIncome <= Cities[c - 1].Jobs[Cities[c - 1].Jobs.Count - 1].BaseIncome)
                    throw new FormatException("jobs.csv: " + city.Name + " 첫 일터가 이전 도시 꼭대기보다 덜 범(R-014 의도 위반)");
                if (city.Trophy == null) throw new FormatException("trophies.csv: " + city.Name + " 트로피 없음");
                if (city.Properties.Count == 0) throw new FormatException("properties.csv: " + city.Name + " 부동산 없음");
            }
            if (Houses.Count != Status.Count) throw new FormatException("houses.csv와 status.csv 단계 수가 다름");
            for (int i = 0; i < Status.Count; i++)
                if (Status[i].Rank != i || Houses[i].Tier != i) throw new FormatException("status/houses: 단계 번호 오류");
            if (Layers.Count < 13) throw new FormatException("layers.csv: 해금 층이 부족함");
            for (int i = 0; i < Layers.Count; i++)
                if (Layers[i].Id != i) throw new FormatException("layers.csv: 층 번호가 0부터 순서대로가 아님");
            foreach (var e in Events)
                if (e.Next.Length > 0 && !EventsById.ContainsKey(e.Next))
                    throw new FormatException("events.csv: " + e.Id + " 의 next '" + e.Next + "' 가 없음");
        }
    }
}
