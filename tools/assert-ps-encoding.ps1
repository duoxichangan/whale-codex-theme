param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference='Stop'
$count=0
foreach($script in Get-ChildItem -LiteralPath $Directory -Filter '*.ps1' -File -Recurse){
    $bytes=[IO.File]::ReadAllBytes($script.FullName)
    $hasBom=$bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191
    $nonAscii=$false
    foreach($value in $bytes){if($value -gt 127){$nonAscii=$true;break}}
    if($nonAscii -and -not $hasBom){throw ('UTF8_BOM_REQUIRED: '+$script.FullName)}
    if($hasBom){
        if($bytes.Length -ge 6 -and $bytes[3] -eq 239 -and $bytes[4] -eq 187 -and $bytes[5] -eq 191){throw ('DUPLICATE_UTF8_BOM: '+$script.FullName)}
        $strictUtf8=[Text.UTF8Encoding]::new($false,$true)
        [void]$strictUtf8.GetString($bytes,3,$bytes.Length-3)
    }
    $tokens=$null;$issues=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($script.FullName,[ref]$tokens,[ref]$issues)
    if($issues.Count){throw ('POWERSHELL_PARSE_FAILED: '+$script.FullName+' errors='+$issues.Count)}
    $count++
}
Write-Output ('PowerShell encoding/parse verified: '+$count+' scripts; ACP='+[Text.Encoding]::Default.CodePage)
