// Guard tests for the learning-science rules. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mastery, practiceSplit, dependencyWarning, calibration, allocation,
  eveOfExam, subjectPriorities, isValidAttempt,
} from '../public/js/learning.js';

const DAY = 86400000;
const NOW = new Date('2026-11-10T12:00:00');
let id = 0;
const att = (o) => ({ id: String(id++), at: NOW.getTime() - DAY, confidence: null, assisted: false, done: 10, correct: 5, ...o });

test('R7: mastery uses only unassisted probes', () => {
  const list = [
    att({ subject: 'fp', kind: 'practice', correct: 10 }),               // practice never counts
    att({ subject: 'fp', kind: 'probe', assisted: true, correct: 10 }),  // assisted probe never counts
    att({ subject: 'fp', kind: 'learn', done: 0, correct: 0 }),          // reading never counts (R8)
    att({ subject: 'fp', kind: 'probe', correct: 4 }),
  ];
  assert.equal(mastery(list, 'fp'), 0.4);
});

test('R7: no probe means unknown mastery, not zero or full', () => {
  assert.equal(mastery([att({ subject: 'ed', kind: 'practice', correct: 9 })], 'ed'), null);
});

test('R7: assisted practice is reported apart and never inflates mastery', () => {
  const list = [
    att({ subject: 'so', kind: 'practice', assisted: true, correct: 9 }),
    att({ subject: 'so', kind: 'practice', assisted: false, correct: 3 }),
    att({ subject: 'so', kind: 'probe', correct: 3 }),
  ];
  const s = practiceSplit(list, 'so');
  assert.equal(s.assisted, 0.9);
  assert.equal(s.unassisted, 0.3);
  assert.equal(mastery(list, 'so'), 0.3);
});

test('R7: dependency warning when help drives the results', () => {
  const list = [
    ...Array.from({ length: 4 }, () => att({ subject: 'x', kind: 'practice', assisted: true, correct: 9 })),
    att({ subject: 'x', kind: 'practice', assisted: false, correct: 4 }),
  ];
  assert.equal(dependencyWarning(practiceSplit(list, 'x')), true);
  const honest = Array.from({ length: 5 }, () => att({ subject: 'y', kind: 'practice', correct: 6 }));
  assert.equal(dependencyWarning(practiceSplit(honest, 'y')), false);
});

test('R6: overconfidence is detected from confidence given before correcting', () => {
  const over = Array.from({ length: 3 }, () => att({ subject: 'fp', kind: 'practice', confidence: 4, correct: 4 }));
  assert.equal(calibration(over, 'fp').overconfident, true);
  const fair = Array.from({ length: 3 }, () => att({ subject: 'fp', kind: 'practice', confidence: 3, correct: 7 }));
  assert.equal(calibration(fair, 'fp').overconfident, false);
});

test('R6: overconfident subjects come first on the dashboard, above merely weak ones', () => {
  const subjects = [{ id: 'weak', load: 'media' }, { id: 'over', load: 'media' }];
  const list = [
    att({ subject: 'weak', kind: 'probe', correct: 2, confidence: 1 }),
    ...Array.from({ length: 3 }, () => att({ subject: 'over', kind: 'probe', correct: 5, confidence: 4 })),
  ];
  const order = subjectPriorities(subjects, list, {}, NOW).map(p => p.subject.id);
  assert.deepEqual(order, ['over', 'weak']);
});

test('dashboard: among unmeasured subjects, the nearest upcoming exam comes first and past exams last', () => {
  const subjects = [{ id: 'past', examDate: '2026-11-01' }, { id: 'later', examDate: '2026-12-01' }, { id: 'soon', examDate: '2026-11-12' }];
  assert.deepEqual(subjectPriorities(subjects, [], {}, NOW).map(p => p.subject.id), ['soon', 'later', 'past']);
});

test('R9: high ECTS but mastered gets less time than low ECTS and failing', () => {
  const subjects = [{ id: 'big', ects: 7 }, { id: 'small', ects: 4 }];
  const list = [
    att({ subject: 'big', kind: 'probe', correct: 9 }),
    att({ subject: 'small', kind: 'probe', correct: 2 }),
  ];
  const [big, small] = allocation(subjects, list, {}, { now: NOW });
  assert.ok(small.share > big.share);
});

test('R9: before any probe, allocation is proportional to ECTS', () => {
  const [a, b] = allocation([{ id: 'a', ects: 6 }, { id: 'b', ects: 3 }], [], {}, { now: NOW });
  assert.ok(Math.abs(a.share - 2 / 3) < 1e-9);
  assert.ok(Math.abs(b.share - 1 / 3) < 1e-9);
});

test('R9: no subject falls below the floor, and shares sum to 1', () => {
  const subjects = [{ id: 'a', ects: 30 }, { id: 'b', ects: 1 }, { id: 'c', ects: 1 }, { id: 'd', ects: 6 }];
  const rows = allocation(subjects, [], {}, { now: NOW, floor: 0.1 });
  for (const r of rows) assert.ok(r.share >= 0.1 - 1e-9, `${r.id} ${r.share}`);
  assert.ok(Math.abs(rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-9);
});

test('R3 over R9: the subject whose exam is next gets priority regardless of ECTS', () => {
  const plan = {};
  const subjects = [{ id: 'heavy', ects: 7, examDate: '2027-01-20' }, { id: 'light', ects: 2, examDate: '2026-11-14' }];
  const [heavy, light] = allocation(subjects, [], plan, { now: NOW });
  assert.ok(light.inFinalWindow);
  assert.ok(!heavy.inFinalWindow);
  const noDeadline = allocation(subjects.map(s => ({ ...s, examDate: '2027-02-01' })), [], plan, { now: NOW });
  assert.ok(light.share > noDeadline[1].share);
});

test('R9: a subject whose exam has passed gets no time and no floor', () => {
  const rows = allocation([{ id: 'done', ects: 6, examDate: '2026-11-01' }, { id: 'a', ects: 6 }, { id: 'b', ects: 6 }], [], {}, { now: NOW });
  assert.equal(rows.find(r => r.id === 'done').share, 0);
  assert.ok(Math.abs(rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-9);
});

test('R3: the day before an exam is flagged review-only', () => {
  const subjects = [{ id: 'fp', examDate: '2026-11-11' }, { id: 'ed', examDate: '2026-11-20' }];
  assert.deepEqual(eveOfExam(subjects, {}, NOW).map(s => s.id), ['fp']);
});

test('R3: subjects without their own date fall back to the plan exam date', () => {
  assert.deepEqual(eveOfExam([{ id: 'x' }], { examDate: '2026-11-11' }, NOW).map(s => s.id), ['x']);
});

test('attempts: correct can never exceed attempted', () => {
  assert.equal(isValidAttempt(att({ subject: 'a', kind: 'practice', done: 3, correct: 4 })), false);
  assert.equal(isValidAttempt(att({ subject: 'a', kind: 'practice', done: 3, correct: 3 })), true);
});
