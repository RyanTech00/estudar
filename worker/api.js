// Shared API: runs inside the Cloudflare Worker and inside the local Node server (setup/server.mjs).
// Only web-standard APIs (fetch, Request, Response) so both runtimes behave the same.
//
// Environment (Worker secrets in production, .dev.vars locally):
//   SUPABASE_URL, SUPABASE_ANON_KEY           public, handed to the browser
//   SUPABASE_SERVICE_KEY                      optional, enables the per-user daily AI limit
//   AI_PROVIDER  gemini | anthropic | openai  (default gemini)
//   AI_API_KEY, AI_MODEL, AI_BASE_URL, MAX_PLANS_PER_DAY
//   AUTH_GOOGLE  "true" to show Google sign-in

import { tr, langFrom } from './i18n.js';
import { isOwner, normalizeEmail } from '../public/js/roles.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', anthropic: 'claude-opus-5' };

export function readEnv(env) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  return {
    runtime: env.RUNTIME || 'cloudflare',
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/$/, ''),
    anonKey: env.SUPABASE_ANON_KEY || '',
    serviceKey: env.SUPABASE_SERVICE_KEY || '',
    provider,
    aiKey: env.AI_API_KEY || '',
    model: env.AI_MODEL || DEFAULT_MODELS[provider] || '',
    baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    maxPerDay: Number.isFinite(Number(env.MAX_PLANS_PER_DAY)) && env.MAX_PLANS_PER_DAY !== '' && env.MAX_PLANS_PER_DAY !== undefined ? Math.max(0, Math.floor(Number(env.MAX_PLANS_PER_DAY))) : 10,
    authGoogle: env.AUTH_GOOGLE === 'true',
    ownerEmail: normalizeEmail(env.OWNER_EMAIL),
    ownerId: String(env.OWNER_ID || '').trim(),
    setup: env.SETUP === '1',
  };
}

// Which kind of Supabase key this is: 'public' (publishable/anon), 'secret' (secret/service_role) or 'unknown'.
// New keys say it in the prefix; legacy keys are JWTs with a `role` claim.
export function keyKind(key = '') {
  if (!key) return '';
  if (key.startsWith('sb_secret_')) return 'secret';
  if (key.startsWith('sb_publishable_')) return 'public';
  if (key.startsWith('eyJ')) {
    try {
      const role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
      return role === 'service_role' ? 'secret' : role === 'anon' ? 'public' : 'unknown';
    } catch { return 'unknown'; }
  }
  return 'unknown';
}

// New Supabase keys (sb_publishable_/sb_secret_) go in `apikey` only; legacy JWT keys also as Bearer.
const supabaseHeaders = (key) => ({ apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) });

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const cfg = readEnv(env);
  cfg.lang = langFrom(request.headers.get('X-Estudar-Lang') || url.searchParams.get('lang'));
  try {
    if (url.pathname === '/api/config' && request.method === 'GET') return json(publicConfig(cfg));
    if (url.pathname === '/api/me' && request.method === 'GET') return await meRoute(request, cfg);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      // Published: the status panel is the owner's business only (any signed-in user on installs with no
      // owner set). It is never open to the internet: each check calls Supabase and the AI provider.
      // Local (npx estudar) answers only this computer.
      if (cfg.runtime !== 'local' && !isOwner(cfg, await getUser(request, cfg))) {
        return json({ error: tr(cfg.lang, 'Só o dono desta instalação vê o estado do servidor.') }, 403);
      }
      return json(await cachedHealth(cfg));
    }
    if (url.pathname === '/api/generate-plan' && request.method === 'POST') return await generatePlanRoute(request, cfg);
    if (url.pathname === '/api/import-curriculum' && request.method === 'POST') return await importCurriculumRoute(request, cfg);
    return json({ error: tr(cfg.lang, 'Não encontrado.') }, 404);
  } catch (e) {
    // Details stay in the logs; the client only ever gets a known, translated message.
    console.error(e);
    return json({ error: tr(cfg.lang, 'Erro inesperado.') }, 500);
  }
}

