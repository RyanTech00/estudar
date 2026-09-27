// Backup file format: build and validate. Pure functions, unit-tested.
// The file is untrusted on import (it may be old, edited by hand, or not ours at all).
import { isValidAttempt } from './learning.js';
import { t } from './i18n.js';

export const BACKUP_APP = 'estudar';
export const BACKUP_VERSION = 1;

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);

export function buildBackup(data, now = new Date()) {
  const { owner, ...rest } = data;
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: rest }, null, 2);
}

export function backupFilename(now = new Date()) {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `estudar-${d}.json`;
}

// Returns { ok, data, summary } or { ok: false, message }.
export function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, message: t('O ficheiro não é JSON válido.') }; }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) return { ok: false, message: t('Este ficheiro não é uma cópia de segurança do Estudar.') };
  if (raw.version > BACKUP_VERSION) return { ok: false, message: t('Esta cópia foi feita por uma versão mais recente da app. Atualiza a app primeiro.') };

  const out = cleanDocument(raw.data);

  return {
    ok: true,
    data: out,
    exportedAt: raw.exportedAt || '',
    summary: {
      attempts: out.attempts.length,
      days: new Set([...Object.keys(out.sessions), ...Object.keys(out.focus)]).size,
      subjects: out.plan?.subjects.length || 0,
      ucs: out.curriculum?.ucs.length || 0,
    },
  };
}

