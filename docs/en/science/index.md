# Learning principles

This page turns the evidence from learning science into Estudar's **design rules**. Each rule states the evidence, the rule and **its current status** in the app. The rules are invariants: if a feature conflicts with a rule, the feature changes.

**Strength of evidence**

- **HIGH** — replicated experimental results; high utility according to Dunlosky et al. (2013).
- **MODERATE** — good experimental support, under narrower conditions.
- **EMERGING** — few studies; implement, instrument and check against our own data.

Observational reports serve as context: they motivate the problem, but do not justify decisions on their own.

## Implementation status

| Rule | Evidence | Status |
|---|---|---|
| [Core model](#core-model) | HIGH | <span class="st ok">Implemented</span> |
| [R1 Attempt before revealing](#r1) | HIGH + EMERGING | <span class="st part">On paper</span> |
| [R2 AI only after an attempt](#r2) | EMERGING | <span class="st ok">Met</span> |
| [R3 Spacing with a deadline](#r3) | HIGH | <span class="st part">At session level</span> |
| [R4 Interleaving](#r4) | MODERATE | <span class="st part">At plan level</span> |
| [R5 Self-explanation](#r5) | MODERATE | <span class="st part">Optional prompt</span> |
| [R6 Confidence and calibration](#r6) | HIGH | <span class="st ok">Implemented</span> |
| [R7 With help vs. unaided](#r7) | EMERGING | <span class="st ok">Implemented</span> |
| [R8 Low-utility techniques](#r8) | HIGH (negative) | <span class="st ok">Implemented</span> |
| [R9 Time per subject](#r9) | Heuristic | <span class="st ok">Implemented</span> |

"On paper", "at session level" and "at plan level" mean the rule is applied to what the app knows today — sessions and logs — and not to individual items, which will only exist with the question bank ([roadmap](/en/roadmap)).

## Core model {#core-model}

Learning is measured by **unaided retrieval, after some time has passed** — never by performance while studying. Performance during practice is a misleading signal:

- rereading felt better and retained less (Roediger & Karpicke, 2006);
- blocked practice did better during training and much worse a week later (Rohrer & Taylor, 2007);
- with an AI tutor, performance with help went up and unaided performance went down (Bastani et al.).

**In Estudar:** mastery comes only from unaided closed-book tests; hours, practice and practice with help are shown separately.

## R1. Attempt before revealing {#r1}

**Evidence.** The testing effect (Roediger & Karpicke, 2006; Karpicke & Blunt, 2011). The crutch effect (Bastani et al.): a tutor that gave answers harmed unaided performance; one that made students reason first removed much of the harm.

**Rule.** Nothing that contains or implies the answer is shown before an attempt has been logged. An empty attempt counts, but as a failed one.

**In Estudar (paper mode).** The block log asks for attempts, confidence and help used **before** marking; those fields are then locked; only after that does the number correct appear, capped at the number attempted. A blank exercise counts as attempted and wrong. Self-assessment is flagged as such and compared against closed-book tests (R6).

## R2. AI is a post-attempt tool {#r2}

**Rule.** Before the attempt, only hints that do not reveal the answer. Afterwards, marking, explaining and generating variants. In closed-book tests and mock exams, none.

**In Estudar.** The AI only generates the weekly plan and reads the image of your degree record; it never sees exercises or answers. Practice done with AI is logged as "with help" and never counts towards mastery. A phased tutor is future work and will have to respect this table.

## R3. Spacing, with an exam deadline {#r3}

**Evidence.** Ebbinghaus (1885); Cepeda et al. (2006, meta-analysis); Cepeda et al. (2008): the optimal gap between reviews is around 10–20% of the time until the test.

**Rule.** Every subject has an exam date; spacing guarantees review in the final window; the day before the exam is review only.

**In Estudar.** Exam dates per subject (or taken from the next assessment in the degree record); the day before is marked "retrieval and review only, no new material"; priority in the last 7 days; the plan requires every medium or heavy subject on 2+ days, with reviews 1–3 days later. Per-item scheduling (FSRS) arrives with the question bank.

## R4. Interleaving {#r4}

**Evidence.** Rohrer & Taylor (2007): mixed practice ~63% vs. blocked ~20% on a test a week later — the gain comes from having to identify which method applies.

**Rule.** First exposure can be blocked; review and practice interleave topics and problem types.

**In Estudar.** The plan asks for mixed exercises and cross-reviews on the same day; closed-book tests ask for mixed topics; first exposure is logged separately.

## R5. Self-explanation {#r5}

**Rule.** After an attempt, sometimes ask the student to explain *why* a step works — in moderation.

**In Estudar.** On every third practice log, an optional field asks for a one-sentence self-explanation.

## R6. Confidence and calibration {#r6}

**Evidence.** The illusion of competence: people who reread predict better results than people who test themselves, and are wrong (Roediger & Karpicke, 2006). Bjork (1994): fluent study feels effective and is not.

**Rule.** Before revealing, confidence (1–4). Calibration per subject. Subjects showing **overconfidence** rank above those that are merely weak.

**In Estudar.** Exactly that — see [Block log](/en/features/block-log#calibration).

## R7. With help vs. unaided {#r7}

**Rule.** Mastery is computed only from unaided retrieval. Performance with help is shown separately and never inflates it. Measure the gap between the two: a growing gap is the crutch effect in our own data.

**In Estudar.** Mastery comes only from unaided closed-book tests; practice with help and unaided side by side; a **relies on help** warning; tests taken with help become practice.

## R8. Low-utility techniques are not a study mode {#r8}

**Evidence.** Dunlosky et al. (2013): rereading, highlighting and summarising have low utility.

**In Estudar.** Reading new material is logged as first exposure and never counts towards mastery; the app does not offer AI-generated summaries; the prompt forbids those techniques as the main activity and the plan check warns when they appear.

## R9. Time allocation {#r9}

**Status.** A planning heuristic, **not** learning science. It decides *how much* time; R1–R8 decide *how*.

```
priority(d) = ECTS(d) × deficit(d)
share(d)    = max(10%, priority / Σ priorities), renormalised
deficit(d)  = 1 − unaided mastery(d)     — no test yet: 1
```

ECTS are the European credits that measure each subject's workload. Overconfidence increases the deficit; the nearest exam jumps the queue; exams already sat drop out. Details and parameters in [AI weekly plan](/en/features/ai-plan#time-allocation).

## How these rules are enforced

Every rule with a measurable consequence has an **automated test**, and every test is checked by deliberately breaking the rule (mutation) to confirm the test catches it. See [Tests](/en/architecture/tests).

## Measure before deciding

After two weeks of use, compare your closed-book tests with your practice with help **before** tuning any parameter. The [semester report](/en/features/semester-report) shows whether your tests predicted your grades well.