function publicConfig(cfg) {
  return {
    configured: !!(cfg.supabaseUrl && cfg.anonKey) && keyKind(cfg.anonKey) !== 'secret',
    supabaseUrl: cfg.supabaseUrl,
    supabaseAnonKey: keyKind(cfg.anonKey) === 'secret' ? '' : cfg.anonKey,
    auth: { email: true, google: cfg.authGoogle },
    ai: !!cfg.aiKey,
    runtime: cfg.runtime,
    setup: cfg.setup,
  };
}

// ── Health ────────────────────────────────────────────────────
const timeout = (ms) => AbortSignal.timeout(ms);

// One check per minute per isolate is plenty for a status panel, and keeps it from being used to hammer the providers.
const healthCache = new Map();
async function cachedHealth(cfg) {
  if (cfg.runtime === 'local') return health(cfg);
  const key = cfg.lang;
  const hit = healthCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.value;
  const value = await health(cfg);
  healthCache.set(key, { at: Date.now(), value });
  return value;
}

export async function health(cfg) {
  const [supabase, database, ai, signups] = await Promise.all([checkSupabase(cfg), checkDatabase(cfg), checkAi(cfg), checkSignups(cfg)]);
  return {
    app: { ok: true, runtime: cfg.runtime, message: cfg.runtime === 'local' ? tr(cfg.lang, 'A correr neste computador') : tr(cfg.lang, 'A correr no Cloudflare') },
    supabase,
    database,
    ai,
    limit: keyKind(cfg.serviceKey) === 'public'
      ? { ok: false, message: tr(cfg.lang, 'A chave secreta guardada é a pública: copia a secret em Project Settings → API Keys') }
      : cfg.serviceKey
      ? { ok: true, message: tr(cfg.lang, 'Máximo {n} planos por utilizador por dia', { n: cfg.maxPerDay }) }
      : { ok: null, message: tr(cfg.lang, 'Sem chave secreta do Supabase: gerações ilimitadas') },
    signups,
    checkedAt: new Date().toISOString(),
  };
}

async function checkSupabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) return { ok: null, message: tr(cfg.lang, 'Não configurado') };
  if (keyKind(cfg.anonKey) === 'secret') return { ok: false, message: tr(cfg.lang, 'A chave pública guardada é a secreta: troca-a pela publishable (a secreta nunca pode ir para o browser)') };
  try {
    const r = await fetch(`${cfg.supabaseUrl}/auth/v1/health`, { headers: { apikey: cfg.anonKey }, signal: timeout(8000) });
    if (r.ok) return { ok: true, message: tr(cfg.lang, 'Online') };
    if (r.status === 401 || r.status === 403) return { ok: false, message: tr(cfg.lang, 'Chave pública (anon/publishable) inválida') };
    return { ok: false, message: tr(cfg.lang, 'Respondeu {n}', { n: r.status }) };
  } catch {
    return { ok: false, message: tr(cfg.lang, 'Não foi possível contactar o URL do projeto') };
  }
}

// Open sign-ups let anyone with the app's address create an account and use your AI key and email.
async function checkSignups(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) return { ok: null, message: tr(cfg.lang, 'Não configurado') };
  try {
    const r = await fetch(`${cfg.supabaseUrl}/auth/v1/settings`, { headers: { apikey: cfg.anonKey }, signal: timeout(8000) });
    if (!r.ok) return { ok: null, message: tr(cfg.lang, 'Respondeu {n}', { n: r.status }) };
    return (await r.json()).disable_signup
      ? { ok: true, message: tr(cfg.lang, 'Fechados: só entra quem tem conta') }
      : { ok: false, message: tr(cfg.lang, 'Abertos: qualquer pessoa pode criar conta') };
  } catch {
    return { ok: null, message: tr(cfg.lang, 'Sem resposta') };
  }
}

