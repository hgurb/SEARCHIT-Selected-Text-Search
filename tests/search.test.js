import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_OPTIONS, validateOption, buildSearchUrl } from '../search.js';

test('defaults are IMDb, Reddit, and YouTube', () => {
  assert.deepEqual(DEFAULT_OPTIONS.map(option => option.name), ['IMDb', 'Reddit', 'YouTube']);
  for (const option of DEFAULT_OPTIONS) assert.equal(validateOption(option), '');
});
test('selected text remains one query value, including Unicode and punctuation', () => {
  const text = "日本語 & coffee #tea / + 'word'";
  for (const option of DEFAULT_OPTIONS) {
    const url = new URL(buildSearchUrl(option, text));
    assert.equal([...url.searchParams.values()][0], text);
    assert.equal(url.hash, '');
    assert.equal([...url.searchParams.keys()].length, 1);
  }
});
test('replaces repeated tokens and safely encodes path searches', () => {
  const option = { name: 'Example', url: 'https://example.com/#SEARCHIT#?q=#SEARCHIT#' };
  assert.equal(buildSearchUrl(option, 'a/b'), 'https://example.com/a%2Fb?q=a%2Fb');
});

test('accepts and replaces placeholders in any combination of letter cases', () => {
  const option = { name: 'Example', url: 'https://example.com/#searchit#?q=#SearchIt#&again=#SEARCHIT#' };
  assert.equal(validateOption(option), '');
  const url = new URL(buildSearchUrl(option, '日本語 & a/b'));
  assert.equal(decodeURIComponent(url.pathname.slice(1)), '日本語 & a/b');
  assert.equal(url.searchParams.get('q'), '日本語 & a/b');
  assert.equal(url.searchParams.get('again'), '日本語 & a/b');
  assert.notEqual(validateOption({ name: 'Example', url: 'https://#searchit#.example.com/' }), '');
});
test('rejects missing placeholders, invalid URLs, unsafe schemes, credentials and dynamic hosts', () => {
  for (const url of ['https://example.com/search', 'not a url #SEARCHIT#', 'javascript:#SEARCHIT#', 'https://user:pass@example.com/?q=#SEARCHIT#', 'https://#SEARCHIT#.example.com/']) {
    assert.notEqual(validateOption({ name: 'Example', url }), '');
  }
  assert.notEqual(validateOption({ name: ' ', url: DEFAULT_OPTIONS[0].url }), '');
});
