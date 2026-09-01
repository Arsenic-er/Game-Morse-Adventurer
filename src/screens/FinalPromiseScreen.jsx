import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpenText, CheckCircle, Radio, SealCheck, Warning } from "@phosphor-icons/react";
import { CLEAR_INPUT_GESTURE_LENGTH } from "../cw/inputAnalyzer.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  FINAL_PROMISE_PHASES, FINAL_PROMISE_TONES, chooseFinalPromiseTone, createFinalPromiseRun,
  finalPromiseCallText, finalPromiseMessageText, normalizeFinalPromiseState, receiveFinalPromiseAccount,
  requestFinalPromiseRepeat, retryFinalPromiseRun, reviewFinalPromise, submitFinalPromiseCall,
  submitFinalPromiseMessage, tickFinalPromiseRun,
} from "../game/finalPromiseRun.js";
import { createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility } from "../game/expeditionLifecycle.js";
import { FINAL_PROMISE_TEXT, finalPromiseLeaveRisk } from "./finalPromiseText.js";

function nowIso() { return new Date().toISOString(); }
function initialRun(save) {
  const chapter = normalizeFinalPromiseState(save.storyContinuationState?.chapter14);
  return chapter.activeRun ?? createFinalPromiseRun({ save, playerCallsign: save.callsign,
    seed: `${save.id}:final-promise:${chapter.settledRunIds.length}`, startedAt: nowIso() });
}
function expectedText(run) {
  if (run.phase === FINAL_PROMISE_PHASES.CALL) return finalPromiseCallText(run);
  if (run.phase === FINAL_PROMISE_PHASES.FINAL_CHOICE) return "AGN K";
  if (run.phase === FINAL_PROMISE_PHASES.FINAL_MESSAGE) return finalPromiseMessageText(run);
  return "";
}

