# 분신 키우기: 나 1000명이 출근합니다 (Unity)

세로 한 손 방치형 자산 증식 게임. 기획서 「분신 키우기 최종 기획서」의 **v4 방향 검토 B안**(출세 사다리 + 자산, 승진 구조 S2, 이사 P1)을 기준으로 만든 Unity 6.3 LTS 프로젝트입니다.

> 핵심 재미 가설: "편의점 알바였던 내 분신 3호가 회장이 됐고, 그 월급으로 산 건물이 이제 나 대신 돈을 번다."

## 현재 상태 (2026-11-17)

| 항목 | 상태 | 근거 |
|---|---|---|
| 게임 규칙(순수 C#) | 구현 | `dotnet test Tools/SimTests` 39개 통과 |
| 페이싱 봇 | 구현 | 같은 테스트 안의 BalanceTests, 결과는 `Tools/_out/` |
| Unity 화면·연출·소리 | 구현 | Unity 6000.3 참조 DLL로 컴파일 검사 0 오류 |
| 에디터 자동 설정·빌드 | 구현 | 구버전 UnityEditor.dll로 컴파일 검사(새 API 4줄은 미검사) |
| **Unity 에디터 실행·화면 확인** | **미확인** | 이 작업 환경에 Unity 에디터가 없음 |
| **안드로이드 실기 빌드** | **미확인** | 위와 같음 |
| 실제 광고·결제 SDK | 미구현 | 가짜 구현(`MockAdService`, `MockIapService`) |
| 클라우드 저장·푸시 알림 | 미구현 | 출시 준비 단계 |

## 여는 법

1. Unity Hub에서 **Unity 6000.3.28f1**(6.3 LTS) + Android Build Support 설치.
2. 이 폴더를 프로젝트로 열기. 처음 열 때 `Bunsin/프로젝트 설정 적용`이 자동 실행되어 `Assets/_Project/Scenes/Main.unity`, 세로 화면, Android(IL2CPP·ARM64) 설정이 만들어집니다.
3. `Main` 씬에서 Play. (씬이 비어 있어도 `Game`이 스스로 카메라·캔버스·화면을 만듭니다.)
4. Input System 사용 여부를 묻는 창이 뜨면 **Yes**(둘 다 동작하게 짜여 있음).
5. 빌드: 메뉴 `Bunsin/빌드/Android APK (개발)` 또는
   `unity build . --target Android --execute-method Bunsin.EditorTools.BuildTools.BuildAndroid`

## 게임 구조 (v4 B안)

- **돈의 3층**: 일해서 번다(분신·자리) → 굴려서 불린다(예금·부동산·주식) → 써서 올라선다(집·사치품·트로피·신분 등급).
- **분신**: 레벨·적성(현장/사무/장사/투자)·개성·이력. 일터마다 자리 5칸, 분신 총수 = 자리 수.
- **승진(S2)**: 직종 사다리 = 승진 사다리. 레벨 + 윗자리 공석 + 승진비(+ 일부 자리는 자격증·신분).
- **이사(P1)**: 분신 전원 동행, 레벨 30% 유지, 명성(영구 배수). 떠난 도시의 건물·주식은 상한 안에서 계속 수입.
- **해금 층 L0~L13**: 한 번에 하나씩, 사람이 소개(엄마·은행원·중개사…). 탭도 열릴 때 생깁니다.
- **설계 원칙**: 확률 상품 없음 · 손해 없음 · 강제 광고 없음 · 머지 없음 · 하루 필수 5분.
- 도시 8개 · 직종 58종 · 월급날(10분) · 피버 · 정산서 · 사건 카드 · 개성 분신 14종 · 버킷리스트 · 숨은 장면.

## 폴더

```
Assets/_Project/
  Scripts/Sim/           순수 C# 규칙(Unity 의존 없음) — GameSim, GameState, GameData
  Scripts/Presentation/  uGUI 화면·연출·소리·저장 (코드로 UI를 조립)
  Scripts/Editor/        프로젝트 자동 설정, 가져오기 규칙, 빌드
  Tests/EditMode/        단위 테스트 + 페이싱 봇(BalanceTests)
  Resources/Data/        경제·콘텐츠 CSV (수치는 여기서만)
  Resources/Art/         스프라이트 아틀라스(atlas_0.png + atlas.csv)
  Resources/Audio/       합성 효과음·배경음
  Resources/Fonts/       주아체(OFL)
Tools/
  gen_data.py            경제 CSV 생성기(수치 조정은 여기)
  art/                   SVG 스프라이트 → 아틀라스 빌드(node + playwright)
  audio/gen_audio.py     효과음 합성
  SimCheck, SimTests     dotnet으로 규칙 컴파일·테스트
  UnityCheck             Unity 참조 DLL로 전체 스크립트 컴파일 검사
docs/v4-assumptions.md   기획서에 없어 이번 구현이 정한 값과 설계 판단
```

## 자주 하는 작업

```bash
python3 Tools/gen_data.py          # 경제 수치 바꾼 뒤 CSV 다시 생성
dotnet test Tools/SimTests         # 규칙 테스트 + 페이싱 봇
node Tools/art/build.js            # 그림 바꾼 뒤 아틀라스 다시 생성
python3 Tools/audio/gen_audio.py   # 소리 다시 합성
```

Unity 참조 DLL 컴파일 검사 방법은 `Tools/README.md`.
