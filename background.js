import { readOptions, validateOption, buildSearchUrl, faviconPageUrl, readSearchSettings } from './search.js';
import { limitPopupLabel } from './popup-label.js';
import { readPopup, POPUP_ORIGINS } from './popup-settings.js';

const POPUP_SCRIPT = 'searchit-quick-popup';
// Cache only image data, not selected text. Chrome also maintains its own favicon cache.
const popupIcons = new Map();
async function popupIcon(option) {
  const icon = new URL(chrome.runtime.getURL('/_favicon/'));
  icon.searchParams.set('pageUrl', faviconPageUrl(option));
  icon.searchParams.set('size', '32');
  const key = icon.href;
  if (!popupIcons.has(key)) {
    if (popupIcons.size >= 128) popupIcons.delete(popupIcons.keys().next().value);
    const pending = (async () => {
      const response = await fetch(key);
      if (!response.ok) throw new Error('Favicon unavailable.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      // The favicon service returns PNG images; reject unexpected or oversized responses.
      if (bytes.length > 65536 || bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw new Error('Invalid favicon.');
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return 'data:image/png;base64,' + btoa(binary);
    })();
    popupIcons.set(key, pending);
  }
  const pending = popupIcons.get(key);
  try { return await pending; }
  catch {
    if (popupIcons.get(key) === pending) popupIcons.delete(key);
    return '';
  }
}
let popupQueue = Promise.resolve();
export function syncPopup() {
  popupQueue = popupQueue.catch(() => {}).then(async () => {
    const settings = await readPopup();
    const allowed = await chrome.permissions.contains({ origins: POPUP_ORIGINS });
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [POPUP_SCRIPT] });
    if (!settings.enabled || !allowed) {
      if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [POPUP_SCRIPT] });
      if (settings.enabled && !allowed) await chrome.storage.local.set({ quickPopup: { ...settings, enabled: false } });
      return;
    }
    if (!scripts.length) {
      await chrome.scripting.registerContentScripts([{ id: POPUP_SCRIPT, matches: POPUP_ORIGINS, js: ['popup-position.js', 'popup.js'], runAt: 'document_idle', allFrames: false }]);
      // Also activate on already-open ordinary webpages. Restricted pages are skipped.
      const tabs = await chrome.tabs.query({ url: POPUP_ORIGINS });
      await Promise.allSettled(tabs.map(tab => chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['popup-position.js', 'popup.js'] })));
    }
  });
  return popupQueue;
}
const refreshPopup = () => syncPopup().catch(error => console.error('Could not update quick popup:', error));

chrome.permissions.onRemoved.addListener(refreshPopup);
chrome.permissions.onAdded.addListener(refreshPopup);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['quick-popup-config', 'quick-search'].includes(message?.type)) return;
  if (sender.id !== chrome.runtime.id || !sender.tab || !/^https?:\/\//i.test(sender.url ?? '')) return;
  (async () => {
    const settings = await readPopup();
    const allowed = settings.enabled && await chrome.permissions.contains({ origins: POPUP_ORIGINS });
    const options = (await readOptions()).filter(option => option.enabled !== false && option.quickPopup !== false && !validateOption(option));
    if (message.type === 'quick-popup-config') {
      respond({ settings: { ...settings, enabled: Boolean(allowed) }, options: await Promise.all(options.map(async option => {
        const icon = allowed ? await popupIcon(option) : '';
        return { id: option.id, name: option.name, incognito: option.incognito === true, newWindow: option.newWindow === true && option.incognito !== true, popupLabel: limitPopupLabel(option.popupLabel), icon };
      })) });
    } else {
      const option = options.find(item => item.id === message.id);
      if (!allowed || !option || typeof message.text !== 'string' || !message.text.trim()) throw new Error('Search unavailable.');
      await openSearch(option, message.text, sender.tab);
      respond({ ok: true });
    }
  })().catch(() => respond({ ok: false, error: 'Could not open search.' }));
  return true;
});