export function FinalPromiseScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = FINAL_PROMISE_TEXT[language] ?? FINAL_PROMISE_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save)); const [settled, setSettled] = useState(false);
  const [semanticBusy, setSemanticBusy] = useState(false); const [leaveOpen, setLeaveOpen] = useState(false);
  const [settlementReason, setSettlementReason] = useState("");
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange); onRunChangeRef.current = onRunChange;
  const inputRef = useRef(null); const clockRef = useRef(null);
  const cw = useCwCore({ targetText: expectedText(run), automaticWpm: save.automaticKeyWpm, clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH });
  const terminal = [FINAL_PROMISE_PHASES.COMPLETED, FINAL_PROMISE_PHASES.FAILED, FINAL_PROMISE_PHASES.ABANDONED].includes(run.phase);
  const canTransmit = [FINAL_PROMISE_PHASES.CALL, FINAL_PROMISE_PHASES.FINAL_CHOICE, FINAL_PROMISE_PHASES.FINAL_MESSAGE].includes(run.phase);
  if (!clockRef.current) clockRef.current = createExpeditionActiveClock({ onElapsed(milliseconds) {
    setRun((current) => { const next = tickFinalPromiseRun(current, { milliseconds }, nowIso()); if (next !== current) onRunChangeRef.current(next); return next; });
  } });
  const update = useCallback((next) => { if (!next || next === run) return; setRun(next); onRunChange(next); cw.clearInput(); }, [cw.clearInput, onRunChange, run]);
  useEffect(() => { if (run) onRunChange(run); }, []);
  useEffect(() => registerExpeditionPageVisibility({ windowTarget: globalThis.window, documentTarget: globalThis.document, onActiveChange: setWindowActive }), []);
  useEffect(() => { clockRef.current.setActive(!inputBlocked && windowActive && !terminal); return () => clockRef.current.setActive(false); }, [inputBlocked, terminal, windowActive]);
  useEffect(() => () => clockRef.current.dispose(), []);
  useEffect(() => { onActivityRisk(finalPromiseLeaveRisk(run, settled)); return () => onActivityRisk("none"); }, [onActivityRisk, run, settled]);
  useEffect(() => { if (inputBlocked || windowActive) return; cw.stopAll(); }, [cw.stopAll, inputBlocked, windowActive]);

  const transmit = useCallback(async (message = cw.analysis.decoded) => {
    if (!canTransmit || semanticBusy || inputBlocked || cw.isKeying || cw.isPlaying || !String(message).trim()) return;
    setSemanticBusy(true);
    try {
      let semantic = null;
      try {
        const response = await globalThis.window.cwgameSystem?.interpretCwTraffic?.({ message, phase: "EXCHANGE",
          selfCallsign: run.playerCallsign, peerCallsign: run.targetCallsign, pendingQuestion: run.phase,
          knownSlots: ["CALLSIGN", "ACCOUNT", "CHOICE"],
          catalogs: { CALLSIGN: [run.playerCallsign, run.targetCallsign], ACCOUNT: [run.accountKey], CHOICE: FINAL_PROMISE_TONES } });
        if (response?.ok) semantic = response.result;
      } catch { semantic = null; }
      const upper = String(message).trim().toUpperCase();
      let next = run;
      if (run.phase === FINAL_PROMISE_PHASES.CALL) next = submitFinalPromiseCall(run, message, semantic, nowIso());
      else if (run.phase === FINAL_PROMISE_PHASES.FINAL_CHOICE && /^(AGN|QRS)(?: K)?$/u.test(upper)) next = requestFinalPromiseRepeat(run, upper, semantic);
      else if (run.phase === FINAL_PROMISE_PHASES.FINAL_MESSAGE) next = submitFinalPromiseMessage(run, message, semantic, nowIso());
      update(next);
    } finally { setSemanticBusy(false); }
  }, [canTransmit, cw.analysis.decoded, cw.isKeying, cw.isPlaying, inputBlocked, run, semanticBusy, update]);
  inputRef.current = { canTransmit, inputBlocked, keyType: save.keyType, transmit };
  useEffect(() => {
    function down(event) {
      const state = inputRef.current; if (!state || state.inputBlocked) return;
      if (["Space", "KeyZ", "KeyX", "F2"].includes(event.code)) event.preventDefault(); if (event.repeat) return;
      if (event.code === "F2") { state.transmit(); return; } if (!state.canTransmit) return;
      if (state.keyType === "manual" && event.code === "Space") cw.beginManual();
      if (state.keyType === "automatic" && event.code === "KeyZ") cw.beginAutomatic(".");
      if (state.keyType === "automatic" && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function up(event) {
      if (save.keyType === "manual" && event.code === "Space") cw.endManual();
      if (save.keyType === "automatic" && event.code === "KeyZ") cw.endAutomatic(".");
      if (save.keyType === "automatic" && event.code === "KeyX") cw.endAutomatic("-");
    }
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); cw.stopAll(); };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, save.keyType]);

  function requestLeave() { finalPromiseLeaveRisk(run, settled) === "none" ? onBack() : setLeaveOpen(true); }
  function retry() { setSettled(false); update(retryFinalPromiseRun(run, nowIso())); }
  async function settle() { const result = await onSettle(run); setSettlementReason(result?.reason ?? (result?.settled ? "SETTLED" : "REJECTED")); if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true); }
  if (!run) return <main className="screen final-promise-screen"><p role="alert">{t.failed}</p><button onClick={onBack}>{t.leave}</button></main>;
  return <main className="screen final-promise-screen" data-testid="final-promise-screen"
    data-final-promise-phase={run.phase} data-final-promise-paused={inputBlocked || !windowActive}
    data-pulse-count={cw.analysis.pulseCount} data-decoded={cw.analysis.decoded} data-keying={cw.isKeying} data-keyer-wpm={save.automaticKeyWpm}
    data-portrait-visible="false" data-settled={settled} data-settlement-reason={settlementReason}>
    <header className="final-promise-topbar"><div><BookOpenText size={30} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="final-promise-warning"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <p className="final-promise-paused" role="status">{t.paused}</p>}
    <section className="final-promise-layout" aria-busy={semanticBusy || inputBlocked}>
      <section className="final-promise-page"><h2>{t.recalledFacts}</h2><ul>{run.recallKeys.map((key) => <li key={key}>{t[key]}</li>)}</ul>
        {run.scheduledPersonIds.length > 0 && <ul className="final-promise-people">{run.scheduledPersonIds.map((personId) => <li key={personId}><code>{personId}</code></li>)}</ul>}
        <dl><dt>{t.recipient}</dt><dd>{run.targetCallsign}</dd><dt>{t.account}</dt><dd>{t[run.accountKey]}</dd></dl></section>
      <aside className="final-promise-status"><SealCheck size={28} /><strong>{t[run.phase]}</strong><span>{Math.ceil(run.activeMilliseconds / 1000)}s</span></aside>
      {run.phase === FINAL_PROMISE_PHASES.REVIEW && <section className="final-promise-action"><h2>{t.review}</h2><button data-action="final-promise-review" onClick={() => update(reviewFinalPromise(run))}>{t.reviewAction}</button></section>}
      {run.phase === FINAL_PROMISE_PHASES.ACCOUNT && <section className="final-promise-action"><h2>{t.account}</h2><p>{t[run.accountKey]}</p><button data-action="final-promise-receive" onClick={() => update(receiveFinalPromiseAccount(run, nowIso()))}>{t.receiveAccount}</button></section>}
      {run.phase === FINAL_PROMISE_PHASES.FINAL_CHOICE && <section className="final-promise-action"><h2>{t.chooseTone}</h2><div>{FINAL_PROMISE_TONES.map((tone) => <button key={tone} data-action="final-promise-tone" data-tone={tone} onClick={() => update(chooseFinalPromiseTone(run, tone))}>{t[tone]}</button>)}</div></section>}
      {canTransmit && <section className="final-promise-keyer"><Radio size={32} /><h2>{run.phase === FINAL_PROMISE_PHASES.CALL ? t.call : run.phase === FINAL_PROMISE_PHASES.FINAL_CHOICE ? t.account : t.finalMessage}</h2><code>{expectedText(run)}</code><small>{save.keyType === "automatic" ? t.keyAuto : t.keyManual}</small><strong>{cw.analysis.decoded || "_"}</strong><div><button data-action="final-promise-clear" onClick={cw.clearInput}>{t.clear}</button><button data-action="final-promise-submit" disabled={!cw.analysis.pulseCount || cw.isKeying || semanticBusy || inputBlocked} onClick={() => transmit()}>{t.transmit}</button></div></section>}
      {run.phase === FINAL_PROMISE_PHASES.COMPLETED && <section className="final-promise-result"><CheckCircle size={48} /><h2>{t.completed}</h2><p>{t[run.messageKey]}</p>{settled && <p role="status">{t.settled}</p>}<button data-action="final-promise-settle" onClick={settle}>{t.settle}</button></section>}
      {run.phase === FINAL_PROMISE_PHASES.FAILED && <section className="final-promise-result failed"><Warning size={48} /><h2>{t.failed}</h2><p>{t[run.failureReason] ?? run.failureReason}</p><button data-action="final-promise-retry" onClick={retry}>{t.retry}</button></section>}
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="final-promise-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="final-promise-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
