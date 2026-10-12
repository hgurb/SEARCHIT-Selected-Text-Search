import test from 'node:test';
import assert from 'node:assert/strict';
import { exportOptions, importOptions } from '../transfer.js';

test('exports and imports Unicode names, URLs, order and enabled states with fresh unique IDs', () => {
  const options = [
    { id: 'original', name: '日本語 🎬', url: 'https://example.com/?q=#searchit#', enabled: false, incognito: true, quickPopup: false, popupLabel: 'JP🎬' },
    { id: 'original-2', name: 'Video', url: 'https://example.org/#SearchIt#', enabled: true, incognito: false, quickPopup: true, popupLabel: '' }
  ];
  const value = exportOptions(options);
  const imported = importOptions(` \n${value}\n `);
  assert.deepEqual(imported.map(({ id, ...option }) => option), options.map(({ id, ...option }) => option));
  assert.ok(imported.every(option => option.id && !options.some(original => original.id === option.id)));
  assert.notEqual(imported[0].id, imported[1].id);
});
test('empty option lists can be transferred', () => {
  assert.deepEqual(importOptions(exportOptions([])), []);
});

test('older exports import with incognito disabled and invalid incognito values are rejected', () => {
  const value = 'SEARCHIT:v1:{"options":[{"name":"Old","url":"https://example.com/?q=#searchit#","enabled":true}]}';
  assert.equal(importOptions(value)[0].incognito, false);
  assert.equal(importOptions(value)[0].quickPopup, true);
  assert.equal(importOptions(value)[0].popupLabel, '');
  assert.throws(() => importOptions(value.replace('"enabled":true', '"enabled":true,"popupLabel":"abcd"')));
  assert.throws(() => importOptions(value.replace('"enabled":true', '"enabled":true,"popupLabel":42')));
  assert.throws(() => importOptions(value.replace('"enabled":true', '"enabled":true,"quickPopup":"false"')));
  assert.throws(() => importOptions(value.replace('"enabled":true', '"enabled":true,"incognito":"false"')));
});
test('rejects broken strings, unknown formats and invalid options before import', () => {
  for (const value of [
    '', 'SEARCHIT:v2:{}', 'SEARCHIT:v1:{', 'SEARCHIT:v1:null',
    'SEARCHIT:v1:{"options":{}}',
    'SEARCHIT:v1:{"options":[{"name":"Bad","url":"javascript:#searchit#","enabled":true}]}',
    'SEARCHIT:v1:{"options":[{"name":"Bad","url":"https://example.org/#searchit#","enabled":"false"}]}',
    'SEARCHIT:v1:{"options":[{"name":"Bad","url":"https://example.org/","enabled":true}]}'
  ]) assert.throws(() => importOptions(value));
});
