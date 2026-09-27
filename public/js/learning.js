// Learning-science rules as pure functions (no DOM, no storage), so they can be unit-tested.
// Core model: learning is measured by unassisted retrieval after a delay, never by time spent
// or by performance during practice (Roediger & Karpicke 2006; Rohrer & Taylor 2007; Bastani et al.).
//
// attempt = {
//   id, at (ms), subject,
//   kind: 'learn' | 'practice' | 'probe',   learn = first exposure; never counts as retrieval (R8)
//   done, correct,                           exercises attempted / correct (paper, self-graded)
//   confidence: 1..4 | null,                 given BEFORE correcting (R6)
//   assisted: bool,                          AI, notes or worked examples used during the attempt (R7)
// }

export const CONFIDENCE_LABELS = ['', 'Nada seguro', 'Pouco seguro', 'Seguro', 'Muito seguro'];
// What each confidence level claims, as expected accuracy.
const CONFIDENCE_EXPECTED = [0, 0.25, 0.5, 0.75, 0.95];

const DAY = 86400000;
const accuracy = (list) => {
  const done = list.reduce((a, x) => a + x.done, 0);
  return done ? list.reduce((a, x) => a + x.correct, 0) / done : null;
};

export function isValidAttempt(a) {
  return a && typeof a.subject === 'string' && ['learn', 'practice', 'probe'].includes(a.kind)
    && Number.isInteger(a.done) && Number.isInteger(a.correct) && a.done >= 0 && a.correct >= 0 && a.correct <= a.done;
}

// R7: mastery comes only from unassisted probes, the closed-book ground truth.
// Uses the most recent probes so old weak results don't haunt a subject forever.
export function mastery(attempts, subject, { lastN = 3 } = {}) {
  const probes = attempts
    .filter(a => a.subject === subject && a.kind === 'probe' && !a.assisted && a.done > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, lastN);
  return probes.length ? accuracy(probes) : null;
}

// R7: assisted vs unassisted practice, shown side by side, never merged into mastery.
export function practiceSplit(attempts, subject) {
  const practice = attempts.filter(a => a.subject === subject && a.kind === 'practice' && a.done > 0);
  const assisted = practice.filter(a => a.assisted);
  const unassisted = practice.filter(a => !a.assisted);
  return {
    assisted: accuracy(assisted),
    unassisted: accuracy(unassisted),
    assistedShare: practice.length ? assisted.length / practice.length : 0,
    count: practice.length,
  };
}

// Crutch effect in our own data: much better with help than without, and help used most of the time.
export function dependencyWarning(split) {
  return split.count >= 4 && split.assistedShare > 0.5
    && split.assisted !== null && split.unassisted !== null
    && split.assisted - split.unassisted >= 0.2;
}

// R6: confidence (given before correcting) vs actual accuracy.
export function calibration(attempts, subject) {
  const rated = attempts.filter(a => a.subject === subject && a.kind !== 'learn' && a.done > 0 && a.confidence >= 1 && a.confidence <= 4);
  if (rated.length < 3) return { count: rated.length, expected: null, actual: null, gap: null, overconfident: false };
  const done = rated.reduce((s, a) => s + a.done, 0);
  const expected = rated.reduce((s, a) => s + CONFIDENCE_EXPECTED[a.confidence] * a.done, 0) / done;
  const actual = accuracy(rated);
  const gap = expected - actual;
  return { count: rated.length, expected, actual, gap, overconfident: gap >= 0.2 };
}

// ── Exam dates (R3) ───────────────────
const parseDate = (d) => (d ? new Date(d + 'T00:00') : null);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function examDateOf(subject, plan) {
  return subject.examDate || plan.examDate || '';
}

export function daysUntil(dateStr, now = new Date()) {
  const d = parseDate(dateStr);
  return d ? Math.round((d - startOfDay(now)) / DAY) : null;
}

// Subjects whose exam is tomorrow: today is review/retrieval only, no new material.
export function eveOfExam(subjects, plan, now = new Date()) {
  return subjects.filter(s => daysUntil(examDateOf(s, plan), now) === 1);
}

