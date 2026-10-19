export function inspectReadiness(document, { sceneReady = false } = {}) {
  const visible = node => {
    if (!node?.isConnected || node.closest('[hidden],[inert],[aria-hidden="true"],[data-app-shell-active-page="false"],[data-whale-owned]')) return false;
    const view = document.defaultView;
    for (let current = node; current; current = current.parentElement) {
      const style = view.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return [...node.getClientRects()].some(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < view.innerHeight && r.left < view.innerWidth);
  };
  const preparation = document.readyState === 'loading' ? 'document' : !sceneReady ? 'wallpaper' : document.fonts && document.fonts.status !== 'loaded' ? 'fonts' : null;
  const surfaces = [...document.querySelectorAll('[data-app-shell-page-surface="true"],[data-app-shell-active-page="true"],main,[role="main"]')].filter(visible);
  // Same native heading + actionable auth controls contract as the original
  // project's startup-guard. A URL, spinner or an arbitrary text node is insufficient.
  const shell = [...document.querySelectorAll('[data-testid="app-shell-header-context-menu-surface"],aside.app-shell-left-panel,[data-ds-part="sidebar"]')].some(visible);
  const conversation='[data-message-author-role],[data-local-conversation-user-anchor],[data-local-conversation-final-assistant],.ProseMirror';
  const hasComposer=surfaces.some(surface=>[...surface.querySelectorAll('[contenteditable="true"][role="textbox"],[contenteditable="true"].ProseMirror,textarea,[data-testid="composer-input"]')].some(visible));
  const authButtons = [...document.querySelectorAll('button,a')].filter(node => visible(node) && !node.closest(conversation) && !node.disabled && node.getAttribute('aria-disabled') !== 'true' && /(?:sign\s*(?:in|up)|log\s*in|continue (?:with|as)|登录|注册|继续使用|通过.*继续)/i.test(node.textContent || node.getAttribute('aria-label') || ''));
  const authHeading = [...document.querySelectorAll('h1')].find(node => visible(node) && !node.closest(conversation) && node.closest('main,[role="main"],[class*="bg-surface"]'));
  const authRoot = !shell && !hasComposer && authHeading?.closest('main,[role="main"],[class*="bg-surface"]');
  if (authRoot && authButtons.some(node => authRoot.contains(node))) {
    const busy = [...authRoot.querySelectorAll('[role="progressbar"],[aria-busy="true"],svg.animate-spin,[data-testid="app-loading"]')].some(visible);
    const r=authRoot.getBoundingClientRect();
    return { ready: !busy && !preparation, reason: preparation || (busy ? 'auth-loading' : 'auth'), authRoot, signature: JSON.stringify(['auth',document.defaultView.innerWidth,document.defaultView.innerHeight,r.x,r.y,r.width,r.height]) };
  }
  if(preparation)return {ready:false,reason:preparation};
  const surface = surfaces.find(node => [...node.querySelectorAll('[contenteditable="true"][role="textbox"],[contenteditable="true"].ProseMirror,textarea,[data-testid="composer-input"]')].some(visible)) || surfaces[0];
  if (!surface) return { ready: false, reason: 'main-surface' };
  const input = [...surface.querySelectorAll('[contenteditable="true"][role="textbox"],[contenteditable="true"].ProseMirror,textarea,[data-testid="composer-input"]')].find(node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true');
  if (!input) return { ready: false, reason: 'composer' };
  const spinner = [...surface.querySelectorAll('[data-testid="app-loading"],[data-app-loading="true"],[data-testid="startup-loading"]')].some(visible);
  const view = document.defaultView;
  const signature = JSON.stringify([view.innerWidth,view.innerHeight,...[surface,input].map(node => { const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round); })]);
  return { ready: !spinner, reason: spinner ? 'native-loading' : 'ready', signature };
}
