import { useEffect, useMemo } from "react";
import { ArrowLeft, Broadcast, Clock, Moon, Radio } from "@phosphor-icons/react";
import { normalizeNightOperationsState } from "../game/nightOperationsRun.js";
import { NIGHT_OPERATIONS_TEXT } from "./nightOperationsText.js";

export function StationOperationsModal({ language, records, onClose }) {
  const t = NIGHT_OPERATIONS_TEXT[language] ?? NIGHT_OPERATIONS_TEXT.en;
  const archive = useMemo(() => normalizeNightOperationsState({ archive: records }).archive, [records]);
  useEffect(() => { const close = (event) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  return <section className="modal-card station-operations-modal" data-testid="station-operations-modal" role="dialog" aria-modal="true" aria-labelledby="station-operations-title">
    <header><div><Moon size={28} weight="fill" /><h2 id="station-operations-title">{t.board}</h2></div><button onClick={onClose} aria-label={t.leave}>×</button></header>
    <div className="station-operations-records">
      {archive.length === 0 && <p>{t.board} · 0</p>}
      {[...archive].reverse().map((record) => <article key={record.id} data-operation-run-id={record.runId}>
        <header><strong>{record.playerCallsign}</strong><time dateTime={record.completedAt}><Clock />{new Date(record.completedAt).toLocaleString(language)}</time></header>
        <div>{record.contacts.map((contact) => <span key={contact.contactId}><Radio />{contact.callsign} · {contact.band} · {contact.propagationGrade}</span>)}</div>
        <small><Broadcast />{record.contacts.length}/3</small>
      </article>)}
    </div>
    <footer><button onClick={onClose}><ArrowLeft />{t.leave}</button></footer>
  </section>;
}
