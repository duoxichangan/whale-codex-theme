param([Parameter(Mandatory=$true)][ValidateRange(1,65535)][int]$Port)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Console]::OutputEncoding
$stage='load-native-types'
try{
    Add-Type -Path (Join-Path $PSScriptRoot 'Activation.cs')
    $stage='tcp-listeners'
    try{$listeners=@(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop)}
    catch{if($_.FullyQualifiedErrorId -like 'CmdletizationQuery_NotFound,*'){$listeners=@()}else{throw}}
    if(-not $listeners.Count){throw 'No listener on the requested port yet'}
    $records=@(foreach($listener in $listeners){
        $stage='listener-process'
        $ownerProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
        if($null -eq $ownerProcess){throw 'Listener process disappeared'}
        $stage='listener-user'
        $owner=Invoke-CimMethod -InputObject $ownerProcess -MethodName GetOwnerSid
        if($owner.ReturnValue -ne 0){throw 'Cannot verify listener user'}
        $stage='listener-package'
        $packageName=[PackageStartup]::PackageName([uint32]$ownerProcess.ProcessId)
        $registration=$null;$registeredExecutable=$null;$signatureStatus=$null;$signer=$null
        if(-not $packageName){
            $stage='listener-registration'
            $registration=Get-AppxPackage -Name 'OpenAI.Codex' | Where-Object {
                $candidate=Join-Path $_.InstallLocation 'app\ChatGPT.exe'
                [string]::Equals($candidate,$ownerProcess.ExecutablePath,[StringComparison]::OrdinalIgnoreCase)
            } | Select-Object -First 1
            if($registration){$registeredExecutable=Join-Path $registration.InstallLocation 'app\ChatGPT.exe'}
            $stage='listener-signature'
            $signature=Get-AuthenticodeSignature -LiteralPath $ownerProcess.ExecutablePath
            $signatureStatus=[string]$signature.Status
            if($signature.SignerCertificate){$signer=$signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false)}
        }
        [pscustomobject]@{pid=[int]$ownerProcess.ProcessId;parentPid=[int]$ownerProcess.ParentProcessId;address=$listener.LocalAddress;executable=$ownerProcess.ExecutablePath;sid=$owner.Sid;packageFullName=$packageName;registeredPackageFullName=$registration.PackageFullName;registeredPublisher=$registration.Publisher;registeredExecutable=$registeredExecutable;signatureStatus=$signatureStatus;signer=$signer}
    })
    ConvertTo-Json -InputObject $records -Compress
}catch{
    $details=[ordered]@{stage=$stage;port=$Port;message=$_.Exception.Message;errorId=$_.FullyQualifiedErrorId;hresult=$_.Exception.HResult}
    [Console]::Error.WriteLine(($details | ConvertTo-Json -Compress))
    exit 1
}
