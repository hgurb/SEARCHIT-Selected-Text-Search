import { validateOption, validateFaviconUrl } from './search.js';
import { limitPopupLabel } from './popup-label.js';

const PREFIX = 'SEARCHIT:v1:';

function checkOptions(options) {
  if (!Array.isArray(options)) throw new Error('The import must contain a list of search options.');
  return options.map((option, index) => {
    const error = validateOption(option);
    if (error) throw new Error(`Search option ${index + 1}: ${error}`);
    if (typeof option.enabled !== 'boolean') throw new Error(`Search option ${index + 1}: Invalid enabled state.`);
    if (option.incognito !== undefined && typeof option.incognito !== 'boolean') throw new Error(`Search option ${index + 1}: Invalid incognito state.`);
    if (option.newWindow !== undefined && typeof option.newWindow !== 'boolean') throw new Error(`Search option ${index + 1}: Invalid new window state.`);
    if (option.newWindow === true && option.incognito === true) throw new Error(`Search option ${index + 1}: New window and Incognito cannot both be selected.`);
    if (option.quickPopup !== undefined && typeof option.quickPopup !== 'boolean') throw new Error(`Search option ${index + 1}: Invalid quick popup state.`);
    if (option.popupLabel !== undefined && (typeof option.popupLabel !== 'string' || limitPopupLabel(option.popupLabel) !== option.popupLabel)) throw new Error(`Search option ${index + 1}: Popup labels must contain at most 3 characters.`);
    const faviconError = validateFaviconUrl(option.faviconUrl);
    if (faviconError) throw new Error(`Search option ${index + 1}: ${faviconError}`);
    return { ...(option.faviconUrl ? { faviconUrl: option.faviconUrl.trim() } : {}), name: option.name.trim(), url: option.url.trim(), enabled: option.enabled, incognito: option.incognito === true, newWindow: option.newWindow === true, quickPopup: option.quickPopup !== false, popupLabel: option.popupLabel ?? '' };
  });
}

export function exportOptions(options) {
  return PREFIX + JSON.stringify({ options: checkOptions(options) });
}

export function importOptions(text) {
  const value = text.trim();
  if (!value.startsWith(PREFIX)) throw new Error('Paste a complete SEARCHIT export string (version 1).');
  let data;
  try { data = JSON.parse(value.slice(PREFIX.length)); }
  catch { throw new Error('The export string is incomplete or invalid. Copy it again and retry.'); }
  return checkOptions(data?.options).map(option => ({ ...option, id: crypto.randomUUID() }));
}
