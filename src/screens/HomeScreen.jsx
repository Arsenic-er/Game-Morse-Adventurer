import { useEffect, useState } from "react";
import {
  ArrowLeft, Broadcast, Check, Coins, GearSix, Laptop, MapPin, Notebook,
  Package, Radio, Storefront, Trophy, Warehouse, Wrench, X,
} from "@phosphor-icons/react";
import { ANTENNAS, antennaName, getAntenna } from "../game/antennaCatalog.js";
import { equipmentName, getTransmitter } from "../game/equipmentCatalog.js";
import { getLocation, locationName } from "../game/locations.js";
import { LocationArtwork } from "../game/LocationArtwork.jsx";
import { StoreModal } from "./StoreModal.jsx";

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

const QSO_LOG_TEXT = {
  "zh-CN": {
    title: "通联日志", kicker: "台站记录", records: "记录", latest: "最新", dateTime: "台站当地 / UTC", callsign: "呼号",
    frequency: "频率", rst: "发送 / 接收 RST", region: "地区", distance: "距离", propagation: "传播等级", antenna: "天线",
    equipment: "设备", wpm: "速度", performance: "准确率 / 节奏", credits: "信用点", sim: "SIM · 虚构台站",
    stationTime: "台站当地", utcTime: "协调世界时",
    emptyTitle: "尚无通联记录", emptyText: "完成一次通联并保存日志后，记录会出现在这里。", back: "返回管理中心", close: "关闭通联日志",
  },
  "zh-TW": {
    title: "通聯日誌", kicker: "臺站記錄", records: "記錄", latest: "最新", dateTime: "臺站當地 / UTC", callsign: "呼號",
    frequency: "頻率", rst: "發送 / 接收 RST", region: "地區", distance: "距離", propagation: "傳播等級", antenna: "天線",
    equipment: "設備", wpm: "速度", performance: "準確率 / 節奏", credits: "信用點", sim: "SIM · 虛構臺站",
    stationTime: "臺站當地", utcTime: "協調世界時",
    emptyTitle: "尚無通聯記錄", emptyText: "完成一次通聯並儲存日誌後，記錄會顯示在這裡。", back: "返回管理中心", close: "關閉通聯日誌",
  },
  ja: {
    title: "交信ログ", kicker: "局運用記録", records: "件", latest: "最新", dateTime: "局の現地 / UTC", callsign: "コールサイン",
    frequency: "周波数", rst: "送信 / 受信 RST", region: "地域", distance: "距離", propagation: "伝搬レベル", antenna: "アンテナ",
    equipment: "無線機", wpm: "速度", performance: "正確率 / リズム", credits: "クレジット", sim: "SIM · 架空局",
    stationTime: "局の現地時刻", utcTime: "協定世界時",
    emptyTitle: "交信記録はありません", emptyText: "交信を完了してログを保存すると、ここに記録されます。", back: "管理センターへ戻る", close: "交信ログを閉じる",
  },
  en: {
    title: "QSO Log", kicker: "Station Record", records: "records", latest: "Latest", dateTime: "Station local / UTC", callsign: "Callsign",
    frequency: "Frequency", rst: "Sent / Received RST", region: "Region", distance: "Distance", propagation: "Propagation", antenna: "Antenna",
    equipment: "Equipment", wpm: "Speed", performance: "Accuracy / Rhythm", credits: "Credits", sim: "SIM · Fictional station",
    stationTime: "Station local", utcTime: "Coordinated UTC",
    emptyTitle: "No QSO records yet", emptyText: "Complete a contact and save its log to add the first record.", back: "Back to Management Center", close: "Close QSO log",
  },
};

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function formatDateTimeInZone(date, locale, timeZone) {
  return {
    date: date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit", timeZone }),
    time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }),
  };
}

function logDateTime(entry, language, stationTimeZone) {
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : language === "ja" ? "ja-JP" : "en-US";
  const raw = firstValue(entry.completedAt, entry.timestamp, entry.dateTime, entry.createdAt);
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    const local = formatDateTimeInZone(parsed, locale, stationTimeZone);
    const utc = formatDateTimeInZone(parsed, locale, "UTC");
    return {
      timestamp: parsed.getTime(),
      date: local.date,
      time: local.time,
      local,
      utc,
      timeZone: stationTimeZone,
    };
  }
  const local = { date: firstValue(entry.date, "----/--/--"), time: firstValue(entry.time, "--:--") };
  return { timestamp: null, date: local.date, time: local.time, local, utc: { date: "—", time: "—" }, timeZone: stationTimeZone };
}

function formatMetric(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "—";
  const text = String(value);
  return suffix && !text.toLowerCase().endsWith(suffix.toLowerCase()) ? `${text}${suffix}` : text;
}

function formatCredits(value) {
  const text = formatMetric(value);
  return text === "—" ? text : `+${text}`;
}

