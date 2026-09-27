import { plan, subjects, phases, checklist, studyMethod, getExamplePlan, EMPTY_PLAN, normalizePlan, setActivePlan, hasPlan, getCurrentPhase, getTodaySessions, getSessionsForDay, getSubject, getWeekNumber, getDaysUntilExam } from './data.js';
import { Timer } from './timer.js';
import * as storage from './storage.js';
import { openServerScreen, setupServerScreen, renderSummary } from './setup.js';
import { openPlanner, setupPlanner } from './planner.js';
import { enterFocusMode, exitFocusMode, playSound } from './focus.js';
import { setupLog, openBlockLog, openProbeSetup, openExamGrade } from './logsheet.js';
import { subjectPriorities, eveOfExam, examDateOf, daysUntil, FINAL_WINDOW_DAYS } from './learning.js';
import { enrichWithCurriculum, planSubjectsFromCurriculum, needsRetakeDate } from './curriculum.js';
import { setupPercurso, openPercurso, openSemester, renderPercursoCard } from './percurso.js';
import { buildBackup, parseBackup, backupFilename } from './backup.js';
import { t, lang, setLang, locale, translateDOM, LANGS, DAY_SHORT, DAY_LONG, MONTH_SHORT } from './i18n.js';

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 118;
const PHASE_LABEL = (p) => ({ work: t('estudo'), break: t('pausa'), longBreak: t('pausa longa') })[p];
const TAB_TITLE = { today: 'Hoje', week: 'Semana', timer: 'Timer', progress: 'Progresso' };
let currentTab = 'today';

let selectedSubject = 'all';
let focusActive = false;
let probe = null; // { minutes } while a closed-book probe is running

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name) => `<svg class="ico"><use href="#i-${name}"/></svg>`;
const tag = (sub) => `<span class="tag" style="--c:${esc(sub.color)}">${esc(sub.short)}</span>`;
const detail = (s) => `${esc(s.session)}${s.focus ? ` · ${esc(s.focus)}` : ''}`;

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

function loadPlan() {
  // Data from before plans were per-user: it was built on the example plan, so keep using it.
  if (!storage.getPlan()) {
    const d = storage.loadData();
    if (Object.keys(d.sessions || {}).length || Object.keys(d.focus || {}).length) storage.savePlan(normalizePlan(getExamplePlan('pt')));
  }
  setActivePlan(storage.getPlan());
  const enriched = enrichWithCurriculum(subjects, storage.getCurriculum().ucs || []);
  subjects.forEach((s, i) => { s.derivedExamDate = enriched[i].derivedExamDate || ''; s.prereqWeak = enriched[i].prereqWeak || []; });
  const valid = new Set([...subjects.map(s => s.id), 'all']);
  if (!valid.has(selectedSubject)) {
    selectedSubject = getTodaySessions().find(s => s.subject !== 'all')?.subject || subjects[0]?.id || 'all';
  }
}

// Degree record → plan: UCs being taken now join the plan; approved or dropped ones leave it.
function syncPlanWithCurriculum() {
  const ucs = storage.getCurriculum().ucs || [];
  const wanted = planSubjectsFromCurriculum(ucs);
  const current = storage.getPlan() || normalizePlan({ ...EMPTY_PLAN });
  const linked = new Set(ucs.map(u => u.id));
  const kept = current.subjects.filter(s => !s.ucId || wanted.some(w => w.id === s.id) || !linked.has(s.ucId));
  const added = wanted.filter(w => !kept.some(s => s.id === w.id));
  if (added.length === 0 && kept.length === current.subjects.length) return;
  storage.savePlan(normalizePlan({ ...current, subjects: [...kept, ...added] }));
  if (added.length) toast(t('{n} UC(s) adicionadas ao plano. Gera ou ajusta a semana em Editar plano.', { n: added.length }));
}

function manageCurriculum() {
  openPercurso(() => {
    syncPlanWithCurriculum();
    loadPlan();
    renderAll();
    toast(t('Percurso guardado'));
  });
}

function editPlan() {
  openPlanner(hasPlan() ? plan : null, () => {
    loadPlan();
    renderAll();
    toast(t('Plano guardado'));
  });
}

// ── Timer ──────────────────────────────
const timer = new Timer({ onTick: renderTimer, onPhaseEnd });

function applyTimerConfig() {
  const c = storage.getTimerConfig();
  timer.configure({ work: c.work * 60, break: c.break * 60, longBreak: c.longBreak * 60, sessionsBeforeLong: c.sessionsBeforeLong });
}

