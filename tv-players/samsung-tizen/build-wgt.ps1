$ErrorActionPreference = "Stop"

$projDir = $PSScriptRoot
$tvPlayersRoot = Split-Path -Parent $projDir
$coreDir = Join-Path $tvPlayersRoot "player-core"
$distDir = Join-Path $tvPlayersRoot "dist"
$stageDir = Join-Path $projDir "stage"

if (Test-Path $stageDir) {
  Remove-Item -Recurse -Force $stageDir
}
New-Item -ItemType Directory -Force -Path $stageDir, $distDir | Out-Null

Copy-Item -Path (Join-Path $coreDir "*") -Destination $stageDir -Recurse -Force
Copy-Item -Path (Join-Path $projDir "config.xml") -Destination $stageDir -Force
Copy-Item -Path (Join-Path $projDir "icon.png") -Destination $stageDir -Force

$wgtOut = Join-Path $distDir "JTS-Signage-Samsung-Tizen.wgt"
if (Test-Path $wgtOut) {
  Remove-Item -Force $wgtOut
}

$zipTmp = Join-Path $distDir "JTS-Signage-Samsung-Tizen.zip"
if (Test-Path $zipTmp) {
  Remove-Item -Force $zipTmp
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipTmp -Force
Move-Item -Force $zipTmp $wgtOut

Write-Host "SAMSUNG_WGT_BUILT_OK: $wgtOut"
