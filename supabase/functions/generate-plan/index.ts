// Generates a weekly study plan from the user's subjects using an LLM.
// Provider is chosen by env so each deployment can use whatever key it has:
//   AI_PROVIDER = gemini (default) | anthropic | openai
//   AI_API_KEY  = key for that provider
//   AI_MODEL    = optional override (required for openai)
//   AI_BASE_URL = optional, openai-compatible endpoint (OpenRouter, Groq, ...)
//   MAX_PLANS_PER_DAY = optional, default 10
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ── Evidence base ─────────────────────────────────────────────
// The principles below are the ones with the strongest support in the learning-science
// literature (Dunlosky et al., 2013 rate practice testing and distributed practice as
// "high utility"; rereading/highlighting/summarising as "low").
const SYSTEM_PROMPT = `És um planeador de estudo que aplica ciência da aprendizagem com evidência robusta. Constróis o plano SEMANAL recorrente de um estudante a partir das disciplinas, datas e horas disponíveis que ele indica.

Princípios obrigatórios (e a razão de cada um):
1. Prática de recuperação (testing effect — Roediger & Karpicke, 2006; Dunlosky et al., 2013: utilidade alta). Cada sessão deve ter um foco ativo: resolver exercícios, responder a perguntas sem apontamentos, explicar de memória, flashcards. Nunca proponhas "reler", "sublinhar" ou "resumir" como atividade principal (utilidade baixa segundo Dunlosky et al., 2013).
2. Prática distribuída / espaçamento (Cepeda et al., 2006; 2008). Cada disciplina de carga média ou alta aparece em pelo menos 2 dias NÃO consecutivos por semana. Depois de uma sessão principal, agenda uma revisão curta (15–30 min) 1 a 3 dias depois, noutro dia.
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
- "focus": a atividade concreta e ativa (ex.: "Exercícios mistos de ponteiros e listas sem consultar", "Rever FP de memória (20 min)").
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
function stripAdditional(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripAdditional);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) if (k !== 'additionalProperties') out[k] = stripAdditional(v);
    return out;
  }
  return schema;
}

// ── Input validation ──────────────────────────────────────────
type Input = {
  startDate: string;
  examDate: string;
  hoursPerDay: number[];
  subjects: { id: string; name: string; short: string; load: string; area: string }[];
  notes: string;
};

const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

function validate(body: any): Input {
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
    hoursPerDay: body.hoursPerDay.map((h: unknown) => Math.max(0, Math.min(16, Number(h) || 0))),
    subjects: subjects.map((s: any) => ({
      id: String(s.id).slice(0, 12),
      name: String(s.name).slice(0, 80),
      short: String(s.short).slice(0, 5),
      load: ['leve', 'media', 'alta'].includes(s.load) ? s.load : 'media',
      area: ['uni', 'lingua', 'outro'].includes(s.area) ? s.area : 'uni',
    })),
    notes: String(body.notes || '').slice(0, 1000),
  };
}

function userPrompt(input: Input) {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const loadName: Record<string, string> = { leve: 'leve', media: 'média', alta: 'alta' };
  const areaName: Record<string, string> = { uni: 'disciplina académica', lingua: 'língua', outro: 'outro' };
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

// ── Providers ─────────────────────────────────────────────────
async function callGemini(input: Input, key: string, model: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: stripAdditional(PLAN_SCHEMA) },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message || res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
  if (!text) throw new Error('Gemini não devolveu um plano.');
  return JSON.parse(text);
}

async function callAnthropic(input: Input, key: string, model: string) {
  const client = new Anthropic({ apiKey: key });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // Server-side fallback: if the model declines, the API retries on a suitable model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(input) }],
    output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
  } as any);
  if (response.stop_reason === 'refusal') throw new Error('O modelo recusou gerar este plano.');
  if (response.stop_reason === 'max_tokens') throw new Error('A resposta ficou incompleta. Tenta com menos disciplinas.');
  const text = response.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text);
}

async function callOpenAICompatible(input: Input, key: string, model: string, baseUrl: string) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(input) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'study_plan', strict: true, schema: PLAN_SCHEMA } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`IA: ${data?.error?.message || res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('A IA não devolveu um plano.');
  return JSON.parse(text);
}

async function generate(input: Input) {
  const provider = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();
  const key = Deno.env.get('AI_API_KEY');
  if (!key) throw new Error('AI_API_KEY não está configurada no servidor.');
  const model = Deno.env.get('AI_MODEL');
  switch (provider) {
    case 'gemini':
      return callGemini(input, key, model || 'gemini-2.5-flash');
    case 'anthropic':
      return callAnthropic(input, key, model || 'claude-opus-5');
    case 'openai':
      if (!model) throw new Error('Define AI_MODEL para o fornecedor openai.');
      return callOpenAICompatible(input, key, model, Deno.env.get('AI_BASE_URL') || 'https://api.openai.com/v1');
    default:
      throw new Error(`AI_PROVIDER desconhecido: ${provider}`);
  }
}

// ── Handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Sessão inválida. Volta a entrar.' }, 401);

    const input = validate(await req.json());

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const day = new Date().toISOString().slice(0, 10);
    const limit = Number(Deno.env.get('MAX_PLANS_PER_DAY') || '10');
    const { data: usage } = await admin.from('ai_usage').select('count').eq('user_id', user.id).eq('day', day).maybeSingle();
    const used = usage?.count ?? 0;
    if (used >= limit) return json({ error: `Atingiste o limite de ${limit} planos gerados hoje. Tenta amanhã.` }, 429);

    const plan = await generate(input);
    await admin.from('ai_usage').upsert({ user_id: user.id, day, count: used + 1 });

    return json({ plan, remaining: limit - used - 1 });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 400);
  }
});