// Survives the OS killing the PWA in the background mid-block.
let lastSavedState = '';
function persistTimer() {
  const snap = JSON.stringify({ ...timer.snapshot(), subject: selectedSubject, probe });
  if (snap === lastSavedState) return;
  lastSavedState = snap;
  try { localStorage.setItem(storage.TIMER_KEY, snap); } catch {}
}

function restoreTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem(storage.TIMER_KEY) || 'null');
    if (!saved) return;
    if (saved.subject) selectedSubject = saved.subject;
    if (saved.probe && saved.phase === 'work' && saved.state !== 'idle') {
      probe = saved.probe;
      timer.configure({ work: probe.minutes * 60 });
    }
    timer.restore(saved);
  } catch {}
}

function onPhaseEnd({ finished, natural, workedSeconds }) {
  if (finished === 'work') {
    const minutes = Math.round(workedSeconds / 60);
    const subject = getSubject(selectedSubject);
    storage.logFocus(selectedSubject, minutes);
    if (natural && storage.getSetting('sound') !== false) playSound('complete');
    renderStats();
    renderProgress();

    if (probe) {
      // A probe is one sitting: back to normal durations, no automatic break.
      probe = null;
      applyTimerConfig();
      timer.reset();
      if (focusActive) closeFocus();
      openBlockLog({ subject, probe: true, minutes }, renderAll);
      return;
    }
    // Breaks start by themselves; the next study block waits for you.
    if (natural) timer.start();
    // Time alone isn't learning: ask what was attempted, before any correcting.
    if (minutes >= 5) openBlockLog({ subject, minutes }, renderAll);
  } else if (natural) {
    if (storage.getSetting('sound') !== false) playSound('break');
    toast(t('Pausa terminada — carrega ▶ quando estiveres pronto'));
  }
}

function startProbe(subjectId, minutes) {
  if (!timer.isIdle && !confirm(t('Há um bloco a decorrer. Terminá-lo e começar o teste de controlo? O bloco atual não será contado.'))) return;
  selectedSubject = subjectId;
  renderTimerSubjects();
  probe = { minutes };
  timer.reset();
  timer.configure({ work: minutes * 60 });
  timer.start();
  openFocus();
}

function renderTimer() {
  persistTimer();
  const time = Timer.format(timer.remaining);
  const progress = timer.isIdle ? 0 : timer.progress;
  const playing = timer.isRunning;

  $('timer-display').textContent = time;
  $('timer-phase').textContent = timer.isIdle && timer.phase === 'work' && timer.sessionsCompleted === 0 ? t('pronto') : PHASE_LABEL(timer.phase);
  const ring = $('timer-progress');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - progress);
  ring.classList.toggle('break', timer.phase === 'break');
  ring.classList.toggle('longBreak', timer.phase === 'longBreak');

  const done = timer.sessionsCompleted % timer.config.sessionsBeforeLong;
  const filled = done === 0 && timer.sessionsCompleted > 0 && timer.phase === 'longBreak' ? timer.config.sessionsBeforeLong : done;
  $('timer-dots').innerHTML = Array.from({ length: timer.config.sessionsBeforeLong }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');

  for (const id of ['btn-timer-main', 'btn-focus-main']) {
    $(id).innerHTML = icon(playing ? 'pause' : 'play');
    $(id).setAttribute('aria-label', playing ? t('Pausar') : t('Iniciar'));
  }

  if (focusActive) {
    $('focus-time').textContent = time;
    $('focus-phase').textContent = timer.isPaused ? t('em pausa') : PHASE_LABEL(timer.phase);
    const bar = $('focus-progress');
    bar.style.width = `${progress * 100}%`;
    bar.style.background = timer.phase === 'work' ? 'var(--accent)' : timer.phase === 'break' ? 'var(--break)' : 'var(--long)';
    const block = Math.min(done + (timer.phase === 'work' ? 1 : 0), timer.config.sessionsBeforeLong) || timer.config.sessionsBeforeLong;
    $('focus-count').textContent = t('Bloco {n} de {total}', { n: block, total: timer.config.sessionsBeforeLong });
  }

  document.title = timer.isIdle ? 'Estudar' : `${time} · ${PHASE_LABEL(timer.phase)} — Estudar`;
}

function setupTimer() {
  $('btn-timer-main').addEventListener('click', () => timer.toggle());
  $('btn-focus-main').addEventListener('click', () => timer.toggle());
  for (const id of ['btn-timer-reset', 'btn-focus-reset']) {
    $(id).addEventListener('click', () => {
      if (!timer.isIdle && !confirm(t('Reiniciar o ciclo? O bloco atual não será contado.'))) return;
      timer.reset();
    });
  }
  for (const id of ['btn-timer-skip', 'btn-focus-skip']) {
    $(id).addEventListener('click', () => timer.skip());
  }

  document.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting;
      const limits = { work: [10, 90], break: [5, 30], longBreak: [10, 60] };
      const config = storage.getTimerConfig();
      config[key] = Math.max(limits[key][0], Math.min(limits[key][1], config[key] + Number(btn.dataset.dir) * 5));
      storage.saveTimerConfig(config);
      renderTimerSettings();
      applyTimerConfig();
      renderTimer();
    });
  });
}

