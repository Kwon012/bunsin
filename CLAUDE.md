# 프로젝트 규칙 (AI 에이전트용)

- 기획 기준: Claude Docs 「분신 키우기 최종 기획서」(https://claude.ai/artifact/Uv8ZHwoT9T86Xzho8aNCzW)의 'v4 방향 검토(제안)' B안·S2·P1. 기획서가 정하지 않아 구현이 정한 값은 `docs/v4-assumptions.md`.
- 핵심 기획(재화 구조·성장 공식·이사·수익화)은 승인 없이 바꾸지 않는다. 다르게 하고 싶으면 근거와 대안 2~3개 + 추천 1개를 채팅에서 제안만 한다.
- 설계 원칙: 확률 상품 없음 · 손해 없음 · 강제 광고 없음 · 새 화폐 금지 · 머지 없음 · 하루 필수 5분.
- `Assets/_Project/Scripts/Sim`은 순수 C#(asmdef noEngineReferences). UnityEngine 금지, 난수는 `Rng`(시드 고정)만.
- 수치는 코드에 박지 않는다: `Tools/gen_data.py` → `Resources/Data/*.csv`. 콘텐츠 문구는 CSV.
- 색은 `Presentation/Core/Palette.cs`(= `Tools/art/sprites.js`의 P)에서만. 텍스트 UI는 `Ui.Label` 한 곳에서 만든다.
- 씬·프리팹 YAML을 손으로 고치지 않는다. UI는 코드로 조립(`Game`이 부팅 시 생성), 프로젝트 설정은 `Editor/ProjectSetup.cs`.
- 작업마다 구현 방법 · 완료 기준 · 테스트 방법을 적고, 규칙을 바꾸면 `Tests/EditMode`에 테스트를 함께 쓴다.
- 확인 순서: `dotnet test Tools/SimTests` → `dotnet build Tools/UnityCheck`(Tools/README.md) → Unity 에디터 Play → 실기.
- 실행하지 않은 코드를 "검증 완료"라고 하지 않는다. 무엇을 어떻게 돌렸는지 적는다.
