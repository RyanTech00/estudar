// End-of-block log and probe setup.
// Order is the point: attempt → confidence + help used (locked) → only then correct & count.
// Confidence given after seeing the answers would measure nothing (R1, R6).
import * as storage from './storage.js';
import { calibration } from './learning.js';
import { t } from './i18n.js';
import { minutesBetween } from './agenda.js';

const CONFIDENCE_LABELS = () => ['', t('Nada seguro'), t('Pouco seguro'), t('Seguro'), t('Muito seguro')];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let onDone = null;

function open(html) {
  $('log-sheet').innerHTML = html;
  $('log-panel').classList.add('active');
  $('log-panel').setAttribute('aria-hidden', 'false');
}

export function closeLog() {
  $('log-panel').classList.remove('active');
  $('log-panel').setAttribute('aria-hidden', 'true');
}

export function setupLog() {
  $('log-panel').addEventListener('click', (e) => { if (e.target === $('log-panel')) closeLog(); });
}

const stepper = (id, value, min, max) => `
  <div class="stepper big" data-stepper="${id}" data-min="${min}" data-max="${max}">
    <button type="button" data-d="-1" aria-label="${t('Menos')}">−</button><output id="${id}">${value}</output><button type="button" data-d="1" aria-label="${t('Mais')}">+</button>
  </div>`;

function bindSteppers(root) {
  root.querySelectorAll('[data-stepper]').forEach(st => {
    st.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const out = st.querySelector('output');
      const min = Number(st.dataset.min);
      const max = Number(st.dataset.max);
      out.textContent = Math.max(min, Math.min(max, Number(out.textContent) + Number(b.dataset.d)));
      st.dispatchEvent(new Event('change'));
    }));
  });
}

