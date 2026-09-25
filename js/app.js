import { subjects, weeklyPlan, phases, checklist, studyMethod, languageMethod, getCurrentPhase, getTodaySessions, getSubject, getWeekNumber, getDaysUntilExam } from './data.js';
import { Timer } from './timer.js';
import * as storage from './storage.js';
import { enterFocusMode, exitFocusMode, isFocusActive, playSound } from './focus.js';

// ── State ──────────────────────────────
let currentTab = 'today';
let selectedSubject = subjects[0].id;
let focusModeActive = false;
let timerMinutesAccum = 0;
const CIRCUMFERENCE = 2 * Math.PI * 120;        // main timer ring
const FOCUS_CIRCUMFERENCE = 2 * Math.PI * 170;   // focus mode ring

// ── Timer ──────────────────────────────
const timerConfig = storage.getTimerConfig();
const timer = new Timer(
  (remaining, progress, phase) => onTimerTick(remaining, progress, phase),
  (phase, sessions, nextPhase) => onTimerComplete(phase, sessions, nextPhase),
  (phase, sessions) => onPhaseChange(phase, sessions),
);
timer.configure({
  work: timerConfig.work * 60,
  break: timerConfig.break * 60,
  longBreak: timerConfig.longBreak * 60,
  sessionsBeforeLong: timerConfig.sessionsBeforeLong,
});

// ── Init ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  setupNav();
  setupTimer();
  setupFocusMode();
  setupSettings();
  setupTimerSettings();
  updateTimerDisplay();

  storage.onSync(() => renderAll());

  // Auto-connect Firebase
  storage.autoInit().then(loggedIn => {
    updateAccountUI();
    if (loggedIn) {
      document.getElementById('sync-dot').classList.add('connected');
      document.getElementById('sync-dot').title = 'Sincronizado';
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// ── Navigation ─────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active');
      currentTab = tab;
    });
  });
}

// ── Render All ─────────────────────────
function renderAll() {
  renderPhaseBanner();
  renderStats();
  renderTodaySessions();
  renderMethodTip();
  renderWeekGrid();
  renderGantt();
  renderChecklist();
  renderMethodCards();
  renderTimerSubjects();
  renderDaysCounter();
}

// ── Phase Banner ───────────────────────
function renderPhaseBanner() {
  const phase = getCurrentPhase();
  const el = document.getElementById('phase-banner');
  el.innerHTML = `
    <div class="phase-badge" style="background:${phase.color};color:#fff">${phase.label}</div>
    <div class="phase-info">
      <div class="phase-label">Fase atual</div>
      <div class="phase-desc">${phase.ratio}</div>
    </div>
  `;
}

// ── Stats ──────────────────────────────
function renderStats() {
  const stats = storage.getStats();
  document.getElementById('stat-streak').textContent = stats.streak;
  document.getElementById('stat-sessions').textContent = stats.totalSessions;
  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  document.getElementById('stat-hours').textContent = hours > 0 ? `${hours}h${mins > 0 ? mins : ''}` : `${mins}m`;
}

// ── Today Sessions ─────────────────────
function renderTodaySessions() {
  const container = document.getElementById('today-sessions');
  const sessions = getTodaySessions();
  const today = new Date();

  if (sessions.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">🎉</div><p>Sem sessões programadas para hoje!</p></div>`;
    return;
  }

  const uniSessions = sessions.filter(s => s.area === 'uni');
  const langSessions = sessions.filter(s => s.area === 'lingua');

  const renderCards = (list) => list.map(s => {
    const sub = getSubject(s.subject);
    const done = storage.isSessionDone(today, s.subject + (s.block || ''));
    return `
      <div class="session-card ${done ? 'done' : ''}" data-subject="${s.subject}" data-block="${s.block || ''}">
        <div class="session-icon" style="background:${sub.color}20;color:${sub.color}">${sub.icon}</div>
        <div class="session-info">
          <div class="session-subject">${sub.name}</div>
          <div class="session-type">${s.session}</div>
          ${s.reviewLabel ? `<div class="session-review">${s.reviewLabel}</div>` : ''}
        </div>
        <button class="session-check ${done ? 'checked' : ''}" data-id="${s.subject + (s.block || '')}">✓</button>
      </div>
    `;
  }).join('');

  container.innerHTML =
    (uniSessions.length ? `<div class="section-subtitle">🎓 Universidade</div>${renderCards(uniSessions)}` : '') +
    (langSessions.length ? `<div class="section-subtitle mt-16">🌍 Línguas</div>${renderCards(langSessions)}` : '');

  container.querySelectorAll('.session-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const done = btn.classList.contains('checked');
      if (done) {
        storage.unmarkSession(new Date(), id);
      } else {
        const elapsed = Math.round(timerMinutesAccum);
        storage.markSessionDone(new Date(), id, elapsed || timerConfig.work);
        timerMinutesAccum = 0;
        playSound('complete');
      }
      renderAll();
    });
  });

  container.querySelectorAll('.session-card').forEach(card => {
    card.addEventListener('click', () => {
      const subId = card.dataset.subject;
      if (subId !== 'all') {
        selectedSubject = subId;
        renderTimerSubjects();
        switchTab('timer');
      }
    });
  });
}

