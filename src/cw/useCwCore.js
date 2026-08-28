import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CwAudioEngine } from "./audioEngine.js";
import { AutomaticKeyer, normalizeAutomaticKeyWpm } from "./automaticKeyer.js";
import { analyzeKeying, detectClearInputGesture } from "./inputAnalyzer.js";
import { dotDurationFromWpm, encodeTextToEvents, pulsesToPlaybackEvents } from "./morse.js";

const EMPTY_ANALYSIS = Object.freeze({ decoded: "", morse: "", wpm: 18, dotMs: dotDurationFromWpm(18), accuracy: 0, rhythm: 0, pulseCount: 0 });
const MAX_CW_INPUT_PULSES = 256;

export function appendCwInputPulse(pulses, pulse) {
  return [...pulses, pulse].slice(-MAX_CW_INPUT_PULSES);
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useCwCore({ targetText = "CQ", automaticWpm = 18, clearGestureLength = 0 } = {}) {
  const engineRef = useRef(null);
  const pulsesRef = useRef([]);
  const manualStartRef = useRef(null);
  const automaticKeyerRef = useRef(null);
  const automaticTokenRef = useRef(null);
  const listeningTokenRef = useRef(null);
  const automaticWpmRef = useRef(normalizeAutomaticKeyWpm(automaticWpm));
  const detectedWpmRef = useRef(18);
  const appendPulseRef = useRef(null);
  const [analysis, setAnalysis] = useState(EMPTY_ANALYSIS);
  const [isKeying, setIsKeying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toneActive, setToneActive] = useState(false);
  const [playbackMode, setPlaybackMode] = useState("rx");

  const engine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new CwAudioEngine();
    return engineRef.current;
  }, []);

  const appendPulse = useCallback((pulse) => {
    const nextPulses = appendCwInputPulse(pulsesRef.current, pulse);
    pulsesRef.current = nextPulses;
    const fallbackWpm = pulse.source === "automatic" ? automaticWpmRef.current : detectedWpmRef.current;
    const nextAnalysis = analyzeKeying(nextPulses, { fallbackWpm, targetText });
    const clearGesture = clearGestureLength > 0
      ? detectClearInputGesture(nextPulses, { analysis: nextAnalysis, threshold: clearGestureLength })
      : null;
    if (clearGesture) {
      pulsesRef.current = [];
      detectedWpmRef.current = 18;
      setAnalysis(EMPTY_ANALYSIS);
      if (pulse.source === "automatic") {
        window.setTimeout(() => automaticKeyerRef.current?.stop(), 0);
      }
      return;
    }
    if (pulse.source !== "automatic") detectedWpmRef.current = nextAnalysis.wpm;
    setAnalysis(nextAnalysis);
  }, [clearGestureLength, targetText]);
  appendPulseRef.current = appendPulse;

  useEffect(() => {
    automaticWpmRef.current = normalizeAutomaticKeyWpm(automaticWpm);
  }, [automaticWpm]);

  const stopPlayback = useCallback(() => {
    engineRef.current?.stopPlayback();
    setIsPlaying(false);
    setToneActive(false);
  }, []);

  const beginManual = useCallback(() => {
    if (manualStartRef.current !== null || automaticKeyerRef.current?.isBusy()) return;
    stopPlayback();
    manualStartRef.current = now();
    setPlaybackMode("tx");
    setIsKeying(true);
    setToneActive(true);
    engine().startSidetone().catch(() => {
      engineRef.current?.setReceiverNoiseMuted(false);
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

  const ensureAutomaticKeyer = useCallback(() => {
    if (automaticKeyerRef.current) return automaticKeyerRef.current;
    automaticKeyerRef.current = new AutomaticKeyer({
      getWpm: () => automaticWpmRef.current,
      now,
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (timer) => window.clearTimeout(timer),
      onSessionChange: setIsKeying,
      onElementStart: ({ token }) => {
        automaticTokenRef.current = token;
        setPlaybackMode("tx");
        if (window.cwgameSystem?.qaCapture) {
          setToneActive(true);
          return;
        }
        engine().startSidetone().then((started) => {
          if (automaticTokenRef.current !== token) {
            engineRef.current?.stopSidetone();
            return;
          }
          setToneActive(Boolean(started));
        }).catch(() => {
          engineRef.current?.setReceiverNoiseMuted(false);
          if (automaticTokenRef.current === token) setToneActive(false);
        });
      },
      onElementEnd: ({ token }) => {
        if (automaticTokenRef.current !== token) return;
        automaticTokenRef.current = null;
        engineRef.current?.stopSidetone();
        setToneActive(false);
      },
      onPulse: (pulse) => appendPulseRef.current?.(pulse),
    });
    return automaticKeyerRef.current;
  }, [engine]);

  const beginAutomatic = useCallback((symbol) => {
    if (manualStartRef.current !== null) return false;
    stopPlayback();
    return ensureAutomaticKeyer().begin(symbol);
  }, [ensureAutomaticKeyer, stopPlayback]);

  const endAutomatic = useCallback((symbol) => ensureAutomaticKeyer().end(symbol), [ensureAutomaticKeyer]);

  const tapAutomatic = useCallback((symbol) => {
    if (manualStartRef.current !== null) return false;
    stopPlayback();
    return ensureAutomaticKeyer().tap(symbol);
  }, [ensureAutomaticKeyer, stopPlayback]);

  const playEvents = useCallback(async (events, mode, channel) => {
    if (!events.length) return false;
    if (manualStartRef.current !== null) endManual();
    automaticKeyerRef.current?.stop();
    setPlaybackMode(mode);
    setIsPlaying(true);
    setToneActive(false);
    if (mode === "tx") engineRef.current?.setReceiverNoiseMuted(true);
    try {
      const result = await engine().play(events, {
        onTone: setToneActive,
        onFinish: () => { setIsPlaying(false); setToneActive(false); },
        channel,
      });
      return !result?.stopped;
    } catch {
      setIsPlaying(false);
      setToneActive(false);
      return false;
    } finally {
      if (mode === "tx") engineRef.current?.setReceiverNoiseMuted(false);
    }
  }, [endManual, engine]);

  const playIncoming = useCallback((text = "CQ CQ DE K7QX K", wpm = 18, channel) => {
    const sequence = encodeTextToEvents(text, { wpm });
    return playEvents(sequence.events, "rx", channel);
  }, [playEvents]);

  const playIncomingLayers = useCallback(async (layers) => {
    if (!Array.isArray(layers) || !layers.length) return false;
    if (manualStartRef.current !== null) endManual();
    automaticKeyerRef.current?.stop();
    setPlaybackMode("rx");
    setIsPlaying(true);
    setToneActive(false);
    try {
      const result = await engine().playLayers(layers, {
        onTone: setToneActive,
        onFinish: () => { setIsPlaying(false); setToneActive(false); },
      });
      return !result?.stopped;
    } catch {
      setIsPlaying(false);
      setToneActive(false);
      return false;
    }
  }, [endManual, engine]);

  const replayInput = useCallback(() => playEvents(pulsesToPlaybackEvents(pulsesRef.current), "tx"), [playEvents]);

  const startListening = useCallback(async (channel) => {
    const token = Symbol("receiver-listening");
    listeningTokenRef.current = token;
    if (window.cwgameSystem?.qaCapture) {
      setIsListening(true);
      return true;
    }
    try {
      const started = await engine().startReceiverNoise(channel);
      if (listeningTokenRef.current !== token) {
        if (listeningTokenRef.current === null) engineRef.current?.stopReceiverNoise();
        return false;
      }
      setIsListening(Boolean(started));
      return Boolean(started);
    } catch {
      if (listeningTokenRef.current === token) setIsListening(false);
      return false;
    }
  }, [engine]);

  const stopListening = useCallback(() => {
    listeningTokenRef.current = null;
    engineRef.current?.stopReceiverNoise();
    setIsListening(false);
  }, []);

  const clearInput = useCallback(() => {
    stopPlayback();
    automaticKeyerRef.current?.stop();
    engineRef.current?.stopSidetone();
    pulsesRef.current = [];
    detectedWpmRef.current = 18;
    setAnalysis(EMPTY_ANALYSIS);
  }, [stopPlayback]);

  const stopAll = useCallback(() => {
    automaticKeyerRef.current?.stop();
    automaticTokenRef.current = null;
    manualStartRef.current = null;
    engineRef.current?.stopAll();
    setIsKeying(false);
    setIsPlaying(false);
    setToneActive(false);
  }, []);

  useEffect(() => () => {
    automaticKeyerRef.current?.stop();
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
    beginAutomatic,
    beginManual,
    clearInput,
    endAutomatic,
    endManual,
    isKeying,
    isListening,
    isPlaying,
    isTransmitting: toneActive && (isKeying || (isPlaying && playbackMode === "tx")),
    playIncoming,
    playIncomingLayers,
    replayInput,
    status,
    startListening,
    stopAll,
    stopListening,
    tapAutomatic,
    toneActive,
  };
}
