import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { DEFAULT_POPUP, normalizePopup } from '../popup-settings.js';

test('popup defaults are opt-in and invalid settings normalize safely', () => {
  assert.deepEqual(normalizePopup(), DEFAULT_POPUP);
  assert.deepEqual(normalizePopup({ enabled: 'true', theme: 'invalid', position: 'invalid' }), DEFAULT_POPUP);
  assert.deepEqual(normalizePopup({ enabled: true, theme: 'light', position: 'top-center' }), { enabled: true, theme: 'light', position: 'top-center', iconsPerRow: 8 });
  assert.equal(normalizePopup({ iconsPerRow: 3 }).iconsPerRow, 3);
  assert.equal(normalizePopup({ iconsPerRow: 0 }).iconsPerRow, 0);
  for (const iconsPerRow of [-1, 2.5, '4', null, Infinity]) assert.equal(normalizePopup({ iconsPerRow }).iconsPerRow, 8);
});
test('all eight popup positions follow the selection and stay within the viewport', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../popup-position.js', import.meta.url), 'utf8'), context);
  const place = context.searchitPosition;
  const rect = { left: 200, right: 400, top: 200, bottom: 240 };
  const expected = { 'bottom-right': [300, 248], 'bottom-left': [200, 248], 'bottom-center': [250, 248], right: [408, 200], left: [92, 200], 'top-right': [300, 152], 'top-left': [200, 152], 'top-center': [250, 152], 'top-left-corner': [100, 158], 'top-right-corner': [400, 158], 'bottom-left-corner': [100, 242], 'bottom-right-corner': [400, 242] };
  for (const [position, [x, y]] of Object.entries(expected)) {
    const actual = place(rect, 100, 40, position, 800, 600);
    assert.equal(actual.x, x); assert.equal(actual.y, y);
    const edge = place({ left: 0, right: 800, top: 0, bottom: 600 }, 100, 40, position, 800, 600);
    assert.ok(edge.x >= 8 && edge.x <= 692 && edge.y >= 8 && edge.y <= 552);
  }
});

test('popup registration requires permission and popup messages use current saved flags', async () => {
  const listeners = {};
  const event = name => ({ addListener: handler => { listeners[name] = handler; } });
  let allowed = true;
  let settings = { enabled: true, theme: 'dark', position: 'left' };
  let options = [{ id: 'one', name: 'One', url: 'https://example.com/?q=#SEARCHIT#', enabled: true, quickPopup: true }, { id: 'two', name: 'Two', url: 'https://example.org/?q=#SEARCHIT#', enabled: true, quickPopup: false }];
  let scripts = [];
  let tabs = [];
  globalThis.chrome = {
    runtime: { id: 'test', getURL: path => `chrome-extension://test${path}`, onInstalled: event('install'), onStartup: event('start'), onMessage: event('message') },
    permissions: { contains: async () => allowed, onRemoved: event('removed'), onAdded: event('added') },
    action: { onClicked: event('action') },
    contextMenus: { onClicked: event('menu') },
    storage: { local: { get: async key => key === 'quickPopup' ? { quickPopup: settings } : { searchOptions: options }, set: async value => { settings = value.quickPopup; } }, onChanged: event('storage') },
    scripting: { getRegisteredContentScripts: async () => scripts, registerContentScripts: async value => { scripts = value; }, unregisterContentScripts: async () => { scripts = []; }, executeScript: async () => {} },
    tabs: { query: async () => [{ id: 3 }], create: async tab => tabs.push(tab) }
  };
  const { syncPopup } = await import('../background.js');
  await syncPopup(); assert.equal(scripts.length, 1);
  const sender = { id: 'test', url: 'https://source.example/', tab: { id: 3, windowId: 2, incognito: false } };
  const message = value => new Promise(resolve => listeners.message(value, sender, resolve));
  const config = await message({ type: 'quick-popup-config' });
  assert.deepEqual(config.options.map(option => option.id), ['one']);
  assert.equal((await message({ type: 'quick-search', id: 'two', text: 'tea' })).ok, false);
  assert.equal((await message({ type: 'quick-search', id: 'one', text: '日本語 & tea' })).ok, true);
  assert.equal(new URL(tabs[0].url).searchParams.get('q'), '日本語 & tea');
  options[0].enabled = false;
  assert.equal((await message({ type: 'quick-search', id: 'one', text: 'tea' })).ok, false);
  allowed = false;
  await syncPopup(); assert.equal(scripts.length, 0); assert.equal(settings.enabled, false);
  assert.equal(tabs.length, 1);
  assert.equal(listeners.message({ type: 'quick-search' }, { ...sender, id: 'other' }, () => {}), undefined);
});

test('failed popup configuration stays hidden when selection events fire', async () => {
  for (const response of [{ ok: false, error: 'Could not load settings.' }, undefined]) {
    const listeners = {};
    const timers = [];
    const context = vm.createContext({
      chrome: {
        runtime: { sendMessage: async () => response },
        storage: { onChanged: { addListener() {} } }
      },
      document: {
        addEventListener: (name, handler) => { listeners[name] = handler; },
        createElement: () => { throw new Error('Failed config must not create a popup'); }
      },
      window: { addEventListener() {} },
      setTimeout: handler => { timers.push(handler); return timers.length; },
      clearTimeout() {}
    });
    vm.runInContext(readFileSync(new URL('../popup.js', import.meta.url), 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    listeners.selectionchange();
    assert.doesNotThrow(() => timers.pop()());
  }
});
