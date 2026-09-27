// Degree record ("percurso"): UCs across years/semesters, their assessments and grades.
// Pure functions, no DOM or storage, so they can be unit-tested.
//
// uc = {
//   id, name, short, ects, year, semester, optional (bool: part of an "opção"/final-work group),
//   grade: number|null        official final grade (transcript, CC/equivalência, or confirmed)
//   gradeType: 'CC'|'exame'|'avaliação'|''
//   gradeDate: 'YYYY-MM-DD'|''
//   passGrade: 9.5            school default; per UC
//   assessments: [{ id, name, kind, epoca: 'normal'|'recurso'|'especial', date, weight, minGrade, grade }]
//   prereqs: [ucId], inPlan: bool
// }

export const DEFAULT_PASS = 9.5;
// Heuristic, not learning science: below this a prerequisite is treated as a weak foundation.
export const PREREQ_OK_GRADE = 12;

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Portuguese final UC grades are integers, .5 rounds up (9.5 → 10).
export const roundGrade = (g) => Math.floor(g + 0.5);
// Averages are shown truncated to 2 decimals, the way the academic services display them.
export const truncate2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

// Final grade from the assessments, when they are complete enough to say.
export function computedGrade(uc) {
  const list = uc.assessments || [];
  // A graded recurso/especial exam replaces the normal-period result.
  const retake = list.filter(a => a.epoca !== 'normal' && isNum(a.grade)).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (retake) return { grade: retake.grade, rounded: roundGrade(retake.grade), complete: true, failedMin: false, epoca: retake.epoca };

  const normal = list.filter(a => a.epoca === 'normal' || !a.epoca);
  if (!normal.length) return { grade: null, rounded: null, complete: false, failedMin: false };
  const graded = normal.filter(a => isNum(a.grade));
  const failedMin = graded.some(a => isNum(a.minGrade) && a.grade < a.minGrade);
  if (graded.length < normal.length) return { grade: null, rounded: null, complete: false, failedMin };
  const totalW = normal.reduce((s, a) => s + (Number(a.weight) || 0), 0);
  const grade = totalW > 0
    ? normal.reduce((s, a) => s + a.grade * (Number(a.weight) || 0), 0) / totalW
    : normal.reduce((s, a) => s + a.grade, 0) / normal.length;
  return { grade, rounded: roundGrade(grade), complete: true, failedMin, epoca: 'normal' };
}

// Official grade wins; otherwise a complete computation.
export function effectiveGrade(uc) {
  if (isNum(uc.grade)) return uc.grade;
  const c = computedGrade(uc);
  return c.complete ? c.rounded : null;
}

export function ucStatus(uc) {
  const pass = isNum(uc.passGrade) ? uc.passGrade : DEFAULT_PASS;
  const c = computedGrade(uc);
  const g = effectiveGrade(uc);
  if (isNum(g)) {
    const failed = g < pass || (!isNum(uc.grade) && c.failedMin);
    if (!failed) return uc.gradeType === 'CC' ? 'creditada' : 'aprovada';
    return 'reprovada';
  }
  if (c.failedMin) return 'reprovada';
  return uc.inPlan ? 'em_curso' : 'por_fazer';
}

export const isApproved = (uc) => ['aprovada', 'creditada'].includes(ucStatus(uc));

export const STATUS_LABEL = {
  aprovada: 'Aprovada', creditada: 'Creditada', reprovada: 'Reprovada', em_curso: 'Em curso', por_fazer: 'Por fazer',
};

// ECTS-weighted average of approved UCs.
export function average(ucs) {
  const done = ucs.filter(u => isApproved(u) && Number(u.ects) > 0);
  const ects = done.reduce((s, u) => s + Number(u.ects), 0);
  if (!ects) return { average: null, ects: 0 };
  const sum = done.reduce((s, u) => s + effectiveGrade(u) * Number(u.ects), 0);
  return { average: truncate2(sum / ects), exact: sum / ects, ects };
}

// What the remaining UCs need, on average, to reach a target (or to not lower the current average).
// Optional-group UCs only count when chosen (in the plan), so "Estágio or Projeto" isn't double counted.
export function requiredForTarget(ucs, target) {
  const { exact, ects } = average(ucs);
  const remaining = ucs.filter(u => !isApproved(u) && Number(u.ects) > 0 && (!u.optional || u.inPlan));
  const remEcts = remaining.reduce((s, u) => s + Number(u.ects), 0);
  // Integer grades: the lowest one that doesn't pull the average down.
  const keep = exact === undefined ? null : Math.ceil(exact - 1e-9);
  if (!isNum(target) || !remEcts) return { keep, needed: null, remainingEcts: remEcts };
  const needed = (target * (ects + remEcts) - (exact || 0) * ects) / remEcts;
  return { keep, needed, remainingEcts: remEcts, reachable: needed <= 20 };
}

