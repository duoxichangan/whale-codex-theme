import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReadiness } from '../runtime/readiness.mjs';
function fixture(){
  const rect={x:0,y:0,width:100,height:100,top:0,left:0,bottom:100,right:100};
  const node=()=>({isConnected:true,parentElement:null,disabled:false,closest:()=>null,getAttribute:()=>null,getClientRects:()=>[rect],getBoundingClientRect:()=>rect});
  const input=node(),surface=node();let spinner=false;
  surface.querySelectorAll=selector=>selector.includes('app-loading')?(spinner?[node()]:[]):[input];
  const document={readyState:'complete',fonts:{status:'loaded'},defaultView:{innerWidth:1000,innerHeight:800,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})},querySelectorAll:()=>[surface]};
  return {input,surface,document,spinner:value=>spinner=value};
}
test('requires native main/composer, fonts and decoded scene',()=>{
  const f=fixture();assert.equal(inspectReadiness(f.document,{sceneReady:false}).reason,'wallpaper');
  assert.equal(inspectReadiness(f.document,{sceneReady:true}).ready,true);
  f.input.disabled=true;assert.equal(inspectReadiness(f.document,{sceneReady:true}).reason,'composer');f.input.disabled=false;
  f.document.fonts.status='loading';assert.equal(inspectReadiness(f.document,{sceneReady:true}).reason,'fonts');f.document.fonts.status='loaded';
  f.spinner(true);assert.equal(inspectReadiness(f.document,{sceneReady:true}).ready,false);
});
test('hidden, inactive and injected content never satisfies readiness',()=>{
  const f=fixture();f.input.closest=()=>({});assert.equal(inspectReadiness(f.document,{sceneReady:true}).ready,false);
  f.surface.closest=()=>({});assert.equal(inspectReadiness(f.document,{sceneReady:true}).reason,'main-surface');
});