// ── End of a study block / probe ──────
export function openBlockLog({ subject, probe = false, minutes = 0 }, done) {
  onDone = done;
  const title = probe ? t('Teste de controlo') : t('Como correu o bloco?');
  const practiceCount = storage.getAttempts().filter(a => a.kind === 'practice').length;
  // R5, moderate frequency: every third practice log invites a one-line self-explanation.
  const askExplain = !probe && practiceCount % 3 === 2;

  open(`
    <div class="row-between">
      <div><div class="eyebrow">${esc(subject.short)} · ${minutes ? `${minutes} min` : ''}</div><h2 class="h2 log-title">${title}</h2></div>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>

    ${probe ? '' : `
    <div class="log-step" id="log-kind">
      <p class="log-q">${t('O que fizeste neste bloco?')}</p>
      <div class="choice-row">
        <button class="choice" data-kind="learn">${t('Matéria nova')}<small>${t('primeira vez que vejo isto')}</small></button>
        <button class="choice" data-kind="practice">${t('Exercícios / recuperação')}<small>${t('tentei resolver ou lembrar')}</small></button>
      </div>
    </div>`}

    <div class="log-step ${probe ? '' : 'hidden'}" id="log-attempt">
      <p class="log-q">${t('Quantos exercícios ou perguntas tentaste?')}</p>
      ${stepper('log-done', 5, 1, 99)}
      <p class="muted small">${t('Um exercício em branco conta como tentado e errado. Comprometer-te com uma resposta é parte do efeito.')}</p>

      <p class="log-q">${t('Antes de corrigires: quão seguro estás das tuas respostas?')}</p>
      <div class="choice-row four">${[1, 2, 3, 4].map(n => `<button class="choice" data-conf="${n}">${n}<small>${CONFIDENCE_LABELS()[n]}</small></button>`).join('')}</div>

      <p class="log-q">${t('Durante a tentativa usaste IA, apontamentos ou exemplos resolvidos?')}</p>
      <div class="choice-row">
        <button class="choice" data-assist="0">${t('Não, só de memória')}</button>
        <button class="choice" data-assist="1">${t('Sim')}</button>
      </div>
      ${probe ? `<p class="muted small" id="probe-assist-note">${t('Num teste de controlo não há ajuda. Se usaste, fica registado como prática com ajuda e não conta para o domínio.')}</p>` : ''}

      <button class="btn btn-primary btn-block" id="log-confirm" disabled>${t('Confirmar e ir corrigir')}</button>
    </div>

    <div class="log-step hidden" id="log-correct">
      <p class="log-q">${t('Agora corrige com as soluções. Quantos acertaste?')}</p>
      ${stepper('log-right', 0, 0, 5)}
      <div class="fix-done">
        <span class="muted small">${t('De quantos tentados?')}</span>
        ${stepper('log-done-fix', 5, 1, 99)}
      </div>
      <p class="muted small">${t('Enganaste-te no número de tentados? Corrige aqui. A confiança e a ajuda ficam como as deste antes de ver as respostas.')}</p>
      ${askExplain ? `
      <label class="field"><span>${t('Opcional: explica numa frase <b>porque</b> é que um dos passos funciona, sem olhar.')}</span>
        <textarea id="log-explain" rows="2" maxlength="400" placeholder="${esc(t('Ex.: o ciclo termina porque i cresce e a condição i < n acaba por falhar.'))}"></textarea></label>` : ''}
      <button class="btn btn-primary btn-block" id="log-save">${t('Guardar')}</button>
    </div>

    <div class="log-step hidden" id="log-feedback"></div>

    <button class="link-btn log-skip" id="log-skip">${t('Saltar registo')}</button>
  `);

  const sheet = $('log-sheet');
  bindSteppers(sheet);
  let kind = probe ? 'probe' : null;
  let confidence = null;
  let assisted = null;

  const ready = () => { $('log-confirm').disabled = !(confidence && assisted !== null); };
  const finish = () => { closeLog(); onDone?.(); };
  $('log-close').addEventListener('click', finish);
  $('log-skip').addEventListener('click', finish);

  sheet.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    if (kind === 'learn') {
      // R8: first exposure is allowed, but it never counts as retrieval or towards mastery.
      storage.addAttempt({ subject: subject.id, kind: 'learn', done: 0, correct: 0, confidence: null, assisted: false, minutes });
      $('log-kind').classList.add('hidden');
      showFeedback(t('Registado como primeira exposição. Ler serve para conhecer a matéria, mas não conta para o teu domínio: no próximo bloco deste tema, tenta primeiro de memória.'));
      return;
    }
    $('log-kind').classList.add('hidden');
    $('log-attempt').classList.remove('hidden');
  }));

  sheet.querySelectorAll('[data-conf]').forEach(b => b.addEventListener('click', () => {
    confidence = Number(b.dataset.conf);
    sheet.querySelectorAll('[data-conf]').forEach(x => x.classList.toggle('on', x === b));
    ready();
  }));
  sheet.querySelectorAll('[data-assist]').forEach(b => b.addEventListener('click', () => {
    assisted = b.dataset.assist === '1';
    sheet.querySelectorAll('[data-assist]').forEach(x => x.classList.toggle('on', x === b));
    ready();
  }));

  $('log-confirm').addEventListener('click', () => {
    const done = Number($('log-done').textContent);
    // Lock the prediction: confidence and help can't be changed after seeing the answers.
    $('log-attempt').classList.add('locked');
    $('log-attempt').querySelectorAll('button').forEach(b => { b.disabled = true; });
    const right = sheet.querySelector('[data-stepper="log-right"]');
    right.dataset.max = done;
    $('log-done-fix').textContent = done;
    $('log-correct').classList.remove('hidden');
    $('log-correct').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Fixing the attempted count moves the ceiling for "correct" with it.
  sheet.querySelector('[data-stepper="log-done-fix"]').addEventListener('change', () => {
    const done = Number($('log-done-fix').textContent);
    sheet.querySelector('[data-stepper="log-right"]').dataset.max = done;
    if (Number($('log-right').textContent) > done) $('log-right').textContent = done;
  });

  $('log-save').addEventListener('click', () => {
    const done = Number($('log-done-fix').textContent);
    const correct = Math.min(done, Number($('log-right').textContent));
    const finalKind = kind === 'probe' && assisted ? 'practice' : kind;
    storage.addAttempt({
      subject: subject.id, kind: finalKind, done, correct, confidence, assisted, minutes,
      explanation: $('log-explain')?.value.trim() || undefined,
    });
    $('log-correct').classList.add('hidden');
    $('log-attempt').classList.add('hidden');

    const pct = done ? Math.round((correct / done) * 100) : 0;
    const cal = calibration(storage.getAttempts(), subject.id);
    const lines = [t('Acertaste {c} de {d} ({p}%). Tinhas dito: “{conf}”.', { c: correct, d: done, p: pct, conf: CONFIDENCE_LABELS()[confidence] })];
    if (finalKind === 'probe') lines.push(t('Conta para o teu domínio nesta disciplina.'));
    else if (assisted) lines.push(t('Como houve ajuda, fica à parte: não conta para o domínio.'));
    else lines.push(t('Prática sem ajuda. O domínio mede-se nos testes de controlo, feitos com alguns dias de distância.'));
    if (cal.overconfident) lines.push(t('Atenção: nesta disciplina a tua confiança tem estado acima do que acertas. É o sinal mais útil que tens — dá-lhe prioridade.'));
    showFeedback(lines.join(' '));
  });

  function showFeedback(text) {
    const fb = $('log-feedback');
    fb.innerHTML = `<p class="log-feedback-text">${esc(text)}</p><button class="btn btn-ghost btn-block" id="log-ok">${t('Continuar')}</button>`;
    fb.classList.remove('hidden');
    $('log-skip').classList.add('hidden');
    $('log-ok').addEventListener('click', finish);
  }
}

// ── Probe setup ───────────────────────
export function openProbeSetup(subjects, preselect, start) {
  let chosen = preselect || subjects[0]?.id;
  let minutes = 20;
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Teste de controlo')}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('É a única medida do teu domínio. Mede só a matéria que já deste — começar do zero é normal.')}</p>
    <ul class="rules">
      <li>${t('Em papel, como no exame, sem apontamentos, sem IA, sem exemplos resolvidos.')}</li>
      <li>${t('Usa exercícios que <b>não</b> resolveste nos últimos 7 dias. Sem exames antigos? Guarda alguns exercícios de cada ficha só para isto.')}</li>
      <li>${t('Mistura tópicos já dados, para teres de reconhecer que método usar.')}</li>
      <li>${t('Só corriges no fim, depois de dizeres quão seguro estás.')}</li>
    </ul>
    <p class="log-q">${t('Disciplina')}</p>
    <div class="chips left" id="probe-subjects">${subjects.map(s => `<button class="chip ${s.id === chosen ? 'on' : ''}" style="--c:${esc(s.color)}" data-id="${esc(s.id)}">${esc(s.short)}</button>`).join('')}</div>
    <p class="log-q">${t('Tempo')}</p>
    <div class="chips left" id="probe-minutes">${[15, 20, 30, 45].map(m => `<button class="chip ${m === minutes ? 'on' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="probe-start" ${chosen ? '' : 'disabled'}>${t('Começar teste')}</button>
  `);
  $('log-close').addEventListener('click', closeLog);
  const pick = (container, attr, set) => $(container).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    set(b.dataset[attr]);
    $(container).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    $('probe-start').disabled = !chosen;
  }));
  pick('probe-subjects', 'id', v => { chosen = v; });
  pick('probe-minutes', 'min', v => { minutes = Number(v); });
  $('probe-start').addEventListener('click', () => { closeLog(); start(chosen, minutes); });
}

