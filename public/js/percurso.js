// Degree record UI: manager (import, years/semesters, UC editor with assessments and prerequisites),
// semester report, and the summary card on the Progress tab.
import * as storage from './storage.js';
import {
  average, requiredForTarget, computedGrade, effectiveGrade, ucStatus, isApproved, STATUS_LABEL,
  structure, weakPrereqs, acronym, DEFAULT_PASS, nextAssessmentDate,
} from './curriculum.js';
import { mastery, calibration, practiceSplit } from './learning.js';
import { PALETTE } from './data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'uc') => p + Math.random().toString(36).slice(2, 8);
const fmt = (x, d = 2) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: d }));
const ord = (n) => `${n}.º`;
const semLabel = (y, s) => `${y ? `${ord(y)} ano` : 'Sem ano'}${s ? ` · ${ord(s)} semestre` : ''}`;
const EPOCAS = { normal: 'Normal', recurso: 'Recurso', especial: 'Especial' };
const KINDS = { exame: 'Exame', teste: 'Teste', trabalho: 'Trabalho', frequencia: 'Frequência', outro: 'Outro' };

let draft = null;
let onSaved = null;
let openUc = null;
let importRows = null;

const numOrNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(String(v).replace(',', '.')));

function newUc(o = {}) {
  return { id: uid(), name: '', short: '', ects: 6, year: 1, semester: 1, optional: false, grade: null, gradeType: '', gradeDate: '', passGrade: DEFAULT_PASS, assessments: [], prereqs: [], inPlan: false, ...o };
}

function show(on) {
  $('percurso').classList.toggle('active', on);
  $('percurso').setAttribute('aria-hidden', String(!on));
  document.body.classList.toggle('planner-open', on);
}

export function setupPercurso() {
  $('percurso-close').addEventListener('click', () => show(false));
  $('percurso-cancel').addEventListener('click', () => show(false));
  $('percurso-save').addEventListener('click', save);
}

// ── Manager ───────────────────────────
export function openPercurso(saved) {
  onSaved = saved;
  draft = structuredClone(storage.getCurriculum());
  draft.ucs = draft.ucs || [];
  openUc = null;
  importRows = null;
  $('percurso-title').textContent = 'Percurso académico';
  $('percurso-foot').classList.remove('hidden');
  show(true);
  render();
}

function save() {
  // Blank UCs are form leftovers, not data.
  draft.ucs = draft.ucs.filter(u => u.name.trim());
  draft.ucs.forEach(u => { u.short = (u.short || acronym(u.name)).toUpperCase().slice(0, 5); });
  storage.saveCurriculum(draft);
  show(false);
  onSaved?.();
}

function render() {
  const aiReady = storage.isConfigured() && storage.hasAi();
  $('percurso-body').innerHTML = `
    <section class="card">
      <label class="field"><span>Curso</span><input id="pc-degree" value="${esc(draft.degree)}" placeholder="Ex.: Licenciatura em Engenharia Informática"></label>
      <div id="pc-summary"></div>
    </section>

    <section class="card">
      <h3 class="h2">Importar de uma imagem</h3>
      <p class="muted small">Tira uma fotografia ou captura de ecrã do teu plano de estudos (com notas e ECTS). A IA lê a tabela e tu confirmas antes de guardar.</p>
      <label class="btn btn-ghost btn-sm file-btn ${aiReady ? '' : 'disabled'}">
        <input type="file" accept="image/*" id="pc-file" ${aiReady ? '' : 'disabled'}> Escolher imagem
      </label>
      ${aiReady ? '' : '<p class="muted small">Precisa de sessão iniciada e de uma chave de IA (Conta → Servidor e chaves). Podes sempre adicionar as UCs à mão.</p>'}
      <p class="planner-status hidden" id="pc-import-status"></p>
      <div id="pc-import"></div>
    </section>

    ${structure(draft.ucs).map(y => `
      <section class="card">
        <div class="row-between"><h3 class="h2">${y.year ? `${ord(y.year)} ano` : 'Sem ano'}</h3><span class="muted small">${y.average !== null ? `média ${fmt(y.average)}` : ''}</span></div>
        ${y.semesters.map(s => `
          <div class="pc-sem">
            <div class="row-between pc-sem-head">
              <b>${s.semester ? `${ord(s.semester)} semestre` : 'Sem semestre'}</b>
              <span class="muted small">${s.average !== null ? `média ${fmt(s.average)} · ` : ''}${s.ects}/${s.totalEcts} ECTS</span>
            </div>
            ${s.ucs.map(u => ucRow(u)).join('')}
            ${s.ucs.some(u => !isApproved(u) && !u.inPlan && !u.optional) ? `<button class="link-btn small" data-plan-sem="${y.year}-${s.semester}">Pôr as UCs por fazer deste semestre no plano</button>` : ''}
          </div>`).join('')}
      </section>`).join('')}

    <button class="btn btn-ghost" id="pc-add">+ Adicionar UC</button>
  `;
  renderSummary();
  bind();
}

