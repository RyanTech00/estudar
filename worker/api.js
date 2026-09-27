// Shared API: runs inside the Cloudflare Worker and inside the local Node server (setup/server.mjs).
// Only web-standard APIs (fetch, Request, Response) so both runtimes behave the same.
//
// Environment (Worker secrets in production, .dev.vars locally):
//   SUPABASE_URL, SUPABASE_ANON_KEY           public, handed to the browser
//   SUPABASE_SERVICE_KEY                      optional, enables the per-user daily AI limit
//   AI_PROVIDER  gemini | anthropic | openai  (default gemini)
//   AI_API_KEY, AI_MODEL, AI_BASE_URL, MAX_PLANS_PER_DAY
//   AUTH_GOOGLE  "true" to show Google sign-in

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
    maxPerDay: Number(env.MAX_PLANS_PER_DAY || 10),
    authGoogle: env.AUTH_GOOGLE === 'true',
    setup: env.SETUP === '1',
  };
}

// New Supabase keys (sb_publishable_/sb_secret_) go in `apikey` only; legacy JWT keys also as Bearer.
const supabaseHeaders = (key) => ({ apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) });

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const cfg = readEnv(env);
  try {
    if (url.pathname === '/api/config' && request.method === 'GET') return json(publicConfig(cfg));
    if (url.pathname === '/api/health' && request.method === 'GET') return json(await health(cfg));
    if (url.pathname === '/api/generate-plan' && request.method === 'POST') return await generatePlanRoute(request, cfg);
    return json({ error: 'Não encontrado.' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500);
  }
}

function publicConfig(cfg) {
  return {
    configured: !!(cfg.supabaseUrl && cfg.anonKey),
    supabaseUrl: cfg.supabaseUrl,
    supabaseAnonKey: cfg.anonKey,
    auth: { email: true, google: cfg.authGoogle },
    ai: !!cfg.aiKey,
    runtime: cfg.runtime,
    setup: cfg.setup,
  };
}

// ── Health ────────────────────────────────────────────────────
const timeout = (ms) => AbortSignal.timeout(ms);

export async function health(cfg) {
  const [supabase, database, ai] = await Promise.all([checkSupabase(cfg), checkDatabase(cfg), checkAi(cfg)]);
  return {
    app: { ok: true, runtime: cfg.runtime, message: cfg.runtime === 'local' ? 'A correr neste computador' : 'A correr no Cloudflare' },
    supabase,
    database,
    ai,
    limit: cfg.serviceKey
      ? { ok: true, message: `Máximo ${cfg.maxPerDay} planos por utilizador por dia` }
      : { ok: null, message: 'Sem chave secreta do Supabase: gerações ilimitadas' },
    checkedAt: new Date().toISOString(),
  };
}

async function checkSupabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) return { ok: null, message: 'Não configurado' };
  try {
    const r = await fetch(`${cfg.supabaseUrl}/auth/v1/health`, { headers: { apikey: cfg.anonKey }, signal: timeout(8000) });
    if (r.ok) return { ok: true, message: 'Online' };
    if (r.status === 401 || r.status === 403) return { ok: false, message: 'Chave pública (anon/publishable) inválida' };
    return { ok: false, message: `Respondeu ${r.status}` };
  } catch {
    return { ok: false, message: 'Não foi possível contactar o URL do projeto' };
  }
}