// ── Method Tip ─────────────────────────
function renderMethodTip() {
  const allTips = [...Object.entries(studyMethod), ...Object.entries(languageMethod)];
  const idx = new Date().getDay() % allTips.length;
  const [key, val] = allTips[idx];
  const titles = {
    structure: 'Estrutura', reviewShort: 'Revisão', programming: 'Programação',
    mix: 'Misturar tópicos', metric: 'Métrica', blocks: 'Blocos 40+10', rest: 'Descanso',
    priority: 'Prioridades', c2: 'Cambridge C2', german: 'Alemão',
    december: 'Dezembro', adjust: 'Regra de ajuste',
  };
  document.getElementById('method-tip').innerHTML = `
    <h4>${titles[key] || key}</h4>
    <p>${val}</p>
  `;
}

// ── Week Grid ──────────────────────────
function renderWeekGrid() {
  const container = document.getElementById('week-grid');
  const today = new Date().getDay();
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const groups = {};

  weeklyPlan.forEach(s => {
    const d = Math.floor(s.day);
    if (!groups[d]) groups[d] = [];
    groups[d].push(s);
  });

  const days = [1, 2, 3, 4, 5, 6, 0];
  container.innerHTML = days.map(d => {
    const sessions = groups[d] || [];
    const isToday = d === today;
    return `
      <div class="week-day-card ${isToday ? 'today' : ''}">
        <div class="week-day-name">${dayNames[d]}</div>
        <div class="week-day-subjects">
          ${sessions.map(s => {
            const sub = getSubject(s.subject);
            return `<span class="week-subject-tag" style="background:${sub.color}">${sub.short}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ── Gantt Chart ────────────────────────
function renderGantt() {
  const container = document.getElementById('gantt-chart');
  const start = new Date('2026-09-25');
  const end = new Date('2027-01-04');
  const total = end - start;
  const now = new Date();
  const nowPct = Math.min(100, Math.max(0, ((now - start) / total) * 100));

  const uniSubjects = subjects.filter(s => s.area === 'uni');
  const langSubjects = subjects.filter(s => s.area === 'lingua');

  container.innerHTML = uniSubjects.map(sub => {
    return `
      <div class="gantt-row">
        <div class="gantt-label" style="color:${sub.color}">${sub.short}</div>
        <div class="gantt-bar-container">
          ${phases.map(p => {
            const pStart = new Date(p.start);
            const pEnd = new Date(p.end);
            const left = ((pStart - start) / total) * 100;
            const width = ((pEnd - pStart) / total) * 100;
            return `<div class="gantt-bar" style="position:absolute;left:${left}%;width:${width}%;background:${p.color}40;border-left:2px solid ${p.color}">${p.label}</div>`;
          }).join('')}
          <div class="gantt-now" style="left:${nowPct}%"></div>
        </div>
      </div>
    `;
  }).join('') + langSubjects.map(sub => {
    return `
      <div class="gantt-row">
        <div class="gantt-label" style="color:${sub.color}">${sub.short}</div>
        <div class="gantt-bar-container">
          <div class="gantt-bar" style="position:absolute;left:0;width:100%;background:${sub.color}30;border-left:2px solid ${sub.color}">contínuo</div>
          <div class="gantt-now" style="left:${nowPct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Days Counter ───────────────────────
function renderDaysCounter() {
  document.getElementById('days-until-exam').textContent = getDaysUntilExam();
}

// ── Checklist ──────────────────────────
function renderChecklist() {
  const container = document.getElementById('checklist-container');
  const weekNum = getWeekNumber();
  const checks = storage.getWeekChecklist(weekNum);

  container.innerHTML = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Semana ${weekNum}</div>
    ${checklist.map((q, i) => `
      <div class="checklist-item">
        <button class="checklist-checkbox ${checks[i] ? 'checked' : ''}" data-idx="${i}">✓</button>
        <span class="checklist-text">${q}</span>
      </div>
    `).join('')}
  `;

  container.querySelectorAll('.checklist-checkbox').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const weekNum = getWeekNumber();
      const checks = storage.getWeekChecklist(weekNum);
      checks[idx] = !checks[idx];
      storage.saveWeekChecklist(weekNum, checks);
      renderChecklist();
    });
  });
}

// ── Method Cards ───────────────────────
function renderMethodCards() {
  const container = document.getElementById('method-cards');
  const titles = {
    structure: 'Estrutura de estudo', reviewShort: 'Revisão espaçada', programming: 'Programação',
    mix: 'Misturar tópicos', metric: 'Como medir progresso', blocks: 'Blocos 40+10', rest: 'Descanso',
    priority: '⚡ Prioridades', c2: '🇬🇧 Cambridge C2', german: '🇩🇪 Alemão básico',
    december: '📅 Dezembro', adjust: '⚠️ Regra de ajuste',
  };

  const studyCards = Object.entries(studyMethod).map(([key, val]) => `
    <div class="method-card">
      <h4>${titles[key] || key}</h4>
      <p>${val}</p>
    </div>
  `).join('');

  const langCards = Object.entries(languageMethod).map(([key, val]) => `
    <div class="method-card">
      <h4>${titles[key] || key}</h4>
      <p>${val}</p>
    </div>
  `).join('');

  container.innerHTML = studyCards +
    '<div class="section-title mt-24">Línguas — como encaixar</div>' +
    langCards;
}

// ── Timer Subjects ─────────────────────
function renderTimerSubjects() {
  const container = document.getElementById('timer-subjects');
  container.innerHTML = subjects.map(s => `
    <button class="subject-pill ${s.id === selectedSubject ? 'active' : ''}" data-id="${s.id}" style="${s.id === selectedSubject ? `background:${s.color};border-color:${s.color}` : ''}">
      ${s.icon} ${s.short}
    </button>
  `).join('');

  container.querySelectorAll('.subject-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSubject = btn.dataset.id;
      renderTimerSubjects();
    });
  });
}

