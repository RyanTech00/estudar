export class Timer {
  constructor(onTick, onComplete, onPhaseChange) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.onPhaseChange = onPhaseChange;
    this.interval = null;
    this.remaining = 0;
    this.total = 0;
    this.running = false;
    this.paused = false;
    this.currentPhase = 'work'; // 'work' | 'break' | 'longBreak'
    this.sessionsCompleted = 0;
    this.config = {
      work: 25 * 60,
      break: 5 * 60,
      longBreak: 15 * 60,
      sessionsBeforeLong: 4,
    };
  }

  configure(opts) {
    Object.assign(this.config, opts);
  }

  start(phase = 'work') {
    this.currentPhase = phase;
    this.total = this.config[phase];
    this.remaining = this.total;
    this.running = true;
    this.paused = false;
    this._tick();
    this.interval = setInterval(() => this._tick(), 1000);
    if (this.onPhaseChange) this.onPhaseChange(phase, this.sessionsCompleted);
  }

  _tick() {
    if (this.paused) return;
    this.remaining--;
    const progress = 1 - (this.remaining / this.total);
    if (this.onTick) this.onTick(this.remaining, progress, this.currentPhase);
    if (this.remaining <= 0) {
      this.stop();
      this._onPhaseComplete();
    }
  }

  _onPhaseComplete() {
    if (this.currentPhase === 'work') {
      this.sessionsCompleted++;
      const nextPhase = (this.sessionsCompleted % this.config.sessionsBeforeLong === 0)
        ? 'longBreak' : 'break';
      if (this.onComplete) this.onComplete(this.currentPhase, this.sessionsCompleted, nextPhase);
    } else {
      if (this.onComplete) this.onComplete(this.currentPhase, this.sessionsCompleted, 'work');
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
    return this.paused;
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    this.paused = false;
  }

  reset() {
    this.stop();
    this.sessionsCompleted = 0;
    this.remaining = 0;
    this.total = 0;
  }

  skip() {
    this.stop();
    this._onPhaseComplete();
  }

  get isRunning() { return this.running && !this.paused; }
  get isPaused() { return this.running && this.paused; }
  get isStopped() { return !this.running; }

  static formatTime(seconds) {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
