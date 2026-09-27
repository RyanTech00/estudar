import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRole, isOwnerEmail } from '../public/js/roles.js';

test('roles: a row in viewers makes you a read-only viewer of that owner', () => {
  assert.deepEqual(resolveRole({ viewerOf: 'owner-uuid', me: { owner: false, ownerConfigured: true } }), { role: 'viewer', ownerId: 'owner-uuid' });
});

test('roles: the configured owner gets the full app', () => {
  assert.equal(resolveRole({ me: { owner: true, ownerConfigured: true } }).role, 'owner');
});

test('roles: with an owner set, any other account has no access', () => {
  assert.equal(resolveRole({ me: { owner: false, ownerConfigured: true } }).role, 'none');
});

test('roles: installs without an owner keep the old behaviour (each account owns its data)', () => {
  assert.equal(resolveRole({ me: { owner: true, ownerConfigured: false } }).role, 'owner');
  assert.equal(resolveRole({ me: null }).role, 'owner');
});

test('roles: owner check ignores case and spaces, and is open when no owner is set', () => {
  assert.equal(isOwnerEmail('Owner@Example.com ', 'owner@example.com'), true);
  assert.equal(isOwnerEmail('owner@example.com', 'someone@example.com'), false);
  assert.equal(isOwnerEmail('owner@example.com', ''), false);
  assert.equal(isOwnerEmail('', 'anyone@example.com'), true);
});
