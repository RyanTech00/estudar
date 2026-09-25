let wakeLock = null;

export async function enterFocusMode() {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch { /* user denied or unsupported */ }

  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* unsupported */ }

  document.body.classList.add('focus-active');
}

export async function exitFocusMode() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {}

  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {}

  document.body.classList.remove('focus-active');
}

export function isFocusActive() {
  return document.body.classList.contains('focus-active');
}

// Re-acquire wake lock on visibility change
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isFocusActive() && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {}
  }
});

// Detect fullscreen exit (e.g. user pressed Escape)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isFocusActive()) {
    document.body.classList.remove('focus-active');
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
    document.dispatchEvent(new CustomEvent('focusModeExit'));
  }
});

export function playSound(type = 'complete') {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'complete') {
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);      // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);  // G5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } else if (type === 'tick') {
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } else if (type === 'break') {
    osc.frequency.setValueAtTime(392, ctx.currentTime);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }
}
