// End-of-block log and probe setup.
// Order is the point: attempt → confidence + help used (locked) → only then correct & count.
// Confidence given after seeing the answers would measure nothing (R1, R6).
import * as storage from './storage.js';
import { CONFIDENCE_LABELS, calibration } from './learning.js';

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
    <button type="button" data-d="-1" aria-label="Menos">−</button><output id="${id}">${value}</output><button type="button" data-d="1" aria-label="Mais">+</button>
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
  const title = probe ? 'Teste de controlo' : 'Como correu o bloco?';
  const practiceCount = storage.getAttempts().filter(a => a.kind === 'practice').length;
  // R5, moderate frequency: every third practice log invites a one-line self-explanation.
  const askExplain = !probe && practiceCount % 3 === 2;

  open(`
    <div class="row-between">
      <div><div class="eyebrow">${esc(subject.short)} · ${minutes ? `${minutes} min` : ''}</div><h2 class="h2 log-title">${title}</h2></div>
      <button class="icon-btn" id="log-close" aria-label="Fechar"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>

    ${probe ? '' : `
    <div class="log-step" id="log-kind">
      <p class="log-q">O que fizeste neste bloco?</p>
      <div class="choice-row">
        <button class="choice" data-kind="learn">Matéria nova<small>primeira vez que vejo isto</small></button>
        <button class="choice" data-kind="practice">Exercícios / recuperação<small>tentei resolver ou lembrar</small></button>
      </div>
    </div>`}

    <div class="log-step ${probe ? '' : 'hidden'}" id="log-attempt">
      <p class="log-q">Quantos exercícios ou perguntas tentaste?</p>
      ${stepper('log-done', 5, 1, 99)}
      <p class="muted small">Um exercício em branco conta como tentado e errado. Comprometer-te com uma resposta é parte do efeito.</p>

      <p class="log-q">Antes de corrigires: quão seguro estás das tuas respostas?</p>
      <div class="choice-row four">${[1, 2, 3, 4].map(n => `<button class="choice" data-conf="${n}">${n}<small>${CONFIDENCE_LABELS[n]}</small></button>`).join('')}</div>

      <p class="log-q">Durante a tentativa usaste IA, apontamentos ou exemplos resolvidos?</p>
      <div class="choice-row">
        <button class="choice" data-assist="0">Não, só de memória</button>
        <button class="choice" data-assist="1">Sim</button>
      </div>
      ${probe ? '<p class="muted small" id="probe-assist-note">Num teste de controlo não há ajuda. Se usaste, fica registado como prática com ajuda e não conta para o domínio.</p>' : ''}

      <button class="btn btn-primary btn-block" id="log-confirm" disabled>Confirmar e ir corrigir</button>
    </div>

    <div class="log-step hidden" id="log-correct">
      <p class="log-q">Agora corrige com as soluções. Quantos acertaste?</p>
      ${stepper('log-right', 0, 0, 5)}
      ${askExplain ? `
      <label class="field"><span>Opcional: explica numa frase <b>porque</b> é que um dos passos funciona, sem olhar.</span>
        <textarea id="log-explain" rows="2" maxlength="400" placeholder="Ex.: o ciclo termina porque i cresce e a condição i < n acaba por falhar."></textarea></label>` : ''}
      <button class="btn btn-primary btn-block" id="log-save">Guardar</button>
    </div>

    <div class="log-step hidden" id="log-feedback"></div>

    <button class="link-btn log-skip" id="log-skip">Saltar registo</button>
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
      showFeedback('Registado como primeira exposição. Ler serve para conhecer a matéria, mas não conta para o teu domínio: no próximo bloco deste tema, tenta primeiro de memória.');
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
    $('log-correct').classList.remove('hidden');
    $('log-correct').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('log-save').addEventListener('click', () => {
    const done = Number($('log-done').textContent);
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
    const lines = [`Acertaste ${correct} de ${done} (${pct}%). Tinhas dito: “${CONFIDENCE_LABELS[confidence]}”.`];
    if (finalKind === 'probe') lines.push('Conta para o teu domínio nesta disciplina.');
    else if (assisted) lines.push('Como houve ajuda, fica à parte: não conta para o domínio.');
    else lines.push('Prática sem ajuda. O domínio mede-se nos testes de controlo, feitos com alguns dias de distância.');
    if (cal.overconfident) lines.push('Atenção: nesta disciplina a tua confiança tem estado acima do que acertas. É o sinal mais útil que tens — dá-lhe prioridade.');
    showFeedback(lines.join(' '));
  });

  function showFeedback(text) {
    const fb = $('log-feedback');
    fb.innerHTML = `<p class="log-feedback-text">${esc(text)}</p><button class="btn btn-ghost btn-block" id="log-ok">Continuar</button>`;
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
      <h2 class="h2 log-title">Teste de controlo</h2>
      <button class="icon-btn" id="log-close" aria-label="Fechar"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">É a única medida do teu domínio. Mede só a matéria que já deste — começar do zero é normal.</p>
    <ul class="rules">
      <li>Em papel, como no exame, sem apontamentos, sem IA, sem exemplos resolvidos.</li>
      <li>Usa exercícios que <b>não</b> resolveste nos últimos 7 dias. Sem exames antigos? Guarda alguns exercícios de cada ficha só para isto.</li>
      <li>Mistura tópicos já dados, para teres de reconhecer que método usar.</li>
      <li>Só corriges no fim, depois de dizeres quão seguro estás.</li>
    </ul>
    <p class="log-q">Disciplina</p>
    <div class="chips left" id="probe-subjects">${subjects.map(s => `<button class="chip ${s.id === chosen ? 'on' : ''}" style="--c:${esc(s.color)}" data-id="${esc(s.id)}">${esc(s.short)}</button>`).join('')}</div>
    <p class="log-q">Tempo</p>
    <div class="chips left" id="probe-minutes">${[15, 20, 30, 45].map(m => `<button class="chip ${m === minutes ? 'on' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="probe-start" ${chosen ? '' : 'disabled'}>Começar teste</button>
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
      <h2 class="h2 log-title">Nota do exame · ${esc(subject.short)}</h2>
      <button class="icon-btn" id="log-close" aria-label="Fechar"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">Serve para ver se os teus testes de controlo previam bem o exame real.</p>
    <label class="field"><span>Nota (0 a 20)</span><input id="exam-grade" type="number" min="0" max="20" step="0.1" value="${current ?? ''}" inputmode="decimal"></label>
    <button class="btn btn-primary btn-block" id="exam-save">Guardar</button>
  `);
  $('log-close').addEventListener('click', closeLog);
  $('exam-save').addEventListener('click', () => {
    const g = Number($('exam-grade').value);
    if (!(g >= 0 && g <= 20)) return;
    save(Math.round(g * 10) / 10);
    closeLog();
  });
}
