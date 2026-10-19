import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const bom=Buffer.from([0xef,0xbb,0xbf]);
const check=directory=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/assert-ps-encoding.ps1'),'-Directory',directory],{encoding:'utf8',windowsHide:true});
test('launch script has exactly one UTF-8 BOM',async()=>{
  const bytes=await readFile(path.join(root,'windows/launch.ps1'));
  assert.deepEqual(bytes.subarray(0,3),bom);assert.notDeepEqual(bytes.subarray(3,6),bom);
});
test('Windows PowerShell parses shipped scripts using the actual local code page',{skip:process.platform!=='win32'},()=>{
  const result=check(path.join(root,'windows'));assert.equal(result.status,0,result.stdout+result.stderr);
});
test('build guard rejects stripped or duplicate BOM and accepts the real fixed script',{skip:process.platform!=='win32'},async()=>{
  const base=path.join(root,'.build');await mkdir(base,{recursive:true});
  const dir=await mkdtemp(path.join(base,'encoding-test-'));
  try{
    const bytes=await readFile(path.join(root,'windows/launch.ps1')),file=path.join(dir,'launch.ps1');
    await writeFile(file,bytes);assert.equal(check(dir).status,0);
    await writeFile(file,bytes.subarray(3));const stripped=check(dir);assert.notEqual(stripped.status,0);assert.match(stripped.stdout+stripped.stderr,/UTF8_BOM_REQUIRED/);
    await writeFile(file,Buffer.concat([bom,bytes]));const duplicate=check(dir);assert.notEqual(duplicate.status,0);assert.match(duplicate.stdout+duplicate.stderr,/DUPLICATE_UTF8_BOM/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('PowerShell 5.1 executes Restore no-instance path and writes log without touching real Codex',{skip:process.platform!=='win32'},async()=>{
  const base=path.join(root,'.build');await mkdir(base,{recursive:true});const dir=await mkdtemp(path.join(base,'encoding-restore-'));
  try{
    const packageRoot=path.join(dir,'package');await mkdir(path.join(packageRoot,'app/resources/cua_node/bin'),{recursive:true});
    await writeFile(path.join(packageRoot,'app/ChatGPT.exe'),'');await writeFile(path.join(packageRoot,'app/resources/cua_node/bin/node.exe'),'');
    const runner=path.join(dir,'probe.ps1');
    await writeFile(runner,`$ErrorActionPreference='Stop'
$probeScript=$args[0];$probePackage=$args[1]
function Get-AppxPackage { param($Name) [pscustomobject]@{Publisher='CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B';InstallLocation=$probePackage;Version=[Version]'1.0'} }
function Get-AuthenticodeSignature { param($LiteralPath) $cert=[pscustomobject]@{}; $cert | Add-Member -MemberType ScriptMethod -Name GetNameInfo -Value { param($kind,$issuer) 'OpenAI OpCo, LLC' }; [pscustomobject]@{Status='Valid';SignerCertificate=$cert} }
function Get-CimInstance { param($ClassName,$Filter) @() }
& $probeScript -NoDialog -Restore
exit $LASTEXITCODE
`);
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',runner,path.join(root,'windows/launch.ps1'),packageRoot],{encoding:'utf8',windowsHide:true,env:{...process.env,LOCALAPPDATA:dir},timeout:15000});
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.match(await readFile(path.join(dir,'WhaleTheme/launcher.log'),'utf8'),/No running official instance to restore/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
