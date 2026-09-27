// The setup screen's values: which keys exist, and how an update is merged into what's stored.
// Kept apart from server.mjs so it can be tested (server.mjs starts a server when imported).
import { tr } from '../worker/i18n.js';
import { keyKind } from '../worker/api.js';

// Keys the setup screen can edit. `secret` values are never sent back to the browser in full.
export const FIELDS = {
  SUPABASE_URL: { secret: false },
  SUPABASE_ANON_KEY: { secret: false },
  SUPABASE_SERVICE_KEY: { secret: true },
  AI_PROVIDER: { secret: false },
  AI_API_KEY: { secret: true },
  AI_MODEL: { secret: false },
  AI_BASE_URL: { secret: false },
  MAX_PLANS_PER_DAY: { secret: false },
  AUTH_GOOGLE: { secret: false },
  OWNER_EMAIL: { secret: false },  // set by Configurar; the Worker gives only this account the AI and the status panel
  OWNER_ID: { secret: false },     // the same account, by id (an email can change hands; an id can't)
};

// Incoming values: empty secret = keep the stored one; masked value = unchanged.
export function mergeValues(stored, incoming = {}, lang = 'pt') {
  const next = { ...stored };
  for (const k of Object.keys(FIELDS)) {
    if (!(k in incoming)) continue;
    const v = String(incoming[k] ?? '').trim();
    if (FIELDS[k].secret && (v === '' || v.startsWith('••••'))) continue;
    if (/[\r\n]/.test(v)) throw new Error(tr(lang, '{k} não pode ter quebras de linha.', { k }));
    // Catch keys pasted into the wrong field: a secret in the public field would be sent to every browser.
    if (k === 'SUPABASE_ANON_KEY' && keyKind(v) === 'secret') throw new Error(tr(lang, 'Isso é a chave secreta. No campo público vai a publishable (ou anon); a secreta nunca pode ir para o browser.'));
    if (k === 'SUPABASE_SERVICE_KEY' && keyKind(v) === 'public') throw new Error(tr(lang, 'Isso é a chave pública (publishable/anon). Aqui vai a secreta (secret/service_role).'));
    if ((k === 'SUPABASE_URL' && v && !/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(v))
      || (k === 'AI_BASE_URL' && v && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/i.test(v))) {
      throw new Error(tr(lang, '{k} tem de ser um endereço https://.', { k }));
    }
    next[k] = v;
  }
  // A stored key is only ever sent to the endpoint it was entered for: pointing the app somewhere else
  // (e.g. a hostile AI_BASE_URL) drops it unless a new key comes in the same request.
  const sent = (k) => String(incoming[k] ?? '').trim() && !String(incoming[k]).startsWith('••••');
  // Empty and never-stored are the same value (.dev.vars doesn't keep empty lines).
  const same = (k) => (next[k] || '') === (stored[k] || '');
  if (!same('SUPABASE_URL')) {
    if (!sent('SUPABASE_SERVICE_KEY')) delete next.SUPABASE_SERVICE_KEY;
    delete next.OWNER_ID;  // account ids belong to one project; the email stands in until Configurar runs again
  }
  if ((!same('AI_PROVIDER') || !same('AI_BASE_URL')) && !sent('AI_API_KEY')) delete next.AI_API_KEY;
  return next;
}
