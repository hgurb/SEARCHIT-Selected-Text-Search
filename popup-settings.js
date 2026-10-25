export const POPUP_POSITIONS = ['bottom-right', 'bottom-left', 'bottom-center', 'right', 'left', 'top-right', 'top-left', 'top-center', 'top-left-corner', 'top-right-corner', 'bottom-left-corner', 'bottom-right-corner'];
export const DEFAULT_POPUP = { enabled: false, theme: 'system', position: 'bottom-right', iconsPerRow: 8, showMore: true };
export const POPUP_ORIGINS = ['http://*/*', 'https://*/*'];
export function normalizePopup(value) {
  return {
    enabled: value?.enabled === true,
    showMore: value?.showMore !== false,
    theme: ['light', 'dark'].includes(value?.theme) ? value.theme : 'system',
    position: POPUP_POSITIONS.includes(value?.position) ? value.position : DEFAULT_POPUP.position,
    iconsPerRow: Number.isSafeInteger(value?.iconsPerRow) && value.iconsPerRow >= 0 ? value.iconsPerRow : DEFAULT_POPUP.iconsPerRow
  };
}
export async function readPopup() {
  const stored = await chrome.storage.local.get('quickPopup');
  return normalizePopup(stored.quickPopup);
}