// ── Real exam grade ───────────────────
export function openExamGrade(subject, current, save) {
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Nota do exame')} · ${esc(subject.short)}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('Serve para ver se os teus testes de controlo previam bem o exame real.')}</p>
    <label class="field"><span>${t('Nota (0 a 20)')}</span><input id="exam-grade" type="number" min="0" max="20" step="0.1" value="${esc(current ?? '')}" inputmode="decimal"></label>
    <button class="btn btn-primary btn-block" id="exam-save">${t('Guardar')}</button>
  `);
  $('log-close').addEventListener('click', closeLog);
  $('exam-save').addEventListener('click', () => {
    const g = Number($('exam-grade').value);
    if (!(g >= 0 && g <= 20)) return;
    save(Math.round(g * 10) / 10);
    closeLog();
  });
}

// ── Study done outside the plan ───────
// For what happened without the timer: an evening catching up on a subject, a library session.
// It counts as time and, for exercises, as practice (with or without help). Confidence is not asked:
// after the fact it would only be a guess, and calibration needs it before correcting (R6).
export function openManualLog({ subjects, preselect, today, yesterday, openSessions = [], backlog = {} }, save) {
  let chosen = preselect && subjects.some(s => s.id === preselect) ? preselect : subjects[0]?.id;
  let date = today;
  let activity = null;
  let assisted = false;

  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Registar estudo')}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('Para o que estudaste sem o timer: conta para o tempo, para os dias seguidos e para o equilíbrio entre disciplinas. O domínio continua a vir só dos testes de controlo.')}</p>

    <p class="log-q">${t('Disciplina')}</p>
    <div class="chips left" id="ml-subjects">${subjects.map(s => `<button class="chip ${s.id === chosen ? 'on' : ''}" style="--c:${esc(s.color)}" data-id="${esc(s.id)}">${esc(s.short)}</button>`).join('')}</div>

    <p class="log-q">${t('Quando')}</p>
    <div class="chips left" id="ml-day">
      <button class="chip on" data-day="${esc(today)}">${t('Hoje')}</button>
      <button class="chip" data-day="${esc(yesterday)}">${t('Ontem')}</button>
    </div>

    <p class="log-q">${t('Quanto tempo')}</p>
    <div class="field-row ml-time">
      <label class="field"><span>${t('Das')}</span><input id="ml-from" type="time"></label>
      <label class="field"><span>${t('às')}</span><input id="ml-to" type="time"></label>
      <label class="field"><span>${t('ou minutos')}</span><input id="ml-minutes" type="number" min="1" max="720" step="5" inputmode="numeric"></label>
    </div>

    <p class="log-q">${t('O que fizeste?')}</p>
    <div class="choice-row three">
      <button class="choice" data-act="learn">${t('Matéria nova')}<small>${t('aulas, primeira vez')}</small></button>
      <button class="choice" data-act="practice">${t('Exercícios')}<small>${t('resolver problemas')}</small></button>
      <button class="choice" data-act="review">${t('Revisão')}<small>${t('lembrar de memória')}</small></button>
    </div>

    <div class="log-step hidden" id="ml-counts">
      <p class="log-q">${t('Opcional: quantos exercícios ou perguntas tentaste, e quantos acertaste?')}</p>
      <div class="field-row">
        <label class="field"><span>${t('Tentados')}</span><input id="ml-done" type="number" min="0" max="999" inputmode="numeric" placeholder="0"></label>
        <label class="field"><span>${t('Certos')}</span><input id="ml-correct" type="number" min="0" max="999" inputmode="numeric" placeholder="0"></label>
      </div>
      <p class="log-q">${t('Usaste IA, apontamentos ou exemplos resolvidos?')}</p>
      <div class="choice-row">
        <button class="choice on" data-assist="0">${t('Não, só de memória')}</button>
        <button class="choice" data-assist="1">${t('Sim')}</button>
      </div>
    </div>

    <label class="field"><span>${t('Nota (opcional)')}</span><textarea id="ml-note" rows="2" maxlength="500" placeholder="${esc(t('Ex.: aulas em atraso de pilhas e filas; percebi, falta praticar.'))}"></textarea></label>

    <label class="check-inline hidden" id="ml-session-row"><input type="checkbox" id="ml-session" checked> <span id="ml-session-label"></span></label>
    <label class="check-inline" id="ml-backlog-row"><input type="checkbox" id="ml-backlog"> <span id="ml-backlog-label"></span></label>

    <p class="login-error hidden" id="ml-error" role="alert"></p>
    <button class="btn btn-primary btn-block" id="ml-save">${t('Guardar')}</button>
    <div class="log-step hidden" id="log-feedback"></div>
  `);

  const sheet = $('log-sheet');
  $('log-close').addEventListener('click', closeLog);

  const refresh = () => {
    const sub = subjects.find(s => s.id === chosen);
    const session = date === today ? openSessions.find(s => s.subject === chosen) : null;
    $('ml-session-row').classList.toggle('hidden', !session);
    if (session) $('ml-session-label').textContent = t('Conta como a sessão de hoje de {s}', { s: sub.short });
    $('ml-backlog').checked = false;
    $('ml-backlog-label').textContent = chosen in backlog
      ? t('Já pus {s} em dia (deixa de estar em atraso)', { s: sub.short })
      : t('Ainda tenho matéria em atraso em {s}', { s: sub.short });
  };
  refresh();

  const pick = (container, attr, set) => $(container).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    set(b.dataset[attr]);
    $(container).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    refresh();
  }));
  pick('ml-subjects', 'id', v => { chosen = v; });
  pick('ml-day', 'day', v => { date = v; });

  sheet.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    activity = b.dataset.act;
    sheet.querySelectorAll('[data-act]').forEach(x => x.classList.toggle('on', x === b));
    $('ml-counts').classList.toggle('hidden', activity === 'learn');
  }));
  sheet.querySelectorAll('[data-assist]').forEach(b => b.addEventListener('click', () => {
    assisted = b.dataset.assist === '1';
    sheet.querySelectorAll('[data-assist]').forEach(x => x.classList.toggle('on', x === b));
  }));

  // "Das 17:20 às 19:45" fills in the minutes; the minutes box stays editable.
  const fromTimes = () => {
    const diff = minutesBetween($('ml-from').value, $('ml-to').value);
    if (diff) $('ml-minutes').value = diff;
  };
  $('ml-from').addEventListener('change', fromTimes);
  $('ml-to').addEventListener('change', fromTimes);

  $('ml-save').addEventListener('click', () => {
    const error = (msg) => { $('ml-error').textContent = msg; $('ml-error').classList.remove('hidden'); };
    const minutes = Number($('ml-minutes').value);
    if (!(minutes >= 1 && minutes <= 720)) return error(t('Indica quanto tempo estudaste (das… às…, ou em minutos).'));
    if (!activity) return error(t('Escolhe o que fizeste.'));
    const session = date === today ? openSessions.find(s => s.subject === chosen) : null;
    const result = save({
      subject: chosen, date, minutes, activity, assisted,
      done: $('ml-done')?.value, correct: $('ml-correct')?.value,
      note: $('ml-note').value,
    }, {
      sessionKey: session && $('ml-session').checked ? session.key : null,
      backlog: $('ml-backlog').checked ? (chosen in backlog ? 'clear' : 'set') : null,
    });
    if (result?.error) return error(t('Não foi possível guardar. Confirma os campos.'));
    const sub = subjects.find(s => s.id === chosen);
    const lines = [t('Registado: {m} min de {s}.', { m: minutes, s: sub.short })];
    if (activity === 'learn') lines.push(t('Primeira exposição conta como tempo, não como domínio: amanhã ou depois, tenta lembrar-te disto sem olhar e faz exercícios.'));
    else lines.push(t('Conta como prática. O domínio mede-se nos testes de controlo, alguns dias depois.'));
    $('ml-error').classList.add('hidden');
    const fb = $('log-feedback');
    fb.innerHTML = `<p class="log-feedback-text">${esc(lines.join(' '))}</p><button class="btn btn-ghost btn-block" id="log-ok">${t('Continuar')}</button>`;
    fb.classList.remove('hidden');
    $('ml-save').classList.add('hidden');
    $('log-ok').addEventListener('click', closeLog);
  });
}

