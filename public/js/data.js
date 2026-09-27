export const PALETTE = ['#8ea7ff', '#c39cff', '#5fcdc2', '#8fd37e', '#e8b65a', '#f28b8b', '#e0a47a', '#7cc4d8', '#e59ad0', '#b5c46a', '#a0a8b8', '#f0a060'];
export const AREAS = { uni: 'Universidade', lingua: 'Línguas', outro: 'Outros' };
export const LOADS = { leve: 'Leve', media: 'Média', alta: 'Alta' };

// Ships as a ready-made example so a new user can see a full plan before building their own.
export const EXAMPLE_PLAN = {
  title: 'Engenharia Informática 2026/27 (exemplo)',
  startDate: '2026-09-25',
  examDate: '2027-01-04',
  hoursPerDay: [3.5, 3.5, 3.5, 3.5, 4, 3.5, 3],
  subjects: [
    { id: 'fp', ects: 7, name: 'Fundamentos da Programação', short: 'FP', load: 'alta', color: '#8ea7ff', area: 'uni' },
    { id: 'ed', ects: 7, name: 'Estruturas de Dados', short: 'ED', load: 'alta', color: '#c39cff', area: 'uni' },
    { id: 'pei', ects: 5, name: 'Processamento Estruturado de Informação', short: 'PEI', load: 'media', color: '#5fcdc2', area: 'uni' },
    { id: 'so', ects: 5, name: 'Sistemas Operativos', short: 'SO', load: 'media', color: '#8fd37e', area: 'uni' },
    { id: 'eli', ects: 2, name: 'Ética e Legislação Informática', short: 'ELI', load: 'leve', color: '#e8b65a', area: 'uni' },
    { id: 'c2', name: 'Cambridge C2 Proficiency', short: 'C2', load: 'media', color: '#f28b8b', area: 'lingua' },
    { id: 'de', name: 'Alemão Básico (A1)', short: 'DE', load: 'leve', color: '#e0a47a', area: 'lingua' },
  ],
  weeklyPlan: [
    { day: 1, subject: 'fp', session: '3–4 blocos 40+10', minutes: 175 },
    { day: 1, subject: 'c2', session: '30 min', minutes: 30, focus: 'Vocabulary + Use of English' },
    { day: 2, subject: 'ed', session: '3–4 blocos 40+10', minutes: 175, focus: 'Rever FP (20–30 min)' },
    { day: 2, subject: 'de', session: '30 min', minutes: 30, focus: 'A1: vocabulário + frases + áudio' },
    { day: 3, subject: 'so', session: '3–4 blocos 40+10', minutes: 175, focus: 'Rever ED (20–30 min)' },
    { day: 3, subject: 'c2', session: '30 min', minutes: 30, focus: 'Reading / Listening' },
    { day: 4, subject: 'fp', session: 'Estudo profundo', minutes: 100, focus: 'Recall de FP e ED' },
    { day: 4, subject: 'ed', session: 'Estudo profundo', minutes: 100 },
    { day: 4, subject: 'de', session: '30 min', minutes: 30, focus: 'A1: revisão + produção' },
    { day: 5, subject: 'pei', session: '3–4 blocos 40+10', minutes: 175, focus: 'Rever SO (20–30 min)' },
    { day: 5, subject: 'c2', session: '30 min', minutes: 30, focus: 'Writing' },
    { day: 6, subject: 'eli', session: '2–3 blocos 40+10', minutes: 125, focus: 'Rever PEI (20–30 min) + lacunas da semana' },
    { day: 6, subject: 'de', session: '40 min', minutes: 40, focus: 'A1: revisão semanal' },
    { day: 0, subject: 'all', session: '2–3 blocos 40+10', minutes: 125, focus: 'Active recall + exercícios + corrigir lacunas' },
    { day: 0, subject: 'c2', session: '60 min', minutes: 60, focus: 'Prática de skills / prova' },
    { day: 0, subject: 'de', session: '30 min', minutes: 30, focus: 'Manutenção semanal' },
  ],
  phases: [
    { name: 'Aprender', label: '60 / 40', start: '2026-09-25', end: '2026-10-31', ratio: '60% aprender · 40% exercícios + recuperação' },
    { name: 'Praticar', label: '40 / 60', start: '2026-11-01', end: '2026-11-30', ratio: '40% aprender · 60% exercícios + recuperação' },
    { name: 'Treino intensivo', label: '20 / 80', start: '2026-12-01', end: '2026-12-20', ratio: '20% revisão · 80% exercícios, questões e provas' },
    { name: 'Simulações', label: 'SIM', start: '2026-12-21', end: '2027-01-04', ratio: 'Simulações de exame + correção de lacunas' },
  ],
  tips: [
    { title: 'Programação', text: 'Priorizar código/problemas. Em FP/ED, praticar à mão se o exame for escrito.' },
    { title: 'Misturar tópicos', text: 'Combinar for/while, if/else, arrays, matrizes, ponteiros, malloc, structs e estruturas de dados.' },
    { title: 'Prioridades', text: 'Universidade > Cambridge C2 > Alemão. Em semanas pesadas de exames, línguas entram em manutenção.' },
    { title: 'Cambridge C2', text: '~2h30/semana: Seg vocabulary/Use of English; Qua Reading/Listening; Sex Writing; Dom prática mais longa.' },
    { title: 'Alemão básico', text: '~2h10–3h/semana, sessões de 30–40 min. Frequência é mais importante que sessões gigantes.' },
    { title: 'Dezembro', text: 'Reduz C2/Alemão para manutenção se necessário e desloca energia para provas e simulados.' },
  ],
};

