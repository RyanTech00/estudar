import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, backupFilename } from '../public/js/backup.js';

const sample = {
  owner: 'uuid-da-pessoa',
  plan: { subjects: [{ id: 'fp', name: 'FP' }], weeklyPlan: [] },
  attempts: [{ id: 'a1', at: 1, subject: 'fp', kind: 'probe', done: 10, correct: 7, confidence: 3, assisted: false }],
  sessions: { '2026-09-27': { fp: { done: true, timestamp: 1 } } },
  focus: { '2026-09-27': { fp: 80 } },
  checklist: { W04: [true, false] },
  curriculum: { degree: 'X', targetAverage: 16, ucs: [{ id: 'u1', name: 'Álgebra' }] },
  examResults: { c2: { grade: 16, at: 2 } },
  timerConfig: { work: 40 },
  settings: { sound: true },
  updatedAt: 5,
};

test('backup: round-trips everything except the owner', () => {
  const text = buildBackup(sample, new Date('2026-09-27T10:00:00Z'));
  assert.equal(JSON.parse(text).data.owner, undefined);
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.summary, { attempts: 1, days: 1, subjects: 1, ucs: 1 });
  assert.deepEqual(r.data.focus, sample.focus);
  assert.equal(r.data.curriculum.targetAverage, 16);
});

test('backup: rejects files that are not ours, not JSON, or from a newer version', () => {
  assert.equal(parseBackup('não é json').ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: 'outra', data: {} })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: 'estudar', version: 99, data: {} })).ok, false);
});

test('backup: invalid rows are dropped, not trusted', () => {
  const r = parseBackup(JSON.stringify({
    app: 'estudar', version: 1,
    data: {
      attempts: [
        { id: 'ok', at: 1, subject: 'fp', kind: 'practice', done: 3, correct: 2 },
        { id: 'too-many', at: 1, subject: 'fp', kind: 'practice', done: 3, correct: 9 },
        { id: 'bad-kind', at: 1, subject: 'fp', kind: 'hack', done: 1, correct: 1 },
        'string',
      ],
      focus: { '2026-09-27': { fp: 60, x: -5, y: 'lots' }, 'not-a-day': { fp: 10 } },
      examResults: { a: { grade: 25 }, b: { grade: 14 } },
      checklist: { W01: [1, 0], bogus: [true] },
    },
  }));
  assert.deepEqual(r.data.attempts.map(a => a.id), ['ok']);
  assert.deepEqual(r.data.focus, { '2026-09-27': { fp: 60 } });
  assert.deepEqual(Object.keys(r.data.examResults), ['b']);
  assert.deepEqual(r.data.checklist, { W01: [true, false] });
});

test('backup: filename carries the local date', () => {
  assert.equal(backupFilename(new Date(2026, 8, 7)), 'estudar-2026-09-07.json');
});
