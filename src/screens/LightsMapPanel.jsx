import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, NotePencil, Sun } from "@phosphor-icons/react";
import { buildLightsMapModel } from "../game/lightsNarrative.js";

const REGION_POSITIONS = Object.freeze({
  US: [12, 42], GE: [43, 35], FI: [51, 20], CN: [68, 45], JP: [84, 42], CH: [45, 64],
});
const WEATHER_KEYS = Object.freeze({
  clear: "weatherClear", cloudy: "weatherCloudy", rain: "weatherRain",
  mist: "weatherMist", wind: "weatherWind", snow: "weatherSnow",
});
const MESSAGE_KEYS = Object.freeze({
  "lights.archive.message.clear": "messageClear",
  "lights.archive.message.steady": "messageSteady",
  "lights.archive.message.thanks": "messageThanks",
  "lights.archive.message.shared-sky": "messageSharedSky",
  "lights.archive.message.signal": "messageSignal",
  "lights.archive.message.return": "messageReturn",
});

export function LightsMapPanel({ archive, eventRunId = null, t }) {
  const initial = useMemo(() => buildLightsMapModel(archive, { eventRunId }), [archive, eventRunId]);
  const [selectedPersonId, setSelectedPersonId] = useState(initial.selected?.personId ?? null);
  useEffect(() => setSelectedPersonId(initial.selected?.personId ?? null), [initial.eventRunId]);
  const model = useMemo(() => buildLightsMapModel(archive, { eventRunId, selectedPersonId }), [archive, eventRunId, selectedPersonId]);

  function selectRegion(regionCode) {
    const light = model.lights.find((candidate) => candidate.regionCode === regionCode);
    if (light?.contacts[0]) setSelectedPersonId(light.contacts[0].personId);
  }

  return (
    <section className="lights-map-panel" data-lights-map-run={model.eventRunId ?? "none"}>
      <h2><MapPin size={16} weight="fill" />{t.mapTitle}</h2>
      <div className="lights-pixel-map" aria-label={t.mapTitle}>
        <i className="lights-map-land" aria-hidden="true" />
        {Object.entries(REGION_POSITIONS).map(([regionCode, [left, top]]) => {
          const lit = model.litRegions.includes(regionCode);
          return <button key={regionCode} type="button" disabled={!lit} className={lit ? "lit" : ""}
            style={{ left: `${left}%`, top: `${top}%` }} data-lights-region={regionCode}
            onClick={() => selectRegion(regionCode)} aria-pressed={model.selected?.eventRegionCode === regionCode}>{regionCode}</button>;
        })}
      </div>
      {!model.selected ? <p className="lights-map-empty">{t.mapEmpty}</p> : <div className="lights-contact-card">
        <div className="lights-contact-tabs">{model.lights.flatMap(({ contacts }) => contacts).map((contact) => (
          <button type="button" key={`${contact.personId}:${contact.onAirCallsign}`}
            className={contact.personId === model.selected.personId ? "selected" : ""}
            onClick={() => setSelectedPersonId(contact.personId)}>{contact.onAirCallsign}</button>
        ))}</div>
        <p><Clock size={14} /><span>{t.localTime}</span><strong>{model.selected.localDateTime} {model.selected.timeZone}</strong></p>
        <p><Sun size={14} /><span>{t.weather}</span><strong>{t[WEATHER_KEYS[model.selected.weatherCode]] ?? model.selected.weatherCode}</strong></p>
        <p><NotePencil size={14} /><span>{t.logMessage}</span><strong>{t[MESSAGE_KEYS[model.selected.messageKey]] ?? model.selected.messageKey}</strong></p>
      </div>}
    </section>
  );
}
