export const FIXED_TONE_HZ = 650;

export class CwAudioEngine {
  constructor() {
    this.context = null;
    this.playback = null;
    this.sidetone = null;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported in this environment.");
      this.context = new AudioContextClass();
    }
    return this.context;
  }

  async resume() {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 500)),
      ]);
    }
    return context;
  }

  stopPlayback(notify = true) {
    if (!this.playback) return;
    const { oscillator, sources = [], timers, finishTimer, onTone, onFinish, resolve } = this.playback;
    this.playback = null;
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearTimeout(finishTimer);
    for (const source of sources.length ? sources : [oscillator]) {
      try { source?.stop(); } catch { /* already stopped */ }
    }
    if (notify) {
      onTone?.(false);
      onFinish?.();
      resolve?.({ stopped: true });
    }
  }

  async play(events, { onTone, onFinish, channel = {} } = {}) {
    this.stopPlayback();
    const usableEvents = (events ?? []).filter((event) => Number.isFinite(event.durationMs) && event.durationMs > 0);
    if (!usableEvents.length) return { stopped: false, durationMs: 0 };
    const context = await this.resume();
    if (context.state !== "running") return this.playTimerFallback(usableEvents, { onTone, onFinish });
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const channelGain = context.createGain();
    const signalGain = Number.isFinite(channel.signalGain) ? channel.signalGain : 1;
    const qsbDepth = Math.min(.95, Math.max(0, Number(channel.qsbDepth) || 0));
    oscillator.type = "sine";
    oscillator.frequency.value = (Number(channel.toneHz) || FIXED_TONE_HZ) + (Number(channel.frequencyOffsetHz) || 0);
    gain.gain.value = 0;
    channelGain.gain.value = signalGain * (1 - qsbDepth / 2);
    oscillator.connect(gain).connect(channelGain).connect(context.destination);

    const sources = [oscillator];
    if (qsbDepth > 0) {
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.type = "sine";
      lfo.frequency.value = Number(channel.qsbRateHz) || .3;
      lfoGain.gain.value = signalGain * qsbDepth / 2;
      lfo.connect(lfoGain).connect(channelGain.gain);
      sources.push(lfo);
    }

    const startAt = context.currentTime + 0.035;
    const timers = [];
    let cursorMs = 0;
    gain.gain.setValueAtTime(0, startAt);
    usableEvents.forEach((event) => {
      const eventStart = startAt + cursorMs / 1000;
      const eventEnd = eventStart + event.durationMs / 1000;
      if (event.type === "tone") {
        const attackEnd = Math.min(eventEnd, eventStart + 0.004);
        const releaseStart = Math.max(attackEnd, eventEnd - 0.004);
        gain.gain.setValueAtTime(0, eventStart);
        gain.gain.linearRampToValueAtTime(0.18, attackEnd);
        gain.gain.setValueAtTime(0.18, releaseStart);
        gain.gain.linearRampToValueAtTime(0, eventEnd);
        timers.push(window.setTimeout(() => onTone?.(true), 35 + cursorMs));
        timers.push(window.setTimeout(() => onTone?.(false), 35 + cursorMs + event.durationMs));
      }
      cursorMs += event.durationMs;
    });
    oscillator.start(startAt);
    oscillator.stop(startAt + cursorMs / 1000 + 0.02);
    if (sources[1]) {
      sources[1].start(startAt);
      sources[1].stop(startAt + cursorMs / 1000 + 0.02);
    }

    if ((Number(channel.noiseGain) || 0) > 0) {
      const frameCount = Math.ceil((cursorMs / 1000 + .08) * context.sampleRate);
      const noiseBuffer = context.createBuffer(1, frameCount, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      const noiseGain = context.createGain();
      noise.buffer = noiseBuffer;
      noiseGain.gain.value = Math.min(.2, Number(channel.noiseGain) * .22);
      noise.connect(noiseGain).connect(context.destination);
      noise.start(startAt);
      noise.stop(startAt + cursorMs / 1000 + .02);
      sources.push(noise);
    }

    return new Promise((resolve) => {
      let completed = false;
      const complete = () => {
        if (completed) return;
        completed = true;
        if (this.playback?.oscillator !== oscillator) return;
        timers.forEach((timer) => window.clearTimeout(timer));
        window.clearTimeout(this.playback.finishTimer);
        this.playback = null;
        onTone?.(false);
        onFinish?.();
        resolve({ stopped: false, durationMs: cursorMs });
      };
      const finishTimer = window.setTimeout(complete, 100 + cursorMs);
      oscillator.addEventListener("ended", complete, { once: true });
      this.playback = { oscillator, sources, gain, timers, finishTimer, onTone, onFinish, resolve, complete };
    });
  }

  playTimerFallback(events, { onTone, onFinish } = {}) {
    const timers = [];
    const token = {};
    let cursorMs = 0;
    events.forEach((event) => {
      if (event.type === "tone") {
        timers.push(window.setTimeout(() => onTone?.(true), cursorMs));
        timers.push(window.setTimeout(() => onTone?.(false), cursorMs + event.durationMs));
      }
      cursorMs += event.durationMs;
    });
    return new Promise((resolve) => {
      const finishTimer = window.setTimeout(() => {
        if (this.playback?.token !== token) return;
        this.playback = null;
        onTone?.(false);
        onFinish?.();
        resolve({ stopped: false, durationMs: cursorMs, silentFallback: true });
      }, cursorMs + 30);
      this.playback = { token, oscillator: null, sources: [], gain: null, timers, finishTimer, onTone, onFinish, resolve };
    });
  }

  async startSidetone() {
    if (this.sidetone) return true;
    this.stopPlayback();
    const context = await this.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = FIXED_TONE_HZ;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, context.currentTime + 0.004);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    this.sidetone = { oscillator, gain };
    return true;
  }

  stopSidetone() {
    if (!this.sidetone || !this.context) return;
    const { oscillator, gain } = this.sidetone;
    const stopAt = this.context.currentTime + 0.006;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, stopAt);
    try { oscillator.stop(stopAt + 0.002); } catch { /* already stopped */ }
    this.sidetone = null;
  }

  stopAll() {
    this.stopSidetone();
    this.stopPlayback();
  }

  async dispose() {
    this.stopAll();
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.context = null;
  }
}
