$ErrorActionPreference = "Stop"

$projDir = $PSScriptRoot
$tvPlayersRoot = Split-Path -Parent $projDir
$coreDir = Join-Path $tvPlayersRoot "player-core"
$distDir = Join-Path $tvPlayersRoot "dist"
$outAppDir = Join-Path $distDir "lg-webos-app"

if (Test-Path $outAppDir) {
  Remove-Item -Recurse -Force $outAppDir
}
New-Item -ItemType Directory -Force -Path $outAppDir | Out-Null

Copy-Item -Path (Join-Path $coreDir "*") -Destination $outAppDir -Recurse -Force
Copy-Item -Path (Join-Path $projDir "appinfo.json") -Destination $outAppDir -Force
Copy-Item -Path (Join-Path $projDir "icon.png") -Destination $outAppDir -Force
Copy-Item -Path (Join-Path $projDir "largeIcon.png") -Destination $outAppDir -Force

$aresPkg = Get-Command "ares-package" -ErrorAction SilentlyContinue
if ($aresPkg) {
  & $aresPkg.Source -o $distDir $outAppDir
  if ($LASTEXITCODE -ne 0) { throw "ares-package failed" }
  Write-Host "LG_WEBOS_IPK_BUILT_OK: $distDir"
} else {
  Write-Host "LG_WEBOS_STAGE_OK: $outAppDir (Install LG webOS CLI and run: ares-package `"$outAppDir`" -o `"$distDir`")"
}
