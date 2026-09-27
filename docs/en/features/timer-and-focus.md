# Timer and focus mode

<div class="shots">
  <Shot src="/screenshots/en/timer.png" alt="Timer tab" caption="Timer: subject, progress ring and the blocks in the cycle." />
  <Shot src="/screenshots/en/foco.png" alt="Full-screen focus mode" caption="Focus mode: just the time, the phase and the controls." />
</div>

## Blocks

By default, **40 min of study + 10 of break**, with a **15-min long break** every 4 blocks. You can change the durations in **Timer → Durations**. The 40 minutes are practical, not a biological rule: adjust between 30 and 60 depending on your focus.

- **Breaks start on their own**; the next study block **waits for you**.
- A study block of 5 minutes or more ends with the [block log](/en/features/block-log).
- Study minutes are recorded against the chosen subject.

## Focus mode

**Focus mode** (or **Start focus** on Today) opens a distraction-free screen:

- **full screen** (Fullscreen API) when the device allows it;
- **screen always on** (Wake Lock API), restored when you come back to the app;
- **space** pauses and resumes on a computer; **Esc** or **Exit** closes it.

## A timer that doesn't lie

Browsers slow down timers when the screen locks or the app goes into the background, and the system may close the PWA midway. So the timer:

- stores the block's **end time**, not a count of seconds — the time remaining is always calculated from the clock;
- saves its state on every change; when you return to the app, it resumes exactly where it should be;
- if the block ended while the app was closed, it **logs it** and starts the break.

The code is in [`public/js/timer.js`](https://github.com/RyanTech00/estudar/blob/main/public/js/timer.js).
