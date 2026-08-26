import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BatteryHigh, Broadcast, CheckCircle, MapPin, Radio, Warning } from "@phosphor-icons/react";
import { EXPEDITION_SITES, createExpeditionLoadout } from "../game/expeditionCatalog.js";
import {
  advanceExpeditionSetup, attemptExpeditionSetup, beginExpeditionCq, createExpeditionRun,
  receiveExpeditionContact, requestExpeditionRecovery, retryExpeditionRun,
  selectExpeditionSite, submitExpeditionExchange,
} from "../game/expeditionRun.js";
import { EXPEDITION_TEXT, expeditionLeaveRisk, expeditionUiModel } from "./expeditionText.js";

function nowIso() { return new Date().toISOString(); }
function runId() { return globalThis.crypto?.randomUUID?.() ?? `expedition-${Date.now()}`; }

function initialRun(save) {
  return save.expeditionState?.activeRun ?? createExpeditionRun({
    runId: runId(), playerCallsign: save.callsign,
    loadout: createExpeditionLoadout(save, { source: "loan" }), startedAt: nowIso(),
  });
}

export function ExpeditionScreen({ language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle, onBack }) {
  const t = EXPEDITION_TEXT[language] ?? EXPEDITION_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [exchange, setExchange] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [semanticBusy, setSemanticBusy] = useState(false);
  const model = useMemo(() => expeditionUiModel(run, {
    language, paused: inputBlocked, ownedLoadoutAvailable: false,
  }), [inputBlocked, language, run]);

  function update(next) {
    setRun(next);
    onRunChange(next);
  }

  useEffect(() => { onRunChange(run); }, []); // Persist the newly created loan run once.
  useEffect(() => {
    const risk = settled ? "none" : expeditionLeaveRisk(run);
    onActivityRisk(risk);
    return () => onActivityRisk("none");
  }, [onActivityRisk, run, settled]);

  function requestLeave() {
    if (settled || expeditionLeaveRisk(run) === "none") onBack();
    else setLeaveOpen(true);
  }

  function callCq() {
    update(beginExpeditionCq(run, { observedAt: nowIso() }));
  }

  function copyReply() {
    update(receiveExpeditionContact(run, {
      callsign: "SIM6JP", npcId: "sora", locationId: "fictional-hill-listener",
      distanceKm: 510, sentRst: "579", receivedRst: "559", remoteWpm: 17,
      operatorProfileId: "sora-patient",
    }, nowIso()));
  }

  async function submitExchange() {
    if (semanticBusy) return;
    setSemanticBusy(true);
    try {
      let semanticResult = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message: exchange,
          phase: "EXCHANGE",
          selfCallsign: run.playerCallsign,
          peerCallsign: run.activeContact?.callsign,
          pendingQuestion: "NONE",
          knownSlots: ["CALLSIGN"],
          catalogs: {
            LOCATION: [run.fieldSite?.qthCode],
            ANTENNA: [run.loadout?.antennaCode],
          },
        });
        if (response?.ok) semanticResult = response.result;
      } catch {
        semanticResult = null;
      }
      update(submitExpeditionExchange(run, exchange, semanticResult, nowIso()));
    } finally {
      setSemanticBusy(false);
    }
  }

  function settle() {
    const result = onSettle(run);
    if (result?.settled) setSettled(true);
  }

  return <main className="screen expedition-screen" data-testid="expedition-screen" data-expedition-phase={model.phase} data-portrait-visible="false">
    <header className="expedition-topbar">
      <div><Broadcast size={28} weight="fill" /><span>CHAPTER 06</span><h1>{t.title}</h1></div>
      <b>{save.callsign}</b>
      <button data-action="expedition-back" onClick={requestLeave}><ArrowLeft size={19} />{t.leave}</button>
    </header>
    {inputBlocked && <div className="expedition-paused" role="status">{t.paused}</div>}
    <section className="expedition-console" aria-busy={inputBlocked || semanticBusy}>
      <aside className="expedition-telemetry">
        <div><BatteryHigh size={24} /><span>{t.battery}</span><strong>{model.battery.percent}%</strong><small>{model.battery.remainingWh}/{model.battery.capacityWh} Wh</small></div>
        <div><Radio size={24} /><span>{t.propagation}</span><strong>{model.propagation ? `P${model.propagation.level}` : "—"}</strong><small>{t.noise} {model.propagation?.noise ?? "—"}</small></div>
        <div><MapPin size={24} /><span>{t.result}</span><strong>{model.phaseLabel}</strong><small>{run.fieldSite?.qthCode ?? "—"}</small></div>
      </aside>
      <article className="expedition-workbench">
        {model.canSelectSite && <section className="expedition-sites"><h2>{t.chooseSite}</h2><div>{EXPEDITION_SITES.map((site) => <button key={site.id} data-action="expedition-select-site" data-site-id={site.id} disabled={inputBlocked} onClick={() => update(selectExpeditionSite(run, site.id, nowIso()))}><MapPin size={22} /><strong>{t[site.nameKey] ?? site.qthCode}</strong><small>{site.qthCode}</small></button>)}</div><p><b>{t.loan}</b> · {t.ownedUnavailable}</p></section>}
        {model.canSetup && <section className="expedition-setup"><h2>{t.setup}</h2><div>
          <button data-action="expedition-setup-antenna" disabled={inputBlocked || run.setup.antenna} onClick={() => update(advanceExpeditionSetup(run, "antenna", nowIso()))}>{run.setup.antenna ? <CheckCircle /> : <Broadcast />}{t.antennaSetup}</button>
          <button data-action="expedition-setup-power" disabled={inputBlocked || run.setup.power} onClick={() => update(advanceExpeditionSetup(run, "power", nowIso()))}>{run.setup.power ? <CheckCircle /> : <BatteryHigh />}{t.powerSetup}</button>
          <button data-action="expedition-setup-wrong" disabled={inputBlocked} onClick={() => update(attemptExpeditionSetup(run, run.setup.antenna ? "power" : "antenna", { valid: false }, nowIso()))}><Warning />{t.wrongSetup}</button>
        </div></section>}
        {model.canCallCq && <button className="expedition-primary" data-action="expedition-call-cq" disabled={inputBlocked} onClick={callCq}><Broadcast />{t.callCq}</button>}
        {model.canReceiveReply && <button className="expedition-primary" data-action="expedition-receive-reply" disabled={inputBlocked} onClick={copyReply}><Radio />{t.receiveReply}</button>}
        {model.canSendExchange && <section className="expedition-exchange"><h2>{t.exchange}</h2><p>{t.exchangeHint}</p><code>{model.exchangeHint}</code><input value={exchange} maxLength={240} disabled={inputBlocked || semanticBusy} onChange={(event) => setExchange(event.target.value.toUpperCase())} aria-label={t.exchange} /><button data-action="expedition-send-exchange" disabled={inputBlocked || semanticBusy || !exchange.trim()} onClick={submitExchange}>{t.sendExchange}</button></section>}
        {model.phase === "recovering" && <section className="expedition-recovery"><p>{model.failureText}</p><button data-action="expedition-agn" disabled={inputBlocked} onClick={() => update(requestExpeditionRecovery(run, "AGN", nowIso()))}>{t.agn}</button><button data-action="expedition-qrs" disabled={inputBlocked} onClick={() => update(requestExpeditionRecovery(run, "QRS", nowIso()))}>{t.qrs}</button></section>}
        {model.failureText && model.phase !== "recovering" && <p className="expedition-warning"><Warning />{model.failureText}</p>}
        {model.phase === "completed" && <section className="expedition-result"><CheckCircle size={44} /><h2>{t.success}</h2><button data-action="expedition-settle" disabled={inputBlocked || settled} onClick={settle}>{t.settle}</button></section>}
        {model.canRetry && <section className="expedition-result failed"><Warning size={44} /><h2>{t.failed}</h2><button data-action="expedition-retry" disabled={inputBlocked} onClick={() => update(retryExpeditionRun(run, { runId: runId(), startedAt: nowIso() }))}>{t.retry}</button></section>}
      </article>
    </section>
    {leaveOpen && <div className="modal-backdrop"><section className="expedition-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="expedition-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
