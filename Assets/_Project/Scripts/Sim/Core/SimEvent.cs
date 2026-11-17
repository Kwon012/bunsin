namespace Bunsin.Sim
{
    /// <summary>해금 층(L0~L13). 기획서 v4 7.1.</summary>
    public static class Layer
    {
        public const int Tap = 0, FirstClone = 1, Train = 2, Village = 3, Payday = 4, Facility = 5, Manager = 6,
            Deposit = 7, Property = 8, Stock = 9, Status = 10, Retire = 11, Move = 12, CityRule = 13;
    }

    public enum SimEventType
    {
        MoneyGain,        // V = 금액, A = 원천(0 탭 · 1 사건 · 2 월급날 · 3 정산 · 4 매각 · 5 기타)
        CloneHired,       // A = 분신 id
        CloneSeated,      // A = 분신 id (대기실 → 자리)
        LevelUp,          // A = 분신 id, B = 새 레벨
        PromoReady,       // A = 분신 id
        Promoted,         // A = 분신 id, B = 새 칸
        AptMatch,         // A = 분신 id, V = 보상
        Retired,          // A = 분신 id
        Trained,          // A = 분신 id
        FacilityUp,       // A = 칸, B = 새 단계
        WorkplaceOpened,  // A = 칸
        CertBought,       // A = 칸
        VillageReveal,
        PaydaySoon,       // 10초 전
        PaydayReady,
        PaydayCollected,  // V = 금액
        FeverStart,
        FeverEnd,         // A = 콤보
        LayerUnlocked,    // A = 층
        EventBubble,      // S = 사건 id, A = 분신 id
        EventExpired,
        EventResolved,    // S = 사건 id, V = 보상
        News,             // S = 문장
        UniqueGained,     // S = 개성 id, A = 분신 id
        SceneFound,       // S = 장면 id
        BucketDone,       // S = 버킷 id
        UnitSeen,         // S = 단위
        StatusUp,         // A = 새 등급
        AssetBought,      // S = 이름, A = 종류(0 부동산 · 1 주식 · 2 집 · 3 사치품 · 4 트로피 · 5 리모델링 · 6 면허)
        SetComplete,      // A = 세트 번호
        DepositChanged,   // V = 잔액
        ManagerUnlocked,
        ManagerActed,     // S = 한 일
        Moved,            // A = 새 도시, B = 얻은 명성
        SeasonStart,
        SeasonEnd,
        TradeArrived,     // V = 금액
        ClosingCard,
        Stamp,            // A = 일차
        Boost,            // V = 남은 시간
    }

    public struct SimEvent
    {
        public SimEventType Type;
        public int A, B;
        public double V;
        public string S;
    }

    public enum ActionKind
    {
        None, Hire, Train, Promote, Cert, Facility, Stock, Property, Remodel, House, Luxury, License, Trophy, Move
    }

    /// <summary>추천·목표·매니저가 공통으로 쓰는 '할 수 있는 일' 한 가지.</summary>
    public struct SimAction
    {
        public ActionKind Kind;
        public int Slot;        // 일터 칸 또는 부동산 번호
        public int CloneId;
        public string Id;       // 부동산·사치품 id
        public double Cost;
        public double Gain;     // 초당 수입 증가(추정)
        public string Label;

        public bool Valid { get { return Kind != ActionKind.None; } }
        public double Payback { get { return Gain > 0 ? Cost / Gain : double.PositiveInfinity; } }
    }

    public enum PromoBlock { None, NotSeated, IsTop, Level, Closed, Full, Cert, Status, Money }
}