function renderTimerSettings() {
  const c = storage.getTimerConfig();
  $('setting-work').textContent = c.work;
  $('setting-break').textContent = c.break;
  $('setting-longBreak').textContent = c.longBreak;
}

function renderTimerSubjects() {
  const list = [...subjects, getSubject('all')];
  $('timer-subjects').innerHTML = list.map(s => `
    <button class="chip ${s.id === selectedSubject ? 'on' : ''}" style="--c:${esc(s.color)}" data-id="${esc(s.id)}"
      role="radio" aria-checked="${s.id === selectedSubject}" title="${esc(s.name)}">${esc(s.short)}</button>
  `).join('');
  $('timer-subjects').querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSubject = btn.dataset.id;
      renderTimerSubjects();
      persistTimer();
    });
  });
}

// ── Focus mode ─────────────────────────
async function openFocus() {
  focusActive = true;
  const sub = getSubject(selectedSubject);
  $('focus-subject').textContent = probe ? t('Teste de controlo · {s} — sem consulta', { s: sub.short }) : sub.name;
  $('focus-subject').style.setProperty('--c', sub.color);
  $('focus-overlay').classList.add('active');
  $('focus-overlay').setAttribute('aria-hidden', 'false');
  renderTimer();
  await enterFocusMode();
}

async function closeFocus() {
  focusActive = false;
  $('focus-overlay').classList.remove('active');
  $('focus-overlay').setAttribute('aria-hidden', 'true');
  await exitFocusMode();
}

function setupFocus() {
  $('btn-focus-mode').addEventListener('click', openFocus);
  $('btn-focus-exit').addEventListener('click', closeFocus);
  document.addEventListener('focusModeExit', () => {
    focusActive = false;
    $('focus-overlay').classList.remove('active');
  });
  document.addEventListener('keydown', (e) => {
    if (!focusActive) return;
    if (e.code === 'Space') { e.preventDefault(); timer.toggle(); }
  });
}

function startStudying(subjectId) {
  selectedSubject = subjectId;
  renderTimerSubjects();
  if (timer.phase !== 'work' && timer.isIdle) timer.reset();
  if (!timer.isRunning) timer.start();
  openFocus();
}

// ── Navigation / header ────────────────
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
  currentTab = tab;
  $('topbar-title').textContent = t(TAB_TITLE[tab]);
  window.scrollTo({ top: 0 });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('btn-edit-plan').addEventListener('click', editPlan);
}

function renderHeader() {
  const now = new Date();
  const week = plan.startDate ? ` · ${t('semana {n}', { n: getWeekNumber(now) })}` : '';
  $('topbar-date').textContent = `${DAY_LONG()[now.getDay()]}, ${now.getDate()} ${MONTH_SHORT()[now.getMonth()]}${week}`;
  $('topbar-title').textContent = t(TAB_TITLE[currentTab]);
}

// ── Today ──────────────────────────────
function renderExamAlerts() {
  const now = new Date();
  const eve = eveOfExam(subjects, plan, now);
  const soon = subjects
    .map(s => ({ s, days: daysUntil(examDateOf(s, plan), now) }))
    .filter(x => x.days !== null && x.days > 1 && x.days <= FINAL_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days);
  const retakes = (storage.getCurriculum().ucs || []).filter(u => u.inPlan && needsRetakeDate(u, now));
  $('exam-alerts').innerHTML = [
    ...retakes.map(u => `<div class="alert alert-strong"><b>${t('{name}: reprovada na época normal.', { name: esc(u.name) })}</b> ${t('Adiciona a data do recurso (ou época especial) no percurso para o plano se ajustar.')} <button class="link-btn" data-percurso>${t('Abrir percurso')}</button></div>`),
    ...eve.map(s => `<div class="alert alert-strong"><b>${t('Amanhã: exame de {s}.', { s: esc(s.short) })}</b> ${t('Hoje só recuperação e revisão — sem matéria nova. Faz um teste de controlo curto e dorme bem: o sono consolida o que estudaste.')}</div>`),
    ...soon.map(({ s, days }) => `<div class="alert"><b>${t('{s}: exame em {n} dias.', { s: esc(s.short), n: days })}</b> ${t('Esta disciplina passa à frente.')} <button class="link-btn" data-probe="${esc(s.id)}">${t('Fazer teste de controlo')}</button></div>`),
  ].join('');
  $('exam-alerts').querySelectorAll('[data-percurso]').forEach(b => b.addEventListener('click', manageCurriculum));
  $('exam-alerts').querySelectorAll('[data-probe]').forEach(b => b.addEventListener('click', () => openProbeSetup(subjects, b.dataset.probe, startProbe)));
}

