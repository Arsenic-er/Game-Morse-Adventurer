import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CwAudioEngine } from "./audioEngine.js";
import { analyzeKeying } from "./inputAnalyzer.js";
import { automaticSymbolDuration, dotDurationFromWpm, encodeTextToEvents, pulsesToPlaybackEvents } from "./morse.js";

const EMPTY_ANALYSIS = Object.freeze({ decoded: "", morse: "", wpm: 18, dotMs: dotDurationFromWpm(18), accuracy: 0, rhythm: 0, pulseCount: 0 });

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useCwCore({ targetText = "CQ" } = {}) {
  const engineRef = useRef(null);
  const pulsesRef = useRef([]);
  const manualStartRef = useRef(null);
  const automaticTimerRef = useRef(null);
  const wpmRef = useRef(18);
  const [analysis, setAnalysis] = useState(EMPTY_ANALYSIS);
  const [isKeying, setIsKeying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toneActive, setToneActive] = useState(false);
  const [playbackMode, setPlaybackMode] = useState("rx");

  const engine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new CwAudioEngine();
    return engineRef.current;
  }, []);

  const appendPulse = useCallback((pulse) => {
    const nextPulses = [...pulsesRef.current, pulse].slice(-160);
    pulsesRef.current = nextPulses;
    const nextAnalysis = analyzeKeying(nextPulses, { fallbackWpm: wpmRef.current, targetText });
    wpmRef.current = nextAnalysis.wpm;
    setAnalysis(nextAnalysis);
  }, [targetText]);

  const stopPlayback = useCallback(() => {
    engineRef.current?.stopPlayback();
    setIsPlaying(false);
    setToneActive(false);
  }, []);

  const beginManual = useCallback(() => {
    if (manualStartRef.current !== null || automaticTimerRef.current) return;
    stopPlayback();
    manualStartRef.current = now();
    setPlaybackMode("tx");
    setIsKeying(true);
    setToneActive(true);
    engine().startSidetone().catch(() => {
      setToneActive(false);
      setIsKeying(false);
    });
  }, [engine, stopPlayback]);

  const endManual = useCallback(() => {
    if (manualStartRef.current === null) return;
    const downAt = manualStartRef.current;
    const upAt = Math.max(now(), downAt + 15);
    manualStartRef.current = null;
    engineRef.current?.stopSidetone();
    setToneActive(false);
    setIsKeying(false);
    appendPulse({ downAt, upAt, source: "manual" });
  }, [appendPulse]);

  const tapAutomatic = useCallback(async (symbol) => {
    if (![".", "-"].includes(symbol) || automaticTimerRef.current || manualStartRef.current !== null) return false;
    stopPlayback();
    const durationMs = automaticSymbolDuration(symbol, wpmRef.current);
    const request = Symbol(symbol);
    automaticTimerRef.current = request;
    setPlaybackMode("tx");
    setIsKeying(true);
    let toneStarted = false;
    if (!window.cwgameSystem?.qaCapture) {
      try {
        toneStarted = await engine().startSidetone();
      } catch {
        toneStarted = false;
      }
    }
    if (automaticTimerRef.current !== request) {
      engineRef.current?.stopSidetone();
      return false;
    }
    const downAt = now();
    setToneActive(toneStarted);
    automaticTimerRef.current = window.setTimeout(() => {
      automaticTimerRef.current = null;
      engineRef.current?.stopSidetone();
      setToneActive(false);
      setIsKeying(false);
      appendPulse({ downAt, upAt: downAt + durationMs, source: "automatic", symbol });
    }, durationMs);
    return true;
  }, [appendPulse, engine, stopPlayback]);

  const playEvents = useCallback(async (events, mode, channel) => {
    if (!events.length) return false;
    if (manualStartRef.current !== null) endManual();
    setPlaybackMode(mode);
    setIsPlaying(true);
    setToneActive(false);
    try {
      await engine().play(events, {
        onTone: setToneActive,
        onFinish: () => { setIsPlaying(false); setToneActive(false); },
        channel,
      });
      return true;
    } catch {
      setIsPlaying(false);
      setToneActive(false);
      return false;
    }
  }, [endManual, engine]);

  const playIncoming = useCallback((text = "CQ CQ DE K7QX K", wpm = 18, channel) => {
    const sequence = encodeTextToEvents(text, { wpm });
    return playEvents(sequence.events, "rx", channel);
  }, [playEvents]);

  const replayInput = useCallback(() => playEvents(pulsesToPlaybackEvents(pulsesRef.current), "tx"), [playEvents]);

  const clearInput = useCallback(() => {
    stopPlayback();
    pulsesRef.current = [];
    wpmRef.current = 18;
    setAnalysis(EMPTY_ANALYSIS);
  }, [stopPlayback]);

  const stopAll = useCallback(() => {
    if (typeof automaticTimerRef.current === "number") window.clearTimeout(automaticTimerRef.current);
    automaticTimerRef.current = null;
    manualStartRef.current = null;
    engineRef.current?.stopAll();
    setIsKeying(false);
    setIsPlaying(false);
    setToneActive(false);
  }, []);

  useEffect(() => () => {
    if (typeof automaticTimerRef.current === "number") window.clearTimeout(automaticTimerRef.current);
    engineRef.current?.dispose();
  }, []);

  const status = useMemo(() => {
    if (isKeying) return "keying";
    if (isPlaying) return playbackMode === "tx" ? "replay" : "playing";
    if (analysis.pulseCount) return "captured";
    return "ready";
  }, [analysis.pulseCount, isKeying, isPlaying, playbackMode]);

  return {
    analysis,
    beginManual,
    clearInput,
    endManual,
    isKeying,
    isPlaying,
    isTransmitting: toneActive && (isKeying || (isPlaying && playbackMode === "tx")),
    playIncoming,
    replayInput,
    status,
    stopAll,
    tapAutomatic,
    toneActive,
  };
}
