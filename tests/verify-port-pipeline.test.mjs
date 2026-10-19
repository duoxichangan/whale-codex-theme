import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateListeners} from '../extension/windows.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('real PowerShell probe serializes the direct-process registration and signature proof',{skip:process.platform!=='win32'},async()=>{
  await mkdir(path.join(root,'.build'),{recursive:true});const dir=await mkdtemp(path.join(root,'.build','probe-proof-'));
  try{
    const runner=path.join(dir,'probe.ps1');
    await writeFile(runner,`param($Probe,$Scenario)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'public static class PackageStartup { public static string PackageName(uint pid){return "";} }'
function Add-Type {param($Path)}
function Get-NetTCPConnection {param($State,$LocalPort,$ErrorAction) [pscustomobject]@{OwningProcess=400;LocalAddress='127.0.0.1'} }
function Get-CimInstance {param($ClassName,$Filter) [pscustomobject]@{ProcessId=400;ParentProcessId=1;ExecutablePath='C:\\Official\\app\\ChatGPT.exe'} }
function Invoke-CimMethod {param($InputObject,$MethodName) [pscustomobject]@{ReturnValue=0;Sid='S-1-5-21-test'} }
function Get-AppxPackage {param($Name) if($Scenario -ne 'unregistered'){[pscustomobject]@{InstallLocation='C:\\Official';PackageFullName='Official.Package';Publisher='CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B'}} }
function Get-AuthenticodeSignature {param($LiteralPath) $cert=[pscustomobject]@{};$cert | Add-Member -MemberType ScriptMethod -Name GetNameInfo -Value {param($kind,$issuer) 'OpenAI OpCo, LLC'};[pscustomobject]@{Status=$(if($Scenario -eq 'unsigned'){'NotSigned'}else{'Valid'});SignerCertificate=$cert} }
& $Probe -Port 49667
`);
    const expected={pid:400,executable:'C:\\Official\\app\\ChatGPT.exe',sid:'S-1-5-21-test',packageFullName:'Official.Package',launchMode:'registered-executable'};
    for(const scenario of ['official','unsigned','unregistered']){
      const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',runner,path.join(root,'windows/verify-port.ps1'),scenario],{encoding:'utf8',windowsHide:true});
      assert.equal(result.status,0,result.stdout+result.stderr);
      const records=JSON.parse(result.stdout.trim());
      assert.equal(records[0].packageFullName,'');
      if(scenario==='official')validateListeners(records,expected);
      else assert.throws(()=>validateListeners(records,expected));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
