import { useEffect, useMemo } from "react";
import { ArrowLeft, Clock, GridFour, Hash, Notebook, Users, X } from "@phosphor-icons/react";
import { normalizeCoordinateRelayState } from "../game/coordinateRelayRun.js";
import { COORDINATE_RELAY_TEXT } from "./coordinateRelayText.js";

export function StructuredMessageLogModal({ language, packets, stormRecords = [], onClose }) {
  const t = COORDINATE_RELAY_TEXT[language] ?? COORDINATE_RELAY_TEXT.en;
  const records = useMemo(() => normalizeCoordinateRelayState({ packets }).packets, [packets]);
  useEffect(() => {
    function onKeyDown(event) { if (event.key === "Escape") { event.preventDefault(); onClose(); } }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop structured-message-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="structured-message-modal" role="dialog" aria-modal="true" aria-labelledby="structured-message-title" data-testid="structured-message-log">
      <header><Notebook size={32} weight="fill" /><div><small>{t.kicker}</small><h2 id="structured-message-title">{t.packet}</h2></div><button className="icon-button" aria-label={t.leave} onClick={onClose}><X /></button></header>
      <div className="structured-message-list">
        {records.length === 0 && <p>{t.packet} · 0</p>}
        {[...records].reverse().map((record) => <article key={record.id} data-packet-id={record.packet.packetId}>
          <h3><Hash />{t.messageId} {record.packet.packetId}</h3>
          <dl>
            <dt><GridFour />{t.grid}</dt><dd>{record.packet.grid}</dd>
            <dt><Clock />{t.utc}</dt><dd>{record.packet.utc}</dd>
            <dt><Users />{t.people}</dt><dd>{record.packet.people}</dd>
            <dt>{t.check}</dt><dd>{String(record.packet.check).padStart(2, "0")}</dd>
          </dl>
          <time dateTime={record.completedAt}>{new Date(record.completedAt).toLocaleString(language)}</time>
        </article>)}
        {[...stormRecords].reverse().map((record) => <article key={record.id} data-storm-record-id={record.id}>
          <h3><Hash />MSG {record.msgId} · REV {record.revision}</h3>
          <dl>
            <dt><GridFour />{t.grid}</dt><dd>{record.grid}</dd>
            <dt><Users />{t.people}</dt><dd>{record.people}</dd>
            <dt>ITEM</dt><dd>{record.item} × {record.quantity}</dd>
            <dt>{t.check}</dt><dd>{record.check}</dd>
          </dl>
          <time dateTime={record.completedAt}>{new Date(record.completedAt).toLocaleString(language)}</time>
        </article>)}
      </div>
      <footer><button onClick={onClose}><ArrowLeft />{t.leave}</button></footer>
    </section>
  </div>;
}
