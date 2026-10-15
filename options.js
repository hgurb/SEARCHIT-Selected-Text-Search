import { readOptions, validateOption, validateFaviconUrl, faviconPageUrl, TOKEN, DEFAULT_OPTIONS, DEFAULT_SEARCH_SETTINGS, readSearchSettings } from './search.js';
import { exportOptions, importOptions } from './transfer.js';
import { limitPopupLabel } from './popup-label.js';
import { DEFAULT_POPUP, POPUP_ORIGINS, readPopup } from './popup-settings.js';

document.querySelector('.changelog-link').addEventListener('click', event => {
  event.preventDefault();
  const changelog = document.querySelector('#changelog');
  changelog.open = true;
  changelog.querySelector('summary').focus({ preventScroll: true });
  changelog.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

const list = document.querySelector('#options');
const status = document.querySelector('#status-top');
const toolbar = document.querySelector('.settings-toolbar');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--settings-toolbar-height', toolbar.getBoundingClientRect().height + 'px');
}).observe(toolbar);
const saveButtons = [document.querySelector('#save-top')];
const importSave = document.querySelector('#import-save');
let importReady = false;
let saving = false;
function setImportReady(ready) {
  importReady = ready;
  importSave.disabled = saving || !ready;
}
function disableSave(disabled) {
  saving = disabled;
  saveButtons.forEach(button => { button.disabled = disabled; });
  importSave.disabled = disabled || !importReady;
}

let saved = [];
let dirty = false;
let savedPopup = { ...DEFAULT_POPUP };
let savedSearchSettings = { ...DEFAULT_SEARCH_SETTINGS };
const windowBehavior = document.querySelector('#window-behavior');
windowBehavior.addEventListener('change', () => { updateWindowSummary(); markDirty(); });
function updateWindowSummary() {
  document.querySelector('#window-current').textContent = windowBehavior.querySelector('input:checked')?.closest('label').textContent.trim() ?? 'Always open a new window';
}
function renderWindowBehavior(value) {
  for (const radio of windowBehavior.querySelectorAll('input[type="radio"]')) radio.checked = radio.value === value;
  updateWindowSummary();
}
function collectWindowBehavior() {
  return windowBehavior.querySelector('input:checked')?.value ?? DEFAULT_SEARCH_SETTINGS.windowBehavior;
}
let popupEnabled = false;
const popupButton = document.querySelector('#popup-enabled');
const popupTheme = document.querySelector('#popup-theme');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let popupThemePreference = DEFAULT_POPUP.theme;
function renderPopupTheme() {
  popupTheme.value = popupThemePreference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : popupThemePreference;
}
systemTheme.addEventListener('change', () => { if (popupThemePreference === 'system') renderPopupTheme(); });
const popupPosition = document.querySelector('#popup-position');
const popupColumns = document.querySelector('#popup-columns');
const popupStatus = document.querySelector('#popup-status');
function renderPopup(settings) {
  popupEnabled = settings.enabled;
  popupButton.setAttribute('aria-checked', String(popupEnabled));
  popupButton.textContent = `Quick popup: ${popupEnabled ? 'On' : 'Off'}`;
  popupThemePreference = settings.theme;
  renderPopupTheme();
  popupPosition.value = settings.position;
  popupColumns.value = settings.iconsPerRow ?? 8;
  document.querySelector('#popup-current').textContent = popupEnabled ? 'On' : 'Off';
}
function collectPopup() { return { enabled: popupEnabled, theme: popupThemePreference, position: popupPosition.value, iconsPerRow: Number(popupColumns.value) }; }
popupButton.addEventListener('click', async () => {
  popupButton.disabled = true;
  try {
    if (!popupEnabled) {
      const granted = await chrome.permissions.request({ origins: POPUP_ORIGINS });
      if (!granted) { popupStatus.textContent = 'Website access was not granted. The right-click menu still works.'; return; }
    }
    renderPopup({ ...collectPopup(), enabled: !popupEnabled });
    popupStatus.textContent = 'Save changes to apply this choice.';
    markDirty();
  } catch { popupStatus.textContent = 'Could not change website access. Try again.'; }
  finally { popupButton.disabled = false; }
});
popupTheme.addEventListener('change', () => { popupThemePreference = popupTheme.value; markDirty(); });
popupPosition.addEventListener('change', markDirty);
popupColumns.addEventListener('input', markDirty);
chrome.permissions.onRemoved.addListener(async () => {
  if (!await chrome.permissions.contains({ origins: POPUP_ORIGINS })) {
    renderPopup({ ...collectPopup(), enabled: false });
    savedPopup.enabled = false;
    popupStatus.textContent = 'Website access was removed. Enable the quick popup to grant it again.';
  }
});

