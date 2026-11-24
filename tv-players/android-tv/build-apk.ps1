$ErrorActionPreference = "Stop"

$projDir = $PSScriptRoot
$tvPlayersRoot = Split-Path -Parent $projDir
$distDir = Join-Path $tvPlayersRoot "dist"
$buildDir = Join-Path $projDir "build"
$genDir = Join-Path $buildDir "gen"
$classesDir = Join-Path $buildDir "classes"
$dexDir = Join-Path $buildDir "dex"

$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "E:\Android\Sdk" }
$buildTools = Join-Path $sdkRoot "build-tools\36.0.0"
if (-not (Test-Path $buildTools)) {
  $buildTools = Join-Path $sdkRoot "build-tools\35.0.0"
}
$platformDir = Join-Path $sdkRoot "platforms\android-36"
if (-not (Test-Path $platformDir)) {
  $platformDir = Get-ChildItem (Join-Path $sdkRoot "platforms") | Select-Object -First 1 -ExpandProperty FullName
}

$aapt2 = Join-Path $buildTools "aapt2.exe"
$d8 = Join-Path $buildTools "d8.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"
$androidJar = Join-Path $platformDir "android.jar"

foreach ($tool in @($aapt2, $d8, $zipalign, $apksigner, $androidJar)) {
  if (-not (Test-Path $tool)) {
    throw "Required Android SDK artifact missing: $tool"
  }
}

if (Test-Path $buildDir) {
  Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Force -Path $genDir, $classesDir, $dexDir, $distDir | Out-Null

Write-Host "[1/6] Compiling Android resources with aapt2..."
& $aapt2 compile --dir (Join-Path $projDir "res") -o (Join-Path $buildDir "res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "[2/6] Linking APK resources & assets..."
$unsignedBase = Join-Path $buildDir "unsigned-base.apk"
& $aapt2 link -o $unsignedBase -I $androidJar --manifest (Join-Path $projDir "AndroidManifest.xml") -R (Join-Path $buildDir "res.zip") --java $genDir --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "[3/6] Compiling Java sources..."
$javaFiles = @(
  Get-ChildItem -Path (Join-Path $projDir "src") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
  Get-ChildItem -Path $genDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }
)
& javac -Xlint:-options -source 8 -target 8 -bootclasspath $androidJar -d $classesDir $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac compilation failed" }

Write-Host "[4/6] Converting bytecode to DEX with d8..."
$classFiles = Get-ChildItem -Path $classesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& $d8 --lib $androidJar --min-api 21 --output $dexDir $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 conversion failed" }

Write-Host "[5/6] Packaging classes.dex & aligning APK..."
$unalignedApk = Join-Path $buildDir "unaligned.apk"
$alignedApk = Join-Path $buildDir "aligned.apk"
Copy-Item -Force $unsignedBase $unalignedApk

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($unalignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $zip,
    (Join-Path $dexDir "classes.dex"),
    "classes.dex",
    [System.IO.Compression.CompressionLevel]::Optimal
  ) | Out-Null

  # Add web assets with forward-slash entry names. aapt2 -A on Windows writes
  # "assets/www\index.html" (backslash), which Android cannot find -> blank screen.
  $assetsRoot = (Resolve-Path (Join-Path $projDir "assets")).Path
  Get-ChildItem -Path $assetsRoot -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($assetsRoot.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $_.FullName,
      "assets/$rel",
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $zip.Dispose()
}

$check = [System.IO.Compression.ZipFile]::OpenRead($unalignedApk)
try {
  $names = $check.Entries | ForEach-Object { $_.FullName }
  if ($names -notcontains "assets/www/index.html") { throw "APK is missing assets/www/index.html" }
  $bad = $names | Where-Object { $_ -like "*\*" }
  if ($bad) { throw "APK has backslash entry names: $($bad -join ', ')" }
} finally {
  $check.Dispose()
}

& $zipalign -p -f 4 $unalignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "[6/6] Signing APK..."
$keystore = Join-Path $projDir "jts-signage-tv.jks"
$alias = "jtssignage"
$storePass = "jtssignage123"
if (-not (Test-Path $keystore)) {
  & keytool -genkeypair -v -keystore $keystore -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $storePass -keypass $storePass -dname "CN=JTS Signage, OU=Digital Signage, O=JTS, L=Mumbai, ST=MH, C=IN"
  if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

$finalApk = Join-Path $distDir "JTS-Signage-TV.apk"
& $apksigner sign --ks $keystore --ks-key-alias $alias --ks-pass "pass:$storePass" --key-pass "pass:$storePass" --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

& $apksigner verify --print-certs $finalApk
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

Write-Host "ANDROID_APK_BUILT_OK: $finalApk"
