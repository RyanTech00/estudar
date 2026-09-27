# Roadmap

What comes next follows the same rule as the rest of the project: **measure before deciding**. Nothing goes in because it looks useful; it goes in when the data shows it is missing.

## Next

- **Tuning with real data.** After two weeks of use, compare closed-book tests with practice with help before touching any parameter (the overconfidence threshold, the weak-foundation factor, the 10% floor).
- **Reminders** for the weekly closed-book test and the day before an exam (PWA notifications).

## Phase B — question bank

The current version works at **session** level: you know what you did, how confident you were and what help you used. Phase B takes the rules down to **item** level (each question or exercise):

| Rule | With items |
|---|---|
| **R1** attempt before revealing | A single point on the server decides whether an item's solution can be shown; only after an attempt has been logged in that session. Tested with mutations |
| **R2** phased AI | Before the attempt, only hints (rephrasing, pointing to the concept, asking questions), with a leak check against the stored solution; afterwards, marking and explaining; in tests, nothing. `hint_level_used` per attempt |
| **R3** spacing | FSRS per item, with reviews capped at each subject's exam date |
| **R4** interleaving | The session builder never puts more than 2 items in a row from the same topic; "which method applies?" items |
| **R6** calibration | Per topic, not just per subject |

**The condition for moving ahead** is content: an item bank needs correct questions for each subject. AI-generated items go in as pending and are only served once validated — zero items is better than wrong items.

## Considered and set aside

- **AI-generated summaries** — low utility (Dunlosky et al., 2013).
- **An AI tutor that gives answers** — the crutch effect (Bastani et al.).
- **Points, badges and leaderboards for hours** — they would reward the wrong signal.

Got an idea? [Open an issue](https://github.com/RyanTech00/estudar/issues).