// Asks PostgREST about each table with the public key and no session. Signed-out visitors have no access to
// anything (see the hardening migration), so "permission denied" (42501) means the table exists and is locked
// down, which is what we want; PGRST205 / 42P01 means it's missing.
async function tableState(cfg, table) {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: cfg.anonKey }, signal: timeout(8000) });
  if (r.ok) return 'open';
  const body = await r.json().catch(() => ({}));
  if (body.code === 'PGRST205' || body.code === '42P01') return 'missing';
  if (body.code === '42501' || r.status === 401 || r.status === 403) return 'locked';
  return `http-${r.status}`;
}

async function checkDatabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) return { ok: null, message: tr(cfg.lang, 'Não configurado') };
  try {
    const [data, viewers] = await Promise.all([tableState(cfg, 'user_data'), tableState(cfg, 'viewers')]);
    if (data === 'missing') return { ok: false, message: tr(cfg.lang, 'Tabelas ainda não criadas') };
    if (viewers === 'missing') return { ok: false, message: tr(cfg.lang, 'Falta atualizar a base de dados: carrega em Configurar (passo 1).') };
    if (data === 'locked' || data === 'open') return { ok: true, message: tr(cfg.lang, 'Tabelas criadas') };
    return { ok: false, message: tr(cfg.lang, 'Respondeu {n}', { n: data.replace('http-', '') }) };
  } catch {
    return { ok: false, message: tr(cfg.lang, 'Sem resposta') };
  }
}

// Uses model-metadata endpoints: confirms the key and model without spending tokens.
async function checkAi(cfg) {
  const label = { gemini: 'Gemini', anthropic: 'Claude', openai: 'OpenAI-compatível' }[cfg.provider] || cfg.provider;
  if (!cfg.aiKey) return { ok: null, message: tr(cfg.lang, 'Sem chave de IA'), provider: label };
  if (!cfg.model) return { ok: false, message: tr(cfg.lang, 'Define o modelo'), provider: label };
  try {
    if (cfg.provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}`, {
        headers: { 'x-goog-api-key': cfg.aiKey }, signal: timeout(8000),
      });
      if (!r.ok) return { ok: false, provider: label, message: r.status === 404 ? tr(cfg.lang, 'Modelo {m} não existe', { m: cfg.model }) : tr(cfg.lang, 'Chave inválida ou sem acesso') };
    } else if (cfg.provider === 'anthropic') {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: cfg.aiKey, timeout: 8000, maxRetries: 0 });
      try {
        await client.models.retrieve(cfg.model);
      } catch (e) {
        const status = e?.status;
        return { ok: false, provider: label, message: status === 404 ? tr(cfg.lang, 'Modelo {m} não existe', { m: cfg.model }) : status === 401 ? tr(cfg.lang, 'Chave inválida') : tr(cfg.lang, 'Sem resposta') };
      }
    } else if (cfg.provider === 'openai') {
      const r = await fetch(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.aiKey}` }, signal: timeout(8000) });
      if (!r.ok) return { ok: false, provider: label, message: r.status === 401 ? tr(cfg.lang, 'Chave inválida') : tr(cfg.lang, 'Respondeu {n}', { n: r.status }) };
    } else {
      return { ok: false, provider: label, message: tr(cfg.lang, 'Fornecedor desconhecido') };
    }
    return { ok: true, provider: label, message: `${label} · ${cfg.model}` };
  } catch {
    return { ok: false, provider: label, message: tr(cfg.lang, 'Sem resposta do fornecedor') };
  }
}

