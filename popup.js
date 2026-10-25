(() => {
  if (globalThis.searchitQuickPopup) return;
  globalThis.searchitQuickPopup = true;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let config;
  let host;
  let bar;
  let sites;
  let selectedText = '';
  let timer;
  let dragging = false;
  let generation = 0;
  let dismissedText = '';
  let expanded = false;
  let renderedExpanded = false;
  let selectionRange;
  const hide = () => { if (host) { host.hidden = true; host.style.setProperty('display', 'none', 'important'); } selectedText = ''; expanded = false; selectionRange = undefined; };
  function selection() {
    const active = document.activeElement;
    if (active?.matches('input, textarea') || active?.isContentEditable) return null;
    const value = window.getSelection();
    if (!value || value.isCollapsed || !value.rangeCount || !value.toString().trim()) return null;
    const range = value.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if ((!rect.width && !rect.height) || rect.bottom < 0 || rect.top > innerHeight) return null;
    return { text: value.toString(), rect, range: [range.startContainer, range.startOffset, range.endContainer, range.endOffset] };
  }
  function createBar() {
    host = document.createElement('searchit-quick-popup');
    host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;pointer-events:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host([hidden]) { display:none!important; }
      * { box-sizing:border-box; }
      .bar { color-scheme:light;display:flex;align-items:center;gap:4px;padding:3px;border-radius:6px;background:#fff;color:#243447;border:1px solid #e3e3e3;box-shadow:0 6px 24px #0003;pointer-events:auto;width:max-content;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;font:14px system-ui,sans-serif; }
      .sites { display:grid;grid-template-columns:repeat(var(--columns,8),28px);align-items:center;gap:2px;flex:none; }
      .sites:empty { display:none; }
      .bar.dark { color-scheme:dark;background:#211d1a;color:#eee8e2;border-color:#4b3f35; }
      button { position:relative;display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;padding:4px;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font:600 14px system-ui,sans-serif; }
      button:hover { background:#fff0e3; } .dark button:hover { background:#403329; }
      .extra-start { --divider-tone:#aab5c3;--divider-highlight:#8393a83d;--divider-direction:to bottom; }
      .dark .extra-start { --divider-tone:#a18e7e;--divider-highlight:#c3a68b4d; }
      .extra-start::before { content:"";position:absolute;left:-2px;top:3px;bottom:3px;width:1px;background:linear-gradient(var(--divider-direction),transparent,var(--divider-tone) 35%,var(--divider-tone) 65%,transparent);filter:drop-shadow(0 0 2px var(--divider-highlight));pointer-events:none; }
      .extra-start.separator-row-start::before { --divider-direction:to right;left:0;top:-2px;bottom:auto;width:calc(var(--columns)*30px - 2px);height:1px; }
      :is(.show-more,.open-settings) { width:18px;height:26px;flex:0 0 18px;border-radius:3px;padding:0;border:1px solid transparent;background:#f4f6fa;color:#475569; }
      :is(.show-more,.open-settings)::before { content:"";position:absolute;inset:-1px -3px; }
      :is(.show-more,.open-settings) svg { display:block;width:12px;height:12px;pointer-events:none; }
      :is(.show-more,.open-settings):hover { border-color:#bc4c0b;background:#fff0e3;color:#ad470b; }
      .dark :is(.show-more,.open-settings) { border-color:transparent;background:#302822;color:#eee8e2; }
      .dark :is(.show-more,.open-settings):hover { border-color:#f59b54;background:#403329;color:#ffb477; }
      .show-more, .dark .show-more { background:transparent; }
      .sites:not(:empty) + .show-more::after { content:"";position:absolute;left:-3px;top:1px;bottom:1px;width:1px;background:linear-gradient(to bottom,transparent,#aab5c380 20%,#aab5c380 80%,transparent);pointer-events:none; }
      .dark .sites:not(:empty) + .show-more::after { background:linear-gradient(to bottom,transparent,#a18e7e80 20%,#a18e7e80 80%,transparent); }
      .open-settings { width:28px;height:28px;place-self:center end;background:transparent; }
      .open-settings::before { inset:3px -1px 3px 7px;border:1px solid transparent;border-radius:4px;background:transparent;pointer-events:none; }
      .open-settings svg { justify-self:end;margin-right:3px;position:relative;z-index:1; }
      .dark .open-settings { background:transparent; }
      .open-settings:hover, .dark .open-settings:hover { background:transparent;border-color:transparent; }
      .open-settings:hover::before { background:#fff0e3;border-color:#bc4c0b; }
      .dark .open-settings:hover::before { background:#403329;border-color:#f59b54; }
      button:focus-visible { outline:2px solid #f59b54;outline-offset:-2px; }
      button:disabled { opacity:.5;cursor:wait; }
      img { display:block;width:20px;height:20px;object-fit:contain; }
      .incognito-badge { position:absolute;right:1px;top:1px;width:12px;height:12px;padding:1px;border-radius:3px;background:#fff;color:#243447;box-shadow:0 0 0 1px #0002;pointer-events:none; }
      .new-window-badge { position:absolute;right:1px;top:1px;width:12px;height:12px;padding:1px;border-radius:2px;background:#fff;color:#243447;box-shadow:0 0 0 1px #0002;pointer-events:none; }
      .dark .new-window-badge { background:#211d1a;color:#eee8e2;box-shadow:0 0 0 1px #ffffff30; }
      .dark .incognito-badge { background:#211d1a;color:#eee8e2;box-shadow:0 0 0 1px #ffffff30; }
      .label-badge { position:absolute;right:1px;bottom:1px;max-width:26px;min-width:10px;padding:1px 2px;border-radius:3px;background:#fff;color:#243447;box-shadow:0 0 0 1px #0002;font:700 8px/10px system-ui,sans-serif;text-align:right;text-transform:uppercase;white-space:nowrap;overflow:hidden;pointer-events:none; }
      .dark .label-badge { background:#211d1a;color:#eee8e2;box-shadow:0 0 0 1px #ffffff30; }
      [hidden] { display:none!important; }
      .error { grid-column:1/-1;min-width:0;margin:0;padding:4px 8px;font:12px/1.4 system-ui,sans-serif;color:inherit; }
    `;
    bar = document.createElement('div');
    bar.className = 'bar';
    sites = document.createElement('div');
    sites.className = 'sites';
    bar.append(sites);
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'SEARCHIT quick search');
    bar.addEventListener('pointerdown', event => event.preventDefault());
    shadow.append(style, bar);
    document.documentElement.append(host);
    hide();
  }
  function applyTheme() {
    if (!bar || !config) return;
    const theme = config.settings.theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : config.settings.theme;
    bar.className = 'bar ' + theme;
  }
  systemTheme.addEventListener('change', () => { if (config?.settings.theme === 'system') applyTheme(); });
  function initialOptions() { return config.options.filter(option => option.quickPopup !== false); }
  function moreOptions() { return config.settings.showMore ? config.options.filter(option => option.quickPopup === false) : []; }
  function render() {
    if (!host?.isConnected) createBar();
    sites.replaceChildren();
    bar.querySelector('.show-more')?.remove();
    applyTheme();
    renderedExpanded = expanded;
    const initial = initialOptions();
    const remaining = moreOptions();
    for (const option of expanded ? [...initial, ...remaining] : initial) {
      const button = document.createElement('button');
      button.type = 'button';
      if (expanded && initial.length && option === remaining[0]) button.classList.add('extra-start');
      button.title = `Search on ${option.name}${option.incognito ? ' (Incognito)' : option.newWindow ? ' (New window)' : ''}`;
      button.setAttribute('aria-label', button.title);
      const img = document.createElement('img');
      img.alt = '';
      const fallback = document.createElement('span');
      fallback.textContent = option.name.trim().slice(0, 1).toUpperCase();
      fallback.hidden = true;
      img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
      if (typeof option.icon === 'string' && option.icon.startsWith('data:image/png;base64,')) img.src = option.icon;
      else { img.hidden = true; fallback.hidden = false; }
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
      } else if (option.newWindow) {
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        badge.setAttribute('class', 'new-window-badge');
        badge.setAttribute('viewBox', '0 0 24 24');
        badge.setAttribute('aria-hidden', 'true');
        const arrow = document.createElementNS(badge.namespaceURI, 'path');
        arrow.setAttribute('d', 'M4 20 20 4M7 4h13v13');
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('stroke', 'currentColor');
        arrow.setAttribute('stroke-width', '3');
        arrow.setAttribute('stroke-linecap', 'round');
        arrow.setAttribute('stroke-linejoin', 'round');
        badge.append(arrow);
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
          if (!error) { error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert'); sites.append(error); }
          error.textContent = 'Could not open search. Check the site’s window setting and try again.';
          position();
        } finally { button.disabled = false; }
      });
      sites.append(button);
    }
    if (!expanded && remaining.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'show-more';
      const chevrons = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevrons.setAttribute('viewBox', '0 0 16 16');
      chevrons.setAttribute('aria-hidden', 'true');
      const lines = document.createElementNS(chevrons.namespaceURI, 'path');
      lines.setAttribute('d', 'm3 4 4 4-4 4m6-8 4 4-4 4');
      lines.setAttribute('fill', 'none');
      lines.setAttribute('stroke', 'currentColor');
      lines.setAttribute('stroke-width', '1.8');
      lines.setAttribute('stroke-linecap', 'round');
      chevrons.append(lines);
      more.append(chevrons);
      more.title = 'Show all search options';
      more.setAttribute('aria-label', more.title);
      more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', event => {
        if (!selectedText) return;
        expanded = true;
        render();
        position();
        if (event.detail === 0) bar.querySelectorAll('button')[initial.length]?.focus({ preventScroll: true });
      });
      bar.append(more);
    }
    if (expanded) {
      const settingsButton = document.createElement('button');
      settingsButton.type = 'button';
      settingsButton.className = 'open-settings';
      settingsButton.title = 'Open settings';
      settingsButton.setAttribute('aria-label', settingsButton.title);
      const cog = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cog.setAttribute('viewBox', '2 2 20 20');
      cog.setAttribute('aria-hidden', 'true');
      cog.setAttribute('fill', 'currentColor');
      const shape = document.createElementNS(cog.namespaceURI, 'path');
      const points = [];
      for (let tooth = 0; tooth < 6; tooth++) {
        for (const [offset, radius] of [[-.4, 7.8], [-.17, 10], [.17, 10], [.4, 7.8]]) {
          const angle = tooth * Math.PI / 3 - Math.PI / 2 + offset;
          points.push((12 + Math.cos(angle) * radius).toFixed(2) + ',' + (12 + Math.sin(angle) * radius).toFixed(2));
        }
      }
      shape.setAttribute('d', 'M' + points.join('L') + 'Z M15.2 12a3.2 3.2 0 1 0-6.4 0a3.2 3.2 0 1 0 6.4 0Z');
      shape.setAttribute('fill-rule', 'evenodd');
      cog.append(shape);
      settingsButton.append(cog);
      settingsButton.addEventListener('click', async () => {
        if (settingsButton.disabled) return;
        settingsButton.disabled = true;
        const text = selectedText;
        try {
          const result = await chrome.runtime.sendMessage({ type: 'quick-popup-settings' });
          if (!result?.ok) throw new Error('Settings unavailable.');
          dismissedText = text;
          clearTimeout(timer);
          hide();
        } catch {
          let error = bar.querySelector('.error');
          if (!error) { error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert'); sites.append(error); }
          error.textContent = 'Could not open settings. Try again.';
          position();
        } finally { settingsButton.disabled = false; }
      });
      sites.append(settingsButton);
    }
  }
  function position() {
    if (!config?.settings.enabled || !config.options.length) { hide(); return; }
    const value = selection();
    if (!value) { hide(); return; }
    if (value.text === dismissedText) { hide(); return; }
    dismissedText = '';
    if (selectionRange && (selectedText !== value.text || !selectionRange.every((part, index) => part === value.range[index]))) expanded = false;
    if (!host?.isConnected || renderedExpanded !== expanded) render();
    selectionRange = value.range;
    selectedText = value.text;
    host.hidden = false;
    host.style.setProperty('display', 'block', 'important');
    const requested = Number.isSafeInteger(config.settings.iconsPerRow) && config.settings.iconsPerRow >= 0 ? config.settings.iconsPerRow : 8;
    const more = bar.querySelector('.show-more');
    const available = Math.max(1, Math.floor((innerWidth - 24 - (more ? 22 : 0)) / 30));
    const buttons = [...sites.querySelectorAll('button')];
    if (!buttons.length && !more) { hide(); return; }
    const rows = globalThis.searchitRows(buttons.length, requested, available);
    bar.style.setProperty('--columns', rows[0] ?? 1);
    let index = 0;
    rows.forEach((count, row) => {
      for (let column = 0; column < count; column++) {
        const button = buttons[index++];
        button.style.gridRow = row + 1;
        button.style.gridColumn = column + 1;
        button.classList.toggle('separator-row-start', column === 0 && button.classList.contains('extra-start'));
      }
    });
    const settingsButton = sites.querySelector('.open-settings');
    if (settingsButton) settingsButton.style.gridColumn = rows[0] ?? 1;
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
