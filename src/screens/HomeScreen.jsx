import { useEffect, useState } from "react";
import {
  ArrowLeft, Broadcast, Check, GearSix, Laptop, Notebook, Package, Radio,
  Storefront, Trophy, Warehouse, Wrench, X,
} from "@phosphor-icons/react";
import { ANTENNAS, antennaName, getAntenna } from "../game/antennaCatalog.js";
import { equipmentName, getTransmitter } from "../game/equipmentCatalog.js";
import { getLocation, locationName } from "../game/locations.js";
import { LocationArtwork } from "../game/LocationArtwork.jsx";

const TEXT = {
  "zh-CN": { title: "管理中心", station: "进入发射台", warehouse: "仓库", store: "商店", log: "通联日志", achievements: "成就", placeholder: "功能占位", later: "该功能将在后续版本开放。", back: "返回存档", settings: "设置", local: "当地时间", close: "关闭" },
  "zh-TW": { title: "管理中心", station: "進入發射臺", warehouse: "倉庫", store: "商店", log: "通聯日誌", achievements: "成就", placeholder: "功能預留", later: "此功能將在後續版本開放。", back: "返回存檔", settings: "設定", local: "當地時間", close: "關閉" },
  ja: { title: "管理センター", station: "運用卓へ", warehouse: "倉庫", store: "ショップ", log: "交信ログ", achievements: "実績", placeholder: "準備中", later: "この機能は今後のバージョンで開放されます。", back: "セーブへ戻る", settings: "設定", local: "現地時刻", close: "閉じる" },
  en: { title: "Management Center", station: "Enter Station", warehouse: "Warehouse", store: "Store", log: "QSO Log", achievements: "Achievements", placeholder: "Coming Soon", later: "This feature will open in a later version.", back: "Back to Saves", settings: "Settings", local: "Local time", close: "Close" },
};

const WAREHOUSE_TEXT = {
  "zh-CN": { title: "设备仓库", rack: "设备架", radio: "电台", antenna: "天线", accessories: "配件", antennaDrawer: "天线抽屉", accessoryBar: "配件栏（预留）", later: "后续开放", current: "当前配置", fixed: "固定", replaceable: "可更换", reserved: "预留", equip: "装备", equipped: "已装备", noAntenna: "空天线槽", back: "返回管理中心", propagation: "传播修正" },
  "zh-TW": { title: "設備倉庫", rack: "設備架", radio: "電臺", antenna: "天線", accessories: "配件", antennaDrawer: "天線抽屜", accessoryBar: "配件欄（預留）", later: "後續開放", current: "目前配置", fixed: "固定", replaceable: "可更換", reserved: "預留", equip: "裝備", equipped: "已裝備", noAntenna: "空天線槽", back: "返回管理中心", propagation: "傳播修正" },
  ja: { title: "装備倉庫", rack: "装備ラック", radio: "無線機", antenna: "アンテナ", accessories: "アクセサリー", antennaDrawer: "アンテナ引出し", accessoryBar: "アクセサリー欄（予約）", later: "今後開放", current: "現在の構成", fixed: "固定", replaceable: "交換可能", reserved: "予約", equip: "装備", equipped: "装備中", noAntenna: "空きアンテナ枠", back: "管理センターへ戻る", propagation: "伝搬補正" },
  en: { title: "Equipment Warehouse", rack: "Equipment Rack", radio: "Radio", antenna: "Antenna", accessories: "Accessories", antennaDrawer: "Antenna Drawer", accessoryBar: "Accessories (Reserved)", later: "Coming later", current: "Current Loadout", fixed: "Fixed", replaceable: "Replaceable", reserved: "Reserved", equip: "Equip", equipped: "Equipped", noAntenna: "Empty antenna slot", back: "Back to Management Center", propagation: "Propagation modifier" },
};

const PANEL_ICONS = { store: Storefront, log: Notebook, achievements: Trophy };

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

function EmptyAntenna({ size = 64 }) {
  return <span className="warehouse-empty-asset" aria-hidden="true"><Broadcast size={size} /><X size={Math.round(size * .42)} weight="bold" /></span>;
}

