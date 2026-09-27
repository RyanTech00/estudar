import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDocument, parseBackup } from '../public/js/backup.js';
import { normalizePlan } from '../public/js/data.js';

const XSS = '"><img src=x onerror=alert(1)>';

test('clean: stored-XSS payloads from the audit never survive', () => {
  const d = cleanDocument({
    examResults: { fp: { grade: XSS, at: 1 }, ok: { grade: 14.5, at: 2 } },
    plan: { subjects: [{ id: 'fp', name: 'FP', color: XSS }, { id: 'ed', name: 'ED', color: '#8ea7ff' }] },
    curriculum: {
      degree: 'LEI',
      targetAverage: XSS,
      ucs: [
        { id: `x${XSS}`, name: 'Bad id' },
        { id: 'uc1', name: 'OK', ects: XSS, year: XSS, grade: '<b>', assessments: [{ epoca: 'normal', date: `9999${XSS}`, weight: 50 }], prereqs: ['uc2', XSS] },
      ],
    },
  });
  assert.deepEqual(Object.keys(d.examResults), ['ok']);
  assert.equal(d.plan.subjects[0].color, undefined);
  assert.equal(d.plan.subjects[1].color, '#8ea7ff');
  assert.equal(d.curriculum.targetAverage, null);
  assert.deepEqual(d.curriculum.ucs.map(u => u.id), ['uc1']);
  const uc = d.curriculum.ucs[0];
  assert.equal(uc.ects, null);
  assert.equal(uc.year, 0);
  assert.equal(uc.grade, null);
  assert.equal(uc.assessments[0].date, '');
  assert.deepEqual(uc.prereqs, ['uc2']);
  assert.doesNotMatch(JSON.stringify(d), /onerror/);
});

test('clean: normalizePlan never passes a colour that is not a colour (CSS injection)', () => {
  const p = normalizePlan({ subjects: [{ id: 'a', name: 'A', color: '#fff;position:fixed;inset:0' }, { id: 'b', name: 'B', color: '#abc' }] });
  assert.match(p.subjects[0].color, /^#[0-9a-f]{3,8}$/i);
  assert.notEqual(p.subjects[0].color, '#fff;position:fixed;inset:0');
  assert.equal(p.subjects[1].color, '#abc');
});

test('clean: malformed data no longer crashes the app on every device', () => {
  const d = cleanDocument({
    plan: { subjects: [null, 'x', { id: 'fp', name: 'FP' }], weeklyPlan: [null, 1], phases: [null], tips: [null, 'legacy tip'] },
    curriculum: { ucs: [{ id: 'u1', name: 'U', assessments: 1, prereqs: 1 }, null] },
    timerConfig: { work: 'x', sessionsBeforeLong: 1e9 },
    attempts: [null, { id: 'a1', at: 1, subject: 'fp', kind: 'probe', done: 5, correct: 9 }],
    sessions: { '2026-09-28': { fp: { done: true } }, bad: 1 },
  });
  assert.doesNotThrow(() => normalizePlan(d.plan));
  assert.equal(d.plan.subjects.length, 1);
  assert.deepEqual(d.plan.tips, ['legacy tip']);
  assert.deepEqual(d.curriculum.ucs[0].assessments, []);
  assert.deepEqual(d.curriculum.ucs[0].prereqs, []);
  assert.equal(d.timerConfig.work, 40);
  assert.equal(d.timerConfig.sessionsBeforeLong, 8);
  assert.equal(d.attempts.length, 0);
  assert.deepEqual(Object.keys(d.sessions), ['2026-09-28']);
});

test('clean: unknown fields are dropped (only what the app uses is kept)', () => {
  const d = cleanDocument({ evil: { a: 1 }, settings: { sound: false, theme: XSS }, attempts: [{ id: 'a1', at: 1, subject: 'fp', kind: 'learn', done: 0, correct: 0, html: XSS }] });
  assert.equal('evil' in d, false);
  assert.deepEqual(d.settings, { sound: false });
  assert.equal('html' in d.attempts[0], false);
});

test('clean: backups go through the same cleaner', () => {
  const r = parseBackup(JSON.stringify({ app: 'estudar', version: 1, data: { examResults: { fp: { grade: XSS } } } }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.examResults, {});
});
