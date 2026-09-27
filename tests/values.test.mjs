import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeValues } from '../setup/values.mjs';

const STORED = {
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_KEY: 'sb_secret_x',
  AI_PROVIDER: 'gemini',
  AI_API_KEY: 'AIza-real-key',
  OWNER_EMAIL: 'me@example.com',
  OWNER_ID: 'uid-1',
};
// What the setup form sends on Save: every field, secrets masked, the hidden base URL empty.
const FORM = { ...STORED, SUPABASE_SERVICE_KEY: '••••_x', AI_API_KEY: '••••-key', AI_BASE_URL: '', AI_MODEL: '', MAX_PLANS_PER_DAY: '' };

test('setup values: saving the form unchanged keeps every stored key', () => {
  const next = mergeValues(STORED, FORM);
  assert.equal(next.AI_API_KEY, 'AIza-real-key');
  assert.equal(next.SUPABASE_SERVICE_KEY, 'sb_secret_x');
  assert.equal(next.OWNER_ID, 'uid-1');
});

test('setup values: pointing a key at a new endpoint drops it unless a new key comes with it', () => {
  assert.equal(mergeValues(STORED, { ...FORM, AI_PROVIDER: 'openai', AI_BASE_URL: 'https://evil.example/v1' }).AI_API_KEY, undefined);
  assert.equal(mergeValues(STORED, { ...FORM, AI_PROVIDER: 'openai', AI_BASE_URL: 'https://openrouter.ai/api/v1', AI_API_KEY: 'sk-new' }).AI_API_KEY, 'sk-new');
  const moved = mergeValues(STORED, { ...FORM, SUPABASE_URL: 'https://other.supabase.co' });
  assert.equal(moved.SUPABASE_SERVICE_KEY, undefined);
  assert.equal(moved.OWNER_ID, undefined);        // ids belong to one project
  assert.equal(moved.OWNER_EMAIL, 'me@example.com');
});

test('setup values: only https endpoints (plus a local AI on localhost)', () => {
  assert.throws(() => mergeValues(STORED, { AI_BASE_URL: 'http://evil.example' }));
  assert.throws(() => mergeValues(STORED, { SUPABASE_URL: 'http://abc.supabase.co' }));
  assert.throws(() => mergeValues(STORED, { SUPABASE_URL: 'javascript:alert(1)' }));
  assert.doesNotThrow(() => mergeValues(STORED, { AI_BASE_URL: 'http://localhost:11434' }));
  assert.doesNotThrow(() => mergeValues(STORED, { AI_BASE_URL: 'http://127.0.0.1:11434/v1' }));
  assert.doesNotThrow(() => mergeValues(STORED, { SUPABASE_URL: 'https://db.my-domain.pt' }));
});

test('setup values: keys in the wrong field and line breaks are refused', () => {
  assert.throws(() => mergeValues(STORED, { SUPABASE_ANON_KEY: 'sb_secret_oops' }));
  assert.throws(() => mergeValues(STORED, { SUPABASE_SERVICE_KEY: 'sb_publishable_oops' }));
  assert.throws(() => mergeValues(STORED, { AI_MODEL: 'x\nSUPABASE_URL="https://evil"' }));
});
