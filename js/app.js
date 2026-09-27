import { plan, subjects, phases, checklist, studyMethod, EXAMPLE_PLAN, normalizePlan, setActivePlan, hasPlan, getCurrentPhase, getTodaySessions, getSessionsForDay, getSubject, getWeekNumber, getDaysUntilExam } from './data.js';
import { Timer } from './timer.js';
import * as storage from './storage.js';
import { AUTH_METHODS } from './config.js';
import { openPlanner, setupPlanner } from './planner.js';
import { enterFocusMode, exitFocusMode, playSound } from './focus.js';

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 118;
const PHASE_LABEL = { work: 'estudo', break: 'pausa', longBreak: 'pausa longa' };
const TAB_TITLE = { today: 'Hoje', week: 'Semana', timer: 'Timer', progress: 'Progresso' };
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

let selectedSubject = 'all';
let focusActive = false;

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
    if (Object.keys(d.sessions || {}).length || Object.keys(d.focus || {}).length) storage.savePlan(normalizePlan(EXAMPLE_PLAN));
  }
  setActivePlan(storage.getPlan());
  const valid = new Set([...subjects.map(s => s.id), 'all']);
  if (!valid.has(selectedSubject)) {
    selectedSubject = getTodaySessions().find(s => s.subject !== 'all')?.subject || subjects[0]?.id || 'all';
  }
}

function editPlan() {
  openPlanner(hasPlan() ? plan : null, () => {
    loadPlan();
    renderAll();
    toast('Plano guardado');
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
  const snap = JSON.stringify({ ...timer.snapshot(), subject: selectedSubject });
  if (snap === lastSavedState) return;
  lastSavedState = snap;
  try { localStorage.setItem(storage.TIMER_KEY, snap); } catch {}
}

function restoreTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem(storage.TIMER_KEY) || 'null');
    if (!saved) return;
    if (saved.subject) selectedSubject = saved.subject;
    timer.restore(saved);
  } catch {}
}

function onPhaseEnd({ finished, next, natural, workedSeconds }) {
  if (finished === 'work') {
    const minutes = Math.round(workedSeconds / 60);
    storage.logFocus(selectedSubject, minutes);
    if (natural && storage.getSetting('sound') !== false) playSound('complete');
    if (minutes > 0) toast(`+${minutes} min de ${getSubject(selectedSubject).short} · ${PHASE_LABEL[next]} a seguir`);
    renderStats();
    renderProgress();
    // Breaks start by themselves; the next study block waits for you.
    if (natural) timer.start();
  } else if (natural) {
    if (storage.getSetting('sound') !== false) playSound('break');
    toast('Pausa terminada — carrega ▶ quando estiveres pronto');
  }
}

function renderTimer() {
  persistTimer();
  const time = Timer.format(timer.remaining);
  const progress = timer.isIdle ? 0 : timer.progress;
  const playing = timer.isRunning;

  $('timer-display').textContent = time;
  $('timer-phase').textContent = timer.isIdle && timer.phase === 'work' && timer.sessionsCompleted === 0 ? 'pronto' : PHASE_LABEL[timer.phase];
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
    $(id).setAttribute('aria-label', playing ? 'Pausar' : 'Iniciar');
  }

  if (focusActive) {
    $('focus-time').textContent = time;
    $('focus-phase').textContent = timer.isPaused ? 'em pausa' : PHASE_LABEL[timer.phase];
    const bar = $('focus-progress');
    bar.style.width = `${progress * 100}%`;
    bar.style.background = timer.phase === 'work' ? 'var(--accent)' : timer.phase === 'break' ? 'var(--break)' : 'var(--long)';
    const block = Math.min(done + (timer.phase === 'work' ? 1 : 0), timer.config.sessionsBeforeLong) || timer.config.sessionsBeforeLong;
    $('focus-count').textContent = `Bloco ${block} de ${timer.config.sessionsBeforeLong}`;
  }

  document.title = timer.isIdle ? 'Estudar' : `${time} · ${PHASE_LABEL[timer.phase]} — Estudar`;
}

