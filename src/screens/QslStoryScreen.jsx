import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Broadcast, CheckCircle, FileMagnifyingGlass, Radio, Warning } from "@phosphor-icons/react";
import { QSL_CHOICES, normalizeQslRecords, verifiedExpeditionQslRecords } from "../game/qslRecords.js";
import {
  QSL_STORY_PHASES, confirmQslStoryChoice, createQslStoryRun, normalizeQslStoryState,
  receiveQslClarification, retryQslStoryRun, reviewQslAccounts, submitQslClarification,
} from "../game/qslStoryRun.js";
import { QSL_STORY_CHOICE_KEYS, QSL_STORY_TEXT, qslStoryLeaveRisk } from "./qslStoryText.js";

function nowIso() { return new Date().toISOString(); }

function sourceFor(save) {
  return verifiedExpeditionQslRecords(save).find((record) => Boolean(record.choice)) ?? null;
}

function initialRun(save) {
  const active = normalizeQslStoryState(save.storyContinuationState?.chapter07).activeRun;
  if (active) return active;
  const sourceQsl = sourceFor(save);
  return sourceQsl ? createQslStoryRun({ sourceQsl, playerCallsign: save.callsign, startedAt: nowIso() }) : null;
}

export function QslStoryScreen({
  language, save, inputBlocked = false, onActivityRisk, onRunChange, onSettle,
  onConfirmSourceChoice, onBack,
}) {
  const t = QSL_STORY_TEXT[language] ?? QSL_STORY_TEXT.en;
  const [run, setRun] = useState(() => initialRun(save));
  const [message, setMessage] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const source = useMemo(() => run
    ? normalizeQslRecords(save.qslRecords).find((record) => record.id === run.sourceQslId) ?? null
    : normalizeQslRecords(save.qslRecords)[0] ?? null, [run, save.qslRecords]);

  function update(next) {
    if (!next || next === run) return;
    setRun(next);
    onRunChange(next);
  }

  useEffect(() => { if (run) onRunChange(run); }, []);
  useEffect(() => {
    const risk = qslStoryLeaveRisk(run, settled);
    onActivityRisk(risk);
    return () => onActivityRisk("none");
  }, [onActivityRisk, run, settled]);

  function requestLeave() {
    if (qslStoryLeaveRisk(run, settled) === "none") onBack();
    else setLeaveOpen(true);
  }

  async function submit() {
    if (!run || semanticBusy || inputBlocked || !message.trim()) return;
    setSemanticBusy(true);
    try {
      let semanticResult = null;
      try {
        const response = await window.cwgameSystem?.interpretCwTraffic?.({
          message,
          phase: "EXCHANGE",
          selfCallsign: run.playerCallsign,
          peerCallsign: run.callsign,
          pendingQuestion: "QSL",
          knownSlots: ["CALLSIGN"],
          catalogs: { LOCATION: [run.caseId], ANTENNA: [] },
        });
        if (response?.ok) semanticResult = response.result;
      } catch {
        semanticResult = null;
      }
      update(submitQslClarification(run, message, semanticResult, nowIso()));
      setMessage("");
    } finally {
      setSemanticBusy(false);
    }
  }

  function settle() {
    const result = onSettle(run);
    if (result?.settled || result?.reason === "ALREADY_SETTLED") setSettled(true);
  }

  const phase = run?.phase ?? "SOURCE_REQUIRED";
  const hint = run ? t.clarificationHint.replace("{CASE}", run.caseId).replace("{CALL}", run.playerCallsign) : "";
  return <main className="screen qsl-story-screen" data-testid="qsl-story-screen" data-qsl-story-phase={phase} data-qsl-story-paused={inputBlocked} data-portrait-visible="false">
    <header className="qsl-story-topbar"><div><FileMagnifyingGlass size={28} weight="fill" /><span>{t.kicker}</span><h1>{t.title}</h1></div><b>{save.callsign}</b><button onClick={requestLeave}><ArrowLeft size={19} />{t.leave}</button></header>
    {inputBlocked && <div className="qsl-story-paused" role="status">{t.paused}</div>}
    {!run ? <section className="qsl-story-source-required"><Warning size={42} /><p>{t.sourceRequired}</p>{source && <button onClick={() => onConfirmSourceChoice(source.id, "request-review")}>{t.requestReview}</button>}</section> : <>
      <section className="qsl-story-accounts">
        <article data-player-account="true"><strong>{t.playerAccount}</strong><code>{run.playerCallsign}</code><p>{source?.playerNarrativeKey ? t.playerAccount : "QSL"} · {run.sourceQslId}</p></article>
        <article data-operator-account="true"><strong>{t.operatorAccount}</strong><code>{run.callsign}</code><p>{t.initialStance}: {t[QSL_STORY_CHOICE_KEYS[run.initialChoice]]}</p></article>
      </section>
      <section className="qsl-story-console" aria-busy={inputBlocked || semanticBusy}>
        <div className="qsl-story-case"><span>{t.case}</span><strong>{run.caseId}</strong><small>{t.errors}: {run.errors.length}/3</small></div>
        {run.phase === QSL_STORY_PHASES.CASE_OPEN && <button data-action="qsl-story-review" disabled={inputBlocked} onClick={() => update(reviewQslAccounts(run))}><FileMagnifyingGlass />{t.reviewAccounts}</button>}
        {run.phase === QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL && <section className="qsl-story-message"><h2>{t.clarification}</h2><code>{hint}</code><input value={message} maxLength={128} disabled={inputBlocked || semanticBusy} onChange={(event) => setMessage(event.target.value.toUpperCase())} aria-label={t.clarification} /><button data-action="qsl-story-submit" disabled={inputBlocked || semanticBusy || !message.trim()} onClick={submit}><Broadcast />{t.send}</button></section>}
        {run.phase === QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY && <button data-action="qsl-story-receive" disabled={inputBlocked} onClick={() => update(receiveQslClarification(run, nowIso()))}><Radio />{t.receive}</button>}
        {run.phase === QSL_STORY_PHASES.PLAYER_FINAL_CHOICE && <p className="qsl-story-reply">{t.soraReply}</p>}
        <div className="qsl-story-choices"><h2>{t.choose}</h2>{QSL_CHOICES.map((choice) => <button key={choice} data-qsl-choice={choice} disabled={inputBlocked || run.phase !== QSL_STORY_PHASES.PLAYER_FINAL_CHOICE} onClick={() => update(confirmQslStoryChoice(run, choice, nowIso()))}>{t[QSL_STORY_CHOICE_KEYS[choice]]}</button>)}</div>
        {run.errors.length > 0 && <p className="qsl-story-error"><Warning />{t[run.errors.at(-1)]}</p>}
        {run.phase === QSL_STORY_PHASES.COMPLETED && <section className="qsl-story-result"><CheckCircle size={42} /><h2>{t.success}</h2><button data-action="qsl-story-settle" disabled={inputBlocked || settled} onClick={settle}>{t.settle}</button></section>}
        {run.phase === QSL_STORY_PHASES.FAILED && <section className="qsl-story-result failed"><Warning size={42} /><h2>{t.failed}</h2><button data-action="qsl-story-retry" disabled={inputBlocked} onClick={() => update(retryQslStoryRun(run, nowIso()))}>{t.retry}</button></section>}
      </section>
    </>}
    {leaveOpen && <div className="modal-backdrop"><section className="qsl-story-leave-dialog" role="dialog" aria-modal="true"><Warning size={38} /><p>{t.leaveConfirm}</p><button onClick={() => setLeaveOpen(false)}>{t.cancel}</button><button data-action="qsl-story-confirm-leave" onClick={onBack}>{t.confirmLeave}</button></section></div>}
  </main>;
}