function createMenu(properties) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(properties, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function removeMenus() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

let menuQueue = Promise.resolve();
export function rebuildMenus() {
  menuQueue = menuQueue.catch(() => {}).then(async () => {
    const options = await readOptions();
    await removeMenus();
    const enabled = options.filter(option => option.enabled !== false && !validateOption(option));
    if (!enabled.length) return;
    await createMenu({ id: 'search-root', title: 'Search selected text', contexts: ['selection'] });
    for (const option of enabled) {
      await createMenu({ id: `search:${option.id}`, parentId: 'search-root', title: `${option.name.replaceAll('%', '％')}${option.incognito === true ? ' (Incognito)' : option.newWindow === true ? ' (New window)' : ''}`, contexts: ['selection'] });
    }
  });
  return menuQueue;
}

const refresh = () => rebuildMenus().catch(error => console.error('Could not update search menu:', error));

// Only in-flight work lives here; window associations survive worker suspension in session storage.
const searchWindowQueues = new Map();
const searchWindowKey = tabId => `searchit-window-${tabId}`;
const sourceWindowKey = windowId => `searchit-source-window-${windowId}`;

async function searchLinkWindowKey(template) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(template.trim()));
  return 'searchit-link-window-' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function reuseSearchWindow(url, key, sourceTab, sourceWindowId) {
  const previous = searchWindowQueues.get(key) ?? Promise.resolve();
  const pending = (async () => {
    await previous.catch(() => {});
    const stored = await chrome.storage.session.get(key);
    const windowId = stored[key];
    let target;
    if (Number.isInteger(windowId)) {
      try { target = await chrome.windows.get(windowId); }
      catch { /* A closed search window will be replaced below. */ }
    }
    if (target?.incognito === false && target.type === 'normal' && target.id !== sourceWindowId) {
      let opened = false;
      try {
        await chrome.tabs.create({ url, windowId, active: true });
        opened = true;
      } catch { /* The window may have closed after it was checked. */ }
      if (opened) {
        // Focusing must not create a second copy if the search tab already opened.
        await chrome.windows.update(windowId, { focused: true }).catch(() => {});
        return;
      }
    }
    const created = await chrome.windows.create({ url, incognito: false, type: 'normal', focused: true });
    if (Number.isInteger(created?.id)) {
      await chrome.storage.session.set({ [key]: created.id });
      if (sourceWindowId !== undefined) {
        try { await chrome.windows.get(sourceWindowId); }
        catch { await chrome.storage.session.remove(key); }
      } else if (sourceTab) {
        // Source-tab associations end when that tab closes; link associations are independent.
        try { await chrome.tabs.get(sourceTab.id); }
        catch { await chrome.storage.session.remove(key); }
      }
    }
  })();
  searchWindowQueues.set(key, pending);
  try { await pending; }
  finally { if (searchWindowQueues.get(key) === pending) searchWindowQueues.delete(key); }
}

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(searchWindowKey(tabId)).catch(error => console.error('Could not clear search window:', error));
});

chrome.windows.onRemoved.addListener(windowId => {
  chrome.storage.session.remove(sourceWindowKey(windowId)).catch(error => console.error('Could not clear source window:', error));
});

export async function openSearch(option, text, sourceTab) {
  const url = buildSearchUrl(option, text);
  const incognito = option.incognito === true;
  if (option.newWindow === true && !incognito) {
    const settings = await readSearchSettings();
    if (settings.windowBehavior === 'shared-window' && Number.isInteger(sourceTab?.windowId) && sourceTab.windowId >= 0) {
      await reuseSearchWindow(url, sourceWindowKey(sourceTab.windowId), undefined, sourceTab.windowId);
      return;
    }
    if (settings.windowBehavior === 'search-link') {
      await reuseSearchWindow(url, await searchLinkWindowKey(option.url));
      return;
    }
    if (settings.windowBehavior === 'source-tab' && Number.isInteger(sourceTab?.id) && sourceTab.id >= 0) {
      await reuseSearchWindow(url, searchWindowKey(sourceTab.id), sourceTab);
      return;
    }
    await chrome.windows.create({ url, incognito: false, type: 'normal', focused: true });
    return;
  }
  // A regular source window is already known to be usable for regular searches.
  if (!incognito && sourceTab?.incognito === false) {
    await chrome.tabs.create({ url, windowId: sourceTab.windowId });
    return;
  }
  let target;
  try {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    target = windows.find(window => window.incognito === incognito && window.id === sourceTab?.windowId)
      ?? windows.find(window => window.incognito === incognito);
  } catch { /* If enumeration is unavailable, create a window explicitly. */ }
  if (target) {
    try { await chrome.tabs.create({ url, windowId: target.id }); }
    catch {
      // The target may have closed between enumeration and opening the tab.
      await chrome.windows.create({ url, incognito, focused: true });
      return;
    }
    // A focus failure must not cause a duplicate search tab.
    await chrome.windows.update(target.id, { focused: true }).catch(() => {});
    return;
  }
  await chrome.windows.create({ url, incognito, focused: true });
}

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.runtime.onInstalled.addListener(refreshPopup);
chrome.runtime.onStartup.addListener(refreshPopup);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.searchOptions) refresh();
  if (area === 'local' && changes.quickPopup) refreshPopup();
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!String(info.menuItemId).startsWith('search:') || !info.selectionText) return;
  try {
    const options = await readOptions();
    const option = options.find(item => `search:${item.id}` === info.menuItemId && item.enabled !== false);
    if (option) await openSearch(option, info.selectionText, tab);
  } catch (error) { console.error('Could not open search:', error); }
});