// ── Plan generation ───────────────────────────────────────────
// The principles below are the ones with the strongest support in the learning-science
// literature (Dunlosky et al., 2013 rate practice testing and distributed practice as
// "high utility"; rereading/highlighting/summarising as "low").
const SYSTEM_PROMPT = `És um planeador de estudo que aplica ciência da aprendizagem com evidência robusta. Constróis o plano SEMANAL recorrente de um estudante a partir das disciplinas, datas e horas disponíveis que ele indica.

Princípios obrigatórios (e a razão de cada um):
1. Prática de recuperação (testing effect — Roediger & Karpicke, 2006; Dunlosky et al., 2013: utilidade alta). Cada sessão deve ter um foco ativo: resolver exercícios, responder a perguntas sem apontamentos, explicar de memória, flashcards. Nunca proponhas "reler", "sublinhar" ou "resumir" como atividade principal (utilidade baixa segundo Dunlosky et al., 2013).
2. Prática distribuída / espaçamento (Cepeda et al., 2006; 2008). Cada disciplina de carga média ou alta aparece em pelo menos 2 dias NÃO consecutivos por semana. Depois de uma sessão principal, agenda uma revisão curta (15–30 min) 1 a 3 dias depois, noutro dia; quando a revisão está dentro da sessão de outra disciplina, menciona a sigla (ex.: "Rever SO (20 min)").
3. Intercalação (Rohrer & Taylor, 2007; Brunmair & Richter, 2019). Dentro das sessões de exercícios, mistura tipos de problemas e tópicos em vez de praticar só um tipo em bloco. Num mesmo dia, combina uma sessão principal com uma revisão de outra disciplina.
4. Uma sessão semanal de recuperação acumulada (usa a disciplina "all") para testar matéria de semanas anteriores e corrigir lacunas.
5. Blocos com pausas: sessões expressas em blocos de 40+10 min (ou 25–50 min), com pausa maior após 3–4 blocos. Não excedas as horas disponíveis de cada dia.
6. Sono e carga: não empurres estudo para compensar dias sem horas; se as horas não chegam, reduz primeiro disciplinas leves e línguas para "manutenção" — nunca elimines o espaçamento das disciplinas pesadas.
7. Línguas e competências de memória (vocabulário, etc.): sessões curtas e frequentes (20–40 min, 3–5x por semana) são melhores do que uma sessão longa.
8. Distribuição do tempo: cada disciplina traz uma "fatia sugerida" (%) calculada a partir dos ECTS e do que falta dominar (medido em testes sem consulta). Distribui os minutos de matéria nova e prática aproximadamente segundo essas fatias; revisões curtas de espaçamento não contam para a fatia. Se uma disciplina tem exame próximo, dá-lhe prioridade nessa fase.
9. Pré-requisitos: quando uma disciplina traz "BASE FRACA" (um pré-requisito por fazer, reprovado ou com nota baixa), acrescenta nas primeiras semanas sessões curtas (20–30 min) de recuperação dos tópicos desse pré-requisito de que a disciplina depende, feitas de memória e com exercícios, nunca a reler.
10. Primeira exposição vs. prática: para matéria totalmente nova, a primeira sessão de um tópico pode ser em bloco (aprender o conceito com exemplos); a partir daí, prática mista e recuperação. Ler serve apenas para a primeira exposição.
11. Fases até ao exame: começa com mais aprendizagem nova + recuperação e vai deslocando para exercícios e, nas últimas 1–2 semanas, simulações em condições de exame (transfer-appropriate processing — Morris, Bransford & Franks, 1977).

Regras de saída:
- "day": 0=domingo, 1=segunda, … 6=sábado.
- "subject": o id exato de uma disciplina fornecida, ou "all" para a sessão de recuperação acumulada.
- "session": descrição curta da duração, ex. "3 blocos 40+10", "30 min".
- "minutes": duração total em minutos, incluindo pausas.
- "focus": a atividade concreta e ativa (ex.: "Exercícios mistos de ponteiros e listas sem consultar").
- "phases": 3 a 5 fases entre a data de início e a data dos exames, contíguas e sem sobreposição, datas no formato AAAA-MM-DD. "label" com no máximo 8 caracteres (ex.: "60 / 40").
- "tips": 3 a 6 dicas curtas e específicas para ESTE estudante, cada uma ligada a um dos princípios.
`;

