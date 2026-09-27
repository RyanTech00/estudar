# Changelog

## Unreleased

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
