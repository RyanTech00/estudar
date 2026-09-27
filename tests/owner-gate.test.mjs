import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.js';

// Supabase is faked: a Bearer token "t:<email>" is a session for that email; anything else is invalid.
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/v1/user')) {
      const auth = opts.headers?.Authorization || '';
      return auth.startsWith('Bearer t:')
        ? new Response(JSON.stringify({ id: 'uid-' + auth.slice(9), email: auth.slice(9) }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    if (u.includes('/auth/v1/settings')) return new Response(JSON.stringify({ disable_signup: true }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const ENV = {
  RUNTIME: 'cloudflare',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_x',
  AI_API_KEY: 'k',
  OWNER_EMAIL: 'Owner@Example.com',
};
const call = (path, { token, method = 'GET', body, env = ENV } = {}) => handleApi(new Request(`https://app.test${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}), env);

test('owner gate: /api/health on the published app answers only the owner', async () => {
  assert.equal((await call('/api/health')).status, 403);
  assert.equal((await call('/api/health', { token: 't:viewer@example.com' })).status, 403);
  assert.equal((await call('/api/health', { token: 't:owner@example.com' })).status, 200);
});

test('owner gate: the local server (npx estudar) keeps /api/health open', async () => {
  assert.equal((await call('/api/health', { env: { ...ENV, RUNTIME: 'local' } })).status, 200);
});

test('owner gate: only the owner can use the AI', async () => {
  const plan = { token: 't:viewer@example.com', method: 'POST', body: { subjects: [{ id: 'a', name: 'A' }], startDate: '2026-09-28' } };
  const r = await call('/api/generate-plan', plan);
  assert.ok(r.status === 403 || r.status === 400, `expected 403 (or 400 if the fake input is rejected first), got ${r.status}`);
  const img = await call('/api/import-curriculum', { token: 't:viewer@example.com', method: 'POST', body: { image: 'data:image/png;base64,AAAA' } });
  assert.equal(img.status, 403);
});

test('owner gate: /api/me tells the owner apart and needs a session', async () => {
  assert.equal((await call('/api/me')).status, 401);
  assert.deepEqual(await (await call('/api/me', { token: 't:owner@example.com' })).json(), { owner: true, ownerConfigured: true });
  assert.deepEqual(await (await call('/api/me', { token: 't:viewer@example.com' })).json(), { owner: false, ownerConfigured: true });
});

test('owner gate: installs without an owner: any signed-in user is owner, but /api/health is never public', async () => {
  const env = { ...ENV, OWNER_EMAIL: '' };
  assert.equal((await call('/api/health', { env })).status, 403);
  assert.equal((await call('/api/health', { env, token: 't:anyone@example.com' })).status, 200);
  assert.deepEqual(await (await call('/api/me', { token: 't:anyone@example.com', env })).json(), { owner: true, ownerConfigured: false });
});

test('config never hands a secret key to the browser', async () => {
  const c = await (await call('/api/config', { env: { ...ENV, SUPABASE_ANON_KEY: 'sb_secret_oops' } })).json();
  assert.equal(c.supabaseAnonKey, '');
  assert.equal(c.configured, false);
});

// ── AI route hardening ──
const INPUT = { startDate: '2026-09-28', examDate: '2026-12-20', hoursPerDay: [2, 3, 3, 3, 3, 3, 4], subjects: [{ id: 'fp', name: 'FP', short: 'FP' }] };

function fakeProviders({ rpc = () => new Response('1', { status: 200 }), model } = {}) {
  const base = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/ai_usage_take')) return rpc(JSON.parse(opts.body));
    if (u.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(model) }] } }] }), { status: 200 });
    }
    return base(url, opts);
  };
}
const AI_ENV = { ...ENV, SUPABASE_SERVICE_KEY: 'sb_secret_x', AI_PROVIDER: 'gemini' };

test('owner gate: with OWNER_ID set, the email alone is not enough', async () => {
  const env = { ...AI_ENV, OWNER_ID: 'uid-someone-else' };
  assert.deepEqual(await (await call('/api/me', { token: 't:owner@example.com', env })).json(), { owner: false, ownerConfigured: true });
  assert.equal((await call('/api/generate-plan', { token: 't:owner@example.com', method: 'POST', body: INPUT, env })).status, 403);
});

test('AI limit: taken atomically before the model; a full day answers 429, a missing function 503', async () => {
  fakeProviders({ rpc: () => new Response('null', { status: 200 }) });
  assert.equal((await call('/api/generate-plan', { token: 't:owner@example.com', method: 'POST', body: INPUT, env: AI_ENV })).status, 429);
  fakeProviders({ rpc: () => new Response('{}', { status: 404 }) });
  assert.equal((await call('/api/generate-plan', { token: 't:owner@example.com', method: 'POST', body: INPUT, env: AI_ENV })).status, 503);
});

test('AI routes: oversized bodies are refused before anything else', async () => {
  const r = await handleApi(new Request('https://app.test/api/generate-plan', {
    method: 'POST', headers: { 'Content-Length': String(20 * 1024 * 1024), 'Content-Type': 'application/json' }, body: '{}',
  }), AI_ENV);
  assert.equal(r.status, 413);
});

test('AI output is cleaned: unknown subjects, bad days, huge strings and extra fields never reach the client', async () => {
  fakeProviders({ model: {
    weeklyPlan: [
      { day: 1, subject: 'fp', session: 'x'.repeat(5000), minutes: 99999, focus: '<img src=x onerror=alert(1)>', extra: 'drop me' },
      { day: 9, subject: 'fp', session: 'bad day', minutes: 30, focus: '' },
      { day: 2, subject: 'not-a-subject', session: 's', minutes: 30, focus: '' },
      null, 'text',
    ],
    phases: [{ name: 'Learn', label: 'L', start: '2026-09-28', end: '2026-10-30', ratio: 'r' }, { name: 'bad', label: 'b', start: 'yesterday', end: 'x', ratio: '' }],
    tips: Array.from({ length: 50 }, () => ({ title: 't', text: 'x' })),
    injected: { anything: true },
  } });
  const r = await call('/api/generate-plan', { token: 't:owner@example.com', method: 'POST', body: INPUT, env: AI_ENV });
  assert.equal(r.status, 200);
  const { plan, remaining } = await r.json();
  assert.equal(remaining, 9);
  assert.deepEqual(Object.keys(plan).sort(), ['phases', 'tips', 'weeklyPlan']);
  assert.equal(plan.weeklyPlan.length, 1);
  assert.equal(plan.weeklyPlan[0].session.length, 120);
  assert.equal(plan.weeklyPlan[0].minutes, 960);
  assert.equal('extra' in plan.weeklyPlan[0], false);
  assert.equal(plan.phases.length, 1);
  assert.ok(plan.tips.length <= 8);
});

test('errors never leak internals to the client', async () => {
  const r = await call('/api/generate-plan', { token: 't:owner@example.com', method: 'POST', body: { ...INPUT, subjects: [null, 'x'] }, env: AI_ENV });
  const { error } = await r.json();
  assert.equal(r.status, 400);
  assert.doesNotMatch(error, /Cannot read|TypeError|undefined/);
});

test('health: a table locked to signed-out visitors (42501) counts as created; a missing one does not', async () => {
  const base = globalThis.fetch;
  const run = async (states) => {
    globalThis.fetch = async (url, opts) => {
      const m = String(url).match(/\/rest\/v1\/(\w+)\?/);
      if (m && states[m[1]]) {
        const code = states[m[1]];
        return new Response(JSON.stringify({ code }), { status: code === 'PGRST205' ? 404 : 401 });
      }
      return base(url, opts);
    };
    const r = await call('/api/health', { token: 't:owner@example.com', env: { ...ENV, RUNTIME: 'local' } });
    return (await r.json()).database;
  };
  assert.equal((await run({ user_data: '42501', viewers: '42501' })).ok, true);
  assert.equal((await run({ user_data: 'PGRST205', viewers: 'PGRST205' })).ok, false);
  const outdated = await run({ user_data: '42501', viewers: 'PGRST205' });
  assert.equal(outdated.ok, false);
  assert.match(outdated.message, /Configurar/);
});
