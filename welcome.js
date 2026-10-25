import { readPopup, POPUP_ORIGINS } from './popup-settings.js';

const enable = document.querySelector('#enable-popup');
const skip = document.querySelector('#skip-welcome');
const status = document.querySelector('#welcome-status');
let enabled = false;
const openSettings = () => location.assign(chrome.runtime.getURL('options.html'));
skip.addEventListener('click', openSettings);
enable.addEventListener('click', async () => {
  if (enabled) { openSettings(); return; }
  enable.disabled = true;
  skip.disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: POPUP_ORIGINS });
    if (!granted) {
      status.textContent = 'Website access wasn’t granted. You can try again or enable the popup later in Settings.';
      return;
    }
    const current = await readPopup();
    await chrome.storage.local.set({ quickPopup: { ...current, enabled: true } });
    enabled = true;
    enable.textContent = 'Open settings';
    skip.hidden = true;
    status.textContent = 'Quick popup is on. Select text on a webpage to try it.';
  } catch {
    status.textContent = 'Could not enable the quick popup. Your settings are unchanged; try again.';
  } finally { enable.disabled = false; skip.disabled = false; }
});
try {
  const current = await readPopup();
  if (current.enabled && await chrome.permissions.contains({ origins: POPUP_ORIGINS })) {
    enabled = true;
    enable.textContent = 'Open settings';
    skip.hidden = true;
    status.textContent = 'Quick popup is already on.';
  }
  enable.disabled = false;
} catch { status.textContent = 'Could not load your preferences. Open Settings to try again.'; }