function setupTimer() {
  $('btn-timer-main').addEventListener('click', () => timer.toggle());
  $('btn-focus-main').addEventListener('click', () => timer.toggle());
  for (const id of ['btn-timer-reset', 'btn-focus-reset']) {
    $(id).addEventListener('click', () => {
      if (!timer.isIdle && !confirm('Reiniciar o ciclo? O bloco atual não será contado.')) return;
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
  $('focus-subject').textContent = sub.name;
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
  $('topbar-title').textContent = TAB_TITLE[tab];
  window.scrollTo({ top: 0 });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('btn-edit-plan').addEventListener('click', editPlan);
}

function renderHeader() {
  const now = new Date();
  const week = plan.startDate ? ` · semana ${getWeekNumber(now)}` : '';
  $('topbar-date').textContent = `${DAY_LONG[now.getDay()]}, ${now.getDate()} ${MONTH_SHORT[now.getMonth()]}${week}`;
}

// ── Today ──────────────────────────────
function renderToday() {
  const today = new Date();
  const sessions = getTodaySessions(today).map(s => ({ ...s, sub: getSubject(s.subject), done: storage.isSessionDone(today, s.id) }));
  const doneCount = sessions.filter(s => s.done).length;

  $('today-count').textContent = sessions.length ? `${doneCount} de ${sessions.length}` : '';
  $('today-bar').style.width = sessions.length ? `${(doneCount / sessions.length) * 100}%` : '0';

  const next = sessions.find(s => !s.done);
  if (!hasPlan()) {
    $('next-up').innerHTML = `
      <div class="hero" style="--c:var(--accent)">
        <div class="eyebrow">Bem-vindo</div>
        <div class="hero-name">Monta o teu plano de estudo</div>
        <div class="hero-meta">Adiciona as tuas disciplinas e datas — a IA organiza a semana com técnicas de estudo comprovadas. Também podes começar pelo plano de exemplo.</div>
        <div class="hero-actions"><button class="btn btn-primary" id="hero-plan">Criar plano</button></div>
      </div>`;
    $('hero-plan').addEventListener('click', editPlan);
  } else if (!sessions.length) {
    $('next-up').innerHTML = `<div class="hero done"><div class="hero-name">Dia livre</div><div class="hero-meta">Sem sessões planeadas para hoje.</div></div>`;
  } else if (!next) {
    $('next-up').innerHTML = `<div class="hero done"><div class="eyebrow">Tudo feito</div><div class="hero-name">Dia concluído</div><div class="hero-meta">${doneCount} sessões fechadas. Descansa — amanhã há mais.</div></div>`;
  } else {
    $('next-up').innerHTML = `
      <div class="hero" style="--c:${esc(next.sub.color)}">
        <div class="row-between"><div class="eyebrow">A seguir</div>${tag(next.sub)}</div>
        <div class="hero-name">${esc(next.sub.name)}</div>
        <div class="hero-meta">${detail(next)}</div>
        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-start">${icon('play')} Começar foco</button>
          <button class="btn btn-ghost" id="hero-done" aria-label="Marcar como feita">${icon('check')}</button>
        </div>
      </div>`;
    $('hero-start').addEventListener('click', () => startStudying(next.subject));
    $('hero-done').addEventListener('click', () => toggleSession(next.id, true));
  }

  const groups = [['uni', 'Universidade'], ['lingua', 'Línguas'], ['outro', 'Outros']];
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
        <button class="check ${s.done ? 'on' : ''}" data-id="${esc(s.id)}" aria-pressed="${s.done}" aria-label="${s.done ? 'Desmarcar' : 'Marcar como feita'}">${icon('check')}</button>
      </div>`).join('');
  }).join('') : `<div class="empty">${hasPlan() ? 'Nada planeado para hoje.' : 'Ainda sem plano.'}</div>`;

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
  $('stat-sessions').textContent = s.totalSessions;
}

function allTips() {
  return [...plan.tips, ...studyMethod];
}

function renderTip() {
  const tips = allTips();
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const tip = tips[dayOfYear % tips.length];
  $('tip-title').textContent = `Dica · ${tip.title}`;
  $('tip-text').textContent = tip.text;
}

// ── Week ───────────────────────────────
function renderWeek() {
  const now = new Date();
  const phase = getCurrentPhase(now);
  const days = getDaysUntilExam(now);
  $('countdown-card').classList.toggle('hidden', days === null && !phases.length);
  $('days-until-exam').textContent = days ?? '—';
  $('phase-now').textContent = phase ? `Fase: ${phase.name}${phase.ratio ? ` · ${phase.ratio}` : ''}` : 'Define a data dos exames no plano.';

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
    $('week-list').innerHTML = `<div class="empty">Ainda não tens plano semanal. Carrega em “Editar plano”.</div>`;
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
        <div class="day-name"><b>${DAY_SHORT[dow]}</b><small>${date.getDate()}</small></div>
        <div class="day-items">
          ${items.length ? items.map(s => {
            const done = storage.isSessionDone(date, s.id);
            return `<div class="day-item ${done ? 'done' : ''}">${tag(getSubject(s.subject))}<span class="day-item-text"><b>${esc(s.session)}</b>${s.focus ? ` · ${esc(s.focus)}` : ''}</span></div>`;
          }).join('') : '<span class="muted small">Descanso</span>'}
        </div>
      </div>`;
  }).join('');
}

// ── Progress ───────────────────────────
function renderProgress() {
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
      <small>${DAY_SHORT[d.date.getDay()][0]}</small>
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
  }).join('') : '<div class="empty">Ainda sem tempo registado esta semana. Os minutos entram aqui sempre que terminas um bloco de estudo no timer.</div>';

  renderChecklist();
}

