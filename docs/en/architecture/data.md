# Data model

## Tables

```sql
-- One JSON document per user
create table public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Daily counter of AI requests (only the server can access it)
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);
```

### Access rules (RLS)

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `user_data` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `ai_usage` | — | — | — | — |

`ai_usage` has RLS enabled **with no policies at all**: no client can read or write it; only the server can, with the secret key. `user_data` is in the `supabase_realtime` publication so devices stay in sync.

The full SQL is in [`supabase/migrations/20260927000000_init.sql`](https://github.com/RyanTech00/estudar/blob/main/supabase/migrations/20260927000000_init.sql).

## The document

Field values such as `"load": "alta"` or `"epoca": "normal"` are internal identifiers and stay in Portuguese whatever the interface language.

```jsonc
{
  "owner": "uuid",               // who the local copy belongs to
  "plan": {                      // null until the user creates one
    "title": "", "startDate": "2026-09-25", "examDate": "2027-01-04",
    "hoursPerDay": [3, 3.5, 3.5, 3.5, 4, 3.5, 3],       // Sunday … Saturday
    "subjects": [{ "id": "ed", "name": "Estruturas de Dados", "short": "ED",
                   "area": "uni", "load": "alta", "ects": 7, "examDate": "", "ucId": "ed", "color": "#c39cff" }],
    "weeklyPlan": [{ "day": 2, "subject": "ed", "session": "3 blocos 40+10", "minutes": 150, "focus": "…" }],
    "phases": [{ "name": "Aprender", "label": "60 / 40", "start": "…", "end": "…", "ratio": "…" }],
    "tips": [{ "title": "…", "text": "…" }]
  },
  "attempts": [                  // append-only
    { "id": "…", "at": 1790000000000, "subject": "ed",
      "kind": "practice",        // learn | practice | probe
      "done": 5, "correct": 3,
      "confidence": 3,           // 1–4, given before marking
      "assisted": false,         // AI, notes or worked examples
      "minutes": 40, "explanation": "…" }
  ],
  "sessions":  { "2026-09-27": { "ed": { "done": true, "timestamp": 0 } } },
  "focus":     { "2026-09-27": { "ed": 80 } },            // minutes per day and subject
  "checklist": { "W04": [true, false, true, true, false] },
  "curriculum": {
    "degree": "…", "targetAverage": 17,
    "ucs": [{ "id": "…", "name": "…", "short": "…", "ects": 6, "year": 2, "semester": 1,
              "optional": false, "grade": null, "gradeType": "", "gradeDate": "",
              "passGrade": 9.5, "inPlan": true, "prereqs": ["…"],
              "assessments": [{ "id": "…", "name": "Teste 1", "kind": "teste", "epoca": "normal",
                                "date": "…", "weight": 40, "minGrade": 7.5, "grade": null }] }]
  },
  "examResults": { "c2": { "grade": 16, "at": 0 } },      // subjects outside the degree record
  "timerConfig": { "work": 40, "break": 10, "longBreak": 15, "sessionsBeforeLong": 4 },
  "settings": { "sound": true },
  "updatedAt": 1790000000000
}
```

`ucs` are the modules in the degree record; grades use the Portuguese 0–20 scale, where 9.5 is a pass (`passGrade`).

### Derived fields (never saved)

- `derivedExamDate` and `prereqWeak` on subjects linked to a module — calculated from the degree record every time the plan loads. They are kept out of the document so that saving the plan never freezes a resit date as if it had been entered by hand.
- Streaks, hours, the week's tests, mastery, calibration, averages — always calculated from the history.

## Sync

| When | What happens |
|---|---|
| Every change | Saved locally; an `upsert` to `user_data` is sent ~0.8 s later |
| Change on another device | Arrives via Realtime; if newer, it replaces the local copy — but `attempts` are always merged by `id` |
| Signing in on a device | Merges local + cloud field by field (below) before saving |
| Local copy from another account | Discarded, never merged |
| Signing out | Sends anything pending and deletes the local copy |

### Merge on sign-in

| Field | Rule |
|---|---|
| `attempts` | Union by `id` (append-only) |
| `sessions` | Union by day |
| `focus` | Maximum per day and subject |
| `checklist` | Logical OR per box |
| `examResults` | Most recent per subject |
| `plan`, `curriculum`, `timerConfig`, `settings` | Most recent document |

## Local copy

| Key (`localStorage`) | Contents |
|---|---|
| `estudar_data` | The document |
| `estudar_timer` | Timer state (phase, end time, block, subject, closed-book test in progress) |
| `estudar_server_config` | Last `/api/config` response, for starting offline |
| `estudar_last_uid` | So whoever has already signed in on this device can open the app offline |
| `estudar_intro_seen` | Welcome page already seen |
| `estudar_lang` | Interface language (`pt` or `en`) |
