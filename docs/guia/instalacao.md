# Instalação

Três passos: correr no teu computador, ligar os serviços **dentro da app** e publicar. Não precisas de editar nenhum ficheiro.

## 1. Correr no teu computador

Precisas do [Node.js](https://nodejs.org) 20 ou mais recente. Num terminal:

```bash
npx estudar
```

O `npx` descarrega a versão mais recente e arranca-a; não fica nada instalado globalmente. Se preferires o comando sempre à mão, `npm install -g estudar` e depois só `estudar`.

::: details Preferes uma cópia do repositório?
Para mexer no código ou contribuir:

```bash
git clone https://github.com/RyanTech00/estudar.git
cd estudar
npm install
npm start
```

É o mesmo servidor; a diferença é onde ficam as chaves (ver abaixo).
:::

O browser abre sozinho no endereço que aparece no terminal. Carrega em **Começar** na página de apresentação.

::: tip O link do terminal
O ecrã **Servidor e chaves** só abre pelo link que o terminal mostra (`http://localhost:8787/#setup=…`): tem uma chave que muda a cada arranque e protege as tuas chaves de outros programas. Se fechares o separador, copia o link de novo do terminal.
:::

Sem mais nada, a app já funciona em **modo local**: plano, timer, foco, registos e percurso, com os dados guardados só neste browser. Para teres conta, sincronização e IA, continua.

A app abre na língua do browser (português ou inglês). Para mudar, vai a **Conta → Idioma**.

::: tip Porta ocupada?
Se a 8787 estiver em uso, o servidor experimenta a seguinte (8788, 8789…) e mostra o endereço no terminal. Também podes escolher: `npx estudar --port 9000`.
:::

## 2. Ligar o Supabase e a IA

Na app, abre **Conta** (o círculo no canto superior direito) → **Servidor e chaves**. O ecrã tem quatro passos numerados.

<Shot src="/screenshots/servidor-estado.png" alt="Ecrã Servidor e chaves com o estado de cada serviço" caption="O painel de estado: um ponto por serviço. Verde responde, vermelho tem um problema (com a razão), cinzento ainda não está configurado." />

### Supabase — contas e dados

1. Cria um projeto grátis em [supabase.com/dashboard/new](https://supabase.com/dashboard/new).
2. Na página inicial do projeto, o botão **Copy** ao lado do endereço dá o **Project URL** e a **Publishable key**. A chave **secret** (opcional) está em **Project Settings → API Keys**, no separador *Publishable and secret API keys*; as chaves antigas **anon** e **service_role** (separador *Legacy*) também funcionam.
   Se fores usar o modo **Automático** do passo 4, basta colar o **Project URL**: as duas chaves são preenchidas sozinhas.
3. Cola-os no passo 1 do ecrã.
4. Abre **Criar as tabelas e configurar o email de login**:
   - **Automático** — escreve **o teu email**, cria um [token pessoal](https://supabase.com/dashboard/account/tokens) (`sbp_…`), cola-o e carrega em **Configurar**. A app cria as tabelas e as regras de acesso, autoriza os endereços da app, põe o **código de 6 dígitos** no email de login, cria a tua conta e **fecha os registos**: só tu entras (mais pessoas juntas-as no passo 3, *Quem pode entrar*). O token só é usado nesse momento e nunca é guardado.

   ::: warning Projetos Supabase gratuitos criados desde junho de 2026
   Com o email incluído no Supabase não é possível mudar o email de login (fica um link em vez do código) e só se enviam 2 emails por hora. Configura primeiro um SMTP próprio — ver [a pergunta frequente](/guia/faq#diz-que-o-supabase-ja-enviou-o-maximo-de-emails-desta-hora) — e depois carrega em **Configurar**.
   :::
   - **Manual** — **copiar o SQL**, colá-lo no *SQL Editor* do Supabase e correr. Depois, em **Authentication → Emails → Magic Link**, acrescenta <code v-pre>{{ .Token }}</code> ao texto do email.

::: info Para que serve a chave secreta?
Só para o **limite diário** de gerações com IA por pessoa (por defeito 10). Fica apenas no servidor. Sem ela, a app funciona, mas sem limite.
:::

### IA — gerar planos

Escolhe o fornecedor e cola a chave:

| Fornecedor | Onde obter a chave | Modelo por defeito |
|---|---|---|
| **Gemini** (recomendado para começar) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — tem nível gratuito | `gemini-2.5-flash` |
| **Claude** | [Claude Console](https://platform.claude.com) | `claude-opus-5` |
| **OpenAI ou compatível** (OpenRouter, Groq…) | O teu fornecedor | tens de indicar o modelo; para outros serviços, indica o URL da API |

### Testar e guardar

**Testar** verifica cada ligação com os valores escritos (sem guardar) e atualiza os pontos de estado. **Guardar** grava em `.dev.vars` e recarrega a app. Com o `npx estudar`, o ficheiro fica na pasta `.estudar` da tua pasta pessoal (`~/.estudar`); numa cópia do repositório, fica na pasta do projeto (ignorado pelo git).

## 3. Publicar no Cloudflare

No passo 4, **Onde a app corre**, escolhes:

- **Neste computador** — já está a funcionar, enquanto o terminal com o Estudar estiver aberto.
- **Cloudflare — acesso de qualquer lado**:
  1. **Ligar conta Cloudflare** abre o browser para autorizares o Wrangler.
  2. **Publicar no Cloudflare** envia a app para um Worker e as chaves como **segredos** desse Worker. O log aparece no ecrã.
  3. A app fica em `https://estudar.<a-tua-conta>.workers.dev` e o ponto **Cloudflare** fica verde.

<Shot src="/screenshots/servidor-publicar.png" alt="Secção Onde a app corre com a publicação no Cloudflare" caption="Publicar é um botão. Para mudar chaves mais tarde: npx estudar → Servidor e chaves → Guardar → Publicar de novo." />

::: warning Primeira vez no Cloudflare Workers?
Se a tua conta ainda não tiver um subdomínio `workers.dev`, a publicação falha com uma mensagem a explicar. Abre [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**, escolhe um nome e carrega outra vez em **Publicar**.
:::

## 4. Instalar no telemóvel

Abre o endereço publicado no telemóvel e entra com o teu email (recebes um código de 6 dígitos).

- **Android (Chrome)**: menu ⋮ → **Instalar app**.
- **iPhone (Safari)**: Partilhar → **Adicionar ao ecrã principal**.

A app abre em ecrã inteiro, funciona offline e sincroniza quando volta a ter rede.

## Outras pessoas a usar a tua instalação

- **Email**: o servidor de email incluído no Supabase só envia para membros da equipa do projeto e tem limites baixos. Para outras pessoas, configura um SMTP próprio em **Authentication → Emails → SMTP Settings** (por exemplo, [Resend](https://resend.com), com nível gratuito).
- **Instalação privada**: desliga *Allow new users to sign up* e convida as pessoas em **Authentication → Users**.
- **Login com Google**: em breve. Por agora o login é só com o código por email.

## Pela linha de comandos

Se preferires não usar o ecrã:

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put AI_API_KEY
# opcionais: SUPABASE_SERVICE_KEY, AI_PROVIDER, AI_MODEL, AI_BASE_URL, MAX_PLANS_PER_DAY, AUTH_GOOGLE
```

A lista completa de variáveis está em [Servidor e chaves](/guia/configuracao#variaveis).

## Só ficheiros estáticos

A pasta `public/` também funciona sozinha (GitHub Pages, Netlify, `python -m http.server`). Sem a API, a app corre em modo local: sem conta, sem sincronização, sem IA.
