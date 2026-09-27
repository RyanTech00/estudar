# Modelo de dados

## Tabelas

```sql
-- Um documento JSON por utilizador
create table public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Contador diário de pedidos à IA (só o servidor lhe acede)
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);
```

### Regras de acesso (RLS)

| Tabela | select | insert | update | delete |
|---|---|---|---|---|
| `user_data` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_data` (leitor) | há uma linha em `viewers` com `owner_id = user_id` e `viewer_id = auth.uid()` | — | — | — |
| `viewers` | `owner_id = auth.uid()` ou `viewer_id = auth.uid()` | — | — | — |
| `ai_usage` | — | — | — | — |

`ai_usage` tem RLS ativa **sem nenhuma regra**: nenhum cliente a lê ou escreve; só o servidor, com a chave secreta. `viewers` (dono, conta do leitor — o email é só para mostrar a lista) liga o acesso à **conta**, não ao email: se a conta for apagada, a linha vai com ela, e ninguém herda o acesso registando-se mais tarde com esse email. Só tem regra de leitura: **nenhum cliente a escreve** — se pudesse, qualquer um se punha como leitor dos dados de outra pessoa; quem a escreve é o servidor local, com a chave secreta. `user_data` está na publicação `supabase_realtime` para sincronizar dispositivos (e o leitor recebe as mudanças do dono em tempo real).

O limite diário da IA é reservado pela função `ai_usage_take` (uma só instrução, `security definer`, só executável pelo servidor), antes de chamar o modelo. Além das regras, as permissões (*grants*) retiram aos clientes o que não usam (`anon` não toca em `user_data`; ninguém toca em `ai_usage`), e cada documento tem um limite de 2 MB.

O SQL está em [`supabase/migrations/`](https://github.com/RyanTech00/estudar/tree/main/supabase/migrations); o **Configurar** corre todos os ficheiros por ordem (são idempotentes), por isso também serve para atualizar uma instalação.

## O documento

```jsonc
{
  "owner": "uuid",               // a quem pertence a cópia local
  "plan": {                      // null até o utilizador criar um
    "title": "", "startDate": "2026-09-25", "examDate": "2027-01-04",
    "hoursPerDay": [3, 3.5, 3.5, 3.5, 4, 3.5, 3],       // domingo … sábado
    "subjects": [{ "id": "ed", "name": "Estruturas de Dados", "short": "ED",
                   "area": "uni", "load": "alta", "ects": 7, "examDate": "", "ucId": "ed", "color": "#c39cff" }],
    "weeklyPlan": [{ "day": 2, "subject": "ed", "session": "3 blocos 40+10", "minutes": 150, "focus": "…" }],
    "phases": [{ "name": "Aprender", "label": "60 / 40", "start": "…", "end": "…", "ratio": "…" }],
    "tips": [{ "title": "…", "text": "…" }]
  },
  "attempts": [                  // só se acrescenta
    { "id": "…", "at": 1790000000000, "subject": "ed",
      "kind": "practice",        // learn | practice | probe
      "done": 5, "correct": 3,
      "confidence": 3,           // 1–4, dado antes de corrigir
      "assisted": false,         // IA, apontamentos ou exemplos
      "minutes": 40, "explanation": "…" }
  ],
  "sessions":  { "2026-09-27": { "ed": { "done": true, "timestamp": 0 } } },
  "focus":     { "2026-09-27": { "ed": 80 } },            // minutos por dia e disciplina
  "checklist": { "W04": [true, false, true, true, false] },
  "curriculum": {
    "degree": "…", "targetAverage": 17,
    "ucs": [{ "id": "…", "name": "…", "short": "…", "ects": 6, "year": 2, "semester": 1,
              "optional": false, "grade": null, "gradeType": "", "gradeDate": "",
              "passGrade": 9.5, "inPlan": true, "prereqs": ["…"],
              "assessments": [{ "id": "…", "name": "Teste 1", "kind": "teste", "epoca": "normal",
                                "date": "…", "weight": 40, "minGrade": 7.5, "grade": null }] }]
  },
  "examResults": { "c2": { "grade": 16, "at": 0 } },      // disciplinas fora do percurso
  "timerConfig": { "work": 40, "break": 10, "longBreak": 15, "sessionsBeforeLong": 4 },
  "settings": { "sound": true },
  "updatedAt": 1790000000000
}
```

### Campos derivados (nunca gravados)

- `derivedExamDate` e `prereqWeak` das disciplinas ligadas a uma UC — calculados do percurso sempre que o plano é carregado. Ficam fora do documento para que guardar o plano nunca congele uma data de recurso como se fosse manual.
- Dias seguidos, horas, testes da semana, domínio, calibração, médias — sempre calculados a partir do histórico.

## Sincronização

| Momento | O que acontece |
|---|---|
| Cada alteração | Grava localmente; envia `upsert` para `user_data` ~0,8 s depois |
| Alteração noutro dispositivo | Chega por Realtime; se for mais recente, substitui a cópia local — mas os `attempts` juntam-se sempre por `id` |
| Entrar num dispositivo | Junta local + nuvem campo a campo (abaixo) antes de gravar |
| Cópia local de outra conta | Descartada, nunca junta |
| Terminar sessão | Envia o que falta e apaga a cópia local |

### Junção ao entrar

| Campo | Regra |
|---|---|
| `attempts` | União por `id` (só se acrescenta) |
| `sessions` | União por dia |
| `focus` | Máximo por dia e disciplina |
| `checklist` | OU lógico por caixa |
| `examResults` | Mais recente por disciplina |
| `plan`, `curriculum`, `timerConfig`, `settings` | Documento mais recente |

## Cópia local

| Chave (`localStorage`) | Conteúdo |
|---|---|
| `estudar_data` | O documento |
| `estudar_timer` | Estado do timer (fase, hora de fim, bloco, disciplina, teste de controlo em curso) |
| `estudar_server_config` | Última resposta de `/api/config`, para arrancar offline |
| `estudar_last_uid` | Para abrir offline quem já entrou neste dispositivo |
| `estudar_intro_seen` | Página de apresentação já vista |