function renderToday() {
  renderExamAlerts();
  const today = new Date();
  const sessions = getTodaySessions(today).map(s => ({ ...s, sub: getSubject(s.subject), done: storage.isSessionDone(today, s.id) }));
  const doneCount = sessions.filter(s => s.done).length;

  $('today-count').textContent = sessions.length ? t('{a} de {b}', { a: doneCount, b: sessions.length }) : '';
  $('today-bar').style.width = sessions.length ? `${(doneCount / sessions.length) * 100}%` : '0';

  const next = sessions.find(s => !s.done);
  if (!hasPlan()) {
    $('next-up').innerHTML = `
      <div class="hero" style="--c:var(--accent)">
        <div class="eyebrow">${t('Bem-vindo')}</div>
        <div class="hero-name">${t('Monta o teu plano de estudo')}</div>
        <div class="hero-meta">${t('Adiciona as tuas disciplinas e datas — a IA organiza a semana com técnicas de estudo comprovadas. Também podes começar pelo plano de exemplo.')}</div>
        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-plan">${t('Criar plano')}</button>
          ${storage.isConfigured() ? '' : `<button class="btn btn-ghost" id="hero-server">${t('Ligar servidor')}</button>`}
        </div>
      </div>`;
    $('hero-plan').addEventListener('click', editPlan);
    $('hero-server')?.addEventListener('click', () => openServerScreen());
  } else if (!sessions.length) {
    $('next-up').innerHTML = `<div class="hero done"><div class="hero-name">${t('Dia livre')}</div><div class="hero-meta">${t('Sem sessões planeadas para hoje.')}</div></div>`;
  } else if (!next) {
    $('next-up').innerHTML = `<div class="hero done"><div class="eyebrow">${t('Tudo feito')}</div><div class="hero-name">${t('Dia concluído')}</div><div class="hero-meta">${t('{n} sessões fechadas. Descansa — amanhã há mais.', { n: doneCount })}</div></div>`;
  } else {
    $('next-up').innerHTML = `
      <div class="hero" style="--c:${esc(next.sub.color)}">
        <div class="row-between"><div class="eyebrow">${t('A seguir')}</div>${tag(next.sub)}</div>
        <div class="hero-name">${esc(next.sub.name)}</div>
        <div class="hero-meta">${detail(next)}</div>
        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-start">${icon('play')} ${t('Começar foco')}</button>
          <button class="btn btn-ghost" id="hero-done" aria-label="${t('Marcar como feita')}">${icon('check')}</button>
        </div>
      </div>`;
    $('hero-start').addEventListener('click', () => startStudying(next.subject));
    $('hero-done').addEventListener('click', () => toggleSession(next.id, true));
  }

  const groups = [['uni', t('Universidade')], ['lingua', t('Línguas')], ['outro', t('Outros')]];
  $('today-sessions').innerHTML = sessions.length ? groups.map(([area, label]) => {
    const items = sessions.filter(s => s.area === area);
    if (!items.length) return '';
    return `<div class="group-label">${label}</div>` + items.map(s => `
      <div class="session ${s.done ? 'done' : ''}">
        <button class="session-main" data-subject="${esc(s.subject)}">
          ${tag(s.sub)}
          <span class="session-text">
            <span class="session-name">${esc(s.sub.name)}</span>
            <span class="session-meta">${detail(s)}</span>
          </span>
        </button>
        <button class="check ${s.done ? 'on' : ''}" data-id="${esc(s.id)}" aria-pressed="${s.done}" aria-label="${s.done ? t('Desmarcar') : t('Marcar como feita')}">${icon('check')}</button>
      </div>`).join('');
  }).join('') : `<div class="empty">${hasPlan() ? t('Nada planeado para hoje.') : t('Ainda sem plano.')}</div>`;

  $('today-sessions').querySelectorAll('.check').forEach(btn => {
    btn.addEventListener('click', () => toggleSession(btn.dataset.id, btn.getAttribute('aria-pressed') !== 'true'));
  });
  $('today-sessions').querySelectorAll('.session-main').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSubject = btn.dataset.subject;
      renderTimerSubjects();
      switchTab('timer');
    });
  });
}

function toggleSession(id, done) {
  storage.setSessionDone(new Date(), id, done);
  if (done && storage.getSetting('sound') !== false) playSound('complete');
  renderToday();
  renderStats();
  renderWeek();
}

