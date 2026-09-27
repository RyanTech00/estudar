# Block log

At the end of each study block (5 minutes or more), the app asks what happened. It takes 20 seconds, and it's what turns "I studied for 40 minutes" into useful information.

<div class="shots">
  <Shot src="/screenshots/en/registo-bloco.png" alt="Log before marking" caption="Step 1: attempts, confidence and help — before marking." />
  <Shot src="/screenshots/en/registo-feedback.png" alt="Result after marking" caption="Step 2: correct answers and what the result means." />
</div>

## The order is the point

1. **What did you do?**
   - **New material** — first exposure to a topic. It's logged, but it **never** counts towards mastery: reading is for getting to know the material, not for retaining it.
   - **Exercises / retrieval** — you tried to solve or recall.
2. **How many exercises or questions did you attempt?** A blank exercise counts as attempted and wrong: committing to an answer is part of the effect.
3. **Before marking: how sure are you?** — from 1 (*Not sure*) to 4 (*Very sure*).
4. **Did you use AI, notes or worked examples?**
5. **Confirm and go mark** — confidence and help **are locked in**. Only now does the **how many did you get right** field appear, capped at the number of attempts.

Confidence given after seeing the solutions is no longer a prediction. This order implements, for paper-based study, the **"attempt before revealing"** rule ([R1](/en/science/#r1)).

## Self-explanation

Every third practice log, an optional field appears: *"explain in one sentence why one of the steps works, without looking"*. It's deliberately moderate, so that each block doesn't turn into an essay ([R5](/en/science/#r5)).

## What happens to the data

| Log | Goes to |
|---|---|
| New material | History (first exposure) — counts for nothing |
| Practice **unaided** | "Unaided practice" and calibration |
| Practice **with help** | "Practice with help" — **never** mastery |
| Confidence (any practice or test) | Calibration: expected confidence vs. actual correct answers |

Mastery comes only from [closed-book tests](/en/features/closed-book-tests).

## Calibration {#calibration}

Each confidence level maps to an expected success rate (1 → 25%, 2 → 50%, 3 → 75%, 4 → 95%). With 3 or more logs in a subject, the app compares the expected average with what you got right. If you expected **20 percentage points or more** above what you got right, the subject is flagged as **Overconfident** and moves to the top of Progress — above the ones that are simply weak ([R6](/en/science/#r6)).
