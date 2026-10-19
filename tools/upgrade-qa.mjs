// Major-upgrade regression fixtures. Never connects to the user's Codex.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './preview.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.WHALE_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[],contrast=[];
await mkdir('.qa',{recursive:true});
const origin='http://127.0.0.1:4173/';
async function colors(page,selectors){
  const samples=await page.evaluate(selectors=>{
    const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});ctx.canvas.width=ctx.canvas.height=1;
    const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
    const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const all=[...document.querySelectorAll(selectors),...document.querySelector('.whale-companion')?.shadowRoot?.querySelectorAll(selectors)||[],...document.querySelector('.whale-settings-host')?.shadowRoot?.querySelectorAll(selectors)||[]];
    return all.filter(n=>n.getClientRects().length&&!n.closest('[hidden]')&&!n.disabled).map(n=>{
      const s=getComputedStyle(n),fg=rgb(s.color);let p=n,bg;
      while(p){bg=rgb(getComputedStyle(p).backgroundColor);if(bg[3]===255)break;p=p.parentElement||(p.getRootNode().host||null);}
      if(!bg||bg[3]!==255)return {label:n.getAttribute('aria-label')||n.textContent.trim().slice(0,25),skipped:true};
      return {label:n.getAttribute('aria-label')||n.textContent.trim().slice(0,25),fg:s.color,bg:rgb(getComputedStyle(n).backgroundColor),ratio:(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05)};
    });
  },selectors);
  for(const sample of samples)if(!sample.skipped)assert.ok(sample.ratio>=4.5,JSON.stringify(sample));
  contrast.push(...samples);
}
try{
  const context=await browser.newContext({viewport:{width:1400,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route(origin,async route=>{const response=await route.fetch();const html=(await response.text()).replace('<div id="root"','<header data-app-shell-titlebar style="position:fixed;top:0;left:0;right:0;height:35px;display:flex;align-items:center"><span>工作台</span><button aria-label="最小化" style="margin-left:auto">−</button></header><div id="root"');await route.fulfill({response,body:html});});
  await page.goto(origin);await page.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();
  const loadingAt=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>window.__WHALE_THEME__?.status().phase==='revealing');
  assert.ok(await page.evaluate(t=>performance.now()-t,loadingAt)>=1450,'loading visible minimum');
  await page.waitForFunction(()=>window.__WHALE_THEME__?.status().phase==='done');
  assert.equal(await page.locator('.whale-sticker').count(),0);
  assert.doesNotMatch(await page.locator('.whale-home').innerText(),/codex|deepseek|鲸鱼娘/i);
  assert.equal(await page.locator('[data-whale-titlebar]').evaluate(n=>getComputedStyle(n).webkitAppRegion),'drag');
  assert.equal(await page.getByRole('button',{name:'最小化'}).evaluate(n=>getComputedStyle(n).webkitAppRegion),'no-drag');
  const host=await page.locator('.whale-companion').boundingBox();assert.equal(host.width,0);assert.equal(host.height,0);
  results.push('Loading >=1.5s; no composer sticker/brand copy; native drag surface and controls preserved; pet host has zero drag footprint');
  await page.getByRole('button',{name:'主题调整',exact:true}).click();await page.getByRole('dialog',{name:'主题调整'}).waitFor();
  for(const mode of ['light','dark']){
    await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);await page.waitForFunction(mode=>window.__WHALE_THEME__.status().scene.scene==='low-'+mode,mode);
    await colors(page,'.whale-settings button,.whale-settings label,.whale-settings p');
    await page.screenshot({path:'.qa/settings-'+mode+'.png'});
  }
  await page.getByRole('button',{name:'关闭主题调整'}).click();
  results.push('In-window appearance icon opens themed settings; light/dark text and button contrast >=4.5');
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().companion?.animation);
  await page.locator('.whale-pet').click({button:'right'});
  await page.locator('.pet-size-settings summary').click();
  const panel=page.locator('.whale-pet-panel'),before=await panel.boundingBox();
  const slider=page.getByRole('slider',{name:'桌宠大小'});await slider.focus();
  for(const key of ['ArrowRight','ArrowRight','ArrowRight','ArrowLeft','ArrowLeft','ArrowLeft']){
    await page.keyboard.press(key);const box=await panel.boundingBox();assert.ok(Math.abs(box.x-before.x)<1&&Math.abs(box.y-before.y)<1,'menu cannot move while resizing');
  }
  await page.getByRole('button',{name:'给桌宠改名'}).click();await page.getByRole('textbox',{name:'桌宠名字'}).fill('<浪花 & 星星>');await page.getByRole('button',{name:'保存',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__WHALE_THEME__.status().companion.name),'<浪花 & 星星>');
  assert.equal(await panel.locator('h2').innerText(),'<浪花 & 星星>');
  for(const category of ['玩乐','喂食','其他']){
    await panel.locator('.pet-tabs').getByRole('button',{name:category,exact:true}).click();assert.ok(await panel.locator('.pet-action').count()>0,category);
    assert.ok(await panel.locator('.pet-action svg path').count()>0,category);
  }
  assert.equal(await panel.locator('.pet-tabs button').count(),3);
  const allOther=await panel.locator('.pet-action').count();assert.equal(allOther,61);
  for(const category of ['daily','resting','work','walking','reactions','seasonal','other']){await panel.getByRole('combobox',{name:'自发动作分类'}).selectOption(category);assert.ok(await panel.locator('.pet-action').count()>0,category);}
  await panel.locator('.pet-tabs').getByRole('button',{name:'喂食',exact:true}).click();
  for(const mode of ['light','dark']){
    await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);await page.waitForFunction(mode=>window.__WHALE_THEME__.status().scene.scene==='low-'+mode,mode);
    await colors(page,'.whale-pet-panel button,.whale-pet-panel small,.whale-pet-panel p,.whale-pet-panel label');
    await page.screenshot({path:'.qa/menu-'+mode+'.png'});
  }
  await panel.locator('.pet-modes').getByRole('button',{name:'沉浸',exact:true}).click();
  const exit=page.getByRole('button',{name:'退出沉浸',exact:true});assert.equal(await exit.innerText(),'');assert.equal(await exit.locator('svg').count(),1);
  const eb=await exit.boundingBox();assert.ok(eb.y>900&&eb.x>1300);await exit.click();
  results.push('Pet resize keeps menu anchored; safe rename persists; three primary tabs, all 61 other actions and seven secondary categories present; illustrated menu passes contrast in both modes; icon-only immersive exit is bottom-right');
  await page.reload();await page.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await page.waitForFunction(()=>window.__WHALE_THEME__?.status().companion?.name==='<浪花 & 星星>');
  results.push('Pet name survives reload without HTML interpretation');
  await context.close();
  for(const mode of ['light','dark']){
    const authContext=await browser.newContext({viewport:{width:1200,height:850}}),auth=await authContext.newPage();auth.on('pageerror',e=>errors.push(e.message));
    await auth.route(origin,async route=>{const response=await route.fetch();let html=(await response.text()).replace('data-theme="light"','data-theme="'+mode+'"').replace('<nav>','<nav style="display:none">').replace('<form data-composer-root','<form style="display:none" data-composer-root').replace('<div class="home">','<div class="home" style="display:none">').replace('<main data-app-shell-page-surface="true">','<main data-app-shell-page-surface="true" style="align-items:center;justify-content:center"><div id="auth-native"><h1>Welcome</h1><p>Sign in to your workspace</p><button id="signup-native" onclick="window.signupClicks=(window.signupClicks||0)+1"><span>Sign up</span><svg width="16" height="16"><path fill="#000000" d="M0 0h16v16H0z"/></svg></button><button disabled>Continue with email</button><p><a href="#terms">Terms</a></p><div role="progressbar">正在连接</div></div>');await route.fulfill({response,body:html});});
    await auth.goto(origin);await auth.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await auth.waitForTimeout(2200);
    assert.equal(await auth.evaluate(()=>window.__WHALE_THEME__.status().phase),'loading');
    await auth.locator('[role=progressbar]').evaluate(n=>n.remove());await auth.waitForFunction(()=>window.__WHALE_THEME__.status().phase==='done');
    assert.equal(await auth.locator('html').getAttribute('data-whale-auth'),'true');
    assert.equal(await auth.locator('.whale-pet').isVisible(),false);
    await auth.locator('#signup-native').click();assert.equal(await auth.evaluate(()=>window.signupClicks),1);
    await colors(auth,'#auth-native button,#auth-native p,#auth-native a');
    const svg=await auth.locator('#signup-native path').evaluate(n=>({fill:getComputedStyle(n).fill,color:getComputedStyle(n.closest('button')).color}));assert.equal(svg.fill,svg.color);
    await auth.screenshot({path:'.qa/signup-'+mode+'.png'});
    await auth.evaluate(()=>{document.querySelector('#auth-native').remove();document.querySelector('form').style.display='';document.querySelector('.home').style.display='';});
    await auth.waitForFunction(()=>document.documentElement.getAttribute('data-whale-auth')==='false');await auth.locator('.whale-pet').waitFor({state:'visible'});
    assert.equal(await auth.locator('#whale-boot').count(),0);
    await authContext.close();
  }
  results.push('Native signup releases loading when actionable and not busy, keeps native click behavior, themes text/SVG/buttons in light/dark, transitions to main without rearming boot');
  assert.deepEqual(errors,[]);
  await writeFile('.qa/upgrade-report.json',JSON.stringify({date:new Date().toISOString(),environment:'Isolated Edge fixtures; native Electron window movement requires user install test',results,contrast,errors},null,2));
  console.log(JSON.stringify({results,samples:contrast.length,errors},null,2));
}finally{await browser.close();server.close();}
