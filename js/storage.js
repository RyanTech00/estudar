const STORAGE_KEY = 'estudar_data';
const LAST_UID_KEY = 'estudar_last_uid';
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "estudar-xxxxx.firebaseapp.com",
  projectId: "estudar-xxxxx",
  storageBucket: "estudar-xxxxx.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};

let firebaseDb = null;
let firebaseAuth = null;
let currentUser = null;
let unsubscribe = null;
let onSyncCallback = null;

// Local calendar date (not UTC), so a session at 00:30 counts for the day you're living in.
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaults() {
  return {
    sessions: {},   // { '2026-09-25': { fp: { done: true, timestamp } } }
    focus: {},      // { '2026-09-25': { fp: 80 } }  minutes studied per subject
    checklist: {},  // { '2026-W01': [bool x5] }
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
  if (firebaseDb && currentUser) syncToFirebase(data);
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

// ── Firebase ───────────────────────────
export async function autoInit() {
  try {
    const { initializeApp } = await import(`${SDK}/firebase-app.js`);
    const { getFirestore } = await import(`${SDK}/firebase-firestore.js`);
    const { getAuth, onAuthStateChanged } = await import(`${SDK}/firebase-auth.js`);

    const app = initializeApp(FIREBASE_CONFIG);
    firebaseDb = getFirestore(app);
    firebaseAuth = getAuth(app);

    return await new Promise((resolve) => {
      onAuthStateChanged(firebaseAuth, (user) => {
        currentUser = user;
        if (user) {
          localStorage.setItem(LAST_UID_KEY, user.uid);
          listenToFirebase();
        }
        resolve(!!user);
      });
    });
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return null;
  }
}

// Firebase SDK unreachable (offline) but this device was signed in before.
export function hadPreviousLogin() {
  return !!localStorage.getItem(LAST_UID_KEY);
}

const AUTH_ERRORS = {
  'auth/unauthorized-domain': `Este domínio (${location.hostname}) não está autorizado no Firebase. Adiciona-o em Authentication → Settings → Authorized domains.`,
  'auth/network-request-failed': 'Sem ligação à internet. Tenta de novo quando estiveres online.',
  'auth/operation-not-allowed': 'O login com Google não está ativo no Firebase (Authentication → Sign-in method).',
  'auth/internal-error': 'O Firebase devolveu um erro interno. Tenta de novo daqui a pouco.',
};

export async function signIn() {
  if (!firebaseAuth) return { ok: false, message: 'Não foi possível carregar o Firebase. Verifica a ligação.' };
  const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import(`${SDK}/firebase-auth.js`);
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    currentUser = result.user;
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      return { ok: false, message: null };
    }
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(firebaseAuth, provider);
      return { ok: false, message: null };
    }
    console.warn('Sign in failed:', e);
    return { ok: false, message: AUTH_ERRORS[e.code] || `Não foi possível iniciar sessão (${e.code || e.message}).` };
  }

  localStorage.setItem(LAST_UID_KEY, currentUser.uid);
  // Merge with the cloud copy before writing, so a fresh device doesn't wipe it.
  try {
    const { doc, getDoc } = await import(`${SDK}/firebase-firestore.js`);
    const snap = await getDoc(doc(firebaseDb, 'users', currentUser.uid));
    const data = snap.exists() ? mergeData(loadData(), snap.data()) : loadData();
    setLocal(data);
    await syncToFirebase(data);
  } catch (e) {
    console.warn('Initial sync failed:', e);
  }
  listenToFirebase();
  return { ok: true };
}

export async function signOut() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (firebaseAuth) await firebaseAuth.signOut();
  currentUser = null;
  localStorage.removeItem(LAST_UID_KEY);
}

async function syncToFirebase(data) {
  if (!firebaseDb || !currentUser) return;
  try {
    const { doc, setDoc } = await import(`${SDK}/firebase-firestore.js`);
    await setDoc(doc(firebaseDb, 'users', currentUser.uid), { ...data, email: currentUser.email });
  } catch (e) {
    console.warn('Sync to Firebase failed:', e);
  }
}

async function listenToFirebase() {
  if (!firebaseDb || !currentUser) return;
  try {
    const { doc, onSnapshot } = await import(`${SDK}/firebase-firestore.js`);
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(doc(firebaseDb, 'users', currentUser.uid), (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const remote = snap.data();
      const local = loadData();
      if ((remote.updatedAt || 0) <= (local.updatedAt || 0)) return;
      // Remote is newer and was written by a device that already merged on sign-in:
      // take it as-is so un-checking something on one device propagates.
      const { email, ...next } = remote;
      setLocal({ ...getDefaults(), ...next });
      if (onSyncCallback) onSyncCallback(next);
    });
  } catch (e) {
    console.warn('Listen to Firebase failed:', e);
  }
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

  merged.timerConfig = newer.timerConfig || merged.timerConfig;
  merged.settings = { ...getDefaults().settings, ...(newer.settings || {}) };
  merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return merged;
}

export function onSync(callback) {
  onSyncCallback = callback;
}

export function getCurrentUser() {
  return currentUser;
}
