export const subjects = [
  { id: 'fp', name: 'Fundamentos da Programação', short: 'FP', ects: 7, load: 'alta', color: '#6366f1', icon: '💻', area: 'uni' },
  { id: 'ed', name: 'Estruturas de Dados', short: 'ED', ects: 7, load: 'alta', color: '#8b5cf6', icon: '🧱', area: 'uni' },
  { id: 'pei', name: 'Processamento Estruturado de Informação', short: 'PEI', ects: 5, load: 'media', color: '#06b6d4', icon: '📊', area: 'uni' },
  { id: 'so', name: 'Sistemas Operativos', short: 'SO', ects: 5, load: 'media', color: '#10b981', icon: '⚙️', area: 'uni' },
  { id: 'eli', name: 'Ética e Legislação Informática', short: 'ELI', ects: 2, load: 'leve', color: '#f59e0b', icon: '⚖️', area: 'uni' },
  { id: 'c2', name: 'Cambridge C2 Proficiency', short: 'C2', ects: null, load: 'media', color: '#e11d48', icon: '🇬🇧', area: 'lingua' },
  { id: 'de', name: 'Alemão Básico (A1)', short: 'DE', ects: null, load: 'leve', color: '#dc2626', icon: '🇩🇪', area: 'lingua' },
];

export const weeklyPlan = [
  // Segunda
  { day: 1, dayName: 'Segunda', subject: 'fp', session: '3–4 blocos 40+10', review: null, reviewLabel: null, area: 'uni' },
  { day: 1.1, dayName: 'Segunda', subject: 'c2', session: '30 min', review: null, reviewLabel: 'Vocabulary + Use of English', area: 'lingua' },
  // Terça
  { day: 2, dayName: 'Terça', subject: 'ed', session: '3–4 blocos 40+10', review: 'fp', reviewLabel: 'Fundamentos (20–30 min)', area: 'uni' },
  { day: 2.1, dayName: 'Terça', subject: 'de', session: '30 min', review: null, reviewLabel: 'A1: vocabulário + frases + áudio', area: 'lingua' },
  // Quarta
  { day: 3, dayName: 'Quarta', subject: 'so', session: '3–4 blocos 40+10', review: 'ed', reviewLabel: 'ED (20–30 min)', area: 'uni' },
  { day: 3.1, dayName: 'Quarta', subject: 'c2', session: '30 min', review: null, reviewLabel: 'Reading / Listening', area: 'lingua' },
  // Quinta
  { day: 4, dayName: 'Quinta', subject: 'fp', session: 'Estudo profundo', review: null, reviewLabel: 'Recall de ambos', area: 'uni', block: 1 },
  { day: 4.1, dayName: 'Quinta', subject: 'ed', session: 'Estudo profundo', review: null, reviewLabel: null, area: 'uni', block: 2 },
  { day: 4.2, dayName: 'Quinta', subject: 'de', session: '30 min', review: null, reviewLabel: 'A1: revisão + produção', area: 'lingua' },
  // Sexta
  { day: 5, dayName: 'Sexta', subject: 'pei', session: '3–4 blocos 40+10', review: 'so', reviewLabel: 'SO (20–30 min)', area: 'uni' },
  { day: 5.1, dayName: 'Sexta', subject: 'c2', session: '30 min', review: null, reviewLabel: 'Writing', area: 'lingua' },
  // Sábado
  { day: 6, dayName: 'Sábado', subject: 'eli', session: '2–3 blocos 40+10', review: 'pei', reviewLabel: 'PEI (20–30 min) + lacunas da semana', area: 'uni' },
  { day: 6.1, dayName: 'Sábado', subject: 'de', session: '40 min', review: null, reviewLabel: 'A1: revisão semanal', area: 'lingua' },
  // Domingo
  { day: 0, dayName: 'Domingo', subject: 'all', session: '2–3 blocos 40+10', review: 'all', reviewLabel: 'Active recall + exercícios + corrigir lacunas', area: 'uni' },
  { day: 0.1, dayName: 'Domingo', subject: 'c2', session: '60 min', review: null, reviewLabel: 'Prática de skills / prova', area: 'lingua' },
  { day: 0.2, dayName: 'Domingo', subject: 'de', session: '30 min', review: null, reviewLabel: 'Manutenção semanal', area: 'lingua' },
];

export const phases = [
  { id: 'learn', start: '2026-09-25', end: '2026-10-31', label: '60 / 40', ratio: '60% aprender · 40% exercícios + recuperação', color: '#6366f1' },
  { id: 'practice', start: '2026-11-01', end: '2026-11-30', label: '40 / 60', ratio: '40% aprender · 60% exercícios + recuperação', color: '#f59e0b' },
  { id: 'drill', start: '2026-12-01', end: '2026-12-20', label: '20 / 80', ratio: '20% revisão · 80% exercícios, questões e provas', color: '#ef4444' },
  { id: 'simulate', start: '2026-12-21', end: '2027-01-04', label: 'SIM', ratio: 'Simulações de exame + correção de lacunas', color: '#22c55e' },
];

export const checklist = [
  'Explico os principais conceitos sem apontamentos?',
  'Resolvi exercícios sem olhar exemplos?',
  'Revi os erros?',
  'Voltei a conteúdos antigos?',
  'Mantive sono adequado?',
];

export const studyMethod = {
  structure: 'Ler/entender → fechar material → recuperar da memória → testar/praticar → identificar erro → corrigir.',
  reviewShort: 'Voltar 1–3 dias depois por 10–30 min; tentar lembrar ANTES de consultar.',
  programming: 'Priorizar código/problemas. Em FP/ED, praticar à mão se o exame for escrito.',
  mix: 'Combinar for/while, if/else, arrays, matrizes, ponteiros, malloc, structs e estruturas de dados.',
  metric: 'Não medir só horas ou páginas. Medir pelo que consegues explicar, escrever ou resolver sem consultar.',
  blocks: 'Blocos de 40+10: 40 min é prático, não regra biológica. Ajusta para 30–60 min conforme o foco.',
  rest: 'Após 3–4 blocos, pausa maior. Levanta, água/comida — evita transformar a pausa em mais carga cognitiva.',
};

export const languageMethod = {
  priority: 'Universidade > Cambridge C2 > Alemão. Em semanas pesadas de exames, línguas entram em manutenção.',
  c2: '~2h30/semana: Seg vocabulary/Use of English; Qua Reading/Listening; Sex Writing; Dom prática mais longa.',
  german: '~2h10–3h/semana, sessões de 30–40 min. Frequência é mais importante que sessões gigantes.',
  december: 'Reduz C2/Alemão para manutenção se necessário e desloca energia para provas e simulados.',
  adjust: 'Se notas queda persistente de sono, atenção ou rendimento, reduz volume antes de acrescentar mais horas.',
};

export function getCurrentPhase(date = new Date()) {
  const d = date.toISOString().slice(0, 10);
  return phases.find(p => d >= p.start && d <= p.end) || phases[0];
}

export function getTodaySessions(date = new Date()) {
  const jsDay = date.getDay();
  return weeklyPlan.filter(s => Math.floor(s.day) === jsDay);
}

export function getSubject(id) {
  if (id === 'all') return { id: 'all', name: 'Todas as cadeiras', short: 'ALL', ects: 26, load: 'todas', color: '#e2e8f0', icon: '📚', area: 'uni' };
  return subjects.find(s => s.id === id);
}

export function getWeekNumber(date = new Date()) {
  const start = new Date('2026-09-25');
  const diff = date - start;
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

export function getDaysUntilExam(date = new Date()) {
  const exam = new Date('2027-01-04');
  const diff = exam - date;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}
