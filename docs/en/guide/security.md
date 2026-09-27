# Privacy and security

Estudar stores grades, plans and study habits — personal data. The design starts from a simple rule: **each person sees only their own data, and the keys never reach the browser.**

## Where the data lives

| Where | What |
|---|---|
| **Your browser** (`localStorage`) | A working copy of everything, so the app opens instantly and works offline |
| **Supabase** (`user_data`) | One row per user with the same document, to sync devices |
| **Supabase** (`ai_usage`) | One counter per user per day, only if you enable the limit |
| **AI provider** | Only what each request needs (see below) |

There are no analytics and no telemetry.

## Access rules (RLS)

Both tables have *Row Level Security* enabled. In `user_data`, all four operations require `auth.uid() = user_id`: even with the public key, nobody can read or write another person's row. In `ai_usage` there are no client rules at all — only the server, with the secret key, can access it. The SQL is in [`supabase/migrations`](https://github.com/RyanTech00/estudar/tree/main/supabase/migrations) and explained in [Data model](/en/architecture/data).

## Keys

| Key | Where it lives | Does it reach the browser? |
|---|---|---|
| Supabase **publishable/anon** | Worker secret; served by `/api/config` | Yes — it's made for that; RLS protects the data |
| Supabase **secret/service_role** | Worker secret (`.dev.vars` locally) | **Never** |
| **AI** key | Worker secret (`.dev.vars` locally) | **Never** |
| Supabase personal token (`sbp_…`) | Local server (`npx estudar`) memory, only during the session | **Never**, and it's never written to disk |

`.dev.vars` and `.deploy.json` live in `~/.estudar` (or, in a copy of the repository, in the project folder, where they are in `.gitignore`). Only the `public/` folder is published as static files, so a secrets file in the root is never served.

## What the AI sees

| Request | Sent |
|---|---|
| **Generate plan** | Subject names and short codes, type, load, ECTS, exam dates, hours per day, your notes for the AI, the suggested share, measured mastery and weak foundations |
| **Read the curriculum** | The image you chose (scaled down to ~1800 px) |

The AI **never** receives your email, your study logs, exercises or answers. What it returns is treated as untrusted: it's cleaned and validated (dates, grades between 0 and 20, existing subjects) before it reaches the screen, and you confirm before saving.

Every request requires a valid session (the server checks the token with Supabase) and counts towards the daily limit, if it's enabled.

## Shared devices

When you sign out, the app **deletes** the local copy (data, timer, session). If someone else signs in on the same device, the local data of whoever was there before is **never** merged into the new account.

## Content you write

Subject names, grades and text are always escaped before they appear on screen — a name like `<img onerror=…>` shows up as text.

## Reporting a security issue

Open an issue labelled *security* on [GitHub](https://github.com/RyanTech00/estudar/issues), without exploitable details, and we'll arrange a private channel.
