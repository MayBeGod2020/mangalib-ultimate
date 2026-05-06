# Build script for Chrome Web Store and Firefox AMO
# Run: right-click -> "Run with PowerShell"

Add-Type -Assembly System.IO.Compression.FileSystem

$root    = $PSScriptRoot
$version = (Get-Content "$root\manifest.json" | ConvertFrom-Json).version
$outFile = "$root\..\mangalib-ultimate-v$version.zip"

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

# Use .NET ZipArchive directly to ensure forward slashes (required by AMO / Web Store)
$zip = [System.IO.Compression.ZipFile]::Open($outFile, 'Create')

foreach ($item in $include) {
    $src = Join-Path $root $item

    if (Test-Path $src -PathType Leaf) {
        $entry = $item.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $src, $entry, 'Optimal'
        ) | Out-Null

    } elseif (Test-Path $src -PathType Container) {
        Get-ChildItem $src -Recurse -File | ForEach-Object {
            $entry = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $_.FullName, $entry, 'Optimal'
            ) | Out-Null
        }
    }
}

$zip.Dispose()

Write-Host ""
Write-Host "Done! Upload this file to Chrome Web Store / Firefox AMO:" -ForegroundColor Green
Write-Host $outFile -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
