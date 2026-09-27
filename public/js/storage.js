const STORAGE_KEY = 'estudar_data';
const LAST_UID_KEY = 'estudar_last_uid';
export const TIMER_KEY = 'estudar_timer';
const SERVER_CONFIG_KEY = 'estudar_server_config';
const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;
let currentUser = null;
let channel = null;
let pushTimer = null;
let onSyncCallback = null;
let onAuthCallback = null;

// Public settings come from the server (/api/config), so nothing is hard-coded in the repo.
// Cached for offline starts. null = static hosting without the API (local-only mode).
let serverConfig = null;

export async function loadServerConfig() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no api');
    serverConfig = await r.json();
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(serverConfig));
  } catch {
    try { serverConfig = JSON.parse(localStorage.getItem(SERVER_CONFIG_KEY) || 'null'); } catch { serverConfig = null; }
  }
  return serverConfig;
}

export const getServerConfig = () => serverConfig;
export const isConfigured = () => !!(serverConfig?.configured && serverConfig.supabaseUrl && serverConfig.supabaseAnonKey);
export const hasAi = () => !!serverConfig?.ai;

// Local calendar date (not UTC), so a session at 00:30 counts for the day you're living in.
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaults() {
  return {
    owner: null,    // user id the local copy belongs to
    plan: null,     // { subjects, weeklyPlan, phases, ... } — null until the user sets one up
    sessions: {},   // { '2026-09-25': { fp: { done: true, timestamp } } }
    focus: {},      // { '2026-09-25': { fp: 80 } }  minutes studied per subject
    checklist: {},  // { 'W01': [bool x5] }
    attempts: [],   // append-only log of self-graded attempts and probes (see learning.js)
    examResults: {}, // { subjectId: { grade, at } } real exam grades, to check the probes predicted them
    timerConfig: { work: 40, break: 10, longBreak: 15, sessionsBeforeLong: 4 },
    settings: { sound: true },
    updatedAt: 0,
  };
}

function getLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...getDefaults(), ...JSON.parse(raw) } : getDefaults();
  } catch {
    return getDefaults();
  }
}

function setLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

export function loadData() {
  return getLocal();
}

export function saveData(data) {
  data.updatedAt = Date.now();
  setLocal(data);
  schedulePush();
}

// ── Plan ───────────────────────────────
export function getPlan() {
  return loadData().plan;
}

export function savePlan(plan) {
  const data = loadData();
  data.plan = plan;
  saveData(data);
}

// ── Sessions ───────────────────────────
export function isSessionDone(date, id) {
  return !!loadData().sessions[dateKey(date)]?.[id]?.done;
}

export function setSessionDone(date, id, done) {
  const data = loadData();
  const key = dateKey(date);
  data.sessions[key] = data.sessions[key] || {};
  if (done) data.sessions[key][id] = { done: true, timestamp: Date.now() };
  else delete data.sessions[key][id];
  saveData(data);
}

export function logFocus(subjectId, minutes, date = new Date()) {
  if (!subjectId || minutes <= 0) return;
  const data = loadData();
  const key = dateKey(date);
  data.focus[key] = data.focus[key] || {};
  data.focus[key][subjectId] = (data.focus[key][subjectId] || 0) + minutes;
  saveData(data);
}

// ── Attempts (append-only) and exam results ──
export function getAttempts() {
  return loadData().attempts || [];
}

export function addAttempt(attempt) {
  const data = loadData();
  data.attempts = [...(data.attempts || []), { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), ...attempt }];
  saveData(data);
}

export function getExamResults() {
  return loadData().examResults || {};
}

export function setExamResult(subjectId, grade) {
  const data = loadData();
  data.examResults = { ...(data.examResults || {}), [subjectId]: { grade, at: Date.now() } };
  saveData(data);
}

// ── Checklist / config ─────────────────
export function getWeekChecklist(weekNum) {
  const key = `W${String(weekNum).padStart(2, '0')}`;
  return loadData().checklist[key] || [false, false, false, false, false];
}

export function saveWeekChecklist(weekNum, checks) {
  const data = loadData();
  data.checklist[`W${String(weekNum).padStart(2, '0')}`] = checks;
  saveData(data);
}

export function getTimerConfig() {
  return loadData().timerConfig;
}

export function saveTimerConfig(config) {
  const data = loadData();
  data.timerConfig = config;
  saveData(data);
}

export function getSetting(name) {
  return loadData().settings?.[name];
}