function renderStats() {
  const s = storage.getStats();
  $('stat-streak').textContent = s.streak;
  $('stat-hours').textContent = formatMinutes(s.totalMinutes);
  const weekAgo = Date.now() - 7 * 86400000;
  $('stat-sessions').textContent = storage.getAttempts().filter(a => a.kind === 'probe' && a.at >= weekAgo).length;
}

function allTips() {
  return [...plan.tips, ...studyMethod()];
}

function renderTip() {
  const tips = allTips();
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const tip = tips[dayOfYear % tips.length];
  $('tip-title').textContent = `${t('Dica')} · ${tip.title}`;
  $('tip-text').textContent = tip.text;
}

// ── Week ───────────────────────────────
function renderWeek() {
  const now = new Date();
  const phase = getCurrentPhase(now);
  const days = getDaysUntilExam(now);
  $('countdown-card').classList.toggle('hidden', days === null && !phases.length);
  $('days-until-exam').textContent = days ?? '—';
  $('phase-now').textContent = phase ? `${t('Fase')}: ${phase.name}${phase.ratio ? ` · ${phase.ratio}` : ''}` : t('Define a data dos exames no plano.');

  if (phases.length) {
    const start = new Date(phases[0].start + 'T00:00');
    const end = new Date(phases[phases.length - 1].end + 'T23:59');
    const span = end - start;
    const nowPct = Math.min(100, Math.max(0, ((now - start) / span) * 100));
    $('timeline').innerHTML = phases.map(p => {
      const w = ((new Date(p.end + 'T23:59') - new Date(p.start + 'T00:00')) / span) * 100;
      return `<div class="timeline-seg ${p.id === phase?.id ? 'current' : ''}" style="--c:${p.color};flex:${w}" title="${esc(p.name)}"><span>${esc(p.label)}</span></div>`;
    }).join('') + `<div class="timeline-now" style="left:${nowPct}%"></div>`;
  } else {
    $('timeline').innerHTML = '';
  }

  if (!hasPlan()) {
    $('week-list').innerHTML = `<div class="empty">${t('Ainda não tens plano semanal. Carrega em “Editar plano”.')}</div>`;
    return;
  }
  const monday = startOfWeek(now);
  $('week-list').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((dow, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const isToday = date.toDateString() === now.toDateString();
    const items = getSessionsForDay(dow);
    return `
      <div class="day ${isToday ? 'today' : ''}">
        <div class="day-name"><b>${DAY_SHORT()[dow]}</b><small>${date.getDate()}</small></div>
        <div class="day-items">
          ${items.length ? items.map(s => {
            const done = storage.isSessionDone(date, s.id);
            return `<div class="day-item ${done ? 'done' : ''}">${tag(getSubject(s.subject))}<span class="day-item-text"><b>${esc(s.session)}</b>${s.focus ? ` · ${esc(s.focus)}` : ''}</span></div>`;
          }).join('') : `<span class="muted small">${t('Descanso')}</span>`}
        </div>
      </div>`;
  }).join('');
}

