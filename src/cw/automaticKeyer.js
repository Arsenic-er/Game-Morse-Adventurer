import { automaticSymbolDuration, dotDurationFromWpm } from "./morse.js";

export const DEFAULT_AUTOMATIC_KEY_WPM = 18;
export const MIN_AUTOMATIC_KEY_WPM = 5;
export const MAX_AUTOMATIC_KEY_WPM = 40;

export function normalizeAutomaticKeyWpm(value) {
  if (value === null || value === undefined || value === "") return DEFAULT_AUTOMATIC_KEY_WPM;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AUTOMATIC_KEY_WPM;
  return Math.round(Math.min(MAX_AUTOMATIC_KEY_WPM, Math.max(MIN_AUTOMATIC_KEY_WPM, numeric)));
}

function validSymbol(symbol) {
  return symbol === "." || symbol === "-";
}

export class AutomaticKeyer {
  constructor({
    getWpm = () => DEFAULT_AUTOMATIC_KEY_WPM,
    now = () => performance.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
    onElementStart = () => {},
    onElementEnd = () => {},
    onPulse = () => {},
    onSessionChange = () => {},
  } = {}) {
    this.getWpm = getWpm;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onElementStart = onElementStart;
    this.onElementEnd = onElementEnd;
    this.onPulse = onPulse;
    this.onSessionChange = onSessionChange;
    this.held = new Set();
    this.pendingPresses = new Set();
    this.queue = [];
    this.phase = "idle";
    this.timer = null;
    this.active = null;
    this.lastSymbol = null;
    this.token = 0;
  }

  isBusy() {
    return this.phase !== "idle";
  }

  begin(symbol) {
    if (!validSymbol(symbol)) return false;
    const wasHeld = this.held.has(symbol);
    this.held.add(symbol);
    if (!wasHeld) this.pendingPresses.add(symbol);
    if (!wasHeld && this.phase === "idle") this.startNext();
    return true;
  }

  end(symbol) {
    if (!validSymbol(symbol)) return false;
    this.held.delete(symbol);
    if (this.pendingPresses.delete(symbol)) {
      this.queue.push(symbol);
      if (this.phase === "idle") this.startNext();
    }
    return true;
  }

  tap(symbol) {
    if (!validSymbol(symbol)) return false;
    this.queue.push(symbol);
    if (this.phase === "idle") this.startNext();
    return true;
  }

  stop() {
    this.token += 1;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (this.phase === "tone" && this.active) {
      this.onElementEnd({ ...this.active, cancelled: true });
    }
    const wasBusy = this.phase !== "idle";
    this.held.clear();
    this.pendingPresses.clear();
    this.queue = [];
    this.phase = "idle";
    this.active = null;
    if (wasBusy) this.onSessionChange(false);
  }

  chooseNextSymbol() {
    if (this.queue.length) return this.queue.shift();
    if (!this.held.size) return null;
    const symbol = this.held.size === 2
      ? (this.lastSymbol === "." ? "-" : ".")
      : this.held.values().next().value;
    this.pendingPresses.delete(symbol);
    return symbol;
  }

  startNext() {
    const symbol = this.chooseNextSymbol();
    if (!symbol) {
      const wasBusy = this.phase !== "idle";
      this.phase = "idle";
      this.timer = null;
      this.active = null;
      if (wasBusy) this.onSessionChange(false);
      return;
    }

    const wpm = normalizeAutomaticKeyWpm(this.getWpm());
    const durationMs = automaticSymbolDuration(symbol, wpm);
    const downAt = this.now();
    const token = ++this.token;
    const wasIdle = this.phase === "idle";
    this.phase = "tone";
    this.active = { token, symbol, downAt, durationMs, wpm };
    this.lastSymbol = symbol;
    if (wasIdle) this.onSessionChange(true);
    this.onElementStart(this.active);
    this.timer = this.setTimer(() => this.finishElement(token), durationMs);
  }

  finishElement(token) {
    if (this.phase !== "tone" || !this.active || this.active.token !== token) return;
    const pulse = {
      downAt: this.active.downAt,
      upAt: this.active.downAt + this.active.durationMs,
      source: "automatic",
      symbol: this.active.symbol,
    };
    this.onElementEnd(this.active);
    this.onPulse(pulse);
    const gapMs = dotDurationFromWpm(this.active.wpm);
    this.phase = "gap";
    this.active = null;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.startNext();
    }, gapMs);
  }
}
