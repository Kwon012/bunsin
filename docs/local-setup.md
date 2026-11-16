# 내 PC에서 Blender · Unity 연결하기

클라우드 세션은 PC의 Blender·Unity를 직접 실행할 수 없습니다. 아래를 한 번 해 두면 **PC에서 연 Claude Code가 Blender와 Unity를 바로 조작**하고, Unity 메뉴 한 번으로 Blender 에셋이 다시 만들어집니다.

```
Blender (헤드리스 -b)  ──FBX·T_Palette──▶  Assets/_Project/Art/Generated  ──자동 설정──▶  Unity
   ▲  Tools/Blender/build.ps1 · build.sh            GeneratedArtPostprocessor / GeneratedArtSetup
   └──────────── Unity 메뉴 Bunsin > Art > Blender로 에셋 다시 생성 (BlenderBridge)
Claude Code(PC) ── unity CLI ──▶ 열린 Unity 에디터 (com.unity.pipeline)
                └─ blender MCP(선택) ──▶ 열린 Blender (addon.py)
```

명령은 Windows PowerShell 기준입니다. macOS는 `build.ps1` 대신 `build.sh`를 씁니다.

## 0. 준비물
- Git, Git LFS (`git lfs install`)
- Claude Code: 데스크톱 앱 또는 CLI
- Blender (설치 완료)

## 1. 저장소 받기
```powershell
git clone https://github.com/Kwon012/bunsin.git
cd bunsin
git checkout ccr-87dc057b-6npim4
git lfs pull
```

## 2. Blender 연결
**2-1. 기본 (설정 없음)** — 스크립트로 에셋을 만듭니다.
```powershell
.\Tools\Blender\build.ps1 --no-render          # 모델·FBX만 (수 초)
.\Tools\Blender\build.ps1                      # + 미리보기 렌더 (CPU로 수 분)
```
`[model] …` 11줄이 나오면 성공. Blender를 못 찾으면 `$env:BLENDER = "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"`처럼 경로를 지정합니다.

**2-2. 선택: 열린 Blender를 Claude가 조작 (Blender MCP)** — 모델을 보면서 고칠 때만 필요합니다.
1. uv 설치: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
2. https://github.com/ahujasid/blender-mcp 에서 `addon.py` 내려받기
3. Blender → Edit > Preferences > Add-ons → (오른쪽 위 메뉴) Install from Disk → `addon.py` → “Interface: Blender MCP” 켜기
4. 3D 뷰에서 N → BlenderMCP 탭 → Connect
5. 저장소 폴더에서 Claude Code를 열면 `.mcp.json`의 `blender` 서버 사용을 묻습니다 → 승인

주의: 제3자 오픈소스이며 Blender 안에서 임의 파이썬을 실행합니다. 원격 수집은 `.mcp.json`에서 `DISABLE_TELEMETRY=true`로 껐습니다. MCP 클라이언트는 한 번에 하나만 연결하세요.

## 3. Unity 연결 (Unity CLI)
```powershell
irm https://unity.com/install.ps1 | iex        # 설치 후 새 터미널
unity --version
unity auth login
unity license status                           # 없으면 unity license activate
unity releases --stream lts --limit 5          # 6000.3.x(6.3 LTS) 버전 확인
unity install 6000.3.x --module android --module ios --yes --accept-eula   # x는 위에서 본 번호
```
프로젝트 생성: 저장소 루트에 이미 파일이 있으므로 임시 폴더에 만든 뒤 복사합니다.
```powershell
unity projects create bunsin-tmp --path $env:TEMP --editor-version 6000.3.x --template com.unity.template.urp-blank
Copy-Item -Recurse "$env:TEMP\bunsin-tmp\Packages","$env:TEMP\bunsin-tmp\ProjectSettings" .
Copy-Item -Recurse "$env:TEMP\bunsin-tmp\Assets\*" .\Assets\     # URP 설정(Assets/Settings) 포함 — 빠뜨리면 URP가 꺼짐
unity pipeline install --project-path .        # Claude가 에디터를 조작하는 패키지. 처음 열기 전에
unity open .
unity status --until-ready --project-path (Get-Location).Path
unity setup claude                             # Claude Code에 Unity 플러그인·스킬 설치 (다음 세션부터)
```
이 단계는 PC의 Claude Code에 “docs/local-setup.md 3단계 해 줘”라고 맡겨도 됩니다.

## 4. 연결 확인 (완료 기준)
| 확인 | 기대 결과 |
|---|---|
| Unity 메뉴 **Bunsin > Art > Blender로 에셋 다시 생성** | Console에 `[Blender] [model] …` 11줄과 `완료` |
| `Assets/_Project/Art/Materials/M_Palette.mat` | 자동 생성, URP Lit, T_Palette 연결 |
| `T_Palette.png` 가져오기 설정 | Filter Point · 밉맵 없음 · 무압축 |
| 침대 FBX를 씬에 놓고 1 m 큐브와 비교 | 1.6 × 2.14 m, 바닥에 붙음, 회전 0 |
| PC의 Claude Code에서 `unity status` | 에디터 `ready` |
| (선택) Claude에게 “블렌더 씬 정보 알려줘” | Blender MCP 응답 |

하나라도 다르면 Console 오류나 명령 출력을 그대로 알려 주세요.

## 5. 선택: 이 클라우드 세션에서 PC를 직접 쓰기
Claude 데스크톱 앱 → Settings → Claude Code → Remote Control에서 이 저장소 폴더를 추가하고 알려 주면, 클라우드 세션이 그 폴더에 연결을 요청할 수 있습니다. 이 기능은 아직 모든 계정에 열려 있지 않을 수 있습니다. 안 되면 PC에서 Claude Code를 직접 여는 방법(1~4단계)을 쓰면 됩니다.