// ── Timer Setup ────────────────────────
function setupTimer() {
  const mainBtn = document.getElementById('btn-timer-main');
  const resetBtn = document.getElementById('btn-timer-reset');
  const skipBtn = document.getElementById('btn-timer-skip');

  mainBtn.addEventListener('click', () => {
    if (timer.isStopped) {
      timer.start('work');
      mainBtn.textContent = '⏸';
      mainBtn.classList.add('running');
    } else if (timer.isPaused) {
      timer.resume();
      mainBtn.textContent = '⏸';
    } else {
      timer.pause();
      mainBtn.textContent = '▶';
    }
  });

  resetBtn.addEventListener('click', () => {
    timer.reset();
    mainBtn.textContent = '▶';
    mainBtn.classList.remove('running');
    timerMinutesAccum = 0;
    updateTimerDisplay();
  });

  skipBtn.addEventListener('click', () => {
    if (timer.running) timer.skip();
  });
}

function updateTimerDisplay() {
  const config = storage.getTimerConfig();
  document.getElementById('timer-display').textContent = Timer.formatTime(config.work * 60);
  document.getElementById('timer-phase').textContent = 'pronto';
  document.getElementById('timer-progress').style.strokeDashoffset = '0';
  renderTimerDots(0);
}

function renderTimerDots(filled) {
  const config = storage.getTimerConfig();
  const container = document.getElementById('timer-dots');
  container.innerHTML = Array.from({ length: config.sessionsBeforeLong }, (_, i) =>
    `<div class="timer-dot ${i < filled ? 'filled' : ''}"></div>`
  ).join('');
}

