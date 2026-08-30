import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Broadcast, CheckCircle, Clock, Radio, Warning } from "@phosphor-icons/react";
import { CLEAR_INPUT_GESTURE_LENGTH } from "../cw/inputAnalyzer.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  STORM_RELAY_PHASES, createStormRelayRun, normalizeStormRelayState, receiveStormConflict,
  repeatStormMessage, requestStormVerification, retryStormRelayRun, stormPacketText,
  submitStormCheckIn, submitStormRelay, tickStormRelayRun,
} from "../game/stormRelayRun.js";
import {
  createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility,
} from "../game/expeditionLifecycle.js";
import { STORM_RELAY_SETTLED_TEXT, STORM_RELAY_TEXT, stormRelayLeaveRisk } from "./stormRelayText.js";

function nowIso() { return new Date().toISOString(); }
function initialRun(save) {
  const chapter = normalizeStormRelayState(save.storyContinuationState?.chapter12);
  return chapter.activeRun ?? createStormRelayRun({
    playerCallsign: save.callsign, seed: `${save.id}:storm:${chapter.settledRunIds.length}`, startedAt: nowIso(),
  });
}
function canonical(run) { return run.packets.find(({ id }) => id === "storm-214-r2"); }
function targetText(run) {
  if (run.phase === STORM_RELAY_PHASES.CHECK_IN) return `${run.control.callsign} DE ${run.playerCallsign} QTC K`;
  if (run.phase === STORM_RELAY_PHASES.CONFLICT) return "AGN MSG 214 REV K";
  if (run.phase === STORM_RELAY_PHASES.RELAY) return stormPacketText(canonical(run));
  return "";
}

