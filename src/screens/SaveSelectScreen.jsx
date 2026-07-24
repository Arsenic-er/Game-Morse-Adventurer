import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Coins, DownloadSimple, FloppyDisk, MapPin, Plus, Radio, Trash,
} from "@phosphor-icons/react";
import { antennaName, getAntenna } from "../game/antennaCatalog.js";
import { equipmentName, getKeyOption } from "../game/equipmentCatalog.js";
import { LocationArtwork } from "../game/LocationArtwork.jsx";
import { LOCATIONS, REGION_ORDER, getLocation, locationName, regionName } from "../game/locations.js";
import { MAX_SAVE_SLOTS, createSave, formatSaveTime, isValidCallsign, sanitizeCallsign } from "../game/saveStore.js";

const TEXT = {
  "zh-CN": {
    title: "读取存档", save: "存档", empty: "空存档·新建", lastSaved: "最后保存", callsign: "呼号", equipment: "设备",
    antenna: "天线", credits: "信用点", location: "初始地点", load: "载入存档", create: "建立并载入", back: "返回",
    enterCall: "输入电台呼号", callRule: "仅限 A–Z / 0–9，最多 7 位，自动转为大写", chooseRegion: "选择地区", chooseLocation: "选择地点",
    chooseAntenna: "初始天线", starterIncluded: "初始装备已包含半波偶极天线", noSave: "选择一个空存档开始新的值守记录", delete: "删除存档", deleteConfirm: "确定删除这个存档吗？",
  },
  "zh-TW": {
    title: "讀取存檔", save: "存檔", empty: "空存檔·新建", lastSaved: "最後儲存", callsign: "呼號", equipment: "設備",
    antenna: "天線", credits: "信用點", location: "初始地點", load: "載入存檔", create: "建立並載入", back: "返回",
    enterCall: "輸入電臺呼號", callRule: "僅限 A–Z / 0–9，最多 7 位，自動轉為大寫", chooseRegion: "選擇地區", chooseLocation: "選擇地點",
    chooseAntenna: "初始天線", starterIncluded: "初始裝備已包含半波偶極天線", noSave: "選擇一個空存檔開始新的值守記錄", delete: "刪除存檔", deleteConfirm: "確定刪除這個存檔嗎？",
  },
  ja: {
    title: "セーブ選択", save: "セーブ", empty: "空き·新規", lastSaved: "最終保存", callsign: "コールサイン", equipment: "装置",
    antenna: "アンテナ", credits: "クレジット", location: "開始地点", load: "ロード", create: "作成して開始", back: "戻る",
    enterCall: "コールサインを入力", callRule: "A–Z / 0–9 のみ、最大7文字、自動大文字", chooseRegion: "地域を選択", chooseLocation: "地点を選択",
    chooseAntenna: "初期アンテナ", starterIncluded: "初期装備に半波長ダイポールが含まれます", noSave: "空きスロットから新しい運用記録を作成", delete: "セーブ削除", deleteConfirm: "このセーブを削除しますか？",
  },
  en: {
    title: "Load Save", save: "Save", empty: "Empty · New", lastSaved: "Last saved", callsign: "Callsign", equipment: "Equipment",
    antenna: "Antenna", credits: "Credits", location: "Starting location", load: "Load Save", create: "Create & Load", back: "Back",
    enterCall: "Enter station callsign", callRule: "A–Z / 0–9 only, maximum 7 characters, auto uppercase", chooseRegion: "Choose region", chooseLocation: "Choose location",
    chooseAntenna: "Starting antenna", starterIncluded: "A half-wave dipole is included with the starter station", noSave: "Choose an empty slot to begin a new station record", delete: "Delete save", deleteConfirm: "Delete this save?",
  },
};

