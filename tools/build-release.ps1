param([string]$OutputDirectory='')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$project=Get-Content -LiteralPath (Join-Path $root 'project.json') -Raw | ConvertFrom-Json
if($project.version -ne '3.3.1'){throw 'Update InstallCore.Version and release metadata together'}
if(-not $OutputDirectory){$OutputDirectory=Join-Path $root 'release'}
$destination=[IO.Path]::GetFullPath($OutputDirectory)
if(-not $destination.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Release output must stay inside this workspace'}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$runtime=Join-Path $root '.build\release\runtime'
if(Test-Path -LiteralPath $runtime){
    $stage=[IO.Path]::GetFullPath($runtime)
    $expected=[IO.Path]::GetFullPath((Join-Path $root '.build\release\runtime'))
    if($stage -ne $expected -or -not $stage.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe release staging path'}
    Remove-Item -LiteralPath $stage -Recurse -Force
}
& (Join-Path $PSScriptRoot 'build-windows.ps1') -OutputDirectory $runtime
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
function New-RuntimeZip([string]$SourceDirectory,[string]$ZipPath){
    if(Test-Path -LiteralPath $ZipPath){Remove-Item -LiteralPath $ZipPath -Force}
    $archive=[IO.Compression.ZipFile]::Open($ZipPath,[IO.Compression.ZipArchiveMode]::Create)
    try{
        $boundary=[IO.Path]::GetFullPath($SourceDirectory).TrimEnd('\')+'\'
        foreach($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File){
            $entry=$file.FullName.Substring($boundary.Length).Replace('\','/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$entry,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }finally{$archive.Dispose()}
}
$payload=Join-Path $root '.build\release\payload.zip'
New-RuntimeZip $runtime $payload
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$installer=Join-Path $destination ('WhaleTheme-Setup-'+$project.version+'.exe')
& $compiler /nologo /codepage:65001 /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll ('/win32icon:'+(Join-Path $root 'assets\windows-codex.ico')) ('/resource:'+$payload+',payload.zip') ('/out:'+$installer) (Join-Path $root 'windows\InstallCore.cs') (Join-Path $root 'windows\InstallIntegration.cs') (Join-Path $root 'windows\ShellShortcut.cs') (Join-Path $root 'windows\Setup.cs')
if($LASTEXITCODE -ne 0){throw 'Setup build failed'}
$portable=Join-Path $destination ('WhaleTheme-Portable-'+$project.version+'.zip')
New-RuntimeZip $runtime $portable
$hashes=@(Get-Item -LiteralPath $installer,$portable | ForEach-Object {[ordered]@{file=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash;bytes=$_.Length}})
$manifestJson=[ordered]@{project=$project.name;version=$project.version;referenceCommit=$project.referenceCommit;files=$hashes;installerSigned=$false} | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $destination 'release-manifest.json'),$manifestJson,[Text.UTF8Encoding]::new($false))
$hashes | ForEach-Object {$_.sha256+'  '+$_.file} | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ASCII
Write-Output $installer
Write-Output $portable