function statusChip(u) {
  const st = ucStatus(u);
  return `<span class="status-chip st-${st}">${STATUS_LABEL[st]}</span>`;
}

function ucRow(u) {
  const g = effectiveGrade(u);
  const expanded = openUc === u.id;
  return `
    <div class="pc-uc ${expanded ? 'open' : ''}" data-uc="${u.id}">
      <button class="pc-uc-head" data-toggle="${u.id}">
        <span class="pc-uc-name">${esc(u.name || 'Nova UC')}${u.optional ? ' <em class="muted">(opção)</em>' : ''}</span>
        <span class="pc-uc-meta">${statusChip(u)}<span class="pc-ects">${fmt(u.ects, 1)}</span><span class="pc-grade">${g === null ? '' : fmt(g, 1)}</span></span>
      </button>
      ${expanded ? ucEditor(u) : ''}
    </div>`;
}

function ucEditor(u) {
  const others = draft.ucs.filter(x => x.id !== u.id && x.name.trim());
  return `
    <div class="pc-editor">
      <div class="field-row">
        <label class="field grow"><span>Nome</span><input data-f="name" value="${esc(u.name)}"></label>
        <label class="field"><span>Sigla</span><input data-f="short" maxlength="5" value="${esc(u.short)}" placeholder="${esc(acronym(u.name || ''))}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>ECTS</span><input data-f="ects" type="number" min="0" max="60" step="0.5" value="${u.ects ?? ''}"></label>
        <label class="field"><span>Ano</span><input data-f="year" type="number" min="0" max="10" value="${u.year ?? ''}"></label>
        <label class="field"><span>Semestre</span><input data-f="semester" type="number" min="0" max="4" value="${u.semester ?? ''}"></label>
        <label class="field"><span>Aprovação a partir de</span><input data-f="passGrade" type="number" min="0" max="20" step="0.1" value="${u.passGrade ?? DEFAULT_PASS}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Nota final oficial</span><input data-f="grade" type="number" min="0" max="20" step="0.1" value="${u.grade ?? ''}" placeholder="vazio = calcular das provas"></label>
        <label class="field"><span>Tipo</span><select data-f="gradeType">${['', 'exame', 'avaliação', 'CC'].map(t => `<option value="${t}" ${u.gradeType === t ? 'selected' : ''}>${t === '' ? '—' : t === 'CC' ? 'CC (creditação)' : t}</option>`).join('')}</select></label>
        <label class="field"><span>Data da nota</span><input data-f="gradeDate" type="date" value="${esc(u.gradeDate)}"></label>
      </div>
      <div class="pc-toggles">
        <label class="check-inline"><input type="checkbox" data-f="inPlan" ${u.inPlan ? 'checked' : ''}> Estou a fazer esta UC agora (entra no plano)</label>
        <label class="check-inline"><input type="checkbox" data-f="optional" ${u.optional ? 'checked' : ''}> Faz parte de um grupo de escolha (opção / trabalho final)</label>
      </div>

      <div class="pc-sub">
        <b>Provas e avaliações</b>
        <p class="muted small">Exame final: uma prova com peso 100. Avaliação distribuída: uma linha por componente, com o peso e a nota mínima (se houver). O recurso e a época especial substituem o resultado da época normal.</p>
        ${(u.assessments || []).map((a, i) => `
          <div class="pc-assess" data-a="${i}">
            <input data-af="name" value="${esc(a.name)}" placeholder="Nome (ex.: Teste 1)" aria-label="Nome">
            <select data-af="kind" aria-label="Tipo">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${a.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <select data-af="epoca" aria-label="Época">${Object.entries(EPOCAS).map(([k, v]) => `<option value="${k}" ${a.epoca === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <label class="mini"><span>Data</span><input data-af="date" type="date" value="${esc(a.date)}"></label>
            <label class="mini"><span>Peso %</span><input data-af="weight" type="number" min="0" max="100" value="${a.weight ?? ''}"></label>
            <label class="mini"><span>Mínimo</span><input data-af="minGrade" type="number" min="0" max="20" step="0.1" value="${a.minGrade ?? ''}" placeholder="—"></label>
            <label class="mini"><span>Nota</span><input data-af="grade" type="number" min="0" max="20" step="0.1" value="${a.grade ?? ''}" placeholder="—"></label>
            <button class="icon-btn" data-del-a="${i}" aria-label="Remover prova"><svg class="ico"><use href="#i-close"/></svg></button>
          </div>`).join('')}
        <button class="link-btn small" data-add-a>+ Prova</button>
        <p class="pc-computed small" id="pc-computed-${u.id}">${computedLine(u)}</p>
      </div>

      ${others.length ? `
      <div class="pc-sub">
        <b>Pré-requisitos</b>
        <p class="muted small">UCs que esta usa como base (ex.: Estruturas de Dados depende de Programação). Se alguma estiver por fazer, reprovada ou abaixo de 12, esta UC recebe mais tempo e o plano inclui revisão dessa base.</p>
        <div class="pc-prereqs">${others.map(o => `<label class="check-inline"><input type="checkbox" data-prereq="${o.id}" ${(u.prereqs || []).includes(o.id) ? 'checked' : ''}> ${esc(o.name)}</label>`).join('')}</div>
      </div>` : ''}

      <button class="btn btn-danger-ghost btn-sm" data-del-uc>Remover UC</button>
    </div>`;
}

function computedLine(u) {
  const c = computedGrade(u);
  const st = ucStatus(u);
  const next = nextAssessmentDate(u);
  const weak = weakPrereqs(u, draft.ucs);
  const parts = [];
  if (u.grade !== null && u.grade !== undefined && u.grade !== '') parts.push(`Nota oficial: ${fmt(u.grade, 1)} — ${STATUS_LABEL[st]}.`);
  else if (c.complete) parts.push(`Nota calculada: ${fmt(c.grade, 2)} → ${c.rounded} — ${STATUS_LABEL[st]}${c.failedMin ? ' (abaixo da nota mínima numa componente)' : ''}.`);
  else if (c.failedMin) parts.push('Abaixo da nota mínima numa componente: segue para recurso.');
  else if ((u.assessments || []).length) parts.push('Faltam notas para calcular a nota final.');
  if (st === 'reprovada' && !next) parts.push('<b>Adiciona a data do recurso (ou época especial)</b> para o plano se ajustar.');
  else if (next) parts.push(`Próxima prova: ${next}.`);
  if (weak.length) parts.push(`Base fraca: ${weak.map(w => `${esc(w.uc.short || acronym(w.uc.name))} (${w.reason}${w.grade !== null ? `, ${fmt(w.grade, 1)}` : ''})`).join(', ')}.`);
  return parts.join(' ');
}

function renderSummary() {
  const el = $('pc-summary');
  if (!el) return;
  const avg = average(draft.ucs);
  const req = requiredForTarget(draft.ucs, numOrNull(draft.targetAverage));
  el.innerHTML = `
    <div class="pc-avg">
      <div><div class="pc-avg-num">${avg.average === null ? '—' : fmt(avg.average)}</div><div class="muted small">média atual · ${fmt(avg.ects, 1)} ECTS aprovados</div></div>
      <label class="field pc-target"><span>Objetivo de média</span><input id="pc-target" type="number" min="10" max="20" step="0.1" value="${draft.targetAverage ?? ''}" placeholder="ex.: 17"></label>
    </div>
    ${req.keep !== null ? `<p class="small pc-keep">Para não baixares a média, cada UC que falta precisa de <b>≥ ${req.keep}</b>.</p>` : ''}
    ${req.needed !== null ? `<p class="small ${req.reachable ? '' : 'pc-warn'}">${req.reachable
      ? `Para chegares a ${fmt(draft.targetAverage)}: média de <b>${fmt(Math.max(0, req.needed), 2)}</b> nos ${fmt(req.remainingEcts, 1)} ECTS que faltam.`
      : `${fmt(draft.targetAverage)} já não é alcançável com os ${fmt(req.remainingEcts, 1)} ECTS que faltam (precisarias de ${fmt(req.needed, 2)}).`}</p>` : ''}`;
  $('pc-target')?.addEventListener('input', (e) => { draft.targetAverage = numOrNull(e.target.value); renderSummaryLater(); });
}

let summaryTimer = null;
function renderSummaryLater() {
  clearTimeout(summaryTimer);
  // Rebuilding the summary would steal focus from the target input while typing.
  summaryTimer = setTimeout(() => {
    const active = document.activeElement?.id;
    renderSummary();
    if (active === 'pc-target') { const t = $('pc-target'); t.focus(); t.setSelectionRange?.(t.value.length, t.value.length); }
  }, 400);
}

function bind() {
  $('pc-degree').addEventListener('input', (e) => { draft.degree = e.target.value; });
  $('pc-add').addEventListener('click', () => {
    const last = draft.ucs[draft.ucs.length - 1];
    const u = newUc({ year: last?.year || 1, semester: last?.semester || 1 });
    draft.ucs.push(u);
    openUc = u.id;
    render();
    document.querySelector(`[data-uc="${u.id}"] [data-f="name"]`)?.focus();
  });
  $('pc-file')?.addEventListener('change', onImageChosen);

  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    openUc = openUc === b.dataset.toggle ? null : b.dataset.toggle;
    render();
    document.querySelector(`[data-uc="${openUc}"]`)?.scrollIntoView({ block: 'nearest' });
  }));

  document.querySelectorAll('[data-plan-sem]').forEach(b => b.addEventListener('click', () => {
    const [y, s] = b.dataset.planSem.split('-').map(Number);
    draft.ucs.filter(u => Number(u.year) === y && Number(u.semester) === s && !isApproved(u) && !u.optional).forEach(u => { u.inPlan = true; });
    render();
  }));

  const box = openUc && document.querySelector(`[data-uc="${openUc}"] .pc-editor`);
  if (!box) return;
  const u = draft.ucs.find(x => x.id === openUc);
  const refresh = () => {
    $(`pc-computed-${u.id}`).innerHTML = computedLine(u);
    const head = document.querySelector(`[data-uc="${u.id}"] .pc-uc-meta`);
    const g = effectiveGrade(u);
    head.innerHTML = `${statusChip(u)}<span class="pc-ects">${fmt(u.ects, 1)}</span><span class="pc-grade">${g === null ? '' : fmt(g, 1)}</span>`;
    renderSummaryLater();
  };

  box.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    const f = el.dataset.f;
    if (el.type === 'checkbox') u[f] = el.checked;
    else if (['ects', 'year', 'semester', 'passGrade', 'grade'].includes(f)) u[f] = numOrNull(el.value);
    else u[f] = el.value;
    if (f === 'name') document.querySelector(`[data-uc="${u.id}"] .pc-uc-name`).textContent = u.name || 'Nova UC';
    refresh();
  }));
  box.querySelectorAll('.pc-assess').forEach(row => {
    const a = u.assessments[Number(row.dataset.a)];
    row.querySelectorAll('[data-af]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const f = el.dataset.af;
      a[f] = ['weight', 'minGrade', 'grade'].includes(f) ? numOrNull(el.value) : el.value;
      refresh();
    }));
  });
  box.querySelectorAll('[data-del-a]').forEach(b => b.addEventListener('click', () => { u.assessments.splice(Number(b.dataset.delA), 1); render(); }));
  box.querySelector('[data-add-a]').addEventListener('click', () => {
    const hasNormal = u.assessments.some(a => a.epoca === 'normal');
    u.assessments.push({ id: uid('a'), name: hasNormal ? 'Recurso' : 'Exame', kind: 'exame', epoca: hasNormal ? 'recurso' : 'normal', date: '', weight: 100, minGrade: null, grade: null });
    render();
  });
  box.querySelectorAll('[data-prereq]').forEach(el => el.addEventListener('change', () => {
    u.prereqs = el.checked ? [...new Set([...(u.prereqs || []), el.dataset.prereq])] : (u.prereqs || []).filter(x => x !== el.dataset.prereq);
    refresh();
  }));
  box.querySelector('[data-del-uc]').addEventListener('click', () => {
    if (!confirm(`Remover “${u.name || 'esta UC'}” do percurso?`)) return;
    draft.ucs = draft.ucs.filter(x => x.id !== u.id);
    draft.ucs.forEach(x => { x.prereqs = (x.prereqs || []).filter(p => p !== u.id); });
    openUc = null;
    render();
  });
}

// ── Import from image ─────────────────
function setImportStatus(msg, error = false) {
  const el = $('pc-import-status');
  el.textContent = msg || '';
  el.classList.toggle('error', error);
  el.classList.toggle('hidden', !msg);
}

// Phones produce 4–12 MB photos; a 1800px JPEG keeps the table legible and the upload small.
function downscale(file, max = 1800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

async function onImageChosen(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  setImportStatus('A ler a imagem… (pode demorar até 1 min)');
  try {
    const dataUrl = await downscale(file);
    const r = await storage.importCurriculumImage(dataUrl);
    if (!r.ok) return setImportStatus(r.message, true);
    if (!r.result.units.length) return setImportStatus('Não encontrei unidades curriculares na imagem. Tenta uma imagem mais nítida.', true);
    if (r.result.degree && !draft.degree) { draft.degree = r.result.degree; $('pc-degree').value = r.result.degree; }
    importRows = r.result.units.map(u => ({ ...u, include: true }));
    setImportStatus(`Encontrei ${importRows.length} UCs. Confirma e corrige antes de adicionar.`);
    renderImport();
  } catch (err) {
    setImportStatus(err.message, true);
  } finally {
    e.target.value = '';
  }
}

function renderImport() {
  const el = $('pc-import');
  if (!importRows) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="pc-import-list">
      <div class="pc-import-row head"><span></span><span>Ano/Sem.</span><span>UC</span><span>ECTS</span><span>Nota</span><span>Tipo</span></div>
      ${importRows.map((u, i) => `
        <div class="pc-import-row" data-i="${i}">
          <input type="checkbox" data-k="include" ${u.include ? 'checked' : ''} aria-label="Incluir">
          <span class="ys"><input data-k="year" type="number" value="${u.year}" aria-label="Ano">/<input data-k="semester" type="number" value="${u.semester}" aria-label="Semestre"></span>
          <input data-k="name" value="${esc(u.name)}" aria-label="Nome">
          <input data-k="ects" type="number" step="0.5" value="${u.ects}" aria-label="ECTS">
          <input data-k="grade" type="number" step="0.1" value="${u.grade ?? ''}" placeholder="—" aria-label="Nota">
          <input data-k="gradeType" value="${esc(u.gradeType)}" placeholder="—" aria-label="Tipo">
        </div>`).join('')}
    </div>
    <div class="planner-actions left">
      <button class="btn btn-primary btn-sm" id="pc-import-apply">Adicionar ao percurso</button>
      <button class="btn btn-ghost btn-sm" id="pc-import-cancel">Descartar</button>
    </div>
    <p class="muted small">UCs com o mesmo nome que já tenhas são atualizadas (nota, data, ECTS), não duplicadas.</p>`;
  el.querySelectorAll('.pc-import-row[data-i]').forEach(row => {
    const u = importRows[Number(row.dataset.i)];
    row.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
      const k = inp.dataset.k;
      if (k === 'include') u.include = inp.checked;
      else if (['year', 'semester', 'ects', 'grade'].includes(k)) u[k] = numOrNull(inp.value);
      else u[k] = inp.value;
    }));
  });
  $('pc-import-apply').addEventListener('click', applyImport);
  $('pc-import-cancel').addEventListener('click', () => { importRows = null; renderImport(); setImportStatus(null); });
}

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function applyImport() {
  let added = 0;
  let updated = 0;
  for (const r of importRows.filter(x => x.include && x.name.trim())) {
    const existing = draft.ucs.find(u => norm(u.name) === norm(r.name));
    const fields = {
      name: r.name.trim(), ects: r.ects, year: r.year, semester: r.semester,
      optional: !!r.group,
      ...(r.grade !== null ? { grade: r.grade, gradeType: r.gradeType || '', gradeDate: r.date || '' } : {}),
    };
    if (existing) { Object.assign(existing, fields); updated++; } else { draft.ucs.push(newUc({ ...fields, short: acronym(r.name) })); added++; }
  }
  importRows = null;
  render();
  setImportStatus(`${added} UCs adicionadas, ${updated} atualizadas. Revê e carrega em Guardar.`);
}

