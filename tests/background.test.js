import test from 'node:test';
import assert from 'node:assert/strict';

test('menu lifecycle applies saved order, disabled entries, empty lists and current search data', async () => {
  const listeners = {};
  const event = name => ({ addListener: handler => { listeners[name] = handler; } });
  let options;
  let menus = [{ id: 'search-root' }];
  let removalError;
  let removals = 0;
  const tabs = [];
  globalThis.chrome = {
    runtime: { onInstalled: event('install'), onStartup: event('startup'), onMessage: event('message'), openOptionsPage: () => {} },
    permissions: { onRemoved: event('removed'), onAdded: event('added') },
    action: { onClicked: event('action') },
    storage: { local: { get: async () => ({ searchOptions: options }) }, onChanged: event('storage') },
    contextMenus: {
      onClicked: event('click'),
      removeAll: callback => {
        setTimeout(() => {
          removals++;
          if (!removalError) menus = [];
          chrome.runtime.lastError = removalError;
          callback();
          delete chrome.runtime.lastError;
        }, 5);
      },
      create: (properties, callback) => {
        if (menus.some(menu => menu.id === properties.id)) {
          chrome.runtime.lastError = { message: `Cannot create item with duplicate id ${properties.id}` };
          callback();
          delete chrome.runtime.lastError;
          return;
        }
        menus.push(properties); callback();
      }
    },
    tabs: { create: async tab => { tabs.push(tab); } },
    windows: { getAll: async () => [{ id: 1, incognito: false }], update: async () => {} }
  };
  const { rebuildMenus } = await import('../background.js');
  await rebuildMenus();
  assert.equal(removals, 1);
  assert.deepEqual(menus.map(menu => menu.id), ['search-root', 'search:imdb', 'search:reddit', 'search:youtube']);
  assert.ok(menus.every(menu => menu.contexts[0] === 'selection'));
  options = [
    { id: 'second', name: 'Second', url: 'https://example.com/?q=#SEARCHIT#', enabled: true },
    { id: 'disabled', name: 'Disabled', url: 'https://example.com/?q=#SEARCHIT#', enabled: false },
    { id: 'first', name: 'First', url: 'https://example.org/?q=#SEARCHIT#', enabled: true }
  ];
  await Promise.all([rebuildMenus(), rebuildMenus()]);
  assert.equal(removals, 3);
  assert.deepEqual(menus.map(menu => menu.id), ['search-root', 'search:second', 'search:first']);
  await listeners.click({ menuItemId: 'search:first', selectionText: '日本語 & tea' });
  assert.equal(new URL(tabs[0].url).searchParams.get('q'), '日本語 & tea');
  await listeners.click({ menuItemId: 'search:disabled', selectionText: 'tea' });
  assert.equal(tabs.length, 1);
  removalError = { message: 'Menu removal failed' };
  await assert.rejects(rebuildMenus(), /Menu removal failed/);
  assert.deepEqual(menus.map(menu => menu.id), ['search-root', 'search:second', 'search:first']);
  removalError = undefined;
  options = [];
  await rebuildMenus();
  assert.deepEqual(menus, []);
  await listeners.click({ menuItemId: 'search:first', selectionText: 'tea' });
  assert.equal(tabs.length, 1);
});

test('routes incognito searches into private windows and ordinary searches into regular windows', async () => {
  const { openSearch } = await import('../background.js');
  const tabs = [];
  const created = [];
  const focused = [];
  let windows = [{ id: 1, incognito: false }];
  globalThis.chrome = {
    tabs: { create: async tab => { tabs.push(tab); } },
    windows: {
      getAll: async () => windows,
      create: async window => { created.push(window); },
      update: async (id, properties) => { focused.push({ id, ...properties }); }
    }
  };
  const option = { name: 'Private', url: 'https://example.com/?q=#searchit#', incognito: true };
  await openSearch(option, '日本語 & tea', { windowId: 1, incognito: false });
  assert.equal(tabs.length, 0);
  assert.equal(created[0].incognito, true);
  assert.equal(new URL(created[0].url).searchParams.get('q'), '日本語 & tea');
  windows.push({ id: 2, incognito: true });
  await openSearch(option, 'tea', { windowId: 1, incognito: false });
  assert.equal(tabs[0].windowId, 2);
  assert.equal(created.length, 1);
  assert.equal(focused[0].id, 2);
  await openSearch({ ...option, incognito: false }, 'normal', { windowId: 2, incognito: true });
  assert.equal(tabs[1].windowId, 1);
  windows = [{ id: 2, incognito: true }];
  await openSearch({ ...option, incognito: false }, 'normal', { windowId: 2, incognito: true });
  assert.equal(created[1].incognito, false);
});

test('handles closed private windows and never falls back to regular browsing if incognito fails', async () => {
  const { openSearch } = await import('../background.js');
  const created = [];
  globalThis.chrome = {
    tabs: { create: async () => { throw new Error('Window closed'); } },
    windows: {
      getAll: async () => [{ id: 2, incognito: true }],
      create: async window => { created.push(window); },
      update: async () => {}
    }
  };
  const option = { name: 'Private', url: 'https://example.com/?q=#SEARCHIT#', incognito: true };
  await openSearch(option, 'tea');
  assert.equal(created[0].incognito, true);
  chrome.windows.getAll = async () => [];
  chrome.windows.create = async window => {
    assert.equal(window.incognito, true);
    throw new Error('Incognito disabled');
  };
  await assert.rejects(openSearch(option, 'tea'), /Incognito disabled/);
});
