import test from 'node:test';
import assert from 'node:assert/strict';
import {
  average, requiredForTarget, computedGrade, effectiveGrade, ucStatus, nextAssessmentDate,
  needsRetakeDate, weakPrereqs, structure, roundGrade, acronym,
} from '../public/js/curriculum.js';

const NOW = new Date('2026-11-10T12:00:00');
let n = 0;
const uc = (o) => ({ id: `u${n++}`, name: 'UC', ects: 6, year: 1, semester: 1, grade: null, gradeType: '', passGrade: 9.5, assessments: [], prereqs: [], inPlan: false, ...o });

// A real transcript (ECTS, grade) whose academic services show "16.57 (78 ECTS)".
const TRANSCRIPT = [[6, 12], [3, 14], [5, 11], [7, 20], [7, 15], [6, 18], [7, 17], [6, 17], [7, 17], [7, 18], [6, 19], [6, 16], [5, 19]]
  .map(([ects, grade]) => uc({ ects, grade, gradeType: 'CC' }));

test('average matches the academic services: ECTS-weighted, truncated to 2 decimals', () => {
  const pending = [uc({ ects: 7 }), uc({ ects: 5 })];
  assert.deepEqual({ ...average([...TRANSCRIPT, ...pending]), exact: undefined }, { average: 16.57, ects: 78, exact: undefined });
});

test('failed and ungraded UCs do not enter the average', () => {
  const list = [uc({ ects: 6, grade: 16 }), uc({ ects: 6, grade: 8 }), uc({ ects: 6 })];
  assert.equal(average(list).average, 16);
});

test('to not lower 16.57, every new UC needs at least 17', () => {
  assert.equal(requiredForTarget(TRANSCRIPT, null).keep, 17);
});

test('target average: required mean over the remaining ECTS', () => {
  const list = [uc({ ects: 10, grade: 14 }), uc({ ects: 10 })];
  const r = requiredForTarget(list, 16);
  assert.equal(r.needed, 18);
  assert.equal(r.reachable, true);
});

test('optional groups only count when chosen (Estágio OR Projeto, not both)', () => {
  const list = [uc({ ects: 10, grade: 15 }), uc({ ects: 16, optional: true }), uc({ ects: 16, optional: true, inPlan: true })];
  assert.equal(requiredForTarget(list, 15).remainingEcts, 16);
});

test('grades round .5 up, like official UC grades', () => {
  assert.equal(roundGrade(9.5), 10);
  assert.equal(roundGrade(9.49), 9);
});

test('continuous assessment: weighted by component, minimum grade enforced', () => {
  const ok = uc({ assessments: [
    { id: 'a', epoca: 'normal', weight: 40, grade: 12, minGrade: 7.5 },
    { id: 'b', epoca: 'normal', weight: 60, grade: 15, minGrade: 7.5 },
  ] });
  assert.equal(computedGrade(ok).grade, 13.8);
  assert.equal(effectiveGrade(ok), 14);
  assert.equal(ucStatus(ok), 'aprovada');

  const belowMin = uc({ assessments: [
    { id: 'a', epoca: 'normal', weight: 50, grade: 7, minGrade: 7.5 },
    { id: 'b', epoca: 'normal', weight: 50, grade: 19, minGrade: 7.5 },
  ] });
  assert.equal(ucStatus(belowMin), 'reprovada');
});

test('failing the first component below its minimum already means reprovada, before the second', () => {
  const x = uc({ assessments: [
    { id: 'a', epoca: 'normal', weight: 50, grade: 6, minGrade: 7.5, date: '2026-11-01' },
    { id: 'b', epoca: 'normal', weight: 50, grade: null, date: '2026-12-01' },
  ] });
  assert.equal(ucStatus(x), 'reprovada');
});

test('below 9.5 fails; the recurso exam replaces the normal-period result', () => {
  const failed = uc({ assessments: [{ id: 'e', epoca: 'normal', weight: 100, grade: 9.4, date: '2026-11-01' }] });
  assert.equal(ucStatus(failed), 'reprovada');
  assert.equal(needsRetakeDate(failed, NOW), true);

  const withRecurso = uc({ assessments: [...failed.assessments, { id: 'r', epoca: 'recurso', weight: 100, grade: null, date: '2026-11-25' }] });
  assert.equal(nextAssessmentDate(withRecurso, NOW), '2026-11-25');
  assert.equal(needsRetakeDate(withRecurso, NOW), false);

  const passedRecurso = uc({ assessments: [...failed.assessments, { id: 'r', epoca: 'recurso', weight: 100, grade: 13, date: '2026-11-25' }] });
  assert.equal(effectiveGrade(passedRecurso), 13);
  assert.equal(ucStatus(passedRecurso), 'aprovada');
});

