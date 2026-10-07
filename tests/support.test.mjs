import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan } from '../public/js/data.js';
import { withSupportDates, isSupport, allocation, eveOfExam } from '../public/js/learning.js';
import { manualEntry, editAttempt, topicMinutes } from '../public/js/agenda.js';
import { cleanDocument } from '../public/js/backup.js';

const PLAN = {
  startDate: '2026-09-21', examDate: '2027-01-20',
  subjects: [
    { id: 'ed', name: 'Estruturas de Dados', short: 'ED', examDate: '2027-01-12', ects: 6 },
    { id: 'so', name: 'Sistemas Operativos', short: 'SO', examDate: '2027-01-08', ects: 6 },
    { id: 'poo', name: 'Programação Orientada a Objetos', short: 'POO', examDate: '2027-02-01', supports: ['ed', 'so', 'poo', 'nope'] },
  ],
};

test('support subject: OOP is a foundation for DS and OS, with no exam of its own', () => {
  const plan = normalizePlan(PLAN);
  const poo = plan.subjects.find(s => s.id === 'poo');
  assert.deepEqual(poo.supports, ['ed', 'so']);              // itself and unknown ids dropped
  assert.equal(poo.examDate, '');                            // its own date is ignored
  assert.equal('supports' in plan.subjects[0], false);       // ordinary subjects are unchanged
  // It is needed until the first exam it supports (OS, 8 Jan).
  const dated = withSupportDates(plan.subjects, plan);
  assert.equal(dated.find(s => s.id === 'poo').derivedExamDate, '2027-01-08');
  assert.equal(isSupport(dated[2]), true);
  // Never "exam tomorrow", never doubled as "exam next".
  assert.deepEqual(eveOfExam(dated, plan, new Date('2027-01-07T10:00')).map(s => s.id), ['so']);
  const rows = allocation(dated, [], plan, { now: new Date('2027-01-03T10:00') });
  assert.equal(rows.find(r => r.id === 'poo').inFinalWindow, false);
  assert.equal(rows.find(r => r.id === 'so').inFinalWindow, true);
});

test('support subject: references follow renamed ids, and a support can\'t support another support', () => {
  const plan = normalizePlan({ ...PLAN, subjects: [
    { id: 'Data-Struct', name: 'ED', short: 'ED' },
    { id: 'poo', name: 'POO', short: 'POO', supports: ['Data-Struct'] },
    { id: 'x', name: 'Lógica', short: 'LOG', supports: ['poo'] },
  ] });
  assert.deepEqual(plan.subjects[1].supports, ['datastruct']);
  assert.equal('supports' in plan.subjects[2], false);
});

test('topic: "5 h of DS working on OOP" keeps the topic, sums by topic, and can be fixed later', () => {
  const r = manualEntry({ subject: 'ed', date: '2026-10-08', minutes: 300, activity: 'practice', topic: '  POO  ' }, Date.parse('2026-10-08T23:00:00'));
  assert.equal(r.attempt.topic, 'POO');
  assert.equal('topic' in manualEntry({ subject: 'ed', date: '2026-10-08', minutes: 30, activity: 'learn' }).attempt, false);
  const logs = [r.attempt, { subject: 'so', minutes: 60, topic: 'poo' }, { subject: 'ed', minutes: 45, topic: 'Recursividade' }, { subject: 'ed', minutes: 30 }];
  assert.deepEqual(topicMinutes(logs), [['POO', 360], ['Recursividade', 45]]);
  assert.equal(editAttempt({ ...r.attempt, id: 'a' }, { topic: 'Herança' }).topic, 'Herança');
  assert.equal('topic' in editAttempt({ ...r.attempt, id: 'a' }, { topic: '' }), false);
  // It survives sync and backups.
  const doc = cleanDocument({ attempts: [{ ...r.attempt, id: 'a1' }] });
  assert.equal(doc.attempts[0].topic, 'POO');
});
