// Regenerates every screenshot used in the docs: `npm run screenshots` (from docs/).
// Starts the app's local server, seeds a FICTIONAL student into localStorage and captures
// each feature with the Edge/Chrome already installed (playwright-core, no browser download).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.resolve(HERE, '..', 'public', 'screenshots');
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;

// ── Fictional demo data ────────────────────────────────────────
const DAY = 86400000;
const now = Date.now();
const iso = (days) => {
  const d = new Date(now + days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ago = (days, hours = 0) => now - days * DAY - hours * 3600000;

function demoData() {
  const subjects = [
    { id: 'fp', ucId: 'fp', ects: 7, name: 'Fundamentos da Programação', short: 'FP', load: 'alta', color: '#8ea7ff', area: 'uni' },
    { id: 'ed', ucId: 'ed', ects: 7, name: 'Estruturas de Dados', short: 'ED', load: 'alta', color: '#c39cff', area: 'uni' },
    { id: 'pei', ucId: 'pei', ects: 5, name: 'Processamento Estruturado de Informação', short: 'PEI', load: 'media', color: '#5fcdc2', area: 'uni' },
    { id: 'so', ucId: 'so', ects: 5, name: 'Sistemas Operativos', short: 'SO', load: 'media', color: '#8fd37e', area: 'uni' },
    { id: 'eli', ucId: 'eli', ects: 2, name: 'Ética e Legislação Informática', short: 'ELI', load: 'leve', color: '#e8b65a', area: 'uni' },
    { id: 'c2', name: 'Cambridge C2 Proficiency', short: 'C2', load: 'media', color: '#f28b8b', area: 'lingua' },
    { id: 'de', name: 'Alemão Básico (A1)', short: 'DE', load: 'leve', color: '#e0a47a', area: 'lingua' },
  ];
  const s = (day, subject, session, minutes, focus = '') => ({ day, subject, session, minutes, focus });
  const weeklyPlan = [
    s(1, 'fp', '3 blocos 40+10', 150, 'Exercícios mistos de ciclos e funções sem consultar'), s(1, 'c2', '30 min', 30, 'Use of English de memória'),
    s(2, 'ed', '3 blocos 40+10', 150, 'Implementar listas ligadas de raiz · Rever FP (20 min)'), s(2, 'de', '30 min', 30, 'Flashcards A1 + frases em voz alta'),
    s(3, 'so', '3 blocos 40+10', 150, 'Problemas de escalonamento sem apontamentos · Rever ED (20 min)'), s(3, 'c2', '30 min', 30, 'Reading com perguntas antes de reler'),
    s(4, 'fp', '2 blocos 40+10', 100, 'Recall de FP e ED: explicar de memória'), s(4, 'ed', '2 blocos 40+10', 100, 'Árvores: exercícios intercalados'), s(4, 'de', '30 min', 30, 'Produção escrita curta'),
    s(5, 'pei', '3 blocos 40+10', 150, 'Exercícios de XML/JSON mistos · Rever SO (20 min)'), s(5, 'c2', '30 min', 30, 'Writing cronometrado'),
    s(6, 'eli', '2 blocos 40+10', 100, 'Casos práticos de memória · Rever PEI (20 min)'), s(6, 'de', '40 min', 40, 'Revisão semanal de vocabulário'),
    s(0, 'all', '2 blocos 40+10', 100, 'Teste acumulado da semana + corrigir lacunas'), s(0, 'c2', '60 min', 60, 'Prova de treino'),
  ];
  const plan = {
    title: 'Engenharia Informática — 2.º ano', startDate: iso(-24), examDate: iso(70), notes: '',
    hoursPerDay: [3, 3.5, 3.5, 3.5, 4, 3.5, 3], subjects, weeklyPlan,
    phases: [
      { name: 'Aprender', label: '60 / 40', start: iso(-24), end: iso(12), ratio: '60% aprender · 40% exercícios + recuperação' },
      { name: 'Praticar', label: '40 / 60', start: iso(13), end: iso(42), ratio: '40% aprender · 60% exercícios + recuperação' },
      { name: 'Treino intensivo', label: '20 / 80', start: iso(43), end: iso(60), ratio: '20% revisão · 80% exercícios e provas' },
      { name: 'Simulações', label: 'SIM', start: iso(61), end: iso(70), ratio: 'Simulações de exame + correção de lacunas' },
    ],
    tips: [
      { title: 'ED depende de FP', text: 'A tua nota de Programação I foi baixa: nas primeiras semanas, 20 min de ponteiros e memória de cabeça antes de cada sessão de ED.' },
      { title: 'Testa antes de te sentires pronto', text: 'Faz o teste de controlo mesmo quando achas que ainda não sabes — é aí que ele mais ensina.' },
    ],
  };

  let n = 0;
  const att = (subject, kind, daysAgo, done, correct, confidence, assisted = false) =>
    ({ id: `d${n++}`, at: ago(daysAgo, 3), subject, kind, done, correct, confidence, assisted, minutes: kind === 'probe' ? 20 : 40 });
  const attempts = [
    att('fp', 'learn', 20, 0, 0, null), att('fp', 'probe', 16, 10, 4, 2), att('fp', 'probe', 9, 10, 6, 3), att('fp', 'probe', 2, 10, 7, 3),
    att('fp', 'practice', 3, 8, 6, 3), att('fp', 'practice', 1, 6, 5, 3),
    att('ed', 'probe', 12, 10, 4, 4), att('ed', 'probe', 5, 10, 5, 4), att('ed', 'practice', 4, 6, 3, 4), att('ed', 'practice', 2, 5, 2, 4),
    att('pei', 'probe', 6, 8, 6, 3), att('pei', 'practice', 3, 6, 5, 3),
    att('so', 'practice', 8, 5, 5, 3, true), att('so', 'practice', 6, 6, 5, 3, true), att('so', 'practice', 4, 5, 5, 3, true), att('so', 'practice', 2, 6, 6, 3, true),
    att('so', 'practice', 1, 6, 2, 3), att('so', 'probe', 10, 10, 5, 3),
    att('c2', 'probe', 7, 20, 15, 3),
    // Last semester, for the semester report
    att('md', 'probe', 150, 10, 6, 3), att('md', 'probe', 140, 10, 7, 3), att('md', 'probe', 128, 10, 8, 3), att('md', 'practice', 135, 8, 7, 3),
    att('pp', 'probe', 145, 10, 8, 4), att('pp', 'probe', 131, 10, 7, 4), att('pp', 'practice', 136, 6, 6, 4, true),
    att('sd', 'probe', 142, 10, 5, 2), att('sd', 'probe', 129, 10, 6, 2),
  ];

  const focus = {};
  const mins = [[6, { fp: 120, c2: 30 }], [5, { ed: 140, de: 30 }], [4, { so: 150, c2: 30 }], [3, { fp: 90, ed: 80, de: 30 }], [2, { pei: 130, c2: 30 }], [1, { eli: 90, de: 40 }], [0, { fp: 80 }]];
  for (const [d, v] of mins) focus[iso(-d)] = v;
  for (const [d, v] of [[150, { md: 90 }], [145, { pp: 100 }], [142, { sd: 80 }], [140, { md: 110 }], [131, { pp: 120, md: 60 }], [129, { sd: 90 }]]) focus[iso(-d)] = v;

  const sessions = { [iso(0)]: { fp: { done: true, timestamp: now } } };

  const U = (id, year, semester, name, ects, grade, o = {}) => ({
    id, name, short: '', ects, year, semester, optional: false, grade: grade ?? null,
    gradeType: grade == null ? '' : o.gradeType || 'exame', gradeDate: o.gradeDate || '', passGrade: 9.5,
    assessments: o.assessments || [], prereqs: o.prereqs || [], inPlan: !!o.inPlan,
  });
  const ucs = [
    U('alga', 1, 1, 'Álgebra Linear', 6, 15, { gradeDate: iso(-270) }), U('prog1', 1, 1, 'Programação I', 7, 11, { gradeDate: iso(-265) }),
    U('ic', 1, 1, 'Introdução aos Computadores', 5, 16, { gradeDate: iso(-268), gradeType: 'CC' }), U('ing', 1, 1, 'Inglês Técnico', 3, 18, { gradeType: 'CC' }),
    U('calc', 1, 1, 'Cálculo', 7, 13, { gradeDate: iso(-262) }),
    U('md', 1, 2, 'Matemática Discreta', 6, 16, { gradeDate: iso(-122) }), U('pp', 1, 2, 'Paradigmas de Programação', 7, 14, { gradeDate: iso(-125) }),
    U('sd', 1, 2, 'Sistemas Digitais', 5, 12, { gradeDate: iso(-120) }), U('rc1', 1, 2, 'Redes de Computadores I', 6, 17, { gradeDate: iso(-118) }),
    U('fp', 2, 1, 'Fundamentos da Programação', 7, null, { inPlan: true, assessments: [
      { id: 'f1', name: 'Teste 1', kind: 'teste', epoca: 'normal', date: iso(6), weight: 40, minGrade: 7.5, grade: null },
      { id: 'f2', name: 'Teste 2', kind: 'teste', epoca: 'normal', date: iso(55), weight: 60, minGrade: 7.5, grade: null },
    ] }),
    U('ed', 2, 1, 'Estruturas de Dados', 7, null, { inPlan: true, prereqs: ['prog1'], assessments: [{ id: 'e1', name: 'Exame', kind: 'exame', epoca: 'normal', date: iso(65), weight: 100, minGrade: null, grade: null }] }),
    U('pei', 2, 1, 'Processamento Estruturado de Informação', 5, null, { inPlan: true, assessments: [{ id: 'p1', name: 'Exame', kind: 'exame', epoca: 'normal', date: iso(62), weight: 100, minGrade: null, grade: null }] }),
    U('so', 2, 1, 'Sistemas Operativos', 5, null, { inPlan: true, assessments: [{ id: 's1', name: 'Exame', kind: 'exame', epoca: 'normal', date: iso(68), weight: 100, minGrade: null, grade: null }] }),
    U('eli', 2, 1, 'Ética e Legislação Informática', 2, null, { inPlan: true, assessments: [{ id: 'l1', name: 'Trabalho', kind: 'trabalho', epoca: 'normal', date: iso(40), weight: 100, minGrade: null, grade: null }] }),
    U('bd', 2, 2, 'Bases de Dados', 6, null), U('rc2', 2, 2, 'Redes de Computadores II', 6, null), U('web', 2, 2, 'Programação Web', 6, null),
  ];

  return {
    owner: null, plan, sessions, focus, checklist: { W04: [true, true, false, true, false] },
    attempts, examResults: {}, curriculum: { degree: 'Licenciatura em Engenharia Informática', targetAverage: 16, ucs },
    timerConfig: { work: 40, break: 10, longBreak: 15, sessionsBeforeLong: 4 }, settings: { sound: true }, updatedAt: now,
  };
}

// ── Mocked server answers (the demo runs without real keys) ────
const MOCK = {
  config: { configured: false, supabaseUrl: '', supabaseAnonKey: '', auth: { email: true, google: false }, ai: true, runtime: 'local', setup: true },
  health: {
    app: { ok: true, runtime: 'local', message: 'A correr neste computador' },
    supabase: { ok: true, message: 'Online' },
    database: { ok: true, message: 'Tabelas criadas' },
    ai: { ok: true, provider: 'Gemini', message: 'Gemini · gemini-2.5-flash' },
    limit: { ok: true, message: 'Máximo 10 planos por utilizador por dia' },
    checkedAt: new Date().toISOString(),
  },
  state: {
    values: {
      SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_EXEMPLO', SUPABASE_SERVICE_KEY: '••••x9Qa',
      AI_PROVIDER: 'gemini', AI_API_KEY: '••••4f2c', AI_MODEL: '', AI_BASE_URL: '', MAX_PLANS_PER_DAY: '10', AUTH_GOOGLE: '',
    },
    secretsSet: { SUPABASE_SERVICE_KEY: true, AI_API_KEY: true },
    deploy: { url: 'https://estudar.o-teu-nome.workers.dev', deployedAt: new Date(now - 2 * 3600000).toISOString() },
    localUrl: 'http://localhost:8787',
    hasAccessToken: false,
  },
  remote: { ok: true, url: 'https://estudar.o-teu-nome.workers.dev', message: 'Online' },
  cloudflare: { ok: true, loggedIn: true, message: 'Ligado como estudante@exemplo.pt', loginRunning: false },
};

// ── Runner ─────────────────────────────────────────────────────
function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'setup', 'server.mjs'), '--no-open'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (String(d).includes(`localhost:${PORT}`)) resolve(child); });
    child.on('error', reject);
    setTimeout(() => reject(new Error('O servidor local não arrancou')), 15000);
  });
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel }); } catch { /* try next */ }
  }
  throw new Error('Instala o Microsoft Edge ou o Google Chrome para gerar as capturas.');
}

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };

