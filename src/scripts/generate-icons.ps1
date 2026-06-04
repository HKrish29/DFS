Add-Type -AssemblyName System.Drawing

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
$outputPath = Join-Path (Get-Location) "public/icons"

if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath | Out-Null
}

foreach ($size in $sizes) {
    # Create Bitmap
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Enable high-quality rendering
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Fill transparent background
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Draw circular background (#0F172A)
    $bgColor = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillEllipse($brush, 0, 0, $size, $size)
    
    # Draw text "DFS" in white
    $fontStyle = [System.Drawing.FontStyle]::Bold
    $fontSize = $size * 0.35
    $font = New-Object System.Drawing.Font("Arial", $fontSize, $fontStyle)
    
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    $text = "DFS"
    $textSize = $g.MeasureString($text, $font)
    
    $x = ($size - $textSize.Width) / 2
    $y = ($size - $textSize.Height) / 2
    
    $g.DrawString($text, $font, $textBrush, $x, $y)
    
    # Save image
    $fileName = "icon-$($size)x$($size).png"
    $fileFullPath = Join-Path $outputPath $fileName
    $bmp.Save($fileFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $font.Dispose()
    $textBrush.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    
    Write-Host "Generated: $fileName"
}
