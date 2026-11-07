import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHex, hexToNumber, numberToHex, sanitizePaints } from '../src/paint.mjs';

test('normalizeHex accepts 3/6 digit hex with or without #', () => {
  assert.equal(normalizeHex('#abc'), '#aabbcc');
  assert.equal(normalizeHex('A1B2C3'), '#a1b2c3');
  assert.equal(normalizeHex(' #010203 '), '#010203');
  assert.equal(normalizeHex('nope'), null);
  assert.equal(normalizeHex(123), null);
});

test('hex/number conversion round-trips', () => {
  assert.equal(hexToNumber('#d40f1e'), 0xd40f1e);
  assert.equal(numberToHex(0x010203), '#010203');
  assert.equal(numberToHex(hexToNumber('#ff7a1a')), '#ff7a1a');
});

test('sanitizePaints keeps only known cars and valid colors', () => {
  const ids = ['golf', 'ferrari'];
  assert.deepEqual(sanitizePaints({ golf: '#abc', ferrari: 'xyz', audi: '#ffffff' }, ids), { golf: '#aabbcc' });
  assert.deepEqual(sanitizePaints(null, ids), {});
});
