// Interface language. Portuguese source strings are the keys (gettext style), so the code stays
// readable and a missing translation falls back to Portuguese instead of showing a key.
// tests/i18n.test.mjs fails if any string used in the UI has no English entry.
import { EN } from './i18n-en.js';

const KEY = 'estudar_lang';
export const LANGS = { pt: 'Português', en: 'English' };

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGS[saved]) return saved;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'pt';
  return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export let lang = detect();

export function setLang(next) {
  if (!LANGS[next]) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch {}
  if (typeof document !== 'undefined') document.documentElement.lang = locale();
}

export const locale = () => (lang === 'en' ? 'en-GB' : 'pt-PT');

// t('Acertaste {c} de {d}', { c: 3, d: 5 })
export function t(key, vars) {
  let s = lang === 'en' ? (EN[key] ?? key) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

// Static HTML: translate text nodes and a few attributes in place, remembering the Portuguese
// original so switching language back and forth works without a reload.
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
export function translateDOM(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.__pt === undefined) {
      const text = n.nodeValue.trim();
      if (!text || !/[A-Za-zÀ-ÿ]/.test(text) || !(text in EN)) continue;
      n.__pt = n.nodeValue;
    }
    const src = n.__pt;
    const trimmed = src.trim();
    n.nodeValue = src.replace(trimmed, t(trimmed));
  }
  root.querySelectorAll('*').forEach(el => {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const key = `__pt_${a}`;
      if (el[key] === undefined) {
        const v = el.getAttribute(a);
        if (!(v in EN)) continue;
        el[key] = v;
      }
      el.setAttribute(a, t(el[key]));
    }
  });
}

export const DAY_SHORT = () => (lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
export const DAY_LONG = () => (lang === 'en' ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']);
export const DAY_NAMES = () => (lang === 'en' ? DAY_LONG() : ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
export const MONTH_SHORT = () => (lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']);
// Only used for years and semesters (small numbers).
export const ordinal = (n) => (lang === 'en' ? `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n] || 'th'}` : `${n}.º`);
