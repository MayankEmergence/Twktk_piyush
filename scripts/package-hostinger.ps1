$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputPath = Join-Path $projectRoot 'TWKTK-hostinger.zip'
$zipFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
foreach ($name in @('package.json','package-lock.json','index.html','portal.html','hostinger.mjs','tsconfig.json','vite.config.ts','.env.example','README.md','HOSTINGER.md','HOSTING.md','assets/manifest.js','assets/models/player-web.glb')) {
  $zipFiles.Add((Get-Item -LiteralPath (Join-Path $projectRoot $name)))
}
foreach ($folder in @('src','dist','assets/brand','assets/images','assets/audio')) {
  $folderPath = Join-Path $projectRoot $folder
  if (Test-Path -LiteralPath $folderPath) { foreach ($file in Get-ChildItem -LiteralPath $folderPath -Recurse -File) { $zipFiles.Add($file) } }
}
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'server') -File) {
  if ($file.Extension -in @('.ts','.sql')) { $zipFiles.Add($file) }
}
$archiveStream = [System.IO.File]::Open($outputPath,[System.IO.FileMode]::Create)
$zip = [System.IO.Compression.ZipArchive]::new($archiveStream,[System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $zipFiles) {
    if (-not $file.FullName.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Package path outside project.' }
    $entry = $file.FullName.Substring($projectRoot.Length+1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose(); $archiveStream.Dispose() }
Write-Output ('Hostinger package ready: ' + $outputPath)
