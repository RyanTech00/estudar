import * as storage from './storage.js';
import { t, lang, locale } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PROVIDERS = () => ({
  gemini: { label: t('Gemini (Google) — tem nível gratuito'), keyUrl: 'https://aistudio.google.com/apikey', keyHint: t('Cria a chave em aistudio.google.com/apikey'), model: 'gemini-2.5-flash' },
  anthropic: { label: 'Claude (Anthropic)', keyUrl: 'https://platform.claude.com/settings/keys', keyHint: t('Cria a chave na Claude Console'), model: 'claude-opus-5' },
  openai: { label: t('OpenAI ou compatível (OpenRouter, Groq…)'), keyUrl: 'https://platform.openai.com/api-keys', keyHint: t('Chave do teu fornecedor compatível com OpenAI'), model: '' },
});
const modelPlaceholder = (p) => (p.model ? t('{m} (padrão)', { m: p.model }) : t('obrigatório, ex. gpt-4o-mini'));

let config = null;     // /api/config
let state = null;      // /api/setup/state (local server only)
let pollTimer = null;
let onChange = null;

async function setupApi(path, body) {
  const r = await fetch(`/api/setup/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Estudar-Setup': '1', 'X-Estudar-Lang': lang, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || t('Erro {n}', { n: r.status }));
  return data;
}

// ── Status dots ───────────────────────
const dotClass = (ok) => (ok === true ? 'ok' : ok === false ? 'bad' : 'off');

function statusRow(name, s) {
  return `<li><i class="dot ${s ? dotClass(s.ok) : 'wait'}"></i><b>${esc(t(name))}</b><span>${esc(s?.message || t('A verificar…'))}</span></li>`;
}

export async function fetchHealth() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store', headers: { 'X-Estudar-Lang': lang } });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return null;
  }
}

async function cloudflareStatus(health) {
  if (config?.runtime === 'cloudflare') return { ok: true, message: t('Online em {h}', { h: location.host }) };
  if (!config?.setup) return { ok: null, message: t('Não publicado') };
  try {
    const r = await setupApi('remote-health');
    return { ok: r.ok, message: r.url ? `${r.message} · ${r.url.replace('https://', '')}` : r.message };
  } catch {
    return { ok: null, message: t('Não publicado') };
  }
}

async function renderStatus(health) {
  const list = $('server-status');
  if (!list) return;
  if (!config) {
    list.innerHTML = statusRow('Servidor', { ok: false, message: t('Sem servidor: a app está em modo local (ficheiros estáticos)') });
    return;
  }
  list.innerHTML = ['App', 'Supabase', 'Base de dados', 'IA', 'Limite de uso', 'Cloudflare'].map(n => statusRow(n, null)).join('');
  const h = health || await fetchHealth();
  const cf = await cloudflareStatus(h);
  list.innerHTML = [
    statusRow('App', h?.app || { ok: false, message: t('Sem resposta') }),
    statusRow('Supabase', h?.supabase),
    statusRow('Base de dados', h?.database),
    statusRow('IA', h?.ai),
    statusRow('Limite de uso', h?.limit),
    statusRow('Cloudflare', cf),
  ].join('');
  renderSummary(h, cf);
}

// Compact dots shown in the account sheet.
export async function renderSummary(health, cf) {
  const el = $('server-summary');
  if (!el) return;
  if (!config) { el.innerHTML = `<span><i class="dot off"></i>${t('Modo local')}</span>`; return; }
  const h = health || await fetchHealth();
  const cloud = cf || await cloudflareStatus(h);
  el.innerHTML = [
    ['Supabase', h?.supabase?.ok ?? null],
    ['IA', h?.ai?.ok ?? null],
    ['Cloudflare', cloud.ok],
  ].map(([n, ok]) => `<span><i class="dot ${dotClass(ok)}"></i>${t(n)}</span>`).join('');
}

// ── Screen ────────────────────────────
export async function openServerScreen(changed) {
  onChange = changed;
  $('server').classList.add('active');
  $('server').setAttribute('aria-hidden', 'false');
  document.body.classList.add('planner-open');
  // Ask the server directly: a cached config from an earlier start isn't proof the API is here now.
  config = await fetch('/api/config', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  state = null;
  if (config?.setup) {
    try { state = await setupApi('state'); } catch { state = null; }
  }
  render();
  renderStatus();
}

function closeServerScreen() {
  clearInterval(pollTimer);
  $('server').classList.remove('active');
  $('server').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('planner-open');
}

export function setupServerScreen() {
  $('server-close').addEventListener('click', closeServerScreen);
  storage.loadServerConfig().then(c => { config = c; renderSummary(); });
}

function render() {
  const body = $('server-body');
  const statusCard = `
    <section class="card">
      <div class="row-between"><h3 class="h2">${t('Estado')}</h3><button class="btn btn-ghost btn-sm" id="srv-refresh">${t('Verificar de novo')}</button></div>
      <ul class="status-list" id="server-status"></ul>
    </section>`;

  if (!config) {
    body.innerHTML = statusCard + `
      <section class="card">
        <h3 class="h2">${t('Ligar um servidor')}</h3>
        <p class="muted small">${t('Esta cópia está a correr só com ficheiros estáticos, por isso os dados ficam apenas neste browser. Para teres conta, sincronização e IA:')}</p>
        <ol class="steps">
          <li>${t('No teu computador, abre a pasta do projeto e corre <code>npm install</code> e depois <code>npm start</code>.')}</li>
          <li>${t('Abre o endereço que aparece (ex. <code>http://localhost:8787</code>) e volta a este ecrã: vais poder colar as chaves e publicar no Cloudflare com um clique.')}</li>
        </ol>
      </section>`;
  } else if (!config.setup) {
    body.innerHTML = statusCard + `
      <section class="card">
        <h3 class="h2">${t('Alterar chaves')}</h3>
        <p class="muted small">${t('As chaves estão guardadas como segredos no Worker do Cloudflare e não podem ser vistas daqui. Para as mudar, corre <code>npm start</code> no teu computador, abre <b>Conta → Servidor e chaves</b>, altera e carrega em <b>Publicar</b> outra vez.')}</p>
      </section>`;
  } else {
    body.innerHTML = statusCard + renderForms();
    bindForms();
  }
  $('srv-refresh').addEventListener('click', () => renderStatus());
}

function field(name, label, { type = 'text', placeholder = '', hint = '', value } = {}) {
  const v = value ?? state?.values?.[name] ?? '';
  const secret = name in (state?.secretsSet || {});
  return `
    <label class="field">
      <span>${label}${secret && state.secretsSet[name] ? ` <em class="saved">${t('guardada')}</em>` : ''}</span>
      <input data-var="${name}" type="${type}" value="${esc(v)}" placeholder="${esc(secret && state.secretsSet[name] ? t('Deixa vazio para manter a atual') : placeholder)}" autocomplete="off" spellcheck="false">
      ${hint ? `<small class="hint">${hint}</small>` : ''}
    </label>`;
}

function renderForms() {
  const v = state?.values || {};
  const provider = v.AI_PROVIDER || 'gemini';
  const providers = PROVIDERS();
  const p = providers[provider] || providers.gemini;
  const deploy = state?.deploy;
  return `
    <section class="card">
      <h3 class="h2"><span class="step-n">1</span>${t('Supabase — contas e dados')}</h3>
      <p class="muted small">${t('Cria um projeto grátis em <a href="https://supabase.com/dashboard/new" target="_blank" rel="noopener">supabase.com</a>. Depois copia os valores de <b>Project Settings → API Keys</b> (o URL está em <b>Data API</b>).')}</p>
      ${field('SUPABASE_URL', 'Project URL', { placeholder: 'https://abcdefgh.supabase.co', type: 'url' })}
      ${field('SUPABASE_ANON_KEY', t('Chave pública (publishable / anon)'), { placeholder: t('sb_publishable_… ou eyJ…'), hint: t('Pode ser pública: as regras da base de dados protegem cada utilizador.') })}
      ${field('SUPABASE_SERVICE_KEY', t('Chave secreta (secret / service_role) — opcional'), { type: 'password', placeholder: t('sb_secret_… ou eyJ…'), hint: t('Só fica no servidor. Serve para limitar quantos planos cada pessoa gera por dia.') })}

      <details class="sub" ${state?.values?.SUPABASE_URL ? '' : 'open'}>
        <summary>${t('Criar as tabelas e configurar o email de login')}</summary>
        <p class="muted small">${t('<b>Automático:</b> cria um token pessoal em <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener">supabase.com/dashboard/account/tokens</a> e cola-o aqui. É usado só agora, não fica guardado.')}</p>
        <div class="inline-form">
          <input id="srv-token" type="password" placeholder="sbp_…" autocomplete="off">
          <button class="btn btn-ghost btn-sm" id="srv-provision">${t('Configurar')}</button>
        </div>
        <ul class="status-list compact" id="srv-provision-result"></ul>
        <p class="muted small">${t('<b>Manual:</b> <button class="link-btn" id="srv-copy-sql">copiar o SQL</button> e colá-lo no <a id="srv-sql-link" href="https://supabase.com/dashboard" target="_blank" rel="noopener">SQL Editor</a>. Em Authentication → Emails → Magic Link acrescenta <code>{{ .Token }}</code> ao texto.')}</p>
      </details>
    </section>

    <section class="card">
      <h3 class="h2"><span class="step-n">2</span>${t('IA — gerar planos de estudo')}</h3>
      <label class="field"><span>${t('Fornecedor')}</span>
        <select data-var="AI_PROVIDER" id="srv-provider">${Object.entries(providers).map(([k, x]) => `<option value="${k}" ${k === provider ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
      </label>
      ${field('AI_API_KEY', t('Chave da API'), { type: 'password', placeholder: t('Cola aqui a chave'), hint: `<a href="${p.keyUrl}" target="_blank" rel="noopener" id="srv-key-link">${p.keyHint}</a>` })}
      <div class="field-row">
        ${field('AI_MODEL', t('Modelo'), { placeholder: modelPlaceholder(p) })}
        ${field('MAX_PLANS_PER_DAY', t('Planos por pessoa/dia'), { type: 'number', placeholder: '10' })}
      </div>
      <div id="srv-baseurl" class="${provider === 'openai' ? '' : 'hidden'}">
        ${field('AI_BASE_URL', t('URL da API (opcional)'), { placeholder: 'https://api.openai.com/v1', hint: t('Ex. https://openrouter.ai/api/v1 ou https://api.groq.com/openai/v1') })}
      </div>
    </section>

    <section class="card">
      <h3 class="h2"><span class="step-n">3</span>${t('Login')}</h3>
      <div class="setting">
        <span>${t('Login com código por email')}</span><span class="muted small">${t('sempre ativo')}</span>
      </div>
      <div class="setting">
        <span>${t('Login com Google')}<br><small class="muted">${t('Requer ativar o provider Google no Supabase')}</small></span>
        <button class="switch" id="srv-google" role="switch" aria-checked="${v.AUTH_GOOGLE === 'true'}"><i></i></button>
      </div>
    </section>

    <div class="server-save">
      <p class="planner-status hidden" id="srv-save-status" role="status"></p>
      <div class="planner-actions">
        <button class="btn btn-ghost" id="srv-test">${t('Testar')}</button>
        <button class="btn btn-primary" id="srv-save">${t('Guardar')}</button>
      </div>
    </div>

    <section class="card">
      <h3 class="h2"><span class="step-n">4</span>${t('Onde a app corre')}</h3>
      <div class="where">
        <div class="where-card on">
          <b>${t('Neste computador')}</b>
          <p class="muted small">${t('Já está a correr em <code>{url}</code>. Só funciona enquanto o <code>npm start</code> estiver aberto e só neste computador.', { url: esc(state?.localUrl || location.origin) })}</p>
        </div>
        <div class="where-card ${deploy?.url ? 'on' : ''}">
          <b>${t('Cloudflare — acesso de qualquer lado')}</b>
          <p class="muted small">${t('Publica a app e as chaves (como segredos) num Worker grátis. Fica disponível no telemóvel e em qualquer computador, sempre.')}</p>
          <ul class="status-list compact"><li><i class="dot wait" id="cf-dot"></i><b>${t('Conta')}</b><span id="cf-account">${t('A verificar…')}</span></li></ul>
          <div class="planner-actions left">
            <button class="btn btn-ghost btn-sm hidden" id="cf-login">${t('Ligar conta Cloudflare')}</button>
            <button class="btn btn-primary btn-sm" id="cf-deploy" disabled>${deploy?.url ? t('Publicar de novo') : t('Publicar no Cloudflare')}</button>
          </div>
          ${deploy?.url ? `<p class="small deploy-url">${t('Publicado em')} <a href="${esc(deploy.url)}" target="_blank" rel="noopener">${esc(deploy.url)}</a> · ${new Date(deploy.deployedAt).toLocaleString(locale())}</p>` : ''}
          <pre class="deploy-log hidden" id="cf-log"></pre>
        </div>
      </div>
    </section>`;
}

function collectValues() {
  const values = {};
  document.querySelectorAll('#server-body [data-var]').forEach(el => { values[el.dataset.var] = el.value.trim(); });
  values.AUTH_GOOGLE = $('srv-google').getAttribute('aria-checked') === 'true' ? 'true' : '';
  return values;
}

function setSaveStatus(msg, error = false) {
  const el = $('srv-save-status');
  el.textContent = msg || '';
  el.classList.toggle('error', error);
  el.classList.toggle('hidden', !msg);
}

function bindForms() {
  $('srv-provider').addEventListener('change', (e) => {
    const p = PROVIDERS()[e.target.value];
    $('srv-baseurl').classList.toggle('hidden', e.target.value !== 'openai');
    $('srv-key-link').href = p.keyUrl;
    $('srv-key-link').textContent = p.keyHint;
    document.querySelector('[data-var="AI_MODEL"]').placeholder = modelPlaceholder(p);
  });
  $('srv-google').addEventListener('click', (e) => {
    const b = e.currentTarget;
    b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
  });

  $('srv-test').addEventListener('click', async () => {
    setSaveStatus(t('A testar as ligações…'));
    try {
      const h = await setupApi('test', { values: collectValues() });
      await renderStatus(h);
      const bad = ['supabase', 'database', 'ai'].filter(k => h[k]?.ok === false);
      setSaveStatus(bad.length ? t('Há ligações com problemas — vê o estado acima.') : t('Tudo o que está preenchido responde. Carrega em Guardar.'), !!bad.length);
      $('server-status').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setSaveStatus(e.message, true);
    }
  });

  $('srv-save').addEventListener('click', async () => {
    try {
      state = await setupApi('save', { values: collectValues() });
      setSaveStatus(t('Guardado. A app vai recarregar com a nova configuração…'));
      onChange?.();
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      setSaveStatus(e.message, true);
    }
  });

  $('srv-provision').addEventListener('click', async () => {
    const out = $('srv-provision-result');
    out.innerHTML = `<li><i class="dot wait"></i><b>Supabase</b><span>${t('A configurar…')}</span></li>`;
    try {
      // Save first so the server knows which project to configure.
      state = await setupApi('save', { values: collectValues() });
      const r = await setupApi('supabase/provision', { token: $('srv-token').value.trim() });
      $('srv-token').value = '';
      out.innerHTML = r.steps.map(s => `<li><i class="dot ${s.ok ? 'ok' : 'bad'}"></i><span>${esc(s.message)}</span></li>`).join('');
      state = await setupApi('state');
      renderStatus();
    } catch (e) {
      out.innerHTML = `<li><i class="dot bad"></i><span>${esc(e.message)}</span></li>`;
    }
  });

  $('srv-copy-sql').addEventListener('click', async () => {
    const { sql, ref } = await setupApi('sql');
    await navigator.clipboard.writeText(sql);
    if (ref) $('srv-sql-link').href = `https://supabase.com/dashboard/project/${ref}/sql/new`;
    $('srv-copy-sql').textContent = t('SQL copiado ✓');
  });

  $('cf-login').addEventListener('click', async () => {
    await setupApi('cloudflare/login', {});
    $('cf-account').textContent = t('Abre a janela do browser que apareceu e autoriza o acesso…');
    pollCloudflare(true);
  });
  $('cf-deploy').addEventListener('click', deploy);

  pollCloudflare(false);
}

async function refreshCloudflare(fresh) {
  try {
    const s = await setupApi(`cloudflare${fresh ? '?fresh=1' : ''}`);
    $('cf-dot').className = `dot ${s.loggedIn ? 'ok' : s.loginRunning ? 'wait' : 'off'}`;
    $('cf-account').textContent = s.loginRunning && !s.loggedIn ? t('À espera da autorização no browser…') : s.message;
    $('cf-login').classList.toggle('hidden', s.loggedIn);
    $('cf-deploy').disabled = !s.loggedIn || !state?.values?.SUPABASE_URL;
    $('cf-deploy').title = !state?.values?.SUPABASE_URL ? t('Configura e guarda o Supabase primeiro') : '';
    return s;
  } catch {
    return null;
  }
}

function pollCloudflare(waitingForLogin) {
  clearInterval(pollTimer);
  refreshCloudflare(waitingForLogin);
  if (!waitingForLogin) return;
  pollTimer = setInterval(async () => {
    const s = await refreshCloudflare(true);
    if (s?.loggedIn || (s && !s.loginRunning)) clearInterval(pollTimer);
  }, 3000);
}

async function deploy() {
  const btn = $('cf-deploy');
  const log = $('cf-log');
  btn.disabled = true;
  btn.textContent = t('A publicar…');
  log.classList.remove('hidden');
  log.textContent = '';
  try {
    await setupApi('deploy', {});
  } catch (e) {
    log.textContent = e.message;
    btn.disabled = false;
    return;
  }
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const j = await setupApi('job').catch(() => null);
    if (!j) return;
    log.textContent = j.log;
    log.scrollTop = log.scrollHeight;
    if (j.running) return;
    clearInterval(pollTimer);
    btn.disabled = false;
    btn.textContent = t('Publicar de novo');
    if (j.ok) {
      state = await setupApi('state');
      render();
      renderStatus();
      const logEl = $('cf-log');
      logEl.classList.remove('hidden');
      logEl.textContent = j.log;
    }
  }, 1500);
}
