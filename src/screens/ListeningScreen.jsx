import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle, Clock, Ear, Radio, Warning,
} from "@phosphor-icons/react";
import { CLEAR_INPUT_GESTURE_LENGTH } from "../cw/inputAnalyzer.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  LISTENING_PHASES, createListeningRun, finishListeningWait, normalizeListeningState,
  observeListeningWindow, recordListeningSilence, retryListeningRun, submitListeningCall,
  tickListeningRun,
} from "../game/listeningRun.js";
import {
  createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility,
} from "../game/expeditionLifecycle.js";
import {
  LISTENING_SETTLED_TEXT, LISTENING_TEXT, listeningLeaveRisk,
} from "./listeningText.js";

function nowIso() { return new Date().toISOString(); }

function initialRun(save) {
  const chapter = normalizeListeningState(save.storyContinuationState?.chapter11);
  return chapter.activeRun ?? createListeningRun({
    playerCallsign: save.callsign,
    seed: `${save.id}:listening:${chapter.settledRunIds.length}`,
    startedAt: nowIso(),
  });
}

function callText(run) {
  return `${run.targetCallsign} DE ${run.playerCallsign} K`;
}

export function ListeningScreen({
  language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack,
}) {
  const t = LISTENING_TEXT[language] ?? LISTENING_TEXT.en;
  const settledText = LISTENING_SETTLED_TEXT[language] ?? LISTENING_SETTLED_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [settled, setSettled] = useState(false);
  const [settlementAttempts, setSettlementAttempts] = useState(0);
  const [settlementReason, setSettlementReason] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [callAgainArmed, setCallAgainArmed] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange); onRunChangeRef.current = onRunChange;
  const inputRef = useRef(null);
  const clockRef = useRef(null);
  const cw = useCwCore({
    targetText: callText(run),
    automaticWpm: save.automaticKeyWpm,
    clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH,
  });
  const terminal = [LISTENING_PHASES.COMPLETED, LISTENING_PHASES.FAILED, LISTENING_PHASES.ABANDONED].includes(run.phase);
  const canTransmit = run.phase === LISTENING_PHASES.CALL_READY
    || (run.phase === LISTENING_PHASES.DECISION && callAgainArmed && run.callCount < 2);

  if (!clockRef.current) clockRef.current = createExpeditionActiveClock({
    onElapsed(milliseconds) {
      setRun((current) => {
        const next = tickListeningRun(current, { seconds: milliseconds / 1000 }, nowIso());
        if (next !== current) onRunChangeRef.current(next);
        return next;
      });
    },
  });

  const update = useCallback((next) => {
    if (!next || next === run) return;
    setRun(next);
    onRunChange(next);
  }, [onRunChange, run]);

  useEffect(() => { onRunChange(run); }, []);
  useEffect(() => registerExpeditionPageVisibility({
    windowTarget: globalThis.window,
    documentTarget: globalThis.document,
    onActiveChange: setWindowActive,
  }), []);
  useEffect(() => {
    clockRef.current.setActive(!inputBlocked && windowActive && !terminal);
    return () => clockRef.current.setActive(false);
  }, [inputBlocked, terminal, windowActive]);
  useEffect(() => () => clockRef.current.dispose(), []);
  useEffect(() => {
    onActivityRisk(listeningLeaveRisk(run, settled));
    return () => onActivityRisk("none");
  }, [onActivityRisk, run, settled]);
  useEffect(() => {
    if (inputBlocked || windowActive) return;
    cw.stopAll();
  }, [cw.stopAll, inputBlocked, windowActive]);
  useEffect(() => {
    if (run.phase !== LISTENING_PHASES.WAITING || inputBlocked || !windowActive) return undefined;
    const timer = globalThis.setTimeout(() => update(finishListeningWait(run, nowIso())), 4_000);
    return () => globalThis.clearTimeout(timer);
  }, [inputBlocked, run, update, windowActive]);

  const transmit = useCallback(async (message = cw.analysis.decoded) => {
    if (!canTransmit || semanticBusy || inputBlocked || cw.isKeying || cw.isPlaying || !String(message).trim()) return;
    setSemanticBusy(true);
    try {
      let semanticResult = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message,
          phase: "EXCHANGE",
          selfCallsign: run.playerCallsign,
          peerCallsign: run.targetCallsign,
          pendingQuestion: "DIRECTED_CALL",
          knownSlots: ["CALLSIGN"],
          catalogs: { CALLSIGN: [run.playerCallsign, run.targetCallsign] },
        });
        if (response?.ok) semanticResult = response.result;
      } catch { semanticResult = null; }
      update(submitListeningCall(run, message, semanticResult, nowIso()));
      cw.clearInput();
      setCallAgainArmed(false);
    } finally { setSemanticBusy(false); }
  }, [canTransmit, cw.analysis.decoded, cw.clearInput, cw.isKeying, cw.isPlaying, inputBlocked, run, semanticBusy, update]);

  inputRef.current = { canTransmit, inputBlocked, keyType: save.keyType, transmit };
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
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); cw.stopAll();
    };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, save.keyType]);

  function observeNext() { update(observeListeningWindow(run, nowIso())); }
  function armSecondCall() { cw.clearInput(); setCallAgainArmed(true); }
  function recordSilence() { update(recordListeningSilence(run, nowIso())); }
  function retry() { cw.clearInput(); setSettled(false); setCallAgainArmed(false); update(retryListeningRun(run, nowIso())); }
  function requestLeave() { listeningLeaveRisk(run, settled) === "none" ? onBack() : setLeaveOpen(true); }
  async function settle() {
    const result = await onSettle(run);
    setSettlementAttempts((count) => count + 1);
    setSettlementReason(result?.reason ?? (result?.settled ? "SETTLED" : "REJECTED"));
    if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true);
  }

  const lastError = run.errors.at(-1) ?? run.failureReason;
  return <main className="screen listening-screen" data-testid="listening-screen"
    data-simulation="fictional-listening-story" data-listening-phase={run.phase}
    data-listening-paused={inputBlocked || !windowActive} data-pulse-count={cw.analysis.pulseCount}
    data-decoded={cw.analysis.decoded} data-portrait-visible="false" data-settled={settled}
    data-settlement-attempts={settlementAttempts} data-settlement-reason={settlementReason}>
    <header className="listening-topbar"><div><Ear size={30} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="listening-simulation"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <div className="listening-paused" role="status">{t.paused}</div>}
    <section className="listening-layout" aria-busy={inputBlocked || semanticBusy}>
      <aside className="listening-target"><Radio size={28} /><span>{t.target}</span><strong>{run.targetCallsign}</strong><small>{run.stationId}</small><div><Clock />{Math.ceil(run.activeMilliseconds / 1_000)}s</div></aside>
      <article className="listening-console">
        <section className="listening-windows"><h2>{t.observeTitle}</h2><div>{run.windows.map((windowFact) => {
          const done = run.observedWindowIds.includes(windowFact.id);
          return <article key={windowFact.id} data-listening-window={windowFact.id} data-observed={done}><strong>{windowFact.id}</strong><span>{t.propagation}: {windowFact.propagationLevel}</span><small>{t.noise}: {t[windowFact.noiseLevel]}</small>{done && <b>{t.observed}</b>}</article>;
        })}</div>{[LISTENING_PHASES.BRIEFING, LISTENING_PHASES.LISTENING].includes(run.phase) && <button data-action="listening-observe" disabled={inputBlocked} onClick={observeNext}>{t.observe}</button>}</section>
        {canTransmit && <section className="listening-keyer"><h2>{t.callPrompt}</h2><code>{callText(run)}</code><small>{save.keyType === "automatic" ? t.keyAuto : t.keyManual}</small><strong>{cw.analysis.decoded || "_"}</strong><div><button onClick={cw.clearInput}>{t.clear}</button><button data-action="listening-submit" disabled={!cw.analysis.pulseCount || semanticBusy || inputBlocked} onClick={() => transmit()}>{t.transmit}</button></div></section>}
        {run.phase === LISTENING_PHASES.WAITING && <section className="listening-wait" role="status"><Ear size={42} /><p>{t.waiting}</p></section>}
        {run.phase === LISTENING_PHASES.DECISION && !callAgainArmed && <section className="listening-decision"><p>{t.decision}</p><div>{run.callCount < 2 && <button data-action="listening-call-again" disabled={inputBlocked} onClick={armSecondCall}>{t.callAgain}</button>}<button data-action="listening-record-silence" disabled={inputBlocked} onClick={recordSilence}>{t.recordSilence}</button></div></section>}
        {lastError && <p className="listening-error"><Warning />{t[lastError] ?? lastError}</p>}
        {run.phase === LISTENING_PHASES.COMPLETED && <section className="listening-result"><CheckCircle size={48} /><h2>{t.completed}</h2><strong>{run.summary.conclusionKey}</strong>{settled && <p className="listening-settlement-banner" role="status">{settledText}</p>}<button data-action="listening-settle" disabled={inputBlocked} onClick={settle}>{t.settle}</button></section>}
        {run.phase === LISTENING_PHASES.FAILED && <section className="listening-result failed"><Warning size={48} /><h2>{t.failed}</h2><p>{t[run.failureReason] ?? run.failureReason}</p><button data-action="listening-retry" disabled={inputBlocked} onClick={retry}>{t.retry}</button></section>}
      </article>
      <aside className="listening-ledger"><h2>{t.observed}</h2><strong>{run.observedWindowIds.length}/3</strong><span>{run.callCount}/2</span><p>{run.summary?.conclusionKey ?? "—"}</p></aside>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="listening-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="listening-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
