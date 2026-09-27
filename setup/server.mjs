#!/usr/bin/env node
// Local server: `npx estudar` (or `npm start` in a clone of the repository)
// - serves the app from public/ and the same /api routes the Cloudflare Worker has
// - adds /api/setup/* so the in-app "Servidor" screen can save keys, create the
//   Supabase tables and publish to Cloudflare. These routes only exist here, never on the Worker.
import http from 'node:http';
import { readFile, readdir, writeFile, stat, mkdir, mkdtemp, rm, chmod } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn, exec } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, health, readEnv, keyKind } from '../worker/api.js';
import { tr, langFrom } from '../worker/i18n.js';
import { normalizeEmail } from '../public/js/roles.js';
import { securityHeaders } from '../worker/security.js';
import { FIELDS, mergeValues } from './values.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const PUBLIC = path.join(ROOT, 'public');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

// Every migration, in order. They are idempotent, so Configurar can run them again to update an install.
async function migrationSql() {
  const files = (await readdir(MIGRATIONS)).filter(f => f.endsWith('.sql')).sort();
  const parts = await Promise.all(files.map(f => readFile(path.join(MIGRATIONS, f), 'utf8')));
  // One transaction: a failure halfway leaves the database as it was.
  return `begin;\n${parts.map((sql, i) => `-- ${files[i]}\n${sql.trim()}\n`).join('\n')}commit;\n`;
}

// In a clone of the repository, keys and deploy state live next to the code (both are in .gitignore).
// Installed from npm, the code folder may be read-only or replaced on update, so they live in ~/.estudar.
const IS_CHECKOUT = existsSync(path.join(ROOT, '.git'));
const DATA = process.env.ESTUDAR_HOME ? path.resolve(process.env.ESTUDAR_HOME) : IS_CHECKOUT ? ROOT : path.join(homedir(), '.estudar');
const DEV_VARS = path.join(DATA, '.dev.vars');
const DEPLOY_FILE = path.join(DATA, '.deploy.json');

const argv = process.argv.slice(2);
const argValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--version') || argv.includes('-v')) { console.log(PKG.version); process.exit(0); }
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
  estudar ${PKG.version} — ${PKG.homepage}

  Usage: npx estudar [options]

  Starts the app and the setup screen at http://localhost:8787.
  Arranca a app e o ecrã de configuração em http://localhost:8787.

  Options:
    --port <n>     port to use (default 8787, or $PORT)
    --no-open      don't open the browser
    -v, --version  print the version
    -h, --help     show this help

  Keys and deploy state are stored in: ${DATA}
  (set ESTUDAR_HOME to use another folder)
`);
  process.exit(0);
}
let PORT = Number(argValue('--port') || process.env.PORT || 8787);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) { console.error(`Invalid port: ${argValue('--port') || process.env.PORT}`); process.exit(1); }

// Per-launch secret for the setup routes. It goes to the browser in the URL fragment (#setup=…), which is
// never sent over the network, and back in a header. Without it, another program or a web page can't use
// /api/setup/* — the Host/Origin checks stop remote sites, this stops everything else.
const SETUP_TOKEN = randomBytes(24).toString('base64url');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};


// ── .dev.vars ────────────────────────────────────────────────
async function readVars() {
  if (!existsSync(DEV_VARS)) return {};
  const out = {};
  for (const line of (await readFile(DEV_VARS, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    out[m[1]] = v;
  }
  return out;
}

async function writeVars(vars) {
  const lines = ['# Written by the Estudar setup screen. Keep this file private: it holds your keys.'];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined || v === '') continue;
    lines.push(`${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  }
  await mkdir(DATA, { recursive: true, mode: 0o700 });
  await writeFile(DEV_VARS, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  await chmod(DEV_VARS, 0o600).catch(() => {});  // `mode` only applies when the file is created
}

const mask = (v) => (v ? `••••${v.slice(-4)}` : '');

