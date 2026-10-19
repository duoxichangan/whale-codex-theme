import test from 'node:test';
import assert from 'node:assert/strict';
import {readAppearance} from '../runtime/appearance.mjs';
function doc(classes=[],attrs={},scheme='normal'){const node={classList:{contains:n=>classes.includes(n)},getAttribute:n=>attrs[n]||null,style:{colorScheme:''}};return {documentElement:node,body:null,defaultView:{getComputedStyle:()=>({colorScheme:scheme})}};}
test('native electron appearance outranks a stale generic data-theme',()=>{assert.equal(readAppearance(doc(['electron-dark'],{'data-theme':'light'})),'dark');assert.equal(readAppearance(doc(['electron-light'],{'data-theme':'dark'})),'light');});
test('native appearance attributes, CSS scheme and system fallback remain readable',()=>{assert.equal(readAppearance(doc([],{'data-appearance':'dark'})),'dark');assert.equal(readAppearance(doc([],{},'dark')),'dark');assert.equal(readAppearance(doc(),true),'dark');assert.equal(readAppearance(doc(),false),'light');});
