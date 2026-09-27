# Estudar

PWA de estudo focado: plano semanal por utilizador, timer de blocos (40+10), modo foco em ecrã inteiro, progresso por disciplina e sincronização entre telemóvel e computador. O plano semanal pode ser gerado por IA a partir das tuas disciplinas, seguindo técnicas de estudo com evidência científica.

- Sem build: HTML, CSS e JavaScript (ES modules). Aloja em qualquer serviço de ficheiros estáticos.
- Backend: [Supabase](https://supabase.com) (auth por email, base de dados Postgres com RLS, realtime e uma Edge Function para a IA). O nível gratuito chega.
- IA configurável: Gemini (por defeito, tem nível gratuito), Claude, ou qualquer API compatível com OpenAI (OpenAI, OpenRouter, Groq…).
- Sem Supabase configurado, a app corre em **modo local** (dados só no browser, sem IA). Útil para experimentar.

## Instalar a tua própria cópia

### 1. Supabase

1. Cria um projeto em [supabase.com](https://supabase.com).
2. Cria as tabelas e regras de acesso. Escolhe uma opção:
   - **CLI:** `supabase link --project-ref <ref-do-projeto>` e depois `supabase db push`
   - **Manual:** cola o conteúdo de [`supabase/migrations/20260927000000_init.sql`](supabase/migrations/20260927000000_init.sql) no *SQL Editor* e corre.
3. **Authentication → URL Configuration**
   - *Site URL*: o domínio onde vais alojar a app (ex. `https://estudar.pages.dev`)
   - *Redirect URLs*: esse domínio e `http://localhost:8080` (para desenvolvimento)
4. **Authentication → Emails → Magic Link**: acrescenta `{{ .Token }}` ao template, para o email trazer o código de 6 dígitos. Numa PWA instalada, o link abre no browser e não na app, por isso o código é a forma mais fiável de entrar.
5. **Email para outras pessoas:** o servidor de email incluído no Supabase só envia para membros da equipa do projeto e tem limites baixos. Se outras pessoas vão usar a tua instalação, configura um SMTP próprio em **Authentication → Emails → SMTP Settings** (ex. [Resend](https://resend.com), com nível gratuito).
6. *(Opcional)* **Instalação privada:** desliga *Allow new users to sign up* em **Authentication → Sign In / Providers** e convida as pessoas em **Authentication → Users**.
7. *(Opcional)* **Login com Google:** ativa o provider em **Authentication → Providers** (precisa de um OAuth client na Google Cloud) e põe `google: true` em `js/config.js`.

### 2. Configurar a app

Em [`js/config.js`](js/config.js), preenche com os valores de **Project Settings → API**:

```js
export const SUPABASE_URL = 'https://<ref>.supabase.co';
export const SUPABASE_ANON_KEY = '<anon / publishable key>';
```

A chave *anon/publishable* é pública por natureza: quem protege os dados de cada utilizador são as regras RLS da migração. **Nunca** coloques a *service role key* no frontend.

### 3. IA para gerar planos

```bash
supabase secrets set AI_PROVIDER=gemini AI_API_KEY=<a-tua-chave>
supabase functions deploy generate-plan
```

| `AI_PROVIDER` | Chave | Modelo por defeito (`AI_MODEL`) |
|---|---|---|
| `gemini` | [Google AI Studio](https://aistudio.google.com/apikey) (tem nível gratuito) | `gemini-2.5-flash` |
| `anthropic` | [Claude Console](https://platform.claude.com) | `claude-opus-5` |
| `openai` | OpenAI ou qualquer API compatível; define `AI_BASE_URL` para outros (ex. `https://openrouter.ai/api/v1`) | obrigatório definir `AI_MODEL` |

Outras variáveis: `AI_MODEL` (substitui o modelo), `MAX_PLANS_PER_DAY` (limite por utilizador, por defeito 10). A chave da IA fica apenas no servidor; a função só responde a utilizadores com sessão iniciada e conta os usos por dia.

### 4. Alojar

Qualquer alojamento estático serve. No **Cloudflare Pages**: liga o repositório, *Framework preset* `None`, *Build command* vazio e *Build output directory* `/`. GitHub Pages e Netlify também funcionam.

Para desenvolver localmente:

```bash
python -m http.server 8080
```

## Como o plano é construído (e porquê)

A IA recebe as tuas disciplinas (tipo e carga), datas e horas por dia, e tem de seguir estes princípios:

| Princípio | Evidência | Como aparece no plano |
|---|---|---|
| Prática de recuperação | Roediger & Karpicke (2006); Dunlosky et al. (2013): utilidade **alta** | Cada sessão tem uma atividade ativa (exercícios, responder sem apontamentos) e há uma sessão semanal de recuperação acumulada |
| Prática distribuída (espaçamento) | Cepeda et al. (2006, 2008); Dunlosky et al. (2013): utilidade **alta** | Disciplinas médias e pesadas em pelo menos 2 dias não consecutivos, com revisões curtas 1 a 3 dias depois |
| Intercalação | Rohrer & Taylor (2007); Brunmair & Richter (2019) | Exercícios mistos; sessão principal + revisão de outra disciplina no mesmo dia |
| Evitar técnicas de baixa utilidade | Dunlosky et al. (2013): reler, sublinhar e resumir têm utilidade **baixa** | Não são propostas como atividade principal |
| Treino em condições de exame | Morris, Bransford & Franks (1977) | Fases que passam de aprender → exercícios → simulações |
| Carga sustentável e sono | Consolidação da memória durante o sono (Diekelmann & Born, 2010) | O plano respeita as horas que indicas |

A IA pode errar, por isso a app não confia cegamente no resultado: o editor corre uma **verificação** determinística (carga por dia, espaçamento, presença de recuperação, técnicas passivas, frequência das línguas) e mostra avisos antes de guardares. A evidência apoia os princípios; cada plano concreto continua a merecer o teu ajuste.

## Estrutura

```
index.html           UI (tabs, modo foco, editor de plano)
css/app.css          estilos
js/app.js            controlador da UI
js/planner.js        editor de plano + verificação científica
js/data.js           plano de exemplo, normalização, helpers de datas
js/storage.js        dados locais + Supabase (auth, sync, realtime, IA)
js/timer.js          timer baseado em relógio (sobrevive a background/fecho)
js/config.js         a tua configuração do Supabase
sw.js                service worker (offline)
supabase/            migração SQL e Edge Function generate-plan
```
