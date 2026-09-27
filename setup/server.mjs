// Local server: `npm start`
// - serves the app from public/ and the same /api routes the Cloudflare Worker has
// - adds /api/setup/* so the in-app "Servidor" screen can save keys, create the
//   Supabase tables and publish to Cloudflare. These routes only exist here, never on the Worker.
import http from 'node:http';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, exec } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, health, readEnv } from '../worker/api.js';
import { tr, langFrom } from '../worker/i18n.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const DEV_VARS = path.join(ROOT, '.dev.vars');
const DEPLOY_FILE = path.join(ROOT, '.deploy.json');
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260927000000_init.sql');
let PORT = Number(process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

// Keys the setup screen can edit. `secret` values are never sent back to the browser in full.
const FIELDS = {
  SUPABASE_URL: { secret: false },
  SUPABASE_ANON_KEY: { secret: false },
  SUPABASE_SERVICE_KEY: { secret: true },
  AI_PROVIDER: { secret: false },
  AI_API_KEY: { secret: true },
  AI_MODEL: { secret: false },
  AI_BASE_URL: { secret: false },
  MAX_PLANS_PER_DAY: { secret: false },
  AUTH_GOOGLE: { secret: false },
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
  const lines = ['# Written by the Estudar setup screen. Keep this file private (it is in .gitignore).'];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined || v === '') continue;
    lines.push(`${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  }
  await writeFile(DEV_VARS, lines.join('\n') + '\n', 'utf8');
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

// Incoming values: empty secret = keep the stored one; masked value = unchanged.
function mergeValues(stored, incoming = {}, lang = 'pt') {
  const next = { ...stored };
  for (const k of Object.keys(FIELDS)) {
    if (!(k in incoming)) continue;
    const v = String(incoming[k] ?? '').trim();
    if (FIELDS[k].secret && (v === '' || v.startsWith('••••'))) continue;
    if (/[\r\n]/.test(v)) throw new Error(tr(lang, '{k} não pode ter quebras de linha.', { k }));
    next[k] = v;
  }
  return next;
}

async function readDeploy() {
  try { return JSON.parse(await readFile(DEPLOY_FILE, 'utf8')); } catch { return null; }
}

// ── Wrangler ─────────────────────────────────────────────────
function wrangler(args, { onData } = {}) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['--no-install', 'wrangler', ...args], { cwd: ROOT, shell: true, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
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
    if (/not installed|could not determine executable|npm ERR/i.test(out) && code !== 0) value = { state: 'missing' };
    else if (/not logged in|not authenticated/i.test(out) || code !== 0) value = { state: 'out' };
    else value = { state: 'in', email: out.match(/email\s+([^\s]+@[^\s.]+\.[^\s]+)/i)?.[1] || out.match(/([\w.+-]+@[\w-]+\.[\w.]+)/)?.[1] || '' };
    cloudflareCache = { at: Date.now(), value };
  }
  const v = cloudflareCache.value;
  if (v.state === 'missing') return { ok: false, loggedIn: false, message: tr(lang, 'Wrangler não está instalado. Corre "npm install" nesta pasta.') };
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
    const deploy = await wrangler(['deploy'], { onData: log });
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
    const file = path.join(tmpdir(), `estudar-secrets-${process.pid}-${Date.now()}.json`);
    await writeFile(file, JSON.stringify(secrets), { encoding: 'utf8', mode: 0o600 });
    const bulk = await wrangler(['secret', 'bulk', `"${file}"`], { onData: (s) => log(s.replace(/"[^"]{20,}"/g, '"••••"')) });
    await unlink(file).catch(() => {});
    if (bulk.code !== 0) {
      Object.assign(job, { running: false, ok: false });
      return;
    }

    if (job.url) {
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
  const r = await management(token, 'PATCH', `/projects/${ref}/config/auth`, {
    site_url: deploy?.url || `http://localhost:${PORT}`,
    uri_allow_list: [...urls].join(','),
    mailer_subjects_magic_link: OTP_TEMPLATE[lang].subject,
    mailer_templates_magic_link_content: OTP_TEMPLATE[lang].body,
    mailer_subjects_confirmation: OTP_TEMPLATE[lang].subject,
    mailer_templates_confirmation_content: OTP_TEMPLATE[lang].body,
  });
  return r.ok
    ? { ok: true, message: tr(lang, 'Endereços autorizados e email com código configurado.') }
    : { ok: false, message: tr(lang, 'A configuração de autenticação falhou ({n}). Faz este passo à mão (ver README).', { n: r.status }) };
}