// ── Progress ───────────────────────────
function renderMastery() {
  const now = new Date();
  if (!hasPlan()) { $('mastery-list').innerHTML = `<div class="empty">${t('Cria o teu plano primeiro.')}</div>`; return; }
  const attempts = storage.getAttempts();
  const results = storage.getExamResults();
  const pct = (x) => `${Math.round(x * 100)}%`;
  $('mastery-list').innerHTML = subjectPriorities(subjects, attempts, plan, now).map(p => {
    const s = p.subject;
    const flags = [];
    if (p.calibration.overconfident) flags.push(`<span class="flag warn">${t('Excesso de confiança: esperavas ~{e}, acertaste {a}', { e: pct(p.calibration.expected), a: pct(p.calibration.actual) })}</span>`);
    if (p.dependency) flags.push(`<span class="flag warn">${t('Depende de ajuda: {a} com ajuda vs {u} sem', { a: pct(p.split.assisted), u: pct(p.split.unassisted) })}</span>`);
    if (p.probeDue && p.mastery !== null) flags.push(`<span class="flag">${t('Teste de controlo em falta esta semana')}</span>`);
    if (s.prereqWeak?.length) flags.push(`<span class="flag warn">${t('Base fraca: {list} — o plano inclui revisão', { list: s.prereqWeak.map(w => `${esc(w.short)} (${t(w.reason)}${w.grade !== null ? `, ${w.grade}` : ''})`).join(', ') })}</span>`);
    const exam = results[s.id];
    let examLine = '';
    if (exam) examLine = `${t('Exame')}: ${exam.grade}/20${p.mastery !== null ? ` · ${t('último domínio medido {p}', { p: pct(p.mastery) })}` : ''}`;
    else if (p.days !== null && p.days < 0) examLine = s.ucId
      ? `<button class="link-btn" data-percurso>${t('Registar notas no percurso')}</button>`
      : `<button class="link-btn" data-grade="${esc(s.id)}">${t('Registar nota do exame')}</button>`;
    else if (p.days !== null) examLine = p.days === 0 ? t('exame hoje') : p.days === 1 ? t('exame amanhã') : t('exame em {n} dias', { n: p.days });
    const practiceParts = [
      p.split.unassisted !== null ? t('{p} sem ajuda', { p: pct(p.split.unassisted) }) : '',
      p.split.assisted !== null ? t('{p} com ajuda', { p: pct(p.split.assisted) }) : '',
    ].filter(Boolean);
    const practice = practiceParts.length ? `${t('Prática')}: ${practiceParts.join(' · ')}` : '';
    return `
      <div class="mastery-row">
        <div class="mastery-head">
          ${tag(s)}
          <div class="mastery-bar">${p.mastery === null ? `<span class="muted small">${t('Ainda sem teste — por aprender')}</span>` : `<i style="width:${pct(p.mastery)};background:${esc(s.color)}"></i>`}</div>
          <span class="mastery-pct">${p.mastery === null ? '—' : pct(p.mastery)}</span>
        </div>
        ${flags.length ? `<div class="flags">${flags.join('')}</div>` : ''}
        ${practice || examLine ? `<div class="mastery-meta muted small">${[practice, examLine].filter(Boolean).join(' · ')}</div>` : ''}
      </div>`;
  }).join('');
  $('mastery-list').querySelectorAll('[data-percurso]').forEach(b => b.addEventListener('click', manageCurriculum));
  $('mastery-list').querySelectorAll('[data-grade]').forEach(b => b.addEventListener('click', () => {
    const s = getSubject(b.dataset.grade);
    openExamGrade(s, results[s.id]?.grade, (g) => { storage.setExamResult(s.id, g); renderMastery(); });
  }));
}

function renderProgress() {
  renderMastery();
  renderPercursoCard($('percurso-card'), { onManage: manageCurriculum, onSemester: openSemester });
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const data = storage.getMinutesByDay(days);
  const max = Math.max(60, ...data.map(d => d.total));
  $('week-total').textContent = formatMinutes(data.reduce((a, d) => a + d.total, 0));
  $('chart-days').innerHTML = data.map((d, i) => `
    <div class="chart-col ${i === 6 ? 'today' : ''}" title="${formatMinutes(d.total)}">
      <div class="chart-bar">
        ${Object.entries(d.bySubject).map(([id, m]) => `<i style="height:${(m / max) * 100}%;background:${esc(getSubject(id).color)}"></i>`).join('')}
      </div>
      <small>${DAY_SHORT()[d.date.getDay()][0]}</small>
    </div>`).join('');

  const monday = startOfWeek(now);
  const thisWeek = storage.getMinutesByDay(Array.from({ length: (now.getDay() + 6) % 7 + 1 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  }));
  const bySubject = {};
  thisWeek.forEach(d => Object.entries(d.bySubject).forEach(([id, m]) => { bySubject[id] = (bySubject[id] || 0) + m; }));
  const rows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
  const subMax = Math.max(1, ...rows.map(r => r[1]));
  $('by-subject').innerHTML = rows.length ? rows.map(([id, m]) => {
    const sub = getSubject(id);
    return `<div class="subj-row">${tag(sub)}<div class="subj-bar" style="--c:${esc(sub.color)}"><i style="width:${(m / subMax) * 100}%"></i></div><span class="subj-min">${formatMinutes(m)}</span></div>`;
  }).join('') : `<div class="empty">${t('Ainda sem tempo registado esta semana. Os minutos entram aqui sempre que terminas um bloco de estudo no timer.')}</div>`;

  renderChecklist();
}

function renderChecklist() {
  const week = getWeekNumber();
  const checks = storage.getWeekChecklist(week);
  $('checklist-week').textContent = t('semana {n}', { n: week });
  $('checklist-container').innerHTML = checklist().map((q, i) => `
    <button class="check-row" data-idx="${i}" aria-pressed="${!!checks[i]}">
      <span class="check ${checks[i] ? 'on' : ''}">${icon('check')}</span>${esc(q)}
    </button>`).join('');
  $('checklist-container').querySelectorAll('.check-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = storage.getWeekChecklist(week);
      current[Number(btn.dataset.idx)] = !current[Number(btn.dataset.idx)];
      storage.saveWeekChecklist(week, current);
      renderChecklist();
    });
  });
}