export function setSetting(name, value) {
  const data = loadData();
  data.settings = { ...data.settings, [name]: value };
  saveData(data);
}

// ── Stats (derived, so merging devices can't make counters drift) ──
export function getStats() {
  const data = loadData();
  let totalMinutes = 0;
  const activeDays = new Set();

  for (const [day, subs] of Object.entries(data.focus || {})) {
    const mins = Object.values(subs).reduce((a, b) => a + b, 0);
    totalMinutes += mins;
    if (mins > 0) activeDays.add(day);
  }
  let totalSessions = 0;
  for (const [day, subs] of Object.entries(data.sessions || {})) {
    const n = Object.values(subs).filter(s => s?.done).length;
    totalSessions += n;
    if (n > 0) activeDays.add(day);
  }

  // Streak: consecutive days with activity ending today (or yesterday, if today hasn't started yet).
  let streak = 0;
  const cursor = new Date();
  if (!activeDays.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalMinutes, totalSessions, streak };
}

export function getMinutesByDay(days) {
  const data = loadData();
  return days.map(d => {
    const subs = data.focus?.[dateKey(d)] || {};
    return { date: d, bySubject: subs, total: Object.values(subs).reduce((a, b) => a + b, 0) };
  });
}

// ── Auth ───────────────────────────────
function toUser(u) {
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || '',
    displayName: meta.full_name || meta.name || (u.email || '').split('@')[0],
    photoURL: meta.avatar_url || meta.picture || '',
  };
}

// Returns 'local' (no backend configured), 'signed-in', 'signed-out' or 'offline' (SDK unreachable).
export async function init() {
  await loadServerConfig();
  if (!isConfigured()) return 'local';
  try {
    const { createClient } = await import(SUPABASE_SDK);
    supabase = createClient(serverConfig.supabaseUrl, serverConfig.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (e) {
    console.warn('Supabase SDK failed to load:', e);
    return 'offline';
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await afterSignIn(session.user);

  // Magic links and OAuth redirects land here too.
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_IN' && s?.user && s.user.id !== currentUser?.id) {
      afterSignIn(s.user).then(() => onAuthCallback?.(toUser(s.user)));
    }
    if (event === 'SIGNED_OUT' && currentUser) {
      currentUser = null;
      onAuthCallback?.(null);
    }
  });

  return session?.user ? 'signed-in' : 'signed-out';
}

export function hadPreviousLogin() {
  return !!localStorage.getItem(LAST_UID_KEY);
}

const AUTH_ERRORS = [
  [/rate limit|security purposes|only request this after/i, 'Pediste códigos demasiadas vezes. Espera um minuto e tenta de novo.'],
  [/expired|invalid/i, 'Código inválido ou expirado. Pede um novo código.'],
  [/signups not allowed|not allowed for otp/i, 'Esta instalação não aceita novas contas. Pede um convite ao administrador.'],
  [/fetch|network/i, 'Sem ligação à internet. Tenta de novo quando estiveres online.'],
  [/provider is not enabled/i, 'Este método de login não está ativo no Supabase (Authentication → Providers).'],
];

function authMessage(error) {
  const msg = error?.message || String(error);
  const hit = AUTH_ERRORS.find(([re]) => re.test(msg));
  return hit ? hit[1] : `Não foi possível iniciar sessão (${msg}).`;
}

const redirectTo = () => location.origin + location.pathname;

export async function sendEmailCode(email) {
  if (!supabase) return { ok: false, message: 'Sem ligação ao servidor.' };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  return error ? { ok: false, message: authMessage(error) } : { ok: true };
}

export async function verifyEmailCode(email, token) {
  if (!supabase) return { ok: false, message: 'Sem ligação ao servidor.' };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { ok: false, message: authMessage(error) };
  await afterSignIn(data.user);
  return { ok: true };
}

export async function signInWithGoogle() {
  if (!supabase) return { ok: false, message: 'Sem ligação ao servidor.' };
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  return error ? { ok: false, message: authMessage(error) } : { ok: true, redirecting: true };
}

export async function signOut() {
  await flushPush();
  if (channel) supabase?.removeChannel(channel);
  channel = null;
  currentUser = null;
  try { await supabase?.auth.signOut(); } catch {}
  // Shared devices: don't leave one person's plan behind for the next.
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMER_KEY);
  localStorage.removeItem(LAST_UID_KEY);
}