// ── Progress card ─────────────────────
export function renderPercursoCard(el, { onManage, onSemester }) {
  const cur = storage.getCurriculum();
  if (!cur.ucs?.length) {
    el.innerHTML = `
      <p class="muted small">Regista as tuas UCs (à mão ou a partir de uma foto do plano de estudos) para veres a média por ano e semestre, o que precisas para a manter ou subir, e o histórico de cada semestre.</p>
      <button class="btn btn-ghost btn-sm" id="pc-open">Adicionar percurso</button>`;
    el.querySelector('#pc-open').addEventListener('click', onManage);
    return;
  }
  const avg = average(cur.ucs);
  const req = requiredForTarget(cur.ucs, numOrNull(cur.targetAverage));
  el.innerHTML = `
    <div class="pc-avg">
      <div><div class="pc-avg-num">${avg.average === null ? '—' : fmt(avg.average)}</div><div class="muted small">média · ${fmt(avg.ects, 1)} ECTS${cur.degree ? ` · ${esc(cur.degree)}` : ''}</div></div>
      <button class="btn btn-ghost btn-sm" id="pc-open">Gerir</button>
    </div>
    ${req.keep !== null ? `<p class="small pc-keep">Para não baixar: <b>≥ ${req.keep}</b> em cada UC que falta${req.needed !== null ? ` · objetivo ${fmt(cur.targetAverage)}: média de <b>${fmt(Math.max(0, req.needed), 2)}</b>` : ''}.</p>` : ''}
    <div class="pc-years">
      ${structure(cur.ucs).map(y => `
        <details class="pc-year">
          <summary><b>${y.year ? `${ord(y.year)} ano` : 'Sem ano'}</b><span class="muted small">${y.average !== null ? `média ${fmt(y.average)} · ` : ''}${fmt(y.ects, 1)}/${fmt(y.totalEcts, 1)} ECTS</span></summary>
          ${y.semesters.map(s => `
            <button class="pc-sem-btn" data-sem="${y.year}-${s.semester}">
              <span>${s.semester ? `${ord(s.semester)} semestre` : 'Sem semestre'}${s.complete ? ' <span class="status-chip st-aprovada">Concluído</span>' : ''}</span>
              <span class="muted small">${s.average !== null ? `média ${fmt(s.average)} · ` : ''}${fmt(s.ects, 1)}/${fmt(s.totalEcts, 1)} ECTS</span>
            </button>`).join('')}
        </details>`).join('')}
    </div>`;
  el.querySelector('#pc-open').addEventListener('click', onManage);
  el.querySelectorAll('[data-sem]').forEach(b => b.addEventListener('click', () => {
    const [y, s] = b.dataset.sem.split('-').map(Number);
    onSemester(y, s);
  }));
}

