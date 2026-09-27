import test from 'node:test';
import assert from 'node:assert/strict';
import { collectKeys } from './i18n-keys.mjs';
import { EN } from '../public/js/i18n-en.js';
import { readFile } from 'node:fs/promises';
import { SERVER_EN } from '../worker/i18n.js';

test('i18n: every UI string has an English translation', async () => {
  const missing = (await collectKeys()).filter(k => !(k in EN));
  assert.deepEqual(missing, [], `Sem tradução inglesa:\n${missing.join('\n')}`);
});

test('i18n: English entries keep the same {placeholders} as the Portuguese key', () => {
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const wrong = Object.entries(EN).filter(([pt, en]) => vars(pt) !== vars(en)).map(([pt]) => pt);
  assert.deepEqual(wrong, []);
});

test('i18n: English entries keep the same HTML tags as the Portuguese key', () => {
  const tags = (s) => [...s.matchAll(/<\/?([a-z]+)/g)].map(m => m[1]).sort().join(',');
  const wrong = Object.entries(EN).filter(([pt, en]) => tags(pt) !== tags(en)).map(([pt]) => pt);
  assert.deepEqual(wrong, []);
});

test('i18n: every server message (Worker API and setup server) has an English translation', async () => {
  const files = ['worker/api.js', 'setup/server.mjs'];
  const keys = new Set();
  for (const f of files) {
    const src = await readFile(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\btr\(\s*[\w.]+\s*,\s*(['`])((?:\\.|(?!\1)[^\\])*)\1/g)) keys.add(m[2].replace(/\\'/g, "'"));
  }
  assert.ok(keys.size > 40, `only ${keys.size} keys found — is the extractor still matching?`);
  const missing = [...keys].filter(k => !(k in SERVER_EN));
  assert.deepEqual(missing, []);
});
