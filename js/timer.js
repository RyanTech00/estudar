// Wall-clock based: mobile browsers throttle intervals in the background, so we derive
// the remaining time from a target timestamp instead of counting ticks.
export class Timer {
  constructor({ onTick, onPhaseEnd } = {}) {
    this.onTick = onTick;
    this.onPhaseEnd = onPhaseEnd;
    this.config = { work: 40 * 60, break: 10 * 60, longBreak: 15 * 60, sessionsBeforeLong: 4 };
    this.phase = 'work';
    this.sessionsCompleted = 0;
    this.state = 'idle'; // 'idle' | 'running' | 'paused'
    this.endsAt = 0;
    this.remainingMs = this.config.work * 1000;
    this.interval = null;
  }

  configure(opts) {
    Object.assign(this.config, opts);
    if (this.state === 'idle') this.remainingMs = this.config[this.phase] * 1000;
  }

  get total() { return this.config[this.phase] * 1000; }
  get remaining() {
    const ms = this.state === 'running' ? this.endsAt - Date.now() : this.remainingMs;
    return Math.max(0, Math.ceil(ms / 1000));
  }
  get progress() { return 1 - (this.remaining * 1000) / this.total; }
  get isRunning() { return this.state === 'running'; }
  get isPaused() { return this.state === 'paused'; }
  get isIdle() { return this.state === 'idle'; }

  start() {
    if (this.state === 'running') return;
    if (this.state === 'idle') this.remainingMs = this.total;
    this.endsAt = Date.now() + this.remainingMs;
    this.state = 'running';
    clearInterval(this.interval);
    this.interval = setInterval(() => this._tick(), 250);
    this._tick();
  }

  pause() {
    if (this.state !== 'running') return;
    this.remainingMs = this.endsAt - Date.now();
    this.state = 'paused';
    clearInterval(this.interval);
    this._emit();
  }

  toggle() {
    if (this.state === 'running') this.pause();
    else this.start();
  }

  // Ends the current phase now and moves to the next one (without starting it).
  skip() {
    this._finish(false);
  }

  reset() {
    clearInterval(this.interval);
    this.state = 'idle';
    this.phase = 'work';
    this.sessionsCompleted = 0;
    this.remainingMs = this.total;
    this._emit();
  }

  _tick() {
    if (this.state === 'running' && this.endsAt - Date.now() <= 0) {
      this._finish(true);
      return;
    }
    this._emit();
  }

  _finish(natural) {
    clearInterval(this.interval);
    const finished = this.phase;
    const workedSeconds = finished === 'work'
      ? Math.round((this.total - (this.state === 'running' ? Math.max(0, this.endsAt - Date.now()) : this.remainingMs)) / 1000)
      : 0;

    if (finished === 'work') {
      this.sessionsCompleted++;
      this.phase = this.sessionsCompleted % this.config.sessionsBeforeLong === 0 ? 'longBreak' : 'break';
    } else {
      this.phase = 'work';
    }
    this.state = 'idle';
    this.remainingMs = this.total;
    if (this.onPhaseEnd) this.onPhaseEnd({ finished, next: this.phase, natural, workedSeconds });
    this._emit();
  }

  _emit() {
    if (this.onTick) this.onTick(this);
  }

  snapshot() {
    return { phase: this.phase, state: this.state, endsAt: this.endsAt, remainingMs: this.remainingMs, sessionsCompleted: this.sessionsCompleted };
  }

  restore(s) {
    if (!s || !['idle', 'running', 'paused'].includes(s.state)) return;
    Object.assign(this, { phase: s.phase, state: s.state, endsAt: s.endsAt, remainingMs: s.remainingMs, sessionsCompleted: s.sessionsCompleted });
    if (this.state === 'running') {
      clearInterval(this.interval);
      this.interval = setInterval(() => this._tick(), 250);
    }
    this._tick();
  }

  static format(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
