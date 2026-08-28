import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Broadcast, CheckCircle, Clock, GridFour, Radio, Warning } from "@phosphor-icons/react";
import { useStructuredCwInput } from "../cw/useStructuredCwInput.js";
import {
  COORDINATE_RELAY_PHASES, beginCoordinateRelayRun, coordinatePacketText, createCoordinateRelayRun,
  normalizeCoordinateRelayState, receiveCoordinatePacket, receiveRelayConfirmation,
  retryCoordinateRelayRun, submitCoordinateRelayText, tickCoordinateRelayRun,
} from "../game/coordinateRelayRun.js";
import { createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility } from "../game/expeditionLifecycle.js";
import { COORDINATE_RELAY_SETTLED_TEXT, COORDINATE_RELAY_TEXT, coordinateRelayLeaveRisk } from "./coordinateRelayText.js";

function nowIso() { return new Date().toISOString(); }
function initialRun(save) {
  const chapter = normalizeCoordinateRelayState(save.storyContinuationState?.chapter09);
  return chapter.activeRun ?? createCoordinateRelayRun({ playerCallsign: save.callsign, seed: `${save.id}:coordinate-relay:${chapter.settledRunIds.length}`, startedAt: nowIso() });
}

export function CoordinateRelayScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = COORDINATE_RELAY_TEXT[language] ?? COORDINATE_RELAY_TEXT.en;
  const settledText = COORDINATE_RELAY_SETTLED_TEXT[language] ?? COORDINATE_RELAY_SETTLED_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [settlementAttempts, setSettlementAttempts] = useState(0);
  const [settlementReason, setSettlementReason] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange); onRunChangeRef.current = onRunChange;
  const clockRef = useRef(null);
  if (!clockRef.current) clockRef.current = createExpeditionActiveClock({ onElapsed(milliseconds) {
    setRun((current) => { const next = tickCoordinateRelayRun(current, { seconds: milliseconds / 1000 }, nowIso()); onRunChangeRef.current(next); return next; });
  } });
  const terminal = [COORDINATE_RELAY_PHASES.COMPLETED, COORDINATE_RELAY_PHASES.FAILED, COORDINATE_RELAY_PHASES.ABANDONED].includes(run.phase);
  const packetText = coordinatePacketText(run.packet);
  const inputPhase = [COORDINATE_RELAY_PHASES.PLAYER_READBACK, COORDINATE_RELAY_PHASES.RELAY_PACKET].includes(run.phase);
  const cw = useStructuredCwInput({
    targetText: packetText, automaticWpm: save.automaticKeyWpm, keyType: save.keyType,
    inputBlocked: inputBlocked || semanticBusy || !windowActive, enabled: inputPhase,
  });
  function update(next) { if (!next || next === run) return; setRun(next); onRunChange(next); }
  useEffect(() => { onRunChange(run); }, []);
  useEffect(() => registerExpeditionPageVisibility({ windowTarget: globalThis.window, documentTarget: globalThis.document, onActiveChange: setWindowActive }), []);
  useEffect(() => { clockRef.current.setActive(!inputBlocked && windowActive && !terminal && run.phase !== COORDINATE_RELAY_PHASES.BRIEFING); return () => clockRef.current.setActive(false); }, [inputBlocked, run.phase, terminal, windowActive]);
  useEffect(() => () => clockRef.current.dispose(), []);
  useEffect(() => { onActivityRisk(coordinateRelayLeaveRisk(run, settled)); return () => onActivityRisk("none"); }, [onActivityRisk, run, settled]);

  async function submit(value = cw.analysis.decoded) {
    if (semanticBusy || inputBlocked || !String(value).trim()) return;
    setSemanticBusy(true);
    try {
      let semantic = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message: value, phase: "EXCHANGE", selfCallsign: run.playerCallsign,
          peerCallsign: run.phase === COORDINATE_RELAY_PHASES.RELAY_PACKET ? run.relay.callsign : run.source.callsign,
          pendingQuestion: "NONE", knownSlots: ["LOCATION"],
          catalogs: { LOCATION: [run.packet.grid], REGION: ["PX"] },
        });
        if (response?.ok) semantic = response.result;
      } catch { semantic = null; }
      update(submitCoordinateRelayText(run, value, semantic, nowIso()));
      cw.clearInput();
    } finally { setSemanticBusy(false); }
  }
  function requestLeave() { coordinateRelayLeaveRisk(run, settled) === "none" ? onBack() : setLeaveOpen(true); }
  function settle() { const result = onSettle(run); setSettlementAttempts((count) => count + 1); setSettlementReason(result?.reason ?? (result?.settled ? "SETTLED" : "REJECTED")); if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true); }
  return <main className="screen coordinate-relay-screen" data-testid="coordinate-relay-screen" data-simulation="fictional-pixel-grid"
    data-coordinate-phase={run.phase} data-packet-grid={run.packet.grid} data-packet-utc={run.packet.utc}
    data-packet-check={run.packet.check} data-coordinate-paused={inputBlocked || !windowActive} data-portrait-visible="false" data-pulse-count={cw.analysis.pulseCount} data-decoded={cw.analysis.decoded} data-keying={cw.isKeying} data-settled={settled} data-settlement-attempts={settlementAttempts} data-settlement-reason={settlementReason}>
    <header className="coordinate-relay-topbar"><div><GridFour size={28} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="coordinate-relay-simulation"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <div className="coordinate-relay-paused" role="status">{t.paused}</div>}
    <section className="coordinate-relay-layout" aria-busy={inputBlocked || semanticBusy}>
      <aside className="coordinate-relay-stations"><article data-station-role="source"><Radio /><span>{t.source}</span><strong>{run.source.callsign}</strong></article><i aria-hidden="true">→</i><article data-station-role="relay"><Broadcast /><span>{t.relay}</span><strong>{run.relay.callsign}</strong></article></aside>
      <article className="coordinate-relay-console">
        <div className="coordinate-relay-meter"><Clock /><span>{t.elapsed} {Math.floor(run.elapsedMilliseconds / 1000)}s</span><b>{t.attempts} {run.attempts.filter(({ stage }) => stage === "READBACK").length}/3</b></div>
        <section className="coordinate-relay-packet"><h2>{t.packet}</h2><code>{packetText}</code><dl><dt>{t.messageId}</dt><dd>{run.packet.packetId}</dd><dt>{t.grid}</dt><dd>{run.packet.grid}</dd><dt>{t.utc}</dt><dd>{run.packet.utc}</dd><dt>{t.people}</dt><dd>{run.packet.people}</dd><dt>{t.check}</dt><dd>{String(run.packet.check).padStart(2, "0")}</dd></dl></section>
        {run.phase === COORDINATE_RELAY_PHASES.BRIEFING && <section><p>{t.briefing}</p><button data-action="coordinate-begin" disabled={inputBlocked} onClick={() => update(beginCoordinateRelayRun(run))}>{t.begin}</button></section>}
        {[COORDINATE_RELAY_PHASES.RECEIVE_PACKET, COORDINATE_RELAY_PHASES.FIELD_CORRECTION].includes(run.phase) && <button data-action="coordinate-receive" disabled={inputBlocked} onClick={() => update(receiveCoordinatePacket(run, nowIso()))}>{t.receive}</button>}
        {inputPhase && <section className="coordinate-relay-input"><h2>{run.phase === COORDINATE_RELAY_PHASES.RELAY_PACKET ? t.relayPacket : t.readback}</h2><code>{t.hint} · {packetText}</code><strong className="structured-cw-decoded">{cw.analysis.decoded || "_"}</strong><small>{save.keyType === "automatic" ? "Z · / X —" : "SPACE"} · AGN / QRS · {cw.analysis.wpm} WPM</small><div><button data-action="coordinate-clear" aria-label={t.cancel} onClick={cw.clearInput}>×</button><button data-action="coordinate-submit" disabled={inputBlocked || semanticBusy || cw.isKeying || !cw.analysis.pulseCount} onClick={() => submit()}>{t.send}</button></div></section>}
        {run.phase === COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION && <section className="coordinate-relay-confirm"><h2>{t.confirmation}</h2><code>{`QSL MSG ${run.packet.packetId} CHECK ${String(run.packet.check).padStart(2, "0")} K`}</code><button data-action="coordinate-confirm" disabled={inputBlocked} onClick={() => update(receiveRelayConfirmation(run, `QSL MSG ${run.packet.packetId} CHECK ${String(run.packet.check).padStart(2, "0")} K`, nowIso()))}>{t.receive}</button></section>}
        {run.lastError && <p className="coordinate-relay-error"><Warning />{t[run.lastError]}</p>}
        {run.phase === COORDINATE_RELAY_PHASES.COMPLETED && <section className="coordinate-relay-result"><CheckCircle size={44} /><h2>{t.completed}</h2>{settled && <p className="coordinate-relay-settlement-banner" role="status">{settledText}</p>}<button data-action="coordinate-settle" disabled={inputBlocked} onClick={settle}>{t.settle}</button></section>}
        {run.phase === COORDINATE_RELAY_PHASES.FAILED && <section className="coordinate-relay-result failed"><Warning size={44} /><h2>{t.failed}</h2><p>{t[run.failureReason]}</p><button data-action="coordinate-retry" disabled={inputBlocked} onClick={() => update(retryCoordinateRelayRun(run, nowIso()))}>{t.retry}</button></section>}
      </article>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="coordinate-relay-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="coordinate-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
