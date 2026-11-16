# Blender로 에셋 생성 (Windows PowerShell)
# 사용: ./Tools/Blender/build.ps1 [--no-render] [--samples 64] [--scale 100]
# Blender 경로: 환경 변수 BLENDER → "Program Files\Blender Foundation\*" → PATH
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$blender = $env:BLENDER
if (-not $blender) {
    $cand = Get-ChildItem (Join-Path $env:ProgramFiles 'Blender Foundation\*\blender.exe') -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($cand) { $blender = $cand.FullName }
}
if (-not $blender) {
    $cmd = Get-Command blender -ErrorAction SilentlyContinue
    if ($cmd) { $blender = $cmd.Source }
}
if (-not $blender) {
    Write-Error 'Blender를 찾지 못했습니다. 환경 변수 BLENDER에 blender.exe 경로를 넣어 주세요.'
    exit 4
}
Write-Host "Blender: $blender"
& $blender -b --factory-startup --python-exit-code 1 -P (Join-Path $root 'Tools\Blender\build_poc.py') -- @args
exit $LASTEXITCODE
