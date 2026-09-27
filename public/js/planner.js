import { getExamplePlan, EMPTY_PLAN, AREAS, LOADS, PALETTE, normalizePlan } from './data.js';
import * as storage from './storage.js';
import { allocation, FINAL_WINDOW_DAYS } from './learning.js';
import { enrichWithCurriculum } from './curriculum.js';
import { t, lang, DAY_NAMES, DAY_SHORT } from './i18n.js';

const $ = (id) => document.getElementById(id);
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8);
const aiReady = () => storage.isConfigured() && storage.hasAi();

// Activity words in both languages, since plans can be written or generated in either.
const RETRIEVAL = /recall|recupera|test|simula|de memória|sem consultar|flashcard|pergunta|retrieval|quiz|from memory|without notes|mock|past paper/i;
const PASSIVE = /\b(reler|sublinhar|resumir|re-?read(ing)?|highlight(ing)?|summari[sz](e|ing))\b/i;

let draft = null;
let onSaved = null;

const subjectById = (id) => id === 'all'
  ? { id: 'all', short: t('REV'), name: t('Revisão acumulada'), color: '#d6d3cc' }
  : draft.subjects.find(s => s.id === id) || { id, short: '—', name: '?', color: '#66645e' };

// ── Evidence checks ───────────────────
// Structural rules the plan must satisfy regardless of who (or what) wrote it.
export function checkPlan(plan) {
  const out = [];
  const byDay = Array.from({ length: 7 }, () => []);
  plan.weeklyPlan.forEach(s => byDay[s.day]?.push(s));

  if (!plan.subjects.length) return [{ ok: false, text: t('Adiciona pelo menos uma disciplina.') }];
  if (!plan.weeklyPlan.length) return [{ ok: false, text: t('O plano semanal está vazio. Gera-o com IA ou adiciona sessões.') }];

  const over = byDay
    .map((items, d) => ({ d, mins: items.reduce((a, s) => a + (s.minutes || 0), 0), cap: (plan.hoursPerDay[d] || 0) * 60 }))
    .filter(x => x.mins > x.cap * 1.15 && x.mins > 0);
  out.push(over.length
    ? { ok: false, text: t('Carga acima das horas disponíveis em: {list}. Excesso de carga prejudica sono e consolidação.', { list: over.map(x => t('{day} ({h}h de {cap}h)', { day: DAY_NAMES()[x.d], h: Math.round(x.mins / 6) / 10, cap: x.cap / 60 })).join(', ') }) }
    : { ok: true, text: t('A carga diária respeita as horas disponíveis.') });

  // A subject also "appears" on a day when another session reviews it by acronym (e.g. "Rever SO").
  const daysOf = (id) => {
    const short = plan.subjects.find(s => s.id === id)?.short;
    const mention = short ? new RegExp(`(^|[^A-Za-zÀ-ÿ])${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-zÀ-ÿ]|$)`) : null;
    return [...new Set(plan.weeklyPlan.filter(s => s.subject === id || (mention && mention.test(s.focus || ''))).map(s => s.day))];
  };
  const missing = plan.subjects.filter(s => !daysOf(s.id).length);
  if (missing.length) out.push({ ok: false, text: t('Sem nenhuma sessão: {list}.', { list: missing.map(s => s.short).join(', ') }) });

  const unspaced = plan.subjects.filter(s => s.load !== 'leve' && daysOf(s.id).length === 1);
  out.push(unspaced.length
    ? { ok: false, text: t('Espaçamento: {list} só aparece(m) num dia. A prática distribuída pede pelo menos 2 dias não consecutivos.', { list: unspaced.map(s => s.short).join(', ') }) }
    : { ok: true, text: t('Espaçamento: as disciplinas médias e pesadas aparecem em vários dias.') });

  const hasRetrieval = plan.weeklyPlan.some(s => s.subject === 'all' || RETRIEVAL.test(s.focus || ''));
  out.push(hasRetrieval
    ? { ok: true, text: t('Inclui prática de recuperação (testar-se, recall, simulações).') }
    : { ok: false, text: t('Não há sessões de recuperação ativa. Testar-se é das técnicas com mais evidência — acrescenta uma revisão acumulada.') });

  const passive = plan.weeklyPlan.filter(s => PASSIVE.test(s.focus || ''));
  if (passive.length) out.push({ ok: false, text: t('Há sessões baseadas em reler/sublinhar/resumir, técnicas de baixa eficácia. Troca por exercícios ou recuperação.') });

  const langs = plan.subjects.filter(s => s.area === 'lingua' && plan.weeklyPlan.filter(x => x.subject === s.id).length < 3);
  if (langs.length) out.push({ ok: false, text: t('Línguas beneficiam de sessões curtas e frequentes (3+ por semana): {list}.', { list: langs.map(s => s.short).join(', ') }) });

  return out;
}