function renderMethod() {
  const block = (list) => list.map(x => `
    <details><summary>${esc(x.title)}${icon('chevron').replace('class="ico"', 'class="ico chev"')}</summary><p>${esc(x.text)}</p></details>`).join('');
  $('method-cards').innerHTML =
    `<div class="accordion-group">${t('Método')}</div>${block(studyMethod())}` +
    (plan.tips.length ? `<div class="accordion-group">${t('O teu plano')}</div>${block(plan.tips)}` : '');
}

// ── Account / settings ─────────────────
function openSettings(open) {
  if (open) renderSummary();
  $('settings-panel').classList.toggle('active', open);
  $('settings-panel').setAttribute('aria-hidden', String(!open));
}

function setupSettings() {
  $('btn-settings').addEventListener('click', () => openSettings(true));
  $('btn-settings-close').addEventListener('click', () => openSettings(false));
  $('settings-panel').addEventListener('click', (e) => { if (e.target === $('settings-panel')) openSettings(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openSettings(false); });

  $('btn-settings-plan').addEventListener('click', () => { openSettings(false); editPlan(); });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([buildBackup(storage.loadData())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(t('Cópia de segurança exportada'));
  });

  $('btn-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) return toast(r.message);
    const s = r.summary;
    const when = r.exportedAt ? new Date(r.exportedAt).toLocaleDateString(locale()) : '—';
    if (!confirm([
      t('Juntar esta cópia de {d} ao que já tens?', { d: when }),
      t('{a} registos · {d} dias de estudo · {s} disciplinas no plano · {u} UCs no percurso', { a: s.attempts, d: s.days, s: s.subjects, u: s.ucs }),
      t('Nada é apagado: os registos juntam-se e, no plano e no percurso, fica a versão mais recente.'),
    ].join('\n\n'))) return;
    storage.importData(r.data);
    openSettings(false);
    loadPlan();
    applyTimerConfig();
    renderAll();
    toast(t('Cópia importada'));
  });
  $('btn-settings-server').addEventListener('click', () => { openSettings(false); openServerScreen(); });

  $('lang-select').innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${v}</option>`).join('');
  $('lang-select').addEventListener('change', (e) => {
    setLang(e.target.value);
    translateDOM();
    renderAll();
    renderAccount(accountMode);
    renderSummary();
  });

  $('btn-toggle-sound').addEventListener('click', () => {
    storage.setSetting('sound', storage.getSetting('sound') === false);
    renderSoundSwitch();
  });

  $('btn-clear-data').addEventListener('click', () => {
    if (confirm(t('Apagar os dados guardados neste dispositivo? O que está na tua conta volta a descarregar quando entrares.'))) {
      localStorage.removeItem('estudar_data');
      localStorage.removeItem(storage.TIMER_KEY);
      location.reload();
    }
  });

  $('btn-sign-out').addEventListener('click', async () => {
    if (timer.isRunning) timer.pause();
    await storage.signOut();
    openSettings(false);
    location.reload();
  });
}

function renderSoundSwitch() {
  $('btn-toggle-sound').setAttribute('aria-checked', String(storage.getSetting('sound') !== false));
}

let accountMode = 'local';
function renderAccount(mode) {
  accountMode = mode;
  const user = storage.getCurrentUser();
  const synced = !!user && mode === 'online';
  $('sync-dot').classList.toggle('connected', synced);
  $('sync-dot').title = synced ? t('Sincronizado') : mode === 'local' ? t('Modo local') : t('Offline');
  $('user-sync').textContent = synced ? t('Sincronizado')
    : mode === 'local' ? t('Modo local: os dados ficam só neste dispositivo. Liga o Supabase em “Servidor e chaves”.')
    : t('Offline — sincroniza quando voltares a ter ligação.');
  $('user-sync').classList.toggle('off', !synced);
  $('btn-sign-out').classList.toggle('hidden', mode === 'local');
  if (!user) {
    $('user-name').textContent = mode === 'local' ? t('Modo local') : '—';
    $('user-email').textContent = '';
    return;
  }
  $('user-name').textContent = user.displayName;
  $('user-email').textContent = user.email;
  $('topbar-initial').textContent = (user.displayName || user.email || '·')[0].toUpperCase();
  if (user.photoURL) {
    for (const id of ['user-avatar', 'topbar-avatar']) {
      $(id).src = user.photoURL;
      $(id).referrerPolicy = 'no-referrer';
    }
    $('topbar-avatar').classList.remove('hidden');
    $('topbar-initial').classList.add('hidden');
  }
}

// ── Login gate ─────────────────────────
function showLoginError(msg) {
  $('login-error').textContent = msg || '';
  $('login-error').classList.toggle('hidden', !msg);
}

function showLoginStep(step) {
  $('login-loading').classList.toggle('hidden', step !== 'loading');
  const auth = storage.getServerConfig()?.auth || { email: true, google: false };
  $('login-email-form').classList.toggle('hidden', step !== 'email' || !auth.email);
  $('login-code-form').classList.toggle('hidden', step !== 'code');
  $('btn-login-google').classList.toggle('hidden', step !== 'email' || !auth.google);
}

function setupLoginForms() {
  let email = '';

  $('login-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    email = $('login-email').value.trim();
    if (!email) return;
    const btn = e.submitter || $('login-email-form').querySelector('button');
    btn.disabled = true;
    showLoginError(null);
    const r = await storage.sendEmailCode(email);
    btn.disabled = false;
    if (!r.ok) return showLoginError(r.message);
    $('login-code-hint').textContent = t('Enviámos um código para {email}. Escreve-o aqui, ou abre o link do email neste dispositivo.', { email });
    showLoginStep('code');
    $('login-code').focus();
  });

  $('login-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('login-code').value.replace(/\s/g, '');
    if (!code) return;
    const btn = e.submitter || $('login-code-form').querySelector('button');
    btn.disabled = true;
    showLoginError(null);
    const r = await storage.verifyEmailCode(email, code);
    btn.disabled = false;
    if (!r.ok) return showLoginError(r.message);
    unlockApp('online');
  });

  $('login-back').addEventListener('click', () => { showLoginError(null); showLoginStep('email'); });

  $('btn-login-google').addEventListener('click', async () => {
    showLoginError(null);
    const r = await storage.signInWithGoogle();
    if (!r.ok) showLoginError(r.message);
  });
}

async function setupLoginGate() {
  setupLoginForms();
  storage.onAuthChange((user) => {
    if (user) unlockApp('online');
    else location.reload();
  });

  const state = await storage.init();
  if (state === 'local') return unlockApp('local');
  if (state === 'signed-in') return unlockApp('online');
  if (state === 'offline' && storage.hadPreviousLogin()) return unlockApp('offline');

  showLoginStep('email');
  if (state === 'offline') showLoginError(t('Sem ligação. Liga-te à internet para iniciar sessão.'));
}

function unlockApp(mode) {
  document.body.classList.remove('locked');
  loadPlan();
  renderAll();
  renderAccount(mode);
}

// ── Intro ──────────────────────────────
const INTRO_KEY = 'estudar_intro_seen';

function showIntro(show) {
  document.body.classList.toggle('intro', show);
  $('intro').setAttribute('aria-hidden', String(!show));
  if (show) $('intro').scrollTop = 0;
}

function setupIntro() {
  $('btn-intro-start').addEventListener('click', () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch {}
    showIntro(false);
  });
  $('btn-settings-intro').addEventListener('click', () => { openSettings(false); showIntro(true); });
  // First visit only; afterwards it lives under Account → About the method.
  let seen = false;
  try { seen = !!localStorage.getItem(INTRO_KEY); } catch {}
  showIntro(!seen);
}

// ── Boot ───────────────────────────────
function renderAll() {
  renderHeader();
  renderToday();
  renderStats();
  renderTip();
  renderWeek();
  renderProgress();
  renderMethod();
  renderTimerSubjects();
  renderTimerSettings();
  renderSoundSwitch();
  renderTimer();
}

document.addEventListener('DOMContentLoaded', () => {
  setLang(lang);
  translateDOM();
  setupIntro();
  loadPlan();
  applyTimerConfig();
  restoreTimer();
  setupNav();
  setupTimer();
  setupFocus();
  setupSettings();
  setupPlanner();
  setupServerScreen();
  setupLog();
  setupPercurso();
  $('btn-settings-percurso').addEventListener('click', () => { openSettings(false); manageCurriculum(); });
  $('btn-probe').addEventListener('click', () => {
    if (!hasPlan()) return editPlan();
    openProbeSetup(subjects, subjects.some(s => s.id === selectedSubject) ? selectedSubject : subjects[0].id, startProbe);
  });
  renderAll();

  storage.onSync(() => {
    loadPlan();
    applyTimerConfig();
    renderAll();
  });

  // Day rolls over while the app stays open (e.g. studying past midnight).
  let lastDay = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    renderTimer();
    if (new Date().toDateString() !== lastDay) {
      lastDay = new Date().toDateString();
      renderAll();
    }
  });

  setupLoginGate();

  if ('serviceWorker' in navigator) {
    // Reload once when a new deploy's worker takes over (skip on the very first install).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || !timer.isIdle) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