test('per-UC pass grade is respected', () => {
  assert.equal(ucStatus(uc({ grade: 9.5 })), 'aprovada');
  assert.equal(ucStatus(uc({ grade: 9.5, passGrade: 10 })), 'reprovada');
});

test('next exam date is the earliest ungraded future assessment; none once approved', () => {
  const x = uc({ assessments: [
    { id: 'a', epoca: 'normal', date: '2026-10-01', grade: 14, weight: 50 },
    { id: 'b', epoca: 'normal', date: '2026-12-10', grade: null, weight: 50 },
    { id: 'c', epoca: 'normal', date: '2026-11-20', grade: null, weight: 0 },
  ] });
  assert.equal(nextAssessmentDate(x, NOW), '2026-11-20');
  assert.equal(nextAssessmentDate(uc({ grade: 15 }), NOW), '');
});

test('prerequisites: not done, failed or below 12 are weak; a good grade is not', () => {
  const good = uc({ grade: 16 });
  const low = uc({ grade: 10 });
  const notDone = uc({});
  const failed = uc({ grade: 8 });
  const target = uc({ prereqs: [good.id, low.id, notDone.id, failed.id] });
  const weak = weakPrereqs(target, [good, low, notDone, failed, target]);
  assert.deepEqual(weak.map(w => w.reason).sort(), ['nota baixa', 'por fazer', 'reprovada']);
  assert.ok(!weak.some(w => w.uc.id === good.id));
});

test('structure groups years and semesters with their averages', () => {
  const list = [uc({ year: 1, semester: 1, grade: 14, ects: 6 }), uc({ year: 1, semester: 2, grade: 18, ects: 6 }), uc({ year: 2, semester: 1, ects: 6 })];
  const [y1, y2] = structure(list);
  assert.equal(y1.average, 16);
  assert.deepEqual(y1.semesters.map(s => s.average), [14, 18]);
  assert.equal(y1.semesters[0].complete, true);
  assert.equal(y2.average, null);
});

test('acronym', () => {
  assert.equal(acronym('Estruturas de Dados'), 'ED');
  assert.equal(acronym('Processamento Estruturado de Informação'), 'PEI');
});

import { enrichWithCurriculum, planSubjectsFromCurriculum } from '../public/js/curriculum.js';
import { examDateOf } from '../public/js/learning.js';

test('plan link: exam date comes from the next assessment unless set by hand; weak prereqs attached', () => {
  const prog = uc({ id: 'prog', name: 'Programação', grade: 10 });
  const ed = uc({ id: 'ed', name: 'Estruturas de Dados', prereqs: ['prog'], inPlan: true,
    assessments: [{ id: 'x', epoca: 'normal', weight: 100, date: '2027-01-15', grade: null }] });
  const [auto, manual] = enrichWithCurriculum([{ id: 'ed', ucId: 'ed', examDate: '' }, { id: 'ed2', ucId: 'ed', examDate: '2027-02-01' }], [prog, ed], NOW);
  assert.equal(examDateOf(auto, {}), '2027-01-15');
  assert.equal(examDateOf(manual, {}), '2027-02-01');
  assert.equal(auto.examDate, '');
  assert.deepEqual(auto.prereqWeak.map(w => w.reason), ['nota baixa']);
});

test('plan link: only UCs taken now and not yet approved become plan subjects', () => {
  const list = [uc({ id: 'a', name: 'A B', inPlan: true }), uc({ id: 'b', name: 'Feita', inPlan: true, grade: 15 }), uc({ id: 'c', name: 'Depois' })];
  assert.deepEqual(planSubjectsFromCurriculum(list).map(s => s.id), ['a']);
});

test('after failing a minimum, the remaining normal-period tests no longer set the exam date — the retake does', () => {
  const x = uc({ assessments: [
    { id: 'a', epoca: 'normal', weight: 40, minGrade: 7.5, grade: 6, date: '2026-11-05' },
    { id: 'b', epoca: 'normal', weight: 60, minGrade: 7.5, grade: null, date: '2027-01-10' },
    { id: 'r', epoca: 'recurso', weight: 100, grade: null, date: '2027-02-05' },
  ] });
  assert.equal(nextAssessmentDate(x, NOW), '2027-02-05');
});
