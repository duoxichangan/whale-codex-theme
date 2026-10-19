import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const implementation=await import('../extension/windows.mjs').catch(()=>({}));
const verify=implementation.validateListeners;
const expected={pid:100,executable:'C:\\Official\\ChatGPT.exe',sid:'S-1-5-21-test',packageFullName:'OpenAI.Codex_verified'};
const listener={pid:100,parentPid:1,address:'127.0.0.1',executable:'c:\\official\\ChatGPT.exe',sid:expected.sid,packageFullName:expected.packageFullName};
test('Windows listener validation exists',()=>assert.equal(typeof verify,'function'));
test('accept official same-user root and direct child',()=>{
  verify([listener,{...listener,pid:101,parentPid:100}],expected);
});
for(const [reason,change] of [
  ['public bind',{address:'0.0.0.0'}],['foreign executable',{executable:'C:\\Other\\ChatGPT.exe'}],
  ['foreign user',{sid:'S-1-5-21-other'}],['unrelated process',{pid:200,parentPid:1}]
])test('reject '+reason,()=>{assert.equal(typeof verify,'function');assert.throws(()=>verify([listener,{...listener,...change}],expected));});
test('require launched root to own listener',()=>{assert.equal(typeof verify,'function');assert.throws(()=>verify([{...listener,pid:101,parentPid:100}],expected));assert.throws(()=>verify([],expected));});
test('require official MSIX identity',()=>{assert.throws(()=>verify([{...listener,packageFullName:''}],expected));assert.throws(()=>verify([{...listener,packageFullName:'DifferentPackage'}],expected));});
test('port probe includes its stage and original stderr instead of only Command failed',async()=>{
  await assert.rejects(implementation.verify(49667,expected,async()=>{throw Object.assign(Error('Command failed'),{stderr:JSON.stringify({stage:'tcp-listeners',message:'No listener on the requested port yet',errorId:'CmdletizationQuery_NotFound'})});}),/49667.*tcp-listeners.*No listener.*CmdletizationQuery_NotFound/);
  assert.match(implementation.formatPortProbeError({killed:true,message:'Command failed'},49667),/probe-timeout.*timed out/);
});
test('cold-start argument forwarding, package identity and full native errors',{skip:process.platform!=='win32'},()=>{
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../tools/test-startup.ps1',import.meta.url))],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Startup checks=12/);
});
const directExpected={...expected,launchMode:'registered-executable'};
const directListener={...listener,packageFullName:'',registeredPackageFullName:expected.packageFullName,registeredExecutable:expected.executable,registeredPublisher:'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B',signatureStatus:'Valid',signer:'OpenAI OpCo, LLC'};
test('direct mode accepts only a registered signed official process when the package token is empty',()=>{
  verify([directListener],directExpected);
  assert.throws(()=>verify([directListener],expected));
  verify([listener],directExpected);
});
for(const [reason,change]of [
  ['unregistered executable',{registeredExecutable:'C:\\Other\\ChatGPT.exe'}],
  ['different registration',{registeredPackageFullName:'Foreign.Package'}],
  ['wrong publisher',{registeredPublisher:'CN=Other'}],
  ['invalid signature',{signatureStatus:'NotSigned'}],
  ['foreign signer',{signer:'Someone else'}],
  ['different package token',{packageFullName:'Foreign.Package'}],
  ['unknown package token',{packageFullName:null}],
  ['foreign PID',{pid:999,parentPid:1}],
  ['foreign SID',{sid:'S-1-5-21-other'}],
  ['public port',{address:'0.0.0.0'}]
])test('direct listener rejects '+reason,()=>assert.throws(()=>verify([{...directListener,...change}],directExpected)));
