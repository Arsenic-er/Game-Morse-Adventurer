import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Compass, Radio, Target, X } from "@phosphor-icons/react";
import { buildOpenStationDashboard } from "../game/openStationDashboard.js";
import { OPEN_STATION_GOALS } from "../game/openStationState.js";
import { OPEN_STATION_TEXT } from "./openStationText.js";

export function OpenStationModal({ language, save, onUpdateGoal, onClose }) {
  const t = OPEN_STATION_TEXT[language] ?? OPEN_STATION_TEXT.en;
  const dashboard = useMemo(() => buildOpenStationDashboard(save), [save]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    function keydown(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);
  if (!dashboard.unlocked) return null;
  async function update(goal) {
    const result = await onUpdateGoal(goal, new Date().toISOString());
    if (result?.updated) setNotice(t.updated);
  }
  return <div className="modal-backdrop open-station-backdrop" data-testid="open-station-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="open-station-modal" data-testid="open-station-modal" role="dialog" aria-modal="true" aria-labelledby="open-station-title" data-open-station-active-goal={dashboard.activeGoal}>
      <header><Compass size={38} weight="fill" /><div><small>{t.kicker}</small><h2 id="open-station-title">{t.title}</h2></div><button className="pixel-icon-button" aria-label={t.close} onClick={onClose}><X size={20} /></button></header>
      <p>{t.intro}</p>
      <div className="open-station-goal-summary"><span>{t.firstGoal}<b>{t[dashboard.firstGoal]}</b></span><span>{t.activeGoal}<b>{t[dashboard.activeGoal]}</b></span></div>
      <div className="open-station-lines">{dashboard.lines.map(({ id, facts }) => <article key={id} data-open-station-line={id}><h3><BookOpenText size={20} weight="fill" />{t[id]}</h3><dl>{Object.entries(facts).map(([key, value]) => <div key={key}><dt>{t[key] ?? key}</dt><dd>{typeof value === "string" ? (t[value] ?? value) : value}</dd></div>)}</dl></article>)}</div>
      <fieldset><legend><Target size={18} />{t.changeGoal}</legend><div>{OPEN_STATION_GOALS.map((goal) => <button key={goal} data-action="update-open-station-goal" data-goal={goal} aria-pressed={dashboard.activeGoal === goal} onClick={() => update(goal)}>{t[goal]}</button>)}</div></fieldset>
      {notice && <p role="status">{notice}</p>}
      <section className="open-station-recent" data-testid="open-station-recent"><h3><Radio size={20} weight="fill" />{t.recent}</h3>{dashboard.recent.length ? dashboard.recent.map((entry) => <article key={entry.id}><b>{entry.callsign}</b><span>{entry.location}</span><time>{entry.completedAt}</time></article>) : <p>{t.none}</p>}</section>
    </section>
  </div>;
}