async function provisionSupabase(token, lang = 'pt') {
  const vars = await readVars();
  const ref = projectRef(vars.SUPABASE_URL);
  if (!ref) return [{ ok: false, message: tr(lang, 'Guarda primeiro o URL do projeto Supabase.') }];
  sessionAccessToken = token;
  const steps = [];

  const sql = await readFile(MIGRATION, 'utf8');
  const q = await management(token, 'POST', `/projects/${ref}/database/query`, { query: sql });
  steps.push(q.ok
    ? { ok: true, message: tr(lang, 'Tabelas e regras de acesso criadas.') }
    : { ok: false, message: q.status === 401 ? tr(lang, 'Token inválido.') : tr(lang, 'Não foi possível criar as tabelas ({n}). Usa “Copiar SQL”.', { n: q.status }) });
  if (q.status === 401) { sessionAccessToken = ''; return steps; }

  steps.push(await configureSupabaseAuth(token, vars.SUPABASE_URL, lang));

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
  return steps;
}

// ── HTTP ─────────────────────────────────────────────────────
async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
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
function isTrustedSetupRequest(req) {
  const host = req.headers.host || '';
  const okHost = host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
  const origin = req.headers.origin;
  const okOrigin = !origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
  return okHost && okOrigin && req.headers['x-estudar-setup'] === '1';
}

async function handleSetup(req, res, pathname) {
  const lang = langFrom(req.headers['x-estudar-lang']);
  if (!isTrustedSetupRequest(req)) return sendJson(res, { error: tr(lang, 'Pedido recusado.') }, 403);
  const body = req.method === 'POST' ? await readJsonBody(req) : {};

  switch (`${req.method} ${pathname}`) {
    case 'GET /api/setup/state':
      return sendJson(res, await publicState());
    case 'POST /api/setup/save': {
      const next = mergeValues(await readVars(), body.values, lang);
      await writeVars(next);
      return sendJson(res, await publicState());
    }
    case 'POST /api/setup/test': {
      const merged = mergeValues(await readVars(), body.values, lang);
      return sendJson(res, await health({ ...readEnv({ ...merged, RUNTIME: 'local' }), lang }));
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
        const r = await fetch(`${deploy.url}/api/health`, { signal: AbortSignal.timeout(10000), headers: { 'X-Estudar-Lang': lang } });
        const h = await r.json();
        return sendJson(res, { ok: r.ok && h.app?.ok, url: deploy.url, message: r.ok ? tr(lang, 'Online') : tr(lang, 'Respondeu {n}', { n: r.status }), health: h });
      } catch {
        return sendJson(res, { ok: false, url: deploy.url, message: tr(lang, 'Sem resposta do endereço publicado') });
      }
    }
    case 'GET /api/setup/sql':
      return sendJson(res, { sql: await readFile(MIGRATION, 'utf8'), ref: projectRef((await readVars()).SUPABASE_URL) });
    case 'POST /api/setup/supabase/provision':
      if (!/^sbp_[A-Za-z0-9_]+$/.test(String(body.token || ''))) return sendJson(res, { error: tr(lang, 'O token deve começar por sbp_.') }, 400);
      return sendJson(res, { steps: await provisionSupabase(body.token, lang) });
    default:
      return sendJson(res, { error: tr(lang, 'Não encontrado.') }, 404);
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
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
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/setup/')) return await handleSetup(req, res, pathname);
    if (pathname.startsWith('/api/')) {
      const vars = await readVars();
      return await send(res, await handleApi(await toRequest(req), { ...vars, RUNTIME: 'local', SETUP: '1' }));
    }
    return await serveStatic(res, pathname);
  } catch (e) {
    console.error(e);
    sendJson(res, { error: e.message }, 500);
  }
});

function listen(attempt = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempt < 10) { PORT++; listen(attempt + 1); }
    else { console.error(e); process.exit(1); }
  });
  // Loopback only: the setup routes hold your keys and must not be reachable from the network.
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  Estudar: ${url}`);
    console.log('  PT: abre a app e vai a Conta → Servidor e chaves.');
    console.log('  EN: open the app and go to Account → Server & keys.\n');
    if (!process.argv.includes('--no-open')) {
      const opener = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(opener);
    }
  });
}

listen();
