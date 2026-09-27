# Sync and offline

## One account, several devices

You sign in with your email (a 6-digit code, or a link) on your phone and your computer. What you do on one appears on the other within seconds, via Supabase Realtime.

<Shot src="/screenshots/en/login.png" alt="Sign-in screen with a code" caption="Sign-in with a code: it works inside the installed PWA, where email links would open in the browser." />

### How the data is merged

Each user has **one JSON document** (plan, logs, degree record, settings).

**While you use the app**, each change is sent about 1 second later and the other devices receive it in real time: the most recent version replaces the previous one (that's how unticking something on one device unticks it on the other) — with one exception, the **attempt logs**, which are always merged.

**When you sign in on a device**, the local copy and the cloud copy are merged field by field:

| Data | Rule |
|---|---|
| **Attempt logs** | Append-only; union by identifier — no device deletes another's |
| Completed sessions, minutes per day | Union; for minutes, the highest value per day and subject is kept |
| Weekly checklist | A box ticked on any device stays ticked |
| Plan, degree record, durations, settings | The most recent version wins |
| Exam grades | The most recent wins, per subject |

- **When you sign in on a device**, the local copy is merged with the cloud copy **before** saving — an empty device never wipes what already exists.
- **If the local copy belongs to another account**, it's discarded — never mixed in.
- Statistics (streaks, hours, tests) are **calculated from the history**, so there are no counters drifting apart between devices.

## Offline

The app is a **PWA**. The service worker:

- always fetches the latest version when there's a connection (and reloads the page once when a new version comes out, if the timer is stopped);
- serves the app from the cache when there's no connection;
- keeps a copy of the Supabase SDK so the app can open offline.

Offline, everything works with the local copy: plan, timer, logs, degree record. Sync resumes when you're back online.

## Installing

- **Android (Chrome)**: ⋮ menu → **Install app**.
- **iPhone (Safari)**: Share → **Add to Home Screen**.
- **Computer (Chrome/Edge)**: the install icon in the address bar.

## Backup

In **Account → Export backup** you download an `estudar-YYYY-MM-DD.json` file with everything: plan, logs, degree record and settings (without the account identifier). **Import backup** merges it with what you have, using the same rules as when you sign in on a new device:

- attempt logs are merged — importing twice doesn't duplicate anything;
- sessions, minutes and the checklist are merged by day;
- for the plan, the degree record and settings, the most recent version is kept.

Before merging, the app shows what the file contains and asks you to confirm. The file is treated as untrusted: invalid rows (more correct answers than attempts, grades outside 0–20, malformed dates) are discarded.

Use it to keep a copy outside Supabase, to move to a different Supabase project, or to move your data from local mode to an account.

## Signing out

**Sign out** deletes the local copy on this device (data, timer and session). Your data stays in your account.
