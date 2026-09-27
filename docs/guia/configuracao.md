# Servidor e chaves

O ecrã **Conta → Servidor e chaves** é onde ligas a app aos serviços e vês se tudo está a funcionar. O que mostra depende de onde a app está a correr:

| A app corre em… | O ecrã mostra |
|---|---|
| `npm start` no teu computador | Estado + formulários para as chaves + criação das tabelas + publicação |
| Cloudflare (publicada) | Estado, só leitura — as chaves são segredos do Worker e não podem ser lidas |
| Só ficheiros estáticos | Aviso de modo local e como ligar um servidor |

## O painel de estado

<Shot src="/screenshots/servidor-estado.png" alt="Painel de estado com um ponto por serviço" caption="Verde: responde. Vermelho: há um problema, com a razão ao lado. Cinzento: ainda não configurado." />

| Ponto | O que verifica | Como |
|---|---|---|
| **App** | O servidor responde e onde corre | `GET /api/health` |
| **Supabase** | O projeto responde e a chave pública é aceite | `GET <url>/auth/v1/health` |
| **Base de dados** | As tabelas existem | `GET <url>/rest/v1/user_data?limit=1` |
| **IA** | A chave e o modelo são válidos | Consulta os **metadados do modelo** — não gasta tokens |
| **Limite de uso** | Há chave secreta para limitar gerações por pessoa | Configuração |
| **Cloudflare** | A app está publicada e o endereço responde | `GET <url publicado>/api/health` |

Na folha **Conta** aparece um resumo com três pontos (Supabase, IA, Cloudflare).

<Shot src="/screenshots/conta.png" alt="Folha Conta com o resumo do estado" caption="O resumo na folha Conta." />

## Mensagens comuns

| Mensagem | O que fazer |
|---|---|
| *Chave pública (anon/publishable) inválida* | Volta a copiar a chave **publishable/anon** em Project Settings → API Keys |
| *Tabelas ainda não criadas* | Usa **Configurar** (com token) ou **copiar o SQL** |
| *Modelo X não existe* | Corrige o campo **Modelo** ou deixa-o vazio para usar o padrão |
| *Chave inválida ou sem acesso* | Confirma a chave e se tem acesso à API desse fornecedor |
| *Conta Cloudflare não ligada* | **Ligar conta Cloudflare** e autoriza no browser |
| *Wrangler não está instalado* | Corre `npm install` na pasta do projeto |

## Variáveis

Localmente ficam em `.dev.vars`; no Cloudflare, como segredos do Worker. O ecrã escreve e envia estas por ti.

| Variável | Obrigatória | Para quê |
|---|---|---|
| `SUPABASE_URL` | para conta e sync | URL do projeto (público) |
| `SUPABASE_ANON_KEY` | para conta e sync | Chave **publishable/anon** (pública; as regras RLS protegem os dados) |
| `SUPABASE_SERVICE_KEY` | não | Chave **secret/service_role**; ativa o limite diário da IA. Só no servidor |
| `AI_PROVIDER` | não | `gemini` (padrão), `anthropic` ou `openai` |
| `AI_API_KEY` | para IA | Chave do fornecedor |
| `AI_MODEL` | só para `openai` | Substitui o modelo padrão |
| `AI_BASE_URL` | não | Para APIs compatíveis com OpenAI (ex. `https://openrouter.ai/api/v1`) |
| `MAX_PLANS_PER_DAY` | não | Pedidos à IA por pessoa por dia (padrão 10) |
| `AUTH_GOOGLE` | não | `true` para mostrar o login com Google |

## Segurança do ecrã de configuração

As rotas de configuração (`/api/setup/*`) **só existem no `npm start`**, nunca no Worker publicado. Além disso:

- o servidor local escuta só em `127.0.0.1`;
- as rotas só aceitam pedidos com o `Host` e a `Origin` de `localhost` e com um cabeçalho próprio da app — outro site aberto no teu browser não as consegue usar;
- as chaves secretas nunca voltam inteiras ao browser (aparecem como `••••1234`);
- o token pessoal do Supabase (`sbp_…`) fica só em memória durante a sessão.

Mais em [Privacidade e segurança](/guia/seguranca).
