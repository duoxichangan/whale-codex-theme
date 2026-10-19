export function installTheme({ api, metadata, preferences, inspectReadiness, readAppearance, installIcons }) {
  const root = document.documentElement, motion = matchMedia('(prefers-reduced-motion: reduce)'), color = matchMedia('(prefers-color-scheme: dark)');
  const owned = new Map();
  const iconSkin=installIcons(metadata);let appearanceHint=null,homeArtMode=null,authCard,authBrand;
  const marked = new Map(); let settingsButton, authRoot, pageKind='other', subscriptionRoot, fitTimer, fitLimit=0, fitStep=0, fitScale=0;
  function mark(node,name,value='') { if(!node)return; if(!marked.has(node))marked.set(node,new Map());const attrs=marked.get(node);if(!attrs.has(name))attrs.set(name,node.getAttribute(name));if(node.getAttribute(name)!==value)node.setAttribute(name,value); }
  const copies = {
    low:['先写下，','心里的小念头。','从一行文字开始，让好奇自由生长。'],
    medium:['让想法，','沿着线索生长。','整理线索、连接思路，慢慢勾勒你的答案。'],
    high:['静下心，','把难题逐层展开。','把注意力留给问题，让每一步都更清晰。'],
    xhigh:['循着航线，','驶向未知的海岸。','从更多角度推演，让细节组成完整的图景。'],
    ultra:['展开星图，','寻找更远的答案。','细看复杂的联系，探索尚未抵达的可能。']
  };
  let effort = 'low', desiredEffort = 'low', scene = null, pendingKey = null, generation = 0, ready = false, disposed = false, scanTimer, sceneTimer, picker, hero, heading, composer;
  let metrics = { scans: 0, sceneChanges: 0 }, error = null, sceneFade, sceneAnimation, fadeKey;
  const visible = node => node?.isConnected && !node.closest('[hidden],[inert],[aria-hidden="true"],[data-app-shell-active-page="false"],[data-measuring]') && node.getClientRects().length > 0;
  function nativeVisible(node){if(!visible(node)||node.closest('[data-whale-owned]'))return false;for(let p=node;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return [...node.getClientRects()].some(r=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight);}
  function neutralControls(){
    // Opaque native buttons keep their native foreground/background pair.
    // Only transparent chrome needs a foreground chosen for the wallpaper.
    for(const control of document.querySelectorAll('nav button,aside button,[data-whale-titlebar] button')){
      if(!nativeVisible(control))continue;
      const bg=getComputedStyle(control).backgroundColor,alpha=bg==='transparent'?0:bg.startsWith('rgba(')?Number(bg.slice(bg.lastIndexOf(',')+1,-1)):1;
      if(alpha<.12)mark(control,'data-whale-neutral-control');else control.removeAttribute('data-whale-neutral-control');
    }
  }
  function subscription(){
    const candidate=[...document.querySelectorAll('h1,h2,[data-pricing-column-plan-heading],[data-testid="subscription-page"],[data-testid="pricing-page"]')].find(n=>nativeVisible(n)&&!n.closest('[data-message-author-role],.ProseMirror')&&(n.matches('[data-pricing-column-plan-heading],[data-testid="subscription-page"],[data-testid="pricing-page"]')||/^(升级套餐|升级你的套餐|订阅套餐|升级计划|订阅|Upgrade (?:your )?plan|Choose (?:your )?plan|Subscription|Plans)$/i.test(n.textContent.trim())));
    const next=candidate?.closest('main,[role="main"],[data-app-shell-page-surface="true"],[class*="_surface_"],[class*="_page_"],[class*="overflow-y-auto"],[class*="overflow-auto"]')||candidate?.parentElement;
    if(subscriptionRoot!==next){subscriptionRoot?.removeAttribute('data-whale-subscription');subscriptionRoot=next;}
    if(!next)return false;mark(next,'data-whale-subscription');
    for(const label of next.querySelectorAll('h2,h3,[data-plan],div,span')){
      if(!/^(Free|Plus|Pro|Business|Enterprise|免费版|免费|个人版|专业版)$/i.test(label.textContent.trim())||label.closest('button,[role="tab"],[role="tablist"]'))continue;
      const card=label.closest('[data-plan-card],article,section,[class*="rounded"]');const r=card?.getBoundingClientRect();if(r?.width>220&&r.height>180)mark(card,'data-whale-plan-card');
    }
    for(const button of next.querySelectorAll('button'))if(/升级至|升级到|Upgrade to|Get Plus|Get Pro/i.test(button.textContent))mark(button,'data-whale-plan-primary');
    return true;
  }
  function fitHome(reset=false){
    cancelAnimationFrame(fitTimer);fitTimer=requestAnimationFrame(()=>{
      if(!hero?.isConnected)return;
      const probe=composer?.isConnected?composer:hero.parentElement,scaleNow=probe.getBoundingClientRect().width/probe.offsetWidth||1;
      if(fitScale&&Math.abs(scaleNow-fitScale)>.02)reset=true;fitScale=scaleNow;
      let dock=20;
      if(composer?.isConnected){const height=root.getAttribute('data-whale-immersive')==='true'?94:42;const collision=[...composer.querySelectorAll('button,input,textarea,[contenteditable=true]')].some(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&r.right>innerWidth-66&&r.left<innerWidth-18&&r.bottom>innerHeight-20-height&&r.top<innerHeight-18;});if(collision)dock=Math.max(20,innerHeight-composer.getBoundingClientRect().top+12);}
      own('--whale-dock-bottom',dock+'px');
      if(reset){fitLimit=Math.max(0,Math.min(480,innerHeight-230));fitStep=0;}
      // Reduce whole content groups before clipping. Native zoom/font metrics
      // and the project row can consume more space than a fixed breakpoint.
      const fits=['full','trim','short','mark','off'];
      for(let attempt=0;attempt<6;attempt++){
        const hidden=fitStep===4,fit=fits[fitStep];
        if(hero.hidden!==hidden)hero.hidden=hidden;if(hero.dataset.fit!==fit)hero.dataset.fit=fit;
        if(hero.style.maxHeight!==fitLimit+'px')hero.style.maxHeight=fitLimit+'px';
        if(hidden)break;
        const h=hero.getBoundingClientRect(),scale=h.width/hero.offsetWidth||1;let bottom=innerHeight-12;
        if(composer?.isConnected){const c=composer.getBoundingClientRect();bottom=Math.min(bottom,c.top-12);
          const project=nativeAction('project'),p=project?.getBoundingClientRect();
          if(p&&p.top>h.top&&p.bottom>=c.top-80)bottom=Math.min(bottom,p.top-12);
          if(c.bottom>innerHeight-11)fitLimit=Math.max(0,fitLimit-(c.bottom-innerHeight+12)/scale);
        }
        for(let p=hero.parentElement;p&&p!==document.body;p=p.parentElement){const style=getComputedStyle(p);if(/hidden|clip|auto|scroll/.test(style.overflowY)){const r=p.getBoundingClientRect();bottom=Math.min(bottom,r.bottom-p.clientTop*scale);}}
        const limit=Math.max(0,Math.min(fitLimit,(bottom-h.top)/scale));
        if(limit<fitLimit-1){fitLimit=limit;hero.style.maxHeight=fitLimit+'px';}
        if(fitLimit<1||hero.scrollHeight>hero.clientHeight+1){fitStep++;continue;}
        break;
      }
    });
  }
  function mode() {
    return appearanceHint==='system'?(color.matches?'dark':'light'):appearanceHint||readAppearance(document,color.matches);
  }
  function own(name, value) {
    if (!owned.has(name)) owned.set(name, [root.style.getPropertyValue(name), root.style.getPropertyPriority(name)]);
    if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name, value);
  }
  const initialMode = root.getAttribute('data-whale-mode'), initialImmersive = root.getAttribute('data-whale-immersive');
  function setStrength(value) { own('--whale-wash', String(1 - Math.max(0, Math.min(75, value)) / 100)); }
  setStrength(preferences.strength ?? 42);
  async function switchScene() {
    if (disposed) return;
    const key = effort + '-' + mode();
    root.setAttribute('data-whale-mode', mode());
    void homeArt();
    if(key===pendingKey)return;
    if(key===scene){if(pendingKey){generation++;pendingKey=null;ready=true;error=null;}return;}
    const request = ++generation; pendingKey = key; ready = false;
    try {
      const url = await api.asset('scene:' + key);
      const image = new Image(); image.src = url; await image.decode();
      if (disposed) return;
      if(request!==generation){api.trim('scene:',['scene:'+scene,'scene:'+pendingKey,'scene:'+fadeKey],sceneFade?3:2);return;}
      // Snapshot the old decoded image above the body background and fade it
      // away. Keep its Blob alive until the transition completes.
      sceneAnimation?.cancel();sceneFade?.remove();sceneFade=null;fadeKey=null;
      if(scene&&!motion.matches){fadeKey=scene;sceneFade=document.createElement('div');sceneFade.dataset.whaleOwned='';sceneFade.className='whale-scene-transition';const style=getComputedStyle(document.body);sceneFade.style.backgroundImage=style.backgroundImage;sceneFade.style.backgroundPosition=style.backgroundPosition;document.body.prepend(sceneFade);}
      own('--whale-wallpaper', `url("${url}")`);
      const config=metadata.scenes?.[key];
      if(config){
        own('--whale-position',`${(config.art?.focusX??.5)*100}% ${(config.art?.focusY??.5)*100}%`);
      }
      scene = key; pendingKey = null; ready = true; error = null; metrics.sceneChanges++;
      if(sceneFade){const layer=sceneFade;sceneAnimation=layer.animate([{opacity:1},{opacity:0}],{duration:720,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});sceneAnimation.finished.then(()=>{layer.remove();if(sceneFade===layer){sceneFade=null;fadeKey=null;api.trim('scene:',['scene:'+scene,'scene:'+pendingKey],2);}}).catch(()=>{});}else api.trim('scene:', ['scene:' + scene], 2);
    } catch (cause) { if (request === generation) { pendingKey = null; error = String(cause.message); ready = false; } }
  }
  function readPicker() {
    const next = [...document.querySelectorAll('[data-codex-intelligence-trigger][data-selected-reasoning-effort]')].find(visible);
    if (picker !== next) {
      pickerObserver.disconnect(); picker = next;
      if (picker) pickerObserver.observe(picker, { attributes: true, attributeFilter: ['data-selected-reasoning-effort'], childList: true, subtree: true });
    }
    const selected = picker?.getAttribute('data-selected-reasoning-effort');
    const mapped = { none:'low', minimal:'low', low:'low', medium:'medium', high:'high', xhigh:'xhigh', extra_high:'xhigh', ultra:'ultra' }[selected];
    if (mapped && mapped !== desiredEffort) {
      desiredEffort=mapped;clearTimeout(sceneTimer);
      if(mapped!==effort)sceneTimer = setTimeout(() => { effort = desiredEffort; updateHero(); void switchScene(); }, 350);
    }
    void switchScene();
  }
  function updateHero() {
    if (!hero) return;
    if(hero.dataset.effort===effort)return;
    const previous=hero.dataset.effort;hero.dataset.effort=effort;
    const copy = copies[effort];
    hero.querySelector('h1').replaceChildren(document.createTextNode(copy[0]), document.createElement('br'), document.createTextNode(copy[1]));
    hero.querySelector('[data-description]').textContent = copy[2];
    hero.querySelector('[data-voyage-stage]').textContent={low:'拾起念头',medium:'梳理线索',high:'深入推演',xhigh:'统观全局',ultra:'探索远方'}[effort];
    if(previous&&!motion.matches)for(const node of hero.querySelectorAll('h1,[data-description],[data-voyage-stage]')){node.getAnimations().forEach(a=>a.cancel());node.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'ease-out'});}
    fitHome();
  }
  async function homeArt(){
    if(!hero?.isConnected||homeArtMode===mode())return;const target=hero,selected=mode();homeArtMode=selected;
    const keys=['chat','studio','library'].map(id=>'home:'+id+'-'+selected);
    try{const urls=await Promise.all(keys.map(key=>api.asset(key)));if(hero!==target||mode()!==selected||disposed)return;target.querySelectorAll('.whale-home-card img').forEach((img,i)=>img.src=urls[i]);api.trim('home:',keys,3);}catch{if(hero===target)homeArtMode=null;}
  }
  function nativeAction(kind){
    const names={project:['打开项目','打开文件夹','Open project','Open folder'],chat:['新聊天','新建聊天','新对话','New chat','New conversation'],studio:['图像','Images'],library:['资料库','Library']};
    if(kind==='project'){
      const enabled=n=>nativeVisible(n)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true';
      // A hidden hero button has no usable popover anchor. Use the real
      // composer selector, including its projectless and selected states.
      const selectors=[...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')].filter(enabled);
      const trigger=selectors.find(n=>composer?.contains(n))||selectors[0];if(trigger)return trigger;
      return [...document.querySelectorAll('button,[role=button],[role=combobox]')].find(n=>enabled(n)&&/^(?:打开项目|打开文件夹|选择项目|选择你的项目|更改项目(?:[：:].*)?|Open project|Open folder|Choose project|Select (?:your )?project|Change project(?::.*)?)$/i.test(n.getAttribute('aria-label')||n.getAttribute('title')||n.textContent.trim()));
    }
    return [...document.querySelectorAll('button,a,[role=button]')].find(n=>nativeVisible(n)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&(names[kind].includes(n.getAttribute('aria-label')||n.getAttribute('title')||n.textContent.trim())||kind==='studio'&&n.querySelector('[data-whale-glyph=images]')||kind==='library'&&n.querySelector('[data-whale-glyph=library]')));
  }
  function openProject(){
    const trigger=nativeAction('project');if(!trigger)return;
    trigger.focus({preventScroll:true});
    if(trigger.getAttribute('aria-haspopup')==='menu'){
      // Native menus accept keyboard activation. Popovers use click below;
      // both retain their own real visible anchor.
      trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
      trigger.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
    }else trigger.click();
  }
  function decorateAuth(){
    if(!authRoot){authBrand?.remove();authBrand=null;authCard?.removeAttribute('data-whale-auth-card');authCard=null;return;}
    const title=[...authRoot.querySelectorAll('h1')].find(nativeVisible),actions=[...authRoot.querySelectorAll('button,a')].filter(n=>nativeVisible(n)&&/sign|log in|continue|登录|注册|继续/i.test(n.textContent));
    let card=title?.parentElement;
    while(card&&card!==authRoot&&!actions.every(n=>card.contains(n)))card=card.parentElement;
    if(!card||card===authRoot)return;
    if(authCard!==card){authBrand?.remove();authCard?.removeAttribute('data-whale-auth-card');authCard=card;authBrand=null;}
    mark(card,'data-whale-auth-card');for(let p=card.parentElement;p&&p!==authRoot;p=p.parentElement)mark(p,'data-whale-auth-wrap');
    if(!authBrand){authBrand=document.createElement('div');authBrand.dataset.whaleOwned='';authBrand.className='whale-auth-brand';authBrand.innerHTML=metadata.icons.whale+'<span>一小片海<small>让灵感，有处停靠</small></span>';card.prepend(authBrand);}
    for(const svg of card.querySelectorAll('svg'))if(!svg.closest('button,a,[data-whale-owned]')&&!svg.hasAttribute('aria-label'))mark(svg,'data-whale-auth-native-logo');
    for(const button of actions)if(button.localName==='button')mark(button,'data-whale-auth-action',/^(Sign up|注册)$/i.test(button.textContent.trim())?'link':button===actions[0]?'primary':'secondary');
  }
  function home() {
    if (hero && !hero.isConnected) { homeResize.unobserve(hero);if(heading?.parentElement)homeResize.unobserve(heading.parentElement);hero = null; if (heading) heading.hidden = false; heading = null; }
    const icon = document.querySelector('[data-testid="home-icon"]');
    if(icon)mark(icon,'data-whale-home-native-logo');
    const title = icon?.parentElement?.querySelector('[data-feature="game-source"]') || document.querySelector('[data-feature="game-source"]');
    if (!title || hero || !visible(title)) return;
    heading = title; hero = document.createElement('section'); hero.dataset.whaleOwned = ''; hero.className = 'whale-home';
    hero.innerHTML = `<div class="whale-wordmark">${metadata.icons.whale}<span>一小片海<small>让灵感，有处停靠</small></span></div><h1></h1><p data-description></p><div class="whale-voyage-bar"><button type="button" data-project>打开项目 <span aria-hidden="true">→</span></button><dl><div><dt>当前航程</dt><dd data-voyage-stage></dd></div><div><dt>创作节奏</dt><dd>从容落笔</dd></div><div><dt>此刻方向</dt><dd>自由探索</dd></div></dl></div><div class="whale-home-cards"></div><div class="whale-home-foot"><q>每一次提问，都是向更广阔的世界再靠近一步。</q><span>01 / 落笔</span></div>`;
    heading.before(hero); const wasHidden = heading.hidden; heading.dataset.whalePriorHidden = String(wasHidden); heading.hidden = true;
    mark(heading.parentElement,'data-whale-home-slot');fitLimit=Math.max(0,Math.min(480,innerHeight-230));fitStep=0;hero.style.maxHeight=fitLimit+'px';homeResize.observe(hero);homeResize.observe(heading.parentElement);
    const project=hero.querySelector('[data-project]');project.disabled=!nativeAction('project');project.onclick=openProject;
    for(const [kind,title,description,icon]of [['chat','新的对话','开启一段全新的探索旅程','compass'],['studio','创意工坊','让想法在这里生长','images'],['library','灵感图书馆','收藏与发现更多可能','library']]){
      const button=document.createElement('button');button.type='button';button.className='whale-home-card';button.dataset.action=kind;button.innerHTML='<span class="card-art"><img alt=""></span><span class="card-copy">'+metadata.icons[icon]+'<span><strong>'+title+'</strong><small>'+description+'</small></span><i aria-hidden="true">→</i></span>';button.disabled=kind!=='chat'&&!nativeAction(kind);button.onclick=()=>{const native=nativeAction(kind);if(native)native.click();else if(kind==='chat')composer?.querySelector('textarea,[contenteditable=true]')?.focus();};hero.querySelector('.whale-home-cards').append(button);
    }
    homeArtMode=null;updateHero();void homeArt();
  }
  function scan() {
    scanTimer = null; if (disposed || document.hidden) return; metrics.scans++;
    for(const [node,attrs]of marked)if(!node.isConnected){for(const [name,value]of attrs)value===null?node.removeAttribute(name):node.setAttribute(name,value);marked.delete(node);}
    readPicker(); home();
    const terminal=inspectReadiness(document,{sceneReady:true});
    if(authRoot!==terminal.authRoot){authRoot?.removeAttribute('data-whale-auth-surface');authRoot=terminal.authRoot;}
    if(authRoot)mark(authRoot,'data-whale-auth-surface');
    mark(root,'data-whale-auth',String(!!authRoot));
    decorateAuth();iconSkin.scan();
    if(hero){for(const card of hero.querySelectorAll('[data-action]'))card.disabled=card.dataset.action!=='chat'&&!nativeAction(card.dataset.action);const project=hero.querySelector('[data-project]');if(project)project.disabled=!nativeAction('project');}
    // Keep the fullscreen companion host out of Chromium's native drag map.
    // Only real titlebar surfaces receive drag; their controls remain clickable.
    const titlebars=[...document.querySelectorAll('[data-app-shell-titlebar],[class*="_Titlebar_"],[class*="_TitleBar_"]')].filter(n=>{const r=n.getBoundingClientRect();return r.top<40&&r.height<=64;});
    for(const bar of titlebars)mark(bar,'data-whale-titlebar');
    neutralControls();
    const input = [...document.querySelectorAll('[contenteditable="true"][role="textbox"],textarea,.ProseMirror[contenteditable="true"]')].find(nativeVisible);
    const next = input?.closest('form,[data-composer-root],[data-testid="composer"],[class*="_ComposerLayoutRoot_"],[class*="_ComposerRoot_"]') || input?.parentElement;
    if (next !== composer) {
      fitLimit=Math.max(0,Math.min(480,innerHeight-230));fitStep=0;
      if(composer)homeResize.unobserve(composer);
      composer?.removeAttribute('data-whale-composer'); composer = next;
      if (composer) {
        mark(composer,'data-whale-composer');homeResize.observe(composer);
      }
    }
    const isSubscription=subscription();
    const otherSurface=[...document.querySelectorAll('[data-settings-panel-slug],[role="dialog"]')].some(nativeVisible);
    const isHome=!!(heading?.isConnected&&hero?.isConnected&&nativeVisible(heading.parentElement));
    pageKind=authRoot?'auth':isSubscription?'subscription':!otherSurface&&isHome?'home':!otherSurface&&input?'conversation':'other';mark(root,'data-whale-page',pageKind);
    if(pageKind==='home'){
      if(!settingsButton){
        settingsButton=document.createElement('div');settingsButton.className='whale-settings-anchor';settingsButton.dataset.whaleOwned='';
        const shadow=settingsButton.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{position:fixed!important;right:20px!important;bottom:var(--whale-dock-bottom,20px)!important;left:auto!important;top:auto!important;display:block!important;width:42px!important;height:42px!important;margin:0!important;z-index:2147483001!important;pointer-events:auto!important;-webkit-app-region:no-drag!important}:host-context([data-whale-immersive=true]){bottom:calc(var(--whale-dock-bottom,20px) + 52px)!important}button{all:unset;box-sizing:border-box;display:grid;place-items:center;width:42px;height:42px;border-radius:14px;border:1px solid var(--whale-line);background:rgb(var(--whale-panel));color:var(--whale-accent-text);cursor:pointer;pointer-events:auto;-webkit-app-region:no-drag}button:hover{background:var(--whale-soft)}button:focus-visible{outline:2px solid var(--whale-accent);outline-offset:2px}svg{width:20px;height:20px}</style><button type="button" aria-label="主题调整" title="主题调整">'+(metadata.icons.theme||metadata.icons.settings)+'</button>';shadow.querySelector('button').addEventListener('click',()=>api.openSettings());
      }
      if(settingsButton.parentElement!==document.body)document.body.append(settingsButton);
      fitHome();
    }else{settingsButton?.remove();api.closeSettings();}
  }
  function schedule() { if (!disposed && !scanTimer) scanTimer = setTimeout(scan, 120); }
  const pickerObserver = new MutationObserver(readPicker);
  const homeResize=new ResizeObserver(()=>fitHome());
  const resize=()=>fitHome(true);
  const nativeSchemes=new Map([root,document.body].filter(Boolean).map(n=>[n,n.style.colorScheme]));
  const rootObserver = new MutationObserver(records => {
    for(const record of records){const n=record.target,a=record.attributeName;if(a==='class')appearanceHint=n.classList.contains('electron-dark')||n.classList.contains('dark')?'dark':n.classList.contains('electron-light')||n.classList.contains('light')?'light':null;else if(a==='style'){const value=n.style.colorScheme;if(value!==nativeSchemes.get(n)){nativeSchemes.set(n,value);appearanceHint=['dark','light'].includes(value)?value:null;}}else {const v=n.getAttribute(a);if(['dark','light','system'].includes(v))appearanceHint=v;}}
    void switchScene();schedule();
  });
  for (const node of [root,document.body]) if (node) rootObserver.observe(node, { attributes: true, attributeFilter: ['class','style','data-theme','data-appearance','data-color-mode','data-color-scheme','data-whale-immersive'] });
  const pageSurface='main,[role="main"],[data-app-shell-active-page],[data-app-shell-page-surface],[data-settings-panel-slug]';
  const relevant = '[data-codex-intelligence-trigger],[data-feature="game-source"],[data-testid="home-icon"],textarea,[contenteditable="true"],nav,aside,button,a,h1,h2,[data-pricing-column-plan-heading],[data-sidebar-destination],[data-app-shell-titlebar],[data-testid="app-shell-header-context-menu-surface"],'+pageSurface;
  const discovery = new MutationObserver(records => {
    for (const record of records) {
      if (record.target.nodeType === 1 && record.target.closest('[data-whale-owned]')) continue;
      if(record.type==='attributes'){
        const appearance=['class','style'].includes(record.attributeName);
        if(appearance ? record.target.matches(pageSurface) : record.target.matches(relevant)||record.target.querySelector(relevant)){schedule();break;}
      }
      if ([...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && !node.matches('[data-whale-owned],[data-whale-icon]') && (node.matches(relevant) || node.querySelector(relevant)))) { schedule(); break; }
    }
  });
  discovery.observe(document.body, { childList: true, subtree: true, attributes:true,attributeFilter:['aria-label','aria-disabled','disabled','data-sidebar-destination','hidden','inert','aria-hidden','data-app-shell-active-page','class','style'] });
  window.addEventListener('resize',resize);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
  document.addEventListener('visibilitychange', schedule); color.addEventListener('change', readPicker);
  scan();
  return {
    status: () => ({ scene, effort, mode: mode(), ready, pendingKey, error, page:pageKind, ...metrics }), setStrength,canSettings:()=>pageKind==='home',
    dispose() {
      disposed = true; generation++; clearTimeout(scanTimer); clearTimeout(sceneTimer);
      discovery.disconnect(); rootObserver.disconnect(); pickerObserver.disconnect();
      homeResize.disconnect();cancelAnimationFrame(fitTimer);window.removeEventListener('resize',resize);window.removeEventListener('popstate',schedule);window.removeEventListener('hashchange',schedule);
      document.removeEventListener('visibilitychange', schedule); color.removeEventListener('change',readPicker);
      sceneAnimation?.cancel();sceneFade?.remove();
      hero?.remove(); settingsButton?.remove();authBrand?.remove();iconSkin.dispose();
      for(const [node,attrs]of marked)for(const [name,value]of attrs)value===null?node.removeAttribute(name):node.setAttribute(name,value);
      if (heading) { heading.hidden = heading.dataset.whalePriorHidden === 'true'; delete heading.dataset.whalePriorHidden; }

      for (const [name,[value,priority]] of owned) value ? root.style.setProperty(name,value,priority) : root.style.removeProperty(name);
      initialMode === null ? root.removeAttribute('data-whale-mode') : root.setAttribute('data-whale-mode',initialMode);
      initialImmersive === null ? root.removeAttribute('data-whale-immersive') : root.setAttribute('data-whale-immersive',initialImmersive);
    }
  };
}
