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

## Who can sign in

There are three kinds of account:

| | Sees | Edits | Uses the AI | Sees the setup |
|---|---|---|---|---|
| **Owner** (the email given in **Set up**) | their own plan and progress | yes | yes | yes |
| **Viewer** | the owner's plan and progress | no | no | no |
| **Other account** (created while sign-ups were open) | nothing | no | no | no |

- **Sign-ups closed.** When you click **Set up** with your email, the app creates your owner account and turns off new sign-ups in Supabase. An unknown email gets "This installation doesn't accept new accounts" and **no email is sent**. The **Sign-ups** dot in the status panel stays red while they're open.
- **Viewers.** Under **Server & keys → Login → Who can sign in** you add viewers by email; they sign in with the code, like you, and see the app **read-only**: no timer, no editing, no AI, no setup.
- **Remove.** The **Remove** button deletes the viewer row and the account: access ends at once, even in an open session, and your data isn't touched.

What enforces this is the server, not the screen:

- the database only lets a viewer **read** the owner's document, and only while the row in `viewers` exists — which no client can write;
- the Worker only lets the owner use the AI and see the server status;
- the setup (keys, publishing, access) only exists on the local server (`npx estudar`), which only answers this computer — on the published address those routes don't exist, not even for the owner.

The app also refuses keys in the wrong field: the **secret** key pasted into the public field would be sent to every browser, so it's neither saved nor served.

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

## Technical protections

- **Security headers** on every response (app and API): a strict *Content-Security-Policy* — only the app's own scripts, no inline scripts, no third-party code (the Supabase client is bundled with the app, at a pinned version) —, `frame-ancestors 'none'` against clickjacking, `nosniff`, `Referrer-Policy: no-referrer`, HSTS and a *Permissions-Policy*.
- **Data cleaned on the way in and escaped on the way out.** Everything that comes from outside (your Supabase row, the owner's for a viewer, live updates, backups, the AI's answer) goes through a filter that keeps only known fields with the right types and sizes; and all text is escaped before it reaches the screen.
- **Session.** Sign-in uses PKCE: email links and Google return a one-time code, not the session tokens. Signing out wipes this device's data.
- **AI.** Only the owner uses it; the daily limit is reserved atomically in the database before the model is called; large requests (over 8 MB) are refused before anything else.
- **Local server.** It only answers this computer (127.0.0.1, with a *Host* check against DNS rebinding), and the setup screen requires a key that changes on every start — it's in the link `npx estudar` opens. A stored key is only ever sent to the address it was entered for: changing the AI or Supabase URL drops it.
- **Database.** On top of the access rules, grants take away from clients everything they don't use, and each document is capped at 2 MB.
- **Dependencies.** Pinned versions, GitHub Actions pinned by commit, weekly Dependabot, and npm releases by CI with no tokens, approved with 2FA.

## Reporting a security issue

Don't open a public issue: use **Security → Report a vulnerability** on the [repository](https://github.com/RyanTech00/estudar/security). Details in [`SECURITY.md`](https://github.com/RyanTech00/estudar/blob/main/SECURITY.md).
