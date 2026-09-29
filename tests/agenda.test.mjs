import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayAgenda, postpone, undoPostpone, weekSummary, manualEntry, minutesBetween, movedKey,
  activeBacklog, setBacklog, mergeByAt, mergePostponed, addDays,
} from '../public/js/agenda.js';

// Tuesday 29 Sep 2026: ED, SO, FP planned. Wednesday: FP.
const PLAN = {
  '2026-09-29': [{ id: 'ed', subject: 'ed' }, { id: 'so', subject: 'so' }, { id: 'fp', subject: 'fp' }],
  '2026-09-30': [{ id: 'fp', subject: 'fp' }],
};
const planned = (d) => PLAN[d] || [];
const TUE = '2026-09-29';
const WED = '2026-09-30';

test('agenda: postponing moves one occurrence to another day, without touching the weekly plan', () => {
  const tue = dayAgenda(planned, TUE, {});
  const so = tue.sessions.find(s => s.id === 'so');
  const p = postpone({}, TUE, so, WED, 1);

  const tueAfter = dayAgenda(planned, TUE, p);
  assert.deepEqual(tueAfter.sessions.map(s => s.id), ['ed', 'fp']);
  assert.deepEqual(tueAfter.movedOut.map(s => [s.id, s.movedTo]), [['so', WED]]);

  const wed = dayAgenda(planned, WED, p);
  assert.deepEqual(wed.sessions.map(s => [s.id, s.movedFrom]), [['fp', null], ['so', TUE]]);
  // Wednesday's own FP and the moved SO keep separate done-states.
  assert.equal(wed.sessions[1].key, movedKey(TUE, 'so'));
  assert.equal(planned(WED).length, 1);
});

test('agenda: moving a moved session again keeps its origin (no duplicates); skipping and undo', () => {
  const so = dayAgenda(planned, TUE, {}).sessions.find(s => s.id === 'so');
  let p = postpone({}, TUE, so, WED, 1);
  const soOnWed = dayAgenda(planned, WED, p).sessions.find(s => s.id === 'so');
  p = postpone(p, WED, soOnWed, '2026-10-01', 2);
  assert.deepEqual(Object.keys(p), [TUE]);
  assert.equal(dayAgenda(planned, WED, p).sessions.some(s => s.id === 'so'), false);
  assert.equal(dayAgenda(planned, '2026-10-01', p).sessions[0].movedFrom, TUE);

  p = postpone(p, TUE, so, null, 3);                    // "not this week"
  assert.equal(dayAgenda(planned, TUE, p).movedOut[0].movedTo, null);
  p = undoPostpone(p, TUE, 'so', 4);                    // back home
  assert.deepEqual(dayAgenda(planned, TUE, p).sessions.map(s => s.id), ['ed', 'so', 'fp']);
});

test('agenda: the week as it went — done, moved, skipped, missed, pending', () => {
  const fp = { id: 'fp', subject: 'fp' };
  let p = postpone({}, TUE, { id: 'so', subject: 'so' }, WED, 1);
  p = postpone(p, TUE, fp, null, 1);
  const done = new Set([`${TUE}|ed`]);
  const isDone = (d, k) => done.has(`${d}|${k}`);
  assert.deepEqual(weekSummary(planned, [TUE, WED], p, isDone, WED), { planned: 4, done: 1, moved: 1, skipped: 1, missed: 0, pending: 1 });
  done.add(`${WED}|${movedKey(TUE, 'so')}`);
  assert.equal(weekSummary(planned, [TUE, WED], p, isDone, WED).done, 2);
  // Nothing done, nothing moved, the day has passed → missed.
  assert.equal(weekSummary(planned, [TUE], {}, () => false, WED).missed, 3);
});

test('agenda: two devices — the newest change to each entry wins, undo included', () => {
  const a = { [TUE]: { so: { to: WED, at: 1 } } };
  const b = { [TUE]: { so: { to: TUE, at: 2 }, fp: { to: null, at: 1 } } };
  const m = mergePostponed(a, b);
  assert.deepEqual(m[TUE].so, { to: TUE, at: 2 });
  assert.equal(m[TUE].fp.to, null);
  assert.deepEqual(mergeByAt({ x: { at: 5, v: 1 } }, { x: { at: 3, v: 2 } }).x.v, 1);
});

