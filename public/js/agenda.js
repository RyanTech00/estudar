// The plan meets real life: sessions moved to another day or skipped, study done outside the plan,
// and subjects that are behind. Pure functions (dates as 'YYYY-MM-DD'), unit-tested; storage.js keeps the data.
//
// data.postponed = { [fromDate]: { [sessionId]: { to: 'YYYY-MM-DD' | null, at } } }
//   A session planned for fromDate moves to `to`, or is skipped (to = null); to = fromDate means "back home"
//   (an undo that still syncs: the newest entry wins on every device). Only that one occurrence: the weekly
//   plan itself never changes.
// data.backlog   = { [subjectId]: { note, at, cleared } }
//   "Matéria em atraso": gives the subject priority until it's marked caught up.
// Manual entries are ordinary attempts with activity/manual/note (see manualEntry).

export const isDateKey = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function keyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const dateOf = (key) => new Date(`${key}T00:00`);

export function addDays(key, n) {
  const d = dateOf(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

// Done-state key for a session moved in from another day. Only [a-z0-9-], so it survives the data cleaner.
export const movedKey = (fromDate, id) => `m${fromDate.replace(/-/g, '')}-${id}`;

// ── A day's sessions ──────────────────
// planned(dateKey) → that date's sessions from the weekly plan ({ id, subject, … }).
// Returns what to show for `date`:
//   sessions: the day's own sessions that weren't moved or skipped, plus sessions moved IN from other days
//             (movedFrom set, key = movedKey). `key` is what done-state is stored under.
//   movedOut: the day's own sessions that were moved elsewhere or skipped (movedTo = date | null).
export function dayAgenda(planned, date, postponed = {}) {
  const own = planned(date);
  const outMap = postponed[date] || {};
  const away = (s) => outMap[s.id] && outMap[s.id].to !== date;
  const sessions = own.filter(s => !away(s)).map(s => ({ ...s, key: s.id, movedFrom: null }));
  const movedOut = own.filter(away).map(s => ({ ...s, movedTo: outMap[s.id].to }));
  for (const [from, map] of Object.entries(postponed)) {
    if (from === date) continue;
    for (const [id, entry] of Object.entries(map || {})) {
      if (entry?.to !== date) continue;
      const original = planned(from).find(s => s.id === id);
      if (original) sessions.push({ ...original, key: movedKey(from, id), movedFrom: from });
    }
  }
  return { sessions, movedOut };
}

// Moving a session that was itself moved keeps its origin, so it never duplicates.
// session: an item from dayAgenda().sessions; to: date key, or null to skip it.
export function postpone(postponed, date, session, to, at = Date.now()) {
  const from = session.movedFrom || date;
  return { ...postponed, [from]: { ...(postponed[from] || {}), [session.id]: { to: to === undefined ? null : to, at } } };
}

// Back to its own day.
export function undoPostpone(postponed, from, id, at = Date.now()) {
  if (!postponed[from]?.[id]) return postponed;
  return { ...postponed, [from]: { ...postponed[from], [id]: { to: from, at } } };
}

// ── A week, as it actually went ───────
// For each session planned in `dates`: done (on its day or where it was moved), moved (not done yet),
// skipped, missed (its day is past, nothing done) or pending (today or later).
export function weekSummary(planned, dates, postponed, isDone, today) {
  const out = { planned: 0, done: 0, moved: 0, skipped: 0, missed: 0, pending: 0 };
  for (const date of dates) {
    for (const s of planned(date)) {
      out.planned++;
      const entry = postponed[date]?.[s.id];
      const moved = entry && entry.to !== date ? entry : null;
      if (moved) {
        if (moved.to === null) out.skipped++;
        else if (isDone(moved.to, movedKey(date, s.id))) out.done++;
        else out.moved++;
      } else if (isDone(date, s.id)) out.done++;
      else if (date < today) out.missed++;
      else out.pending++;
    }
  }
  return out;
}

// ── Study done outside the plan ───────
export const ACTIVITIES = ['learn', 'practice', 'review'];

// A manual entry becomes focus minutes + one attempt. Exercises can carry attempted/correct; confidence
// stays out (it only means something when given before correcting), so calibration never uses these.
// Returns { minutes, date, attempt } or { error }.
export function manualEntry({ subject, date, minutes, activity, done = 0, correct = 0, assisted = false, note = '' }, now = Date.now()) {
  const mins = Math.round(Number(minutes));
  if (!subject) return { error: 'subject' };
  if (!isDateKey(date)) return { error: 'date' };
  if (!(mins >= 1 && mins <= 720)) return { error: 'minutes' };
  if (!ACTIVITIES.includes(activity)) return { error: 'activity' };
  const tried = activity === 'learn' ? 0 : Math.max(0, Math.min(999, Math.round(Number(done) || 0)));
  const right = Math.max(0, Math.min(tried, Math.round(Number(correct) || 0)));
  const at = Math.min(now, dateOf(date).getTime() + 20 * 3600000);  // a past date is dated that evening
  return {
    minutes: mins,
    date,
    attempt: {
      subject,
      kind: activity === 'learn' ? 'learn' : 'practice',
      activity,
      done: tried,
      correct: right,
      confidence: null,
      assisted: activity !== 'learn' && assisted === true,
      minutes: mins,
      manual: true,
      note: String(note || '').trim().slice(0, 500),
      at,
    },
  };
}

// Minutes between two 'HH:MM' times; past midnight wraps (22:30 → 00:15 = 105).
export function minutesBetween(from, to) {
  const m = (s) => (/^\d{1,2}:\d{2}$/.test(s || '') ? Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]) : null);
  const a = m(from);
  const b = m(to);
  if (a === null || b === null) return null;
  const diff = (b - a + 1440) % 1440;
  return diff || null;
}

