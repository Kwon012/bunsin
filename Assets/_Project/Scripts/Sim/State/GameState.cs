using System;
using System.Collections.Generic;

namespace Bunsin.Sim
{
    // 저장되는 상태. Unity JsonUtility로 직렬화하므로 public 필드 · List · 기본형만 쓴다(딕셔너리·속성 금지).

    [Serializable]
    public class CloneState
    {
        public int id;                 // "3호"의 3. 이사해도 바뀌지 않는다
        public string name = "";       // 지어 준 이름(없으면 번호로 부름)
        public int apt;                // 적성: Tier.Alba/Job/Biz/Inv
        public int level = 1;
        public double xp;              // 다음 레벨까지 쌓인 근무 시간(초)
        public double bonusXp;         // 상한을 넘겨 저장된 '보너스 훈련'
        public int slot;               // 지금 도시의 일터 칸(1부터). 0 = 대기실(이사 직후)
        public int seat = -1;          // 자리 0~4. -1 = 대기실
        public string unique = "";     // 개성 id
        public List<string> history = new List<string>(); // 거친 직종 id (명함 이력)
        public double earnedSincePayday;
        public bool matchRewarded;     // 적성 맞는 자리 첫 배치 보상을 받았는가
        public int promotions;
        public int bornCity = 1;
    }

    [Serializable]
    public class WorkplaceState
    {
        public int slot;
        public bool open;              // 개업했는가(아랫자리에서 첫 승진 가능해질 때 열린다)
        public int facility;           // 시설 단계
        public bool cert;              // 이 일터의 자격증을 땄는가
        public int lots;               // 보유 주식 수
        public bool everStaffed;
    }

    [Serializable]
    public class PropertyState
    {
        public string id = "";
        public int city;
        public int plot;
        public int remodel;
    }

    [Serializable]
    public class HeldStock
    {
        public string jobId = "";
        public int city;
        public int lots;
        public double value;           // 이사 시점 평가액(이후 변하지 않는다)
    }

    [Serializable]
    public class HallEntry
    {
        public int id;
        public string name = "";
        public int apt;
        public string unique = "";
        public int city;
        public int level;
        public List<string> history = new List<string>();
    }

    [Serializable]
    public class PaydayLine
    {
        public string label = "";
        public double amount;
        public int kind;               // 0 분신 상여 · 1 월세 · 2 이자 · 3 배당 · 4 최소 보장 · 5 떠난 도시 자산 · 6 도시 규칙
    }

    /// <summary>월급날 명세서. 받기 전까지 쌓인다(놓친 보상은 사라지지 않는다).</summary>
    [Serializable]
    public class PaydayReport
    {
        public int count;              // 묶인 월급날 수
        public double total;
        public double bonus, rent, interest, dividend, oldCity, rule;
        public List<PaydayLine> lines = new List<PaydayLine>();
        public string deduction = "";  // 개그 공제 한 줄(금액 없음)
    }

    /// <summary>재접속 정산서.</summary>
    [Serializable]
    public class OfflineReport
    {
        public double seconds;
        public double workIncome;       // 야간 근무 합계(광고 2배 대상)
        public double envelope;         // 밀린 월급봉투(월급날 보너스 + 자산 수입)
        public int paydays;
        public int levelUps;
        public int promotable;          // 돌아왔을 때 승진 대기 중인 분신 수
        public int mvpClone;            // 가장 많이 번 분신
        public List<PaydayLine> lines = new List<PaydayLine>();
        public List<string> news = new List<string>();
    }

    [Serializable]
    public class StatBlock
    {
        public double taps, tapIncome, workIncome, paydayIncome, assetIncome, offlineIncome, eventIncome;
        public int hires, promotions, trainings, facilityUps, retirements, moves;
        public int eventsShown, eventsTaken, feverCount, bestCombo;
        public double wallSec, deadWallSec, longestDeadWallSec, idleSec;
        public List<string> firsts = new List<string>();    // "village_reveal" 같은 첫 순간 키
        public List<double> firstsAt = new List<double>();   // 그때의 누적 플레이 시간
    }

