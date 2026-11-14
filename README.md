# 숙소왕 키우기 (가제)

할머니가 맡기고 간 바닷가 마을 집의 방 한 칸에서 시작해, 직접 꾸민 숙소로 조용한 마을을 다시 북적이게 만드는 모바일 3D 숙박 경영 게임.

- 기획서: [docs/design-doc.md](docs/design-doc.md) (원본: 기획서 v1.9 아티팩트)
- 엔진: Unity 6.3 LTS · URP(모바일) · 세로 화면
- 현재 단계: **M0 프로젝트 기반** (저장소 구조만 준비됨, Unity 프로젝트 생성 전)

## 폴더 구조

```
Assets/_Project/
  Scripts/Sim/           순수 C# 시뮬레이션 (Bunsin.Sim, noEngineReferences)
    Clock/ World/ Systems/ Rng/ Events/
  Scripts/Presentation/  MonoBehaviour 연출·UI (Bunsin.Presentation → Sim 참조)
  Data/                  ScriptableObject 데이터 (LodgingTypeDef, FurnitureDef …)
  Art/ Audio/ Prefabs/ Scenes/ UI/ Localization/
  Tests/EditMode/        Sim 단위 테스트·밸런스 봇 (Bunsin.Sim.Tests)
  Tests/PlayMode/        UI·가이드 키 테스트
Design/Sheets/           기획 스프레드시트 CSV 원본 → 가져오기 스크립트로 SO 생성
docs/                    기획·결정 기록
```

규칙: **Sim은 UnityEngine을 참조하지 않는다.** Presentation은 Sim 이벤트를 받아 그리기만 하고, 입력은 Command로 Sim에 전달한다.

## 처음 세팅 (사람이 1회)

1. Git LFS 설치 후 `git lfs install`
2. Unity Hub에서 Unity **6.3 LTS** + Android/iOS 빌드 모듈 설치
3. Hub에서 **Universal 3D** 템플릿으로 임시 폴더에 새 프로젝트 생성
4. 생성된 `Packages/`, `ProjectSettings/`를 이 저장소 루트로 복사 (`Assets/_Project`는 유지)
5. Unity로 저장소 루트를 열어 `.meta` 생성 확인 → 커밋

## 브랜치 규칙

- `main`: 항상 빌드 가능한 상태
- 작업 브랜치: `feat/<마일스톤>-<기능>` (예: `feat/m1-clock`) → PR로 `main`에 병합
