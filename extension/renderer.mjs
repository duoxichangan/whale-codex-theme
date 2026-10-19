// Reference: lilhuu/Codex-Startup-Windows renderer.mjs, commit 10d986c.
export function installRenderer(payload, factories) {
  if (window.top !== window) return { installed: false, reason: 'child-frame' };
  if (!payload.preview && (location.protocol !== 'app:' || !['-','codex'].includes(location.hostname) || !['/','/index.html','/login','/signup'].includes(location.pathname) || /avatar|quick.chat|detached|mini|popover|notification/i.test(new URL(location.href).searchParams.get('initialRoute')||''))) return { installed: false, reason: 'foreign-page' };
  if (!document.documentElement) {
    const observer = new MutationObserver(() => {
      if (document.documentElement) { observer.disconnect(); installRenderer(payload, factories); }
    });
    observer.observe(document, { childList: true });
    return { installed: true, pendingDocument: true };
  }
  if (window.__WHALE_THEME__) {
    if (payload.openSettings) window.__WHALE_THEME__.openSettings();
    return { installed: true, alreadyActive: true };
  }
  const root = document.documentElement;
  let disposed = false, theme, boot, companion, settings, settingsPending = payload.openSettings;
  const pending = new Map(), cache = new Map(); let serial = 0;
  const style = document.createElement('style');
  style.dataset.whaleOwned = ''; style.textContent = payload.skin;
  const original = root.getAttribute('data-whale-theme');
  const preferences = (() => {
    try {
      const value = JSON.parse(localStorage.getItem('whale-theme:preferences:v2'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return { strength: Number.isFinite(value.strength) ? Math.max(0,Math.min(75,value.strength)) : 42, pet: value.pet !== false, petSize:Number.isFinite(value.petSize)?Math.max(.6,Math.min(1.8,value.petSize)):1, petName: typeof value.petName==='string' ? value.petName.replace(/[\u0000-\u001f]/g,'').trim().slice(0,24) : '小鲸', sound: value.sound === true };
    } catch { return {}; }
  })();
  const api = {
    restore() { window[payload.binding]('restore'); return true; },
    asset(key) {
      if (disposed) return Promise.reject(Error('Theme disposed'));
      if (cache.has(key)) { const value = cache.get(key); cache.delete(key); cache.set(key, value); return Promise.resolve(value); }
      const existing = [...pending.values()].find(item => item.key === key); if (existing) return existing.promise;
      const id = String(++serial); let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = setTimeout(() => { pending.delete(id); reject(Error('素材读取超时')); }, 20000);
      pending.set(id, { key, promise, resolve, reject, timer });
      try { window[payload.binding](JSON.stringify({ id, key })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      return promise;
    },
    receive(id, result) {
      const item = pending.get(id); if (!item || disposed) return;
      pending.delete(id); clearTimeout(item.timer);
      if (result.error) { item.reject(Error(result.error)); return; }
      try {
        const binary = atob(result.data), bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
        cache.set(item.key, url); item.resolve(url);
      } catch (error) { item.reject(error); }
    },
    release(key) { const url = cache.get(key); if (url) URL.revokeObjectURL(url); cache.delete(key); },
    trim(prefix, keep, limit = 3) {
      const keys = [...cache.keys()].filter(key => key.startsWith(prefix));
      for (const key of keys) if (keys.filter(k => cache.has(k)).length > limit && !keep.includes(key)) api.release(key);
    },
    save() { try { localStorage.setItem('whale-theme:preferences:v2', JSON.stringify(preferences)); } catch {} },
    status: () => ({ installed: !disposed, phase: boot?.status().phase || 'mounting', ready: boot?.status().phase === 'done', boot:boot?.status(),scene: theme?.status(), companion: companion?.status(), cachedAssets: cache.size, pendingAssets: pending.size }),
    openSettings() {
      if (!boot || boot.status().phase !== 'done') { settingsPending = true; return; }
      if(!theme.canSettings())return false;
      settings ||= factories.installSettings({api,preferences,theme,setPet:value=>companion?.setEnabled(value),css:payload.settingsCss,icons:payload.metadata.icons});
      settings.open();return true;
    },
    closeSettings(){settings?.close();},
    dispose() {
      if (disposed) return; disposed = true;
      boot?.dispose(); theme?.dispose(); companion?.dispose(); settings?.dispose(); style.remove();
      window.removeEventListener('keydown', keyboard, true); document.removeEventListener('DOMContentLoaded', start);
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Theme disposed')); } pending.clear();
      for (const url of cache.values()) URL.revokeObjectURL(url); cache.clear();
      original === null ? root.removeAttribute('data-whale-theme') : root.setAttribute('data-whale-theme', original);
      delete window.__WHALE_THEME__;
    }
  };
  function keyboard(event) { if (event.ctrlKey && event.altKey && event.code === 'KeyB') { event.preventDefault(); api.openSettings(); } }
  function start() {
    if (disposed || theme) return;
    document.head.append(style); root.setAttribute('data-whale-theme', 'active');
    theme = factories.installTheme({ api, metadata: payload.metadata, preferences, inspectReadiness: factories.inspectReadiness,readAppearance:factories.readAppearance,installIcons:factories.installIcons });
    boot = factories.installBoot({ api, theme, css: payload.bootCss, loadingOnly: payload.loadingOnly, sound: preferences.sound === true, createBootState: factories.createBootState, inspectReadiness: factories.inspectReadiness, onComplete() {
      companion = factories.installCompanion({ api, metadata: payload.metadata, preferences, css:payload.companionCss, createPetState: factories.createPetState });
      if (settingsPending) { settingsPending = false; api.openSettings(); }
    } });
  }
  window.__WHALE_THEME__ = api; window.addEventListener('keydown', keyboard, true);
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  return { installed: true };
}