async function publicState() {
  const vars = await readVars();
  const values = {};
  const secretsSet = {};
  for (const [k, meta] of Object.entries(FIELDS)) {
    if (meta.secret) { values[k] = mask(vars[k]); secretsSet[k] = !!vars[k]; }
    else values[k] = vars[k] || '';
  }
  return { values, secretsSet, deploy: await readDeploy(), localUrl: `http://localhost:${PORT}`, hasAccessToken: !!sessionAccessToken };
}


async function readDeploy() {
  try { return JSON.parse(await readFile(DEPLOY_FILE, 'utf8')); } catch { return null; }
}

// ── Wrangler ─────────────────────────────────────────────────
// Wrangler is a dependency; run its CLI with this same Node, with no shell and no npx lookup.
function wranglerBin() {
  try {
    const require = createRequire(import.meta.url);
    return path.join(path.dirname(require.resolve('wrangler/package.json')), 'bin', 'wrangler.js');
  } catch { return null; }
}

// In a clone, wrangler.jsonc is used as is. Installed from npm, a copy with absolute paths is written
// to DATA, so Wrangler's own cache (.wrangler/) goes there and not into the package folder.
async function wranglerConfig() {
  const src = path.join(ROOT, 'wrangler.jsonc');
  if (DATA === ROOT) return src;
  const cfg = JSON.parse((await readFile(src, 'utf8')).replace(/^\s*\/\/.*$/gm, ''));
  delete cfg.$schema;
  cfg.main = path.join(ROOT, cfg.main);
  cfg.assets.directory = path.join(ROOT, cfg.assets.directory);
  const out = path.join(DATA, 'wrangler.json');
  await mkdir(DATA, { recursive: true, mode: 0o700 });
  await writeFile(out, JSON.stringify(cfg, null, 2));
  return out;
}

async function wranglerWithConfig(args, opts) {
  return wrangler([...args, '--config', await wranglerConfig()], opts);
}