// ── Open / close ──────────────────────
export function openPlanner(currentPlan, savedCallback) {
  onSaved = savedCallback;
  draft = structuredClone(currentPlan && currentPlan.subjects?.length ? currentPlan : EMPTY_PLAN);
  $('planner').classList.add('active');
  $('planner').setAttribute('aria-hidden', 'false');
  document.body.classList.add('planner-open');
  render();
}

function closePlanner() {
  $('planner').classList.remove('active');
  $('planner').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('planner-open');
}

export function setupPlanner() {
  $('planner-close').addEventListener('click', closePlanner);
  $('planner-cancel').addEventListener('click', closePlanner);
  $('planner-save').addEventListener('click', save);
}

function save() {
  const plan = normalizePlan(draft);
  if (!plan.subjects.length) return setStatus(t('Adiciona pelo menos uma disciplina antes de guardar.'), true);
  storage.savePlan(plan);
  closePlanner();
  onSaved?.(plan);
}

function setStatus(msg, error = false) {
  const el = $('planner-status');
  el.textContent = msg || '';
  el.classList.toggle('error', error);
  el.classList.toggle('hidden', !msg);
}

// ── Rendering ─────────────────────────
function render() {
  const empty = !draft.subjects.length && !draft.weeklyPlan.length;
  $('planner-body').innerHTML = `
    ${empty ? `
      <div class="card planner-intro">
        <h3 class="h2">${t('Começa por aqui')}</h3>
        <p class="muted small">${t('Carrega o plano de exemplo (Engenharia Informática + línguas) para ver como funciona, ou adiciona as tuas disciplinas e deixa a IA montar a semana.')}</p>
        <button class="btn btn-ghost" id="pl-example">${t('Usar plano de exemplo')}</button>
      </div>` : ''}

    <section class="card">
      <h3 class="h2">${t('Datas')}</h3>
      <div class="field-row">
        <label class="field"><span>${t('Início')}</span><input type="date" id="pl-start" value="${esc(draft.startDate)}"></label>
        <label class="field"><span>${t('Exames')}</span><input type="date" id="pl-exam" value="${esc(draft.examDate)}"></label>
      </div>
    </section>

    <section class="card">
      <div class="row-between"><h3 class="h2">${t('Disciplinas')}</h3><span class="muted small">${draft.subjects.length}</span></div>
      <div id="pl-subjects">${draft.subjects.map((s, i) => `
        <div class="subject-edit" data-i="${i}">
          <span class="tag" style="--c:${esc(s.color)}">${esc(s.short || '?')}</span>
          <input class="se-name" data-k="name" placeholder="${t('Nome da disciplina')}" value="${esc(s.name)}" aria-label="${t('Nome')}">
          <input class="se-short" data-k="short" placeholder="${t('Sigla')}" maxlength="5" value="${esc(s.short)}" aria-label="${t('Sigla')}">
          <select data-k="area" aria-label="${t('Tipo')}">${Object.entries(AREAS).map(([k, v]) => `<option value="${k}" ${s.area === k ? 'selected' : ''}>${t(v)}</option>`).join('')}</select>
          <select data-k="load" aria-label="${t('Carga')}">${Object.entries(LOADS).map(([k, v]) => `<option value="${k}" ${s.load === k ? 'selected' : ''}>${t('Carga {l}', { l: t(v).toLowerCase() })}</option>`).join('')}</select>
          <label class="mini"><span>ECTS</span><input data-k="ects" type="number" min="0" max="60" step="0.5" value="${esc(s.ects ?? '')}" placeholder="—"></label>
          <label class="mini grow"><span>${t('Exame')}</span><input data-k="examDate" type="date" value="${esc(s.examDate || '')}" aria-label="${t('Data do exame (opcional)')}"></label>
          <button class="icon-btn" data-remove-subject="${i}" aria-label="${t('Remover disciplina')}"><svg class="ico"><use href="#i-close"/></svg></button>
        </div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" id="pl-add-subject">${t('+ Disciplina')}</button>
      <p class="muted small">${t('Sem data de exame? Deixa vazio: usa a data geral acima. Quando souberes, põe-na e o plano ajusta-se.')}</p>
    </section>

    <section class="card">
      <h3 class="h2">${t('Distribuição sugerida do tempo')}</h3>
      <p class="muted small">${t('Quanto tempo de matéria nova e prática cada disciplina deve ter: ECTS × o que te falta dominar (medido nos testes de controlo, sem ajuda). Sem testes ainda, segue só os ECTS. Nenhuma desce abaixo de 10%, e a disciplina com exame nos próximos {n} dias passa à frente. É uma heurística de planeamento, não ciência da aprendizagem: afina-a com os teus resultados.', { n: FINAL_WINDOW_DAYS })}</p>
      <div id="pl-allocation"></div>
    </section>

    <section class="card">
      <h3 class="h2">${t('Horas disponíveis por dia')}</h3>
      <div class="hours-grid">${WEEK_ORDER.map(d => `
        <label class="field"><span>${DAY_SHORT()[d]}</span><input type="number" min="0" max="16" step="0.5" data-hours="${d}" value="${draft.hoursPerDay[d]}"></label>`).join('')}
      </div>
    </section>

    <section class="card">
      <h3 class="h2">${t('Gerar com IA')}</h3>
      <p class="muted small">${t('A IA monta a semana seguindo técnicas com evidência forte: prática de recuperação, espaçamento, intercalação e simulações perto dos exames. Depois podes ajustar à mão.')}</p>
      <label class="field"><span>${t('Notas (opcional)')}</span><textarea id="pl-notes" rows="3" maxlength="1000" placeholder="${t('Ex.: trabalho às terças à tarde; o exame de FP é escrito; quero manter o alemão leve.')}">${esc(draft.notes || '')}</textarea></label>
      <button class="btn btn-primary" id="pl-generate" ${aiReady() ? '' : 'disabled'}>${t('Gerar plano semanal')}</button>
      ${aiReady() ? '' : `<p class="muted small">${t('Para usar a IA, liga o Supabase e uma chave de IA em <b>Conta → Servidor e chaves</b>.')}</p>`}
    </section>

    <section class="card">
      <div class="row-between"><h3 class="h2">${t('Semana')}</h3><span class="muted small">${t('{n} sessões', { n: draft.weeklyPlan.length })}</span></div>
      <div id="pl-week">${WEEK_ORDER.map(d => {
        const items = draft.weeklyPlan.map((s, i) => ({ ...s, i })).filter(s => s.day === d);
        const mins = items.reduce((a, s) => a + (s.minutes || 0), 0);
        return `
          <div class="pl-day">
            <div class="row-between"><b>${DAY_NAMES()[d]}</b><span class="muted small">${mins ? `${Math.round(mins / 6) / 10}h` : '—'} / ${draft.hoursPerDay[d]}h</span></div>
            ${items.map(s => {
              const sub = subjectById(s.subject);
              return `<div class="pl-item"><span class="tag" style="--c:${esc(sub.color)}">${esc(sub.short)}</span>
                <span class="pl-item-text"><b>${esc(s.session)}</b>${s.focus ? ` · ${esc(s.focus)}` : ''}</span>
                <button class="icon-btn" data-remove-session="${s.i}" aria-label="${t('Remover sessão')}"><svg class="ico"><use href="#i-close"/></svg></button></div>`;
            }).join('')}
          </div>`;
      }).join('')}
      </div>
      <details class="pl-add">
        <summary>${t('+ Adicionar sessão à mão')}</summary>
        <div class="field-row">
          <label class="field"><span>${t('Dia')}</span><select id="add-day">${WEEK_ORDER.map(d => `<option value="${d}">${DAY_NAMES()[d]}</option>`).join('')}</select></label>
          <label class="field"><span>${t('Disciplina')}</span><select id="add-subject">${[...draft.subjects, subjectById('all')].map(s => `<option value="${esc(s.id)}">${esc(s.short)} — ${esc(s.name)}</option>`).join('')}</select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>${t('Duração (min)')}</span><input type="number" id="add-minutes" min="10" max="600" step="5" value="50"></label>
          <label class="field grow"><span>${t('Atividade')}</span><input id="add-focus" placeholder="${t('Ex.: exercícios mistos sem consultar')}"></label>
        </div>
        <button class="btn btn-ghost btn-sm" id="add-session">${t('Adicionar')}</button>
      </details>
    </section>

    <section class="card">
      <h3 class="h2">${t('Verificação científica')}</h3>
      <ul class="checks" id="pl-checks"></ul>
    </section>
  `;
  bind();
  renderChecks();
}

function enrichedSubjects(plan) {
  return enrichWithCurriculum(plan.subjects, storage.getCurriculum().ucs || []);
}

function currentAllocation() {
  const plan = normalizePlan(draft);
  return allocation(enrichedSubjects(plan), storage.getAttempts(), plan);
}

function renderAllocation() {
  const el = $('pl-allocation');
  if (!el) return;
  const rows = currentAllocation();
  if (!rows.length) { el.innerHTML = `<div class="empty">${t('Adiciona disciplinas.')}</div>`; return; }
  const plan = normalizePlan(draft);
  const planned = {};
  plan.weeklyPlan.forEach(s => { if (s.subject !== 'all') planned[s.subject] = (planned[s.subject] || 0) + (s.minutes || 0); });
  const totalPlanned = Object.values(planned).reduce((a, b) => a + b, 0);
  const weakBy = Object.fromEntries(enrichedSubjects(plan).filter(s => s.prereqWeak?.length).map(s => [s.id, s.prereqWeak.map(w => w.short).join(', ')]));
  el.innerHTML = rows.sort((a, b) => b.share - a.share).map(r => {
    const sub = subjectById(r.id);
    const now = totalPlanned ? (planned[r.id] || 0) / totalPlanned : null;
    const why = [
      r.finished ? t('exame já feito') : r.mastery === null ? t('sem teste ainda') : t('domínio {p}%', { p: Math.round(r.mastery * 100) }),
      weakBy[r.id] ? t('base fraca: {list}', { list: weakBy[r.id] }) : '',
      r.inFinalWindow ? (r.days === 1 ? t('exame amanhã') : t('exame em {n} dias', { n: r.days })) : '',
    ].filter(Boolean).join(' · ');
    return `<div class="alloc-row"><span class="tag" style="--c:${esc(sub.color)}">${esc(sub.short)}</span>
      <div class="alloc-bar"><i style="width:${Math.round(r.share * 100)}%;background:${esc(sub.color)}"></i></div>
      <span class="alloc-pct">${Math.round(r.share * 100)}%</span>
      <span class="alloc-why muted small">${esc(why)}${now !== null ? ` · ${t('no plano: {p}%', { p: Math.round(now * 100) })}` : ''}</span></div>`;
  }).join('');
}

function renderChecks() {
  renderAllocation();
  $('pl-checks').innerHTML = checkPlan(normalizePlan(draft))
    .map(c => `<li class="${c.ok ? 'ok' : 'warn'}"><span>${c.ok ? '✓' : '!'}</span>${esc(c.text)}</li>`).join('');
}

function bind() {
  $('pl-example')?.addEventListener('click', () => { draft = getExamplePlan(); render(); });
  $('pl-start').addEventListener('change', e => { draft.startDate = e.target.value; });
  $('pl-exam').addEventListener('change', e => { draft.examDate = e.target.value; });
  $('pl-notes').addEventListener('input', e => { draft.notes = e.target.value; });

  $('pl-subjects').querySelectorAll('.subject-edit').forEach(row => {
    const s = draft.subjects[Number(row.dataset.i)];
    row.querySelectorAll('[data-k]').forEach(input => {
      input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
        s[input.dataset.k] = input.dataset.k === 'short' ? input.value.toUpperCase() : input.value;
        if (input.dataset.k === 'short') row.querySelector('.tag').textContent = s.short || '?';
        renderChecks();
      });
    });
  });
  $('pl-subjects').querySelectorAll('[data-remove-subject]').forEach(btn => btn.addEventListener('click', () => {
    const [removed] = draft.subjects.splice(Number(btn.dataset.removeSubject), 1);
    draft.weeklyPlan = draft.weeklyPlan.filter(s => s.subject !== removed.id);
    render();
  }));
  $('pl-add-subject').addEventListener('click', () => {
    draft.subjects.push({ id: uid(), name: '', short: '', area: 'uni', load: 'media', color: PALETTE[draft.subjects.length % PALETTE.length] });
    render();
    $('pl-subjects').lastElementChild?.querySelector('.se-name')?.focus();
  });

  document.querySelectorAll('[data-hours]').forEach(input => input.addEventListener('input', () => {
    draft.hoursPerDay[Number(input.dataset.hours)] = Math.max(0, Math.min(16, Number(input.value) || 0));
    renderChecks();
  }));

  document.querySelectorAll('[data-remove-session]').forEach(btn => btn.addEventListener('click', () => {
    draft.weeklyPlan.splice(Number(btn.dataset.removeSession), 1);
    render();
  }));
  $('add-session').addEventListener('click', () => {
    const minutes = Math.max(10, Math.min(600, Number($('add-minutes').value) || 50));
    draft.weeklyPlan.push({
      day: Number($('add-day').value),
      subject: $('add-subject').value,
      minutes,
      session: minutes >= 50 ? t('{n} bloco(s) 40+10', { n: Math.round(minutes / 50) }) : `${minutes} min`,
      focus: $('add-focus').value.trim(),
    });
    render();
  });

  $('pl-generate').addEventListener('click', generate);
}

async function generate() {
  const plan = normalizePlan(draft);
  if (!plan.subjects.length || plan.subjects.some(s => !s.name.trim() || s.name === 'Sem nome')) return setStatus(t('Dá um nome a todas as disciplinas.'), true);
  if (!plan.startDate || !plan.examDate || plan.startDate >= plan.examDate) return setStatus(t('Indica a data de início e a data dos exames.'), true);

  const btn = $('pl-generate');
  btn.disabled = true;
  btn.textContent = t('A gerar… (pode demorar até 1 min)');
  setStatus(null);

  // Keep ids stable so the AI's answer maps back onto these subjects.
  draft.subjects = plan.subjects;
  const shares = currentAllocation();
  const result = await storage.generatePlan({
    lang,
    startDate: plan.startDate,
    examDate: plan.examDate,
    hoursPerDay: plan.hoursPerDay,
    subjects: enrichedSubjects(plan).map(({ id, name, short, load, area, ects, examDate, derivedExamDate, prereqWeak }) => {
      const a = shares.find(r => r.id === id);
      return {
        id, name, short, load, area, ects, examDate: examDate || derivedExamDate || '',
        share: a ? Math.round(a.share * 100) : null, mastery: a?.mastery ?? null,
        prereqWeak: (prereqWeak || []).map(w => `${w.name} (${t(w.reason)}${w.grade !== null ? `, ${t('nota {g}', { g: w.grade })}` : ''})`).join('; '),
      };
    }),
    notes: draft.notes || '',
  });

  btn.disabled = false;
  btn.textContent = t('Gerar plano semanal');
  if (!result.ok) return setStatus(result.message, true);

  const generated = normalizePlan({ ...plan, weeklyPlan: result.plan.weeklyPlan, phases: result.plan.phases, tips: result.plan.tips });
  draft = { ...draft, weeklyPlan: generated.weeklyPlan, phases: generated.phases, tips: generated.tips };
  render();
  setStatus(t('Plano gerado. Revê a verificação abaixo e guarda.') + (typeof result.remaining === 'number' ? ` ${t('({n} gerações restantes hoje)', { n: result.remaining })}` : ''));
  $('pl-week').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