const LANGUAGE_LINE = {
  pt: '- Escreve todo o texto (session, focus, fases, ratio, dicas) em português de Portugal.',
  en: '- Write all text (session, focus, phase names, ratio, tips) in English. Keep the subject ids exactly as given.',
};

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['weeklyPlan', 'phases', 'tips'],
  properties: {
    weeklyPlan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'subject', 'session', 'minutes', 'focus'],
        properties: {
          day: { type: 'integer' },
          subject: { type: 'string' },
          session: { type: 'string' },
          minutes: { type: 'integer' },
          focus: { type: 'string' },
        },
      },
    },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'label', 'start', 'end', 'ratio'],
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          ratio: { type: 'string' },
        },
      },
    },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'text'],
        properties: { title: { type: 'string' }, text: { type: 'string' } },
      },
    },
  },
};

// Gemini's responseSchema is an OpenAPI subset without additionalProperties.
function stripAdditional(schema) {
  if (Array.isArray(schema)) return schema.map(stripAdditional);
  if (schema && typeof schema === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(schema)) if (k !== 'additionalProperties') out[k] = stripAdditional(v);
    return out;
  }
  return schema;
}

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

function validate(body) {
  if (!body || typeof body !== 'object') throw new Error('Pedido inválido.');
  if (!isDate(body.startDate) || !isDate(body.examDate) || body.startDate >= body.examDate) {
    throw new Error('Indica uma data de início anterior à data dos exames.');
  }
  if (!Array.isArray(body.hoursPerDay) || body.hoursPerDay.length !== 7) throw new Error('Indica as horas disponíveis de cada dia.');
  const subjects = Array.isArray(body.subjects) ? body.subjects.filter(s => s && typeof s === 'object').slice(0, 15) : [];
  if (!subjects.length) throw new Error('Adiciona pelo menos uma disciplina.');
  return {
    startDate: body.startDate,
    examDate: body.examDate,
    hoursPerDay: body.hoursPerDay.map(h => Math.max(0, Math.min(16, Number(h) || 0))),
    subjects: subjects.map(s => ({
      id: String(s.id).slice(0, 12),
      name: String(s.name).slice(0, 80),
      short: String(s.short).slice(0, 5),
      load: ['leve', 'media', 'alta'].includes(s.load) ? s.load : 'media',
      area: ['uni', 'lingua', 'outro'].includes(s.area) ? s.area : 'uni',
      ects: Number(s.ects) > 0 ? Math.min(60, Number(s.ects)) : null,
      examDate: isDate(s.examDate) ? s.examDate : null,
      share: Number.isFinite(Number(s.share)) && s.share !== null ? Math.max(0, Math.min(100, Math.round(Number(s.share)))) : null,
      mastery: Number.isFinite(Number(s.mastery)) && s.mastery !== null ? Math.max(0, Math.min(1, Number(s.mastery))) : null,
      prereqWeak: String(s.prereqWeak || '').slice(0, 200),
    })),
    notes: String(body.notes || '').slice(0, 1000),
    lang: body.lang === 'en' ? 'en' : body.lang === 'pt' ? 'pt' : null,
  };
}

