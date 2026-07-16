import { useEffect, useState } from "react";
import {
  ArrowLeft, GearSix, Laptop, Notebook, Radio, Storefront, Trophy, Warehouse, X,
} from "@phosphor-icons/react";
import { getLocation, locationName } from "../game/locations.js";
import { LocationArtwork } from "../game/LocationArtwork.jsx";

const TEXT = {
  "zh-CN": { title: "管理中心", station: "进入发射台", warehouse: "仓库", store: "商店", log: "通联日志", achievements: "成就", placeholder: "功能占位", later: "该功能将在后续版本开放。", back: "返回存档", settings: "设置", local: "当地时间", close: "关闭" },
  "zh-TW": { title: "管理中心", station: "進入發射臺", warehouse: "倉庫", store: "商店", log: "通聯日誌", achievements: "成就", placeholder: "功能預留", later: "此功能將在後續版本開放。", back: "返回存檔", settings: "設定", local: "當地時間", close: "關閉" },
  ja: { title: "管理センター", station: "運用卓へ", warehouse: "倉庫", store: "ショップ", log: "交信ログ", achievements: "実績", placeholder: "準備中", later: "この機能は今後のバージョンで開放されます。", back: "セーブへ戻る", settings: "設定", local: "現地時刻", close: "閉じる" },
  en: { title: "Management Center", station: "Enter Station", warehouse: "Warehouse", store: "Store", log: "QSO Log", achievements: "Achievements", placeholder: "Coming Soon", later: "This feature will open in a later version.", back: "Back to Saves", settings: "Settings", local: "Local time", close: "Close" },
};

const PANEL_ICONS = { warehouse: Warehouse, store: Storefront, log: Notebook, achievements: Trophy };

function HomePlaceholder({ kind, language, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const Icon = PANEL_ICONS[kind] ?? Radio;
  return (
    <div className="modal-backdrop home-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="home-placeholder-modal" role="dialog" aria-modal="true" aria-labelledby="home-placeholder-title">
        <header><Icon size={26} weight="fill" /><div><span>{t.placeholder}</span><h2 id="home-placeholder-title">{t[kind]}</h2></div><button className="icon-button" onClick={onClose} aria-label={t.close}><X size={22} /></button></header>
        <div><Icon size={72} weight="duotone" /><p>{t.later}</p><code>MODULE // {kind.toUpperCase()}</code></div>
      </section>
    </div>
  );
}
export function HomeScreen({ language, save, onEnterStation, onBack, onSettings }) {
  const t = TEXT[language] ?? TEXT.en;
  const location = getLocation(save.locationId);
  const [panel, setPanel] = useState(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const localTime = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: location.timeZone });
  return (
    <main className="screen home-screen">
      <div className="home-window-slot"><LocationArtwork location={location} antennaId={save.antennaId} clock={clock} className="home-window-artwork" animated /></div>
      <img className="home-room-overlay" src="./assets/home-room-overlay.png" alt="" />
      <span className="home-lantern-flicker" aria-hidden="true" />
      <header className="home-topbar"><h1>{t.title}</h1><span><Radio size={18} weight="fill" />21.060 MHz · CW</span><b>{save.callsign}</b><span>{t.local} {localTime}</span><button onClick={onBack} aria-label={t.back}><ArrowLeft size={21} /></button><button onClick={onSettings} aria-label={t.settings}><GearSix size={21} /></button></header>

      <button className="home-hotspot hotspot-warehouse" aria-label={t.warehouse} onClick={() => setPanel("warehouse")}><span><Warehouse size={22} weight="fill" />{t.warehouse}</span></button>
      <button className="home-hotspot hotspot-station" aria-label={t.station} onClick={onEnterStation}><span><Radio size={22} weight="fill" />{t.station}</span></button>
      <button className="home-hotspot hotspot-store" aria-label={t.store} onClick={() => setPanel("store")}><span><Laptop size={22} weight="fill" />{t.store}</span></button>
      <button className="home-hotspot hotspot-log" aria-label={t.log} onClick={() => setPanel("log")}><span><Notebook size={22} weight="fill" />{t.log}</span></button>
      <button className="home-hotspot hotspot-achievements" aria-label={t.achievements} onClick={() => setPanel("achievements")}><span><Trophy size={22} weight="fill" />{t.achievements}</span></button>
      <span className="home-newspaper-callsign" aria-hidden="true">{save.callsign}</span>
      <span className="home-location-label"><Radio size={15} />{locationName(location, language)}</span>
      {panel && <HomePlaceholder kind={panel} language={language} onClose={() => setPanel(null)} />}
    </main>
  );
}
