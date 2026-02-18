Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$expoHome = Join-Path $repoRoot ".expo-home"
if (-not (Test-Path $expoHome)) {
  New-Item -ItemType Directory -Force -Path $expoHome | Out-Null
}
$env:HOME = $expoHome
$env:USERPROFILE = $expoHome
# Ruta del SDK real (usuario Windows)
$env:ANDROID_HOME = 'C:\Users\sepul\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

try {
  & adb devices | Out-Null
  & adb reverse tcp:8081 tcp:8081 | Out-Null
} catch {
  Write-Host "ADB not available or no emulator connected. Continuing..."
}

& npx expo start --android --go --localhost --clear --port 8081
