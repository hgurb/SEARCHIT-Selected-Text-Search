import test from 'node:test';
import assert from 'node:assert/strict';
import { limitPopupLabel } from '../popup-label.js';

test('limits labels to three displayed characters including emoji and combining marks', () => {
  assert.equal(limitPopupLabel('abcd'), 'abc');
  assert.equal(limitPopupLabel('A1!extra'), 'A1!');
  assert.equal(limitPopupLabel('🇯🇵👩‍💻🎬X'), '🇯🇵👩‍💻🎬');
  assert.equal(limitPopupLabel('e\u0301ABextra'), 'e\u0301AB');
  assert.equal(limitPopupLabel(undefined), '');
});