function markDirty() { dirty = true; status.textContent = 'Unsaved changes'; }
function updateCount() {
  const rows = [...list.children];
  document.querySelector('#count').textContent = `${rows.length} sites`;
  document.querySelector('#empty').hidden = rows.length > 0;
  rows.forEach((row, index) => {
    row.querySelector('.up').disabled = index === 0;
    row.querySelector('.down').disabled = index === rows.length - 1;
  });
}

function updateIcon(row) {
  const image = row.querySelector('.site-icon img');
  const fallback = row.querySelector('.site-icon span');
  try {
    const faviconUrl = row.querySelector('.custom-favicon').checked ? row.querySelector('.favicon-url').value.trim() : '';
    if (row.querySelector('.custom-favicon').checked && (!faviconUrl || validateFaviconUrl(faviconUrl))) throw new Error();
    const pageUrl = faviconPageUrl({ url: row.querySelector('.url').value, faviconUrl });
    const site = new URL(pageUrl);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error();
    const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
    favicon.searchParams.set('pageUrl', pageUrl);
    favicon.searchParams.set('size', '32');
    image.src = favicon.href;
    image.hidden = false;
    fallback.hidden = true;
  } catch { image.removeAttribute('src'); image.hidden = true; fallback.hidden = false; }
}

function addRow(option) {
  const row = document.querySelector('#option-template').content.firstElementChild.cloneNode(true);
  row.dataset.id = option.id;
  row.querySelector('.name').value = option.name;
  row.querySelector('.url').value = option.url;
  const urlInput = row.querySelector('.url');
  urlInput.id = `url-${option.id}`;
  row.querySelector('.url-label').htmlFor = urlInput.id;
  const customFavicon = row.querySelector('.custom-favicon');
  const faviconInput = row.querySelector('.favicon-url');
  const faviconField = row.querySelector('.favicon-field');
  faviconInput.id = `favicon-${option.id}`;
  faviconField.id = `favicon-field-${option.id}`;
  row.querySelector('.favicon-url-label').htmlFor = faviconInput.id;
  customFavicon.setAttribute('aria-controls', faviconField.id);
  row.querySelector('.favicon-help').id = `${faviconInput.id}-help`;
  row.querySelector('.favicon-error').id = `${faviconInput.id}-error`;
  faviconInput.setAttribute('aria-describedby', `${faviconInput.id}-help ${faviconInput.id}-error`);
  faviconInput.value = typeof option.faviconUrl === 'string' ? option.faviconUrl : '';
  customFavicon.checked = Boolean(faviconInput.value);
  faviconField.hidden = !customFavicon.checked;
  faviconInput.disabled = !customFavicon.checked;
  faviconInput.required = customFavicon.checked;
  customFavicon.addEventListener('change', () => {
    faviconField.hidden = !customFavicon.checked;
    faviconInput.disabled = !customFavicon.checked;
    faviconInput.required = customFavicon.checked;
    row.querySelector('.favicon-error').hidden = true;
    faviconInput.removeAttribute('aria-invalid');
    updateIcon(row);
    markDirty();
  });
  faviconInput.addEventListener('input', () => {
    row.querySelector('.favicon-error').hidden = true;
    faviconInput.removeAttribute('aria-invalid');
    updateIcon(row);
  });
  const nameInput = row.querySelector('.name');
  row.querySelector('.link-error').id = `${urlInput.id}-error`;
  urlInput.setAttribute('aria-describedby', `${urlInput.id}-error`);
  row.querySelector('.name-error').id = `name-${option.id}-error`;
  nameInput.setAttribute('aria-describedby', `name-${option.id}-error`);
  const replaceButton = row.querySelector('.replace-selection');
  // Keep the input selection visible when the button is pressed with a mouse or touch.
  replaceButton.addEventListener('pointerdown', event => event.preventDefault());
  replaceButton.addEventListener('click', () => {
    const start = urlInput.selectionStart;
    const end = urlInput.selectionEnd;
    urlInput.focus();
    urlInput.setRangeText(TOKEN, start, end, start === end ? 'end' : 'select');
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    updateIcon(row);
  });
  row.querySelector('.enabled').checked = option.enabled !== false;
  const incognito = row.querySelector('.incognito');
  const newWindow = row.querySelector('.new-window');
  incognito.checked = option.incognito === true;
  newWindow.checked = option.newWindow === true && !incognito.checked;
  incognito.addEventListener('change', () => { if (incognito.checked) newWindow.checked = false; });
  newWindow.addEventListener('change', () => { if (newWindow.checked) incognito.checked = false; });
  row.querySelector('.quick-popup').checked = option.quickPopup !== false;
  const popupLabel = row.querySelector('.popup-label');
  popupLabel.value = limitPopupLabel(option.popupLabel);
  const limitLabel = () => { popupLabel.value = limitPopupLabel(popupLabel.value); };
  popupLabel.addEventListener('input', event => { if (!event.isComposing) limitLabel(); });
  popupLabel.addEventListener('compositionend', limitLabel);
  row.querySelector('.site-icon img').addEventListener('error', () => {
    row.querySelector('.site-icon img').hidden = true;
    row.querySelector('.site-icon span').hidden = false;
  });
  row.addEventListener('input', event => {
    markDirty();
    if (event.target === urlInput || event.target === nameInput) {
      row.querySelector(event.target === urlInput ? '.link-error' : '.name-error').hidden = true;
      event.target.removeAttribute('aria-invalid');
    }
  });
  row.querySelector('.url').addEventListener('change', () => updateIcon(row));
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); markDirty(); updateCount(); });
  row.querySelector('.up').addEventListener('click', () => {
    if (row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    markDirty(); updateCount(); row.querySelector('.name').focus();
  });
  row.querySelector('.down').addEventListener('click', () => {
    if (row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    markDirty(); updateCount(); row.querySelector('.name').focus();
  });
  list.append(row);
  updateIcon(row);
  updateCount();
  return row;
}

function render(options) { list.replaceChildren(); options.forEach(addRow); updateCount(); }
document.querySelectorAll('#add, #add-bottom').forEach(button => button.addEventListener('click', () => {
  const row = addRow({ id: crypto.randomUUID(), name: '', url: '', enabled: true });
  markDirty(); row.querySelector('.name').focus();
}));
document.querySelector('#discard-top').addEventListener('click', () => { render(saved); renderPopup(savedPopup); renderWindowBehavior(savedSearchSettings.windowBehavior); popupStatus.textContent = ''; setImportReady(false); importNotice.hidden = true; transferStatus.textContent = ''; dirty = false; status.textContent = 'Changes discarded'; });
document.querySelector('#reset-top').addEventListener('click', () => {
  render(DEFAULT_OPTIONS.map(option => ({ ...option })));
  renderPopup(DEFAULT_POPUP);
  renderWindowBehavior(DEFAULT_SEARCH_SETTINGS.windowBehavior);
  popupStatus.textContent = '';
  markDirty();
  setImportReady(false);
  importNotice.hidden = true;
  transferStatus.textContent = '';
  status.textContent = 'Defaults restored in the editor. Save to apply, or discard to undo.';
});
function collectOptions() {
  const options = [];
  let firstInvalid;
  for (const row of list.children) {
    const option = { id: row.dataset.id, name: row.querySelector('.name').value.trim(), url: row.querySelector('.url').value.trim(), enabled: row.querySelector('.enabled').checked, incognito: row.querySelector('.incognito').checked, newWindow: row.querySelector('.new-window').checked, quickPopup: row.querySelector('.quick-popup').checked, popupLabel: limitPopupLabel(row.querySelector('.popup-label').value) };
    const customFavicon = row.querySelector('.custom-favicon').checked;
    if (customFavicon) option.faviconUrl = row.querySelector('.favicon-url').value.trim();
    const faviconError = customFavicon ? (!option.faviconUrl ? 'Enter a favicon website.' : validateFaviconUrl(option.faviconUrl)) : '';
    const nameError = !option.name ? 'Enter a site name.' : option.name.length > 80 ? 'Keep the site name under 81 characters.' : '';
    const linkError = validateOption({ ...option, name: 'Site' });
    for (const [field, error] of [['name', nameError], ['link', linkError], ['favicon', faviconError]]) {
      const message = row.querySelector(`.${field}-error`);
      const input = row.querySelector(field === 'name' ? '.name' : field === 'favicon' ? '.favicon-url' : '.url');
      message.textContent = error;
      message.hidden = !error;
      input.setAttribute('aria-invalid', String(Boolean(error)));
      if (error && !firstInvalid) firstInvalid = input;
    }
    options.push(option);
  }
  if (firstInvalid) {
    firstInvalid.focus();
    throw new Error('Check the highlighted search options.');
  }
  return options;
}

document.querySelector('#settings').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || (event.submitter === importSave && !importReady)) return;
  if (!popupColumns.checkValidity() || !Number.isSafeInteger(Number(popupColumns.value))) {
    document.querySelector('.popup-settings').open = true;
    status.textContent = 'Icons per row must be a whole number of at least 0.';
    popupColumns.focus();
    popupColumns.reportValidity();
    return;
  }
  let options;
  try { options = collectOptions(); }
  catch (error) { status.textContent = error.message; return; }
  disableSave(true);
  try {
    const quickPopup = collectPopup();
    if (quickPopup.enabled && !await chrome.permissions.contains({ origins: POPUP_ORIGINS })) throw new Error('Website access is required. Enable the quick popup again.');
    const searchSettings = { windowBehavior: collectWindowBehavior() };
    await chrome.storage.local.set({ searchOptions: options, quickPopup, searchSettings });
    savedSearchSettings = structuredClone(searchSettings);
    savedPopup = structuredClone(quickPopup);
    saved = structuredClone(options); dirty = false;
    popupStatus.textContent = '';
    setImportReady(false);
    if (!importNotice.hidden) transferStatus.textContent = 'Imported options saved.';
    importNotice.hidden = true;
    status.textContent = 'Saved. Your searches are ready.';
  } catch { status.textContent = 'Could not save. Your changes are still here; try again.'; }
  finally { disableSave(false); }
});

