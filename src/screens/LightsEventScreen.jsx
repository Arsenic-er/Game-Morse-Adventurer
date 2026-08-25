import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Broadcast, Eraser, FloppyDisk, Headphones, Radio, Repeat, Timer, Trophy,
} from "@phosphor-icons/react";
import { useCwCore } from "../cw/useCwCore.js";
import { CLEAR_INPUT_GESTURE_LENGTH } from "../cw/inputAnalyzer.js";
import { lightsRegionForLocation } from "../game/lightsEventCatalog.js";
import { getLocation } from "../game/locations.js";
import { stationCalendarDate } from "../game/worldCalendar.js";
import { lightsPileupPlaybackLayers } from "../game/lightsPileup.js";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, currentLightsPileup,
  restartLightsControl, submitLightsTransmission, tickLightsRun,
} from "../game/lightsRun.js";
import {
  activityUnloadRisk, advanceLightsActiveClock, lightsAnnualStampLabel, lightsExitNeedsConfirmation, lightsRunSeed, lightsTimerShouldRun, lightsUiModel,
} from "../game/lightsUiModel.js";
import { lightsText } from "./lightsEventText.js";

function expectedPlayerText(run) {
  if (run.phase === LIGHTS_PHASES.CHASE_PLAYER_CALL) return `SIM5LT DE ${run.playerCallsign} K`;
  if (run.phase === LIGHTS_PHASES.CHASE_PLAYER_REPORT) return `SIM5LT DE ${run.playerCallsign} RST 579 ${run.playerRegion} K`;
  if (run.phase === LIGHTS_PHASES.CONTROL_CQ) return "CQ LGT CQ LGT DE SIM5LT K";
  if (run.phase === LIGHTS_PHASES.CONTROL_SELECTION) return `${currentLightsPileup(run)?.callers?.[0]?.callsign ?? ""} K`;
  if (run.phase === LIGHTS_PHASES.CONTROL_PLAYER_REPORT) return `${run.selectedCaller?.callsign ?? ""} DE SIM5LT RST 579 ${run.playerRegion} K`;
  return "";
}

