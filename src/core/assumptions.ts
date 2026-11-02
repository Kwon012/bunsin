// 기획서·지시서 §7에 정의가 없는 항목의 기본값을 한곳에 모은다(스위치로 변경 가능).
// A1~A13 = 지시서 §7 기본값, X-** = 이 구현에서 새로 정한 가정(ASSUMPTIONS.md에 기록).
export const A = {
  /** A1 명성: 수입 × (1 + fame_income_bonus × 총 명성). 이사 시 명성 += floor(√(도시 누적 수입 ÷ fame_unit)) */
  A1_fameAdditive: true,
  /** A2 월급날: 직종별 (지난 월급날 이후 번 돈 × payday_share) 합, 하한 = 초당 수입 × payday_min_income_sec. 탭·통장·오프라인 제외, 피버 포함 */
  A2_includeFever: true,
  /** A3 오프라인 구간도 30분마다 같은 공식으로 밀린 월급봉투 적립. 매니저 해금 카운트는 접속 중 월급날만 */
  A3_offlinePaydays: true,
  /** A4 상한 이후 모든 등급 offline_after_cap_ratio */
  A4_afterCapAllTiers: true,
  /** A5 통장 자동 적립: 초당 수입의 auto_save_ratio를 현금에서 떼어 지금 종목에. 한도 도달 시 중단 */
  A5_autoSaveFromCash: true,
  /** A6 자격증: 인원 N 이상이면 열림. 가격 = base_cost × growth^(N + offset) × cert_price_mult */
  A6_certExpOffset: 10,
  /** A7 추천: 비용 ÷ 수입 증가량 최소. ETA = (비용 − 현금) ÷ 초당 수입. 벽 = ETA ≥ move_recommend_eta_sec */
  A7_recommendByRatio: true,
  /** A8 목표 바: 90초 이내 ETA 중 가장 가까운 목표(없으면 최단 ETA). 15% 채워 시작(표시용) */
  A8_goalMaxEtaSec: 90,
  A8_goalStartFill: 0.15,
  /** A9 매니저: 접속 중 1초마다 추천 구매 1회, 게이지가 차면 자동 발동. 오프라인 자동 구매 없음 */
  A9_managerIntervalSec: 1,
  /** A10 사건 보상: 초당 수입 × 30~120초 현금 */
  A10_eventRewardMinSec: 30,
  A10_eventRewardMaxSec: 120,
  /** A12 이사 후 새 도시 첫 목표를 일부 채운 채 시작 */
  A12_moveGoalPrefill: true,
  /** A13 도시 규칙 한 줄: 기획서에 구체 규칙 없음 → 미구현('미정') */
  A13_cityRuleImplemented: false,

  // ---- X: 새로 정한 가정 ----
  /** X-01 탭 연타로 피버 게이지를 채우는 탭 수 */
  X_feverTapsToFill: 30,
  /** X-02 꾹 누르기 자동 탭: 초당 횟수, 게이지 충전은 일반 탭의 비율 */
  X_holdTapsPerSec: 3,
  X_holdGaugeFactor: 1 / 3,
  /** X-03 게이지 감쇠: 마지막 탭 후 이 시간 지나면 초당 이 비율씩 감소 */
  X_gaugeDecayDelaySec: 3,
  X_gaugeDecayPerSec: 0.05,
  /** X-04 탭 수입의 '초당 수입'은 피버 포함 현재 값 */
  X_tapUsesFever: true,
  /** X-05 매니저 자동 응원 = 꾹 누르기와 같은 느린 자동 탭(초당 횟수) */
  X_managerTapsPerSec: 2,
  /** X-06 통장 개설 축하금은 지금 종목 잔액으로 들어간다(첫 배당이 바로 보이게) */
  X_openBonusToAccount: true,
  /** X-07 정산서 광고 2배는 오프라인 수입(직종별 합)만 2배. 월급봉투·배당 제외 */
  X_adDoublesOfflineIncomeOnly: true,
  /** X-08 '피버 연속' = 이전 피버 종료 후 이 시간 안에 다음 피버 발동 */
  X_feverStreakGapSec: 60,
  /** X-09 정산서를 띄우는 최소 부재 시간(초). 그보다 짧으면 조용히 합산 */
  X_settlementMinSec: 60,
  /** X-10 직접 입금도 지금 종목 한도까지 */
  X_depositCapped: true,
  /** X-11 직접 탭 > 매니저일 때 '직접 탭 = 더 빠름' 표시 기준: 최근 5초 탭 속도 */
  X_tapRateWindowSec: 5,
};
export type Assumptions = typeof A;
