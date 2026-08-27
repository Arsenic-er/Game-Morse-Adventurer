import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Broadcast, CheckCircle, Clock, ListNumbers, Radio, Warning } from "@phosphor-icons/react";
import {
  SERVICE_NET_PHASES, beginServiceNetRun, createServiceNetRun, normalizeServiceNetState,
  receiveServiceNetMessage, retryServiceNetRun, serviceNetMessageText, submitServiceNetText,
  tickServiceNetRun,
} from "../game/serviceNetRun.js";
import {
  createExpeditionActiveClock, expeditionPageIsActive, registerExpeditionPageVisibility,
} from "../game/expeditionLifecycle.js";
import { SERVICE_NET_TEXT, serviceNetLeaveRisk } from "./serviceNetText.js";

function nowIso() { return new Date().toISOString(); }

function initialRun(save) {
  const chapter = normalizeServiceNetState(save.storyContinuationState?.chapter08);
  if (chapter.activeRun) return chapter.activeRun;
  return createServiceNetRun({
    playerCallsign: save.callsign,
    seed: `${save.id}:service-net:${chapter.settledRunIds.length}`,
    startedAt: nowIso(),
  });
}

export function ServiceNetScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = SERVICE_NET_TEXT[language] ?? SERVICE_NET_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [message, setMessage] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [windowActive, setWindowActive] = useState(() => expeditionPageIsActive(globalThis.document));
  const onRunChangeRef = useRef(onRunChange);
  onRunChangeRef.current = onRunChange;
  const activeClockRef = useRef(null);
  if (!activeClockRef.current) {
    activeClockRef.current = createExpeditionActiveClock({
      onElapsed(milliseconds) {
        setRun((current) => {
          const next = tickServiceNetRun(current, { seconds: milliseconds / 1000, paused: false }, nowIso());
          onRunChangeRef.current(next);
          return next;
        });
      },
    });
  }
  const activeClock = activeClockRef.current;
  const current = run.currentPosition < run.priorityOrder.length
    ? run.messages[run.priorityOrder[run.currentPosition]] : null;
  const orderedMessages = useMemo(() => run.priorityOrder.map((index) => run.messages[index]), [run]);
  const terminal = [SERVICE_NET_PHASES.COMPLETED, SERVICE_NET_PHASES.FAILED, SERVICE_NET_PHASES.ABANDONED].includes(run.phase);

  function update(next) {
    if (!next || next === run) return;
    setRun(next);
    onRunChange(next);
  }

  useEffect(() => { onRunChange(run); }, []);
  useEffect(() => registerExpeditionPageVisibility({
    windowTarget: globalThis.window, documentTarget: globalThis.document, onActiveChange: setWindowActive,
  }), []);
  useEffect(() => {
    activeClock.setActive(!inputBlocked && windowActive && !terminal && run.phase !== SERVICE_NET_PHASES.BRIEFING);
    return () => activeClock.setActive(false);
  }, [activeClock, inputBlocked, run.phase, terminal, windowActive]);
  useEffect(() => () => activeClock.dispose(), [activeClock]);
  useEffect(() => {
    onActivityRisk(serviceNetLeaveRisk(run, settled));
    return () => onActivityRisk("none");
  }, [onActivityRisk, run, settled]);

  async function sendText(value = message) {
    if (semanticBusy || inputBlocked || !String(value).trim()) return;
    setSemanticBusy(true);
    try {
      let semanticResult = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message: value,
          phase: "EXCHANGE",
          selfCallsign: run.playerCallsign,
          peerCallsign: run.callsign,
          pendingQuestion: run.phase === SERVICE_NET_PHASES.CHECK_IN ? "CALLSIGN" : "NONE",
          knownSlots: ["CALLSIGN"],
          catalogs: {
            LOCATION: run.messages.map(({ messageId }) => messageId),
            REGION: run.messages.map(({ item }) => item),
          },
        });
        if (response?.ok) semanticResult = response.result;
      } catch {
        semanticResult = null;
      }
      update(submitServiceNetText(run, value, semanticResult, nowIso()));
      setMessage("");
    } finally {
      setSemanticBusy(false);
    }
  }

  function requestLeave() {
    if (serviceNetLeaveRisk(run, settled) === "none") onBack();
    else setLeaveOpen(true);
  }

  function settle() {
    const result = onSettle(run);
    if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true);
  }

  const inputHint = run.phase === SERVICE_NET_PHASES.CHECK_IN
    ? t.checkInHint.replace("{CALL}", run.playerCallsign)
    : current ? t.ackHint.replace("{MSG}", current.messageId).replace("{PRI}", current.priority) : "";

  return <main className="screen service-net-screen" data-testid="service-net-screen"
    data-service-net-phase={run.phase} data-service-message-id={current?.messageId ?? ""}
    data-service-priority={current?.priority ?? ""} data-service-receipt-count={run.receipts.length}
    data-service-paused={inputBlocked || !windowActive} data-simulation="fictional-public-service"
    data-portrait-visible="false">
    <header className="service-net-topbar"><div><Broadcast size={28} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft />{t.leave}</button></header>
    <p className="service-net-simulation"><Warning weight="fill" />{t.simulationWarning}</p>
    {(inputBlocked || !windowActive) && <div className="service-net-paused" role="status">{t.paused}</div>}
    <section className="service-net-layout" aria-busy={inputBlocked || semanticBusy}>
      <aside className="service-net-queue"><h2><ListNumbers />{t.queue}</h2>{orderedMessages.map((entry, index) => <article key={entry.messageId} data-queue-current={index === run.currentPosition}><strong>#{entry.messageId}</strong><span>{t.priority} {entry.priority}</span><small>{t[entry.item]} × {entry.quantity} · {t.people} {entry.people}</small></article>)}</aside>
      <article className="service-net-console">
        <div className="service-net-meter"><Clock /><span>{Math.floor(run.elapsedMilliseconds / 1000)}s</span><b>{t.receipts} {run.receipts.length}/3</b></div>
        {run.phase === SERVICE_NET_PHASES.BRIEFING && <section><p>{t.briefing}</p><button data-action="service-net-begin" disabled={inputBlocked} onClick={() => update(beginServiceNetRun(run))}>{t.begin}</button></section>}
        {run.phase === SERVICE_NET_PHASES.RECEIVE_MESSAGE && current && <section className="service-net-current"><h2>{t.currentMessage}</h2><code>{serviceNetMessageText(current)}</code><dl><dt>{t.priority}</dt><dd>{current.priority}</dd><dt>{t.people}</dt><dd>{current.people}</dd><dt>{t.item}</dt><dd>{t[current.item]}</dd><dt>{t.quantity}</dt><dd>{current.quantity}</dd></dl><button data-action="service-net-receive" disabled={inputBlocked} onClick={() => update(receiveServiceNetMessage(run, nowIso()))}><Radio />{t.receive}</button></section>}
        {[SERVICE_NET_PHASES.CHECK_IN, SERVICE_NET_PHASES.PLAYER_ACK].includes(run.phase) && <section className="service-net-message"><h2>{run.phase === SERVICE_NET_PHASES.CHECK_IN ? t.checkIn : t.currentMessage}</h2><code>{inputHint}</code><input value={message} maxLength={128} disabled={inputBlocked || semanticBusy} onChange={(event) => setMessage(event.target.value.toUpperCase())} aria-label={inputHint} /><button data-action="service-net-submit" disabled={inputBlocked || semanticBusy || !message.trim()} onClick={() => sendText()}>{t.send}</button>{run.phase === SERVICE_NET_PHASES.PLAYER_ACK && <div><button data-action="service-net-agn" disabled={inputBlocked || semanticBusy} onClick={() => sendText("AGN K")}>{t.agn}</button><button data-action="service-net-qrs" disabled={inputBlocked || semanticBusy} onClick={() => sendText("QRS K")}>{t.qrs}</button></div>}</section>}
        {run.errors.length > 0 && <p className="service-net-error"><Warning />{t[run.errors.at(-1)]} · {t.errors} {run.currentMessageErrors}/3</p>}
        {run.phase === SERVICE_NET_PHASES.COMPLETED && <section className="service-net-result"><CheckCircle size={44} /><h2>{t.completed}</h2><button data-action="service-net-settle" disabled={inputBlocked || settled} onClick={settle}>{t.settle}</button></section>}
        {run.phase === SERVICE_NET_PHASES.FAILED && <section className="service-net-result failed"><Warning size={44} /><h2>{t.failed}</h2><p>{t[run.failureReason]}</p><button data-action="service-net-retry" disabled={inputBlocked} onClick={() => update(retryServiceNetRun(run, nowIso()))}>{t.retry}</button></section>}
      </article>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="service-net-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="service-net-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
