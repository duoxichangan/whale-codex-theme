param([string]$ProfileDirectory='', [switch]$NoDialog, [switch]$OpenSettings, [switch]$Restore, [switch]$PackageActivation)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'start-runtime.ps1')
if($ProfileDirectory){$ProfileDirectory=[IO.Path]::GetFullPath($ProfileDirectory)}
$logDirectory=Join-Path $env:LOCALAPPDATA 'WhaleTheme'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logFile=Join-Path $logDirectory 'launcher.log'
$lock=[Threading.Mutex]::new($false,'Local\WhaleThemeLauncher')
$locked=$false
function Write-Log([string]$text){Add-Content -LiteralPath $logFile -Value ((Get-Date -Format s)+' '+$text) -Encoding UTF8}
try{
    try{$locked=$lock.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(-not $locked){exit 0}
    $package=Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1
    if(-not $package){throw '没有找到当前用户安装的官方 Codex。请先安装并打开官方应用。'}
    if($package.Publisher -ne 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B'){throw '应用包发布者与已验证的官方 Codex 不一致。'}
    $appPath=Join-Path $package.InstallLocation 'app'
    $executable=Join-Path $appPath 'ChatGPT.exe'
    $node=Join-Path $appPath 'resources\cua_node\bin\node.exe'
    foreach($file in @($executable,$node)){
        if(-not(Test-Path -LiteralPath $file)){throw ('官方应用缺少运行文件：'+$file)}
        $signature=Get-AuthenticodeSignature -LiteralPath $file
        if($signature.Status -ne 'Valid'){throw ('运行文件签名验证失败：'+$file)}
        if($file -eq $executable -and $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne 'OpenAI OpCo, LLC'){throw '应用签名不是预期的 OpenAI 发布者。'}
    }
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $processes=@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -eq $executable -and $_.CommandLine -notmatch '--type='})
    $existing=$processes | Where-Object {
        if($ProfileDirectory){$_.CommandLine -like ('*'+$ProfileDirectory+'*')}
        else{$_.CommandLine -notmatch '--user-data-dir='}
    } | Where-Object {(Invoke-CimMethod -InputObject $_ -MethodName GetOwnerSid).Sid -eq $sid} | Select-Object -First 1
    if($existing){
        if($OpenSettings -or $Restore){
            $sessionPath=Join-Path $logDirectory 'session.json'
            $session=$null
            try{$session=Get-Content -LiteralPath $sessionPath -Raw -ErrorAction Stop | ConvertFrom-Json}catch{}
            if(-not $session -or $session.pid -ne $existing.ProcessId -or $session.packageFullName -ne $package.PackageFullName -or $session.port -lt 1 -or $session.port -gt 65535){throw 'Codex 正在运行，但本次未从动画入口启动。请保存工作，在菜单或托盘中彻底退出 Codex，再打开「鲸鱼工作台 设置」。'}
            $operation=if($Restore){'--restore'}else{'--settings'}
            $sessionMode=if($session.launchMode){[string]$session.launchMode}else{'msix'}
            $nativeResult=Invoke-WhaleNative -Executable $node -Arguments @((Join-Path $root 'extension\windows.mjs'),'--port',[string]$session.port,'--pid',[string]$existing.ProcessId,'--exe',$executable,'--sid',$sid,'--package',$package.PackageFullName,'--launch-mode',$sessionMode,$operation)
            $result=$nativeResult.Output
            $settingsExit=$nativeResult.ExitCode
            foreach($line in $result){Write-Log ([string]$line)}
            if($settingsExit -ne 0){throw ('设置打开失败：'+($result -join [Environment]::NewLine))}
            if(-not $ProfileDirectory){Add-Type -Path (Join-Path $PSScriptRoot 'Activation.cs');[PackageStartup]::Launch($package.PackageFamilyName+'!App','') | Out-Null}
            exit 0
        }
        Add-Type -Path (Join-Path $PSScriptRoot 'Activation.cs')
        $activatedPid=[PackageStartup]::Launch($package.PackageFamilyName+'!App','')
        Write-Log ('Existing official window activated; pid='+$existing.ProcessId)
        $resumeSession=$null
        try{$resumeSession=Get-Content -LiteralPath (Join-Path $logDirectory 'session.json') -Raw -ErrorAction Stop | ConvertFrom-Json}catch{}
        if($resumeSession -and $resumeSession.pid -eq $existing.ProcessId -and $resumeSession.packageFullName -eq $package.PackageFullName -and $resumeSession.port -ge 1 -and $resumeSession.port -le 65535){
            $resumeMode=if($resumeSession.launchMode){[string]$resumeSession.launchMode}else{'msix'}
            $resumeNative=Invoke-WhaleNative -Executable $node -Arguments @((Join-Path $root 'extension\windows.mjs'),'--port',[string]$resumeSession.port,'--pid',[string]$existing.ProcessId,'--exe',$executable,'--sid',$sid,'--package',$package.PackageFullName,'--launch-mode',$resumeMode,'--resume')
            $resumeResult=$resumeNative.Output
            foreach($line in $resumeResult){Write-Log ([string]$line)}
            if($resumeNative.ExitCode -ne 0){throw ('恢复主题失败：'+($resumeResult -join [Environment]::NewLine))}
        }else{
            throw 'Codex 已在运行，但当前窗口没有有效的鲸鱼主题会话。本次只恢复窗口，不会关闭你的项目。请在方便时保存工作并从菜单或托盘完全退出，再启动鲸鱼工作台。'
        }
        exit 0
    }
    if($Restore){Write-Log 'No running official instance to restore';exit 0}
    $portListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    $portListener.Start();$port=$portListener.LocalEndpoint.Port;$portListener.Stop()
    $arguments='--autoplay-policy=no-user-gesture-required --remote-debugging-address=127.0.0.1 --remote-debugging-port='+$port
    if($ProfileDirectory){
        $profilePath=[IO.Path]::GetFullPath($ProfileDirectory)
        $arguments+=' --user-data-dir="'+$profilePath+'" --no-first-run'
    }
    Add-Type -Path (Join-Path $PSScriptRoot 'Activation.cs')
    $startedRuntime=Start-WhaleOfficialRuntime -Executable $executable -Arguments $arguments -PackageFullName $package.PackageFullName -ApplicationId ($package.PackageFamilyName+'!App') -PackageActivation:$PackageActivation
    $officialPid=$startedRuntime.ProcessId
    @{pid=$officialPid;port=$port;packageFullName=$package.PackageFullName;launchMode=$startedRuntime.ValidationMode} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDirectory 'session.json') -Encoding UTF8
    Write-Log ('Launching verified official app; pid='+$officialPid+'; port='+$port+'; package='+$package.Version+'; strategy='+$startedRuntime.Strategy+'; identity='+$startedRuntime.ValidationMode)
    $nodeArgs=@((Join-Path $root 'extension\windows.mjs'),'--port',[string]$port,'--pid',[string]$officialPid,'--exe',$executable,'--sid',$sid,'--package',$package.PackageFullName,'--launch-mode',$startedRuntime.ValidationMode)
    if($OpenSettings){$nodeArgs+='--open-after-boot'}
    $nativeResult=Invoke-WhaleNative -Executable $node -Arguments $nodeArgs
    $result=$nativeResult.Output
    $exitCode=$nativeResult.ExitCode
    foreach($line in $result){Write-Log ([string]$line)}
    if($exitCode -ne 0){throw ('动画接入失败。'+[Environment]::NewLine+($result -join [Environment]::NewLine))}
}catch{
    Write-Log ('ERROR: '+$_.Exception.Message)
    if(-not $NoDialog){
        Add-Type -AssemblyName System.Windows.Forms
        [Windows.Forms.MessageBox]::Show(($_.Exception.Message+[Environment]::NewLine+[Environment]::NewLine+'官方安装包未修改。请完全退出后从官方图标重新打开。'+[Environment]::NewLine+'日志：'+$logFile),'Codex 启动动画',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    }
    exit 1
}finally{if($locked){$lock.ReleaseMutex()};$lock.Dispose()}

