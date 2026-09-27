# Estudar

PWA de estudo focado: plano semanal por utilizador, timer de blocos (40+10), modo foco em ecrã inteiro, progresso por disciplina e sincronização entre telemóvel e computador. O plano semanal pode ser gerado por IA a partir das tuas disciplinas, seguindo técnicas de estudo com evidência científica.

- **Tudo configurável dentro da app:** chaves, criação das tabelas e publicação no Cloudflare são feitas no ecrã **Conta → Servidor e chaves**, com um painel de estado (ponto verde / vermelho) para cada serviço.
- **Corre onde quiseres:** no teu computador (`npm start`) ou publicada num Cloudflare Worker gratuito, acessível de qualquer lado.
- **Backend:** [Supabase](https://supabase.com) para contas (login por código no email), dados e sincronização em tempo real. O nível gratuito chega.
- **IA configurável:** Gemini (por defeito, tem nível gratuito), Claude, ou qualquer API compatível com OpenAI (OpenAI, OpenRouter, Groq…).

## Começar (5 minutos)

Precisas do [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
git clone https://github.com/<tu>/estudar.git
cd estudar
npm install
npm start
```

O browser abre em `http://localhost:8787`. Na app, vai a **Conta → Servidor e chaves** (ou carrega em **Ligar servidor** no ecrã inicial) e segue os passos:

1. **Supabase:** cria um projeto grátis em [supabase.com](https://supabase.com/dashboard/new) e cola o *Project URL* e a chave pública (*publishable/anon*). Para criar as tabelas e configurar o email de login automaticamente, cola também um [token pessoal](https://supabase.com/dashboard/account/tokens) (`sbp_…`, usado só nesse momento e nunca guardado). Se preferires, o ecrã deixa copiar o SQL para o colares no *SQL Editor*.
2. **IA:** escolhe o fornecedor e cola a chave. Para o Gemini, cria-a em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. **Testar → Guardar.** O painel de estado mostra se cada serviço responde.
4. **Onde a app corre:**
   - **Neste computador:** já está a funcionar, enquanto o `npm start` estiver aberto.
   - **Cloudflare:** carrega em **Ligar conta Cloudflare** (abre o browser para autorizares) e depois em **Publicar no Cloudflare**. A app fica em `https://estudar.<a-tua-conta>.workers.dev`, com as chaves guardadas como segredos do Worker. Instala-a no telemóvel a partir desse endereço.

Para mudar chaves mais tarde, repete: `npm start` → Servidor e chaves → Guardar → Publicar de novo.

### Painel de estado

| Ponto | O que verifica |
|---|---|
| App | O servidor está a responder (local ou Cloudflare) |
| Supabase | O projeto responde e a chave pública é válida |
| Base de dados | As tabelas existem |
| IA | A chave e o modelo são válidos (consulta os metadados do modelo, sem gastar tokens) |
| Limite de uso | Se há chave secreta do Supabase para limitar gerações por pessoa por dia |
| Cloudflare | Se a app está publicada e o endereço público responde |

### Notas

- **Onde ficam as chaves:** localmente em `.dev.vars` (ignorado pelo git); no Cloudflare como *secrets* do Worker. Só a URL e a chave pública do Supabase chegam ao browser; as regras RLS da base de dados protegem os dados de cada utilizador. Os ecrãs de configuração só existem no `npm start` e só aceitam pedidos da própria app em `localhost`.
- **Email para outras pessoas:** o servidor de email incluído no Supabase só envia para membros da equipa do projeto e tem limites baixos. Se outras pessoas vão usar a tua instalação, configura um SMTP próprio em **Authentication → Emails → SMTP Settings** (ex. [Resend](https://resend.com), com nível gratuito).
- **Instalação privada:** desliga *Allow new users to sign up* no Supabase e convida as pessoas em **Authentication → Users**.
- **Login com Google (opcional):** ativa o provider no Supabase (precisa de um OAuth client na Google Cloud) e liga o interruptor no ecrã.
- **Sem servidor:** se alojares só a pasta `public/` (ex. GitHub Pages), a app funciona em modo local: dados só no browser, sem conta nem IA.
- **Linha de comandos:** `npm run deploy` publica sem passar pela app. Os segredos podem ser definidos com `npx wrangler secret put NOME`.

| Variável | Para quê |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Projeto Supabase (públicos) |
| `SUPABASE_SERVICE_KEY` | Opcional: ativa o limite diário de gerações por pessoa |
| `AI_PROVIDER` | `gemini` (padrão), `anthropic` ou `openai` |
| `AI_API_KEY` | Chave do fornecedor de IA |
| `AI_MODEL` | Opcional; padrão `gemini-2.5-flash` / `claude-opus-5`; obrigatório para `openai` |
| `AI_BASE_URL` | Opcional, para APIs compatíveis com OpenAI (ex. `https://openrouter.ai/api/v1`) |
| `MAX_PLANS_PER_DAY` | Limite por pessoa (padrão 10) |
| `AUTH_GOOGLE` | `true` para mostrar o login com Google |

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
public/                 a app (é a única pasta publicada como ficheiros estáticos)
  index.html, css/, icons/, sw.js, manifest.json
  js/app.js             controlador da UI
  js/planner.js         editor de plano + verificação científica
  js/setup.js           ecrã "Servidor e chaves" + painel de estado
  js/storage.js         dados locais + Supabase (auth, sync, realtime)
  js/data.js            plano de exemplo, normalização, datas
  js/timer.js           timer baseado em relógio (sobrevive a background/fecho)
worker/api.js           API partilhada: /api/config, /api/health, /api/generate-plan
worker/index.js         entrada do Cloudflare Worker (API + ficheiros de public/)
setup/server.mjs        npm start: app local + rotas de configuração e publicação
supabase/migrations/    SQL das tabelas e regras de acesso (RLS)
wrangler.jsonc          configuração do Worker
```