function wrangler(args, { onData } = {}) {
  return new Promise((resolve) => {
    const bin = wranglerBin();
    if (!bin) return resolve({ code: 1, out: 'wrangler not installed' });
    const child = spawn(process.execPath, [bin, ...args], { cwd: DATA, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    let out = '';
    const onChunk = (d) => { const s = d.toString().replace(/\x1b\[[0-9;]*m/g, ''); out += s; onData?.(s); };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('close', (code) => resolve({ code, out }));
    child.on('error', (e) => resolve({ code: 1, out: String(e) }));
  });
}

let cloudflareCache = null;
async function cloudflareStatus(force = false, lang = 'pt') {
  if (!cloudflareCache || force || Date.now() - cloudflareCache.at > 60000) {
    const { code, out } = await wrangler(['whoami']);
    let value;
    if (/wrangler not installed/i.test(out) && code !== 0) value = { state: 'missing' };
    else if (/not logged in|not authenticated/i.test(out) || code !== 0) value = { state: 'out' };
    else value = { state: 'in', email: out.match(/email\s+([^\s]+@[^\s.]+\.[^\s]+)/i)?.[1] || out.match(/([\w.+-]+@[\w-]+\.[\w.]+)/)?.[1] || '' };
    cloudflareCache = { at: Date.now(), value };
  }
  const v = cloudflareCache.value;
  if (v.state === 'missing') return { ok: false, loggedIn: false, message: tr(lang, 'Wrangler não está instalado. Corre de novo com "npx estudar@latest" ou, numa cópia do repositório, "npm install".') };
  if (v.state === 'out') return { ok: false, loggedIn: false, message: tr(lang, 'Conta Cloudflare não ligada') };
  return { ok: true, loggedIn: true, message: v.email ? tr(lang, 'Ligado como {email}', { email: v.email }) : tr(lang, 'Conta ligada') };
}

let loginRunning = false;
function startLogin() {
  if (loginRunning) return;
  loginRunning = true;
  wrangler(['login']).then(() => { loginRunning = false; cloudflareCache = null; });
}

// One deploy at a time; the screen polls /api/setup/job for the log.
let job = null;
async function startDeploy(lang = 'pt') {
  if (job?.running) return job;
  job = { running: true, ok: null, log: '', url: null, startedAt: Date.now() };
  const log = (s) => { job.log += s; };

  const vars = await readVars();
  if (!vars.SUPABASE_URL || !vars.SUPABASE_ANON_KEY) {
    Object.assign(job, { running: false, ok: false });
    log(`${tr(lang, 'Falta configurar o Supabase antes de publicar.')}\n`);
    return job;
  }

  (async () => {
    log(`${tr(lang, '▶ A publicar a app no Cloudflare…')}\n`);
    const deploy = await wranglerWithConfig(['deploy'], { onData: log });
    if (deploy.code !== 0) {
      if (/workers\.dev subdomain/i.test(deploy.out)) {
        log(`\n${tr(lang, '→ A tua conta ainda não tem um subdomínio workers.dev. Abre dash.cloudflare.com → Workers & Pages, escolhe um nome e tenta de novo.')}\n`);
      }
      Object.assign(job, { running: false, ok: false });
      return;
    }
    job.url = deploy.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0] || null;

    log(`\n${tr(lang, '▶ A enviar as chaves como segredos do Worker…')}\n`);
    const secrets = {};
    for (const k of Object.keys(FIELDS)) if (vars[k]) secrets[k] = vars[k];
    const dir = await mkdtemp(path.join(tmpdir(), 'estudar-'));
    const file = path.join(dir, 'secrets.json');
    let bulk;
    try {
      await writeFile(file, JSON.stringify(secrets), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      bulk = await wranglerWithConfig(['secret', 'bulk', file], { onData: (s) => log(s.replace(/"[^"]{20,}"/g, '"••••"')) });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    if (bulk.code !== 0) {
      Object.assign(job, { running: false, ok: false });
      return;
    }

    if (job.url) {
      await mkdir(DATA, { recursive: true, mode: 0o700 });
      await writeFile(DEPLOY_FILE, JSON.stringify({ url: job.url, deployedAt: new Date().toISOString() }, null, 2));
      if (sessionAccessToken) {
        log(`\n${tr(lang, '▶ A autorizar o novo endereço no Supabase…')}\n`);
        const r = await configureSupabaseAuth(sessionAccessToken, vars.SUPABASE_URL, lang);
        log(`${r.ok ? '✓' : '✗'} ${r.message}\n`);
      }
    }
    log(`\n${tr(lang, '✓ Publicado')}${job.url ? `: ${job.url}` : ''}\n`);
    Object.assign(job, { running: false, ok: true });
  })().catch((e) => { log(`\n✗ ${e.message}\n`); Object.assign(job, { running: false, ok: false }); });

  return job;
}

// ── Supabase Management API (optional one-click provisioning) ─
// The personal access token is kept in memory only for this session, never written to disk.
let sessionAccessToken = '';
let tokenTimer = null;
// The sbp_ token can manage every project in the Supabase account: keep it in memory for 15 minutes at most.
function rememberToken(token) {
  sessionAccessToken = token;
  clearTimeout(tokenTimer);
  if (token) tokenTimer = setTimeout(() => { sessionAccessToken = ''; }, 15 * 60 * 1000).unref();
}
const projectRef = (url) => url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || null;

async function management(token, method, pathName, body) {
  const r = await fetch(`https://api.supabase.com/v1${pathName}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

const OTP_TEMPLATE = {
  pt: {
    subject: 'O teu código do Estudar',
    body: `<h2>O teu código para entrar no Estudar</h2>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
<p>Escreve este código na app. Também podes <a href="{{ .ConfirmationURL }}">entrar por este link</a> se estiveres no mesmo dispositivo.</p>
<p>Se não pediste este email, ignora-o.</p>`,
  },
  en: {
    subject: 'Your Estudar code',
    body: `<h2>Your code to sign in to Estudar</h2>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
<p>Type this code in the app. You can also <a href="{{ .ConfirmationURL }}">sign in with this link</a> if you're on the same device.</p>
<p>If you didn't request this email, ignore it.</p>`,
  },
};

async function configureSupabaseAuth(token, supabaseUrl, lang = 'pt') {
  const ref = projectRef(supabaseUrl);
  if (!ref) return { ok: false, message: tr(lang, 'O URL do Supabase não parece válido (https://<ref>.supabase.co).') };
  const deploy = await readDeploy();
  const current = await management(token, 'GET', `/projects/${ref}/config/auth`);
  if (!current.ok) return { ok: false, message: tr(lang, 'Não foi possível ler a configuração de autenticação ({n}).', { n: current.status }) };
  const urls = new Set(String(current.data?.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean));
  urls.add(`http://localhost:${PORT}`);
  urls.add(`http://127.0.0.1:${PORT}`);
  if (deploy?.url) urls.add(deploy.url);

  // Addresses first, on their own: without them the login email points at Supabase's default (localhost:3000).
  const addr = await management(token, 'PATCH', `/projects/${ref}/config/auth`, {
    site_url: deploy?.url || `http://localhost:${PORT}`,
    uri_allow_list: [...urls].join(','),
    // Access is tied to accounts, and the owner also by email: an address must be confirmed before it
    // counts, and changing it needs confirmation from both the old and the new address.
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
  });
  if (!addr.ok) return { ok: false, message: tr(lang, 'A configuração de autenticação falhou ({n}). Faz este passo à mão (ver README).', { n: addr.status }) };

  // Since June 2026, new free projects on Supabase's built-in email can't change templates; custom SMTP lifts that.
  const tpl = await management(token, 'PATCH', `/projects/${ref}/config/auth`, {
    mailer_subjects_magic_link: OTP_TEMPLATE[lang].subject,
    mailer_templates_magic_link_content: OTP_TEMPLATE[lang].body,
    mailer_subjects_confirmation: OTP_TEMPLATE[lang].subject,
    mailer_templates_confirmation_content: OTP_TEMPLATE[lang].body,
  });
  if (!tpl.ok) {
    const noSmtp = !current.data?.smtp_host;
    return { ok: false, message: noSmtp
      ? tr(lang, 'Endereços autorizados, mas o Supabase não deixou mudar o email: projetos gratuitos novos precisam de um SMTP próprio (Authentication → Emails → SMTP Settings). Configura-o e carrega em Configurar de novo.')
      : tr(lang, 'Endereços autorizados, mas o email com código falhou ({n}). Acrescenta {{ .Token }} ao template Magic Link à mão.', { n: tpl.status }) };
  }
  return { ok: true, message: tr(lang, 'Endereços autorizados e email com código configurado.') };
}

async function provisionSupabase(token, lang = 'pt', ownerEmail = '') {
  const vars = await readVars();
  const ref = projectRef(vars.SUPABASE_URL);
  if (!ref) return [{ ok: false, message: tr(lang, 'Guarda primeiro o URL do projeto Supabase.') }];
  rememberToken(token);
  const steps = [];

  const sql = await migrationSql();
  const q = await management(token, 'POST', `/projects/${ref}/database/query`, { query: sql });
  steps.push(q.ok
    ? { ok: true, message: tr(lang, 'Tabelas e regras de acesso criadas.') }
    : { ok: false, message: q.status === 401 ? tr(lang, 'Token inválido.') : tr(lang, 'Não foi possível criar as tabelas ({n}). Usa “Copiar SQL”.', { n: q.status }) });
  if (q.status === 401) { rememberToken(''); return steps; }

  steps.push(await configureSupabaseAuth(token, vars.SUPABASE_URL, lang));

  if (keyKind(vars.SUPABASE_SERVICE_KEY) === 'public') vars.SUPABASE_SERVICE_KEY = '';
  if (keyKind(vars.SUPABASE_ANON_KEY) === 'secret') vars.SUPABASE_ANON_KEY = '';
  if (!vars.SUPABASE_SERVICE_KEY || !vars.SUPABASE_ANON_KEY) {
    const keys = await management(token, 'GET', `/projects/${ref}/api-keys?reveal=true`);
    if (keys.ok && Array.isArray(keys.data)) {
      const pick = (...names) => keys.data.find(k => names.includes(k.name) || names.includes(k.type))?.api_key;
      const anon = vars.SUPABASE_ANON_KEY || pick('publishable', 'anon');
      const service = vars.SUPABASE_SERVICE_KEY || pick('secret', 'service_role');
      if (anon || service) {
        await writeVars({ ...vars, SUPABASE_ANON_KEY: anon || vars.SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY: service || vars.SUPABASE_SERVICE_KEY });
        steps.push({ ok: true, message: tr(lang, 'Chaves do projeto preenchidas automaticamente.') });
      }
    }
  }

  // Your account first (you become the owner), then close sign-ups: only you and your viewers get in.
  if (ownerEmail) {
    const fresh = await readVars();
    const owner = await ensureUser(fresh, ownerEmail, lang);
    if (owner.ok) {
      await writeVars({ ...fresh, OWNER_EMAIL: ownerEmail, OWNER_ID: owner.id });
      steps.push({ ok: true, message: tr(lang, '{email} é o dono: só esta conta usa a IA e vê a configuração.', { email: ownerEmail }) });
      steps.push(await closeSignups(token, fresh, lang));
      if (await readDeploy()) steps.push({ ok: null, message: tr(lang, 'Carrega em Publicar de novo (passo 4) para aplicar no Cloudflare.') });
    } else {
      steps.push(owner);
    }
  } else if (await signupsOpen(await readVars())) {
    steps.push({ ok: false, message: tr(lang, 'Registos abertos: qualquer pessoa com o endereço da app pode criar conta. Escreve o teu email e carrega em Configurar para os fechar.') });
  }
  return steps;
}

// ── Who can sign in ──────────────────────────────────────────
// Supabase accepts new accounts by default, so anyone with the app's address could sign up and use
// your AI key and your SMTP. Configurar creates the owner's account and then closes sign-ups;
// more people are added here (an account created by the admin API, no email sent).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const supabaseHeaders = (key) => ({ apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) });

async function authAdmin(vars, method, pathName, body) {
  const r = await fetch(`${vars.SUPABASE_URL}/auth/v1/admin${pathName}`, {
    method,
    headers: { ...supabaseHeaders(vars.SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

// Public endpoint: needs only the publishable key.
async function signupsOpen(vars) {
  try {
    const r = await fetch(`${vars.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: vars.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return !(await r.json()).disable_signup;
  } catch { return null; }
}

async function listUsers(vars) {
  const r = await authAdmin(vars, 'GET', '/users?per_page=1000');
  return r.ok ? (r.data?.users || []) : null;
}

// Creates the account (no email is sent) or finds the existing one. Returns its id.
async function ensureUser(vars, email, lang) {
  if (!EMAIL_RE.test(email)) return { ok: false, message: tr(lang, 'Email inválido.') };
  if (!vars.SUPABASE_SERVICE_KEY) return { ok: false, message: tr(lang, 'Falta a chave secreta do Supabase.') };
  const r = await authAdmin(vars, 'POST', '/users', { email, email_confirm: true });
  if (r.ok && r.data?.id) return { ok: true, id: r.data.id };
  if (r.status === 422 || /already|exists/i.test(JSON.stringify(r.data || ''))) {
    const u = (await listUsers(vars))?.find(x => normalizeEmail(x.email) === email);
    if (u) return { ok: true, id: u.id };
  }
  return { ok: false, message: tr(lang, 'Não foi possível adicionar {email} ({n}).', { email, n: r.status }) };
}

// The viewers table, through PostgREST with the secret key (RLS lets no client write it).
async function viewersRest(vars, method, query = '', body, prefer) {
  const r = await fetch(`${vars.SUPABASE_URL}/rest/v1/viewers${query}`, {
    method,
    headers: { ...supabaseHeaders(vars.SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

async function addViewer(vars, email, lang) {
  const owner = normalizeEmail(vars.OWNER_EMAIL);
  if (!owner) return { ok: false, message: tr(lang, 'Define primeiro o dono: escreve o teu email e carrega em Configurar (passo 1).') };
  if (!EMAIL_RE.test(email)) return { ok: false, message: tr(lang, 'Email inválido.') };
  if (email === owner) return { ok: false, message: tr(lang, 'Esse é o email do dono.') };
  const ownerUser = (await listUsers(vars))?.find(x => normalizeEmail(x.email) === owner);
  if (!ownerUser) return { ok: false, message: tr(lang, 'A conta do dono ainda não existe: carrega em Configurar (passo 1).') };
  const u = await ensureUser(vars, email, lang);
  if (!u.ok) return u;
  const r = await viewersRest(vars, 'POST', '?on_conflict=owner_id,viewer_id', { owner_id: ownerUser.id, viewer_id: u.id, email }, 'resolution=ignore-duplicates,return=minimal');
  if (!r.ok) {
    return { ok: false, message: r.status === 404
      ? tr(lang, 'Falta atualizar a base de dados: carrega em Configurar (passo 1).')
      : tr(lang, 'Não foi possível adicionar {email} ({n}).', { email, n: r.status }) };
  }
  return { ok: true, message: tr(lang, '{email} pode ver o teu plano e o teu progresso (só leitura). Entra com o código por email.', { email }) };
}

// Ends access at once: the viewers row goes (RLS stops the reads) and so does the account.
async function removeAccess(vars, email, lang) {
  if (!EMAIL_RE.test(email)) return { ok: false, message: tr(lang, 'Email inválido.') };
  if (email === normalizeEmail(vars.OWNER_EMAIL)) return { ok: false, message: tr(lang, 'Não podes tirar o acesso ao dono.') };
  if (!vars.SUPABASE_SERVICE_KEY) return { ok: false, message: tr(lang, 'Falta a chave secreta do Supabase.') };
  const u = (await listUsers(vars))?.find(x => normalizeEmail(x.email) === email);
  if (u) {
    // The row first, and stop if that fails: never report "removed" while a grant is left behind.
    const del = await viewersRest(vars, 'DELETE', `?viewer_id=eq.${encodeURIComponent(u.id)}`);
    if (!del.ok && del.status !== 404) return { ok: false, message: tr(lang, 'Não foi possível remover {email} ({n}).', { email, n: del.status }) };
    const d = await authAdmin(vars, 'DELETE', `/users/${u.id}`);
    if (!d.ok) return { ok: false, message: tr(lang, 'Não foi possível remover {email} ({n}).', { email, n: d.status }) };
  }
  return { ok: true, message: tr(lang, '{email} deixou de ter acesso.', { email }) };
}

async function closeSignups(token, vars, lang) {
  const ref = projectRef(vars.SUPABASE_URL);
  if (!ref) return { ok: false, message: tr(lang, 'Guarda primeiro o URL do projeto Supabase.') };
  const r = await management(token, 'PATCH', `/projects/${ref}/config/auth`, { disable_signup: true });
  if (r.ok) return { ok: true, message: tr(lang, 'Registos fechados: só entra quem tem conta.') };
  return { ok: false, message: r.status === 401 ? tr(lang, 'Token inválido.') : tr(lang, 'Não foi possível fechar os registos ({n}).', { n: r.status }) };
}

async function accessState(vars) {
  if (!vars.SUPABASE_URL || !vars.SUPABASE_ANON_KEY) return { configured: false };
  const owner = normalizeEmail(vars.OWNER_EMAIL);
  const canManage = !!vars.SUPABASE_SERVICE_KEY && keyKind(vars.SUPABASE_SERVICE_KEY) !== 'public';
  const [open, users, v] = await Promise.all([
    signupsOpen(vars),
    canManage ? listUsers(vars).catch(() => null) : null,
    canManage ? viewersRest(vars, 'GET', '?select=email').catch(() => null) : null,
  ]);
  const viewers = v?.ok ? v.data.map(r => r.email).sort() : [];
  const others = users ? users.map(u => normalizeEmail(u.email)).filter(e => e && e !== owner && !viewers.includes(e)).sort() : [];
  return {
    configured: true, open, owner, viewers, others, canManage,
    tableReady: !canManage || !!v?.ok,
    usersReadable: !!users,
    hasToken: !!sessionAccessToken,
  };
}

// ── HTTP ─────────────────────────────────────────────────────
async function toRequest(req) {
  const buf = req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req);
  const body = buf?.length ? buf : undefined;
  return new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const sendJson = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

// Blocks other websites (and DNS rebinding) from driving the setup routes through the browser.
// DNS rebinding: a hostile page can make its own hostname resolve to 127.0.0.1, but it can't change the Host header.
function isLocalHost(req) {
  const host = req.headers.host || '';
  return host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
}

function sameToken(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(SETUP_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isTrustedSetupRequest(req) {
  const origin = req.headers.origin;
  const okOrigin = !origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
  return isLocalHost(req) && okOrigin && sameToken(req.headers['x-estudar-setup']);
}

async function handleSetup(req, res, pathname) {
  const lang = langFrom(req.headers['x-estudar-lang']);
  if (!isTrustedSetupRequest(req)) return sendJson(res, { error: tr(lang, 'Pedido recusado.') }, 403);
  const body = req.method === 'POST' ? await readJsonBody(req) : {};

  switch (`${req.method} ${pathname}`) {
    case 'GET /api/setup/state':
      return sendJson(res, await publicState());
    case 'POST /api/setup/save':
    case 'POST /api/setup/test': {
      // mergeValues only throws its own, translated validation messages: show them.
      let merged;
      try { merged = mergeValues(await readVars(), body.values, lang); } catch (e) { return sendJson(res, { error: e.message }, 400); }
      if (pathname === '/api/setup/test') return sendJson(res, await health({ ...readEnv({ ...merged, RUNTIME: 'local' }), lang }));
      await writeVars(merged);
      return sendJson(res, await publicState());
    }
    case 'GET /api/setup/cloudflare':
      return sendJson(res, { ...(await cloudflareStatus(new URL(req.url, 'http://x').searchParams.has('fresh'), lang)), loginRunning });
    case 'POST /api/setup/cloudflare/login':
      startLogin();
      return sendJson(res, { started: true });
    case 'POST /api/setup/deploy':
      return sendJson(res, await startDeploy(lang));
    case 'GET /api/setup/job':
      return sendJson(res, job || { running: false, ok: null, log: '' });
    case 'GET /api/setup/remote-health': {
      const deploy = await readDeploy();
      if (!deploy?.url) return sendJson(res, { ok: null, message: tr(lang, 'Ainda não publicado') });
      try {
        // /api/health on the published app only answers the owner's session, which this server doesn't have.
        // /api/config is public and says enough: it's our Worker, running on Cloudflare, with Supabase configured.
        const r = await fetch(`${deploy.url}/api/config`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
        const c = r.ok ? await r.json().catch(() => null) : null;
        const ok = !!(c && c.runtime === 'cloudflare' && c.configured);
        const message = !r.ok ? tr(lang, 'Respondeu {n}', { n: r.status }) : ok ? tr(lang, 'Online') : tr(lang, 'Publicado, mas sem o Supabase configurado');
        return sendJson(res, { ok, url: deploy.url, message });
      } catch {
        return sendJson(res, { ok: false, url: deploy.url, message: tr(lang, 'Sem resposta do endereço publicado') });
      }
    }
    case 'GET /api/setup/sql':
      return sendJson(res, { sql: await migrationSql(), ref: projectRef((await readVars()).SUPABASE_URL) });
    case 'POST /api/setup/supabase/provision':
      if (!/^sbp_[A-Za-z0-9_]+$/.test(String(body.token || ''))) return sendJson(res, { error: tr(lang, 'O token deve começar por sbp_.') }, 400);
      return sendJson(res, { steps: await provisionSupabase(body.token, lang, normalizeEmail(body.ownerEmail)) });
    case 'GET /api/setup/access':
      return sendJson(res, await accessState(await readVars()));
    case 'POST /api/setup/access/viewer':
      return sendJson(res, await addViewer(await readVars(), normalizeEmail(body.email), lang));
    case 'POST /api/setup/access/remove':
      return sendJson(res, await removeAccess(await readVars(), normalizeEmail(body.email), lang));
    case 'POST /api/setup/access/close': {
      const token = String(body.token || '') || sessionAccessToken;
      if (!/^sbp_[A-Za-z0-9_]+$/.test(token)) return sendJson(res, { error: tr(lang, 'O token deve começar por sbp_.') }, 400);
      if (body.token) rememberToken(token);
      return sendJson(res, await closeSignups(token, await readVars(), lang));
    }
    default:
      return sendJson(res, { error: tr(lang, 'Não encontrado.') }, 404);
  }
}

// 8 MB: the largest legitimate body is a 5 MB photo, base64-encoded.
const MAX_BODY = 8 * 1024 * 1024;
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { const e = new Error('Pedido demasiado grande.'); e.status = 413; throw e; }
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const buf = await readBody(req);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { return {}; }
}

async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) return sendJson(res, { error: 'Não encontrado.' }, 404);
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    // Same headers as the published Worker (minus HSTS: this is plain http on localhost).
    for (const [k, v] of Object.entries(securityHeaders({ supabaseUrl: (await readVars()).SUPABASE_URL, https: false }))) res.setHeader(k, v);
    if (!isLocalHost(req)) return sendJson(res, { error: 'Host not allowed' }, 421);
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/setup/')) return await handleSetup(req, res, pathname);
    if (pathname.startsWith('/api/')) {
      const vars = await readVars();
      return await send(res, await handleApi(await toRequest(req), { ...vars, RUNTIME: 'local', SETUP: '1' }));
    }
    return await serveStatic(res, pathname);
  } catch (e) {
    console.error(e);
    sendJson(res, { error: e.status === 413 ? tr(langFrom(req.headers['x-estudar-lang']), e.message) : tr(langFrom(req.headers['x-estudar-lang']), 'Erro inesperado.') }, e.status || 500);
  }
});

function listen(attempt = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempt < 10) { PORT++; listen(attempt + 1); }
    else { console.error(e); process.exit(1); }
  });
  // Loopback only: the setup routes hold your keys and must not be reachable from the network.
  server.listen(PORT, '127.0.0.1', () => {
    const base = `http://localhost:${PORT}`;
    const url = `${base}/#setup=${SETUP_TOKEN}`;
    console.log(`\n  Estudar: ${base}`);
    console.log(`  Servidor e chaves / Server & keys: ${url}`);
    console.log('  PT: abre a app e vai a Conta → Servidor e chaves.');
    console.log('  EN: open the app and go to Account → Server & keys.');
    if (DATA !== ROOT) console.log(`  ${DATA}`);
    console.log('');
    if (!argv.includes('--no-open')) {
      const opener = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(opener);
    }
  });
}

listen();