function renderChecklist() {
  const week = getWeekNumber();
  const checks = storage.getWeekChecklist(week);
  $('checklist-week').textContent = `semana ${week}`;
  $('checklist-container').innerHTML = checklist.map((q, i) => `
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
  const block = (list) => list.map(t => `
    <details><summary>${esc(t.title)}${icon('chevron').replace('class="ico"', 'class="ico chev"')}</summary><p>${esc(t.text)}</p></details>`).join('');
  $('method-cards').innerHTML =
    `<div class="accordion-group">Método</div>${block(studyMethod)}` +
    (plan.tips.length ? `<div class="accordion-group">O teu plano</div>${block(plan.tips)}` : '');
}

// ── Account / settings ─────────────────
function openSettings(open) {
  $('settings-panel').classList.toggle('active', open);
  $('settings-panel').setAttribute('aria-hidden', String(!open));
}

function setupSettings() {
  $('btn-settings').addEventListener('click', () => openSettings(true));
  $('btn-settings-close').addEventListener('click', () => openSettings(false));
  $('settings-panel').addEventListener('click', (e) => { if (e.target === $('settings-panel')) openSettings(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openSettings(false); });

  $('btn-settings-plan').addEventListener('click', () => { openSettings(false); editPlan(); });

  $('btn-toggle-sound').addEventListener('click', () => {
    storage.setSetting('sound', storage.getSetting('sound') === false);
    renderSoundSwitch();
  });

  $('btn-clear-data').addEventListener('click', () => {
    if (confirm('Apagar os dados guardados neste dispositivo? O que está na tua conta volta a descarregar quando entrares.')) {
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

function renderAccount(mode) {
  const user = storage.getCurrentUser();
  const synced = !!user && mode === 'online';
  $('sync-dot').classList.toggle('connected', synced);
  $('sync-dot').title = synced ? 'Sincronizado' : mode === 'local' ? 'Modo local' : 'Offline';
  $('user-sync').textContent = synced ? 'Sincronizado'
    : mode === 'local' ? 'Modo local: os dados ficam só neste dispositivo (Supabase não configurado).'
    : 'Offline — sincroniza quando voltares a ter ligação.';
  $('user-sync').classList.toggle('off', !synced);
  $('btn-sign-out').classList.toggle('hidden', mode === 'local');
  if (!user) {
    $('user-name').textContent = mode === 'local' ? 'Modo local' : '—';
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
  $('login-email-form').classList.toggle('hidden', step !== 'email' || !AUTH_METHODS.email);
  $('login-code-form').classList.toggle('hidden', step !== 'code');
  $('btn-login-google').classList.toggle('hidden', step !== 'email' || !AUTH_METHODS.google);
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
    $('login-code-hint').textContent = `Enviámos um código para ${email}. Escreve-o aqui, ou abre o link do email neste dispositivo.`;
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
  if (state === 'offline') showLoginError('Sem ligação. Liga-te à internet para iniciar sessão.');
}

function unlockApp(mode) {
  document.body.classList.remove('locked');
  loadPlan();
  renderAll();
  renderAccount(mode);
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
  loadPlan();
  applyTimerConfig();
  restoreTimer();
  setupNav();
  setupTimer();
  setupFocus();
  setupSettings();
  setupPlanner();
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
