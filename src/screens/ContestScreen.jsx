import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Broadcast, CheckCircle, Clock, Headphones, Radio, Trophy, Warning,
} from "@phosphor-icons/react";
import { CLEAR_INPUT_GESTURE_LENGTH } from "../cw/inputAnalyzer.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  CONTEST_DURATION_MILLISECONDS, CONTEST_MODES, CONTEST_PHASES, contestCqText, contestExchangeText,
  createContestRun, finishContestRun, normalizeContestState, retryContestRun,
  scoreContestRun, selectContestMode, submitContestText, tickContestRun,
} from "../game/contestRun.js";
import {
  createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility,
} from "../game/expeditionLifecycle.js";
import { CONTEST_SETTLED_TEXT, CONTEST_TEXT, contestLeaveRisk } from "./contestText.js";

function nowIso() { return new Date().toISOString(); }

function initialRun(save) {
  const chapter = normalizeContestState(save.storyContinuationState?.chapter10);
  return chapter.activeRun ?? createContestRun({
    playerCallsign: save.callsign,
    seed: `${save.id}:contest:${chapter.settledRunIds.length}`,
    startedAt: nowIso(),
  });
}

function targetFor(run) {
  if (run.phase === CONTEST_PHASES.RUN_CQ) return contestCqText(run.playerCallsign);
  if (run.phase === CONTEST_PHASES.EXCHANGE && run.selectedStation) {
    return contestExchangeText(run.selectedStation, run.playerCallsign, run.nextSerial);
  }
  return run.candidates[0]?.callsign ?? "CQ";
}