function onTimerTick(remaining, progress, phase) {
  document.getElementById('timer-display').textContent = Timer.formatTime(remaining);
  const offset = CIRCUMFERENCE * (1 - progress);
  const ring = document.getElementById('timer-progress');
  ring.style.strokeDashoffset = offset;
  ring.classList.toggle('break', phase === 'break');
  ring.classList.toggle('longBreak', phase === 'longBreak');

  if (phase === 'work') {
    timerMinutesAccum += 1 / 60;
  }

  // Focus mode sync
  if (focusModeActive) {
    document.getElementById('focus-time').textContent = Timer.formatTime(remaining);
    const focusOffset = FOCUS_CIRCUMFERENCE * (1 - progress);
    const fp = document.getElementById('focus-progress');
    fp.style.strokeDashoffset = focusOffset;
    fp.setAttribute('stroke', phase === 'work' ? 'var(--primary)' : phase === 'longBreak' ? 'var(--accent)' : 'var(--success)');
  }

  document.title = `${Timer.formatTime(remaining)} — Estudar`;
}

function onTimerComplete(phase, sessions, nextPhase) {
  const data = storage.loadData();
  if (data.settings.sound) playSound(phase === 'work' ? 'complete' : 'break');

  renderTimerDots(sessions);

  if (focusModeActive) {
    const phaseLabels = { work: 'estudo', break: 'pausa', longBreak: 'pausa longa' };
    document.getElementById('focus-phase').textContent = phaseLabels[nextPhase] || nextPhase;
    document.getElementById('focus-count').textContent = `Sessão ${sessions + (nextPhase === 'work' ? 1 : 0)} / ${timer.config.sessionsBeforeLong}`;
  }

  if (data.settings.autoStart) {
    setTimeout(() => timer.start(nextPhase), 1500);
  } else {
    const phaseLabels = { work: 'ESTUDAR', break: 'PAUSA', longBreak: 'PAUSA LONGA' };
    document.getElementById('timer-display').textContent = Timer.formatTime(timer.config[nextPhase]);
    document.getElementById('timer-phase').textContent = `próximo: ${phaseLabels[nextPhase]}`;
    document.getElementById('btn-timer-main').textContent = '▶';
    document.getElementById('btn-timer-main').classList.remove('running');
    document.getElementById('btn-timer-main').onclick = () => {
      timer.start(nextPhase);
      document.getElementById('btn-timer-main').textContent = '⏸';
      document.getElementById('btn-timer-main').classList.add('running');
      document.getElementById('btn-timer-main').onclick = null;
      setupTimer();
    };
  }

  document.title = 'Estudar';
  renderStats();
}

function onPhaseChange(phase) {
  const phaseLabels = { work: 'estudo', break: 'pausa', longBreak: 'pausa longa' };
  document.getElementById('timer-phase').textContent = phaseLabels[phase] || phase;
  if (focusModeActive) {
    document.getElementById('focus-phase').textContent = phaseLabels[phase] || phase;
  }
}

// ── Timer Settings ─────────────────────
function setupTimerSettings() {
  const config = storage.getTimerConfig();
  document.getElementById('setting-work').textContent = config.work;
  document.getElementById('setting-break').textContent = config.break;
  document.getElementById('setting-longBreak').textContent = config.longBreak;

  document.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting;
      const dir = parseInt(btn.dataset.dir);
      const config = storage.getTimerConfig();
      const mins = { work: [5, 90], break: [1, 30], longBreak: [5, 60] };
      config[key] = Math.max(mins[key][0], Math.min(mins[key][1], config[key] + dir * 5));
      storage.saveTimerConfig(config);
      document.getElementById(`setting-${key}`).textContent = config[key];
      timer.configure({
        work: config.work * 60,
        break: config.break * 60,
        longBreak: config.longBreak * 60,
      });
      if (timer.isStopped) updateTimerDisplay();
    });
  });
}