test('manual entry: 17:20–19:45 of ED counts as 145 minutes, dated that day, off the plan', () => {
  assert.equal(minutesBetween('17:20', '19:45'), 145);
  assert.equal(minutesBetween('23:30', '00:15'), 45);
  assert.equal(minutesBetween('9:00', 'x'), null);
  const r = manualEntry({ subject: 'ed', date: TUE, minutes: 145, activity: 'learn', note: 'aulas em atraso: pilhas e filas' }, Date.parse('2026-09-30T12:00:00'));
  assert.equal(r.minutes, 145);
  assert.equal(r.attempt.kind, 'learn');
  assert.equal(r.attempt.done, 0);
  assert.equal(r.attempt.manual, true);
  assert.equal(r.attempt.confidence, null);   // never feeds calibration
  assert.equal(new Date(r.attempt.at).toISOString().slice(0, 10), TUE);
});

test('manual entry: exercises keep attempted/correct and help; bad input is refused', () => {
  const r = manualEntry({ subject: 'ed', date: TUE, minutes: 90, activity: 'practice', done: 12, correct: 20, assisted: true });
  assert.equal(r.attempt.kind, 'practice');
  assert.deepEqual([r.attempt.done, r.attempt.correct, r.attempt.assisted], [12, 12, true]);
  assert.equal(manualEntry({ subject: 'ed', date: TUE, minutes: 0, activity: 'learn' }).error, 'minutes');
  assert.equal(manualEntry({ subject: 'ed', date: 'ontem', minutes: 30, activity: 'learn' }).error, 'date');
  assert.equal(manualEntry({ subject: '', date: TUE, minutes: 30, activity: 'learn' }).error, 'subject');
  assert.equal(manualEntry({ subject: 'ed', date: TUE, minutes: 30, activity: 'reread' }).error, 'activity');
});

test('backlog: set, clear and list the subjects that are behind', () => {
  let b = setBacklog({}, 'fp', 'aulas 3 a 5', 1);
  b = setBacklog(b, 'ed', 'pilhas', 1);
  assert.deepEqual(activeBacklog(b), { fp: 'aulas 3 a 5', ed: 'pilhas' });
  b = setBacklog(b, 'ed', null, 2);
  assert.deepEqual(activeBacklog(b), { fp: 'aulas 3 a 5' });
  assert.equal(b.ed.cleared, true);            // a cleared entry still syncs, so the other device learns it
  assert.equal(addDays(TUE, 1), WED);
});

test('fixing a log: attempted, correct and note change; confidence, help and kind never do', async () => {
  const { editAttempt } = await import('../public/js/agenda.js');
  const probe = { id: 'p1', at: 1, subject: 'ed', kind: 'probe', done: 5, correct: 4, confidence: 3, assisted: false };
  const fixed = editAttempt(probe, { done: 8, correct: 6, note: 'eram 8, não 5', confidence: 1, assisted: true, kind: 'learn' }, 99);
  assert.deepEqual([fixed.done, fixed.correct, fixed.note, fixed.edited], [8, 6, 'eram 8, não 5', 99]);
  assert.deepEqual([fixed.confidence, fixed.assisted, fixed.kind], [3, false, 'probe']);
  assert.equal(editAttempt(probe, { done: 3 }).correct, 3);              // correct follows a smaller attempted count
  const learn = editAttempt({ id: 'l', kind: 'learn', done: 0, correct: 0 }, { done: 9, correct: 9 });
  assert.deepEqual([learn.done, learn.correct], [0, 0]);                 // first exposure has no exercises
});

test('fixing a log on one device reaches the other; a deleted log does not come back', async () => {
  const { editAttempt, deleteAttempt, mergeAttempts } = await import('../public/js/agenda.js');
  const original = { id: 'b1', at: 10, subject: 'ed', kind: 'practice', done: 5, correct: 3 };
  const phone = [editAttempt(original, { done: 8 }, 50)];
  const laptop = [original, { id: 'b2', at: 20, subject: 'so', kind: 'learn', done: 0, correct: 0 }];
  const m = mergeAttempts(laptop, phone);
  assert.equal(m.find(a => a.id === 'b1').done, 8);
  assert.equal(m.length, 2);
  const gone = mergeAttempts([deleteAttempt(original, 60)], [original]);
  assert.equal(gone[0].deleted, true);
  // Untouched copies on both sides: the second list wins on a tie (the local copy in mergeData).
  assert.equal(mergeAttempts([{ ...original, note: 'a' }], [{ ...original, note: 'b' }])[0].note, 'b');
});
