export function installBoot({ api, theme, css, loadingOnly, sound, createBootState, inspectReadiness, onComplete }) {
  let disposed = false, timer, transition, video, currentMode, mediaRequest = 0, frameLoaded = false, soundBlocked=false, soundButton;
  const machine = createBootState();
  const frame = document.createElement('iframe');
  frame.dataset.whaleOwned = ''; frame.id = 'whale-boot'; frame.title = '鲸鱼开屏与工作台加载';
  frame.setAttribute('aria-label', '正在准备工作台');
  frame.allow='autoplay';
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;margin:0;z-index:2147483646;background:#04091c;color-scheme:dark;';
  // A modal overlay blocks native pointer/focus navigation while preparing.
  const priorFocus = document.activeElement;
  let doc, win, button, hint, surface, loading;
  function keyboard(event) {
    if (event.key === 'Tab') {
      if (machine.snapshot().phase !== 'intro') { event.preventDefault(); event.stopImmediatePropagation(); frame.focus(); }
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation();
    wait('skipped'); // wait() is inert after intro, including during reveal.
  }
  function containFocus(event) { if (!disposed && event.target !== frame) frame.focus(); }
  function wait(reason) {
    // Start the minimum visible loading interval only after its frame exists.
    if (!frameLoaded) return;
    if (disposed || !machine.wait(reason)) return;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    mediaRequest++;
    if (surface) surface.dataset.phase = 'loading';
    if (button) button.hidden = true;
    if(soundButton)soundButton.hidden=true;
    api.release('boot:light'); api.release('boot:dark');
  }
  function cleanup() {
    if (disposed) return; disposed = true;
    clearTimeout(timer); clearTimeout(introWatchdog); transition?.cancel();
    document.removeEventListener('keydown', keyboard, true); document.removeEventListener('focusin', containFocus, true); win?.removeEventListener('keydown', keyboard, true);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    frame.remove(); api.release('boot:light'); api.release('boot:dark'); api.release('loading');
  }
  async function reveal() {
    if (disposed || !machine.reveal()) return;
    surface.dataset.phase = 'revealing';
    const version = machine.snapshot().version;
    transition = frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 650, easing: 'ease-in-out', fill: 'forwards' });
    try { await transition.finished; } catch { return; }
    if (disposed || !machine.complete(version)) return;
    cleanup();
    if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    onComplete();
  }
  function check() {
    if (disposed) return;
    const ready = inspectReadiness(document, { sceneReady: theme.status().ready });
    machine.readiness(ready.ready, ready.reason, ready.signature);
    if (machine.snapshot().phase === 'loading') {
      transition?.cancel(); frame.style.opacity = '1';
      if (surface) surface.dataset.phase = 'loading';
      if (hint && performance.now() - startedAt > 15000) hint.textContent = '工作台仍在准备中，完成后自动进入';
      void reveal();
    }
    timer = setTimeout(check, document.hidden ? 800 : 160);
  }
  const startedAt = performance.now();
  frame.addEventListener('load', async () => {
    if (disposed || frameLoaded) return; frameLoaded = true;
    win = frame.contentWindow; doc = win.document;
    doc.documentElement.innerHTML = '<head><meta charset="utf-8"></head><body><div class="boot-surface" data-phase="intro"><video playsinline preload="auto"></video><div class="loading" role="status" aria-live="polite"><div class="dream"><div class="aura"></div><i class="orbit"></i><i class="orbit second"></i><img alt="鲸鱼伙伴正在等待"><i class="mote"></i><i class="mote second"></i></div><p>正在准备工作台</p><small>准备完成后自动进入</small><div class="breath-line"></div></div><button type="button">跳过开屏 · Esc</button></div></body>';
    const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
    surface = doc.querySelector('.boot-surface'); video = doc.querySelector('video');
    button = doc.querySelector('button'); hint = doc.querySelector('small'); loading = doc.querySelector('.loading');
    soundButton=doc.createElement('button');soundButton.className='enable-sound';soundButton.textContent='开启声音';soundButton.hidden=true;surface.append(soundButton);
    soundButton.onclick=async()=>{if(machine.snapshot().phase!=='intro')return;try{video.muted=false;await video.play();soundBlocked=false;soundButton.hidden=true;}catch{soundButton.textContent='点击重试声音';}};
    currentMode = theme.status().mode; surface.dataset.mode = currentMode;
    win.addEventListener('keydown', keyboard, true); button.onclick = () => wait('skipped');
    frame.focus();
    api.asset('loading').then(url => { if (!disposed) doc.querySelector('img').src = url; }).catch(() => {});
    video.onended = () => wait('ended'); video.onerror = () => wait('media-error');
    video.loop = false; video.muted = !sound; video.volume = .65; video.disablePictureInPicture = true;
    if (loadingOnly || machine.snapshot().phase !== 'intro') {
      wait('document-reload'); surface.dataset.phase = 'loading'; button.hidden = true;
    } else {
      const request = ++mediaRequest;
      try {
        const url = await api.asset('boot:' + currentMode);
        if (disposed || request !== mediaRequest || machine.snapshot().phase !== 'intro') return;
        video.src = url;
        try { await video.play(); } catch (error) {
          if(error.name!=='NotAllowedError')throw error;
          soundBlocked=sound;video.muted=true;await video.play();if(sound&&machine.snapshot().phase==='intro')soundButton.hidden=false;
        }
      } catch { wait('media-error'); }
    }
  }, { once: true });
  document.addEventListener('keydown', keyboard, true);
  document.addEventListener('focusin', containFocus, true);
  frame.src = 'about:blank'; document.body.append(frame);
  // The bounded intro watchdog only enters loading. It never reveals the app.
  const introWatchdog = setTimeout(() => wait('intro-timeout'), 45000);
  check();
  return { status: () => ({ ...machine.snapshot(), mounted: !disposed, frameLoaded, soundRequested:sound,soundBlocked,muted:video?.muted }), dispose() { clearTimeout(introWatchdog); cleanup(); } };
}
