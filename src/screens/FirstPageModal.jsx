import { useEffect, useMemo, useState } from "react";
import { BookOpenText, CheckCircle, Radio, X } from "@phosphor-icons/react";
import { OPEN_STATION_GOALS } from "../game/openStationState.js";
import { firstPageCandidate } from "../game/firstPageSettlement.js";
import { FIRST_PAGE_TEXT } from "./firstPageText.js";

export function FirstPageModal({ language, save, onSettle, onClose }) {
  const t = FIRST_PAGE_TEXT[language] ?? FIRST_PAGE_TEXT.en;
  const candidate = useMemo(() => firstPageCandidate(save), [save]);
  const [goal, setGoal] = useState(OPEN_STATION_GOALS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function keydown(event) { if (event.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [busy, onClose]);

  if (!candidate) return null;
  async function seal() {
    if (busy) return;
    setBusy(true);
    const result = await onSettle({ qsoId: candidate.qsoId, goal, completedAt: new Date().toISOString() });
    setBusy(false);
    if (result?.settled) onClose();
  }

  return <div className="modal-backdrop first-page-backdrop" data-testid="first-page-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="first-page-modal" data-testid="first-page-modal" role="dialog" aria-modal="true" aria-labelledby="first-page-title"
      data-first-page-qso-id={candidate.qsoId} data-first-page-goal={goal}>
      <header><BookOpenText size={36} weight="fill" /><div><small>{t.kicker}</small><h2 id="first-page-title">{t.title}</h2></div><button className="pixel-icon-button" aria-label={t.close} disabled={busy} onClick={onClose}><X size={20} /></button></header>
      <p>{t.intro}</p>
      <article className="first-page-contact"><h3><Radio size={20} weight="fill" />{t.contact}</h3><dl>
        <div><dt>{t.callsign}</dt><dd>{candidate.callsign}</dd></div><div><dt>{t.region}</dt><dd>{candidate.location}</dd></div>
        <div><dt>{t.completed}</dt><dd>{candidate.completedAt}</dd></div><div><dt>{t.reward}</dt><dd>{candidate.credits}</dd></div>
      </dl></article>
      <fieldset><legend>{t.choose}</legend><div className="first-page-goals">{OPEN_STATION_GOALS.map((id) => <button key={id} type="button"
        data-action="select-first-page-goal" data-goal={id} aria-pressed={goal === id} onClick={() => setGoal(id)}>{t[id]}</button>)}</div></fieldset>
      <button className="first-page-seal" data-action="settle-first-page" disabled={busy} onClick={seal}><CheckCircle size={20} weight="fill" />{t.seal}</button>
    </section>
  </div>;
}
