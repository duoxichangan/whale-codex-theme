// Activation and identity checks follow reference extension/windows.mjs (10d986c).
import { execFile as rawExec, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname,join,win32,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { buildInjection } from './payload.mjs';
import { createAssetStore } from './assets.mjs';
import { connect,pageTarget,localSocket } from './cdp.mjs';
const exec=promisify(rawExec),root=dirname(dirname(fileURLToPath(import.meta.url)));
export function validateListeners(records,expected){
  if(!Array.isArray(records)||!records.length)throw Error('No debug listener');
  const official=win32.resolve(expected.executable).toLowerCase();
  const mode=expected.launchMode||'msix';
  if(!['msix','registered-executable'].includes(mode))throw Error('Unknown launch validation mode');
  if(!records.some(x=>x.pid===expected.pid))throw Error('Launched official process does not own listener');
  for(const record of records){
    if(record.address!=='127.0.0.1')throw Error('Debug listener must use 127.0.0.1 only');
    if(!record.executable||win32.resolve(record.executable).toLowerCase()!==official)throw Error('Listener is not the official executable');
    if(!record.sid||record.sid!==expected.sid)throw Error('Listener belongs to another user');
    if(!expected.packageFullName)throw Error('Expected registered package identity is missing');
    if(record.packageFullName!==expected.packageFullName){
      if(mode!=='registered-executable'||record.packageFullName!=='')throw Error('Listener has no matching official MSIX identity');
      if(record.registeredPackageFullName!==expected.packageFullName||!record.registeredExecutable||win32.resolve(record.registeredExecutable).toLowerCase()!==official||record.registeredPublisher!=='CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B')throw Error('Unpackaged listener does not match the registered official Codex package');
      if(record.signatureStatus!=='Valid'||record.signer!=='OpenAI OpCo, LLC')throw Error('Unpackaged listener has no valid official OpenAI signature');
    }
    if(record.pid!==expected.pid&&record.parentPid!==expected.pid)throw Error('Listener is not a child of the launched process');
  }
}
export function formatPortProbeError(error,port){
  const details=String(error.stderr||'').trim();
  let reported;try{reported=JSON.parse(details);}catch{}
  const timeout=error.killed||error.code==='ETIMEDOUT';
  const stage=reported?.stage||(timeout?'probe-timeout':'probe-process');
  const reason=reported?.message||details||error.message||'Unknown failure';
  return `Port ${port} verification failed [${stage}]: ${timeout?'PowerShell probe timed out. ':''}${reason}${reported?.errorId?' ('+reported.errorId+')':''}`;
}
export async function verify(port,expected,run=exec){
  const powershell=join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const env={...process.env,PSModulePath:join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')};
  let stdout;
  try{({stdout}=await run(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'windows/verify-port.ps1'),'-Port',String(port)],{windowsHide:true,timeout:20000,maxBuffer:1024*1024,env}));}
  catch(error){throw new Error(formatPortProbeError(error,port),{cause:error});}
  validateListeners(JSON.parse(stdout.trim()),expected);
}
export function validateAssetRequest(value,keys){
  if(typeof value!=='string'||value.length>512)throw Error('Invalid asset request');
  const data=JSON.parse(value);
  if(!data||typeof data.id!=='string'||!/^\d{1,12}$/.test(data.id)||typeof data.key!=='string'||!keys.has(data.key))throw Error('Unknown asset request');
  return data;
}
export async function inject({port,pid,executable,sid,packageFullName,launchMode='msix',openSettings=false,restore=false,worker=false,openAfterBoot=false,resume=false}){
  if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(pid)||pid<1||!executable||!sid||!packageFullName)throw Error('Invalid launcher parameters');
  const expected={pid,executable,sid,packageFullName,launchMode},deadline=Date.now()+60000;
  let client,last='Waiting for official window';
  while(Date.now()<deadline){
    try{
      await verify(port,expected);
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2000),redirect:'error'});
      if(!response.ok)throw Error('Debug endpoint is not ready');
      const targets=await response.json();if(!Array.isArray(targets))throw Error('Invalid target list');
      const candidates=targets.filter(pageTarget);if(candidates.length!==1)throw Error('Cannot uniquely identify official main page');
      client=await connect(localSocket(candidates[0].webSocketDebuggerUrl,port));break;
    }catch(error){last=error.message;client?.close();client=null;await delay(300);}
  }
  if(!client)throw Error('Could not attach theme: '+last);
  if(openSettings||restore){
    try{
      const expression=restore?'window.__WHALE_THEME__?.restore()':'!!window.__WHALE_THEME__ && (window.__WHALE_THEME__.openSettings(),true)';
      const result=await client.call('Runtime.evaluate',{expression,returnByValue:true});
      if(result.exceptionDetails||(!restore&&result.result?.value!==true))throw Error('No active whale theme in this official window');
      if(openSettings)await client.call('Page.bringToFront');
      return;
    }finally{client.close();}
  }
  if(resume){
    const existing=await client.call('Runtime.evaluate',{expression:'!!window.__WHALE_THEME__',returnByValue:true});
    if(existing.result?.value===true){client.close();process.send?.({ready:true});if(worker)process.disconnect?.();return;}
  }
  const attached=await attachRenderer(client,{openAfterBoot,loadingOnly:resume});
  process.send?.({ready:true});
  if(worker){process.disconnect?.();await attached.closed;}
  return client;
}
// Receives an already verified CDP page. preview=true is used only by isolated QA.
export async function attachRenderer(client,{openAfterBoot=false,preview=false,loadingOnly=false}={}){
  const store=await createAssetStore(root),binding='__whaleAsset_'+randomBytes(12).toString('hex');
  const keys=new Set(store.keys),contexts=new Set();let closed=false,scriptId,active=0;
  const queue=[];
  const frameTree=await client.call('Page.getFrameTree');const mainFrame=frameTree.frameTree.frame.id;
  client.on('Runtime.executionContextCreated',({context})=>{if(context.auxData?.isDefault&&context.auxData.frameId===mainFrame&&(['app://-','app://codex'].includes(context.origin)||preview&&context.origin==='http://127.0.0.1:4173'))contexts.add(context.id);});
  client.on('Runtime.executionContextDestroyed',({executionContextId})=>contexts.delete(executionContextId));
  client.on('Runtime.executionContextsCleared',()=>contexts.clear());
  const closedPromise=new Promise(resolve=>client.on('close',()=>{closed=true;resolve();}));
  async function finishRestore(contextId){
    if(scriptId)await client.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
    await client.call('Runtime.evaluate',{expression:'window.__WHALE_THEME__?.dispose()',contextId});client.close();
  }
  function pump(){
    while(active<2&&queue.length&&!closed){
      const task=queue.shift();active++;
      void (async()=>{
        let result;try{result=await store.get(task.key);}catch(error){result={error:error.message};}
        if(!contexts.has(task.contextId))return;
        await client.call('Runtime.evaluate',{expression:`window.__WHALE_THEME__?.receive(${JSON.stringify(task.id)},${JSON.stringify(result)})`,contextId:task.contextId},20000);
      })().catch(()=>{}).finally(()=>{active--;pump();});
    }
  }
  client.on('Runtime.bindingCalled',event=>{
    if(event.name!==binding||!contexts.has(event.executionContextId))return;
    if(event.payload==='restore'){void finishRestore(event.executionContextId).catch(()=>client.close());return;}
    try{
      const data=validateAssetRequest(event.payload,keys);
      if(queue.length>=12)return;
      queue.push({...data,contextId:event.executionContextId});pump();
    }catch{}
  });
  await client.call('Runtime.enable');await client.call('Page.enable');await client.call('Runtime.addBinding',{name:binding});
  const options={metadata:store.metadata,binding,openSettings:openAfterBoot,preview};
  scriptId=(await client.call('Page.addScriptToEvaluateOnNewDocument',{source:await buildInjection(root,{...options,loadingOnly:true})})).identifier;
  const result=await client.call('Runtime.evaluate',{expression:await buildInjection(root,{...options,loadingOnly}),returnByValue:true,awaitPromise:true},20000);
  if(result.exceptionDetails||result.result?.value?.installed!==true){client.close();throw Error('Theme installation failed');}
  return {closed:closedPromise};
}
async function launchWorker(args){
  const child=fork(fileURLToPath(import.meta.url),[...args,'--worker'],{detached:true,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('Theme worker timed out'));},75000);
    child.once('message',message=>{clearTimeout(timer);if(message.ready){child.unref();resolve();}else reject(Error(message.error||'Theme worker failed'));});
    child.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error('Theme worker exited: '+code));});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1],worker=args.includes('--worker');
  const run=worker||args.includes('--settings')||args.includes('--restore')?inject({port:Number(value('--port')),pid:Number(value('--pid')),executable:value('--exe'),sid:value('--sid'),packageFullName:value('--package'),launchMode:args.includes('--launch-mode')?value('--launch-mode'):'msix',openSettings:args.includes('--settings'),restore:args.includes('--restore'),openAfterBoot:args.includes('--open-after-boot'),resume:args.includes('--resume'),worker}):launchWorker(args);
  run.catch(error=>{console.error(error.message);if(process.send)process.send({error:error.message},()=>process.exit(1));else process.exit(1);});
}
