// Collects every Portuguese UI string that needs an English entry.
// Used by tests/i18n.test.mjs; run directly to list missing keys: node tests/i18n-keys.mjs
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Strings that reach t() through a variable rather than a literal.
export const DYNAMIC = [
  // app.js tab titles, setup.js status rows
  'Hoje', 'Semana', 'Progresso', 'Base de dados', 'IA', 'Limite de uso', 'Servidor',
  // data.js AREAS / LOADS
  'Universidade', 'Línguas', 'Outros', 'Leve', 'Média', 'Alta',
  // curriculum.js STATUS_LABEL and prerequisite reasons
  'Aprovada', 'Creditada', 'Reprovada', 'Em curso', 'Por fazer', 'por fazer', 'reprovada', 'nota baixa',
  // percurso.js assessment kinds, periods, grade types
  'Normal', 'Recurso', 'Especial', 'Exame', 'Teste', 'Trabalho', 'Frequência', 'Outro', 'exame', 'avaliação', 'CC (creditação)',
];

function literalKeys(src) {
  const keys = new Set();
  // t('...'), t("..."), t(`...`) — first argument only, no ${} interpolation.
  const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const m of src.matchAll(re)) {
    if (m[1] === '`' && m[2].includes('${')) continue;
    keys.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  }
  return keys;
}

// Drops <script>, <style> and <svg> blocks before collecting text. This only ever reads our own index.html,
// but it's written like a real filter anyway: any case, attributes or spaces in the closing tag, and repeated
// until nothing changes (one pass could leave a block that two removals glued back together).
function stripBlocks(html) {
  let prev;
  do {
    prev = html;
    html = html.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\b[^>]*>/gi, '');
  } while (html !== prev);
  return html;
}

function htmlKeys(html) {
  const keys = new Set();
  const body = stripBlocks(html);
  for (const m of body.matchAll(/>([^<>]+)</g)) {
    const text = m[1].trim();
    if (text && /[A-Za-zÀ-ÿ]/.test(text) && !/^[A-Z0-9 .·—–:-]{1,5}$/.test(text)) keys.add(text.replace(/&amp;/g, '&'));
  }
  for (const m of body.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) {
    if (/[A-Za-zÀ-ÿ]/.test(m[1])) keys.add(m[1]);
  }
  return keys;
}

// Words that are the same in both languages or are names; no entry needed.
const SAME = new Set(['Estudar', 'Timer', 'Supabase', 'Cloudflare', 'App', 'ECTS', 'UC', 'Project URL', 'Gemini', 'Claude (Anthropic)', 'Online', 'Offline', 'English', 'Português', 'sbp_…', 'Login']);

export async function collectKeys() {
  const keys = new Set(DYNAMIC);
  const dir = path.join(ROOT, 'public', 'js');
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.js') || f.startsWith('i18n')) continue;
    for (const k of literalKeys(await readFile(path.join(dir, f), 'utf8'))) keys.add(k);
  }
  for (const k of htmlKeys(await readFile(path.join(ROOT, 'public', 'index.html'), 'utf8'))) keys.add(k);
  for (const k of SAME) keys.delete(k);
  return [...keys];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { EN } = await import('../public/js/i18n-en.js').catch(() => ({ EN: {} }));
  const missing = (await collectKeys()).filter(k => !(k in EN));
  console.log(JSON.stringify(missing, null, 1));
  console.error(`${missing.length} sem tradução`);
}
