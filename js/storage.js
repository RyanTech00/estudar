const STORAGE_KEY = 'estudar_data';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZOlDkDkAaZT-EiAgFV58jNkVdw0TFgzw",
  authDomain: "estudar-a7668.firebaseapp.com",
  projectId: "estudar-a7668",
  storageBucket: "estudar-a7668.firebasestorage.app",
  messagingSenderId: "202001167729",
  appId: "1:202001167729:web:f00af96dc4a86d4bb8b2d0",
};

let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let currentUser = null;
let unsubscribe = null;
let onSyncCallback = null;

function getLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaults();
  } catch {
    return getDefaults();
  }
}

function setLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

function getDefaults() {
  return {
    sessions: {},      // { '2026-09-25': { fp: { done: true, notes: '', minutes: 50 } } }
    checklist: {},     // { '2026-W01': [false, false, false, false, false] }
    timerConfig: { work: 40, break: 10, longBreak: 15, sessionsBeforeLong: 4 },
    totalMinutes: 0,
    totalSessions: 0,
    streak: 0,
    lastStudyDate: null,
    settings: { sound: true, autoStart: false, darkMode: true },
  };
}

export function loadData() {
  return getLocal();
}

export function saveData(data) {
  setLocal(data);
  if (firebaseDb && currentUser) {
    syncToFirebase(data);
  }
}

export function markSessionDone(date, subjectId, minutes = 0, notes = '') {
  const data = loadData();
  const key = date.toISOString().slice(0, 10);
  if (!data.sessions[key]) data.sessions[key] = {};
  data.sessions[key][subjectId] = { done: true, minutes, notes, timestamp: Date.now() };
  data.totalSessions++;
  data.totalMinutes += minutes;

  const today = new Date().toISOString().slice(0, 10);
  if (data.lastStudyDate === today) {
    // same day, no streak change
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastStudyDate === yesterday) {
      data.streak++;
    } else {
      data.streak = 1;
    }
  }
  data.lastStudyDate = today;
  saveData(data);
  return data;
}

export function unmarkSession(date, subjectId) {
  const data = loadData();
  const key = date.toISOString().slice(0, 10);
  if (data.sessions[key] && data.sessions[key][subjectId]) {
    const session = data.sessions[key][subjectId];
    data.totalMinutes = Math.max(0, data.totalMinutes - (session.minutes || 0));
    data.totalSessions = Math.max(0, data.totalSessions - 1);
    delete data.sessions[key][subjectId];
  }
  saveData(data);
  return data;
}

export function isSessionDone(date, subjectId) {
  const data = loadData();
  const key = date.toISOString().slice(0, 10);
  return !!(data.sessions[key] && data.sessions[key][subjectId]?.done);
}

export function getWeekChecklist(weekNum) {
  const data = loadData();
  const key = `2026-W${weekNum.toString().padStart(2, '0')}`;
  return data.checklist[key] || [false, false, false, false, false];
}

export function saveWeekChecklist(weekNum, checks) {
  const data = loadData();
  const key = `2026-W${weekNum.toString().padStart(2, '0')}`;
  data.checklist[key] = checks;
  saveData(data);
}

export function getTimerConfig() {
  const data = loadData();
  return data.timerConfig;
}

export function saveTimerConfig(config) {
  const data = loadData();
  data.timerConfig = config;
  saveData(data);
}

export function getStats() {
  const data = loadData();
  return {
    totalMinutes: data.totalMinutes,
    totalSessions: data.totalSessions,
    streak: data.streak,
  };
}

// --- Firebase sync ---

export async function initFirebase(config) {
  const cfg = config || FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return false;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');

    firebaseApp = initializeApp(cfg);
    firebaseDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);

    return new Promise((resolve) => {
      onAuthStateChanged(firebaseAuth, (user) => {
        currentUser = user;
        if (user) {
          listenToFirebase();
        }
        resolve(!!user);
      });
    });
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return false;
  }
}

export async function autoInit() {
  const loggedIn = await initFirebase();
  return loggedIn;
}

export async function signIn() {
  if (!firebaseAuth) return false;
  try {
    const { signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    currentUser = result.user;
    listenToFirebase();
    syncToFirebase(loadData());
    return true;
  } catch (e) {
    console.warn('Sign in failed:', e);
    return false;
  }
}

export async function signOut() {
  if (!firebaseAuth) return;
  if (unsubscribe) unsubscribe();
  await firebaseAuth.signOut();
  currentUser = null;
}

async function syncToFirebase(data) {
  if (!firebaseDb || !currentUser) return;
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    await setDoc(doc(firebaseDb, 'users', currentUser.uid), {
      ...data,
      lastSync: Date.now(),
      email: currentUser.email,
    });
  } catch (e) {
    console.warn('Sync to Firebase failed:', e);
  }
}

async function listenToFirebase() {
  if (!firebaseDb || !currentUser) return;
  try {
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(doc(firebaseDb, 'users', currentUser.uid), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data();
      const local = loadData();
      if (remote.lastSync > (local.lastSync || 0)) {
        const merged = mergeData(local, remote);
        setLocal(merged);
        if (onSyncCallback) onSyncCallback(merged);
      }
    });
  } catch (e) {
    console.warn('Listen to Firebase failed:', e);
  }
}

function mergeData(local, remote) {
  const merged = { ...local };
  // Merge sessions (keep the one with more data)
  const allDates = new Set([...Object.keys(local.sessions || {}), ...Object.keys(remote.sessions || {})]);
  merged.sessions = {};
  for (const date of allDates) {
    merged.sessions[date] = { ...(local.sessions?.[date] || {}), ...(remote.sessions?.[date] || {}) };
  }
  // Take higher values for counters
  merged.totalMinutes = Math.max(local.totalMinutes || 0, remote.totalMinutes || 0);
  merged.totalSessions = Math.max(local.totalSessions || 0, remote.totalSessions || 0);
  merged.streak = Math.max(local.streak || 0, remote.streak || 0);
  // Merge checklists
  const allWeeks = new Set([...Object.keys(local.checklist || {}), ...Object.keys(remote.checklist || {})]);
  merged.checklist = {};
  for (const week of allWeeks) {
    const l = local.checklist?.[week] || [];
    const r = remote.checklist?.[week] || [];
    merged.checklist[week] = l.map((v, i) => v || r[i] || false);
  }
  merged.lastSync = Date.now();
  return merged;
}

export function onSync(callback) {
  onSyncCallback = callback;
}

export function getCurrentUser() {
  return currentUser;
}

export function isFirebaseConfigured() {
  return !!firebaseApp;
}