function userPrompt(input) {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const loadName = { leve: 'leve', media: 'média', alta: 'alta' };
  const areaName = { uni: 'disciplina académica', lingua: 'língua', outro: 'outro' };
  return [
    `Data de início: ${input.startDate}`,
    `Data dos exames: ${input.examDate}`,
    '',
    'Disciplinas (id — nome — tipo — carga — ECTS — exame — fatia sugerida — domínio medido):',
    ...input.subjects.map(s => [
      `- ${s.id} — ${s.name} — ${areaName[s.area]} — carga ${loadName[s.load]}`,
      s.ects ? `${s.ects} ECTS` : 'ECTS n/d',
      s.examDate ? `exame ${s.examDate}` : `exame na data geral`,
      s.share !== null ? `fatia ${s.share}%` : 'fatia n/d',
      s.mastery !== null ? `domínio ${Math.round(s.mastery * 100)}% em testes sem consulta` : 'ainda sem teste (tratar como matéria por aprender)',
      s.prereqWeak ? `BASE FRACA: ${s.prereqWeak}` : '',
    ].filter(Boolean).join(' — ')),
    '',
    'Horas disponíveis por dia:',
    ...input.hoursPerDay.map((h, i) => `- ${days[i]}: ${h} h`),
    '',
    input.notes ? `Notas do estudante: ${input.notes}` : 'Sem notas adicionais.',
  ].join('\n');
}

// One entry point per provider: system + user text (+ optional image) → JSON matching `schema`.
async function llmJson({ system, text, image, schema, schemaName }, cfg) {
  if (!cfg.aiKey) throw new Error('A IA ainda não está configurada no servidor.');
  if (!cfg.model) throw new Error('Define o modelo de IA na configuração do servidor.');
  if (cfg.provider === 'gemini') return geminiJson({ system, text, image, schema }, cfg);
  if (cfg.provider === 'anthropic') return anthropicJson({ system, text, image, schema }, cfg);
  if (cfg.provider === 'openai') return openaiJson({ system, text, image, schema, schemaName }, cfg);
  throw new Error(`Fornecedor de IA desconhecido: ${cfg.provider}`);
}

async function geminiJson({ system, text, image, schema }, cfg) {
  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
  parts.push({ text });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.aiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: stripAdditional(schema) },
    }),
    signal: timeout(90000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Gemini: ${String(data?.error?.message || r.status).slice(0, 200)}`);
  const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  if (!out) throw new Error('Gemini não devolveu resposta.');
  return JSON.parse(out);
}

async function anthropicJson({ system, text, image, schema }, cfg) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: cfg.aiKey, timeout: 90000, maxRetries: 1 });
  const content = image
    ? [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } }, { type: 'text', text }]
    : text;
  const response = await client.beta.messages.create({
    model: cfg.model,
    max_tokens: 16000,
    // Server-side fallback: if the model declines, the API retries on a suitable model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  if (response.stop_reason === 'refusal') throw new Error('O modelo recusou o pedido.');
  if (response.stop_reason === 'max_tokens') throw new Error('A resposta ficou incompleta.');
  return JSON.parse(response.content.map(b => (b.type === 'text' ? b.text : '')).join(''));
}

async function openaiJson({ system, text, image, schema, schemaName }, cfg) {
  const userContent = image
    ? [{ type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } }, { type: 'text', text }]
    : text;
  const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.aiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      response_format: { type: 'json_schema', json_schema: { name: schemaName || 'result', strict: true, schema } },
    }),
    signal: timeout(90000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`IA: ${String(data?.error?.message || r.status).slice(0, 200)}`);
  const out = data?.choices?.[0]?.message?.content;
  if (!out) throw new Error('A IA não devolveu resposta.');
  return JSON.parse(out);
}

async function getUser(request, cfg) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !cfg.supabaseUrl) return null;
  try {
    const r = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, { headers: { apikey: cfg.anonKey, Authorization: auth }, signal: timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// Takes one slot of today's AI limit in a single database statement (see ai_usage_take in the migrations),
// before the model is called: parallel requests can't all see "0 used", and failed calls still count.
// Returns the new count, or null when the limit is reached. Throws if the database can't be asked.
async function takeUsage(userId, day, cfg) {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/ai_usage_take`, {
    method: 'POST',
    headers: { ...supabaseHeaders(cfg.serviceKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: userId, p_day: day, p_max: cfg.maxPerDay }),
    signal: timeout(8000),
  });
  if (r.status === 404) throw new Error('Falta atualizar a base de dados: carrega em Configurar (passo 1).');
  if (!r.ok) throw new Error('Não foi possível ler o limite de uso (a chave secreta do Supabase está correta?).');
  return await r.json();
}