// ── Behind in a subject ───────────────
export function activeBacklog(backlog = {}) {
  return Object.fromEntries(Object.entries(backlog).filter(([, b]) => b && !b.cleared).map(([id, b]) => [id, b.note || '']));
}

export function setBacklog(backlog, subjectId, note, at = Date.now()) {
  return { ...backlog, [subjectId]: note === null ? { note: '', at, cleared: true } : { note: String(note || '').trim().slice(0, 200), at, cleared: false } };
}

// Two devices: per entry, the most recent change wins.
export function mergeByAt(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || (v?.at || 0) > (out[k]?.at || 0)) out[k] = v;
  return out;
}

export function mergePostponed(a = {}, b = {}) {
  const out = {};
  for (const from of new Set([...Object.keys(a), ...Object.keys(b)])) out[from] = mergeByAt(a[from], b[from]);
  return out;
}

// ── Fixing a log after the fact ───────
// Attempted, correct and the note can be fixed (they're facts, typed by hand). Confidence and help can't:
// they were given before checking the answers, and changing them later would make calibration meaningless.
export function editAttempt(attempt, { done, correct, note } = {}, now = Date.now()) {
  const out = { ...attempt, edited: now };
  if (attempt.kind !== 'learn') {
    if (done !== undefined) out.done = Math.max(0, Math.min(999, Math.round(Number(done) || 0)));
    if (correct !== undefined) out.correct = Math.round(Number(correct) || 0);
    out.correct = Math.max(0, Math.min(out.done, out.correct));
  }
  if (note !== undefined) out.note = String(note || '').trim().slice(0, 500);
  return out;
}

// Deleting keeps a marker, so the other devices learn about it instead of bringing the log back.
export const deleteAttempt = (attempt, now = Date.now()) => ({ ...attempt, deleted: true, edited: now });

// Logs from two devices: union by id; when both have the same log, the latest edit wins.
export function mergeAttempts(a = [], b = []) {
  const byId = new Map();
  for (const x of [...a, ...b]) {
    if (!x?.id) continue;
    const prev = byId.get(x.id);
    if (!prev || (x.edited || 0) >= (prev.edited || 0)) byId.set(x.id, x);
  }
  return [...byId.values()].sort((x, y) => x.at - y.at);
}
