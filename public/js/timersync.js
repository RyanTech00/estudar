// The running timer, shared between devices through the synced document.
// The timer is wall-clock based (endsAt is an absolute timestamp), so another device can pick it up as is.
// Only one device logs a block when it ends: the one that last touched the timer (the driver).
// Pure rules, no DOM.

const PHASES = ['work', 'break', 'longBreak'];
const STATES = ['idle', 'running', 'paused'];
const num = (v, min, max) => (Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null);

// Everything that comes from another device goes through here (also used by cleanDocument).
export function cleanSharedTimer(t) {
  if (!t || typeof t !== 'object' || !PHASES.includes(t.phase) || !STATES.includes(t.state)) return null;
  const at = num(t.at, 0, 8.64e15);
  if (!at) return null;
  const minutes = num(t.probe?.minutes, 5, 180);
  return {
    phase: t.phase,
    state: t.state,
    endsAt: num(t.endsAt, 0, 8.64e15) || 0,
    remainingMs: num(t.remainingMs, 0, 4 * 3600000) || 0,
    sessionsCompleted: Math.round(num(t.sessionsCompleted, 0, 999) || 0),
    subject: typeof t.subject === 'string' && /^[\w-]{1,40}$/.test(t.subject) ? t.subject : null,
    probe: minutes ? { minutes: Math.round(minutes) } : null,
    device: typeof t.device === 'string' && /^[\w-]{1,40}$/.test(t.device) ? t.device : '',
    at,
  };
}

// Two copies of the shared timer (two devices, or local and remote): the latest change wins.
export function newerTimer(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return (b.at || 0) > (a.at || 0) ? b : a;
}

// What identifies a timer state; the same state seen again (an echo of our own change) is not re-applied.
export const timerKey = (t) => (t ? JSON.stringify([t.phase, t.state, t.endsAt, t.remainingMs, t.sessionsCompleted, t.subject, t.probe?.minutes || 0]) : '');

// Device clocks drift apart by a second or more. The shared copy keeps its times on the server's clock;
// `offset` is serverTime - localTime on this device (see clockOffset), so both devices end on the same instant.
export const toServerClock = (state, offset) => ({ ...state, endsAt: state.endsAt ? state.endsAt + offset : 0 });
export const toLocalClock = (state, offset) => ({ ...state, endsAt: state.endsAt ? state.endsAt - offset : 0 });

// Best of a few round trips: the one with the shortest trip has the least uncertainty (NTP's idea).
// `samples` are [sentAt, serverNow, receivedAt] in each clock.
export function clockOffset(samples) {
  const ok = samples.filter(([a, s, b]) => [a, s, b].every(Number.isFinite) && b >= a);
  if (!ok.length) return 0;
  const [a, s, b] = ok.reduce((best, x) => (x[2] - x[0] < best[2] - best[0] ? x : best));
  return Math.round(s - (a + b) / 2);
}

// Does this device log the block when it ends? Yes if it drives the timer, or nobody does.
export const drivesTimer = (shared, deviceId) => !shared?.device || shared.device === deviceId;
