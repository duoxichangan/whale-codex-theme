// User-reported 3.1 failures, tested against conflicting native appearance,
// image-page composers, original auth structure, and actual media playback.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.WHALE_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']}),results=[],errors=[];
await mkdir('.qa',{recursive:true});const origin='http://127.0.0.1:4173/';
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'?bare');
  await page.evaluate(()=>{
    const native=document.querySelector('[data-composer-root] .toolbar');native.innerHTML+='<button type="button" data-composer-navigation-target="workspace-project" aria-label="Choose project" onclick="window.projectOpened=(window.projectOpened||0)+1">选择项目</button>';
    document.querySelector('nav [aria-label="图像"]').onclick=()=>window.imagesOpened=true;document.querySelector('nav [aria-label="资料库"]').onclick=()=>window.libraryOpened=true;
    const send=document.querySelector('[aria-label="发送"] svg');send.setAttribute('viewBox','0 0 20 20');send.style.color='rgb(74, 99, 121)';send.setAttribute('data-native-proof','keep');
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.id='native-send-title';title.textContent='发送图形';send.prepend(title);send.setAttribute('aria-labelledby',title.id);
    const empty=document.createElementNS('http://www.w3.org/2000/svg','rect');empty.setAttribute('width','20');empty.setAttribute('height','20');empty.setAttribute('fill','transparent');send.prepend(empty);
  });
  const svg=page.locator('[aria-label="发送"] svg'),before=await svg.evaluate(n=>({attrs:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),color:getComputedStyle(n).color,box:n.getBoundingClientRect().toJSON(),html:n.innerHTML}));
  await page.addScriptTag({url:origin+'injection.js'});await page.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await page.waitForFunction(()=>window.__WHALE_THEME__.status().phase==='done');
  assert.equal(await page.evaluate(()=>window.__WHALE_THEME__.status().scene.page),'home');
  await page.route('**/asset?key=scene%3Alow-dark',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
  await page.evaluate(()=>document.documentElement.className='electron-dark');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.mode==='dark');await page.evaluate(()=>document.documentElement.className='electron-light');await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__WHALE_THEME__.status().scene.scene),'low-light');await page.unroute('**/asset?key=scene%3Alow-dark');
  const after=await svg.evaluate(n=>({attrs:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),color:getComputedStyle(n).color,html:n.innerHTML}));assert.deepEqual(after.attrs,before.attrs);assert.equal(after.color,before.color);assert.notEqual(after.html,before.html);assert.equal(await svg.locator('[data-whale-glyph=send]').count(),1);
  assert.equal(await svg.locator('title').textContent(),'发送图形');
  assert.notEqual(await svg.locator('[data-whale-glyph=send]').evaluate(n=>getComputedStyle(n).stroke),'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.whale-home-card').count(),3);assert.match(await page.locator('.whale-home h1').innerText(),/先写下/);
  await page.waitForFunction(()=>[...document.querySelectorAll('.whale-home-card img')].every(n=>n.complete&&n.naturalWidth));
  await page.locator('.whale-home [data-project]').click();assert.equal(await page.evaluate(()=>window.projectOpened),1);
  await page.locator('.whale-home-card').nth(1).click();assert.equal(await page.evaluate(()=>window.imagesOpened),true);await page.locator('.whale-home-card').nth(2).click();assert.equal(await page.evaluate(()=>window.libraryOpened),true);
  await page.screenshot({path:'.qa/fixes-home-light.png'});
  const appearance=page.getByRole('button',{name:'主题调整',exact:true});const ab=await appearance.boundingBox();assert.ok(ab.x>1200&&ab.y>730);await appearance.click();await page.getByRole('dialog',{name:'主题调整'}).waitFor();await page.getByRole('button',{name:'关闭主题调整'}).click();
  results.push('Home-only appearance button is bottom-right and clickable; reference-style home has three real native actions and loaded illustrations; SVG inner geometry changes while all native outer attributes and color remain unchanged');
  await page.evaluate(()=>{window.homeMain=document.querySelector('main');window.homeMain.dataset.appShellActivePage='false';window.homeMain.hidden=true;const settings=document.createElement('main');settings.id='native-settings';settings.innerHTML='<div data-testid="app-shell-header-context-menu-surface" data-settings-panel-slug="appearance"><button role="radio" id="choose-dark" onclick="document.documentElement.className=\'electron-dark\';this.setAttribute(\'aria-checked\',\'true\')">深色</button><button role="radio" id="choose-light" onclick="document.documentElement.className=\'electron-light\'">浅色</button></div>';document.querySelector('#root').append(settings);});
  await page.getByRole('radio',{name:'深色',exact:true}).click();await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.mode==='dark');assert.equal(await page.locator('#choose-dark').getAttribute('aria-checked'),'true');
  assert.notEqual(await page.locator('#choose-dark').evaluate(n=>getComputedStyle(n).webkitAppRegion),'drag');
  await page.getByRole('radio',{name:'浅色',exact:true}).click();await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.mode==='light');
  await page.evaluate(()=>document.documentElement.style.colorScheme='dark');await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.mode==='dark');
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='other');assert.equal(await appearance.count(),0);results.push('Native dark/light radios remain clickable even with a misleading header wrapper; latest native class/style signals beat stale data-theme; theme does not write native appearance');
  await page.evaluate(()=>{document.querySelector('#native-settings').remove();window.homeMain.hidden=false;window.homeMain.dataset.appShellActivePage='true';});await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page==='home');
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().companion?.animation);await page.locator('.whale-pet').click({button:'right'});await page.locator('.pet-modes').getByRole('button',{name:'沉浸',exact:true}).click();
  await page.getByRole('button',{name:'退出沉浸',exact:true}).waitFor();const settingBox=await appearance.boundingBox(),exitBox=await page.getByRole('button',{name:'退出沉浸',exact:true}).boundingBox();assert.ok(settingBox.y+settingBox.height<exitBox.y);
  await page.evaluate(()=>{window.homeMain.style.opacity='0';const image=document.createElement('main');image.id='images-fixture';image.innerHTML='<h1>图像</h1><form data-composer-root><textarea aria-label="图像输入"></textarea></form>';document.querySelector('#root').append(image);});
  await page.waitForFunction(()=>window.__WHALE_THEME__.status().scene.page!=='home');assert.equal(await appearance.count(),0);assert.equal(await page.getByRole('button',{name:'退出沉浸',exact:true}).isVisible(),false);
  await page.evaluate(()=>{document.querySelector('#images-fixture').remove();window.homeMain.style.opacity='';window.homeMain.hidden=false;window.homeMain.dataset.appShellActivePage='true';});await page.getByRole('button',{name:'退出沉浸',exact:true}).waitFor();await page.getByRole('button',{name:'退出沉浸',exact:true}).click();await appearance.click();await page.getByRole('button',{name:'关闭主题调整'}).click();await page.screenshot({path:'.qa/fixes-home-dark.png'});
  results.push('Image-page textarea cannot masquerade as home; appearance and immersive exit disappear outside home, return correctly, and never overlap');
  await page.evaluate(()=>{const message=document.createElement('div');message.dataset.messageAuthorRole='assistant';message.innerHTML='<p id="font-prose">中文与 English</p><pre><code id="font-code">const x=1;</code></pre>';document.querySelector('main').append(message);});
  assert.match(await page.locator('#font-prose').evaluate(n=>getComputedStyle(n).fontFamily),/Anthropic Serif/);assert.match(await page.locator('#font-code').evaluate(n=>getComputedStyle(n).fontFamily),/monospace/);
  await page.evaluate(()=>window.__WHALE_THEME__.dispose());assert.equal(await svg.innerHTML(),before.html);results.push('Claude-style sans UI and serif prose stacks include Chinese fallbacks; code stays monospace; restoring theme restores original SVG children');
  await context.close();
  for(const mode of ['light','dark']){
    const authContext=await browser.newContext({viewport:{width:1280,height:720}}),auth=await authContext.newPage();auth.on('pageerror',e=>errors.push(e.message));await auth.goto(origin+'?bare');
    await auth.evaluate(mode=>{document.documentElement.className='electron-'+mode;document.querySelector('nav').style.display='none';document.querySelector('main').innerHTML='<div class="native-auth-wrapper" style="display:flex;flex:1;align-items:center;justify-content:center;background:white"><div style="width:256px;background:white;text-align:center"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M0 0h24v24H0z"/></svg><h1>Sign in to ChatGPT</h1><div style="display:flex;flex-direction:column;gap:10px"><button id="real-signin" onclick="window.signedIn=true">Continue to sign in</button><button>Sign in another way</button><button>Sign up</button></div></div></div>';},mode);
    await auth.addScriptTag({url:origin+'injection.js'});await auth.frameLocator('#whale-boot').getByRole('button',{name:/跳过/}).click();await auth.waitForFunction(()=>window.__WHALE_THEME__.status().phase==='done');
    assert.equal(await auth.locator('[data-whale-auth-card]').count(),1);const primary=auth.locator('[data-whale-auth-action=primary]'),secondary=auth.locator('[data-whale-auth-action=secondary]'),link=auth.locator('[data-whale-auth-action=link]');assert.equal(await secondary.count(),1);assert.equal(await link.count(),1);
    assert.equal(await link.evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await auth.locator('[data-whale-auth-card]').evaluate(n=>getComputedStyle(n).borderRadius),'28px');await primary.click();assert.equal(await auth.evaluate(()=>window.signedIn),true);assert.equal(await auth.getByRole('button',{name:'主题调整',exact:true}).count(),0);await auth.screenshot({path:'.qa/fixes-signup-'+mode+'.png'});await authContext.close();
  }
  results.push('Real-shaped native signup keeps original actions, gains one centered nautical card, a distinct secondary action and a text-only signup link in light/dark');
  for(const blocked of [false,true]){
    const audioContext=await browser.newContext({viewport:{width:1000,height:700}});await audioContext.addInitScript(()=>localStorage.setItem('whale-theme:preferences:v2',JSON.stringify({sound:true})));
    const audio=await audioContext.newPage();audio.on('pageerror',e=>errors.push(e.message));
    if(blocked)await audio.route('**/asset?key=boot*',async route=>{await audio.evaluate(()=>{const win=document.querySelector('#whale-boot').contentWindow,native=win.HTMLMediaElement.prototype.play;let rejected=false;win.HTMLMediaElement.prototype.play=function(){if(!this.muted&&!rejected){rejected=true;return win.Promise.reject(new win.DOMException('fixture autoplay policy','NotAllowedError'));}return native.call(this);};});await route.continue();});
    await audio.goto(origin);const frame=audio.frameLocator('#whale-boot');await audio.waitForFunction(()=>document.querySelector('#whale-boot')?.contentDocument.querySelector('video')?.currentTime>.1);
    if(blocked){await frame.getByRole('button',{name:'开启声音',exact:true}).click();}
    assert.equal(await frame.locator('video').evaluate(n=>n.muted),false);await audio.waitForFunction(()=>document.querySelector('#whale-boot').contentDocument.querySelector('video').webkitAudioDecodedByteCount>0);assert.equal(await audio.evaluate(()=>window.__WHALE_THEME__.status().boot.soundBlocked),false);await audioContext.close();
  }
  results.push('Actual intro audio decodes unmuted with requested sound; autoplay rejection exposes a working explicit enable-sound action instead of silently ignoring the preference');
  assert.deepEqual(errors,[]);await writeFile('.qa/fixes-report.json',JSON.stringify({date:new Date().toISOString(),environment:'Isolated Edge; native app settings and physical audio output not operated',results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();server.close();}