async function newPage(browser, device, { intro = false, config = MOCK.config } = {}) {
  const ctx = await browser.newContext({ ...device, locale: 'pt-PT', colorScheme: 'dark', serviceWorkers: 'block' });
  const data = demoData();
  await ctx.addInitScript(([d, showIntro]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('estudar_data', JSON.stringify(d));
    if (!showIntro) localStorage.setItem('estudar_intro_seen', '1');
  }, [data, intro]);
  await ctx.route('**/api/config', r => r.fulfill({ json: config }));
  await ctx.route('**/api/health', r => r.fulfill({ json: MOCK.health }));
  await ctx.route('**/api/setup/state', r => r.fulfill({ json: MOCK.state }));
  await ctx.route('**/api/setup/remote-health', r => r.fulfill({ json: MOCK.remote }));
  await ctx.route('**/api/setup/cloudflare*', r => r.fulfill({ json: MOCK.cloudflare }));
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(700);
  return page;
}

const shot = async (page, name, opts = {}) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
  console.log(`  ✓ ${name}.png`);
};
const tab = (page, t) => page.click(`.nav-item[data-tab="${t}"]`);

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startServer();
  const browser = await launch();
  try {
    // Intro
    let p = await newPage(browser, MOBILE, { intro: true });
    await shot(p, 'intro');
    await p.context().close();

    // Login screen (backend configured)
    p = await newPage(browser, MOBILE, { config: { ...MOCK.config, configured: true, supabaseUrl: 'https://abcdefghijklmnop.supabase.co', supabaseAnonKey: 'sb_publishable_EXEMPLO' } });
    await p.waitForSelector('#login-email-form:not(.hidden)', { timeout: 15000 }).catch(() => {});
    await shot(p, 'login');
    await p.context().close();

    // Today, week, timer, focus, progress on mobile
    p = await newPage(browser, MOBILE);
    await shot(p, 'hoje');
    await tab(p, 'week'); await shot(p, 'semana');
    await tab(p, 'timer'); await p.click('#timer-subjects .chip[data-id="ed"]'); await p.click('#btn-timer-main'); await p.waitForTimeout(2200); await shot(p, 'timer');
    await p.click('#btn-focus-mode'); await p.waitForTimeout(600); await shot(p, 'foco');
    await p.click('#btn-focus-exit'); await p.click('#btn-timer-main');
    await tab(p, 'progress'); await shot(p, 'progresso');
    await p.evaluate(() => { document.querySelector('.pc-year').open = true; document.getElementById('percurso-card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
    await shot(p, 'percurso-card');

    // Block log (confidence locked before correcting)
    await p.evaluate(async () => {
      const { openBlockLog } = await import('/js/logsheet.js');
      openBlockLog({ subject: { id: 'ed', short: 'ED' }, minutes: 40 }, () => {});
      document.querySelector('#log-sheet [data-kind="practice"]').click();
      document.querySelector('#log-sheet [data-conf="3"]').click();
      document.querySelector('#log-sheet [data-assist="0"]').click();
    });
    await shot(p, 'registo-bloco');
    await p.evaluate(() => { document.getElementById('log-confirm').click(); });
    await p.evaluate(() => { const plus = document.querySelector('[data-stepper="log-right"] [data-d="1"]'); for (let i = 0; i < 3; i++) plus.click(); document.getElementById('log-save').click(); });
    await shot(p, 'registo-feedback');
    await p.evaluate(async () => { const { closeLog } = await import('/js/logsheet.js'); closeLog(); });

    // Probe setup
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#btn-probe'); await shot(p, 'teste-controlo');
    await p.evaluate(async () => { const { closeLog } = await import('/js/logsheet.js'); closeLog(); });

    // Semester report
    await p.evaluate(() => { document.querySelector('.pc-year').open = true; document.querySelector('[data-sem="1-2"]').click(); });
    await shot(p, 'relatorio-semestre');
    await p.click('#percurso-close');

    // Plan editor: allocation + scientific checks
    await tab(p, 'week'); await p.click('#btn-edit-plan');
    await p.evaluate(() => document.getElementById('pl-allocation').closest('.card').scrollIntoView({ block: 'start' }));
    await shot(p, 'plano-distribuicao');
    await p.evaluate(() => document.getElementById('pl-checks').closest('.card').scrollIntoView({ block: 'end' }));
    await shot(p, 'plano-verificacao');
    await p.click('#planner-cancel');

    // Account sheet + server screen
    await p.click('#btn-settings'); await p.waitForTimeout(1200); await shot(p, 'conta');
    await p.click('#btn-settings-server'); await p.waitForTimeout(1500); await shot(p, 'servidor-estado');
    await p.evaluate(() => document.getElementById('cf-deploy').closest('.card').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(800); await shot(p, 'servidor-publicar');
    await p.context().close();

    // Desktop: hero + degree manager
    p = await newPage(browser, DESKTOP);
    await shot(p, 'hoje-desktop');
    await p.click('#btn-settings'); await p.click('#btn-settings-percurso'); await p.waitForTimeout(400);
    await p.evaluate(() => {
      const row = [...document.querySelectorAll('.pc-uc')].find(e => e.innerText.includes('Fundamentos'));
      row.querySelector('[data-toggle]').click();
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.pc-uc.open').scrollIntoView({ block: 'start' }));
    await shot(p, 'percurso-uc');
    await p.evaluate(() => document.getElementById('percurso-body').scrollIntoView({ block: 'start' }));
    await shot(p, 'percurso-resumo');
    await p.context().close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`\nCapturas em ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