const transferText = document.querySelector('#transfer-text');
const transferStatus = document.querySelector('#transfer-status');
const importNotice = document.querySelector('#import-notice');
transferText.addEventListener('input', () => setImportReady(false));
document.querySelector('#export').addEventListener('click', async () => {
  try { transferText.value = exportOptions(collectOptions()); setImportReady(false); }
  catch (error) { transferStatus.textContent = error.message; return; }
  try {
    await navigator.clipboard.writeText(transferText.value);
    transferStatus.textContent = 'Export generated and copied to the clipboard.';
  } catch {
    transferText.focus(); transferText.select();
    transferStatus.textContent = 'Export generated. Clipboard access failed; copy the selected string manually.';
  }
});
document.querySelector('#import').addEventListener('click', () => {
  setImportReady(false);
  let options;
  try { options = importOptions(transferText.value); }
  catch (error) { transferStatus.textContent = error.message; return; }
  render(options);
  markDirty();
  setImportReady(true);
  importNotice.hidden = false;
  transferStatus.textContent = `Loaded ${options.length} search options for review.`;
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try { [saved, savedPopup, savedSearchSettings] = await Promise.all([readOptions(), readPopup(), readSearchSettings()]); render(saved); renderPopup(savedPopup); renderWindowBehavior(savedSearchSettings.windowBehavior); }
catch { status.textContent = 'Could not load settings. Reload this page to try again.'; disableSave(true); }
