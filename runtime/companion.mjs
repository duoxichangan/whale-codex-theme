// Event-driven companion: media events, one behavior timer, WAAPI only while walking.
export function installCompanion({ api, metadata, preferences, css, createPetState }) {
  const root = document.documentElement, manifest = metadata.pet, policy = metadata.policy;
  let storage; try { storage = localStorage; } catch {}
  const pet = createPetState({ storage, actionEffects: policy.actions, lock: fn => navigator.locks?.request ? navigator.locks.request('whale-pet-state', fn) : Promise.resolve().then(fn) });
  let disposed = false, enabled = preferences.pet !== false, generation = 0, front = 0, animation = null, behaviorTimer, layoutTimer, walk, drag, busy = false, manualPlayback = false, suppressClickUntil = 0, greetAfter = 0, menuOpen = false, prior = null, position, anchor, manual = false, failed = new Set();
  let petSize = Number.isFinite(preferences.petSize) ? Math.max(.6,Math.min(1.8,preferences.petSize)) : 1;
  let petName=preferences.petName||'小鲸', menuPlacement=null, actionGroup='play', actionCategory='all';
  const glyph=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths.map(d=>'<path d="'+d+'"/>').join('')+'</svg>';
  const symbols={satiety:glyph(['M4 12h16a8 8 0 0 1-16 0ZM6 21h12M8 3v4m4-5v5m4-4v4']),mood:glyph(['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14s1.5 3 4 3 4-3 4-3M8 9h.01M16 9h.01']),energy:glyph(['m13 2-8 12h6l-1 8 9-12h-7l1-8Z']),walking:glyph(['M7 14c-4 0-5 6-1 7 3 1 5-4 3-6ZM16 3c-4-1-6 5-3 6 4 3 7-4 3-6ZM6 10l-1-3M3 12l-1-2M18 12l1 3M21 10l1 2']),resting:glyph(['M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z']),immersive:glyph(['M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M9 12h6'])};
  try { anchor = JSON.parse(storage?.getItem('whale-station:pet-position:v1') || 'null'); } catch {}
  if (anchor && (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y))) anchor = null;
  manual = !!anchor;
  const host = document.createElement('div'); host.dataset.whaleOwned = ''; host.className = 'whale-companion';
  host.style.cssText='position:fixed!important;left:0!important;top:0!important;width:0!important;height:0!important;z-index:2147483000!important;pointer-events:none!important;isolation:isolate!important;';
  const shadow=host.attachShadow({mode:'open'}),sheet=document.createElement('style');sheet.textContent=css;shadow.append(sheet);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'whale-pet'; button.setAttribute('aria-label','鲸鱼伙伴，单击互动，右键打开菜单'); button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-expanded','false');
  const videos = [document.createElement('video'),document.createElement('video')];
  for (const video of videos) { video.muted = true; video.playsInline = true; video.preload = 'none'; video.disablePictureInPicture = true; button.append(video); }
  const speech = document.createElement('p'); speech.className = 'whale-pet-speech'; speech.hidden = true;
  const panel = document.createElement('section'); panel.className = 'whale-pet-panel'; panel.hidden = true; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','鲸鱼伙伴');
  const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'whale-immersive-exit'; exit.setAttribute('aria-label','退出沉浸');exit.title='退出沉浸';exit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 8l4 4-4 4M7 12h14"/></svg>'; exit.hidden = true;
  shadow.append(button,speech,panel,exit); document.body.append(host);
  const listeners = [], timers = new Set();
  function listen(node, event, fn, options) { node.addEventListener(event,fn,options); listeners.push(() => node.removeEventListener(event,fn,options)); }
  function later(fn,ms) { const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn(); },ms); timers.add(timer); return timer; }
  function say(text) { speech.textContent = text; speech.hidden = false; const current = text; later(() => { if (speech.textContent === current) speech.hidden = true; },4500); }
  const state = () => pet.read();
  async function commit(kind,payload={}) { const result = await pet.commit(kind,payload,crypto.randomUUID()); if (menuOpen) refreshMeters(); return result; }
  function geometry() {
    const hit = manifest.hitBox;
    // Keep the character readable in ordinary windows. Only cap by actual
    // available space; viewport height is no longer a multiplier for shrinking.
    const scale = Math.min(260*petSize/hit.height,Math.max(48,innerHeight-100)/hit.height,Math.max(48,innerWidth-32)/hit.width);
    return { w: hit.width*scale, h: hit.height*scale, vw:manifest.canvas.width*scale, vh:manifest.canvas.height*scale, ox:hit.x*scale, oy:hit.y*scale };
  }
  function save() {
    const g = geometry(); anchor = { x:position.x/Math.max(1,innerWidth-g.w), y:position.y/Math.max(1,innerHeight-g.h) };
    try { storage?.setItem('whale-station:pet-position:v1',JSON.stringify(anchor)); } catch {}
  }
  function place(x,y) {
    const g = geometry(); position = { x:Math.max(12,Math.min(innerWidth-g.w-12,x)), y:Math.max(48,Math.min(innerHeight-g.h-12,y)) };
    button.style.left = position.x+'px'; button.style.top = position.y+'px';
    speech.style.left = Math.min(innerWidth-245,Math.max(12,position.x-180))+'px'; speech.style.top = Math.max(48,position.y-42)+'px';
  }
  function obstacles() {
    return [...document.querySelectorAll('button,a,input,textarea,[contenteditable="true"]')].filter(node => (!node.closest('[data-whale-owned]')||node.closest('.whale-home')) && !node.closest('[hidden],[aria-hidden="true"],[data-app-shell-active-page="false"]')).map(node => node.getBoundingClientRect()).filter(r => r.width && r.height);
  }
  function fits(x,y,items,full=true) {
    const g=geometry(),left=full?x-g.ox:x,right=full?x-g.ox+g.vw:x+g.w,top=full?y-g.oy:y,bottom=full?y-g.oy+g.vh:y+g.h;
    return left>=12 && right<=innerWidth-12 && top>=48 && bottom<=innerHeight-12 && items.every(r=>right<r.left-5||left>r.right+5||bottom<r.top-5||top>r.bottom+5);
  }
  function layout() {
    if (disposed) return; cancelWalk(); const g=geometry();
    for (const [key,value] of Object.entries({width:g.w,height:g.h})) button.style[key]=value+'px';
    for (const video of videos) Object.assign(video.style,{width:g.vw+'px',height:g.vh+'px',left:-g.ox+'px',top:-g.oy+'px'});
    if (anchor) {button.dataset.noRoom='false';place(anchor.x*Math.max(1,innerWidth-g.w),anchor.y*Math.max(1,innerHeight-g.h));}
    else {
      const items=obstacles(); let found;
      for (let y=innerHeight-g.h-g.oy-16;y>80&&!found;y-=72) for (let x=innerWidth-g.vw+g.ox-16;x>g.ox;x-=96) if(fits(x,y,items)){found={x,y};break;}
      if(!found)for(let y=innerHeight-g.h-16;y>=48&&!found;y-=64)for(let x=innerWidth-g.w-16;x>=12;x-=80)if(fits(x,y,items,false)){found={x,y};break;}
      button.dataset.noRoom=String(!found); if(found)place(found.x,found.y);
    }
    syncVisibility(); if(menuOpen) positionPanel();
  }
  function cancelWalk() {
    if (!walk) return;
    const progress = Math.max(0,Math.min(1,Number(walk.effect.getComputedTiming().progress)||0));
    const {dx,dy}=walk; walk.cancel(); walk=null; place(position.x+dx*progress,position.y+dy*progress); save();
  }
  function close() { menuOpen=false;menuPlacement=null;panel.hidden=true;button.setAttribute('aria-expanded','false'); schedule(); }
  function syncVisibility() {
    const immersive=state().mode==='immersive'; root.setAttribute('data-whale-immersive',String(immersive));
    const auth=root.getAttribute('data-whale-auth')==='true';
    button.hidden=!enabled||immersive||auth||button.dataset.noRoom==='true'; exit.hidden=!immersive||auth||root.getAttribute('data-whale-page')!=='home';
    if(button.hidden){speech.hidden=true;close();}
    if(button.hidden||document.hidden) videos.forEach(video=>video.pause());
    else if(videos[front].readyState>=2) void videos[front].play().catch(()=>{});
  }
  function base() {return state().mode==='resting'?'rest':'idle';}
  function schedule() {
    clearTimeout(behaviorTimer);
    if(disposed||document.hidden||button.hidden||busy||menuOpen||drag||walk)return;
    behaviorTimer=setTimeout(autonomous,10000+Math.random()*9000);
  }
  async function play(id,{once=false,onEnd,manualAction=false}={}) {
    if(disposed||!manifest.clips[id]||failed.has(id))return false;
    const token=++generation; busy=once;manualPlayback=once&&manualAction;clearTimeout(behaviorTimer);
    const next=videos[1-front]; next.pause();next.onended=next.onloadeddata=next.onerror=null;next.style.opacity='0';
    let mediaTimer;
    try {
      const url=await api.asset('pet:'+id);if(disposed||token!==generation)return false;
      await new Promise((resolve,reject)=>{mediaTimer=later(()=>reject(Error('动作加载超时')),12000);next.onloadeddata=resolve;next.onerror=()=>reject(Error('动作无法播放'));next.loop=!once;next.src=url;next.load();});
      clearTimeout(mediaTimer);timers.delete(mediaTimer);if(disposed||token!==generation)return false;
      if(!document.hidden&&!button.hidden)await next.play();
      if(disposed||token!==generation){next.pause();return false;}
      const previous=videos[front];previous.pause();previous.onended=null;previous.style.opacity='0';front=1-front;next.style.opacity='1';animation=id;
      api.trim('pet:',['pet:'+id],3);
      next.onended=async()=>{
        if(disposed||token!==generation)return;busy=false;manualPlayback=false;
        try{await onEnd?.();}catch{say('这次互动没有记上，请再试一次。');}
        if(disposed||token!==generation)return;
        await play(base());schedule();
      };
      if(!once)schedule();return true;
    }catch(error){
      clearTimeout(mediaTimer);timers.delete(mediaTimer);if(disposed||token!==generation)return false;
      failed.add(id);busy=false;manualPlayback=false;if(manualAction)say(error.message);
      if(id!==base())void play(base());else say('伙伴动画暂时无法加载');schedule();return false;
    }
  }
  async function roam() {
    const items=obstacles(),g=geometry(),dx=(Math.random()<.5?-1:1)*Math.min(200,innerWidth*.16),dy=0;
    const left=Math.min(position.x,position.x+dx),right=Math.max(position.x,position.x+dx)+g.w;
    if(!fits(position.x+dx,position.y,items)||items.some(r=>right>r.left&&left<r.right&&position.y+g.h>r.top&&position.y<r.bottom))return false;
    if(!await play('run',{once:true}))return false;
    walk=button.animate([{transform:'translateX(0)'},{transform:`translateX(${dx}px)`}],{duration:6500,easing:'ease-in-out',fill:'forwards'});walk.dx=dx;walk.dy=dy;
    const current=walk;try{await current.finished;}catch{return true;}
    if(disposed||walk!==current)return true;walk=null;current.cancel();place(position.x+dx,position.y);manual=true;save();await commit('walk');busy=false;void play(base());return true;
  }
  async function autonomous() {
    if(disposed||document.hidden||button.hidden||busy||menuOpen)return;
    const s=state();
    if(s.mode==='walking'&&s.energy<10){say('有点累啦，右键切换「休息」恢复精力吧。');schedule();return;}
    if(s.mode==='walking'&&Math.random()<.3&&await roam())return;
    const pool=(s.mode==='resting'?policy.rest:policy.ambient).filter(id=>id!==prior&&!failed.has(id));
    const id=pool[Math.floor(Math.random()*pool.length)];if(id){prior=id;await play(id,{once:true});}else schedule();
  }
  function refreshMeters() {
    const s=state();for(const [key,label] of [['satiety','饱食'],['mood','心情'],['energy','精力']]){
      const row=panel.querySelector(`[data-meter="${key}"]`);if(!row)continue;row.querySelector('b').textContent=Math.round(s[key]);row.querySelector('progress').value=s[key];
    }
    for(const button of panel.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===s.mode));
    if(panel.firstChild){panel.querySelector('[data-name]').textContent=petName;panel.querySelector('[data-pet-status]').textContent=s.mode==='resting'?'歇一会儿，等潮水回来':'在你身边，慢慢长大';
      const key='menu:'+(s.mode==='resting'?'resting':'daily');api.asset(key).then(url=>{if(!disposed&&panel.isConnected)panel.querySelector('.pet-avatar').style.backgroundImage=`url("${url}")`;}).catch(()=>{});}
  }
  function positionPanel() {
    const g=geometry();panel.style.maxHeight=Math.max(180,innerHeight-100)+'px';
    if(menuPlacement&&menuPlacement.w===innerWidth&&menuPlacement.h===innerHeight){panel.style.left=menuPlacement.x+'px';panel.style.top=menuPlacement.y+'px';return;}
    const width=Math.min(420,innerWidth-32),left=position.x-width-16>=12?position.x-width-16:Math.min(innerWidth-width-12,position.x+g.w+16);
    panel.style.width=width+'px';panel.style.left=Math.max(12,left)+'px';panel.style.top=Math.max(48,Math.min(position.y,innerHeight-panel.getBoundingClientRect().height-16))+'px';
    menuPlacement={x:parseFloat(panel.style.left),y:parseFloat(panel.style.top),w:innerWidth,h:innerHeight};
  }
  function open() {
    cancelWalk();clearTimeout(behaviorTimer);menuOpen=true;panel.hidden=false;button.setAttribute('aria-expanded','true');
    if(!panel.firstChild){
      panel.innerHTML='<header><div class="pet-avatar"></div><div class="pet-identity"><small>桌边的小小海洋</small><h2 data-name></h2><p data-pet-status></p></div><div class="pet-header-actions"><button type="button" data-rename aria-label="给桌宠改名" title="改名">'+metadata.icons.edit+'</button><button type="button" data-close aria-label="关闭伙伴菜单">'+metadata.icons.close+'</button></div></header><form class="pet-rename" hidden><label>伙伴的新名字<input maxlength="24" aria-label="桌宠名字" autocomplete="off"></label><button type="submit">保存</button><button type="button" data-cancel>取消</button></form><div class="pet-meters"></div><div class="pet-modes"></div><details class="pet-size-settings"><summary><span>桌宠大小</span><output></output>'+glyph(['m9 7 5 5-5 5'])+'</summary><label class="pet-size-control"><input type="range" min="60" max="180" step="10" aria-label="桌宠大小"></label></details><div class="pet-tabs" role="group" aria-label="动作分类"></div><div class="pet-subcategories" hidden><label>自发动作<select aria-label="自发动作分类"></select></label></div><div class="pet-list-heading"><span data-list-title></span><small data-action-count></small></div><div class="pet-actions"></div>';
      panel.querySelector('[data-close]').onclick=close;
      const rename=panel.querySelector('.pet-rename'),nameInput=rename.querySelector('input');
      panel.querySelector('[data-rename]').onclick=()=>{rename.hidden=false;nameInput.value=petName;nameInput.focus();nameInput.select();};
      rename.querySelector('[data-cancel]').onclick=()=>{rename.hidden=true;};
      rename.onsubmit=event=>{event.preventDefault();const next=nameInput.value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,24);if(!next){nameInput.setCustomValidity('请写下一个名字');nameInput.reportValidity();return;}petName=next;preferences.petName=next;api.save();rename.hidden=true;button.setAttribute('aria-label',petName+'，单击互动，右键打开菜单');panel.setAttribute('aria-label',petName);refreshMeters();};nameInput.oninput=()=>nameInput.setCustomValidity('');
      for(const [key,text]of [['satiety','饱食'],['mood','心情'],['energy','精力']]){const row=document.createElement('div');row.dataset.meter=key;row.innerHTML='<div class="pet-meter-title">'+symbols[key]+'<span>'+text+'</span></div><div class="pet-meter-value"><b></b><small>/ 100</small></div><progress aria-label="'+text+'" max="100"></progress>';panel.querySelector('.pet-meters').append(row);}
      for(const [id,text]of [['walking','日常'],['resting','休息'],['immersive','沉浸']]){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',text);b.innerHTML=symbols[id]+'<span>'+text+'</span>';b.dataset.mode=id;b.onclick=()=>void setMode(id);panel.querySelector('.pet-modes').append(b);}
      const sizeInput=panel.querySelector('[aria-label="桌宠大小"]');sizeInput.value=String(Math.round(petSize*100));panel.querySelector('output').textContent=sizeInput.value+'%';
      sizeInput.oninput=()=>setSize(Number(sizeInput.value)/100);
      const tabs=[['play','玩乐'],['feed','喂食'],['other','其他']];
      for(const [id,text]of tabs){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.category=id;b.onclick=()=>{actionGroup=id;actionCategory='all';panel.querySelector('select').value='all';renderActions();};panel.querySelector('.pet-tabs').append(b);}
      const categories=[['all','全部自发动作'],['daily','日常小事'],['resting','放松休息'],['work','认真工作'],['walking','四处走动'],['reactions','互动回应'],['seasonal','时令节日'],['other','小小惊喜']];
      const select=panel.querySelector('select');for(const [id,text]of categories){const option=document.createElement('option');option.value=id;option.textContent=text;select.append(option);}select.onchange=()=>{actionCategory=select.value;renderActions();};renderActions();
    }
    refreshMeters();positionPanel();panel.querySelector('[data-close]').focus({preventScroll:true});
  }
  function renderActions() {
    const list=panel.querySelector('.pet-actions');list.replaceChildren();
    for(const tab of panel.querySelectorAll('[data-category]'))tab.setAttribute('aria-pressed',String(tab.dataset.category===actionGroup));
    panel.querySelector('.pet-subcategories').hidden=actionGroup!=='other';
    panel.querySelector('[data-list-title]').textContent=actionGroup==='play'?'一起玩点什么？':actionGroup==='feed'?'今天想吃什么？':'让平常，多一点趣味';
    for(const [id,action]of Object.entries(policy.actions)){
      const mapped=action.category;
      if(actionGroup==='other' ? ['feed','play'].includes(mapped)||(actionCategory!=='all'&&mapped!==actionCategory) : mapped!==actionGroup)continue;
      const b=document.createElement('button');b.type='button';b.className='pet-action';const icon=metadata.actionIcons?.[id];if(icon){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.35');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');for(const d of icon.paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}b.append(svg);}const copy=document.createElement('span');b.append(copy);const title=document.createElement('strong');title.textContent=action.name;copy.append(title);
      const effects=Object.entries(action.effects||{}).map(([key,value])=>({satiety:'饱食',mood:'心情',energy:'精力'}[key])+' '+(value>0?'+':'')+value).join(' · ');
      if(effects){const small=document.createElement('small');small.textContent=effects;copy.append(small);}
      b.onclick=()=>void perform(id,action);list.append(b);
    }
    panel.querySelector('[data-action-count]').textContent=list.children.length+' 个动作';
  }
  async function perform(id,action) {
    const s=state(),kind=action.category==='feed'?'feed':action.category==='play'?'play':'action';
    if(kind==='feed'&&s.satiety>=100){say('肚子已经饱饱的啦。');return;}
    if(kind==='play'&&(s.energy<10||s.energy<Math.max(0,-(action.effects?.energy||0)))){say('精力不够啦，先休息一下吧。');return;}
    close();cancelWalk();const payload={actionId:id,name:action.name,food:action.name,toy:action.name,hits:1};
    await play(id,{once:true,manualAction:true,onEnd:async()=>{const result=await commit(kind,payload);say(result.ok?'完成啦！':'这次互动没有记上。');}});
  }
  async function setMode(mode){cancelWalk();await commit('mode',{mode});close();syncVisibility();void play(base());}
  function setSize(value){if(!Number.isFinite(value))return;cancelWalk();const old=geometry(),foot={x:position.x+old.w/2,y:position.y+old.h};petSize=Math.max(.6,Math.min(1.8,value));const g=geometry();place(foot.x-g.w/2,foot.y-g.h);manual=true;save();preferences.petSize=petSize;api.save();layout();if(panel.firstChild){panel.querySelector('[aria-label="桌宠大小"]').value=String(Math.round(petSize*100));panel.querySelector('output').textContent=Math.round(petSize*100)+'%';}}
  exit.onclick=()=>void setMode('walking');
  listen(button,'contextmenu',event=>{event.preventDefault();event.stopPropagation();open();});
  listen(button,'click',event=>{
    event.stopPropagation();
    if(performance.now()<suppressClickUntil){event.preventDefault();return;}
    if(manualPlayback||performance.now()<greetAfter)return;greetAfter=performance.now()+1000;cancelWalk();
    const pool=manifest.pools.click,id=pool[Math.floor(Math.random()*pool.length)];say('慢慢来，我在这里。');void play(id,{once:true});void commit('touch');
  });
  listen(button,'keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();open();}});
  listen(button,'pointerdown',event=>{
    if(event.button!==0)return;event.stopPropagation();cancelWalk();clearTimeout(behaviorTimer);button.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...position},moved:false};
  });
  listen(button,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved)place(drag.start.x+dx,drag.start.y+dy);});
  function endDrag(event){if(!drag||event.pointerId!==drag.id)return;if(drag.moved){manual=true;save();suppressClickUntil=performance.now()+350;}drag=null;schedule();}
  listen(button,'pointerup',endDrag);listen(button,'pointercancel',endDrag);
  listen(document,'pointerdown',event=>{const path=event.composedPath();if(menuOpen&&!path.includes(panel)&&!path.includes(button))close();},true);
  listen(document,'keydown',event=>{if(menuOpen&&event.key==='Escape'){event.preventDefault();close();button.focus();}},true);
  listen(window,'resize',()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(layout,120);});
  const authObserver=new MutationObserver(records=>{if(!manual&&root.getAttribute('data-whale-page')==='home'&&records.some(r=>r.attributeName==='data-whale-page'))layout();else syncVisibility();if(!button.hidden&&!animation)void play(base());schedule();});authObserver.observe(root,{attributes:true,attributeFilter:['data-whale-auth','data-whale-page']});
  listen(document,'visibilitychange',()=>{
    if(document.hidden){clearTimeout(behaviorTimer);walk?.pause();videos.forEach(video=>video.pause());}
    else{walk?.play();syncVisibility();schedule();}
  });
  layout();if(root.getAttribute('data-whale-auth')!=='true')void play(base());
  return {
    status:()=>({enabled,name:petName,animation,mode:state().mode,busy,menuOpen,position,size:petSize,height:geometry().h,failed:[...failed]}),
    setEnabled(value){enabled=value;syncVisibility();schedule();},
    setSize,
    dispose(){disposed=true;generation++;authObserver.disconnect();clearTimeout(behaviorTimer);clearTimeout(layoutTimer);for(const timer of timers)clearTimeout(timer);walk?.cancel();for(const off of listeners)off();for(const video of videos){video.pause();video.removeAttribute('src');video.load();}host.remove();}
  };
}