// Next dated, ungraded assessment from today on — the exam date the scheduler should use.
export function nextAssessmentDate(uc, now = new Date()) {
  const today = localKey(now);
  const status = ucStatus(uc);
  if (status === 'aprovada' || status === 'creditada') return '';
  const pending = (uc.assessments || [])
    .filter(a => a.date && a.date >= today && !isNum(a.grade))
    // After failing the normal period, only retakes are still ahead.
    .filter(a => status !== 'reprovada' || a.epoca !== 'normal')
    .sort((a, b) => a.date.localeCompare(b.date));
  return pending[0]?.date || '';
}

export function needsRetakeDate(uc, now = new Date()) {
  return ucStatus(uc) === 'reprovada' && !nextAssessmentDate(uc, now);
}

// Weak foundations: prerequisite not done yet, failed, or passed below PREREQ_OK_GRADE.
// Mastery of the new UC is NOT lowered by this — it's new material and starts unmeasured.
export function weakPrereqs(uc, ucs) {
  return (uc.prereqs || []).map(id => ucs.find(u => u.id === id)).filter(Boolean).map(p => {
    const g = effectiveGrade(p);
    const status = ucStatus(p);
    if (status === 'por_fazer' || status === 'em_curso') return { uc: p, reason: 'por fazer', grade: null };
    if (status === 'reprovada') return { uc: p, reason: 'reprovada', grade: g };
    if (isNum(g) && g < PREREQ_OK_GRADE) return { uc: p, reason: 'nota baixa', grade: g };
    return null;
  }).filter(Boolean);
}

// Years → semesters, with ECTS-weighted averages of approved UCs.
export function structure(ucs) {
  const years = new Map();
  for (const u of ucs) {
    const y = Number(u.year) || 0;
    const s = Number(u.semester) || 0;
    if (!years.has(y)) years.set(y, new Map());
    const sems = years.get(y);
    if (!sems.has(s)) sems.set(s, []);
    sems.get(s).push(u);
  }
  return [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, sems]) => {
    const all = [...sems.values()].flat();
    const mandatory = all.filter(u => !u.optional || isApproved(u) || u.inPlan);
    return {
      year,
      ...average(all),
      totalEcts: mandatory.reduce((s, u) => s + (Number(u.ects) || 0), 0),
      semesters: [...sems.entries()].sort((a, b) => a[0] - b[0]).map(([semester, list]) => {
        const req = list.filter(u => !u.optional || isApproved(u) || u.inPlan);
        return {
          semester, ucs: list, ...average(list),
          totalEcts: req.reduce((s, u) => s + (Number(u.ects) || 0), 0),
          complete: req.length > 0 && req.every(isApproved),
        };
      }),
    };
  });
}

// "Estruturas de Dados" → "ED"; keeps short words out.
export function acronym(name) {
  const skip = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'à', 'ao', 'para', 'com']);
  const letters = String(name).split(/\s+/).filter(w => w && !skip.has(w.toLowerCase())).map(w => w[0].toUpperCase());
  return (letters.join('') || String(name).slice(0, 3).toUpperCase()).slice(0, 5);
}

// Plan subjects linked to a UC get their exam date from the UC's next assessment
// (a manual date on the subject still wins) and their weak prerequisites.
export function enrichWithCurriculum(subjects, ucs, now = new Date()) {
  return subjects.map(s => {
    const uc = s.ucId && ucs.find(u => u.id === s.ucId);
    if (!uc) return s;
    const weak = weakPrereqs(uc, ucs);
    return {
      ...s,
      // Kept apart from examDate so saving the plan never freezes it as a manual date.
      derivedExamDate: nextAssessmentDate(uc, now),
      prereqWeak: weak.map(w => ({ short: w.uc.short || acronym(w.uc.name), name: w.uc.name, reason: w.reason, grade: w.grade })),
    };
  });
}

// Which plan subjects the degree record wants: UCs being taken now and not yet approved.
export function planSubjectsFromCurriculum(ucs) {
  return ucs.filter(u => u.inPlan && !isApproved(u) && u.name.trim()).map(u => ({
    id: u.id,
    ucId: u.id,
    name: u.name,
    short: (u.short || acronym(u.name)).toUpperCase().slice(0, 5),
    ects: Number(u.ects) || null,
    load: Number(u.ects) >= 7 ? 'alta' : Number(u.ects) >= 5 ? 'media' : 'leve',
    area: 'uni',
    examDate: '',
  }));
}
