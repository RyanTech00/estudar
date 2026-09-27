# Arquitetura

O Estudar é uma **PWA sem build** servida por um **Cloudflare Worker**, com o **Supabase** para contas e dados e um **fornecedor de IA** à escolha. Tudo corre nos níveis gratuitos.

![Arquitetura do Estudar](/architecture.svg)

## Componentes

| Componente | Onde | Responsabilidade |
|---|---|---|
| **PWA** | `public/` | Interface, regras de aprendizagem, cópia local dos dados, offline |
| **Worker** | `worker/index.js` | Serve `public/` como ficheiros estáticos e encaminha `/api/*` |
| **API partilhada** | `worker/api.js` | `/api/config`, `/api/health`, `/api/generate-plan`, `/api/import-curriculum` |
| **Servidor local** | `setup/server.mjs` | `npm start`: a mesma API + `/api/setup/*` para configurar e publicar |
| **Supabase** | `supabase/migrations/` | Auth (código por email, Google opcional), `user_data`, `ai_usage`, Realtime |
| **IA** | configurável | Gerar o plano; ler o plano de estudos por foto |

## Decisões

**Sem build.** HTML, CSS e ES modules servidos tal como estão. Menos peças para quem faz fork, e qualquer alojamento estático serve a `public/`.

**Uma API, dois runtimes.** `worker/api.js` só usa APIs web (`fetch`, `Request`, `Response`), por isso corre no Worker e no Node do `npm start` sem alterações. O que funciona localmente funciona publicado.

**Configuração pelo servidor, não pelo código.** A app pede `/api/config` ao arrancar; ninguém edita ficheiros para ligar o seu Supabase. Sem API (alojamento estático), a app entra em modo local.

**Chaves só no servidor.** A chave da IA e a chave secreta do Supabase vivem como segredos do Worker. O browser só recebe a chave pública do Supabase, protegida pela RLS.

**Um documento por utilizador.** Os dados de cada pessoa são um JSON numa linha do Postgres. Simples de sincronizar, de exportar e de raciocinar sobre; as regras de junção estão em [Modelo de dados](/arquitetura/dados).

**Regras puras e testadas.** A lógica que decide o que conta como aprendizagem (`learning.js`) e as regras académicas (`curriculum.js`) não tocam no DOM nem no armazenamento, por isso têm testes unitários — ver [Testes](/arquitetura/testes).

**A IA é não confiável.** Toda a resposta da IA é limpa e validada no servidor e no cliente, e revista pelo utilizador antes de ser guardada. O plano gerado passa sempre pela verificação científica.

## Estrutura do repositório

```
public/                  a app — a única pasta publicada como ficheiros estáticos
  index.html  css/  icons/  manifest.json  sw.js
  js/app.js              controlador da interface
  js/learning.js         regras de aprendizagem (domínio, calibração, distribuição, datas)
  js/curriculum.js       regras do percurso (médias, provas, épocas, pré-requisitos)
  js/planner.js          editor do plano + verificação científica
  js/logsheet.js         registo do bloco, testes de controlo, nota de exame
  js/percurso.js         percurso: importação por foto, editor de UCs, relatório
  js/setup.js            ecrã Servidor e chaves + painel de estado
  js/storage.js          dados locais + Supabase (auth, sync, realtime)
  js/data.js             plano de exemplo, normalização, datas
  js/timer.js            timer pelo relógio (sobrevive a segundo plano e fecho)
  js/focus.js            ecrã inteiro, wake lock, sons
worker/
  index.js               entrada do Worker
  api.js                 API partilhada
setup/server.mjs         npm start
supabase/migrations/     SQL das tabelas e das regras de acesso
tests/                   testes das regras (npm test)
docs/                    este site (VitePress) e o gerador de capturas
wrangler.jsonc           configuração do Worker
```

## Fluxos principais

### Arranque

1. A PWA carrega de `public/` (ou da cache, offline).
2. Pede `/api/config`. Se houver Supabase configurado, carrega o SDK e recupera a sessão local; senão, modo local.
3. Com sessão: junta a cópia local com a linha `user_data` e subscreve alterações em tempo real.

### Gerar um plano

1. O editor calcula a distribuição sugerida e as bases fracas.
2. `POST /api/generate-plan` com o token da sessão.
3. O Worker confirma a sessão no Supabase, verifica o limite diário e chama a IA com o prompt científico e um esquema JSON.
4. A resposta é validada, normalizada e passa pela verificação científica no editor. O utilizador guarda.

### Publicar

1. `npm start` → **Publicar**: `wrangler deploy` envia o Worker e `public/`.
2. `wrangler secret bulk` envia as chaves (de um ficheiro temporário apagado logo a seguir).
3. O URL publicado fica em `.deploy.json`; o ponto **Cloudflare** passa a verificar `<url>/api/health`.
