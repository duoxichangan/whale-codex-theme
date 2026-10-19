$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$manifest=Get-Content -LiteralPath (Join-Path $root 'release\release-manifest.json') -Raw | ConvertFrom-Json
foreach($file in $manifest.files){
    $actual=Get-Item -LiteralPath (Join-Path $root ('release\'+$file.file))
    if($actual.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $actual.FullName -Algorithm SHA256).Hash -ne $file.sha256){throw ('Release hash mismatch: '+$file.file)}
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead((Join-Path $root ('release\WhaleTheme-Portable-'+$manifest.version+'.zip')))
$seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
try{
    foreach($entry in $archive.Entries){
        if($entry.FullName.Contains('\') -or $entry.FullName.StartsWith('/') -or $entry.FullName.Split('/') -contains '..' -or -not $seen.Add($entry.FullName)){throw ('Unsafe or duplicate ZIP entry: '+$entry.FullName)}
        $stream=$entry.Open()
        try{
            $engine=[Security.Cryptography.SHA256]::Create()
            try{$zipHash=[BitConverter]::ToString($engine.ComputeHash($stream)).Replace('-','')}finally{$engine.Dispose()}
        }finally{$stream.Dispose()}
        $stagePath=Join-Path $root ('.build\release\runtime\'+$entry.FullName)
        if((Get-FileHash -LiteralPath $stagePath -Algorithm SHA256).Hash -ne $zipHash){throw ('ZIP differs from build: '+$entry.FullName)}
        $sourcePath=Join-Path $root $entry.FullName
        if((Test-Path -LiteralPath $sourcePath -PathType Leaf) -and (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $zipHash){throw ('Stale source in ZIP: '+$entry.FullName)}
    }
    foreach($required in @('CodexStartup.exe','runtime/boot.mjs','runtime/boot-state.mjs','runtime/readiness.mjs','extension/windows.mjs','windows/launch.ps1','README.md')){if(-not $seen.Contains($required)){throw ('Missing runtime: '+$required)}}
    Write-Output ('Release hashes and '+$seen.Count+' packaged files verified against current source/build.')
}finally{$archive.Dispose()}
