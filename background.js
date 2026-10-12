import { readOptions, validateOption, buildSearchUrl } from './search.js';
import { limitPopupLabel } from './popup-label.js';
import { readPopup, POPUP_ORIGINS } from './popup-settings.js';

const POPUP_SCRIPT = 'searchit-quick-popup';
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
      respond({ settings: { ...settings, enabled: Boolean(allowed) }, options: options.map(option => {
        const icon = new URL(chrome.runtime.getURL('/_favicon/'));
        icon.searchParams.set('pageUrl', new URL(option.url.replace(/#searchit#/gi, 'example')).origin);
        icon.searchParams.set('size', '32');
        return { id: option.id, name: option.name, incognito: option.incognito === true, popupLabel: limitPopupLabel(option.popupLabel), icon: icon.href };
      }) });
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
      await createMenu({ id: `search:${option.id}`, parentId: 'search-root', title: `${option.name.replaceAll('%', '％')}${option.incognito === true ? ' (Incognito)' : ''}`, contexts: ['selection'] });
    }
  });
  return menuQueue;
}

const refresh = () => rebuildMenus().catch(error => console.error('Could not update search menu:', error));

export async function openSearch(option, text, sourceTab) {
  const url = buildSearchUrl(option, text);
  const incognito = option.incognito === true;
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
