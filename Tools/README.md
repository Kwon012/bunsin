# Tools

## 1. 규칙 테스트 (Unity 없이)

```bash
dotnet test Tools/SimTests
```
`Assets/_Project/Tests/EditMode/*.cs`를 그대로 컴파일해 돌립니다. Unity Test Runner(EditMode)에서도 같은 테스트가 돕니다.
페이싱 봇 보고서는 `Tools/_out/balance_*.txt`에 남습니다(커밋하지 않음).

## 2. Unity 스크립트 컴파일 검사 (Unity 없이)

Unity 에디터가 없는 환경(CI, 클라우드 에이전트)에서 Presentation 코드의 컴파일 오류를 먼저 잡는 용도입니다. **실행 검증이 아닙니다.**

참조 DLL은 저장소에 넣지 않습니다(`Tools/_refs/`는 .gitignore). 받는 법:

```bash
mkdir -p Tools/_refs && cd Tools/_refs
# UnityEngine 모듈(6000.3) — BepInEx NuGet 피드의 참조 전용 패키지
curl -L -o ue.nupkg https://nuget.bepinex.dev/v3/package/unityengine.modules/6000.3.26/unityengine.modules.6000.3.26.nupkg
unzip -q ue.nupkg -d ue_pkg && mv ue_pkg/lib/netstandard2.0 ue
# uGUI — 오래된 버전이지만 이 프로젝트가 쓰는 API는 같다
curl -L -o ugui.nupkg https://api.nuget.org/v3-flatcontainer/unity3d.unityengine.ui/2018.3.5.1/unity3d.unityengine.ui.2018.3.5.1.nupkg
unzip -q ugui.nupkg -d ugui_pkg && cp ugui_pkg/lib/UnityEngine.UI.dll .
cd ../.. && dotnet build Tools/UnityCheck
```

`Tools/UnityCheck/Stubs/`의 Input System 선언은 검사용 가짜이며 게임에 들어가지 않습니다.
Unity 에디터가 있으면 이 검사 대신 에디터 컴파일 결과가 기준입니다.

## 3. 데이터·아트·소리 생성

| 명령 | 출력 |
|---|---|
| `python3 Tools/gen_data.py` | `Resources/Data/{economy,cities,jobs,status,houses,properties,luxury,trophies}.csv` |
| `node Tools/art/build.js` | `Resources/Art/atlas_0.png`, `atlas.csv`, 미리보기 `Tools/_out/atlas_preview_0.png` |
| `python3 Tools/audio/gen_audio.py` | `Resources/Audio/*.wav` |

콘텐츠 CSV(`layers, events, uniques, bucket, scenes, news, lines`)는 손으로 쓰는 파일이라 생성기가 건드리지 않습니다.