    [Serializable]
    public class GameState
    {
        public int version = 1;
        public string dataVersion = "";
        public long rng = 20261116;

        // 돈과 진행
        public double money;
        public double totalEarned, cityEarned;
        public int city = 1;
        public int nextCloneId = 1;
        public int aptCursor;
        public List<CloneState> clones = new List<CloneState>();
        public List<WorkplaceState> workplaces = new List<WorkplaceState>();

        // 시간
        public double playSec;          // 누적 접속 시간
        public double sessionSec;       // 이번 세션 시간
        public double paydayTimer;      // 다음 월급날까지 남은 접속 시간
        public int paydaysOnline;       // 접속 중 받은 월급날 수(매니저 해금 기준)
        public int paydaysTotal;
        public PaydayReport pendingPayday = new PaydayReport();
        public OfflineReport pendingOffline = new OfflineReport();
        public bool hasPendingOffline;
        public long lastSeenUnix;       // 마지막 저장 시각(UTC 초)

        // 탭·피버
        public double feverGauge;       // 0~1
        public double feverLeft;        // 남은 피버 시간
        public double sinceTap = 999;
        public int combo;
        public int feverStreak;         // 끝나자마자 다시 터뜨린 횟수

        // 해금 층(L0~L13). 비트 = 층 번호
        public int layerMask = 1;       // L0은 처음부터
        public List<int> layerQueue = new List<int>(); // 소개 카드를 기다리는 층
        public double sinceLayerIntro = 999;

        // 매니저
        public bool manager;
        public bool managerOn = true;
        public int managerRule;         // 0 = 적성 일치 우선 · 1 = 레벨 높은 순
        public double managerTimer;

        // 자산
        public double deposit;
        public List<PropertyState> properties = new List<PropertyState>();
        public List<HeldStock> heldStocks = new List<HeldStock>();
        public int houseTier;
        public List<string> luxuries = new List<string>();
        public List<string> licenses = new List<string>();
        public List<int> trophies = new List<int>();
        public int status;
        public int fame;
        public List<HallEntry> hall = new List<HallEntry>();

        // 도시 규칙 타이머
        public double ruleTimer;        // 다음 시즌·입항까지
        public double seasonLeft;       // 관광 시즌 남은 시간

        // 사건·뉴스·수집
        public string eventId = "";     // 지금 떠 있는 말풍선
        public double eventLeft;
        public int eventClone;
        public double sinceEvent = 999;
        public double sinceAction;      // 무반응 시간
        public double sinceNews;
        public int newsCursor;
        public string newsText = "";
        public List<string> eventSeen = new List<string>();
        public List<double> eventSeenAt = new List<double>();
        public List<string> seriesNext = new List<string>(); // 이어질 연작 사건 id
        public List<string> uniques = new List<string>();     // 얻은 개성(도감)
        public List<string> uniqueHint2 = new List<string>(); // 2단계 힌트가 열린 개성
        public List<string> scenes = new List<string>();      // 발견한 숨은 장면 "city:id"
        public List<string> buckets = new List<string>();     // 달성한 버킷리스트
        public List<string> unitsSeen = new List<string>();   // 설명을 본 단위
        public double sinceClosing = 999;

        // 출근 도장
        public int stampDays;
        public string stampDate = "";

        // 광고·상점
        public double boostLeft;
        public int adsToday;
        public string adsDate = "";
        public double adCooldown;
        public bool noAds;
        public bool starterPack;
        public int timeTickets;

        // 튜토리얼·설정
        public bool introDone;
        public int tutorialStep;
        public float musicVol = 0.6f;
        public float sfxVol = 1f;
        public bool bigText;
        public bool haptics = true;
        public bool notifyPayday;
        public bool notifyOffline;
        public int lastTab;

        public StatBlock stats = new StatBlock();
    }
}
