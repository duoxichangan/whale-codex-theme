# The caller discovers the registered Store package and validates its signatures.
function Get-WhaleProcessPackageName([uint32]$ProcessId){
    return [PackageStartup]::PackageName($ProcessId)
}
function Get-WhaleProcessPath([uint32]$ProcessId){
    return (Get-Process -Id $ProcessId -ErrorAction Stop).Path
}
function Start-WhaleOfficialRuntime {
    param([string]$Executable,[string]$Arguments,[string]$PackageFullName,[string]$ApplicationId,[switch]$PackageActivation)
    if($PackageActivation){
        $startedId=[PackageStartup]::Launch($ApplicationId,$Arguments)
        $strategy='msix-activation'
    }else{
        $started=Start-Process -FilePath $Executable -ArgumentList $Arguments -PassThru -ErrorAction Stop
        $startedId=[uint32]$started.Id
        $strategy='direct-registered-executable'
    }
    if(-not $startedId){throw 'Official process did not start'}
    $actualPath=Get-WhaleProcessPath -ProcessId $startedId
    if(-not $actualPath -or -not [string]::Equals([IO.Path]::GetFullPath($actualPath),[IO.Path]::GetFullPath($Executable),[StringComparison]::OrdinalIgnoreCase)){throw 'Started process executable does not match the validated official path'}
    $actualPackage=Get-WhaleProcessPackageName -ProcessId $startedId
    $validationMode='msix'
    if($actualPackage -ne $PackageFullName){
        if($PackageActivation -or $actualPackage){throw 'Started process has a mismatched official MSIX identity; injection refused'}
        # Direct execution may legitimately have no package token. The port
        # verifier must additionally prove registration and OpenAI signature.
        $validationMode='registered-executable'
    }
    return [pscustomobject]@{ProcessId=$startedId;Strategy=$strategy;ValidationMode=$validationMode}
}
function Invoke-WhaleNative {
    param([string]$Executable,[string[]]$Arguments)
    # In Windows PowerShell 5.1, redirected stderr otherwise terminates the
    # script before the complete child output and exit status can be logged.
    $before=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    try{
        $lines=@(& $Executable @Arguments 2>&1)
        $status=$LASTEXITCODE
        return [pscustomobject]@{ExitCode=$status;Output=@($lines | ForEach-Object { [string]$_ })}
    }finally{$ErrorActionPreference=$before}
}
