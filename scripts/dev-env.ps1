# รัน Next dev ด้วยไฟล์ env และพอร์ตที่เลือก โดยไม่แตะ .env.local ของอินสแตนซ์เดิม
# ใช้: .\scripts\dev-env.ps1 -EnvFile .env.v2 -Port 3001
param(
  [string]$EnvFile = '.env.v2',
  [int]$Port = 3001,
  [string]$Hostname = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path $EnvFile)) { throw "ไม่พบไฟล์ $EnvFile" }

# ตั้งค่าใน process ปัจจุบัน -> ชนะ .env.local เพราะ @next/env ไม่เขียนทับค่าที่มีอยู่แล้ว
foreach ($line in Get-Content $EnvFile) {
  $text = $line.Trim()
  if ($text -eq '' -or $text.StartsWith('#')) { continue }
  $split = $text.IndexOf('=')
  if ($split -lt 1) { continue }
  $name = $text.Substring(0, $split).Trim()
  $value = $text.Substring($split + 1).Trim().Trim('"')
  Set-Item -Path "env:$name" -Value $value
}

Write-Host "env: $EnvFile  |  distDir: $($env:NEXT_OUTPUT_DIR)  |  http://${Hostname}:$Port" -ForegroundColor Cyan
& node node_modules/next/dist/bin/next dev --hostname $Hostname --port $Port
