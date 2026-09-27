import test from 'node:test';
import assert from 'node:assert/strict';
import { keyKind } from '../worker/api.js';

const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`;

test('keys: new Supabase keys are told apart by prefix', () => {
  assert.equal(keyKind('sb_publishable_abc'), 'public');
  assert.equal(keyKind('sb_secret_abc'), 'secret');
});

test('keys: legacy JWT keys are told apart by their role', () => {
  assert.equal(keyKind(jwt('anon')), 'public');
  assert.equal(keyKind(jwt('service_role')), 'secret');
  assert.equal(keyKind('eyJnot-a-jwt'), 'unknown');
  assert.equal(keyKind(''), '');
});