export function LightsEventScreen({ language, mode, save, inputBlocked = false, onActivityRisk, onSettle, onBack }) {
  const t = lightsText(language);
  const [run, setRun] = useState(() => {
    const startedAt = new Date();
    const stationDate = stationCalendarDate(startedAt, getLocation(save.locationId).timeZone);
    return createLightsRun({
      mode,
      playerCallsign: save.callsign,
      playerRegion: lightsRegionForLocation(save.locationId),
      guidance: save.qsoGuidance,
      seed: lightsRunSeed({ saveId: save.id, mode, stationDate, startedAt }),
      startedAt,
    });
  });
  const [playbackRetry, setPlaybackRetry] = useState(0);
  const [settlement, setSettlement] = useState(null);
  const [windowActive, setWindowActive] = useState(true);
  const playbackKeyRef = useRef(null);
  const activeClockRef = useRef({ elapsedMs: 0, monotonicNow: null, active: false });
  const inputRef = useRef(null);
  const model = useMemo(() => lightsUiModel(run, language), [language, run]);
  const unloadRisk = activityUnloadRisk({ activity: "lights", run, settled: Boolean(settlement) });
  const annualStampLabel = lightsAnnualStampLabel(settlement, language);
  const targetText = expectedPlayerText(run);
  const cw = useCwCore({
    targetText,
    automaticWpm: save.automaticKeyWpm,
    clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH,
  });

  useEffect(() => {
    if (inputBlocked || !windowActive) return undefined;
    cw.startListening({ noiseGain: 0.06, noiseFilterCenterHz: 650, noiseFilterQ: 1.4 });
    return () => cw.stopListening();
  }, [cw.startListening, cw.stopListening, inputBlocked, windowActive]);

  useEffect(() => {
    if (!inputBlocked) return;
    playbackKeyRef.current = null;
    cw.stopAll();
  }, [cw.stopAll, inputBlocked]);

  useEffect(() => {
    onActivityRisk?.(unloadRisk);
    return () => onActivityRisk?.("none");
  }, [onActivityRisk, unloadRisk]);

  useEffect(() => {
    if (!model.needsPlayback || inputBlocked || !windowActive) return undefined;
    const activePhase = run.phase;
    const playbackKey = `${activePhase}:${run.round}:${run.recoveryRequests}:${run.agnRequestCount}:${run.playbackCallers?.map(({ callsign }) => callsign).join(",")}`;
    if (playbackKeyRef.current === playbackKey) return undefined;
    playbackKeyRef.current = playbackKey;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const played = window.cwgameSystem?.qaCapture ? true : model.needsLayeredPlayback
        ? await cw.playIncomingLayers(lightsPileupPlaybackLayers(currentLightsPileup(run)))
        : await cw.playIncoming(model.incomingText, run.phase.startsWith("CHASE") ? run.chaseWpm : 18, {
            noiseGain: 0.05, signalGain: 0.85, qsbDepth: 0.16, toneHz: 650,
          });
      if (cancelled) return;
      if (!played) {
        playbackKeyRef.current = null;
        window.setTimeout(() => setPlaybackRetry((value) => value + 1), 1200);
        return;
      }
      setRun((current) => current.phase === activePhase ? advanceLightsPlayback(current) : current);
      cw.clearInput();
    }, window.cwgameSystem?.qaCapture ? 20 : 260);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cw.clearInput, cw.playIncoming, cw.playIncomingLayers, inputBlocked, model.incomingText,
    model.needsLayeredPlayback, model.needsPlayback, playbackRetry, run, windowActive]);

  useEffect(() => {
    const active = lightsTimerShouldRun({ phase: run.phase, inputBlocked, windowActive });
    const baseline = performance.now();
    if (!active) {
      activeClockRef.current = {
        ...activeClockRef.current,
        monotonicNow: baseline,
        active: false,
      };
      return undefined;
    }
    activeClockRef.current = { elapsedMs: run.elapsedMs, monotonicNow: baseline, active: true };
    const timer = window.setInterval(() => {
      const previous = activeClockRef.current;
      const next = advanceLightsActiveClock(previous, performance.now());
      activeClockRef.current = next;
      const elapsedMs = next.elapsedMs - previous.elapsedMs;
      if (elapsedMs > 0) setRun((current) => tickLightsRun(current, elapsedMs));
    }, 250);
    return () => window.clearInterval(timer);
  }, [inputBlocked, run.phase, windowActive]);

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState !== "hidden") setWindowActive(true);
    }
    function onInactive() {
      playbackKeyRef.current = null;
      setWindowActive(false);
      cw.stopAll();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") onInactive();
      else if (document.hasFocus()) onFocus();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onInactive);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onInactive);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cw.stopAll]);

  const transmit = useCallback(() => {
    if (!model.canTransmit || !cw.analysis.pulseCount || cw.isKeying || cw.isPlaying || inputBlocked) return;
    const next = submitLightsTransmission(run, cw.analysis.decoded);
    setRun(next);
    if (next.phase !== run.phase || !next.lastError) cw.clearInput();
  }, [cw.analysis.decoded, cw.analysis.pulseCount, cw.clearInput, cw.isKeying, cw.isPlaying, inputBlocked, model.canTransmit, run]);

  const clear = useCallback(() => {
    cw.clearInput();
    setRun((current) => current.lastError ? { ...current, lastError: null } : current);
  }, [cw.clearInput]);

  inputRef.current = { canTransmit: model.canTransmit, inputBlocked, keyType: save.keyType, transmit };
  useEffect(() => {
    function onDown(event) {
      const state = inputRef.current;
      if (!state || state.inputBlocked) return;
      if (["Space", "KeyZ", "KeyX", "F2"].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === "F2") { state.transmit(); return; }
      if (!state.canTransmit) return;
      if (state.keyType === "manual" && event.code === "Space") cw.beginManual();
      if (state.keyType === "automatic" && event.code === "KeyZ") cw.beginAutomatic(".");
      if (state.keyType === "automatic" && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function onUp(event) {
      if (save.keyType === "manual" && event.code === "Space") cw.endManual();
      if (save.keyType === "automatic" && event.code === "KeyZ") cw.endAutomatic(".");
      if (save.keyType === "automatic" && event.code === "KeyX") cw.endAutomatic("-");
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      cw.stopAll();
    };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, save.keyType]);

  function leave() {
    if (lightsExitNeedsConfirmation(run, { settled: Boolean(settlement) }) && !window.confirm(t.leaveConfirm)) return;
    cw.stopAll();
    onBack();
  }

  function settle() {
    if (!model.result || settlement) return;
    const transaction = onSettle(model.result);
    if (transaction?.settled) setSettlement(transaction);
  }

  function retryControl() {
    if (!model.result || model.result.grade !== "none") return;
    if (!settlement) {
      const transaction = onSettle(model.result);
      if (!transaction?.settled && transaction?.reason !== "already-settled") return;
    }
    cw.stopAll();
    cw.clearInput();
    playbackKeyRef.current = null;
    setSettlement(null);
    setRun((current) => restartLightsControl(current, { startedAt: new Date() }));
  }

  const visibleIncoming = save.qsoGuidance === "full" ? model.incomingText
    : save.qsoGuidance === "hints" && model.needsPlayback ? model.callerHint || "••• CW •••" : "";
  return (
    <main className="screen lights-event-screen" data-event-mode={mode} data-event-phase={run.phase}>
      <header className="lights-event-header">
        <div><small>{t.kicker}</small><h1>{t.title}</h1></div>
        <span className="lights-mode-badge">{model.modeLabel}</span>
        <div className="lights-identity"><span>{t.station}</span><strong>SIM5LT</strong><small>{t.operator}: {save.callsign}</small></div>
        <button onClick={leave} aria-label={t.back}><ArrowLeft size={21} />{t.back}</button>
      </header>

      <section className="lights-event-console">
        <aside className="lights-event-meter">
          <div><Timer size={22} /><span>{t.remaining}</span><strong>{model.timerText}</strong></div>
          <div><Broadcast size={22} /><span>{t.contacts}</span><strong>{model.contacts}/{model.maxContacts}</strong></div>
          <div><Radio size={22} /><span>{t.regions}</span><strong>{model.regions}/6</strong></div>
        </aside>
        <article className={`lights-event-receiver ${cw.isListening ? "listening" : ""} ${cw.isPlaying ? "playing" : ""}`}>
          <div className="lights-receiver-status"><Headphones size={23} weight="fill" /><span>{model.needsPlayback ? t.incoming : t.awaiting}</span><i /></div>
          <p className="lights-instruction">{model.instruction}</p>
          <div className="lights-rx-line" data-testid="lights-rx-line">{visibleIncoming || "· · ·"}</div>
          {model.callerHint && <small className="lights-caller-hint">{model.callerHint}</small>}
          <div className="lights-tx-line"><small>{save.keyType === "automatic" ? "Z · / X —" : "SPACE"}</small><strong>{cw.analysis.decoded || "_"}</strong><span>{cw.analysis.wpm} WPM</span></div>
          {model.errorText && <p className="lights-error" role="alert">{model.errorText}</p>}
        </article>
        <aside className="lights-event-score">
          <Trophy size={30} weight="fill" />
          <span>{t.grade}</span><strong data-lights-grade={model.grade}>{model.gradeLabel}</strong>
          <small>{t.score} {model.score}</small>
        </aside>
      </section>

      <footer className="lights-event-controls">
        <button onClick={() => cw.replayInput()} disabled={!cw.analysis.pulseCount || cw.isPlaying}><Repeat size={19} />{t.replay}</button>
        <button onClick={clear} disabled={!cw.analysis.pulseCount && !run.lastError}><Eraser size={19} />{t.clear}</button>
        <button className="lights-transmit" data-action="lights-transmit" onClick={transmit} disabled={!model.canTransmit || !cw.analysis.pulseCount || cw.isPlaying || cw.isKeying}><Broadcast size={20} weight="fill" />{t.transmit}<kbd>F2</kbd></button>
        <button className="lights-settle" data-action="lights-settle" onClick={settle} disabled={!model.canSettle || Boolean(settlement)}><FloppyDisk size={20} weight="fill" />{settlement ? t.settled : t.settle}</button>
        {model.result?.grade === "none" && <button data-action="lights-retry-control" onClick={retryControl}><Repeat size={19} />{t.retryControl}</button>}
      </footer>
      {settlement && <div className="lights-settlement-banner" role="status"><Trophy size={24} weight="fill" /><strong>{model.gradeLabel}</strong><span>+{settlement.moneyAwarded}</span>{annualStampLabel && <span data-annual-stamp={settlement.annualStamp}>{annualStampLabel}</span>}</div>}
    </main>
  );
}
