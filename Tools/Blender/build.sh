#!/usr/bin/env bash
# Blender로 에셋 생성 (macOS / Linux)
# 사용: Tools/Blender/build.sh [--no-render] [--samples 64] [--scale 100]
# Blender 경로: 환경 변수 BLENDER → /Applications/Blender.app → PATH
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLENDER="${BLENDER:-}"
if [ -z "$BLENDER" ] && [ -x /Applications/Blender.app/Contents/MacOS/Blender ]; then
  BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
fi
if [ -z "$BLENDER" ] && command -v blender >/dev/null 2>&1; then
  BLENDER="$(command -v blender)"
fi
if [ -z "$BLENDER" ]; then
  echo "Blender를 찾지 못했습니다. 환경 변수 BLENDER에 실행 파일 경로를 넣어 주세요." >&2
  exit 4
fi
echo "Blender: $BLENDER"
exec "$BLENDER" -b --factory-startup --python-exit-code 1 -P "$ROOT/Tools/Blender/build_poc.py" -- "$@"
