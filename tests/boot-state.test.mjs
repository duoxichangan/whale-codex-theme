import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootState } from '../runtime/boot-state.mjs';
test('loading remains fully visible for at least 1500ms even when already ready',()=>{
  let time=0;const state=createBootState({now:()=>time});state.readiness(true,'ready','stable');time=9000;state.wait('skipped');
  time=10499;assert.equal(state.reveal(),false);time=10500;assert.equal(state.reveal(),true);
});
test('skip ends intro only; loading cannot be skipped or timed out',()=>{
  let time=0;const state=createBootState({now:()=>time,minLoadingMs:0});
  assert.equal(state.wait('skipped'),true);assert.equal(state.snapshot().phase,'loading');
  for(const cause of ['skipped','timeout','media-error'])assert.equal(state.wait(cause),false);
  time=1e9;assert.equal(state.reveal(),false);assert.equal(state.snapshot().phase,'loading');
});
test('main page must stay ready before reveal',()=>{
  let time=0;const state=createBootState({now:()=>time,minLoadingMs:0});state.wait();state.readiness(true);
  time=699;assert.equal(state.reveal(),false);time=700;assert.equal(state.reveal(),true);
  assert.equal(state.complete(state.snapshot().version),true);state.readiness(false);
  assert.equal(state.snapshot().phase,'done');
});
test('readiness lost during transition cancels its completion',()=>{
  let time=0;const state=createBootState({now:()=>time,minLoadingMs:0});state.wait();state.readiness(true);time=1000;state.reveal();
  const version=state.snapshot().version;state.readiness(false,'composer');assert.equal(state.complete(version),false);
  assert.equal(state.snapshot().phase,'loading');assert.equal(state.reveal(),false);
  state.readiness(true);time+=700;assert.equal(state.reveal(),true);assert.equal(state.complete(state.snapshot().version),true);
});
test('a ready page never truncates the intro',()=>{const state=createBootState({now:()=>1000,stableMs:0,minLoadingMs:0});state.readiness(true);assert.equal(state.reveal(),false);state.wait();assert.equal(state.reveal(),true);});
test('layout changes restart readiness stability and roll back an in-flight reveal',()=>{
  let time=0;const state=createBootState({now:()=>time,minLoadingMs:0});state.wait();state.readiness(true,'ready','layout-a');time=800;assert.equal(state.reveal(),true);
  const version=state.snapshot().version;state.readiness(true,'ready','layout-b');assert.equal(state.complete(version),false);assert.equal(state.snapshot().phase,'loading');
  time=1200;assert.equal(state.reveal(),false);time=1500;assert.equal(state.reveal(),true);
});
