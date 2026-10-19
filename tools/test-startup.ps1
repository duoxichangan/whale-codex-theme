$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'windows\start-runtime.ps1')
$checks=0
New-Item -ItemType Directory -Force -Path (Join-Path (Split-Path $PSScriptRoot -Parent) '.build') | Out-Null
function Check($condition,[string]$message){if(-not $condition){throw $message};$script:checks++;Write-Output ('PASS '+$message)}
$script:launchArguments=$null;$script:actualPackage='Official.Package';$script:actualPath='C:\Official\ChatGPT.exe'
function Start-Process {param($FilePath,$ArgumentList,[switch]$PassThru,$ErrorAction) $script:launchArguments=@($FilePath,$ArgumentList);[pscustomobject]@{Id=400}}
function Get-WhaleProcessPackageName {param($ProcessId) $script:actualPackage}
function Get-WhaleProcessPath {param($ProcessId) $script:actualPath}
Add-Type -TypeDefinition 'public static class PackageStartup { public static int Count; public static uint Launch(string id,string arguments){Count++;return 400;} }'
$expectedArguments='--remote-debugging-address=127.0.0.1 --remote-debugging-port=49667'
$result=Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App'
Check ($script:launchArguments[0] -eq 'C:\Official\ChatGPT.exe') 'cold start uses verified executable'
Check ($script:launchArguments[1] -eq $expectedArguments) 'debug flags reach process argument list unchanged'
Check ($result.ProcessId -eq 400 -and $result.Strategy -eq 'direct-registered-executable') 'direct strategy returns launched PID'
Check ([PackageStartup]::Count -eq 0) 'default cold start does not route flags through MSIX activation'
Check ($result.ValidationMode -eq 'msix') 'matching package token uses strict MSIX validation'
$script:actualPackage=''
$result=Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App'
Check ($result.ValidationMode -eq 'registered-executable') 'direct official executable without package token uses explicit registration validation'
$rejected=$false
try{Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App' -PackageActivation | Out-Null}catch{$rejected=$true}
Check $rejected 'MSIX activation still rejects missing package token'
$script:actualPath='C:\Foreign\ChatGPT.exe';$rejected=$false
try{Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App' | Out-Null}catch{$rejected=$true}
Check $rejected 'direct start rejects a different process image'
$script:actualPath='C:\Official\ChatGPT.exe'
$script:actualPackage='Foreign.Package';$rejected=$false
try{Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App' | Out-Null}catch{$rejected=$true}
Check $rejected 'mismatched process package identity is rejected'
$script:actualPackage='Official.Package'
$result=Start-WhaleOfficialRuntime -Executable 'C:\Official\ChatGPT.exe' -Arguments $expectedArguments -PackageFullName 'Official.Package' -ApplicationId 'Official!App' -PackageActivation
Check ($result.Strategy -eq 'msix-activation' -and [PackageStartup]::Count -eq 2) 'explicit reference activation strategy remains available'
$temp=Join-Path (Split-Path $PSScriptRoot -Parent) ('.build\native-output-'+[Guid]::NewGuid().ToString('N')+'.cmd')
try{
    [IO.File]::WriteAllText($temp,"@echo off`r`necho native-output`r`necho native-error 1>&2`r`nexit /b 7`r`n",[Text.Encoding]::ASCII)
    $result=Invoke-WhaleNative -Executable $env:ComSpec -Arguments @('/c',$temp)
    Check ($result.ExitCode -eq 7) 'native failure retains nonzero exit status'
    Check (($result.Output -join ' ') -match 'native-output' -and ($result.Output -join ' ') -match 'native-error') 'native failure retains stdout and stderr'
}finally{if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force}}
Write-Output ('Startup checks='+$checks)
