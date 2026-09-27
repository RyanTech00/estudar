# Closed-book tests and mastery

Your **mastery** of a subject is the percentage of correct answers in your **closed-book tests** — and only there.

<div class="shots">
  <Shot src="/screenshots/en/teste-controlo.png" alt="Setting up a closed-book test" caption="Before the test: rules, subject and time." />
  <Shot src="/screenshots/en/progresso.png" alt="Unaided mastery by subject" caption="Progress: mastery, overconfidence, relies on help, weak foundation." />
</div>

## What a closed-book test is

In **Progress → Closed-book test**:

- **on paper**, as in the exam;
- **without** notes, AI or worked examples;
- with exercises you have **not** solved in the last 7 days;
- **mixing** topics already covered, so you have to recognise which method to use;
- **timed** (15, 20, 30 or 45 min) — it runs in focus mode, marked "no notes";
- at the end, the same [log](/en/features/block-log): confidence before marking, correct answers after.

If you say you used help, the test counts as practice with help and does **not** go into mastery.

::: tip Starting from zero is normal
The test measures only the material **you have already covered**, not the whole subject. With no tests, the subject shows as "still to learn" — that's not a bad grade, it's a status.
:::

## How it's calculated

```
mastery(s) = correct / attempted   in the 3 most recent closed-book tests, unaided
```

- Old tests drop out: a bad start doesn't weigh on you forever.
- **Practice** — with or without help — never counts towards mastery. Performance while studying is a poor predictor of what sticks ([core model](/en/science/#core-model)).

## What Progress shows

Subjects appear in this order:

1. **Overconfident** — you expected to get far more right than you did.
2. **Lowest measured mastery**.
3. **No test yet**, by nearest exam date (exams already taken go to the end).

| Signal | When it appears |
|---|---|
| **Overconfident** | Expected confidence ≥ 20 pp above correct answers, with 3+ logs |
| **Relies on help** | 4+ practice logs, help in more than half, and ≥ 20 pp better with help than unaided |
| **No closed-book test this week** | Mastery has been measured, but there's been no test in the last 7 days |
| **Weak foundation** | A prerequisite not yet taken, failed, or passed below 12 (on the Portuguese 0–20 scale) |

**Relies on help** is the crutch effect from Bastani et al., measured on your own data ([R7](/en/science/#r7)).

## No past papers?

The exercises from your problem sheets are enough. Keep two or three from each sheet unsolved and use them in your tests. The effect comes from retrieval without notes, not from where the questions come from.