// ── Postpone one session ──────────────
// days: [{ key, label }] (the next days); save(key | null): null = not this week.
export function openPostpone({ subject, days, movedFrom }, save) {
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Adiar {s}', { s: esc(subject.short) })}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('Muda só esta sessão. O plano semanal fica igual.')}</p>
    <p class="log-q">${t('Para quando?')}</p>
    <div class="chips left" id="pp-days">${days.map(d => `<button class="chip" data-day="${esc(d.key)}">${esc(d.label)}</button>`).join('')}</div>
    <button class="btn btn-ghost btn-block" id="pp-skip">${t('Não vou fazer esta semana')}</button>
    ${movedFrom ? `<p class="muted small">${t('Esta sessão já tinha sido adiada; o dia original fica guardado.')}</p>` : ''}
  `);
  $('log-close').addEventListener('click', closeLog);
  $('pp-days').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { save(b.dataset.day); closeLog(); }));
  $('pp-skip').addEventListener('click', () => { save(null); closeLog(); });
}

// ── Behind in a subject ───────────────
// note: undefined when not behind yet. save(text) marks it (text may be empty); save(null) = caught up.
export function openBacklog({ subject, note }, save) {
  const behind = note !== undefined;
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Matéria em atraso · {s}', { s: esc(subject.short) })}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('Enquanto estiver marcada, a disciplina recebe mais tempo na distribuição e aparece no Hoje como prioridade. A IA também a tem em conta quando gerares o plano.')}</p>
    <label class="field"><span>${t('O que está em atraso? (opcional)')}</span><textarea id="bl-note" rows="2" maxlength="200" placeholder="${esc(t('Ex.: aulas 3 a 5; ponteiros e vetores.'))}">${esc(note || '')}</textarea></label>
    <button class="btn btn-primary btn-block" id="bl-save">${behind ? t('Guardar') : t('Marcar em atraso')}</button>
    ${behind ? `<button class="btn btn-ghost btn-block" id="bl-clear">${t('Já está em dia')}</button>` : ''}
  `);
  $('log-close').addEventListener('click', closeLog);
  $('bl-save').addEventListener('click', () => { save($('bl-note').value); closeLog(); });
  $('bl-clear')?.addEventListener('click', () => { save(null); closeLog(); });
}