// Which role the signed-in user has on this install (viewers are resolved by the app from the database).
async function meRoute(request, cfg) {
  const user = await getUser(request, cfg);
  if (!user?.id) return json({ error: tr(cfg.lang, 'Sessão inválida. Volta a entrar.') }, 401);
  return json({ owner: isOwner(cfg, user), ownerConfigured: !!(cfg.ownerId || cfg.ownerEmail) });
}

const MAX_BODY = 8 * 1024 * 1024;  // a 5 MB photo, base64-encoded

// Every AI route, in this order: body size → signed-in owner → parse and validate the input → take a slot
// of the daily limit → call the model. Nobody else gets as far as parsing a body or spending the AI key.
async function withAiQuota(request, cfg, parse, run) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({ error: tr(cfg.lang, 'Pedido demasiado grande.') }, 413);
  const user = await getUser(request, cfg);
  if (!user?.id) return json({ error: tr(cfg.lang, 'Sessão inválida. Volta a entrar.') }, 401);
  if (!isOwner(cfg, user)) return json({ error: tr(cfg.lang, 'Só o dono desta instalação pode usar a IA.') }, 403);

  let input;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: tr(cfg.lang, 'Pedido demasiado grande.') }, 413);
    input = parse(JSON.parse(text));
  } catch (e) {
    return json({ error: tr(cfg.lang, e instanceof SyntaxError || !e.message ? 'Pedido inválido.' : e.message) }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  let used = null;
  if (cfg.serviceKey) {
    try {
      used = await takeUsage(user.id, day, cfg);
    } catch (e) {
      console.error(e);
      return json({ error: tr(cfg.lang, e.message) }, 503);
    }
    if (used === null) return json({ error: tr(cfg.lang, 'Atingiste o limite de {n} pedidos à IA hoje. Tenta amanhã.', { n: cfg.maxPerDay }) }, 429);
  }
  try {
    const result = await run(input);
    return json({ ...result, remaining: used === null ? null : cfg.maxPerDay - used });
  } catch (e) {
    console.error(e);
    // Owner-only: the provider's reason helps fix a wrong key or model. Unknown errors stay generic.
    const known = e?.message && (/^(Gemini|IA): /.test(e.message) || tr('en', e.message) !== e.message);
    return json({ error: known ? tr(cfg.lang, e.message) : tr(cfg.lang, 'A IA falhou.') }, 502);
  }
}

// The model's plan is untrusted input too (it may have read a hostile photo or ignored the schema):
// keep only the expected fields, with the expected types and sizes, before it reaches anyone's screen.
const str = (v, max) => String(v ?? '').trim().slice(0, max);
function cleanPlan(raw, input) {
  const ids = new Set([...input.subjects.map(s => s.id), 'all']);
  const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const list = (v, max) => (Array.isArray(v) ? v.filter(obj).slice(0, max) : []);
  return {
    weeklyPlan: list(raw?.weeklyPlan, 60)
      .filter(s => Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 && ids.has(String(s.subject)))
      .map(s => ({
        day: s.day,
        subject: String(s.subject),
        session: str(s.session, 120),
        minutes: Math.max(0, Math.min(960, Math.round(Number(s.minutes) || 0))),
        focus: str(s.focus, 300),
      })),
    phases: list(raw?.phases, 6)
      .filter(p => isDate(p.start) && isDate(p.end))
      .map(p => ({ name: str(p.name, 60), label: str(p.label, 30), start: p.start, end: p.end, ratio: str(p.ratio, 120) })),
    tips: list(raw?.tips, 8).map(tip => ({ title: str(tip.title, 80), text: str(tip.text, 400) })),
  };
}

async function generatePlanRoute(request, cfg) {
  return withAiQuota(request, cfg, validate, async (input) => ({
    plan: cleanPlan(await llmJson({ system: `${SYSTEM_PROMPT}\n${LANGUAGE_LINE[input.lang] || LANGUAGE_LINE[cfg.lang]}`, text: userPrompt(input), schema: PLAN_SCHEMA, schemaName: 'study_plan' }, cfg), input),
  }));
}

// ── Degree record from a photo/screenshot ─────────────────────
const CURRICULUM_PROMPT = `Recebes uma fotografia ou captura de ecrã do plano de estudos / percurso académico de um estudante do ensino superior (normalmente português).
Extrai TODAS as unidades curriculares (UCs) visíveis, exatamente como aparecem. Não inventes nada: se um campo não estiver visível ou legível, deixa-o vazio.
- "year" e "semester": números inteiros do cabeçalho do grupo (ex.: "2º Ano - 1º Semestre" → 2 e 1). 0 se não houver.
- "name": nome completo da UC.
- "ects": número de ECTS.
- "grade": nota final como texto (ex. "17" ou "13.5"); vazio se não tiver nota.
- "date": data da nota no formato AAAA-MM-DD; vazio se não houver.
- "gradeType": tipo de nota (ex. "CC" para creditação/equivalência); vazio se não houver.
- "group": se a UC pertence a um grupo de escolha (ex. "Opção", "Trabalho Final"), o nome do grupo; senão vazio.
- "degree": nome do curso, se aparecer.`;

const CURRICULUM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['degree', 'units'],
  properties: {
    degree: { type: 'string' },
    units: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['year', 'semester', 'name', 'ects', 'grade', 'date', 'gradeType', 'group'],
        properties: {
          year: { type: 'integer' },
          semester: { type: 'integer' },
          name: { type: 'string' },
          ects: { type: 'number' },
          grade: { type: 'string' },
          date: { type: 'string' },
          gradeType: { type: 'string' },
          group: { type: 'string' },
        },
      },
    },
  },
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function parseImageDataUrl(dataUrl) {
  const m = /^data:([a-z/+]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || !IMAGE_TYPES.includes(m[1])) throw new Error('Envia uma imagem JPEG, PNG ou WebP.');
  if (m[2].length * 0.75 > MAX_IMAGE_BYTES) throw new Error('A imagem é demasiado grande (máx. 5 MB).');
  return { mediaType: m[1], data: m[2] };
}