export function StormRelayScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = STORM_RELAY_TEXT[language] ?? STORM_RELAY_TEXT.en;
  const settledText = STORM_RELAY_SETTLED_TEXT[language] ?? STORM_RELAY_SETTLED_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [settled, setSettled] = useState(false);
  const [settlementAttempts, setSettlementAttempts] = useState(0);
  const [settlementReason, setSettlementReason] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange); onRunChangeRef.current = onRunChange;
  const inputRef = useRef(null);
  const clockRef = useRef(null);
  const cw = useCwCore({ targetText: targetText(run), automaticWpm: save.automaticKeyWpm, clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH });
  const terminal = [STORM_RELAY_PHASES.COMPLETED, STORM_RELAY_PHASES.FAILED, STORM_RELAY_PHASES.ABANDONED].includes(run.phase);
  const canTransmit = [STORM_RELAY_PHASES.CHECK_IN, STORM_RELAY_PHASES.CONFLICT, STORM_RELAY_PHASES.RELAY].includes(run.phase);

  if (!clockRef.current) clockRef.current = createExpeditionActiveClock({ onElapsed(milliseconds) {
    setRun((current) => { const next = tickStormRelayRun(current, { seconds: milliseconds / 1_000 }, nowIso()); if (next !== current) onRunChangeRef.current(next); return next; });
  } });
  const update = useCallback((next) => { if (!next || next === run) return; setRun(next); onRunChange(next); }, [onRunChange, run]);
  useEffect(() => { onRunChange(run); }, []);
  useEffect(() => registerExpeditionPageVisibility({ windowTarget: globalThis.window, documentTarget: globalThis.document, onActiveChange: setWindowActive }), []);
  useEffect(() => { clockRef.current.setActive(!inputBlocked && windowActive && !terminal); return () => clockRef.current.setActive(false); }, [inputBlocked, terminal, windowActive]);
  useEffect(() => () => clockRef.current.dispose(), []);
  useEffect(() => { onActivityRisk(stormRelayLeaveRisk(run, settled)); return () => onActivityRisk("none"); }, [onActivityRisk, run, settled]);
  useEffect(() => { if (inputBlocked || windowActive) return; cw.stopAll(); }, [cw.stopAll, inputBlocked, windowActive]);

  const transmit = useCallback(async (message = cw.analysis.decoded) => {
    if (!canTransmit || semanticBusy || inputBlocked || cw.isKeying || cw.isPlaying || !String(message).trim()) return;
    setSemanticBusy(true);
    try {
      let semantic = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message, phase: "EXCHANGE", selfCallsign: run.playerCallsign,
          peerCallsign: run.phase === STORM_RELAY_PHASES.RELAY ? run.relay.callsign : run.control.callsign,
          pendingQuestion: run.phase, knownSlots: ["CALLSIGN", "MSG", "REV", "GRID", "PEOPLE", "ITEM", "QTY", "CHECK"],
          catalogs: { CALLSIGN: [run.playerCallsign, run.control.callsign, run.relay.callsign], MSG: ["214"], REV: ["1", "2"], GRID: ["PX-31"], ITEM: ["WATER"] },
        });
        if (response?.ok) semantic = response.result;
      } catch { semantic = null; }
      let next = run;
      if (run.phase === STORM_RELAY_PHASES.CHECK_IN) next = submitStormCheckIn(run, message, semantic, nowIso());
      else if (run.phase === STORM_RELAY_PHASES.CONFLICT) next = /^(AGN|QRS) MSG 214 K$/u.test(message.trim().toUpperCase())
        ? repeatStormMessage(run, message, semantic) : requestStormVerification(run, message, semantic, nowIso());
      else if (run.phase === STORM_RELAY_PHASES.RELAY) next = /^(AGN|QRS) MSG 214 K$/u.test(message.trim().toUpperCase())
        ? repeatStormMessage(run, message, semantic) : submitStormRelay(run, message, semantic, nowIso());
      update(next); cw.clearInput();
    } finally { setSemanticBusy(false); }
  }, [canTransmit, cw.analysis.decoded, cw.clearInput, cw.isKeying, cw.isPlaying, inputBlocked, run, semanticBusy, update]);

  inputRef.current = { canTransmit, inputBlocked, keyType: save.keyType, transmit };
  useEffect(() => {
    function onDown(event) {
      const state = inputRef.current; if (!state || state.inputBlocked) return;
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

  function receive() { update(receiveStormConflict(run, nowIso())); }
  function retry() { cw.clearInput(); setSettled(false); update(retryStormRelayRun(run, nowIso())); }
  function requestLeave() { stormRelayLeaveRisk(run, settled) === "none" ? onBack() : setLeaveOpen(true); }
  async function settle() { const result = await onSettle(run); setSettlementAttempts((count) => count + 1); setSettlementReason(result?.reason ?? (result?.settled ? "SETTLED" : "REJECTED")); if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true); }
  const expected = targetText(run);
  const lastError = run.errors.at(-1) ?? run.failureReason;
  return <main className="screen storm-relay-screen" data-testid="storm-relay-screen" data-simulation="fictional-storm-relay"
    data-storm-phase={run.phase} data-storm-paused={inputBlocked || !windowActive} data-pulse-count={cw.analysis.pulseCount}
    data-decoded={cw.analysis.decoded} data-portrait-visible="false" data-settled={settled}
    data-settlement-attempts={settlementAttempts} data-settlement-reason={settlementReason}>
    <header className="storm-relay-topbar"><div><Broadcast size={30} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="storm-relay-warning"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <div className="storm-relay-paused" role="status">{t.paused}</div>}
    <section className="storm-relay-layout" aria-busy={inputBlocked || semanticBusy}>
      <aside className="storm-relay-stations"><article><Radio /><small>{t.control}</small><strong>{run.control.callsign}</strong></article><article><Broadcast /><small>{t.relay}</small><strong>{run.relay.callsign}</strong></article><span><Clock />{t.timer}: {Math.ceil(run.activeMilliseconds / 1_000)}s</span><b>{t[run.phase] ?? run.phase}</b></aside>
      <article className="storm-relay-console">
        <section className="storm-packet-board"><h2>{t.packetsTitle}</h2>{run.packets.map((packet) => <article key={packet.id} data-packet-id={packet.id} data-packet-revision={packet.revision} data-authoritative={packet.id === run.verifiedPacketId}><span>{packet.id === run.verifiedPacketId ? t.authoritative : t.conflict}</span><code>{stormPacketText(packet)}</code></article>)}</section>
        {run.phase === STORM_RELAY_PHASES.RECEIVING && <button data-action="storm-receive-conflict" disabled={inputBlocked} onClick={receive}>{t.receive}</button>}
        {canTransmit && <section className="storm-relay-keyer"><h2>{run.phase === STORM_RELAY_PHASES.CHECK_IN ? t.promptCheckIn : run.phase === STORM_RELAY_PHASES.CONFLICT ? t.promptVerify : t.promptRelay}</h2><code>{expected}</code><small>{save.keyType === "automatic" ? t.keyAuto : t.keyManual}</small><strong>{cw.analysis.decoded || "_"}</strong><div><button onClick={cw.clearInput}>{t.clear}</button><button data-action="storm-submit" disabled={!cw.analysis.pulseCount || semanticBusy || inputBlocked} onClick={() => transmit()}>{t.transmit}</button></div></section>}
        {lastError && <p className="storm-relay-error"><Warning />{t[lastError] ?? lastError}</p>}
        {run.phase === STORM_RELAY_PHASES.COMPLETED && <section className="storm-relay-result"><CheckCircle size={48} /><h2>{t.completed}</h2><code>{stormPacketText(canonical(run))}</code>{settled && <p role="status">{settledText}</p>}<button data-action="storm-settle" disabled={inputBlocked} onClick={settle}>{t.settle}</button></section>}
        {run.phase === STORM_RELAY_PHASES.FAILED && <section className="storm-relay-result failed"><Warning size={48} /><h2>{t.failed}</h2><p>{t[run.failureReason] ?? run.failureReason}</p><button data-action="storm-retry" disabled={inputBlocked} onClick={retry}>{t.retry}</button></section>}
      </article>
      <aside className="storm-relay-ledger"><strong>MSG 214</strong><span>REV {run.summary?.revision ?? (run.verifiedPacketId ? 2 : "—")}</span><span>CHECK {canonical(run).check}</span><span>{run.badRelayCount}/3</span></aside>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="storm-relay-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="storm-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
