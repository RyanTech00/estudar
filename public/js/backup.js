// Backup file format: build and validate. Pure functions, unit-tested.
// The file is untrusted on import (it may be old, edited by hand, or not ours at all).
import { isValidAttempt } from './learning.js';

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
  try { raw = JSON.parse(text); } catch { return { ok: false, message: 'O ficheiro não é JSON válido.' }; }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) return { ok: false, message: 'Este ficheiro não é uma cópia de segurança do Estudar.' };
  if (raw.version > BACKUP_VERSION) return { ok: false, message: 'Esta cópia foi feita por uma versão mais recente da app. Atualiza a app primeiro.' };

  const d = raw.data;
  const out = {};

  out.attempts = (Array.isArray(d.attempts) ? d.attempts : [])
    .filter(a => isObj(a) && typeof a.id === 'string' && Number.isFinite(a.at) && isValidAttempt(a));

  out.sessions = {};
  for (const [day, subs] of Object.entries(isObj(d.sessions) ? d.sessions : {})) {
    if (!isDay(day) || !isObj(subs)) continue;
    out.sessions[day] = Object.fromEntries(Object.entries(subs).filter(([, v]) => isObj(v) && v.done === true));
  }

  out.focus = {};
  for (const [day, subs] of Object.entries(isObj(d.focus) ? d.focus : {})) {
    if (!isDay(day) || !isObj(subs)) continue;
    out.focus[day] = Object.fromEntries(Object.entries(subs).filter(([, m]) => Number.isFinite(m) && m >= 0 && m <= 24 * 60));
  }

  out.checklist = {};
  for (const [week, arr] of Object.entries(isObj(d.checklist) ? d.checklist : {})) {
    if (/^W\d{2}$/.test(week) && Array.isArray(arr)) out.checklist[week] = arr.slice(0, 10).map(Boolean);
  }

  out.examResults = {};
  for (const [id, r] of Object.entries(isObj(d.examResults) ? d.examResults : {})) {
    if (isObj(r) && Number.isFinite(r.grade) && r.grade >= 0 && r.grade <= 20) out.examResults[id] = { grade: r.grade, at: Number(r.at) || 0 };
  }

  // Plan and degree record are normalised by their own code paths after import.
  out.plan = isObj(d.plan) && Array.isArray(d.plan.subjects) ? d.plan : null;
  out.curriculum = isObj(d.curriculum) && Array.isArray(d.curriculum.ucs)
    ? { degree: String(d.curriculum.degree || ''), targetAverage: Number.isFinite(d.curriculum.targetAverage) ? d.curriculum.targetAverage : null, ucs: d.curriculum.ucs.filter(u => isObj(u) && typeof u.id === 'string' && typeof u.name === 'string') }
    : null;
  if (isObj(d.timerConfig)) out.timerConfig = d.timerConfig;
  if (isObj(d.settings)) out.settings = d.settings;
  out.updatedAt = Number(d.updatedAt) || 0;

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
