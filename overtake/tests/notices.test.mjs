import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('distributed third-party notices match the repository copy', async () => {
  const root = await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  const publicCopy = await readFile(new URL('../public/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  assert.equal(publicCopy, root);
});
