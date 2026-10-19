param([string]$OutputDirectory='')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'assert-ps-encoding.ps1') -Directory (Join-Path $root 'windows')
if(-not $OutputDirectory){$OutputDirectory=Join-Path $root 'dist\WhaleTheme'}
$destination=[IO.Path]::GetFullPath($OutputDirectory)
if(-not $destination.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Build output must stay inside this workspace'}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach($directory in @('runtime','extension','assets\whale','windows')){
    $target=Join-Path $destination $directory
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $root $directory) -Force | Copy-Item -Destination $target -Recurse -Force
}
& (Join-Path $PSScriptRoot 'assert-ps-encoding.ps1') -Directory (Join-Path $destination 'windows')
Copy-Item -LiteralPath (Join-Path $root 'assets\windows-codex.ico') -Destination (Join-Path $destination 'assets\windows-codex.ico') -Force
Copy-Item -LiteralPath (Join-Path $root 'project.json') -Destination $destination -Force
foreach($name in @('README.md','THIRD-PARTY-NOTICES.md')){Copy-Item -LiteralPath (Join-Path $root $name) -Destination $destination -Force}
Copy-Item -LiteralPath (Join-Path $root 'docs') -Destination $destination -Recurse -Force
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path -LiteralPath $compiler)){throw '.NET Framework C# compiler not found'}
& $compiler /nologo /codepage:65001 /target:winexe /optimize+ /reference:System.Windows.Forms.dll ('/win32icon:'+(Join-Path $root 'assets\windows-codex.ico')) ('/out:'+(Join-Path $destination 'CodexStartup.exe')) (Join-Path $root 'windows\Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Windows launcher build failed'}
Write-Output $destination
