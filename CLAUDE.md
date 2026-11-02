# 분신 키우기 PoC — 작업 규칙 (요약, 원문: docs/bunsin_phaser_poc_prompt.md)

- 작업(마일스톤) 단위마다 commit + push. 브랜치: `claude/cool-mccarthy-npi1yj` (사용자 승인).
- push → `.github/workflows/pages.yml`이 test·build 후 GitHub Pages 배포. 우하단 `build <sha>`로 버전 확인.
- 기획서 `docs/bunsin-gdd.md` 기능을 생략·축소·임의 변경 금지. 못 만든 것은 보고에 '미구현 + 이유'.
- 핵심 기획(재화·성장 공식·이사/명성·수익화·설계 원칙 8개) 변경 금지. 새 화폐·기획서에 없는 기능 금지(디버그 도구 예외).
- 경제 수치는 `data/economy_v0.3/*.csv`에서만 읽는다(생성기 `tools/gen_v03.mjs` + `tools/params_v03.json`, v0.2는 보관). CSV가 기획서 숫자보다 우선.
- 피드백 반영 결정·기획서 수정 제안: `docs/feedback-v1-review.md`. 밸런스 확인: `BAL=1 npx vitest run tests/balance.test.ts`.
- 기획서에 없는 값은 `src/core/assumptions.ts`(A1~A13) → 없으면 가장 단순한 해석 + `ASSUMPTIONS.md` 한 줄.
- 실행하지 않은 것을 "검증 완료"라고 쓰지 않는다. 돌린 명령과 결과를 적는다.
- 토큰 절약: 테스트는 dot reporter, 긴 출력 금지, 서브에이전트 금지.

## 구조
- `src/core/` 순수 TS 경제 로직(Phaser import 금지) · `src/data/` CSV 로더·검증 · `src/scenes|ui|fx/` 화면·연출(경제 수식 금지) · `src/debug/` `?debug=1`
- `data/economy_v0.3/` 경제 CSV · `data/content/` 콘텐츠 CSV(임시 열 구성: docs/content-csv.md) · `tests/` Vitest

## 명령
```bash
npm install
```
```bash
npm test
```
```bash
npm run build
```
```bash
npm run dev
```
