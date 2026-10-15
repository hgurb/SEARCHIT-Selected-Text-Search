export const TOKEN = '#SEARCHIT#';
export const DEFAULT_SEARCH_SETTINGS = { windowBehavior: 'always-new', tabPlacement: 'end' };
export async function readSearchSettings() {
  const { searchSettings } = await chrome.storage.local.get('searchSettings');
  const behavior = searchSettings?.windowBehavior;
  return { windowBehavior: ['always-new', 'source-tab', 'search-link', 'shared-window'].includes(behavior)
    ? behavior : behavior === undefined && searchSettings?.reuseSearchWindows === true ? 'source-tab' : 'always-new',
    tabPlacement: ['end', 'right', 'left', 'start'].includes(searchSettings?.tabPlacement) ? searchSettings.tabPlacement : 'end' };
}
export const DEFAULT_OPTIONS = [
  { id: 'imdb', name: 'IMDb', url: 'https://www.imdb.com/find/?q=#SEARCHIT#', enabled: true, incognito: false },
  { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/search/?q=#SEARCHIT#', enabled: true, incognito: false },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=#SEARCHIT#', enabled: true, incognito: false }
];

export function validateOption(option) {
  if (!option || typeof option.name !== 'string' || !option.name.trim()) return 'Enter a site name.';
  if (option.name.trim().length > 80) return 'Keep the site name under 81 characters.';
  if (typeof option.url !== 'string' || !/#searchit#/i.test(option.url)) return `The search link must include ${TOKEN}.`;
  try {
    const url = new URL(option.url.replace(/#searchit#/gi, 'example'));
    if (!['https:', 'http:'].includes(url.protocol)) return 'Use an https:// or http:// search link.';
    if (url.username || url.password) return 'Search links cannot contain login credentials.';
    if (new URL(option.url.replace(/#searchit#/gi, 'different')).origin !== url.origin) return 'Place #SEARCHIT# in the path or query, not the website address.';
  } catch { return 'Enter a complete, valid search link.'; }
  return '';
}

// Favicon sources are independent of search destinations.
export function validateFaviconUrl(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') return 'Enter a complete https:// or http:// favicon website URL.';
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch { return 'Enter a complete https:// or http:// favicon website URL without login credentials.'; }
  return '';
}

export function faviconPageUrl(option) {
  if (option.faviconUrl && !validateFaviconUrl(option.faviconUrl)) return new URL(option.faviconUrl.trim()).href;
  return new URL(option.url.replace(/#searchit#/gi, 'example')).origin;
}

export function buildSearchUrl(option, text) {
  const error = validateOption(option);
  if (error) throw new Error(error);
  // Also escape apostrophes and other punctuation left untouched by encodeURIComponent.
  const query = encodeURIComponent(text).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return option.url.trim().replace(/#searchit#/gi, () => query);
}

export async function readOptions() {
  const stored = await chrome.storage.local.get('searchOptions');
  return stored.searchOptions ?? DEFAULT_OPTIONS.map(option => ({ ...option }));
}
