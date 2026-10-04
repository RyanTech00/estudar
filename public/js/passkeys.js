// Passkeys: sign in with fingerprint, face or the device PIN instead of an email code.
// A device is registered from inside the app (already signed in); the email code stays as the way back in.
import * as storage from './storage.js';
import { t } from './i18n.js';
import { open, closeLog } from './logsheet.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OFFER_KEY = 'estudar_passkey_offer';

function offerAnswered(userId) {
  try { return (JSON.parse(localStorage.getItem(OFFER_KEY) || '[]')).includes(userId); } catch { return true; }
}
function markOfferAnswered(userId) {
  try {
    const seen = JSON.parse(localStorage.getItem(OFFER_KEY) || '[]');
    if (!seen.includes(userId)) localStorage.setItem(OFFER_KEY, JSON.stringify([...seen, userId].slice(-10)));
  } catch {}
}

const shortDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(document.documentElement.lang || undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// Once per account and device, right after signing in with the email code.
export function offerPasskey(toast) {
  const user = storage.getCurrentUser();
  if (!user || !storage.passkeysSupported() || offerAnswered(user.id)) return;
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Entrar mais depressa?')}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted">${t('Guarda uma passkey neste dispositivo e da próxima vez entras com a impressão digital, o rosto ou o PIN do dispositivo, sem esperar pelo código.')}</p>
    <p class="muted small">${t('A chave fica no dispositivo (ou no teu gestor de palavras-passe); o servidor só guarda a parte pública. O código por email continua a funcionar.')}</p>
    <p class="login-error hidden" id="pk-error" role="alert"></p>
    <button class="btn btn-primary btn-block" id="pk-add">${t('Guardar passkey')}</button>
    <button class="btn btn-ghost btn-block" id="pk-later">${t('Agora não')}</button>
  `);
  const later = () => { markOfferAnswered(user.id); closeLog(); };
  $('log-close').addEventListener('click', later);
  $('pk-later').addEventListener('click', later);
  $('pk-add').addEventListener('click', async () => {
    $('pk-add').disabled = true;
    const r = await storage.registerPasskey();
    $('pk-add').disabled = false;
    if (r.cancelled) return;
    if (!r.ok) {
      $('pk-error').textContent = r.message;
      $('pk-error').classList.remove('hidden');
      return;
    }
    markOfferAnswered(user.id);
    closeLog();
    toast(t('Passkey guardada'));
  });
}

// Account → Passkeys: the devices that can sign in without a code, add this one, remove any.
export async function openPasskeys(toast) {
  const user = storage.getCurrentUser();
  if (!user) return;
  open(`
    <div class="row-between">
      <h2 class="h2 log-title">${t('Passkeys')}</h2>
      <button class="icon-btn" id="log-close" aria-label="${t('Fechar')}"><svg class="ico"><use href="#i-close"/></svg></button>
    </div>
    <p class="muted small">${t('Dispositivos que entram com a impressão digital, o rosto ou o PIN, sem código por email. Remove um dispositivo que perdeste ou deixaste de usar.')}</p>
    <div id="pk-list"><div class="empty">${t('A carregar…')}</div></div>
    <p class="login-error hidden" id="pk-error" role="alert"></p>
    ${storage.passkeysSupported()
      ? `<button class="btn btn-primary btn-block" id="pk-add">${t('Juntar este dispositivo')}</button>`
      : `<p class="muted small">${t('Este browser não suporta passkeys.')}</p>`}
  `);
  $('log-close').addEventListener('click', closeLog);
  const showError = (msg) => {
    $('pk-error').textContent = msg || '';
    $('pk-error').classList.toggle('hidden', !msg);
  };

  async function render() {
    const r = await storage.listPasskeys();
    if (!$('pk-list')) return;
    if (!r.ok) return showError(r.message || t('Não foi possível carregar as passkeys.'));
    $('pk-list').innerHTML = r.passkeys.length ? r.passkeys.map(p => `
      <div class="session log-row"><span class="session-text">
        <span class="session-name">${esc(p.friendly_name || t('Passkey'))}</span>
        <span class="session-meta">${t('criada a {d}', { d: esc(shortDate(p.created_at)) })}${p.last_used_at ? ` · ${t('usada a {d}', { d: esc(shortDate(p.last_used_at)) })}` : ''}</span></span>
        <button class="link-btn small" data-pk-delete="${esc(p.id)}">${t('Remover')}</button></div>`).join('')
      : `<div class="empty">${t('Ainda nenhum dispositivo. Junta este para entrares sem código.')}</div>`;
    $('pk-list').querySelectorAll('[data-pk-delete]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(t('Remover esta passkey? Esse dispositivo volta a entrar com o código por email.'))) return;
      const d = await storage.deletePasskey(b.dataset.pkDelete);
      if (!d.ok) return showError(d.message);
      showError(null);
      toast(t('Passkey removida'));
      render();
    }));
  }

  $('pk-add')?.addEventListener('click', async () => {
    $('pk-add').disabled = true;
    showError(null);
    const r = await storage.registerPasskey();
    $('pk-add').disabled = false;
    if (r.cancelled) return;
    if (!r.ok) return showError(r.message);
    markOfferAnswered(user.id);
    toast(t('Passkey guardada'));
    render();
  });
  render();
}
