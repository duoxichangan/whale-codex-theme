import test from 'node:test';
import assert from 'node:assert/strict';
import { connect,localSocket,pageTarget } from '../extension/cdp.mjs';
test('selects official main page and excludes web/auxiliary targets',()=>{
  assert.equal(pageTarget({type:'page',url:'app://-/index.html'}),true);
  for(const url of ['app://-/signup','app://-/login','app://codex/index.html?initialRoute=/signup'])assert.equal(pageTarget({type:'page',url}),true);
  for(const url of ['https://example.com/index.html','app://other/index.html','about:blank','app://-/index.html?initialRoute=quick-chat','app://-/index.html?initialRoute=avatar'])assert.equal(pageTarget({type:'page',url}),false);
});
test('CDP socket must stay on the verified loopback endpoint',()=>{
  assert.equal(localSocket('ws://127.0.0.1:9341/devtools/page/1',9341),'ws://127.0.0.1:9341/devtools/page/1');
  for(const value of ['ws://example.com:9341/devtools/page/1','ws://127.0.0.1:9222/devtools/page/1','ws://127.0.0.1:9341/devtools/browser/1','ws://user@127.0.0.1:9341/devtools/page/1'])assert.throws(()=>localSocket(value,9341));
});
class Socket extends EventTarget {
  static current;
  constructor(){super();Socket.current=this;queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  send(data){const {id,method}=JSON.parse(data);if(method==='timeout')return;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(method==='error'?{id,error:{message:'denied'}}:{id,result:{ok:method}})})));}
  close(){this.dispatchEvent(new Event('close'));}
}
test('CDP correlates concurrent responses and binding events, handles errors/timeouts/close',async()=>{
  const client=await connect('ws://test',Socket),events=[];
  client.on('Runtime.bindingCalled',event=>events.push(event));
  Socket.current.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({method:'Runtime.bindingCalled',params:{name:'asset'}})}));
  assert.deepEqual(events,[{name:'asset'}]);
  assert.deepEqual(await Promise.all([client.call('one'),client.call('two')]),[{ok:'one'},{ok:'two'}]);
  await assert.rejects(client.call('error'),/denied/);await assert.rejects(client.call('timeout',{},5),/超时/);
  const pending=client.call('timeout');client.close();await assert.rejects(pending,/已关闭/);
});