export function SaveSelectScreen({ language, saves, activeSaveId, onLoad, onCreate, onDelete, onBack }) {
  const t = TEXT[language] ?? TEXT.en;
  const firstEmpty = Math.min(saves.length, MAX_SAVE_SLOTS - 1);
  const [selectedSlot, setSelectedSlot] = useState(() => {
    const activeIndex = saves.findIndex((save) => save.id === activeSaveId);
    return activeIndex >= 0 ? activeIndex : saves.length ? 0 : firstEmpty;
  });
  const [callsign, setCallsign] = useState("");
  const [region, setRegion] = useState("japan");
  const [locationId, setLocationId] = useState(LOCATIONS[0].id);
  const slots = Array.from({ length: MAX_SAVE_SLOTS }, (_, index) => saves[index] ?? null);
  const selectedSave = slots[selectedSlot];
  const selectedLocation = getLocation(selectedSave?.locationId ?? locationId);
  const selectedAntenna = getAntenna(selectedSave?.antennaId ?? "dipole");
  const regionLocations = useMemo(() => LOCATIONS.filter((location) => location.region === region), [region]);

  useEffect(() => {
    if (!regionLocations.some((location) => location.id === locationId)) setLocationId(regionLocations[0].id);
  }, [locationId, regionLocations]);

  function createCurrentSave() {
    if (!isValidCallsign(callsign) || saves.length >= MAX_SAVE_SLOTS) return;
    onCreate(createSave({ callsign, locationId }));
  }

  function removeCurrentSave() {
    if (!selectedSave || !window.confirm(t.deleteConfirm)) return;
    onDelete(selectedSave.id);
    setSelectedSlot(Math.max(0, selectedSlot - 1));
  }

  return (
    <main className="screen save-select-screen">
      <div className="save-binder-background" style={{ backgroundImage: "url(./assets/save-binder-bg.png)" }} aria-hidden="true" />
      <header className="save-topbar">
        <button className="save-back-icon" onClick={onBack} aria-label={t.back}><ArrowLeft size={27} weight="bold" /></button>
        <h1>{t.title}</h1>
        <span><Radio size={19} weight="fill" />21.060 MHz · CW</span>
        <b>{selectedSave?.callsign || sanitizeCallsign(callsign) || "-------"}</b>
      </header>

      <div className="save-layout">
        <section className="save-slot-list" aria-label={t.title}>
          {slots.map((save, index) => {
            const location = save ? getLocation(save.locationId) : null;
            return (
              <button key={save?.id ?? `empty-${index}`} className={`qsl-slot ${selectedSlot === index ? "selected" : ""} ${save ? "occupied" : "empty"}`} onClick={() => setSelectedSlot(index)}>
                {save ? <>
                  <LocationArtwork location={location} antennaId={save.antennaId} className="slot-scene" />
                  <strong>{save.callsign}</strong>
                  <span>{locationName(location, language)}</span>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </> : <>
                  <Plus size={28} weight="bold" />
                  <strong>{t.empty}</strong>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </>}
              </button>
            );
          })}
        </section>

        <section className="save-detail-page">
          {selectedSave ? <>
            <div className="save-page-heading"><span>{t.save} {String(selectedSlot + 1).padStart(2, "0")}</span><span>{t.lastSaved}: {formatSaveTime(selectedSave.updatedAt, language)}</span></div>
            <div className="save-page-hero">
              <LocationArtwork location={selectedLocation} antennaId={selectedSave.antennaId} className="save-hero-scene" />
              <div className="save-call-lockup"><h2>{selectedSave.callsign}</h2><p><MapPin size={17} weight="fill" />{locationName(selectedLocation, language)}</p></div>
            </div>
            <dl className="save-facts">
              <div><dt><Radio size={22} />{t.equipment}</dt><dd>SQUID-01 · {equipmentName(getKeyOption(selectedSave.keyType), language)}</dd></div>
              <div><dt><Radio size={22} />{t.antenna}</dt><dd>{antennaName(selectedAntenna, language)}</dd></div>
              <div><dt><Coins size={22} />{t.credits}</dt><dd>{selectedSave.credits.toLocaleString()}</dd></div>
            </dl>
          </> : <>
            <div className="save-page-heading"><span>{t.empty}</span><span>{t.noSave}</span></div>
            <form className="new-save-form" onSubmit={(event) => { event.preventDefault(); createCurrentSave(); }}>
              <label className="callsign-field">
                <span>{t.enterCall}</span>
                <input value={callsign} maxLength={7} inputMode="text" autoCapitalize="characters" spellCheck="false" placeholder="-------" onChange={(event) => setCallsign(sanitizeCallsign(event.target.value))} autoFocus />
                <small>{t.callRule}</small>
              </label>
              <fieldset className="region-picker"><legend>{t.chooseRegion}</legend>{REGION_ORDER.map((regionId) => <button type="button" key={regionId} className={region === regionId ? "selected" : ""} onClick={() => setRegion(regionId)}>{regionName(regionId, language)}</button>)}</fieldset>
              <fieldset className="location-picker"><legend>{t.chooseLocation}</legend>{regionLocations.map((location) => <button type="button" key={location.id} className={locationId === location.id ? "selected" : ""} onClick={() => setLocationId(location.id)}><img src={location.scene} alt="" /><span>{locationName(location, language)}</span></button>)}</fieldset>
              <div className="starter-loadout"><Radio size={22} weight="fill" /><span><strong>{t.chooseAntenna}</strong><small>{t.starterIncluded}</small></span></div>
            </form>
          </>}
        </section>
      </div>

      <footer className="save-actions-bar">
        <span className="save-slot-count"><FloppyDisk size={18} />{saves.length} / {MAX_SAVE_SLOTS}</span>
        <div>
          {selectedSave && <button className="delete-save-button" onClick={removeCurrentSave}><Trash size={20} />{t.delete}</button>}
          <button className="save-primary-action" disabled={selectedSave ? false : !isValidCallsign(callsign)} onClick={() => selectedSave ? onLoad(selectedSave.id) : createCurrentSave()}>
            {selectedSave ? <DownloadSimple size={23} weight="bold" /> : <Plus size={23} weight="bold" />}{selectedSave ? t.load : t.create}
          </button>
          <button onClick={onBack}><ArrowLeft size={21} />{t.back}</button>
        </div>
      </footer>
    </main>
  );
}
