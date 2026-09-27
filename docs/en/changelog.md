# Changelog

## v1.2.0 — security update

A full security audit (OWASP) and **owner and viewers**. After updating (`npx estudar@latest`), open the link from the terminal and click **Set up** once (with your email) and **Publish**: it applies the new migrations, closes sign-ups and sends the security headers to the Worker.

- **Owner and viewers.** **Set up** asks for your email: you become the **owner** (only you use the AI and see the setup) and sign-ups close in Supabase. Under **Who can sign in** you add **viewers**, who see your plan and progress read-only, and remove access with one button. The database (a `viewers` table clients can only read) and the Worker enforce this; the screen only reflects it. New **Sign-ups** dot in the status panel.
- **Security audit (OWASP)** and fixes: a strict *Content-Security-Policy* and security headers on every response (static files included); the Supabase client bundled with the app at a pinned version, no CDN; one filter for all incoming data plus escaping of every field (XSS); PKCE sign-in; viewer access tied to the account, not the email; an atomic, owner-only AI limit; `/api/health` closed to the public; a per-launch setup key, DNS-rebinding protection and size limits on the local server; minimal database grants and a 2 MB cap per document; pinned GitHub Actions, Dependabot, publishing without install scripts; the docs site with local fonts and security headers. See [Privacy and security](/en/guide/security#technical-protections) and `SECURITY.md`.
- **Sign in with Google marked "Coming soon"**: the button is shown greyed out, not clickable, until it's ready.
- **Keys in the wrong field are refused**: the secret key in the public field (it would be sent to browsers) or the public key in the secret field. If they're already swapped, the status panel shows it and **Set up** fixes it.
- **Sign-in email on new Supabase projects**: since June 2026, Supabase's built-in email doesn't allow changing the template. The authorised addresses are now saved separately (the link no longer goes to `localhost:3000`) and the app explains that your own SMTP is needed.
- Clearer sign-in messages for Supabase's limits (2 emails per hour with the built-in email; the wait between codes).
- Supabase instructions updated for the current dashboard (the project's **Copy** button).

## v1.1.0 — on npm, in English and with backups

- **One-command install**: `npx estudar` downloads and starts the app and the Server & keys screen, without cloning the repository. Keys are stored in `~/.estudar` (or the folder given in `ESTUDAR_HOME`). Options `--port`, `--no-open`, `--help` and `--version`.
- **The app in English and Portuguese**: all interface text, server messages and AI-generated plans follow the language chosen in **Account → Language**, detected automatically from the browser.
- **Bilingual documentation** (Portuguese and English), with screenshots in both languages.
- A **Buy Me a Coffee** support link in the docs and the README.
- **Backup**: export all your data to a JSON file and import it, merging with what is already there (without duplicating logs). The file is validated and invalid rows are discarded.
- The Account sheet now scrolls on small screens.

## v1.0.0 — first public release

### Learning

- **Unaided mastery**: only closed-book tests on paper, with no notes, days later; practice with help and unaided kept apart; a relies-on-help warning.
- **Block log** in the right order: attempts, confidence (1–4) and help used before marking; number correct afterwards. Optional self-explanation.
- **Calibration**: overconfidence detected per subject and put at the top of Progress.
- **Exam dates per subject**: the day before is review only, with priority in the final week.
- **Time allocation** by ECTS × deficit, with a 10% floor, sent to the AI.

### Degree record

- Modules by year and semester, with **photo import** of the curriculum.
- ECTS-weighted average, truncated the way university academic offices do it; the grade needed not to lower your average and to reach a target.
- Assessments with weights and minimum grades; regular exam period, resit and special period; final grade calculated and rounded.
- Prerequisites with a weak foundation → more time and a review of the basics.
- Year → semester board and a **semester report** with prediction vs. grade.

### Plan

- A plan per user: sample, by hand or **AI-generated** (Gemini, Claude or OpenAI-compatible) with an evidence-based prompt.
- A fixed **science check** on any plan: workload, spacing, retrieval, passive techniques, languages.

### Platform

- A **Cloudflare Worker** serves the app and the API, with the keys stored as secrets.
- **`npm start`** with a **Server & keys** screen: save keys, create tables, connect your Cloudflare account and publish in one click; a **status panel** per service.
- **Supabase**: sign-in with an emailed code, one document per user with RLS, real-time sync.
- Clock-based timer that survives the background and closing the app; focus mode with full screen and the screen kept on.
- Offline PWA; welcome page with the references.
- Rule tests (`npm test`), checked with mutations.

## Before 1.0

A personal prototype with Firebase and a plan hard-coded in the source, an interface redesign and the first version of the timer. Fully replaced in 1.0.
