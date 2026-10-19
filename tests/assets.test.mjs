import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createAssetStore } from '../extension/assets.mjs';
import { buildInjection } from '../extension/payload.mjs';
import { validateAssetRequest } from '../extension/windows.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),store=await createAssetStore(root);
test('all ten scenes, both intros and every pet action exist',async()=>{
  assert.equal(store.keys.filter(k=>k.startsWith('scene:')).length,10);
  for(const key of store.keys){const asset=await store.get(key);assert.ok(asset.data.length>0,key);}
});
test('asset bridge accepts only packaged keys and bounded ids',async()=>{
  const keys=new Set(store.keys);assert.deepEqual(validateAssetRequest('{"id":"1","key":"loading"}',keys),{id:'1',key:'loading'});
  for(const value of ['{}','null','{"id":"1","key":"../../config.toml"}','{"id":"1;evil","key":"loading"}','x'.repeat(513)])assert.throws(()=>validateAssetRequest(value,keys));
  await assert.rejects(store.get('../README.md'),/Unknown/);
});
test('initial injection carries metadata, no media; factories compile together',async()=>{
  const source=await buildInjection(root,{metadata:store.metadata,binding:'testBinding'});
  assert.ok(source.length<200000);assert.ok(!source.includes('base64,AAAA'));assert.ok(!source.includes('data:video/'));
  assert.doesNotThrow(()=>new Function(source));
});
