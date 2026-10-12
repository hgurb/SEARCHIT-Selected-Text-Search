(() => {
  if (globalThis.searchitQuickPopup) return;
  globalThis.searchitQuickPopup = true;
  let config;
  let host;
  let bar;
  let selectedText = '';
  let timer;
  let dragging = false;
  let generation = 0;
  let dismissedText = '';
  const hide = () => { if (host) { host.hidden = true; host.style.setProperty('display', 'none', 'important'); } selectedText = ''; };
  function selection() {
    const active = document.activeElement;
    if (active?.matches('input, textarea') || active?.isContentEditable) return null;
    const value = window.getSelection();
    if (!value || value.isCollapsed || !value.rangeCount || !value.toString().trim()) return null;
    const rect = value.getRangeAt(0).getBoundingClientRect();
    if ((!rect.width && !rect.height) || rect.bottom < 0 || rect.top > innerHeight) return null;
    return { text: value.toString(), rect };
  }
  function createBar() {
    host = document.createElement('searchit-quick-popup');
    host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;pointer-events:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host([hidden]) { display:none!important; }
      * { box-sizing:border-box; }
      .bar { display:grid;grid-template-columns:repeat(var(--columns,8),28px);align-items:center;gap:2px;padding:3px;border-radius:6px;background:#fff;color:#243447;border:1px solid #e3e3e3;box-shadow:0 6px 24px #0003;pointer-events:auto;width:max-content;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;font:14px system-ui,sans-serif; }
      .bar.dark { background:#211d1a;color:#eee8e2;border-color:#4b3f35; }
      button { position:relative;display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;padding:4px;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font:600 14px system-ui,sans-serif; }
      button:hover { background:#fff0e3; } .dark button:hover { background:#403329; }
      button:focus-visible { outline:2px solid #f59b54;outline-offset:-2px; }
      button:disabled { opacity:.5;cursor:wait; }
      img { display:block;width:20px;height:20px;object-fit:contain; }
      .incognito-badge { position:absolute;right:1px;top:1px;width:12px;height:12px;padding:1px;border-radius:3px;background:#fff;color:#243447;box-shadow:0 0 0 1px #0002;pointer-events:none; }
      .dark .incognito-badge { background:#211d1a;color:#eee8e2;box-shadow:0 0 0 1px #ffffff30; }
      .label-badge { position:absolute;right:1px;bottom:1px;max-width:26px;min-width:10px;padding:1px 2px;border-radius:3px;background:#fff;color:#243447;box-shadow:0 0 0 1px #0002;font:700 8px/10px system-ui,sans-serif;text-align:right;text-transform:uppercase;white-space:nowrap;overflow:hidden;pointer-events:none; }
      .dark .label-badge { background:#211d1a;color:#eee8e2;box-shadow:0 0 0 1px #ffffff30; }
      [hidden] { display:none!important; }
      .error { grid-column:1/-1;min-width:0;margin:0;padding:4px 8px;font:12px/1.4 system-ui,sans-serif;color:inherit; }
    `;
    bar = document.createElement('div');
    bar.className = 'bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'SEARCHIT quick search');
    bar.addEventListener('pointerdown', event => event.preventDefault());
    shadow.append(style, bar);
    document.documentElement.append(host);
    hide();
  }
  function render() {
    if (!host?.isConnected) createBar();
    bar.replaceChildren();
    bar.className = `bar ${config.settings.theme}`;
    for (const option of config.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = `Search on ${option.name}${option.incognito ? ' (Incognito)' : ''}`;
      button.setAttribute('aria-label', button.title);
      const img = document.createElement('img');
      img.alt = '';
      const fallback = document.createElement('span');
      fallback.textContent = option.name.trim().slice(0, 1).toUpperCase();
      fallback.hidden = true;
      img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
      img.src = option.icon;
      button.append(img, fallback);
      if (option.popupLabel?.trim()) {
        button.classList.add('has-label');
        const label = document.createElement('span');
        label.className = 'label-badge';
        label.textContent = option.popupLabel;
        label.setAttribute('aria-hidden', 'true');
        button.append(label);
        button.title += ` [${option.popupLabel}]`;
        button.setAttribute('aria-label', button.title);
      }
      if (option.incognito) {
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        badge.setAttribute('class', 'incognito-badge');
        badge.setAttribute('viewBox', '0 0 24 24');
        badge.setAttribute('aria-hidden', 'true');
        badge.setAttribute('fill', 'currentColor');
        const hat = document.createElementNS(badge.namespaceURI, 'path');
        hat.setAttribute('d', 'M7 9 8.5 3h7L17 9H7ZM3 10h18v2H3z');
        const glasses = document.createElementNS(badge.namespaceURI, 'path');
        glasses.setAttribute('d', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-12 0c2-2 4-2 6 0');
        glasses.setAttribute('fill', 'none');
        glasses.setAttribute('stroke', 'currentColor');
        glasses.setAttribute('stroke-width', '2');
        badge.append(hat, glasses);
        button.append(badge);
      }
      button.addEventListener('click', async () => {
        const text = selectedText;
        if (!text || button.disabled) return;
        button.disabled = true;
        try {
          const result = await chrome.runtime.sendMessage({ type: 'quick-search', id: option.id, text });
          if (!result?.ok) throw new Error(result?.error || 'Could not open search.');
          dismissedText = text;
          clearTimeout(timer);
          hide();
        } catch {
          let error = bar.querySelector('.error');
          if (!error) { error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert'); bar.append(error); }
          error.textContent = 'Could not open search. Check the site’s Incognito setting and try again.';
          position();
        } finally { button.disabled = false; }
      });
      bar.append(button);
    }
  }
  function position() {
    if (!config?.settings.enabled || !config.options.length) { hide(); return; }
    const value = selection();
    if (!value) { hide(); return; }
    if (value.text === dismissedText) { hide(); return; }
    dismissedText = '';
    if (!host?.isConnected) render();
    selectedText = value.text;
    host.hidden = false;
    host.style.setProperty('display', 'block', 'important');
    const requested = Number.isSafeInteger(config.settings.iconsPerRow) && config.settings.iconsPerRow >= 0 ? config.settings.iconsPerRow : 8;
    const available = Math.max(1, Math.floor((innerWidth - 24) / 30));
    bar.style.setProperty('--columns', requested === 0 ? config.options.length : Math.min(requested, config.options.length, available));
    const box = bar.getBoundingClientRect();
    const point = globalThis.searchitPosition(value.rect, box.width, box.height, config.settings.position, innerWidth, innerHeight);
    host.style.setProperty('left', `${point.x}px`, 'important');
    host.style.setProperty('top', `${point.y}px`, 'important');
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!dragging) position(); }, 120);
  }
  async function load() {
    const current = ++generation;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'quick-popup-config' });
      if (current !== generation) return;
      config = result?.settings && Array.isArray(result.options) ? result : undefined;
      hide();
      if (config?.settings.enabled && config.options.length) { render(); schedule(); }
    } catch { if (current === generation) { config = undefined; hide(); } }
  }
  document.addEventListener('pointerdown', event => {
    if (event.composedPath().includes(host)) return;
    dismissedText = '';
    dragging = true;
    hide();
  }, true);
  document.addEventListener('pointerup', () => { dragging = false; schedule(); }, true);
  document.addEventListener('pointercancel', () => { dragging = false; hide(); }, true);
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { dismissedText = selectedText; clearTimeout(timer); hide(); }
  }, true);
  document.addEventListener('scroll', () => { if (host && !host.hidden) position(); }, true);
  window.addEventListener('resize', () => { if (host && !host.hidden) position(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.quickPopup || changes.searchOptions)) load();
  });
  load();
})();