export const EMPTY_PLAN = { title: '', startDate: '', examDate: '', hoursPerDay: [2, 3, 3, 3, 3, 3, 2], subjects: [], weeklyPlan: [], phases: [], tips: [] };

export const checklist = [
  'Explico os principais conceitos sem apontamentos?',
  'Resolvi exercícios sem olhar exemplos?',
  'Revi os erros?',
  'Voltei a conteúdos antigos?',
  'Mantive sono adequado?',
];

export const studyMethod = [
  { title: 'Estrutura de estudo', text: 'Ler/entender → fechar material → recuperar da memória → testar/praticar → identificar erro → corrigir.' },
  { title: 'Revisão espaçada', text: 'Voltar 1–3 dias depois por 10–30 min; tentar lembrar ANTES de consultar.' },
  { title: 'Como medir progresso', text: 'Não medir só horas ou páginas. Medir pelo que consegues explicar, escrever ou resolver sem consultar.' },
  { title: 'Blocos 40+10', text: 'Blocos de 40+10: 40 min é prático, não regra biológica. Ajusta para 30–60 min conforme o foco.' },
  { title: 'Descanso', text: 'Após 3–4 blocos, pausa maior. Levanta, água/comida — evita transformar a pausa em mais carga cognitiva.' },
  { title: 'Regra de ajuste', text: 'Se notas queda persistente de sono, atenção ou rendimento, reduz volume antes de acrescentar mais horas.' },
];

// ── Active plan (live bindings: importers always see the current user's plan) ──
export let plan = EMPTY_PLAN;
export let subjects = [];
export let weeklyPlan = [];
export let phases = [];

export function setActivePlan(p) {
  plan = normalizePlan(p || EMPTY_PLAN);
  subjects = plan.subjects;
  weeklyPlan = plan.weeklyPlan;
  phases = plan.phases;
}

export function hasPlan() {
  return subjects.length > 0;
}

const REVIEW = { id: 'all', name: 'Revisão geral', short: 'REV', color: '#d6d3cc', area: 'uni' };

export function getSubject(id) {
  if (id === 'all') return REVIEW;
  return subjects.find(s => s.id === id) || { id, name: 'Disciplina removida', short: '—', color: '#66645e', area: 'outro' };
}

export function sessionArea(s) {
  return s.subject === 'all' ? 'uni' : getSubject(s.subject).area;
}

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getCurrentPhase(date = new Date()) {
  if (!phases.length) return null;
  const d = localKey(date);
  if (d < phases[0].start) return phases[0];
  return phases.find(p => d >= p.start && d <= p.end) || phases[phases.length - 1];
}

