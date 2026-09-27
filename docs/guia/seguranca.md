# Privacidade e segurança

O Estudar guarda notas, planos e hábitos de estudo — dados pessoais. O desenho parte de uma regra simples: **cada pessoa só vê os seus dados, e as chaves nunca chegam ao browser.**

## Onde ficam os dados

| Onde | O quê |
|---|---|
| **O teu browser** (`localStorage`) | Uma cópia de trabalho de tudo, para a app abrir instantaneamente e funcionar offline |
| **Supabase** (`user_data`) | Uma linha por utilizador com o mesmo documento, para sincronizar dispositivos |
| **Supabase** (`ai_usage`) | Um contador por utilizador e por dia, só se ativares o limite |
| **Fornecedor de IA** | Só o que é preciso para cada pedido (ver abaixo) |

Não há analytics nem telemetria.

## Quem pode entrar

Há três tipos de conta:

| | Vê | Edita | Usa a IA | Vê a configuração |
|---|---|---|---|---|
| **Dono** (o email do **Configurar**) | o seu plano e progresso | sim | sim | sim |
| **Leitor** | o plano e o progresso do dono | não | não | não |
| **Outra conta** (criada com os registos abertos) | nada | não | não | não |

- **Registos fechados.** Ao carregares em **Configurar** com o teu email, a app cria a tua conta de dono e desliga os registos novos no Supabase. Um email desconhecido recebe "Esta instalação não aceita novas contas" e **nenhum email é enviado**. O ponto **Registos** do painel de estado fica vermelho enquanto estiverem abertos.
- **Leitores.** Em **Servidor e chaves → Login → Quem pode entrar** juntas leitores pelo email; entram com o código, como tu, e veem a app em modo **só leitura**: sem timer, sem editar, sem IA, sem configuração.
- **Remover.** O botão **Remover** apaga a linha de leitor e a conta: o acesso acaba logo, mesmo numa sessão aberta, e os teus dados não são tocados.

O que garante isto não é o ecrã, é o servidor:

- a base de dados só deixa o leitor **ler** o documento do dono, e só enquanto existir a linha em `viewers` — que nenhum cliente consegue escrever;
- o Worker só deixa o dono usar a IA e ver o estado do servidor;
- a configuração (chaves, publicar, acessos) só existe no servidor local (`npx estudar`), que só responde a este computador — no endereço publicado essas rotas não existem, nem para o dono.

A app também recusa chaves no campo errado: a chave **secreta** colada no campo público seria enviada a todos os browsers, por isso nem é guardada nem é servida.

## Regras de acesso (RLS)

As duas tabelas têm *Row Level Security* ativa. Em `user_data`, as quatro operações exigem `auth.uid() = user_id`: mesmo com a chave pública, ninguém lê ou escreve a linha de outra pessoa. Em `ai_usage` não há nenhuma regra para clientes — só o servidor, com a chave secreta, lhe acede. O SQL está em [`supabase/migrations`](https://github.com/RyanTech00/estudar/tree/main/supabase/migrations) e explicado em [Modelo de dados](/arquitetura/dados).

## Chaves

| Chave | Onde vive | Chega ao browser? |
|---|---|---|
| Supabase **publishable/anon** | Segredo do Worker; entregue por `/api/config` | Sim — foi feita para isso; a RLS protege os dados |
| Supabase **secret/service_role** | Segredo do Worker (`.dev.vars` localmente) | **Nunca** |
| Chave da **IA** | Segredo do Worker (`.dev.vars` localmente) | **Nunca** |
| Token pessoal do Supabase (`sbp_…`) | Memória do servidor local (`npx estudar`), só durante a sessão | **Nunca** e nunca é gravado |

`.dev.vars` e `.deploy.json` ficam em `~/.estudar` (ou, numa cópia do repositório, na pasta do projeto, onde estão no `.gitignore`). Só a pasta `public/` é publicada como ficheiros estáticos, por isso um ficheiro de segredos na raiz nunca é servido.

## O que a IA vê

| Pedido | Enviado |
|---|---|
| **Gerar plano** | Nomes e siglas das disciplinas, tipo, carga, ECTS, datas de exame, horas por dia, as tuas notas para a IA, a fatia sugerida, o domínio medido e as bases fracas |
| **Ler o plano de estudos** | A imagem que escolheste (reduzida para ~1800 px) |

A IA **nunca** recebe o teu email, os teus registos de estudo, exercícios ou respostas. O que ela devolve é tratado como não confiável: é limpo e validado (datas, notas entre 0 e 20, disciplinas existentes) antes de chegar ao ecrã, e tu confirmas antes de guardar.

Cada pedido exige uma sessão válida (o servidor confirma o token no Supabase) e conta para o limite diário, se estiver ativo.

## Dispositivos partilhados

Ao terminar sessão, a app **apaga** a cópia local (dados, timer, sessão). Se outra pessoa entrar no mesmo dispositivo, os dados locais de quem lá estava antes **nunca** são juntados à conta nova.

## Conteúdo escrito por ti

Nomes de disciplinas, notas e textos são sempre escapados antes de aparecerem no ecrã — um nome como `<img onerror=…>` aparece como texto.

## Proteções técnicas

- **Cabeçalhos de segurança** em todas as respostas (app e API): *Content-Security-Policy* estrita — só scripts da própria app, sem scripts inline, sem código de terceiros (o cliente do Supabase vem incluído na app, numa versão fixa) —, `frame-ancestors 'none'` contra *clickjacking*, `nosniff`, `Referrer-Policy: no-referrer`, HSTS e *Permissions-Policy*.
- **Dados limpos à entrada e escapados à saída.** Tudo o que chega de fora (a tua linha no Supabase, a do dono para um leitor, atualizações em tempo real, cópias de segurança, a resposta da IA) passa por um filtro que só deixa os campos conhecidos, com os tipos e tamanhos certos; e todo o texto é escapado antes de ir para o ecrã.
- **Sessão.** O login usa PKCE: os links de email e o Google devolvem um código de uso único, não os tokens da sessão. Terminar sessão apaga os dados deste dispositivo.
- **IA.** Só o dono a usa; o limite diário é reservado de forma atómica na base de dados antes de chamar o modelo; pedidos grandes (mais de 8 MB) são recusados antes de tudo.
- **Servidor local.** Só responde a este computador (127.0.0.1, verificação do *Host* contra *DNS rebinding*), e o ecrã de configuração exige uma chave que muda a cada arranque — vem no link que o `npx estudar` abre. Uma chave guardada só é enviada para o endereço para que foi escrita: mudar o URL da IA ou do Supabase apaga-a.
- **Base de dados.** Além das regras de acesso, as permissões (*grants*) retiram aos clientes tudo o que não usam, e cada documento tem um limite de 2 MB.
- **Dependências.** Versões fixas, GitHub Actions fixadas por *commit*, Dependabot semanal, e publicação no npm pela CI sem tokens, com aprovação por 2FA.

## Reportar um problema de segurança

Não abras uma issue pública: usa **Security → Report a vulnerability** no [repositório](https://github.com/RyanTech00/estudar/security). Detalhes em [`SECURITY.md`](https://github.com/RyanTech00/estudar/blob/main/SECURITY.md).