// ── The study document, cleaned ──────────────────────────────
// Every way data comes in goes through here: a backup file, the Supabase row (the owner's own, or the one a
// viewer reads), real-time updates and the local copy. Whoever can write that JSON controls what the app renders
// on the owner's devices and on every viewer's screen, so only known fields survive, with their types, ranges
// and sizes. Rendering escapes text too; this is the second lock.
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v).slice(0, max) : '');
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
const isId = (v) => typeof v === 'string' && /^[a-z0-9_-]{1,32}$/i.test(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
const objects = (v, max) => (Array.isArray(v) ? v.filter(isObj).slice(0, max) : []);
const entries = (v, max) => (isObj(v) ? Object.entries(v).slice(0, max) : []);

const EPOCAS = ['normal', 'recurso', 'especial'];
const KINDS = ['exame', 'teste', 'trabalho', 'frequencia', 'outro'];
const GRADE_TYPES = ['', 'exame', 'avaliação', 'CC'];
const ATTEMPT_KINDS = ['learn', 'practice', 'probe'];

function cleanAttempt(a) {
  if (!isId(a.id) || !Number.isFinite(a.at) || !isValidAttempt(a)) return null;
  const out = {
    id: a.id,
    at: a.at,
    subject: str(a.subject, 32),
    kind: a.kind,
    done: int(a.done, 0, 10000) ?? 0,
    correct: int(a.correct, 0, 10000) ?? 0,
    confidence: int(a.confidence, 1, 4),
    assisted: a.assisted === true,
    minutes: num(a.minutes, 0, 24 * 60) ?? 0,
  };
  if (typeof a.explanation === 'string' && a.explanation) out.explanation = a.explanation.slice(0, 2000);
  return out.correct <= out.done && ATTEMPT_KINDS.includes(out.kind) ? out : null;
}

function cleanAssessment(a) {
  return {
    id: isId(a.id) ? a.id : `a${Math.random().toString(36).slice(2, 8)}`,
    name: str(a.name, 60),
    kind: KINDS.includes(a.kind) ? a.kind : 'exame',
    epoca: EPOCAS.includes(a.epoca) ? a.epoca : 'normal',
    date: isDate(a.date) ? a.date : '',
    weight: num(a.weight, 0, 100) ?? 0,
    minGrade: num(a.minGrade, 0, 20),
    grade: num(a.grade, 0, 20),
  };
}

function cleanUc(u) {
  if (!isId(u.id)) return null;
  return {
    id: u.id,
    name: str(u.name, 120),
    short: str(u.short, 8),
    ects: num(u.ects, 0, 60),
    year: num(u.year, 0, 10) === null ? 0 : Math.round(u.year),
    semester: num(u.semester, 0, 4) === null ? 0 : Math.round(u.semester),
    optional: u.optional === true,
    grade: num(u.grade, 0, 20),
    gradeType: GRADE_TYPES.includes(u.gradeType) ? u.gradeType : str(u.gradeType, 10),  // photo import may bring other labels
    gradeDate: isDate(u.gradeDate) ? u.gradeDate : '',
    passGrade: num(u.passGrade, 0, 20) ?? 9.5,
    assessments: objects(u.assessments, 20).map(cleanAssessment),
    prereqs: (Array.isArray(u.prereqs) ? u.prereqs : []).filter(isId).slice(0, 30),
    inPlan: u.inPlan === true,
  };
}

function cleanTimerConfig(c) {
  const clamp = (v, min, max, d) => (Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
  return {
    work: clamp(c.work, 10, 90, 40),
    break: clamp(c.break, 5, 30, 10),
    longBreak: clamp(c.longBreak, 10, 60, 15),
    sessionsBeforeLong: clamp(c.sessionsBeforeLong, 2, 8, 4),
  };
}

// Returns only what the app knows how to use. `plan` keeps its shape (normalizePlan finishes it), minus anything
// that could break rendering: non-object entries, colours that aren't colours, ids that aren't ids.
export function cleanDocument(d) {
  if (!isObj(d)) d = {};
  const out = {};

  out.attempts = objects(d.attempts, 20000).map(cleanAttempt).filter(Boolean);

  out.sessions = {};
  for (const [day, subs] of entries(d.sessions, 5000)) {
    if (!isDay(day) || !isObj(subs)) continue;
    out.sessions[day] = Object.fromEntries(entries(subs, 100)
      .filter(([id, v]) => isId(id) && isObj(v) && v.done === true)
      .map(([id, v]) => [id, { done: true, timestamp: Number.isFinite(v.timestamp) ? v.timestamp : 0 }]));
  }

  out.focus = {};
  for (const [day, subs] of entries(d.focus, 5000)) {
    if (!isDay(day) || !isObj(subs)) continue;
    out.focus[day] = Object.fromEntries(entries(subs, 100).filter(([id, m]) => isId(id) && Number.isFinite(m) && m >= 0 && m <= 24 * 60));
  }

  out.checklist = {};
  for (const [week, arr] of entries(d.checklist, 200)) {
    if (/^W\d{2}$/.test(week) && Array.isArray(arr)) out.checklist[week] = arr.slice(0, 10).map(Boolean);
  }

  out.examResults = {};
  for (const [id, r] of entries(d.examResults, 100)) {
    if (isId(id) && isObj(r) && num(r.grade, 0, 20) !== null) out.examResults[id] = { grade: r.grade, at: Number.isFinite(r.at) ? r.at : 0 };
  }

  out.plan = null;
  if (isObj(d.plan) && Array.isArray(d.plan.subjects)) {
    const p = d.plan;
    out.plan = {
      ...p,
      subjects: objects(p.subjects, 20).map(s => ({ ...s, color: isColor(s.color) ? s.color : undefined })),
      weeklyPlan: objects(p.weeklyPlan, 60),
      phases: objects(p.phases, 6),
      tips: Array.isArray(p.tips) ? p.tips.filter(t => typeof t === 'string' || isObj(t)).slice(0, 10) : [],
      hoursPerDay: Array.isArray(p.hoursPerDay) ? p.hoursPerDay.slice(0, 7) : undefined,
    };
  }

  out.curriculum = isObj(d.curriculum) && Array.isArray(d.curriculum.ucs)
    ? {
      degree: str(d.curriculum.degree, 120),
      targetAverage: num(d.curriculum.targetAverage, 0, 20),
      ucs: objects(d.curriculum.ucs, 200).map(cleanUc).filter(Boolean),
    }
    : null;

  out.timerConfig = cleanTimerConfig(isObj(d.timerConfig) ? d.timerConfig : {});
  out.settings = { sound: !(isObj(d.settings) && d.settings.sound === false) };
  out.updatedAt = Number.isFinite(d.updatedAt) ? d.updatedAt : 0;
  return out;
}
