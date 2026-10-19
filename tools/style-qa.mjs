// Regression fixtures for the user's actual 3.0 screenshots: native chrome,
// cramped windows, subscription cards, routing and hostile native form resets.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.WHALE_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
await mkdir('.qa',{recursive:true});
const origin='http://127.0.0.1:4173/';
try{
  const context=await browser.newContext({viewport:{width:1280,height:684}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'?bare');
  await page.addStyleTag({content:'._surface_fixture{--bg-primary:#ffffff;--text-primary:#0d0d0d;background:var(--bg-primary);color:var(--text-primary)}'});
  await page.addStyleTag({content:'nav button{background:transparent;border:0;border-radius:8px;padding:8px 10px} dialog{position:absolute!important;inset:0 auto auto 0!important;margin:0!important;padding:0!important;width:100vw!important}input[type=range]{appearance:none!important;background:none!important;height:0!important}input[type=checkbox]{appearance:none!important;width:0!important;height:0!important}'});
  const native=async()=>page.evaluate(()=>[...document.querySelectorAll('nav button,[data-composer-root] button,[data-composer-root]')].map(n=>{const s=getComputedStyle(n);return {label:n.getAttribute('aria-label')||n.id||n.localName,padding:s.padding,border:s.borderWidth,radius:s.borderRadius,font:s.fontSize,height:s.height,width:s.width,background:n.closest('nav')?s.backgroundColor:null,svg:n.querySelector('svg')?Object.fromEntries([...n.querySelector('svg').attributes].map(a=>[a.name,a.value])):undefined};}));
  const before=await native();
  await page.addScriptTag({url:origin+'injection.js'});await page.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await page.waitForFunction(()=>window.__WHALE_THEME__.status().phase==='done');
  const after=await native();for(let i=0;i<before.length;i++){const {height:bh,width:bw,...b}=before[i],{height:ah,width:aw,...a}=after[i];assert.deepEqual(a,b,'native padding, borders, radii, font sizes and SVG outer attributes stay unchanged');assert.ok(Math.abs(parseFloat(ah)-parseFloat(bh))<=4,'font metrics may change automatic height by at most 4px');assert.ok(Math.abs(parseFloat(aw)-parseFloat(bw))<=4,'font metrics may change automatic width by at most 4px');}
  const palette=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {accent:s.getPropertyValue('--whale-accent').trim(),panel:s.getPropertyValue('--whale-panel').trim()};});
  const channels=palette.accent.match(/\w\w/g).map(v=>parseInt(v,16));assert.ok(channels[2]>channels[1]&&channels[1]>channels[0],'blue palette, no purple');
  results.push('Original sidebar, toolbar and composer geometry/backgrounds retained; native SVG outer attributes preserved; light blue and deep blue palette');
  await page.getByRole('button',{name:'主题调整',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'主题调整'});await settings.waitFor();
  const box=await settings.boundingBox();assert.ok(Math.abs(box.x+box.width/2-640)<2&&Math.abs(box.y+box.height/2-342)<2);
  const range=page.getByRole('slider',{name:'海景浓度'});assert.ok((await range.boundingBox()).height>=20);
  // Chromium does not expose vendor pseudo-element geometry through
  // getComputedStyle; verify the isolated rule and inspect its real screenshot.
  assert.match(await range.evaluate(n=>n.getRootNode().querySelector('style').textContent),/slider-runnable-track\{height:5px/);
  assert.ok((await page.getByRole('checkbox',{name:'显示桌宠'}).boundingBox()).width>=35);
  await range.fill('60');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-theme:preferences:v2')).strength),60);
  for(const mode of ['light','dark']){await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);await page.waitForFunction(mode=>window.__WHALE_THEME__.status().scene.scene==='low-'+mode,mode);await page.screenshot({path:'.qa/revision-settings-'+mode+'.png'});}
  await page.getByRole('button',{name:'关闭主题调整'}).click();
  results.push('Settings remain centered in the top layer despite native !important dialog/input resets; real slider track and switch remain visible and functional');
  for(const [width,height]of [[1280,684],[1000,600],[800,500],[780,420]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(400);
    const rect=await page.locator('[data-composer-root]').boundingBox(),input=await page.locator('textarea').boundingBox(),send=await page.getByRole('button',{name:'发送',exact:true}).boundingBox();
    assert.ok(rect.y>=0&&rect.y+rect.height<=height,JSON.stringify({width,height,rect}));assert.ok(input.y>=0&&input.y+input.height<=height);assert.ok(send.y>=0&&send.y+send.height<=height);
    assert.equal(await page.getByRole('button',{name:'发送',exact:true}).evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'send remains clickable');
    await page.screenshot({path:'.qa/revision-main-'+width+'x'+height+'.png'});
  }
  results.push('Composer, input and send button stay within the viewport and send stays hit-testable at 1280x684, 1000x600, 800x500 and 780x420');
  await page.setViewportSize({width:1280,height:800});
  for(let i=0;i<3;i++){
    await page.evaluate(()=>{
      window.nativeMain=document.querySelector('main');window.nativeMain.remove();
      const pricing=document.createElement('main');pricing.id='pricing-fixture';pricing.style.cssText='background:#f4f4f4;padding:45px 35px;overflow:auto';pricing.innerHTML='<h1 style="text-align:center">升级套餐</h1><div style="display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:20px"><section class="rounded-3xl" style="background:white;border:1px solid #ddd;border-radius:24px;padding:24px"><h3>免费版</h3><p>试用 ChatGPT</p><button disabled>你当前的套餐</button><ul><li>日常文字聊天</li><li>记忆和存储</li></ul></section><section class="rounded-3xl" style="background:white;border:1px solid #ddd;border-radius:24px;padding:24px"><h3>Plus</h3><p>你的 AI 助手</p><button id="upgrade-action" onclick="window.upgradeClicked=true">升级至 Plus</button><ul><li>更多图像生成</li><li>高级智能</li></ul></section></div>';pricing.className='_surface_fixture _page_fixture';pricing.querySelector('h1').textContent='套餐选择';for(const h of pricing.querySelectorAll('h3'))h.setAttribute('data-pricing-column-plan-heading','');for(const card of pricing.querySelectorAll('section'))card.style.background='var(--bg-primary)';document.querySelector('#root').append(pricing);
    });
    await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='subscription');
    assert.equal(await page.getByRole('button',{name:'主题调整',exact:true}).count(),0);
    assert.equal(await page.locator('[data-whale-plan-card]').count(),2);
    assert.equal(await page.locator('#pricing-fixture').evaluate(n=>getComputedStyle(n).getPropertyValue('--text-primary').trim()),await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--whale-text').trim()));
    const card=await page.locator('[data-whale-plan-card]').first().evaluate(n=>({bg:getComputedStyle(n).backgroundColor,radius:getComputedStyle(n).borderRadius}));assert.notEqual(card.bg,'rgb(255, 255, 255)');assert.equal(card.radius,'24px');
    for(const mode of ['light','dark']){await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);await page.waitForFunction(mode=>window.__WHALE_THEME__.status().scene.scene==='low-'+mode,mode);if(i===0)await page.screenshot({path:'.qa/revision-subscription-'+mode+'.png'});}
    await page.getByRole('button',{name:'升级至 Plus'}).click();assert.equal(await page.evaluate(()=>window.upgradeClicked),true);
    await page.evaluate(()=>{document.querySelector('#pricing-fixture').remove();document.querySelector('#root').append(window.nativeMain);});
    await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='home');
    await page.getByRole('button',{name:'主题调整',exact:true}).click();await settings.waitFor();await page.getByRole('button',{name:'关闭主题调整'}).click();
  }
  await page.evaluate(()=>{window.nativeMain.remove();const section=document.createElement('main');section.id='settings-fixture';section.innerHTML='<div data-settings-panel-slug="general-settings"><h1>设置</h1><textarea></textarea></div>';document.querySelector('#root').append(section);});
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='other');assert.equal(await page.getByRole('button',{name:'主题调整',exact:true}).count(),0);
  await page.evaluate(()=>{window.nativeMain.dataset.appShellActivePage='false';document.querySelector('#root').append(window.nativeMain);});
  await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:'主题调整',exact:true}).count(),0);
  await page.evaluate(()=>{document.querySelector('#settings-fixture').dataset.appShellActivePage='false';window.nativeMain.dataset.appShellActivePage='true';});
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='home');
  await page.getByRole('button',{name:'主题调整',exact:true}).click();await settings.waitFor();
  await page.evaluate(()=>window.nativeMain.style.display='none');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='other');
  assert.equal(await settings.isVisible(),false);assert.equal(await page.getByRole('button',{name:'主题调整',exact:true}).count(),0);
  await page.evaluate(()=>window.nativeMain.style.display='');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='home');
  await page.getByRole('button',{name:'主题调整',exact:true}).click();await settings.waitFor();await page.getByRole('button',{name:'关闭主题调整'}).click();
  results.push('Subscription inherits the theme in both modes without changing card geometry or native upgrade action; icon is absent on subscription/settings; route return, active-page and display toggles keep settings functional');
  assert.deepEqual(errors,[]);await writeFile('.qa/style-report.json',JSON.stringify({date:new Date().toISOString(),environment:'Isolated Edge with native-style conflicts; no running Codex modified',results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();server.close();}
