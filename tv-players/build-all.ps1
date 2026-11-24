$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$coreDir = Join-Path $root "player-core"

Write-Host "=== [1/5] Generating Brand PNG Icons & Banners ==="
& (Join-Path $root "generate-assets.ps1")

Write-Host "=== [2/5] Syncing Universal Player Core to All TV Targets ==="
$targets = @(
  (Join-Path $root "android-tv\assets\www"),
  (Join-Path $root "samsung-tizen\www"),
  (Join-Path $root "lg-webos\www"),
  (Join-Path $root "desktop-kiosk\www")
)

foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -Recurse -Force $t
  }
  New-Item -ItemType Directory -Force -Path $t | Out-Null
  Copy-Item -Path (Join-Path $coreDir "*") -Destination $t -Recurse -Force
}

Write-Host "=== [3/5] Building Android TV / Google TV / Fire TV Kiosk APK ==="
& (Join-Path $root "android-tv\build-apk.ps1")

Write-Host "=== [4/5] Packaging Samsung Smart TV (Tizen .wgt) ==="
& (Join-Path $root "samsung-tizen\build-wgt.ps1")

Write-Host "=== [5/5] Staging LG Smart TV (webOS App) ==="
& (Join-Path $root "lg-webos\build-webos.ps1")

Write-Host "ALL_TV_PLAYERS_BUILT_SUCCESSFULLY"
