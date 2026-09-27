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

## Reportar um problema de segurança

Abre uma issue marcada como *security* no [GitHub](https://github.com/RyanTech00/estudar/issues), sem pormenores exploráveis, e combinamos um canal privado.