function antennaSnapshotName(entry, language) {
  const explicit = firstValue(entry.antennaName, entry.antennaLabel);
  if (explicit) return explicit;
  const antennaId = firstValue(entry.antennaId, entry.antenna);
  const item = ANTENNAS.find((antenna) => antenna.id === antennaId);
  return item ? antennaName(item, language) : "—";
}

function equipmentSnapshotName(entry, language) {
  const explicit = firstValue(entry.equipmentName, entry.equipmentLabel);
  if (explicit) return explicit;
  const equipmentId = firstValue(entry.equipmentId, entry.equipment);
  return equipmentId ? equipmentName(getTransmitter(equipmentId), language) : "—";
}

function QsoLogModal({ language, save, onClose }) {
  const t = QSO_LOG_TEXT[language] ?? QSO_LOG_TEXT.en;
  const stationLocation = getLocation(save.locationId);
  const stationTimeZone = stationLocation.timeZone;
  const source = Array.isArray(save.qsoLogs) ? save.qsoLogs.filter((entry) => entry && typeof entry === "object") : [];
  const records = source.map((entry, index) => ({
    entry,
    originalIndex: index,
    key: String(firstValue(entry.id, entry.completedAt, entry.timestamp, `${entry.callsign ?? "QSO"}-${index}`)),
    dateTime: logDateTime(entry, language, stationTimeZone),
  })).sort((left, right) => {
    if (left.dateTime.timestamp !== null && right.dateTime.timestamp !== null) return right.dateTime.timestamp - left.dateTime.timestamp;
    if (left.dateTime.timestamp !== null) return -1;
    if (right.dateTime.timestamp !== null) return 1;
    return left.originalIndex - right.originalIndex;
  });
  const [selectedKey, setSelectedKey] = useState(() => records[0]?.key ?? null);
  const selectedRecord = records.find((record) => record.key === selectedKey) ?? records[0] ?? null;
  const selected = selectedRecord?.entry ?? null;

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const distance = selected ? firstValue(selected.distanceKm, selected.distance) : null;
  const propagation = selected ? firstValue(selected.finalPropagationLevel, selected.propagationLevel, selected.finalLevel, selected.level) : null;
  const accuracy = selected ? firstValue(selected.accuracy, selected.copyAccuracy) : null;
  const rhythm = selected ? firstValue(selected.rhythm, selected.keyingScore, selected.rhythmScore) : null;
  const isSim = selected ? firstValue(selected.isFictional, selected.sim, true) !== false : true;

  return (
    <div className="modal-backdrop home-modal-backdrop qso-log-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="qso-log-modal" role="dialog" aria-modal="true" aria-labelledby="qso-log-title">
        <header>
          <Notebook size={30} weight="fill" />
          <div><span>{t.kicker} // {save.callsign}</span><h2 id="qso-log-title">{t.title}</h2></div>
          <b>LOG // {String(records.length).padStart(3, "0")}</b>
          <button className="icon-button" onClick={onClose} aria-label={t.close}><X size={22} /></button>
        </header>

        {!records.length ? (
          <div className="qso-log-empty">
            <span><Notebook size={76} weight="duotone" /></span>
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyText}</p>
            <code>{save.callsign} // LOG 000</code>
          </div>
        ) : (
          <div className="qso-log-body">
            <aside className="qso-log-index" aria-label={t.records}>
              <div className="qso-log-index-heading"><span>{t.dateTime}</span><span>{t.callsign}</span><span>{t.credits}</span></div>
              <div className="qso-log-records" role="listbox" aria-label={t.title}>
                {records.map((record, index) => (
                  <button key={record.key} className={record.key === selectedRecord.key ? "selected" : ""} role="option" aria-selected={record.key === selectedRecord.key} onClick={() => setSelectedKey(record.key)}>
                    <span><small>{t.stationTime} · {record.dateTime.local.date}</small><strong>{record.dateTime.local.time}</strong><i>UTC · {record.dateTime.utc.date} {record.dateTime.utc.time}</i></span>
                    <b>{formatMetric(record.entry.callsign)}</b>
                    <em>{index === 0 && <small>{t.latest}</small>}{formatCredits(firstValue(record.entry.credits, record.entry.creditsAwarded))}</em>
                  </button>
                ))}
              </div>
            </aside>

            <article className="qso-log-detail">
              <div className="qso-log-hero">
                <div>
                  <span className="qso-log-local-time"><b>{t.stationTime}</b>{selectedRecord.dateTime.local.date} · {selectedRecord.dateTime.local.time}<i>{selectedRecord.dateTime.timeZone}</i></span>
                  <span className="qso-log-utc-time"><b>{t.utcTime}</b>{selectedRecord.dateTime.utc.date} · {selectedRecord.dateTime.utc.time} UTC</span>
                  <h3>{formatMetric(selected.callsign)}</h3>
                </div>
                <div className="qso-log-frequency"><small>{t.frequency}</small><strong>{formatMetric(firstValue(selected.frequencyMhz, selected.frequency), " MHz")}</strong><span>{formatMetric(selected.mode)}</span></div>
                {isSim && <span className="qso-log-sim-badge">{t.sim}</span>}
              </div>

              <dl className="qso-log-facts">
                <div><dt>{t.rst}</dt><dd>{formatMetric(firstValue(selected.sent, selected.rstSent))} / {formatMetric(firstValue(selected.received, selected.rstReceived))}</dd></div>
                <div><dt>{t.region}</dt><dd><MapPin size={16} weight="fill" />{formatMetric(firstValue(selected.region, selected.regionId, selected.location))}</dd></div>
                <div><dt>{t.distance}</dt><dd>{formatMetric(distance, " km")}</dd></div>
                <div><dt>{t.propagation}</dt><dd><Broadcast size={16} weight="fill" />{propagation === null || propagation === undefined ? "—" : formatMetric(propagation, "").startsWith("P") ? formatMetric(propagation) : `P${formatMetric(propagation)}`}</dd></div>
                <div><dt>{t.antenna}</dt><dd><Wrench size={16} />{antennaSnapshotName(selected, language)}</dd></div>
                <div><dt>{t.equipment}</dt><dd><Radio size={16} weight="fill" />{equipmentSnapshotName(selected, language)}</dd></div>
                <div><dt>{t.wpm}</dt><dd>{formatMetric(firstValue(selected.wpm, selected.speedWpm), " WPM")}</dd></div>
                <div><dt>{t.performance}</dt><dd>{formatMetric(accuracy, "%")} / {formatMetric(rhythm, "%")}</dd></div>
                <div className="qso-log-credit-fact"><dt>{t.credits}</dt><dd><Coins size={17} weight="fill" />{formatCredits(firstValue(selected.credits, selected.creditsAwarded))}</dd></div>
              </dl>
            </article>
          </div>
        )}

        <footer><span>{String(records.length).padStart(3, "0")} {t.records} · {save.callsign}</span><button className="qso-log-return" onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.back}</button></footer>
      </section>
    </div>
  );
}

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

