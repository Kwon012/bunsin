#!/usr/bin/env python3
"""경제 데이터 CSV 생성기 (v4 B안 · 데이터 v0.4).

기획서 'v4 방향 검토(제안)'은 규칙과 벽만 정하고 수치는 정하지 않았다.
이 파일의 모든 수치는 구조 검증용 임시값(가정)이다. 고칠 때는 여기 PARAMS만 고치고
다시 실행한다:  python3 Tools/gen_data.py

출력: Assets/_Project/Resources/Data/{economy,cities,jobs,status,houses,properties,luxury,trophies}.csv
콘텐츠 CSV(events, news, lines 등)는 손으로 쓰는 파일이라 이 스크립트가 건드리지 않는다.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Assets", "_Project", "Resources", "Data")

# ---------------------------------------------------------------- 전역 상수
ECONOMY = [
    # key, value, note
    ("data_version", "0.4", "v4 B안(S2·P1) 임시 수치"),
    ("seats_per_job", 5, "일터마다 자리 5칸"),
    ("payday_first_sec", 180, "첫 월급날(누적 접속 시간)"),
    ("payday_period_sec", 600, "월급날 주기 = 게임 속 한 달"),
    ("payday_min_income_sec", 120, "월급날 보너스 하한 = 초당 수입 × 이 값"),
    ("tap_income_ratio", 0.12, "탭 1회 = tap_base + 초당 수입 × 이 값"),
    ("hold_taps_per_sec", 3, "꾹 누르기 자동 탭 속도"),
    ("fever_taps", 30, "피버 게이지를 채우는 탭 수"),
    ("fever_hold_charge", 0.34, "꾹 누르기 탭의 게이지 충전 비율"),
    ("fever_duration_sec", 15, "피버 지속 시간"),
    ("fever_mult", 3, "피버 중 근로 수입 배수"),
    ("fever_decay_delay_sec", 3, "탭을 멈춘 뒤 게이지가 줄기 시작하는 시간"),
    ("fever_decay_per_sec", 0.05, "게이지 감쇠(초당 비율)"),
    ("hire_growth", 1.5, "신입 고용가 증가율(현재 분신 수 기준)"),
    ("level_bonus", 0.04, "레벨 1당 수입 +4%(더하기)"),
    ("apt_bonus", 0.25, "적성 일치 수입 보너스"),
    ("apt_xp_bonus", 0.25, "적성 일치 경험 보너스"),
    ("apt_first_match_reward_sec", 20, "적성 맞는 자리 첫 배치 보상 = 초당 수입 × 이 값"),
    ("xp_base_sec", 20, "레벨 1→2에 필요한 근무 시간(초)"),
    ("xp_growth", 1.09, "레벨마다 필요 시간 증가율"),
    ("level_per_slot", 10, "칸마다 승진 기준 레벨 = 칸 × 이 값"),
    ("bonus_xp_cap_levels", 3, "상한을 넘겨 저장되는 보너스 훈련의 최대량(레벨 수)"),
    ("train_cost_factor", 0.6, "훈련비 = 전체 초당 수입 × 남은 경험(초) × 이 값 (하한: 그 분신 수입 × 남은 경험 × 2)"),
    ("promo_cost_sec", 600, "승진비 = 윗자리 기본 수입 × 이 값"),
    ("cert_cost_mult", 2, "자격증 가격 = 승진비 × 이 값(도시마다 1회)"),
    ("facility_bonus", 0.04, "시설 1단계당 일터 수입 +4%(더하기). 최고 단계 × 자산 보너스가 칸 사이 배율보다 작아야 승진이 항상 이득"),
    ("facility_cost_sec", 400, "시설 첫 단계 가격 = 일터 기본 수입 × 이 값"),
    ("facility_growth", 1.2, "시설 가격 증가율"),
    ("facility_max_level", 20, "시설 최고 단계"),
    ("facility_stage_levels", 5, "시설 5단계마다 '등급' 1 상승"),
    ("cap_per_facility_stage", 2, "시설 등급 1당 그 일터 레벨 상한 +2"),
    ("offline_cap_sec", 28800, "오프라인 정산 상한(8시간)"),
    ("offline_after_cap_ratio", 0.25, "상한 이후 누적 속도"),
    ("offline_xp_rate", 1.0, "오프라인 경험 누적 비율"),
    ("offline_min_sec", 60, "이보다 짧은 부재는 정산서를 띄우지 않음"),
    ("manager_unlock_paydays", 4, "접속 중 월급날 수령 횟수로 매니저 무료 해금"),
    ("manager_interval_sec", 1.5, "매니저가 추천 행동을 실행하는 간격"),
    ("fame_bonus", 0.05, "명성 1당 수입 +5%(더하기)"),
    ("retire_bonus", 0.01, "명예의 전당 1명당 수입 +1%(명성 원천에 더하기)"),
    ("retire_cap_extra_levels", 10, "꼭대기 자리 은퇴 기준 = 승진 기준 레벨 + 이 값"),
    ("move_keep_level_ratio", 0.3, "이사 때 유지되는 레벨 비율(P1 경력직)"),
    ("move_recommend_eta_sec", 180, "다음 추천 구매까지 이 시간이 넘으면 이사 추천(R-015 벽 기준)"),
    ("settle_hire_count", 3, "정착금 = 새 도시 신입 고용가 × 이 값"),
    ("deposit_rate", 0.02, "예금 이자(월급날마다)"),
    ("deposit_cap_income_sec", 3600, "예금 한도 = 초당 수입 × 이 값"),
    ("stock_list_level", 10, "일터 시설이 이 단계면 상장"),
    ("stock_lot_cost_sec", 400, "주식 1주 가격 = 일터 기본 수입 × 이 값 × (1 + 0.1 × 시설 단계)"),
    ("stock_dividend_rate", 0.03, "배당 = 보유 평가액 × 이 값(월급날마다)"),
    ("stock_bonus_per_lot", 0.01, "1주당 그 일터 수입 +1%(자산 원천)"),
    ("property_rent_rate", 0.04, "월세 = 매입가 × 이 값(월급날마다)"),
    ("property_remodel_max", 3, "리모델링 최대 단계"),
    ("property_remodel_cost_ratio", 0.5, "리모델링 비용 = 매입가 × 이 값"),
    ("property_remodel_rent_bonus", 0.4, "리모델링 1단계당 월세 +40%"),
    ("old_city_asset_cap_income_sec", 300, "떠난 도시 자산 수입 상한(월급날당) = 지금 초당 수입 × 이 값"),
    ("event_idle_sec", 12, "무반응이 이만큼 이어지면 사건 말풍선"),
    ("event_min_gap_sec", 30, "사건 최소 간격"),
    ("event_early_gap_sec", 20, "세션 첫 3분의 사건 최소 간격"),
    ("event_early_window_sec", 180, "세션 초반 구간"),
    ("event_bubble_sec", 25, "말풍선 유지 시간"),
    ("event_repeat_gap_sec", 600, "같은 사건 재등장 간격"),
    ("news_interval_sec", 60, "마을 뉴스 간격"),
    ("closing_idle_sec", 20, "마무리 카드 제안까지의 무반응 시간"),
    ("closing_gap_sec", 600, "마무리 카드 재제안 간격"),
    ("layer_gap_sec", 90, "새 시스템 소개 사이의 최소 간격"),
    ("ad_boost_mult", 2, "보상형 광고 부스트 배수"),
    ("ad_boost_sec", 600, "보상형 광고 부스트 시간"),
    ("ad_daily_cap", 6, "보상형 광고 일일 상한"),
    ("ad_cooldown_sec", 120, "보상형 광고 쿨타임"),
    ("time_ticket_sec", 7200, "시간 가속권 1장 = 이 시간만큼의 수입"),
    ("stamp_gift_day", 7, "출근 도장 기념 분신(개성) 지급 일차"),
]

# ---------------------------------------------------------------- 도시·일터
# (id, 이름, 테마, 칸 수, 칸 사이 수입 배율, 부지 수, 규칙 id, 규칙 값1, 규칙 값2, 규칙 한 줄, 꼭대기 건물, 색)
CITIES = [
    ("home", "우리 동네", "생계·골목 장사", 5, 3.0, 4, "none", 0, 0, "기본 규칙을 배우는 동네", "언덕 위 분식집 본점", "#9ED8A0"),
    ("busan", "부산", "바다·관광·개발", 6, 2.8, 5, "season", 1200, 180, "관광 시즌: 20분마다 3분간 알바 수입 2배", "해운대 101층 타워", "#6EC5E9"),
    ("yeouido", "여의도", "금융", 7, 2.6, 6, "ipo", 5, 1.5, "상장 우대: 시설 5단계면 상장, 배당 1.5배", "여의도 마천루", "#A78BFA"),
    ("tokyo", "도쿄", "콘텐츠·캐릭터 IP", 8, 2.4, 6, "royalty", 2, 0, "IP 로열티: 떠난 도시 자산 수입 상한 2배", "도쿄 타워", "#FF8FAB"),
    ("shanghai", "상하이", "제조·무역", 8, 2.4, 7, "trade", 1800, 300, "무역 입항: 30분마다 수입 5분치 입금", "와이탄 스카이라인", "#FF9F45"),
    ("dubai", "두바이", "초대형 개발·오일", 8, 2.4, 7, "boom", 1.5, 0, "개발 붐: 이 도시 월세 1.5배", "사막 초고층", "#F2C14E"),
    ("valley", "실리콘밸리", "테크·AI", 8, 2.4, 8, "angel", 2, 0, "엔젤 투자: 주식 배당 2배", "우주선 캠퍼스", "#5ED3C6"),
    ("newyork", "뉴욕", "월가·세계 경영", 8, 2.4, 8, "holding", 5, 0, "지주회사: 떠난 도시 자산 수입 상한 5배", "맨해튼 펜트하우스", "#8FA7FF"),
]
FIRST_INCOME = 3600.0  # 편의점 알바 분신 Lv1 초당 수입. × 600초 = 월 216만 원(2026 최저임금 월 환산 근사)
CITY_JUMP = 1.5        # 다음 도시 1칸 기본 수입 = 이전 도시 꼭대기 × 이 값 (R-014 의도 유지)
HIRE_BASE_SEC = 80     # 신입 고용 기준가 = 도시 1칸 기본 수입 × 이 값
TAP_BASE_RATIO = 0.28  # 탭 기본값 = 도시 1칸 기본 수입 × 이 값
FAME_UNIT_SEC = 2.0e4  # 명성 단위 = 꼭대기 기본 수입 × 이 값 (도시 누적 수입 ÷ 단위의 제곱근)

TIERS = {  # tier: (라벨, 월급날 몫, 오프라인 비율, 명세서 항목)
    "alba": ("알바", 0.10, 0.25, "주휴수당"),
    "job": ("직장", 0.60, 0.25, "월급 상여"),
    "biz": ("사업", 0.30, 0.25, "결산 보너스"),
    "inv": ("투자", 0.30, 1.00, "운용 수익"),
}
SLOT_TIER = {1: "alba", 2: "alba", 3: "alba", 4: "job", 5: "biz", 6: "biz", 7: "inv", 8: "inv"}

# 도시별 (직종 이름, 회사 이름(패러디), 건물 스프라이트 키)
JOBS = {
    "home": [
        ("편의점 알바", "분신마트24", "b_store"), ("배달 라이더", "번개배달", "b_delivery"),
        ("카페 알바", "카페 미러", "b_cafe"), ("중소기업 사원", "(주)복사상사", "b_office"),
        ("분식집 사장", "분신분식", "b_shop"),
    ],
    "busan": [
        ("자갈치시장 알바", "자갈자갈수산", "b_store"), ("해수욕장 파라솔 대여", "파라솔 형제", "b_delivery"),
        ("돼지국밥집 알바", "국밥 한그릇", "b_cafe"), ("항만 물류 사원", "부두로지스", "b_office"),
        ("게스트하우스 사장", "파도소리 게하", "b_shop"), ("해운대 개발 시행사 대표", "해운대디벨롭", "b_tower"),
    ],
    "yeouido": [
        ("직장인 도시락 배달", "점심특공대", "b_store"), ("서류 퀵 배달원", "늘찬퀵", "b_delivery"),
        ("증권사 리서치 보조", "리서치 알바단", "b_cafe"), ("증권사 애널리스트", "미러증권", "b_office"),
        ("투자자문사 대표", "분신투자자문", "b_shop"), ("자산운용사 대표", "복리자산운용", "b_tower"),
        ("증권사 회장", "여의도홀딩스", "b_hq"),
    ],
    "tokyo": [
        ("콘비니 알바", "미러마트", "b_store"), ("이자카야 알바", "이자카야 분신", "b_delivery"),
        ("라멘 가게 알바", "분신라멘", "b_cafe"), ("애니메이션 원화가", "스튜디오 카피", "b_office"),
        ("캐릭터 굿즈숍 사장", "굿즈굿즈", "b_shop"), ("애니 제작사 대표", "분신픽처스", "b_tower"),
        ("캐릭터 IP 로열티 회장", "카피라이츠", "b_hq"), ("롯폰기 펜트하우스 오너", "롯폰기에스테이트", "b_penthouse"),
    ],
    "shanghai": [
        ("훠궈집 알바", "훠훠궈", "b_store"), ("와이탄 야경 가이드", "야경투어", "b_delivery"),
        ("공장 라인 알바", "라인웍스", "b_cafe"), ("무역회사 직원", "미러트레이딩", "b_office"),
        ("온라인 셀러", "분신셀러", "b_shop"), ("제조 공장 사장", "복제공업", "b_tower"),
        ("컨테이너선 선주", "분신해운", "b_hq"), ("무역 그룹 회장", "미러그룹", "b_penthouse"),
    ],
    "dubai": [
        ("사막 사파리 가이드", "듄사파리", "b_store"), ("호텔 컨시어지", "컨시어지 클럽", "b_delivery"),
        ("슈퍼카 세차 알바", "반짝세차", "b_cafe"), ("마천루 현장 소장", "스카이빌드", "b_office"),
        ("슈퍼카 렌털 사장", "분신모터스", "b_shop"), ("7성 호텔 오너", "세븐스타호텔", "b_tower"),
        ("오일 로열티 수령인", "오일로열티", "b_hq"), ("인공섬 개발 회장", "아일랜드개발", "b_penthouse"),
    ],
    "valley": [
        ("긱 배달 알바", "긱긱", "b_store"), ("AI 데이터 라벨러", "라벨팩토리", "b_delivery"),
        ("테크 캠퍼스 셔틀 기사", "셔틀버스", "b_cafe"), ("AI 엔지니어", "미러AI", "b_office"),
        ("차고 창업자", "개러지랩", "b_shop"), ("유니콘 CEO", "유니클론", "b_tower"),
        ("엔젤 투자자", "엔젤클론", "b_hq"), ("빅테크 대주주", "빅클론테크", "b_penthouse"),
    ],
    "newyork": [
        ("핫도그 노점", "핫도그 스탠드", "b_store"), ("도그 워커", "멍멍워크", "b_delivery"),
        ("브로드웨이 티켓 판매", "티켓부스", "b_cafe"), ("월가 트레이더", "미러스트리트", "b_office"),
        ("브로드웨이 제작자", "분신프로덕션", "b_shop"), ("글로벌 브랜드 창업자", "클론브랜드", "b_tower"),
        ("맨해튼 빌딩 소유주", "맨해튼리얼티", "b_hq"), ("다국적 기업 회장 겸 CEO", "미러글로벌", "b_penthouse"),
    ],
}
CERTS = {  # 도시: {칸: 자격 이름}
    "home": {4: "컴퓨터 자격증"}, "busan": {4: "물류관리 자격증"},
    "yeouido": {4: "투자분석 자격증", 7: "전문투자자 등록"},
    "tokyo": {4: "원화 포트폴리오 인증", 7: "저작권 관리사"},
    "shanghai": {4: "무역영어 자격증", 7: "선박 소유 등록"},
    "dubai": {4: "건설안전 자격증", 7: "자원 투자 등록"},
    "valley": {4: "AI 엔지니어 인증", 7: "공인 투자자 등록"},
    "newyork": {4: "트레이더 라이선스", 7: "부동산 투자 등록"},
}

# ---------------------------------------------------------------- 신분·집·부동산·사치품·트로피
STATUS = [  # 등급 이름, 설명
    ("반지하 세입자", "월세가 석 달 밀렸다"),
    ("원룸 독립", "햇빛이 드는 방이 생겼다"),
    ("전세 입주", "이사 걱정이 2년 미뤄졌다"),
    ("내 집 마련", "등기부에 내 이름이 있다"),
    ("건물주", "월세를 받는 쪽이 됐다"),
    ("빌딩 부자", "엘리베이터가 내 것이다"),
    ("재벌", "뉴스에 얼굴이 나온다(전부 같은 얼굴)"),
    ("세계 부호", "지도에 내 건물이 표시된다"),
]
HOUSES = [  # 이름, 배경 키, 설명
    ("반지하 월세방", "bg_home_0", "창문으로 발만 보인다"),
    ("햇빛 드는 원룸", "bg_home_1", "빨래가 하루 만에 마른다"),
    ("투룸 전세", "bg_home_2", "분신이 놀러 와도 앉을 데가 있다"),
    ("내 집 아파트", "bg_home_3", "못을 마음대로 박을 수 있다"),
    ("건물 꼭대기 층", "bg_home_4", "아래층이 전부 세입자"),
    ("한강뷰 펜트하우스", "bg_home_5", "야경이 인테리어"),
    ("언덕 위 대저택", "bg_home_6", "거울이 방마다 있다"),
    ("맨해튼 펜트하우스", "bg_home_7", "거울 속의 나도 출세했다"),
]
NETWORTH_SEC = 5.0e5      # 신분 r의 순자산 기준 = 도시 r 꼭대기 기본 수입 × 이 값
HOUSE_PRICE_SEC = 2.5e5   # 집 r 가격 = 도시 r 꼭대기 기본 수입 × 이 값
TROPHY_PRICE_SEC = 1.0e6  # 트로피 가격 = 도시 꼭대기 기본 수입 × 이 값

# 부동산: 도시별 4종 (이름, 스프라이트). 가격 = 도시 1칸 기본 수입 × PROPERTY_PRICE_SEC[i]
PROPERTY_PRICE_SEC = [2.0e5, 8.0e5, 2.5e6, 8.0e6]
PROPERTY_BOOST = [("", 0.0), ("alba", 0.10), ("biz", 0.10), ("job", 0.10)]
PROPERTIES = {
    "home": ["원룸 건물", "동네 상가", "상가주택", "꼬마빌딩"],
    "busan": ["바닷가 오피스텔", "관광 숙소", "해변 상가", "마린 타워 한 층"],
    "yeouido": ["증권가 오피스텔", "지하 아케이드", "금융 빌딩 한 층", "여의도 오피스 빌딩"],
    "tokyo": ["원룸 맨션", "상점가 점포", "캐릭터 스트리트 빌딩", "롯폰기 오피스"],
    "shanghai": ["골목 아파트", "야시장 점포", "물류 창고", "와이탄 빌딩"],
    "dubai": ["사막 빌라", "쇼핑몰 점포", "개발 부지", "마리나 타워"],
    "valley": ["차고 딸린 집", "공유 오피스", "스타트업 캠퍼스", "데이터센터"],
    "newyork": ["브루클린 아파트", "브로드웨이 점포", "맨해튼 오피스", "맨해튼 빌딩"],
}
PROPERTY_SPRITES = ["p_villa", "p_mall", "p_mixed", "p_building"]

# 사치품: 도시(=신분)마다 3부위 세트. 가격 = 도시 꼭대기 기본 수입 × LUX_PRICE_SEC[부위]
LUX_PRICE_SEC = {"suit": 4.0e4, "watch": 6.0e4, "car": 1.2e5}
LUXURY = [
    ("첫 출근 세트", "기성 정장", "전자시계", "중고 경차"),
    ("부산 사나이 세트", "린넨 재킷", "다이버 시계", "오픈카"),
    ("여의도 세트", "맞춤 정장", "금장 시계", "검은 세단"),
    ("롯폰기 세트", "디자이너 코트", "한정판 시계", "스포츠카"),
    ("와이탄 세트", "실크 정장", "보석 시계", "리무진"),
    ("두바이 세트", "금실 정장", "다이아 시계", "슈퍼카"),
    ("밸리 세트", "회색 후드티(한정판)", "스마트 워치 시제품", "자율주행차"),
    ("월가 세트", "전설의 정장", "가문의 시계", "전용 헬기"),
]
LICENSE_COST_RATIO = 0.2  # 운전면허 등 자격 비용 = 차 가격 × 이 값

TROPHIES = ["언덕 위 분식집 본점 건물", "해운대 타워 한 층", "여의도 마천루", "롯폰기 펜트하우스",
            "와이탄 빌딩", "인공섬", "전용기", "맨해튼 펜트하우스"]


def sig3(x: float) -> str:
    """유효숫자 3자리로 반올림. 1e15 이상은 지수 표기(C# double.Parse가 읽는다)."""
    if x == 0:
        return "0"
    from math import floor, log10
    if abs(x) >= 1e15:
        return f"{x:.2e}".replace("e+", "e")
    digits = 3 - int(floor(log10(abs(x)))) - 1
    v = round(x, digits)
    return str(int(v)) if v == int(v) else repr(v)


def write(name, header, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    econ = dict((k, v) for k, v, _ in ECONOMY)
    write("economy.csv", ["key", "value", "note"], ECONOMY)

    city_rows, job_rows = [], []
    tops, firsts = [], []
    first = FIRST_INCOME
    for ci, (cid, name, theme, slots, step, plots, rule, r1, r2, rule_text, top_building, color) in enumerate(CITIES, 1):
        incomes = [first * (step ** s) for s in range(slots)]
        top = incomes[-1]
        tops.append(top)
        firsts.append(first)
        city_rows.append([ci, cid, name, theme, slots, sig3(first * TAP_BASE_RATIO), sig3(first * HIRE_BASE_SEC),
                          sig3(top * FAME_UNIT_SEC), plots, rule, r1, r2, rule_text, top_building, color])
        for s in range(1, slots + 1):
            jname, company, sprite = JOBS[cid][s - 1]
            tier = SLOT_TIER[s]
            label, share, off, line = TIERS[tier]
            base = incomes[s - 1]
            promo = base * econ["promo_cost_sec"] if s > 1 else 0
            cert = CERTS.get(cid, {}).get(s, "")
            cert_cost = promo * econ["cert_cost_mult"] if cert else 0
            is_top = 1 if s == slots else 0
            req_status = ci if is_top else 0
            req_status = min(req_status, len(STATUS) - 1)
            job_rows.append([ci, s, f"{cid}_{s}", jname, tier, label, sig3(base), sig3(promo),
                             sig3(base * econ["facility_cost_sec"]), share, off, line,
                             cert, sig3(cert_cost), req_status, is_top, company, sprite])
        first = top * CITY_JUMP
    write("cities.csv", ["city", "id", "name", "theme", "slots", "tap_base", "hire_base", "fame_unit", "plots",
                         "rule", "rule_a", "rule_b", "rule_text", "top_building", "color"], city_rows)
    write("jobs.csv", ["city", "slot", "id", "name", "tier", "tier_label", "base_income", "promo_cost",
                       "facility_base_cost", "payday_share", "offline_rate", "payday_line",
                       "cert", "cert_cost", "req_status", "is_top", "company", "sprite"], job_rows)

    status_rows = []
    for r, (sname, desc) in enumerate(STATUS):
        if r == 0:
            status_rows.append([0, sname, 0, 0, 0, desc])
        else:
            top = tops[min(r, len(tops)) - 1]
            status_rows.append([r, sname, sig3(top * NETWORTH_SEC), r, 1, desc])
    write("status.csv", ["rank", "name", "net_worth", "house_tier", "luxury_sets", "desc"], status_rows)

    house_rows = []
    for t, (hname, bg, desc) in enumerate(HOUSES):
        price = 0 if t == 0 else tops[min(t, len(tops)) - 1] * HOUSE_PRICE_SEC
        house_rows.append([t, hname, sig3(price), bg, desc])
    write("houses.csv", ["tier", "name", "price", "bg", "desc"], house_rows)

    prop_rows = []
    for ci, c in enumerate(CITIES, 1):
        cid = c[0]
        for i, pname in enumerate(PROPERTIES[cid]):
            tier, pct = PROPERTY_BOOST[i]
            if tier == "job" and c[3] >= 7:
                tier = "inv"  # 금융 도시부터 4번째 건물은 투자 일터를 돕는다
            req = max(0, ci - 1) if i < 2 else min(ci, len(STATUS) - 1)
            if ci == 1 and i < 2:
                req = 0
            prop_rows.append([f"{cid}_p{i + 1}", ci, pname, sig3(firsts[ci - 1] * PROPERTY_PRICE_SEC[i]),
                              req, tier, pct, PROPERTY_SPRITES[i]])
    write("properties.csv", ["id", "city", "name", "price", "req_status", "boost_tier", "boost_pct", "sprite"], prop_rows)

    lux_rows = []
    for si, (set_name, suit, watch, car) in enumerate(LUXURY, 1):
        top = tops[si - 1]
        for part, iname in (("suit", suit), ("watch", watch), ("car", car)):
            price = top * LUX_PRICE_SEC[part]
            lic = sig3(price * LICENSE_COST_RATIO) if part == "car" else 0
            lux_rows.append([f"lux{si}_{part}", si, set_name, part, iname, sig3(price), max(0, si - 1), lic])
    write("luxury.csv", ["id", "set", "set_name", "part", "name", "price", "req_status", "license_cost"], lux_rows)

    trophy_rows = [[ci, TROPHIES[ci - 1], sig3(tops[ci - 1] * TROPHY_PRICE_SEC), min(ci, len(STATUS) - 1)]
                   for ci in range(1, len(CITIES) + 1)]
    write("trophies.csv", ["city", "name", "price", "req_status"], trophy_rows)


if __name__ == "__main__":
    main()
