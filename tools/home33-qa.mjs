import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.WHALE_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
await mkdir('.qa',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?bare');
 await page.evaluate(()=>{const icon=document.querySelector('[data-testid=home-icon]');icon.innerHTML='<svg width="40" height="40"><circle cx="20" cy="20" r="15"/></svg>';});
 await page.addScriptTag({url:'http://127.0.0.1:4173/injection.js'});await page.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await page.waitForFunction(()=>window.__WHALE_THEME__.status().phase==='done');
 assert.equal(await page.locator('[data-testid=home-icon]').isVisible(),false);
 assert.equal(await page.locator('[data-count]').count(),0);assert.equal(await page.locator('.whale-voyage-bar dt').allTextContents().then(a=>a.join(',')),'当前航程,创作节奏,此刻方向');
 const titles=[];
 for(const effort of ['low','medium','high','xhigh','ultra']){
  await page.evaluate(e=>document.querySelector('[data-codex-intelligence-trigger]').dataset.selectedReasoningEffort=e,effort);
  await page.waitForFunction(e=>window.__WHALE_THEME__.status().scene.scene===e+'-light',effort);
  titles.push(await page.locator('.whale-home h1').innerText());
  if(effort!=='low'){await page.waitForTimeout(120);const opacity=await page.locator('.whale-scene-transition').evaluate(n=>Number(getComputedStyle(n).opacity));assert.ok(opacity>0&&opacity<1,'real crossfade has intermediate opacity');}
  await page.waitForTimeout(800);
 }
 assert.equal(new Set(titles).size,5);assert.equal(await page.locator('[data-voyage-stage]').textContent(),'探索远方');
 await page.evaluate(()=>{const trigger=document.querySelector('[data-codex-intelligence-trigger]');trigger.dataset.selectedReasoningEffort='high';});await page.waitForTimeout(70);await page.evaluate(()=>document.querySelector('[data-codex-intelligence-trigger]').dataset.selectedReasoningEffort='ultra');await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__WHALE_THEME__.status().scene.effort),'ultra');
 results.push('Native home logo hidden and restorable; all five reasoning levels have distinct progressive copy and real image crossfade; rapid change back cancels an obsolete pending selection; unreliable counters removed');
 const art=await page.locator('.card-art img').evaluateAll(nodes=>nodes.map(n=>({w:n.naturalWidth,h:n.naturalHeight,transform:getComputedStyle(n).transform,src:n.src})));
 assert.equal(new Set(art.map(a=>a.src)).size,3);for(const a of art){assert.equal(a.w,960);assert.equal(a.h,640);assert.equal(a.transform,'none');}
 await page.screenshot({path:'.qa/home33-light.png'});
 results.push('Three independently generated card images load as distinct 960x640 assets without scene zoom/crop transforms');
 for(const [width,height]of [[1000,600],[800,500],[780,420],[610,360],[1280,684]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(650);
  const samples=await page.evaluate(async()=>{
   const samples=[];for(let i=0;i<16;i++){document.querySelector('nav button').setAttribute('title','native refresh '+i);await new Promise(r=>setTimeout(r,140));const hero=document.querySelector('.whale-home'),c=document.querySelector('[data-composer-root]').getBoundingClientRect();samples.push({hidden:hero.hidden,fit:hero.dataset.fit,max:hero.style.maxHeight,top:Math.round(c.top),bottom:Math.round(c.bottom)});}return samples;
  });
  assert.equal(new Set(samples.map(s=>JSON.stringify(s))).size,1,'home and composer must converge despite repeated native scans '+width+'x'+height+JSON.stringify(samples));
  const rect=await page.locator('[data-composer-root]').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=height+1,JSON.stringify(rect));
  assert.equal(await page.getByRole('button',{name:'发送',exact:true}).evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
  await page.screenshot({path:'.qa/home33-'+width+'x'+height+'.png'});
 }
 results.push('Five window sizes including 610x360 keep composer hit-testable; 16 forced native scans per size produce no hero/composer oscillation');
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.scene==='ultra-dark');await page.waitForTimeout(850);await page.screenshot({path:'.qa/home33-dark.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.querySelector('[data-codex-intelligence-trigger]').dataset.selectedReasoningEffort='low');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.scene==='low-dark');assert.equal(await page.locator('.whale-scene-transition').count(),0);
 await page.evaluate(()=>window.__WHALE_THEME__.dispose());assert.equal(await page.locator('[data-testid=home-icon]').isVisible(),true);assert.equal(await page.locator('.whale-scene-transition').count(),0);
 results.push('Deep-blue theme uses the new artwork; reduced-motion skips image transition; dispose restores the native logo and removes transition layers');
 assert.deepEqual(errors,[]);await context.close();
 await writeFile('.qa/home33-report.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();server.close();}