function WarehouseModal({ language, save, onEquipItem, onClose }) {
  const t = WAREHOUSE_TEXT[language] ?? WAREHOUSE_TEXT.en;
  const transmitter = getTransmitter(save.equipmentId);
  const equippedAntenna = getAntenna(save.antennaId);
  const [activeCategory, setActiveCategory] = useState("radio");
  const [draftAntennaId, setDraftAntennaId] = useState(save.antennaId);
  const draftAntenna = getAntenna(draftAntennaId);
  const availableAntennas = ANTENNAS.filter((antenna) => antenna.id === "none" || save.ownedAntennas.includes(antenna.id));
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
    onEquipItem({ category: "antenna", itemId: draftAntenna.id });
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="warehouse-backdrop">
      <section className="warehouse-screen" data-testid="warehouse-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-title">
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
            <button className="rack-equip-button" data-action="equip-item" data-equipped-item-id={draftAntenna.id} disabled={activeCategory !== "antenna" || alreadyEquipped} onClick={equipSelected}><Check size={20} weight="bold" />{alreadyEquipped ? t.equipped : activeCategory === "accessories" ? t.later : t.equip}</button>
          </section>

          <section className="equipment-drawer antenna-drawer">
            <h3><span />{t.antennaDrawer}<span /></h3>
            <div>
              {availableAntennas.map((antenna) => (
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

export function HomeScreen({ language, save, onPurchase, onEquipItem, onEnterStation, onBack, onSettings }) {
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
      <button className="home-hotspot hotspot-store" data-action="open-store" aria-label={t.store} onClick={() => setPanel("store")}><span><Laptop size={22} weight="fill" />{t.store}</span></button>
      <button className="home-hotspot hotspot-log" aria-label={t.log} onClick={() => setPanel("log")}><span><Notebook size={22} weight="fill" />{t.log}</span></button>
      <button className="home-hotspot hotspot-achievements" aria-label={t.achievements} onClick={() => setPanel("achievements")}><span><Trophy size={22} weight="fill" />{t.achievements}</span></button>
      <span className="home-newspaper-callsign" aria-hidden="true">{save.callsign}</span>
      <span className="home-location-label"><Radio size={15} />{locationName(location, language)}</span>
      {panel === "warehouse" && <WarehouseModal language={language} save={save} onEquipItem={onEquipItem} onClose={() => setPanel(null)} />}
      {panel === "store" && <StoreModal language={language} save={save} onPurchase={onPurchase} onClose={() => setPanel(null)} />}
      {panel === "log" && <QsoLogModal language={language} save={save} onClose={() => setPanel(null)} />}
      {panel && !["warehouse", "store", "log"].includes(panel) && <HomePlaceholder kind={panel} language={language} onClose={() => setPanel(null)} />}
    </main>
  );
}
