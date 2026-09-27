# AI weekly plan

The plan is your typical week: for each day, the sessions — subject, duration and a **concrete activity**. You can create it by hand, start from the example, or generate it with AI.

<Shot src="/screenshots/en/semana.png" alt="Week tab with phases and weekly plan" caption="Week: the timeline of phases up to the exams and each day's plan, with completed sessions ticked off." />

## What the AI receives

- Subjects: name, code, type, load, **ECTS** (European credits, a measure of workload), **exam date**.
- The **suggested share** of time and **measured mastery** of each one (see [time allocation](#time-allocation)).
- **Weak foundation**: prerequisites not yet taken, failed, or passed with a low grade.
- Start and exam dates, hours available per day and your notes.

## The rules it must follow

The system prompt requires the AI to apply:

1. **Retrieval practice** in every session — exercises, questions without notes, explaining from memory. Never rereading, highlighting or summarising as the main activity.
2. **Spacing** — medium and heavy subjects on at least 2 non-consecutive days, with short reviews 1–3 days later.
3. **Interleaving** — mixed exercises; a main session plus a review of another subject on the same day.
4. One **weekly cumulative retrieval session**.
5. **Blocks with breaks**, never exceeding each day's hours.
6. **Sleep and load** — if the hours aren't enough, cut light subjects and languages first, never the spacing of the heavy ones.
7. **Languages** in short, frequent sessions.
8. **Time allocation** according to the suggested share; the nearest exam takes priority.
9. **Weak foundation** → short retrieval sessions on the prerequisite in the first few weeks.
10. **First exposure** in blocks; then mixed practice.
11. **Phases** up to the exam, ending with mock exams under exam conditions.

The response is **structured JSON** (with a schema), cleaned and validated before it appears: days 0–6, only subjects that exist, dates in the right format.

## Scientific check

Even so, the AI can make mistakes. The editor runs fixed rules on any plan:

<Shot src="/screenshots/en/plano-verificacao.png" alt="Scientific check in the plan editor" />

| Rule | Warns when |
|---|---|
| Load | A day goes more than 15% over the available hours |
| Coverage | A subject has no sessions |
| Spacing | A medium or heavy subject appears on only one day (reviews tagged with its code count) |
| Retrieval | There is no test, recall, mock exam or cumulative review session |
| Passive techniques | There are sessions based on rereading, highlighting or summarising |
| Languages | Fewer than 3 sessions a week |

## Time allocation {#time-allocation}

::: warning A heuristic, not learning science
There is no evidence linking time per subject to ECTS. This rule decides **how much** time; the principles decide **how**. The parameters are adjustable and should be checked against your closed-book tests.
:::

```
priority(s) = ECTS(s) × deficit(s) × [2 if exam in the next 7 days] × [1.25 if weak foundation]
deficit(s)  = 1 − mastery(s)          — from unaided tests only; with no test, 1
              + 0.2 if overconfident
share(s)    = max(10%, priority / Σ priorities), renormalised
```

- Before the first test, the split is proportional to ECTS (without ECTS, it uses the load).
- No subject drops below 10% — spacing never lets it go forgotten for weeks.
- Subjects whose exam is already done leave the allocation.

<Shot src="/screenshots/en/plano-distribuicao.png" alt="Suggested time split in the editor" caption="Next to each share: why (mastery, exam, weak foundation) and how much it has in the current plan." />

## Providers

| `AI_PROVIDER` | How it's called |
|---|---|
| `gemini` | REST `generateContent` with `responseSchema` |
| `anthropic` | Official `@anthropic-ai/sdk` SDK, structured output (`output_config.format`) and a server-side *fallback* if the model refuses |
| `openai` | `chat/completions` with `response_format: json_schema` — works with OpenAI, OpenRouter, Groq and others |