// The model's output is untrusted: keep only well-formed rows.
export function cleanCurriculum(raw) {
  const units = (Array.isArray(raw?.units) ? raw.units : []).slice(0, 80).map(u => {
    const grade = Number(String(u.grade || '').replace(',', '.'));
    return {
      year: Math.max(0, Math.min(10, Math.round(Number(u.year) || 0))),
      semester: Math.max(0, Math.min(4, Math.round(Number(u.semester) || 0))),
      name: String(u.name || '').trim().slice(0, 120),
      ects: Math.max(0, Math.min(60, Number(u.ects) || 0)),
      grade: String(u.grade || '').trim() && grade >= 0 && grade <= 20 ? grade : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(u.date || '') ? u.date : '',
      gradeType: String(u.gradeType || '').trim().slice(0, 10),
      group: String(u.group || '').trim().slice(0, 60),
    };
  }).filter(u => u.name);
  return { degree: String(raw?.degree || '').trim().slice(0, 160), units };
}

async function importCurriculumRoute(request, cfg) {
  return withAiQuota(request, cfg, (body) => parseImageDataUrl(body?.image), async (image) => ({
    result: cleanCurriculum(await llmJson({
      system: CURRICULUM_PROMPT,
      text: 'Extrai as unidades curriculares desta imagem.',
      image,
      schema: CURRICULUM_SCHEMA,
      schemaName: 'curriculum',
    }, cfg)),
  }));
}