// ── Focus Mode ─────────────────────────
function setupFocusMode() {
  document.getElementById('btn-focus-mode').addEventListener('click', () => {
    activateFocusMode();
  });

  document.getElementById('btn-focus-exit').addEventListener('click', () => {
    deactivateFocusMode();
  });

  document.getElementById('btn-focus-main').addEventListener('click', () => {
    if (timer.isStopped) {
      timer.start('work');
      document.getElementById('btn-focus-main').textContent = '⏸';
    } else if (timer.isPaused) {
      timer.resume();
      document.getElementById('btn-focus-main').textContent = '⏸';
    } else {
      timer.pause();
      document.getElementById('btn-focus-main').textContent = '▶';
    }
  });

  document.getElementById('btn-focus-reset').addEventListener('click', () => {
    timer.reset();
    timerMinutesAccum = 0;
    const config = storage.getTimerConfig();
    document.getElementById('focus-time').textContent = Timer.formatTime(config.work * 60);
    document.getElementById('focus-phase').textContent = 'pronto';
    document.getElementById('focus-progress').style.strokeDashoffset = '0';
    document.getElementById('btn-focus-main').textContent = '▶';
  });

  document.getElementById('btn-focus-skip').addEventListener('click', () => {
    if (timer.running) timer.skip();
  });

  document.addEventListener('focusModeExit', () => {
    focusModeActive = false;
    document.getElementById('focus-overlay').classList.remove('active');
  });
}

async function activateFocusMode() {
  focusModeActive = true;
  const sub = getSubject(selectedSubject);
  document.getElementById('focus-subject').textContent = `${sub.icon} ${sub.name}`;
  const config = storage.getTimerConfig();

  if (timer.isStopped) {
    document.getElementById('focus-time').textContent = Timer.formatTime(config.work * 60);
    document.getElementById('focus-phase').textContent = 'pronto';
    document.getElementById('focus-progress').style.strokeDashoffset = '0';
    document.getElementById('btn-focus-main').textContent = '▶';
  } else {
    document.getElementById('btn-focus-main').textContent = timer.isPaused ? '▶' : '⏸';
  }
  document.getElementById('focus-count').textContent = `Sessão ${timer.sessionsCompleted + 1} / ${config.sessionsBeforeLong}`;

  document.getElementById('focus-overlay').classList.add('active');
  await enterFocusMode();
}

async function deactivateFocusMode() {
  focusModeActive = false;
  document.getElementById('focus-overlay').classList.remove('active');
  await exitFocusMode();

  // Sync timer state back to main view
  if (timer.running) {
    document.getElementById('btn-timer-main').textContent = timer.isPaused ? '▶' : '⏸';
    document.getElementById('btn-timer-main').classList.toggle('running', !timer.isPaused);
  }
}

// ── Settings ───────────────────────────
function setupSettings() {
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('active');
  });

  document.getElementById('btn-settings-close').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('active');
  });

  document.getElementById('settings-panel').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-panel')) {
      document.getElementById('settings-panel').classList.remove('active');
    }
  });

  // Sound toggle
  const data = storage.loadData();
  document.getElementById('btn-toggle-sound').textContent = data.settings.sound ? 'Ligado' : 'Desligado';
  document.getElementById('btn-toggle-sound').addEventListener('click', () => {
    const data = storage.loadData();
    data.settings.sound = !data.settings.sound;
    storage.saveData(data);
    document.getElementById('btn-toggle-sound').textContent = data.settings.sound ? 'Ligado' : 'Desligado';
  });

  // Clear data
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('Tens a certeza? Todos os dados locais serão apagados.')) {
      localStorage.removeItem('estudar_data');
      localStorage.removeItem('firebase_config');
      location.reload();
    }
  });

  // Firebase sign in
  document.getElementById('btn-firebase-connect').addEventListener('click', async () => {
    const ok = await storage.signIn();
    if (ok) updateAccountUI();
  });

  // Sign out
  document.getElementById('btn-sign-out').addEventListener('click', async () => {
    await storage.signOut();
    updateAccountUI();
  });
}


function updateAccountUI() {
  const user = storage.getCurrentUser();
  if (user) {
    document.getElementById('user-logged-out').classList.add('hidden');
    document.getElementById('user-logged-in').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.displayName || 'Utilizador';
    document.getElementById('user-email').textContent = user.email || '';
    if (user.photoURL) {
      document.getElementById('user-avatar').src = user.photoURL;
    }
    document.getElementById('sync-dot').classList.add('connected');
    document.getElementById('sync-dot').title = 'Sincronizado';
  } else {
    document.getElementById('user-logged-out').classList.remove('hidden');
    document.getElementById('user-logged-in').classList.add('hidden');
    document.getElementById('sync-dot').classList.remove('connected');
    document.getElementById('sync-dot').title = 'Offline';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  currentTab = tab;
}
