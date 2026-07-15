import { useMemo, useState } from "react";
import { Check, Crosshair, MapPin, X } from "@phosphor-icons/react";
import { PropagationMap } from "./PropagationMap.jsx";
import { DEFAULT_PLAYER_LOCATION, generatePropagationMap } from "./propagationEngine.js";

const TEXT = {
  "zh-CN": { title: "选择台站位置", hint: "点击世界地图确定台站所在地", cancel: "取消", confirm: "确认位置", latitude: "纬度", longitude: "经度", presets: "预设" },
  "zh-TW": { title: "選擇臺站位置", hint: "點擊世界地圖確定臺站所在地", cancel: "取消", confirm: "確認位置", latitude: "緯度", longitude: "經度", presets: "預設" },
  ja: { title: "無線局の場所", hint: "世界地図をクリックして場所を選択", cancel: "キャンセル", confirm: "場所を確定", latitude: "緯度", longitude: "経度", presets: "プリセット" },
  en: { title: "Choose station location", hint: "Click the world map to place your station", cancel: "Cancel", confirm: "Confirm location", latitude: "Latitude", longitude: "Longitude", presets: "Presets" },
};

const PRESETS = [
  { id: "JA-ISHIKAWA", label: "ISHIKAWA / JA", latitude: 36.56, longitude: 136.65 },
  { id: "EU-C", label: "CENTRAL EU", latitude: 50.1, longitude: 8.68 },
  { id: "NA-W", label: "NORTH AMERICA W", latitude: 37.77, longitude: -122.42 },
  { id: "OC-AU", label: "AUSTRALIA E", latitude: -33.87, longitude: 151.21 },
];

function coordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

export function StationLocationModal({ language, current = DEFAULT_PLAYER_LOCATION, utc = new Date(), onConfirm, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const [draft, setDraft] = useState(current);
  const map = useMemo(() => generatePropagationMap({ playerLocation: draft, utc }), [draft, utc]);

  function selectPoint(point) {
    setDraft({ id: "CUSTOM", label: `GRID ${coordinate(point.latitude, "N", "S")} ${coordinate(point.longitude, "E", "W")}`, ...point });
  }

  return (
    <div className="modal-backdrop location-backdrop">
      <section className="location-modal" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <header>
          <div><span className="panel-kicker">STATION / GRID</span><h2 id="location-title"><MapPin size={24} weight="fill" />{t.title}</h2><p>{t.hint}</p></div>
          <button className="icon-button" aria-label={t.cancel} onClick={onClose}><X size={22} /></button>
        </header>
        <div className="location-map"><PropagationMap map={map} mode="world" onSelect={selectPoint} ariaLabel={t.title} /></div>
        <div className="location-readout">
          <span><Crosshair size={18} /><strong>{draft.label}</strong></span>
          <span>{t.latitude}: <b>{coordinate(draft.latitude, "N", "S")}</b></span>
          <span>{t.longitude}: <b>{coordinate(draft.longitude, "E", "W")}</b></span>
        </div>
        <footer>
          <div className="location-presets"><span>{t.presets}</span>{PRESETS.map((preset) => <button key={preset.id} onClick={() => setDraft(preset)} className={draft.id === preset.id ? "selected" : ""}>{preset.label}</button>)}</div>
          <button className="primary-button" onClick={() => onConfirm(draft)}><Check size={20} weight="bold" />{t.confirm}</button>
        </footer>
      </section>
    </div>
  );
}