export function ContestScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = CONTEST_TEXT[language] ?? CONTEST_TEXT.en;
  const settledText = CONTEST_SETTLED_TEXT[language] ?? CONTEST_SETTLED_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [settled, setSettled] = useState(false);
  const [settlementAttempts, setSettlementAttempts] = useState(0);
  const [settlementReason, setSettlementReason] = useState("");
  const [recoveryPrompt, setRecoveryPrompt] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange); onRunChangeRef.current = onRunChange;
  const inputRef = useRef(null);
  const clockRef = useRef(null);
  const targetText = recoveryPrompt || targetFor(run);
  const cw = useCwCore({ targetText, automaticWpm: save.automaticKeyWpm, clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH });
  const score = useMemo(() => scoreContestRun(run), [run]);
  const regions = useMemo(() => new Set(run.contacts.map(({ regionCode }) => regionCode)).size, [run.contacts]);
  const terminal = [CONTEST_PHASES.COMPLETED, CONTEST_PHASES.FAILED, CONTEST_PHASES.ABANDONED].includes(run.phase);
  const canTransmit = [CONTEST_PHASES.RUN_CQ, CONTEST_PHASES.RUN_PILEUP, CONTEST_PHASES.SP_POOL, CONTEST_PHASES.EXCHANGE].includes(run.phase);
  const canFinish = run.contacts.length >= 6 && score.facts.runContacts >= 2 && score.facts.spContacts >= 2 && score.facts.uniqueRegions >= 3;
  const remaining = Math.max(0, CONTEST_DURATION_MILLISECONDS - run.elapsedMilliseconds);

  if (!clockRef.current) clockRef.current = createExpeditionActiveClock({
    onElapsed(milliseconds) {
      setRun((current) => {
        const next = tickContestRun(current, { seconds: milliseconds / 1000 }, nowIso());
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
  useEffect(() => registerExpeditionPageVisibility({ windowTarget: globalThis.window, documentTarget: globalThis.document, onActiveChange: setWindowActive }), []);
  useEffect(() => {
    clockRef.current.setActive(!inputBlocked && windowActive && !terminal && run.phase !== CONTEST_PHASES.BRIEFING);
    return () => clockRef.current.setActive(false);
  }, [inputBlocked, run.phase, terminal, windowActive]);
  useEffect(() => () => clockRef.current.dispose(), []);
  useEffect(() => {
    onActivityRisk(contestLeaveRisk(run, settled));
    return () => onActivityRisk("none");
  }, [onActivityRisk, run, settled]);
  useEffect(() => {
    if (inputBlocked || windowActive) return;
    cw.stopAll();
  }, [cw.stopAll, inputBlocked, windowActive]);

  const transmit = useCallback(async (message = cw.analysis.decoded) => {
    if (!canTransmit || semanticBusy || inputBlocked || cw.isKeying || cw.isPlaying || !String(message).trim()) return;
    setSemanticBusy(true);
    try {
      let semanticResult = null;
      try {
        const peer = run.selectedStation ?? run.candidates[0] ?? run.controller;
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message, phase: "EXCHANGE", selfCallsign: run.playerCallsign,
          peerCallsign: peer.callsign, pendingQuestion: run.phase === CONTEST_PHASES.EXCHANGE ? "CONTEST" : run.phase === CONTEST_PHASES.RUN_CQ ? "CQ" : "CALLSIGN",
          knownSlots: ["CALLSIGN", "REGION", "POWER"],
          catalogs: {
            LOCATION: run.stationPool.map(({ callsign }) => callsign),
            REGION: [...new Set(run.stationPool.map(({ regionCode }) => regionCode))],
          },
        });
        if (response?.ok) semanticResult = response.result;
      } catch { semanticResult = null; }
      update(submitContestText(run, message, semanticResult, nowIso()));
      cw.clearInput();
      setRecoveryPrompt("");
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
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); cw.stopAll(); };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, save.keyType]);

  function chooseMode(mode) { cw.clearInput(); setRecoveryPrompt(""); update(selectContestMode(run, mode)); }
  function finish() { update(finishContestRun(run, nowIso())); }
  function requestLeave() { contestLeaveRisk(run, settled) === "none" ? onBack() : setLeaveOpen(true); }
  async function settle() { const result = await onSettle(run); setSettlementAttempts((count) => count + 1); setSettlementReason(result?.reason ?? (result?.settled ? "SETTLED" : "REJECTED")); if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true); }
  function retry() { cw.clearInput(); setRecoveryPrompt(""); setSettled(false); update(retryContestRun(run, nowIso())); }
  function prepareRecovery(message) { cw.clearInput(); setRecoveryPrompt(message); }
  function listen() {
    if (!canTransmit || inputBlocked || cw.isPlaying) return;
    const incoming = run.candidates.map(({ callsign }) => callsign).join("   ");
    if (incoming) cw.playIncoming(incoming, run.replyWpm, { noiseGain: .05, signalGain: .88, qsbDepth: .12, toneHz: 650 });
  }
  const lastError = run.errors.at(-1) ?? run.failureReason;
  const best = normalizeContestState(save.storyContinuationState?.chapter10).personalBest;

  return <main className="screen contest-screen" data-testid="contest-screen" data-simulation="fictional-five-minute-contest"
    data-contest-phase={run.phase} data-contest-mode={run.mode ?? ""} data-contest-contact-count={run.contacts.length}
    data-contest-score={score.score} data-contest-wpm={save.automaticKeyWpm} data-contest-paused={inputBlocked || !windowActive} data-pulse-count={cw.analysis.pulseCount}
    data-decoded={cw.analysis.decoded} data-contest-keying={cw.isKeying} data-portrait-visible="false" data-settled={settled} data-settlement-attempts={settlementAttempts} data-settlement-reason={settlementReason}>
    <header className="contest-topbar"><div><Trophy size={28} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="contest-simulation"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <div className="contest-paused" role="status">{t.paused}</div>}
    <section className="contest-layout" aria-busy={inputBlocked || semanticBusy}>
      <aside className="contest-scoreboard">
        <div><Clock /><span>{t.remaining}</span><strong>{Math.ceil(remaining / 1000)}s</strong></div>
        <div><Trophy /><span>{t.score}</span><strong>{score.score}</strong></div>
        <div><Broadcast /><span>{t.contacts}</span><strong>{run.contacts.length}/10</strong></div>
        <div><Radio /><span>{t.regions}</span><strong>{regions}</strong></div>
        <dl><dt>{t.validContacts}</dt><dd>{score.facts.validContacts}</dd><dt>{t.cleanExchanges}</dt><dd>{score.facts.cleanExchanges}</dd><dt>{t.repeats}</dt><dd>{run.repeatRequests}</dd><dt>{t.busted}</dt><dd>{run.bustedCalls}</dd><dt>{t.interruptions}</dt><dd>{run.interruptions}</dd><dt>{t.duplicate}</dt><dd>{run.duplicateAttempts}</dd></dl>
      </aside>
      <article className="contest-console">
        <div className="contest-controller"><span>{t.controller}</span><strong>SIM0CT</strong><b>{run.mode ?? "—"}</b></div>
        {run.phase === CONTEST_PHASES.BRIEFING && <section className="contest-briefing"><p>{t.briefing}</p><div><button data-action="contest-mode-run" disabled={inputBlocked} onClick={() => chooseMode(CONTEST_MODES.RUN)}>{t.beginRun}</button><button data-action="contest-mode-sp" disabled={inputBlocked} onClick={() => chooseMode(CONTEST_MODES.SP)}>{t.beginSp}</button></div></section>}
        {run.phase === CONTEST_PHASES.MODE_SELECT && <section className="contest-mode-select"><h2>{t.chooseMode}</h2><div><button data-action="contest-mode-run" disabled={inputBlocked} onClick={() => chooseMode(CONTEST_MODES.RUN)}>{t.runMode}</button><button data-action="contest-mode-sp" disabled={inputBlocked} onClick={() => chooseMode(CONTEST_MODES.SP)}>{t.spMode}</button></div><p>{t.needMinimum}</p>{canFinish && <button data-action="contest-finish" onClick={finish}>{t.finish}</button>}</section>}
        {run.phase === CONTEST_PHASES.RUN_CQ && <section className="contest-run-cq"><h2>{t.runMode}</h2><code>{targetText}</code><p>{t.cqPrompt}</p></section>}
        {[CONTEST_PHASES.RUN_PILEUP, CONTEST_PHASES.SP_POOL].includes(run.phase) && <section className="contest-candidates"><h2>{run.phase === CONTEST_PHASES.RUN_PILEUP ? t.pileup : t.stationPool}</h2><div>{run.candidates.map((station) => <article key={station.personId} data-contest-candidate={station.callsign}><strong>{station.callsign}</strong><span>{station.regionCode}</span><small>{station.replyWpm} WPM</small></article>)}</div><button data-action="contest-listen" onClick={listen} disabled={inputBlocked || cw.isPlaying}><Headphones />{t.listen}</button><p>{t.candidatePrompt}</p></section>}
        {run.phase === CONTEST_PHASES.EXCHANGE && <section className="contest-exchange"><h2>{t.exchange}</h2><code>{targetText}</code><p>{t.exchangeHint}</p></section>}
        {canTransmit && <section className="contest-keyer"><div><small>{save.keyType === "automatic" ? t.keyHintAutomatic : t.keyHintManual}</small><strong>{cw.analysis.decoded || "_"}</strong><span>{cw.analysis.wpm} WPM</span>{recoveryPrompt && <code data-contest-recovery-prompt={recoveryPrompt}>{recoveryPrompt}</code>}</div><div><button data-action="contest-clear" onClick={() => { cw.clearInput(); setRecoveryPrompt(""); }}>{t.clear}</button><button data-action="contest-agn" onClick={() => prepareRecovery("AGN K")}>{t.agn}</button><button data-action="contest-qrs" onClick={() => prepareRecovery("QRS K")}>{t.qrs}</button><button data-action="contest-submit" disabled={!cw.analysis.pulseCount || semanticBusy || inputBlocked} onClick={() => transmit()}>{t.transmit}</button></div></section>}
        {lastError && <p className="contest-error"><Warning />{t[lastError] ?? lastError}</p>}
        {run.phase === CONTEST_PHASES.COMPLETED && <section className="contest-result"><CheckCircle size={46} /><h2>{t.completed}</h2><strong data-contest-grade={score.grade}>{score.grade.toUpperCase()}</strong><b>{score.score}</b>{settled && <p className="contest-settlement-banner" role="status">{settledText}</p>}<button data-action="contest-settle" disabled={inputBlocked} onClick={settle}>{t.settle}</button></section>}
        {run.phase === CONTEST_PHASES.FAILED && <section className="contest-result failed"><Warning size={46} /><h2>{t.failed}</h2><p>{t[run.failureReason] ?? run.failureReason}</p><button data-action="contest-retry" disabled={inputBlocked} onClick={retry}>{t.retry}</button></section>}
      </article>
      <aside className="contest-log"><h2>{t.contacts}</h2>{run.contacts.map((contact) => <article key={contact.contactId}><b>{String(contact.serialNumber).padStart(3, "0")}</b><strong>{contact.callsign}</strong><span>{contact.mode}</span><small>{contact.regionCode} · {contact.powerWatts}W</small></article>)}<div className="contest-best"><span>{t.personalBest}</span><strong>{best ? `${best.score} · ${best.grade.toUpperCase()}` : t.noBest}</strong></div></aside>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="contest-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="contest-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