// ── Fix a saved log ───────────────────
// Attempted, correct and the note can change. Confidence and help were given before the answers were seen,
// so they're shown but locked; a deleted log typed by hand also takes its minutes back.
export function openEditAttempt({ attempt, subject, when }, { save, remove }) {
  const learn = attempt.kind === 'learn';
  const kind = attempt.kind === 'probe' ? t('Teste de controlo') : learn ? t('Matéria nova') : t('Prática');
  open(`
    <div class="row-between">
      <div><div class="eyebrow">${esc(subject.short)} · ${esc(when)}${attempt.minutes ? ` · ${attempt.minutes} min` : ''}</div><h2 class="h2 log-title">${t('Corrigir registo')}</h2></div>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${esc(kind)}${attempt.manual ? ` · ${t('registado sem timer')}` : ''}</p>
    ${learn ? `<p class="muted small">${t('Primeira exposição: não tem exercícios, só a nota pode mudar.')}</p>` : `
    <div class="field-row">
      <label class="field"><span>${t('Tentados')}</span><input id="ea-done" type="number" min="0" max="999" inputmode="numeric" value="${esc(attempt.done)}"></label>
      <label class="field"><span>${t('Certos')}</span><input id="ea-correct" type="number" min="0" max="999" inputmode="numeric" value="${esc(attempt.correct)}"></label>
    </div>
    <p class="muted small">${[
      attempt.confidence ? t('Confiança: “{c}”', { c: CONFIDENCE_LABELS()[attempt.confidence] }) : '',
      attempt.assisted ? t('com ajuda') : t('sem ajuda'),
    ].filter(Boolean).join(' · ')}. ${t('Isto não muda: foi dito antes de veres as respostas.')}</p>`}
    <label class="field"><span>${t('Nota (opcional)')}</span><textarea id="ea-note" rows="2" maxlength="500">${esc(attempt.note || '')}</textarea></label>
    <p class="login-error hidden" id="ea-error" role="alert"></p>
    <button class="btn btn-primary btn-block" id="ea-save">${t('Guardar')}</button>
    <button class="btn btn-danger-ghost btn-block" id="ea-delete">${t('Apagar registo')}</button>
  `);
  $('log-close').addEventListener('click', closeLog);
  $('ea-save').addEventListener('click', () => {
    const changes = { note: $('ea-note').value };
    if (!learn) {
      const done = Number($('ea-done').value);
      const correct = Number($('ea-correct').value);
      if (!(Number.isInteger(done) && done >= 0 && Number.isInteger(correct) && correct >= 0 && correct <= done)) {
        $('ea-error').textContent = t('Os certos não podem ser mais do que os tentados.');
        $('ea-error').classList.remove('hidden');
        return;
      }
      Object.assign(changes, { done, correct });
    }
    save(changes);
    closeLog();
  });
  $('ea-delete').addEventListener('click', () => {
    const msg = attempt.manual ? t('Apagar este registo? Os minutos também saem do total.') : t('Apagar este registo? O tempo do bloco fica contado.');
    if (!confirm(msg)) return;
    remove();
    closeLog();
  });
}