function WarehouseModal({ language, save, onApply, onClose }) {
  const t = WAREHOUSE_TEXT[language] ?? WAREHOUSE_TEXT.en;
  const transmitter = getTransmitter(save.equipmentId);
  const equippedAntenna = getAntenna(save.antennaId);
  const [activeCategory, setActiveCategory] = useState("radio");
  const [draftAntennaId, setDraftAntennaId] = useState(save.antennaId);
  const draftAntenna = getAntenna(draftAntennaId);
  const category = activeCategory === "radio" ? {
    image: transmitter.image,
    name: equipmentName(transmitter, language),
  } : activeCategory === "antenna" ? {
    image: draftAntenna.image,
    name: antennaName(draftAntenna, language),
  } : { image: null, name: t.accessoryBar };
  const alreadyEquipped = activeCategory === "radio" || (activeCategory === "antenna" && draftAntenna.id === equippedAntenna.id);

  function chooseAntenna(antennaId) {
    setDraftAntennaId(antennaId);
    setActiveCategory("antenna");
  }

  function equipSelected() {
    if (activeCategory !== "antenna") return;
    onApply({ antennaId: draftAntenna.id });
  }

  return (
    <div className="warehouse-backdrop">
      <section className="warehouse-screen" role="dialog" aria-modal="true" aria-labelledby="warehouse-title">
        <aside className="warehouse-category-rail">
          <h2 id="warehouse-title">{t.title}</h2>
          <button className={activeCategory === "radio" ? "selected" : ""} onClick={() => setActiveCategory("radio")} aria-pressed={activeCategory === "radio"}>
            <span><img src={transmitter.image} alt="" /></span><strong>{t.radio}</strong>
          </button>
          <button className={activeCategory === "antenna" ? "selected" : ""} onClick={() => setActiveCategory("antenna")} aria-pressed={activeCategory === "antenna"}>
            <span>{equippedAntenna.image ? <img src={equippedAntenna.image} alt="" /> : <EmptyAntenna size={54} />}</span><strong>{t.antenna}</strong>
          </button>
          <button className={activeCategory === "accessories" ? "selected" : ""} onClick={() => setActiveCategory("accessories")} aria-pressed={activeCategory === "accessories"}>
            <span><Wrench size={55} weight="duotone" /></span><strong>{t.accessories}</strong>
          </button>
        </aside>

        <main className="warehouse-equipment-rack">
          <div className="rack-title"><span />{t.rack}<span /></div>
          <section className={`rack-preview category-${activeCategory}`}>
            {category.image ? <img src={category.image} alt={category.name} /> : activeCategory === "antenna" ? <EmptyAntenna size={100} /> : <Package size={104} weight="duotone" />}
            <strong>{category.name}</strong>
            <button className="rack-equip-button" disabled={activeCategory !== "antenna" || alreadyEquipped} onClick={equipSelected}><Check size={20} weight="bold" />{alreadyEquipped ? t.equipped : activeCategory === "accessories" ? t.later : t.equip}</button>
          </section>

          <section className="equipment-drawer antenna-drawer">
            <h3><span />{t.antennaDrawer}<span /></h3>
            <div>
              {ANTENNAS.map((antenna) => (
                <button key={antenna.id} data-antenna-id={antenna.id} className={draftAntenna.id === antenna.id ? "selected" : ""} aria-pressed={draftAntenna.id === antenna.id} onClick={() => chooseAntenna(antenna.id)}>
                  {antenna.image ? <img src={antenna.image} alt="" /> : <EmptyAntenna size={56} />}
                  <strong>{antenna.id === "none" ? t.noAntenna : antennaName(antenna, language)}</strong>
                  <small>{t.propagation}: {antenna.id === "none" ? "RF OFF" : `${antenna.propagationBonus > 0 ? "+" : ""}${antenna.propagationBonus}`}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="equipment-drawer accessory-drawer">
            <h3><span />{t.accessoryBar}<span /></h3>
            <div className="accessory-placeholders">
              {[0, 1, 2, 3].map((slot) => <span key={slot}><Package size={32} /><small>{t.later}</small></span>)}
            </div>
          </section>
        </main>

        <aside className="warehouse-current-loadout">
          <button className="warehouse-return" onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.back}</button>
          <header><span />{t.current}<span /></header>
          <b>{save.callsign}</b>
          <ol>
            <li><strong>1. {t.radio} ({t.fixed})</strong><div><img src={transmitter.image} alt="" /></div><small>{equipmentName(transmitter, language)}</small></li>
            <li><strong>2. {t.antenna} ({t.replaceable})</strong><div>{equippedAntenna.image ? <img src={equippedAntenna.image} alt="" /> : <EmptyAntenna size={55} />}</div><small>{antennaName(equippedAntenna, language)}</small></li>
            <li className="reserved-slot"><strong>3. {t.accessories} ({t.reserved})</strong><div><Package size={43} /></div><small>{t.later}</small></li>
          </ol>
        </aside>
      </section>
    </div>
  );
}

export function HomeScreen({ language, save, onSaveUpdate, onEnterStation, onBack, onSettings }) {
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
      {panel === "warehouse" && <WarehouseModal language={language} save={save} onApply={onSaveUpdate} onClose={() => setPanel(null)} />}
      {panel && panel !== "warehouse" && <HomePlaceholder kind={panel} language={language} onClose={() => setPanel(null)} />}
    </main>
  );
}
