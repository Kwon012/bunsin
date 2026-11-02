# 작업 규칙

- 작업 단위마다 commit + push 한다.
- 웹 게임(Phaser 3, CDN 로드)으로 만든다. 번들러/빌드 단계 없음 → 휴대폰 GitHub 웹 편집기로 수정해도 바로 배포된다.
- push 시 `.github/workflows/pages.yml`이 GitHub Pages로 자동 배포한다. 화면 우하단 `build <sha>`로 배포 버전을 확인한다.
- 승인 없이 핵심 기획을 변경하지 않는다. 실행하지 않은 코드를 검증 완료라고 하지 않는다.

## 구조

- `index.html` — 진입 HTML (Phaser CDN, 모바일 viewport)
- `src/main.js` — 게임 설정과 씬
- `assets/` — 이미지/사운드 (필요 시 생성, 배포에 자동 포함)

## 로컬 실행

```bash
python3 -m http.server 8000
```
