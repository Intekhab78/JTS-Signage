$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot

function New-BrandIcon {
  param(
    [string]$OutPath,
    [int]$Width,
    [int]$Height,
    [switch]$Banner
  )

  $dir = Split-Path -Parent $OutPath
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bgRect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(255, 29, 78, 216),
    [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
    45
  )
  $g.FillRectangle($bgBrush, $bgRect)

  $whitePenWidth = [Math]::Max(3, [Math]::Round([Math]::Min($Width, $Height) * 0.06))
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $whitePenWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  if ($Banner) {
    # Left TV mark + Right "JTS SIGNAGE" text for 320x180 Android TV Leanback banner
    $tvX = 28
    $tvY = 50
    $tvW = 84
    $tvH = 56
    $g.DrawRectangle($pen, $tvX, $tvY, $tvW, $tvH)
    $g.DrawLine($pen, 70, 106, 70, 122)
    $g.DrawLine($pen, 50, 122, 90, 122)

    $titleFont = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 191, 219, 254))
    $g.DrawString("JTS Signage", $titleFont, $titleBrush, 128, 52)
    $g.DrawString("TV Display Player", $subFont, $subBrush, 130, 92)
    $titleFont.Dispose(); $subFont.Dispose(); $titleBrush.Dispose(); $subBrush.Dispose()
  } else {
    $pad = [Math]::Round($Width * 0.22)
    $tvW = $Width - ($pad * 2)
    $tvH = [Math]::Round($tvW * 0.65)
    $tvX = $pad
    $tvY = [Math]::Round(($Height - $tvH) * 0.40)
    $g.DrawRectangle($pen, $tvX, $tvY, $tvW, $tvH)

    $cx = [Math]::Round($Width / 2)
    $standTop = $tvY + $tvH
    $standBottom = $standTop + [Math]::Round($Height * 0.10)
    $baseHalf = [Math]::Round($Width * 0.16)
    $g.DrawLine($pen, $cx, $standTop, $cx, $standBottom)
    $g.DrawLine($pen, ($cx - $baseHalf), $standBottom, ($cx + $baseHalf), $standBottom)
  }

  $pen.Dispose()
  $bgBrush.Dispose()
  $g.Dispose()
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-BrandIcon -OutPath (Join-Path $root "android-tv\res\mipmap-xhdpi\ic_launcher.png") -Width 96 -Height 96
New-BrandIcon -OutPath (Join-Path $root "android-tv\res\drawable-xhdpi\tv_banner.png") -Width 320 -Height 180 -Banner
New-BrandIcon -OutPath (Join-Path $root "samsung-tizen\icon.png") -Width 512 -Height 512
New-BrandIcon -OutPath (Join-Path $root "lg-webos\icon.png") -Width 80 -Height 80
New-BrandIcon -OutPath (Join-Path $root "lg-webos\largeIcon.png") -Width 130 -Height 130

Write-Host "BRAND_ASSETS_GENERATED_OK"
