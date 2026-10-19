param([Parameter(Mandatory=$true)][string]$Installer,[switch]$FilesOnly,[switch]$InProcess)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$directory=Join-Path $root '.build/installer-tests'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /codepage:65001 /debug+ /target:exe /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll ('/out:'+(Join-Path $directory 'InstallerIntegrationTests.exe')) (Join-Path $root 'windows/InstallCore.cs') (Join-Path $root 'windows/InstallIntegration.cs') (Join-Path $root 'windows/ShellShortcut.cs') (Join-Path $PSScriptRoot 'InstallerIntegrationTests.cs')
if($LASTEXITCODE -ne 0){throw 'Installer integration test compilation failed'}
$testTemporary=Join-Path $root '.build\installer-temp'
New-Item -ItemType Directory -Path $testTemporary -Force | Out-Null
$testArguments=@(([IO.Path]::GetFullPath($Installer)),$testTemporary)
if($FilesOnly){$testArguments+='--files-only'}
$executable=Join-Path $directory 'InstallerIntegrationTests.exe'
if($InProcess){
 $assembly=[Reflection.Assembly]::Load([IO.File]::ReadAllBytes($executable))
 $parameters=New-Object object[] 1
 $parameters[0]=[string[]]$testArguments
 $result=$assembly.EntryPoint.Invoke($null,$parameters)
 if($result -ne 0){throw 'Installer integration tests failed'}
}else{
 & $executable @testArguments
 if($LASTEXITCODE -ne 0){throw 'Installer integration tests failed'}
}