async function checkDatabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) return { ok: null, message: 'Não configurado' };
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/user_data?select=user_id&limit=1`, { headers: { apikey: cfg.anonKey }, signal: timeout(8000) });
    if (r.ok) return { ok: true, message: 'Tabelas criadas' };
    const body = await r.json().catch(() => ({}));
    if (r.status === 404 || body.code === 'PGRST205' || body.code === '42P01') return { ok: false, message: 'Tabelas ainda não criadas' };
    return { ok: false, message: body.message || `Respondeu ${r.status}` };
  } catch {
    return { ok: false, message: 'Sem resposta' };
  }
}

// Uses model-metadata endpoints: confirms the key and model without spending tokens.
async function checkAi(cfg) {
  const label = { gemini: 'Gemini', anthropic: 'Claude', openai: 'OpenAI-compatível' }[cfg.provider] || cfg.provider;
  if (!cfg.aiKey) return { ok: null, message: 'Sem chave de IA', provider: label };
  if (!cfg.model) return { ok: false, message: 'Define o modelo', provider: label };
  try {
    if (cfg.provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}`, {
        headers: { 'x-goog-api-key': cfg.aiKey }, signal: timeout(8000),
      });
      if (!r.ok) return { ok: false, provider: label, message: r.status === 404 ? `Modelo ${cfg.model} não existe` : 'Chave inválida ou sem acesso' };
    } else if (cfg.provider === 'anthropic') {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: cfg.aiKey, timeout: 8000, maxRetries: 0 });
      try {
        await client.models.retrieve(cfg.model);
      } catch (e) {
        const status = e?.status;
        return { ok: false, provider: label, message: status === 404 ? `Modelo ${cfg.model} não existe` : status === 401 ? 'Chave inválida' : 'Sem resposta' };
      }
    } else if (cfg.provider === 'openai') {
      const r = await fetch(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.aiKey}` }, signal: timeout(8000) });
      if (!r.ok) return { ok: false, provider: label, message: r.status === 401 ? 'Chave inválida' : `Respondeu ${r.status}` };
    } else {
      return { ok: false, provider: label, message: 'Fornecedor desconhecido' };
    }
    return { ok: true, provider: label, message: `${label} · ${cfg.model}` };
  } catch {
    return { ok: false, provider: label, message: 'Sem resposta do fornecedor' };
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
8. Fases até ao exame: começa com mais aprendizagem nova + recuperação e vai deslocando para exercícios e, nas últimas 1–2 semanas, simulações em condições de exame (transfer-appropriate processing — Morris, Bransford & Franks, 1977).

Regras de saída:
- "day": 0=domingo, 1=segunda, … 6=sábado.
- "subject": o id exato de uma disciplina fornecida, ou "all" para a sessão de recuperação acumulada.
- "session": descrição curta da duração, ex. "3 blocos 40+10", "30 min".
- "minutes": duração total em minutos, incluindo pausas.
- "focus": a atividade concreta e ativa (ex.: "Exercícios mistos de ponteiros e listas sem consultar").
- "phases": 3 a 5 fases entre a data de início e a data dos exames, contíguas e sem sobreposição, datas no formato AAAA-MM-DD. "label" com no máximo 8 caracteres (ex.: "60 / 40").
- "tips": 3 a 6 dicas curtas e específicas para ESTE estudante, cada uma ligada a um dos princípios.
- Escreve em português de Portugal.`;

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
  const subjects = Array.isArray(body.subjects) ? body.subjects.slice(0, 15) : [];
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
    })),
    notes: String(body.notes || '').slice(0, 1000),
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
    'Disciplinas (id — nome — tipo — carga):',
    ...input.subjects.map(s => `- ${s.id} — ${s.name} — ${areaName[s.area]} — carga ${loadName[s.load]}`),
    '',
    'Horas disponíveis por dia:',
    ...input.hoursPerDay.map((h, i) => `- ${days[i]}: ${h} h`),
    '',
    input.notes ? `Notas do estudante: ${input.notes}` : 'Sem notas adicionais.',
  ].join('\n');
}

async function callGemini(input, cfg) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.aiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: stripAdditional(PLAN_SCHEMA) },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Gemini: ${data?.error?.message || r.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  if (!text) throw new Error('Gemini não devolveu um plano.');
  return JSON.parse(text);
}

async function callAnthropic(input, cfg) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: cfg.aiKey });
  const response = await client.beta.messages.create({
    model: cfg.model,
    max_tokens: 16000,
    // Server-side fallback: if the model declines, the API retries on a suitable model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(input) }],
    output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
  });
  if (response.stop_reason === 'refusal') throw new Error('O modelo recusou gerar este plano.');
  if (response.stop_reason === 'max_tokens') throw new Error('A resposta ficou incompleta. Tenta com menos disciplinas.');
  const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text);
}

async function callOpenAICompatible(input, cfg) {
  const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.aiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(input) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'study_plan', strict: true, schema: PLAN_SCHEMA } },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`IA: ${data?.error?.message || r.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('A IA não devolveu um plano.');
  return JSON.parse(text);
}

function callProvider(input, cfg) {
  if (!cfg.aiKey) throw new Error('A IA ainda não está configurada no servidor.');
  if (!cfg.model) throw new Error('Define o modelo de IA na configuração do servidor.');
  if (cfg.provider === 'gemini') return callGemini(input, cfg);
  if (cfg.provider === 'anthropic') return callAnthropic(input, cfg);
  if (cfg.provider === 'openai') return callOpenAICompatible(input, cfg);
  throw new Error(`Fornecedor de IA desconhecido: ${cfg.provider}`);
}

async function getUser(request, cfg) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !cfg.supabaseUrl) return null;
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, { headers: { apikey: cfg.anonKey, Authorization: auth } });
  return r.ok ? r.json() : null;
}

async function usageToday(userId, day, cfg) {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${day}&select=count`, { headers: supabaseHeaders(cfg.serviceKey) });
  if (!r.ok) throw new Error('Não foi possível ler o limite de uso (a chave secreta do Supabase está correta?).');
  const rows = await r.json();
  return rows[0]?.count ?? 0;
}

async function recordUsage(userId, day, count, cfg) {
  await fetch(`${cfg.supabaseUrl}/rest/v1/ai_usage`, {
    method: 'POST',
    headers: { ...supabaseHeaders(cfg.serviceKey), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, day, count }),
  });
}

async function generatePlanRoute(request, cfg) {
  const user = await getUser(request, cfg);
  if (!user?.id) return json({ error: 'Sessão inválida. Volta a entrar.' }, 401);

  let input;
  try {
    input = validate(await request.json());
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  let used = 0;
  if (cfg.serviceKey) {
    used = await usageToday(user.id, day, cfg);
    if (used >= cfg.maxPerDay) return json({ error: `Atingiste o limite de ${cfg.maxPerDay} planos gerados hoje. Tenta amanhã.` }, 429);
  }

  try {
    const plan = await callProvider(input, cfg);
    if (cfg.serviceKey) await recordUsage(user.id, day, used + 1, cfg);
    return json({ plan, remaining: cfg.serviceKey ? cfg.maxPerDay - used - 1 : null });
  } catch (e) {
    console.error(e);
    return json({ error: e.message || 'A IA falhou ao gerar o plano.' }, 502);
  }
}
