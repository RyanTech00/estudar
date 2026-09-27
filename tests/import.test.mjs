import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCurriculum, parseImageDataUrl } from '../worker/api.js';

test('import: model output is cleaned — grades 0–20 only, dates ISO only, empty names dropped', () => {
  const r = cleanCurriculum({
    degree: 'Licenciatura X',
    units: [
      { year: 1, semester: 1, name: 'Álgebra', ects: 6, grade: '12', date: '2024-12-17', gradeType: 'CC', group: '' },
      { year: 1, semester: 2, name: 'Discreta', ects: 6, grade: '', date: '', gradeType: '', group: '' },
      { year: 3, semester: 2, name: 'Estágio', ects: 16, grade: '25', date: '17/12/2024', gradeType: '', group: 'Trabalho Final' },
      { year: 1, semester: 1, name: '   ', ects: 3, grade: '10', date: '', gradeType: '', group: '' },
      { year: 1, semester: 1, name: 'Vírgula', ects: 5, grade: '13,5', date: '', gradeType: '', group: '' },
    ],
  });
  assert.equal(r.degree, 'Licenciatura X');
  assert.equal(r.units.length, 4);
  assert.equal(r.units[0].grade, 12);
  assert.equal(r.units[1].grade, null);
  assert.equal(r.units[2].grade, null);
  assert.equal(r.units[2].date, '');
  assert.equal(r.units[2].group, 'Trabalho Final');
  assert.equal(r.units[3].grade, 13.5);
});

test('import: only JPEG/PNG/WebP data URLs are accepted', () => {
  assert.deepEqual(parseImageDataUrl('data:image/png;base64,AAAA'), { mediaType: 'image/png', data: 'AAAA' });
  assert.throws(() => parseImageDataUrl('data:image/svg+xml;base64,AAAA'));
  assert.throws(() => parseImageDataUrl('https://example.com/x.png'));
});