async function afterSignIn(user) {
  if (currentUser?.id === user.id) return;
  currentUser = user;
  localStorage.setItem(LAST_UID_KEY, user.id);

  let local = loadData();
  // Local copy belongs to someone else: never merge it into this account.
  if (local.owner && local.owner !== user.id) {
    local = getDefaults();
    localStorage.removeItem(TIMER_KEY);
  }

  try {
    const { data: row, error } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const merged = row?.data ? mergeData(local, row.data) : local;
    merged.owner = user.id;
    setLocal(merged);
    await push(merged);
  } catch (e) {
    console.warn('Initial sync failed:', e);
    local.owner = user.id;
    setLocal(local);
  }
  subscribe();
}

// ── Sync ───────────────────────────────
function schedulePush() {
  if (!supabase || !currentUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(loadData()), 800);
}

async function flushPush() {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  await push(loadData());
}

async function push(data) {
  pushTimer = null;
  if (!supabase || !currentUser) return;
  const { error } = await supabase.from('user_data').upsert({
    user_id: currentUser.id,
    data,
    updated_at: new Date(data.updatedAt || Date.now()).toISOString(),
  });
  if (error) console.warn('Sync failed:', error.message);
}

function subscribe() {
  if (!supabase || !currentUser) return;
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`user_data:${currentUser.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_data', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
      const remote = payload.new?.data;
      if (!remote) return;
      const local = loadData();
      if ((remote.updatedAt || 0) <= (local.updatedAt || 0)) return;
      // Remote came from a device that already merged on sign-in: take it as-is
      // so un-checking something on one device propagates.
      const byId = new Map();
      for (const a of [...(remote.attempts || []), ...(local.attempts || [])]) if (a?.id) byId.set(a.id, a);
      setLocal({ ...getDefaults(), ...remote, attempts: [...byId.values()].sort((a, b) => a.at - b.at), owner: currentUser.id });
      onSyncCallback?.();
    })
    .subscribe();
}

function mergeData(local, remote) {
  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const merged = { ...getDefaults(), ...local };

  merged.sessions = {};
  for (const day of new Set([...Object.keys(local.sessions || {}), ...Object.keys(remote.sessions || {})])) {
    merged.sessions[day] = { ...(local.sessions?.[day] || {}), ...(remote.sessions?.[day] || {}) };
  }

  merged.focus = {};
  for (const day of new Set([...Object.keys(local.focus || {}), ...Object.keys(remote.focus || {})])) {
    const l = local.focus?.[day] || {};
    const r = remote.focus?.[day] || {};
    merged.focus[day] = {};
    for (const sub of new Set([...Object.keys(l), ...Object.keys(r)])) {
      merged.focus[day][sub] = Math.max(l[sub] || 0, r[sub] || 0);
    }
  }

  merged.checklist = {};
  for (const week of new Set([...Object.keys(local.checklist || {}), ...Object.keys(remote.checklist || {})])) {
    const l = local.checklist?.[week] || [];
    const r = remote.checklist?.[week] || [];
    merged.checklist[week] = Array.from({ length: Math.max(l.length, r.length) }, (_, i) => !!(l[i] || r[i]));
  }

  // Append-only log: union by id, so no device can erase another's attempts.
  const byId = new Map();
  for (const a of [...(remote.attempts || []), ...(local.attempts || [])]) if (a?.id) byId.set(a.id, a);
  merged.attempts = [...byId.values()].sort((a, b) => a.at - b.at);

  merged.examResults = { ...(remote.examResults || {}) };
  for (const [k, v] of Object.entries(local.examResults || {})) {
    if (!merged.examResults[k] || (v?.at || 0) > (merged.examResults[k].at || 0)) merged.examResults[k] = v;
  }

  merged.plan = newer.plan || local.plan || remote.plan || null;
  merged.timerConfig = newer.timerConfig || merged.timerConfig;
  merged.settings = { ...getDefaults().settings, ...(newer.settings || {}) };
  merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return merged;
}

// ── AI plan generation ─────────────────
export async function generatePlan(input) {
  if (!supabase || !currentUser) return { ok: false, message: 'Precisas de ter sessão iniciada e ligação à internet.' };
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const r = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(input),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: data.error || `O servidor respondeu ${r.status}.` };
    return { ok: true, plan: data.plan, remaining: data.remaining };
  } catch {
    return { ok: false, message: 'Não foi possível contactar o servidor.' };
  }
}

export function onSync(callback) {
  onSyncCallback = callback;
}

export function onAuthChange(callback) {
  onAuthCallback = callback;
}

export function getCurrentUser() {
  return toUser(currentUser);
}
