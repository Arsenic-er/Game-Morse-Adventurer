import { CalendarDots, Medal, SealCheck } from "@phosphor-icons/react";
import { lightsAnnualWindowModel } from "../game/lightsEventCatalog.js";
import { buildLightsHistoryModel } from "../game/lightsNarrative.js";

function gradeLabel(t, grade) {
  return t[`grade${String(grade ?? "none").replace(/^./, (value) => value.toUpperCase())}`] ?? grade;
}

function stampLabel(t, stamp) {
  if (stamp === "special") return t.stampSpecial;
  if (stamp === "standard") return t.stampStandard;
  return "—";
}

function RecordLine({ record, t }) {
  if (!record) return <p className="lights-history-empty">{t.noRecord}</p>;
  return <div className="lights-history-record" data-event-run-id={record.eventRunId}>
    <strong>{record.stationDate}</strong><span>{gradeLabel(t, record.grade)} · {record.score}</span><small>{stampLabel(t, record.stamp)}</small>
  </div>;
}

export function LightsHistoryPanel({ archive, save, now = new Date(), t }) {
  const history = buildLightsHistoryModel(archive);
  const annual = lightsAnnualWindowModel(save, now);
  return (
    <section className="lights-history-panel">
      <h2><Medal size={16} weight="fill" />{t.historyTitle}</h2>
      <div className="lights-window-card" data-lights-annual-open={annual.open}>
        <b><CalendarDots size={14} />{t.annualWindow}</b>
        <strong>{annual.open ? t.windowOpen : t.windowClosed}</strong>
        <small>{annual.timeZone}</small>
        <dl>
          <div><dt>{t.nextOpening}</dt><dd>{new Date(annual.nextOpeningAt).toLocaleString(undefined, { timeZone: annual.timeZone })}</dd></div>
          <div><dt>{t.claimedLabel}</dt><dd>{annual.claimed ? t.claimedYes : t.claimedNo}</dd></div>
          <div><dt>{t.bestGradeLabel}</dt><dd>{gradeLabel(t, annual.bestGrade)}</dd></div>
          <div><dt>{t.stampLabel}</dt><dd>{stampLabel(t, annual.stamp)}</dd></div>
        </dl>
      </div>
      <h3><SealCheck size={13} />{t.storyBestLabel}</h3><RecordLine record={history.storyBest} t={t} />
      <h3><CalendarDots size={13} />{t.annualRecordsLabel}</h3>
      <div className="lights-history-list">{history.annualRecords.length
        ? history.annualRecords.map((record) => <RecordLine key={record.eventRunId} record={record} t={t} />)
        : <p className="lights-history-empty">{t.noRecord}</p>}</div>
    </section>
  );
}
