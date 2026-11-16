# 프로젝트 규칙 (AI 에이전트용)

- 기획서: docs/design-doc.md. 핵심 기획(수치·규칙·BM)은 승인 없이 바꾸지 않는다. 다르게 하고 싶으면 근거와 대안을 제안만 한다.
- Unity 6.3 LTS, URP 모바일, uGUI 우선, Input System, Addressables, Localization+TMP.
- `Assets/_Project/Scripts/Sim`은 순수 C# (UnityEngine/UnityEditor using 금지). 난수는 시드 고정 Rng만 사용.
- 부스트는 Sim 배속만 바꾼다. `Time.timeScale` 금지.
- 밸런스 수치는 코드에 하드코딩하지 않고 Data(ScriptableObject, CSV 원본은 Design/Sheets)에 둔다.
- 작업마다 구현 방법 · 완료 기준 · 테스트 방법을 적고, EditMode 테스트를 함께 작성한다.
- 실행하지 않은 코드를 "검증 완료"라고 하지 않는다.
- 네임스페이스: `Bunsin.Sim.*`, `Bunsin.Presentation.*`, 에디터 도구 `Bunsin.EditorTools`.

## 도구 연결 (docs/local-setup.md)
- Unity: 먼저 `unity status`. 에디터가 열려 있으면 `unity command … --caller plugin --skill unity-cli`로 조작하고 `.unity`·`.prefab`·`.asset` YAML을 직접 고치지 않는다.
- Blender 에셋: `Tools/Blender/build.ps1`(Windows) / `build.sh`(macOS·Linux) 또는 Unity 메뉴 `Bunsin/Art/Blender로 에셋 다시 생성`. 에디터가 열려 있으면 `unity command script eval --caller plugin --skill unity-cli 'Bunsin.EditorTools.BlenderBridge.BuildSync(false)'`.
- `Assets/_Project/Art/Generated/`는 생성물이다. 손으로 고치지 말고 `Tools/Blender/`의 스크립트·`palette.json`·`Design/Sheets/` 데이터를 고쳐 다시 생성한다.
- 생성·외부 에셋은 `Design/Sheets/asset_ledger.csv`(출처 대장)에 행이 있어야 한다 (기획서 §17).
- 열린 Blender를 직접 조작할 때만 `blender` MCP(.mcp.json)를 쓴다. 결과를 남길 작업은 스크립트로 옮긴다.
