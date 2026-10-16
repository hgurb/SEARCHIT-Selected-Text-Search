import { validateOption, validateFaviconUrl } from './search.js';
import { limitPopupLabel } from './popup-label.js';
import { POPUP_POSITIONS } from './popup-settings.js';

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

const SECTION_NAMES = ['quickPopup', 'newTabBehavior', 'newWindowBehavior', 'searchOptions'];
function checkSections(sections) {
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) throw new Error('The export must contain settings sections.');
  const names = Object.keys(sections);
  if (!names.length) throw new Error('Select at least one section to export.');
  if (names.some(name => !SECTION_NAMES.includes(name))) throw new Error('This export contains an unsupported settings section. Update SEARCHIT before importing it.');
  const result = {};
  if (Object.hasOwn(sections, 'quickPopup')) {
    const value = sections.quickPopup;
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.enabled !== 'boolean' || !['system', 'dark', 'light'].includes(value.theme) || !POPUP_POSITIONS.includes(value.position) || !Number.isSafeInteger(value.iconsPerRow) || value.iconsPerRow < 0) throw new Error('Invalid Quick popup settings.');
    result.quickPopup = { enabled: value.enabled, theme: value.theme, position: value.position, iconsPerRow: value.iconsPerRow };
  }
  if (Object.hasOwn(sections, 'newTabBehavior')) {
    if (!['end', 'start', 'left', 'right'].includes(sections.newTabBehavior)) throw new Error('Invalid New tab behavior.');
    result.newTabBehavior = sections.newTabBehavior;
  }
  if (Object.hasOwn(sections, 'newWindowBehavior')) {
    if (!['always-new', 'source-tab', 'search-link', 'shared-window'].includes(sections.newWindowBehavior)) throw new Error('Invalid New window behavior.');
    result.newWindowBehavior = sections.newWindowBehavior;
  }
  if (Object.hasOwn(sections, 'searchOptions')) result.searchOptions = checkOptions(sections.searchOptions);
  return result;
}

export function exportSettings(sections) {
  const checked = checkSections(sections);
  // Website-only exports retain the original format, including compatibility with older releases.
  if (Object.keys(checked).length === 1 && Object.hasOwn(checked, 'searchOptions')) return exportOptions(checked.searchOptions);
  return 'SEARCHIT:v2:' + JSON.stringify({ sections: checked });
}

export function importSettings(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (value.startsWith(PREFIX)) return { searchOptions: importOptions(value) };
  if (!value.startsWith('SEARCHIT:v2:')) throw new Error('Unsupported or incomplete SEARCHIT export. Use an export from a supported version.');
  let data;
  try { data = JSON.parse(value.slice('SEARCHIT:v2:'.length)); }
  catch { throw new Error('The export string is incomplete or invalid. Copy it again and retry.'); }
  const sections = checkSections(data?.sections);
  if (sections.searchOptions) sections.searchOptions = sections.searchOptions.map(option => ({ ...option, id: crypto.randomUUID() }));
  return sections;
}
