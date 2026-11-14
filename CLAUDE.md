# 프로젝트 규칙 (AI 에이전트용)

- 기획서: docs/design-doc.md. 핵심 기획(수치·규칙·BM)은 승인 없이 바꾸지 않는다. 다르게 하고 싶으면 근거와 대안을 제안만 한다.
- Unity 6.3 LTS, URP 모바일, uGUI 우선, Input System, Addressables, Localization+TMP.
- `Assets/_Project/Scripts/Sim`은 순수 C# (UnityEngine/UnityEditor using 금지). 난수는 시드 고정 Rng만 사용.
- 부스트는 Sim 배속만 바꾼다. `Time.timeScale` 금지.
- 밸런스 수치는 코드에 하드코딩하지 않고 Data(ScriptableObject, CSV 원본은 Design/Sheets)에 둔다.
- 작업마다 구현 방법 · 완료 기준 · 테스트 방법을 적고, EditMode 테스트를 함께 작성한다.
- 실행하지 않은 코드를 "검증 완료"라고 하지 않는다.
- 네임스페이스: `Bunsin.Sim.*`, `Bunsin.Presentation.*`.