// ── Semester report ───────────────────
// Leads with learning (grades, unassisted mastery, calibration), time stays secondary.
export function openSemester(year, semester) {
  const cur = storage.getCurriculum();
  const years = structure(cur.ucs);
  const y = years.find(x => x.year === year);
  const s = y?.semesters.find(x => x.semester === semester);
  if (!s) return;
  const flat = years.flatMap(yy => yy.semesters.map(ss => ({ ...ss, year: yy.year })));
  const idx = flat.findIndex(x => x.year === year && x.semester === semester);
  const prev = idx > 0 ? flat[idx - 1] : null;

  const attempts = storage.getAttempts();
  const data = storage.loadData();
  const minutesOf = (id) => Object.values(data.focus || {}).reduce((sum, day) => sum + (day[id] || 0), 0);
  const ids = new Set(s.ucs.map(u => u.id));
  const semAttempts = attempts.filter(a => ids.has(a.subject));
  const probes = semAttempts.filter(a => a.kind === 'probe' && !a.assisted);
  const practice = semAttempts.filter(a => a.kind === 'practice');
  const unassistedShare = practice.length ? practice.filter(a => !a.assisted).length / practice.length : null;
  const totalMin = s.ucs.reduce((sum, u) => sum + minutesOf(u.id), 0);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const diff = prev?.average !== null && prev?.average !== undefined && s.average !== null ? s.average - prev.average : null;

  $('percurso-title').textContent = semLabel(year, semester);
  $('percurso-foot').classList.add('hidden');
  $('percurso-body').innerHTML = `
    <section class="card">
      <div class="pc-avg">
        <div><div class="pc-avg-num">${s.average === null ? '—' : fmt(s.average)}</div><div class="muted small">média do semestre · ${fmt(s.ects, 1)}/${fmt(s.totalEcts, 1)} ECTS</div></div>
        ${diff !== null ? `<div class="pc-diff ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${fmt(Math.abs(diff))}<small>vs ${esc(semLabel(prev.year, prev.semester))}</small></div>` : ''}
      </div>
      ${semAttempts.length ? `
      <div class="pc-stats">
        <div><b>${probes.length}</b><span>testes de controlo</span></div>
        <div><b>${unassistedShare === null ? '—' : pct(unassistedShare)}</b><span>prática sem ajuda</span></div>
        <div><b>${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}</b><span>tempo de estudo</span></div>
      </div>` : '<p class="muted small">Sem registos de estudo na app para este semestre (por exemplo, UCs creditadas ou feitas antes de usares a app).</p>'}
    </section>
    ${s.ucs.map(u => ucReport(u, attempts, minutesOf(u.id))).join('')}
  `;
  show(true);
}

function ucReport(u, attempts, minutes) {
  const g = effectiveGrade(u);
  const st = ucStatus(u);
  const mine = attempts.filter(a => a.subject === u.id);
  // Mastery as it stood before the exam: that's what should have predicted the grade.
  const before = u.gradeDate ? mine.filter(a => a.at <= new Date(u.gradeDate + 'T23:59').getTime()) : mine;
  const m = mastery(before, u.id);
  const cal = calibration(mine, u.id);
  const split = practiceSplit(mine, u.id);
  const probes = mine.filter(a => a.kind === 'probe' && !a.assisted && a.done > 0).sort((a, b) => a.at - b.at);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [];
  if (m !== null && g !== null) lines.push(`Último domínio medido antes do exame: <b>${pct(m)}</b> → nota <b>${fmt(g, 1)}</b> (${pct(g / 20)} da escala). ${Math.abs(m - g / 20) <= 0.1 ? 'Os testes de controlo previram bem.' : m > g / 20 ? 'Os testes previam mais do que saiu: torna-os mais parecidos com o exame.' : 'Saiu melhor do que os testes previam.'}`);
  else if (m !== null) lines.push(`Domínio medido: <b>${pct(m)}</b>.`);
  if (cal.overconfident) lines.push(`Excesso de confiança: esperavas ~${pct(cal.expected)}, acertaste ${pct(cal.actual)}.`);
  if (split.count) lines.push(`Prática: ${split.unassisted !== null ? `${pct(split.unassisted)} sem ajuda` : '—'}${split.assisted !== null ? ` · ${pct(split.assisted)} com ajuda` : ''}.`);
  if (minutes) lines.push(`Tempo: ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}.`);
  const color = PALETTE[Math.abs([...u.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % PALETTE.length];
  return `
    <section class="card pc-report">
      <div class="row-between">
        <div><b>${esc(u.name)}</b><div class="muted small">${fmt(u.ects, 1)} ECTS${u.gradeType ? ` · ${esc(u.gradeType)}` : ''}${u.gradeDate ? ` · ${esc(u.gradeDate)}` : ''}</div></div>
        <div class="pc-report-grade">${g === null ? statusChip(u) : `<span>${fmt(g, 1)}</span>${st === 'reprovada' ? statusChip(u) : ''}`}</div>
      </div>
      ${probes.length > 1 ? `<div class="spark" title="Testes de controlo ao longo do semestre">${probes.map(p => `<i style="height:${Math.max(6, Math.round((p.correct / p.done) * 100))}%;background:${color}"></i>`).join('')}</div>` : ''}
      ${lines.length ? `<p class="small pc-report-lines">${lines.join(' ')}</p>` : ''}
    </section>`;
}
