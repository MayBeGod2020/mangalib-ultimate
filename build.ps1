# Сборка zip-пакета расширения для Chrome Web Store и Firefox AMO
# Запуск: правой кнопкой -> "Выполнить с помощью PowerShell"

$version = (Get-Content manifest.json | ConvertFrom-Json).version
$outFile  = "$PSScriptRoot\..\mangalib-ultimate-v$version.zip"

# Файлы и папки которые входят в пакет
$include = @(
    'manifest.json',
    'background.js',
    'main.js',
    'lib',
    'modules',
    'icons',
    'privacy-policy.html'
)

if (Test-Path $outFile) { Remove-Item $outFile }

$tmp = "$env:TEMP\mu-build"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

foreach ($item in $include) {
    $src = Join-Path $PSScriptRoot $item
    if (Test-Path $src) {
        Copy-Item $src $tmp -Recurse -Force
    }
}

Compress-Archive -Path "$tmp\*" -DestinationPath $outFile
Remove-Item $tmp -Recurse -Force

Write-Host ""
Write-Host "Готово! Файл для загрузки в магазин:" -ForegroundColor Green
Write-Host $outFile -ForegroundColor Cyan
Write-Host ""
pause
