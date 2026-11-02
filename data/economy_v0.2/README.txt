분신 키우기 경제 데이터 표 v0.2 (기획서 v1.4, R-011~R-014 확정 반영, 2026-11-01)
v0.1(칸 공통 사다리)에서 바뀐 점
- cities.csv: 도시 8개(우리 동네~뉴욕) 이름·테마·칸 수·꼭대기 건물, 1칸 첫 분신 가격(first_cost)·수입(first_income)·정착금(settle_money),
  칸 사이 배율(cost_step·income_step), 증가율(growth_base·growth_step), 명성 단위(fame_unit), 탭 기본값(tap_base)
- jobs.csv: 도시별 직종 58줄. 고용가 = base_cost × cost_growth^보유수. is_top=1이 그 도시 이사 조건(첫 고용)
- economy.csv: fame_base·fame_city_mult는 더 쓰지 않음(도시별 fame_unit). 정착금 배수 추가
- account.csv·milestones.csv: 변경 없음
규칙: 도시 1은 v3.6 그대로. 도시 2~8은 1칸 가격 = 이전 꼭대기 ×10, 칸 사이 가격 ×12·수입 ×6, 증가율 1.07+0.005/칸, 정착금 = 1칸 ×3
큰 수는 유효숫자 3자리 반올림(E 표기). 생성식은 시뮬레이터 패키지 tools/gen_v02.py, 일관성 검사는 econ/data.py validate
모든 수치는 시뮬레이션용 임시값. 실제 테스트 후 조정.