// Final window before an exam: that subject takes precedence (R3 over R9).
export const FINAL_WINDOW_DAYS = 7;

// ── Allocation (R9, planning heuristic) ─
// priority = ects × deficit; share = max(floor, priority/Σ) then renormalised.
// deficit = 1 − mastery (probes only); unknown mastery → 1; overconfidence raises the deficit.
export function allocation(subjects, attempts, plan, { floor = 0.1, now = new Date() } = {}) {
  // Exams already sat need no more time; they'd otherwise hold a floor share forever.
  const finished = subjects.filter(s => (daysUntil(examDateOf(s, plan), now) ?? 0) < 0);
  const active = subjects.filter(s => !finished.includes(s));
  const done = finished.map(s => ({ id: s.id, weight: 0, mastery: mastery(attempts, s.id), deficit: 0, inFinalWindow: false, days: daysUntil(examDateOf(s, plan), now), share: 0, finished: true }));
  return [...allocateActive(active, attempts, plan, floor, now), ...done];
}

function allocateActive(subjects, attempts, plan, floor, now) {
  if (!subjects.length) return [];
  const rows = subjects.map(s => {
    const m = mastery(attempts, s.id);
    let deficit = m === null ? 1 : 1 - m;
    if (calibration(attempts, s.id).overconfident) deficit = Math.min(1, deficit + 0.2);
    const days = daysUntil(examDateOf(s, plan), now);
    const inFinalWindow = days !== null && days >= 0 && days <= FINAL_WINDOW_DAYS;
    const weight = Number(s.ects) > 0 ? Number(s.ects) : LOAD_WEIGHT[s.load] || 5;
    return { id: s.id, weight, mastery: m, deficit: Math.max(deficit, 0.05), inFinalWindow, days };
  });

  // Exam next: double its priority so it leads, whatever its ECTS.
  const priority = rows.map(r => r.weight * r.deficit * (r.inFinalWindow ? 2 : 1));
  const total = priority.reduce((a, b) => a + b, 0);
  let share = priority.map(p => p / total);

  // Apply the floor, then renormalise the remaining subjects without pushing any below it.
  const effectiveFloor = Math.min(floor, 1 / rows.length);
  for (let i = 0; i < 10; i++) {
    const low = share.map(x => x < effectiveFloor);
    if (!low.some(Boolean)) break;
    const reserved = low.filter(Boolean).length * effectiveFloor;
    const freeTotal = share.reduce((a, x, j) => a + (low[j] ? 0 : x), 0);
    share = share.map((x, j) => (low[j] ? effectiveFloor : (x / freeTotal) * (1 - reserved)));
  }
  return rows.map((r, i) => ({ ...r, share: share[i] }));
}

// Used when a subject has no ECTS: rough workload equivalents.
export const LOAD_WEIGHT = { leve: 3, media: 5, alta: 7 };

// ── Priorities for the dashboard (R6 first) ─
// Overconfident before merely weak; then weakest; then nearest exam.
export function subjectPriorities(subjects, attempts, plan, now = new Date()) {
  return subjects.map(s => {
    const m = mastery(attempts, s.id);
    const cal = calibration(attempts, s.id);
    const split = practiceSplit(attempts, s.id);
    const days = daysUntil(examDateOf(s, plan), now);
    const lastProbe = attempts.filter(a => a.subject === s.id && a.kind === 'probe' && !a.assisted).sort((a, b) => b.at - a.at)[0];
    return {
      subject: s,
      mastery: m,
      calibration: cal,
      split,
      dependency: dependencyWarning(split),
      days,
      probeDue: !lastProbe || now - lastProbe.at > 7 * DAY,
    };
  }).sort((a, b) =>
    (b.calibration.overconfident - a.calibration.overconfident)
    // Measured-weak before not-yet-measured: a known gap is more actionable than an unknown.
    || ((a.mastery ?? 1.01) - (b.mastery ?? 1.01))
    || (upcoming(a.days) - upcoming(b.days)));
}

// Exams already sat go last; no date sorts after any real date.
function upcoming(days) {
  return days === null || days < 0 ? 99999 : days;
}