// Same subject can appear twice on one day (e.g. two deep-study blocks), so ids carry an index.
export function getTodaySessions(date = new Date()) {
  const day = date.getDay();
  const seen = {};
  return weeklyPlan.filter(s => s.day === day).map(s => {
    seen[s.subject] = (seen[s.subject] || 0) + 1;
    return { ...s, id: seen[s.subject] > 1 ? `${s.subject}${seen[s.subject]}` : s.subject, area: sessionArea(s) };
  });
}

export function getSessionsForDay(day) {
  return getTodaySessions({ getDay: () => day });
}

export function getWeekNumber(date = new Date()) {
  if (!plan.startDate) return 1;
  const start = new Date(plan.startDate + 'T00:00');
  return Math.max(1, Math.floor((date - start) / (7 * 86400000)) + 1);
}

export function getDaysUntilExam(date = new Date()) {
  if (!plan.examDate) return null;
  const exam = new Date(plan.examDate + 'T00:00');
  return Math.max(0, Math.ceil((exam - date) / 86400000));
}

// Accepts plans from storage, the example, or the AI and makes them safe to render.
export function normalizePlan(p) {
  const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const subjectsIn = Array.isArray(p.subjects) ? p.subjects : [];
  const usedIds = new Set();
  const subjectsOut = subjectsIn.slice(0, 20).map((s, i) => {
    let id = String(s.id || s.short || `s${i}`).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || `s${i}`;
    while (usedIds.has(id) || id === 'all') id += 'x';
    usedIds.add(id);
    return {
      id,
      name: String(s.name || 'Sem nome').slice(0, 80),
      short: String(s.short || s.name || '?').slice(0, 5).toUpperCase(),
      load: LOADS[s.load] ? s.load : 'media',
      area: AREAS[s.area] ? s.area : 'uni',
      color: s.color || PALETTE[i % PALETTE.length],
      ects: Number(s.ects) > 0 ? Math.min(60, Math.round(Number(s.ects) * 2) / 2) : null,
      examDate: isDate(s.examDate) ? s.examDate : '',
      ucId: s.ucId ? String(s.ucId).slice(0, 20) : undefined,
    };
  });
  const ids = new Set([...subjectsOut.map(s => s.id), 'all']);

  const weekly = (Array.isArray(p.weeklyPlan) ? p.weeklyPlan : [])
    .map(s => ({ day: Math.floor(Number(s.day)), subject: String(s.subject), session: String(s.session || '').slice(0, 60), minutes: Math.max(0, Math.min(600, Math.round(Number(s.minutes) || 0))), focus: s.focus ? String(s.focus).slice(0, 160) : '' }))
    .filter(s => s.day >= 0 && s.day <= 6 && ids.has(s.subject))
    .slice(0, 60);

  const phaseColors = ['#8ea7ff', '#e8b65a', '#f28b8b', '#cfe86a', '#5fcdc2', '#c39cff'];
  const phasesOut = (Array.isArray(p.phases) ? p.phases : [])
    .filter(ph => isDate(ph.start) && isDate(ph.end) && ph.start <= ph.end)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6)
    .map((ph, i) => ({
      id: `p${i}`,
      name: String(ph.name || `Fase ${i + 1}`).slice(0, 40),
      label: String(ph.label || ph.name || `F${i + 1}`).slice(0, 10),
      start: ph.start,
      end: ph.end,
      ratio: String(ph.ratio || '').slice(0, 120),
      color: phaseColors[i % phaseColors.length],
    }));

  const hours = Array.isArray(p.hoursPerDay) && p.hoursPerDay.length === 7
    ? p.hoursPerDay.map(h => Math.max(0, Math.min(16, Number(h) || 0)))
    : EMPTY_PLAN.hoursPerDay;

  return {
    title: String(p.title || '').slice(0, 80),
    notes: String(p.notes || '').slice(0, 1000),
    startDate: isDate(p.startDate) ? p.startDate : '',
    examDate: isDate(p.examDate) ? p.examDate : '',
    hoursPerDay: hours,
    subjects: subjectsOut,
    weeklyPlan: weekly,
    phases: phasesOut,
    tips: (Array.isArray(p.tips) ? p.tips : []).slice(0, 10)
      .map(t => (typeof t === 'string' ? { title: 'Dica', text: t } : t))
      .filter(t => t && t.text)
      .map(t => ({ title: String(t.title || 'Dica').slice(0, 40), text: String(t.text).slice(0, 300) })),
  };
}
