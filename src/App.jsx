import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise, ArrowLeft, BookOpenText, Broadcast, Check, FloppyDisk, GearSix,
  GlobeHemisphereWest, GridFour, Lightning, MapTrifold, Play,
  Power, Radio, Translate, X,
} from "@phosphor-icons/react";
import { useCwCore } from "./cw/useCwCore.js";
import { tailPreview } from "./cw/display.js";
import { PracticeScreen } from "./practice/PracticeScreen.jsx";
import { PropagationMap } from "./propagation/PropagationMap.jsx";
import { StationLocationModal } from "./propagation/StationLocationModal.jsx";
import {
  DEFAULT_PLAYER_LOCATION, channelProfileForLevel, generatePropagationMap, selectNpcForQso,
} from "./propagation/propagationEngine.js";
import {
  QSO_PHASES, createQso, createQsoLogEntry, onNpcPlaybackFinished,
  qsoCanAcceptPlayer, qsoNeedsNpcPlayback, restartQso, submitPlayerMessage,
} from "./qso/qsoEngine.js";

const ASSETS = {
  room: "./assets/radio-room-bg.png",
  board: "./assets/squid01-board.png",
  manual: "./assets/manual-key.png",
  automatic: "./assets/automatic-key.png",
  world: "./assets/world-map.png",
  propagation: "./assets/propagation-map.png",
};

const LANGUAGES = [
  { id: "zh-CN", label: "简体中文", short: "简" },
  { id: "zh-TW", label: "繁體中文", short: "繁" },
  { id: "ja", label: "日本語", short: "日" },
  { id: "en", label: "English", short: "EN" },
];

const COPY = {
  "zh-CN": {
    subtitle: "业余无线电台站模拟", newGame: "开始值守", continue: "继续值守", practice: "CW 练习台", fieldGuide: "台站手册", callsignDisclaimer: "本游戏内所有呼号均与现实生活中的真实呼号无关，如有雷同，纯属巧合。",
    prototype: "M5 完整原型", language: "语言", settings: "设置", close: "关闭", interface: "界面语言",
    keyType: "电键类型", manual: "手键", automatic: "自动键", manualHint: "按住空格键发射",
    automaticHint: "Z / X 控制双桨", apply: "应用设置", station: "值守台", log: "通联日志", time: "时间",
    call: "呼号", frequency: "频率", mode: "模式", contact: "当前通联", sent: "发送", received: "接收",
    location: "位置", notes: "备注", newContact: "新建通联", delete: "删除", propagation: "传播预览",
    openMap: "打开传播大图", detected: "系统自动识别", detectedSpeed: "识别速度", tx: "发射", idle: "接收中",
    reply: "回应", send: "发送", saveLog: "保存日志", saved: "日志已保存", map: "传播地图",
    worldMode: "普通世界地图", heatMode: "传播等级地图", legend: "传播等级", back: "返回开始界面",
    qsoReady: "等待对方台结束呼叫…", qsoReply: "正在发送回应…", qsoSent: "回应已发出，等待回报…",
    noControls: "套件无可调音调与速度控制", playCq: "播放 CQ", replayInput: "回放输入", target: "目标",
    decoded: "解码", accuracy: "正确率", rhythm: "节奏", powerOn: "开机", powerOff: "关机", cwReady: "CW 核心就绪", cwPlaying: "正在播放标准 CQ",
    cwKeying: "正在记录发报", cwReplay: "正在回放输入", cwCaptured: "输入已记录", cwReceiving: "接收 CW",
    playNpc: "播放对方", submitReply: "发送回应", restartQso: "重新开始", credits: "信用点", sim: "虚构台站", propLevel: "传播等级",
    phaseWaiting: "等待播放 NPC 呼叫", phaseReply: "请发送双方呼号", phaseNpcRst: "等待播放对方 RST", phasePlayerRst: "请发送 RST 与 73",
    phaseFinal: "等待播放 73 / SK", phaseComplete: "通联完成，可写入日志", phaseFailed: "通联失败，请重新开始", invalidReply: "回应格式不正确",
  },
  "zh-TW": {
    subtitle: "業餘無線電臺站模擬", newGame: "開始值守", continue: "繼續值守", practice: "CW 練習臺", fieldGuide: "臺站手冊", callsignDisclaimer: "本遊戲內所有呼號均與現實生活中的真實呼號無關，如有雷同，純屬巧合。",
    prototype: "M5 完整原型", language: "語言", settings: "設定", close: "關閉", interface: "介面語言",
    keyType: "電鍵類型", manual: "手鍵", automatic: "自動鍵", manualHint: "按住空白鍵發射",
    automaticHint: "Z / X 控制雙槳", apply: "套用設定", station: "值守臺", log: "通聯日誌", time: "時間",
    call: "呼號", frequency: "頻率", mode: "模式", contact: "目前通聯", sent: "發送", received: "接收",
    location: "位置", notes: "備註", newContact: "新建通聯", delete: "刪除", propagation: "傳播預覽",
    openMap: "開啟傳播大圖", detected: "系統自動識別", detectedSpeed: "識別速度", tx: "發射", idle: "接收中",
    reply: "回應", send: "發送", saveLog: "儲存日誌", saved: "日誌已儲存", map: "傳播地圖",
    worldMode: "普通世界地圖", heatMode: "傳播等級地圖", legend: "傳播等級", back: "返回開始介面",
    qsoReady: "等待對方臺結束呼叫…", qsoReply: "正在發送回應…", qsoSent: "回應已發出，等待回報…",
    noControls: "套件沒有可調音調與速度控制", playCq: "播放 CQ", replayInput: "重播輸入", target: "目標",
    decoded: "解碼", accuracy: "正確率", rhythm: "節奏", powerOn: "開機", powerOff: "關機", cwReady: "CW 核心就緒", cwPlaying: "正在播放標準 CQ",
    cwKeying: "正在記錄發報", cwReplay: "正在重播輸入", cwCaptured: "輸入已記錄", cwReceiving: "接收 CW",
    playNpc: "播放對方", submitReply: "發送回應", restartQso: "重新開始", credits: "信用點", sim: "虛構臺站", propLevel: "傳播等級",
    phaseWaiting: "等待播放 NPC 呼叫", phaseReply: "請發送雙方呼號", phaseNpcRst: "等待播放對方 RST", phasePlayerRst: "請發送 RST 與 73",
    phaseFinal: "等待播放 73 / SK", phaseComplete: "通聯完成，可寫入日誌", phaseFailed: "通聯失敗，請重新開始", invalidReply: "回應格式不正確",
  },
  ja: {
    subtitle: "アマチュア無線局シミュレーター", newGame: "運用を開始", continue: "運用を続ける", practice: "CW 練習台", fieldGuide: "局運用ガイド", callsignDisclaimer: "ゲーム内のコールサインは実在するコールサインとは無関係です。類似があってもすべて偶然です。",
    prototype: "M5 完成プロトタイプ", language: "言語", settings: "設定", close: "閉じる", interface: "表示言語",
    keyType: "電鍵タイプ", manual: "縦振り電鍵", automatic: "オートキー", manualHint: "スペースを押して送信",
    automaticHint: "Z / X でパドル操作", apply: "設定を適用", station: "運用卓", log: "交信ログ", time: "時刻",
    call: "コール", frequency: "周波数", mode: "モード", contact: "現在の交信", sent: "送信", received: "受信",
    location: "位置", notes: "メモ", newContact: "新規交信", delete: "削除", propagation: "伝搬プレビュー",
    openMap: "伝搬マップを開く", detected: "システム自動認識", detectedSpeed: "認識速度", tx: "送信", idle: "受信中",
    reply: "応答", send: "送信", saveLog: "ログ保存", saved: "ログを保存しました", map: "伝搬マップ",
    worldMode: "通常の世界地図", heatMode: "伝搬レベル地図", legend: "伝搬レベル", back: "開始画面へ戻る",
    qsoReady: "相手局の呼出終了を待っています…", qsoReply: "応答を送信中…", qsoSent: "応答を送信しました。レポート待ち…",
    noControls: "音程・速度の調整機能はありません", playCq: "CQ を再生", replayInput: "入力を再生", target: "目標",
    decoded: "復号", accuracy: "正確率", rhythm: "リズム", powerOn: "電源オン", powerOff: "電源オフ", cwReady: "CW コア準備完了", cwPlaying: "標準 CQ を再生中",
    cwKeying: "送信を記録中", cwReplay: "入力を再生中", cwCaptured: "入力を記録しました", cwReceiving: "CW 受信中",
    playNpc: "相手局を再生", submitReply: "応答を送信", restartQso: "やり直す", credits: "クレジット", sim: "架空局", propLevel: "伝搬レベル",
    phaseWaiting: "NPC の CQ を再生してください", phaseReply: "両局のコールを送信", phaseNpcRst: "相手局の RST を再生", phasePlayerRst: "RST と 73 を送信",
    phaseFinal: "73 / SK を再生", phaseComplete: "交信完了・ログ保存可能", phaseFailed: "交信失敗・やり直してください", invalidReply: "応答形式が正しくありません",
  },
  en: {
    subtitle: "Amateur Radio Station Simulator", newGame: "Begin Watch", continue: "Continue Watch", practice: "CW Practice", fieldGuide: "Station Manual", callsignDisclaimer: "All callsigns in this game are unrelated to real-world callsigns. Any resemblance is purely coincidental.",
    prototype: "M5 Complete Prototype", language: "Language", settings: "Settings", close: "Close", interface: "Interface language",
    keyType: "Key type", manual: "Straight key", automatic: "Automatic paddle", manualHint: "Hold Space to transmit",
    automaticHint: "Use Z / X for paddles", apply: "Apply settings", station: "Station watch", log: "QSO log", time: "Time",
    call: "Callsign", frequency: "Frequency", mode: "Mode", contact: "Current QSO", sent: "Sent", received: "Received",
    location: "Location", notes: "Notes", newContact: "New QSO", delete: "Delete", propagation: "Propagation",
    openMap: "Open propagation map", detected: "System auto detect", detectedSpeed: "Detected speed", tx: "Transmit", idle: "Receiving",
    reply: "Reply", send: "Send", saveLog: "Save log", saved: "Log saved", map: "Propagation map",
    worldMode: "Normal world map", heatMode: "Propagation level map", legend: "Propagation level", back: "Back to title",
    qsoReady: "Waiting for the calling station…", qsoReply: "Sending reply…", qsoSent: "Reply sent. Waiting for report…",
    noControls: "The kit has no tone or speed controls", playCq: "Play CQ", replayInput: "Replay input", target: "Target",
    decoded: "Decoded", accuracy: "Accuracy", rhythm: "Rhythm", powerOn: "Power on", powerOff: "Power off", cwReady: "CW core ready", cwPlaying: "Playing standard CQ",
    cwKeying: "Recording keying", cwReplay: "Replaying input", cwCaptured: "Input captured", cwReceiving: "Receiving CW",
    playNpc: "Play station", submitReply: "Send reply", restartQso: "Restart", credits: "Credits", sim: "Fictional station", propLevel: "Propagation level",
    phaseWaiting: "Play the NPC calling message", phaseReply: "Send both callsigns", phaseNpcRst: "Play the NPC RST", phasePlayerRst: "Send RST and 73",
    phaseFinal: "Play 73 / SK", phaseComplete: "QSO complete; save the log", phaseFailed: "QSO failed; restart", invalidReply: "Reply format is not valid",
  },
};

const INITIAL_LOG_ROWS = [
  { id: "SIM9AK-1", time: "13:12", callsign: "SIM9AK", frequency: "21.060", mode: "CW", sent: "559", received: "579", location: "EU-W", isFictional: true },
  { id: "SIM7QX-1", time: "13:09", callsign: "SIM7QX", frequency: "21.060", mode: "CW", sent: "559", received: "579", location: "NA-W", isFictional: true },
  { id: "SIM8CW-1", time: "13:05", callsign: "SIM8CW", frequency: "21.060", mode: "CW", sent: "559", received: "579", location: "OC-AU", isFictional: true },
  { id: "SIM2DX-1", time: "12:58", callsign: "SIM2DX", frequency: "21.060", mode: "CW", sent: "559", received: "579", location: "AF-S", isFictional: true },
];

function detectLanguage() {
  const language = navigator.language || "en";
  if (/^zh-(TW|HK|MO)/i.test(language)) return "zh-TW";
  if (/^zh/i.test(language)) return "zh-CN";
  if (/^ja/i.test(language)) return "ja";
  return "en";
}

function IconButton({ label, children, className = "", ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function LanguageMenu({ language, onSelect, compact = false }) {
  return (
    <div className={`language-menu ${compact ? "compact" : ""}`} role="menu">
      {LANGUAGES.map((item) => (
        <button key={item.id} className={language === item.id ? "selected" : ""} onClick={() => onSelect(item.id)} role="menuitem">
          <span className="language-short">{item.short}</span><span>{item.label}</span>
          {language === item.id && <Check size={17} weight="bold" />}
        </button>
      ))}
    </div>
  );
}

function StartScreen({ language, setLanguage, onStart, onPractice, onSettings }) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const t = COPY[language];
  return (
    <main className="screen start-screen" style={{ "--room": `url(${ASSETS.room})` }}>
      <div className="screen-vignette" />
      <section className="title-lockup" aria-labelledby="game-title">
        <div className="title-eyebrow"><Radio size={19} weight="fill" /> 21.060 MHz · CW</div>
        <h1 id="game-title"><span>CW</span> STATION</h1><p>{t.subtitle}</p>
        <div className="dial-line"><span /><i /><span /></div>
      </section>
      <nav className="start-actions" aria-label="Main menu">
        <button className="menu-primary" onClick={onStart}><Play size={23} weight="fill" />{t.newGame}</button>
        <button onClick={onPractice}><Lightning size={22} />{t.practice}</button>
        <button onClick={onSettings}><GearSix size={22} />{t.settings}</button>
        <button onClick={() => window.alert(t.fieldGuide)}><BookOpenText size={22} />{t.fieldGuide}</button>
      </nav>
      <p className="callsign-disclaimer">{t.callsignDisclaimer}</p>
      <div className="build-tag">{t.prototype} · v0.5.1</div>
      <div className="start-language">
        {languageOpen && <LanguageMenu language={language} onSelect={(value) => { setLanguage(value); setLanguageOpen(false); }} compact />}
        <IconButton className="language-globe" label={t.language} onClick={() => setLanguageOpen((value) => !value)} aria-expanded={languageOpen}>
          <GlobeHemisphereWest size={27} weight="duotone" />
        </IconButton>
      </div>
    </main>
  );
}

function SettingsModal({ language, setLanguage, keyType, setKeyType, onClose }) {
  const t = COPY[language];
  const [draftKey, setDraftKey] = useState(keyType);
  const [draftLanguage, setDraftLanguage] = useState(language);
  function apply() { setLanguage(draftLanguage); setKeyType(draftKey); onClose(); }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div><span className="panel-kicker">SYSTEM / CONFIG</span><h2 id="settings-title"><GearSix size={24} />{t.settings}</h2></div>
          <IconButton label={t.close} onClick={onClose}><X size={22} /></IconButton>
        </header>
        <div className="settings-grid">
          <section><h3><Translate size={20} />{t.interface}</h3><LanguageMenu language={draftLanguage} onSelect={setDraftLanguage} /></section>
          <section>
            <h3><Lightning size={20} />{t.keyType}</h3>
            <div className="key-options">
              {[
                { id: "manual", label: t.manual, hint: t.manualHint, image: ASSETS.manual },
                { id: "automatic", label: t.automatic, hint: t.automaticHint, image: ASSETS.automatic },
              ].map((option) => (
                <button key={option.id} onClick={() => setDraftKey(option.id)} className={draftKey === option.id ? "selected" : ""}>
                  <img src={option.image} alt="" /><span><strong>{option.label}</strong><small>{option.hint}</small></span>
                  {draftKey === option.id && <Check size={19} weight="bold" />}
                </button>
              ))}
            </div>
          </section>
        </div>
        <footer><span>{COPY[draftLanguage].noControls}</span><button className="primary-button" onClick={apply}><Check size={20} weight="bold" />{COPY[draftLanguage].apply}</button></footer>
      </section>
    </div>
  );
}

function MapModal({ language, mapMode, setMapMode, propagationMap, onClose }) {
  const t = COPY[language];
  return (
    <div className="modal-backdrop map-backdrop">
      <section className="map-modal" role="dialog" aria-modal="true" aria-labelledby="map-title">
        <header>
          <div><span className="panel-kicker">HF / 21.060 MHz</span><h2 id="map-title"><MapTrifold size={25} />{t.map}</h2></div>
          <IconButton label={t.close} onClick={onClose}><X size={24} /></IconButton>
        </header>
        <div className="large-map"><PropagationMap map={propagationMap} mode={mapMode} ariaLabel={mapMode === "world" ? t.worldMode : t.heatMode} /></div>
        <footer>
          <div className="map-mode-buttons">
            <IconButton label={t.worldMode} className={mapMode === "world" ? "selected" : ""} onClick={() => setMapMode("world")} aria-pressed={mapMode === "world"}>
              <GlobeHemisphereWest size={27} weight="duotone" />
            </IconButton>
            <IconButton label={t.heatMode} className={mapMode === "propagation" ? "selected" : ""} onClick={() => setMapMode("propagation")} aria-pressed={mapMode === "propagation"}>
              <GridFour size={27} weight="fill" />
            </IconButton>
          </div>
          {mapMode === "propagation" && <div className="legend"><span>{t.legend}</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} title={`${level}`} />)}</div>}
        </footer>
      </section>
    </div>
  );
}

function StationScreen({ language, keyType, playerLocation, onSettings, onBack, inputBlocked = false }) {
  const t = COPY[language];
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState("propagation");
  const [saved, setSaved] = useState(false);
  const [powered, setPowered] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const [credits, setCredits] = useState(0);
  const [logRows, setLogRows] = useState(INITIAL_LOG_ROWS);
  const [qsoSerial, setQsoSerial] = useState(0);
  const propagationKey = `${clock.getUTCFullYear()}-${clock.getUTCMonth()}-${clock.getUTCDate()}-${clock.getUTCHours()}-${Math.floor(clock.getUTCMinutes() / 10)}`;
  const propagationMap = useMemo(() => generatePropagationMap({ playerLocation, utc: clock }), [playerLocation, propagationKey]);
  const initialNpc = useMemo(() => selectNpcForQso(propagationMap, { seed: `${propagationKey}:0` }), [propagationMap, propagationKey]);
  const [qso, setQso] = useState(() => createQso({ npc: initialNpc, playerCallsign: "SIM-K7QX" }));
  const cw = useCwCore({ targetText: qso.expectedPlayer ?? "" });
  const isTx = cw.isTransmitting;
  const npcChannel = useMemo(() => channelProfileForLevel(qso.npc.finalLevel, qso.npc), [qso.npc]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onDown(event) {
      if (mapOpen || inputBlocked || !powered) return;
      if (["Space", "KeyZ", "KeyX", "F1", "F2", "F3"].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === "F1") { playNpcMessage(); return; }
      if (event.code === "F2") { submitReply(); return; }
      if (event.code === "F3") { saveOrRestart(); return; }
      if (!qsoCanAcceptPlayer(qso)) return;
      if (keyType === "manual" && event.code === "Space") cw.beginManual();
      if (keyType === "automatic" && event.code === "KeyZ") cw.tapAutomatic(".");
      if (keyType === "automatic" && event.code === "KeyX") cw.tapAutomatic("-");
    }
    function onUp(event) {
      if (keyType !== "manual" || event.code !== "Space") return;
      event.preventDefault();
      cw.endManual();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [cw.beginManual, cw.endManual, cw.tapAutomatic, inputBlocked, keyType, mapOpen, powered, qso]);

  async function playNpcMessage() {
    if (!powered || !qsoNeedsNpcPlayback(qso) || cw.isPlaying || cw.isKeying) return;
    const played = await cw.playIncoming(qso.npcMessage, qso.npc.wpm, npcChannel);
    if (!played) return;
    const next = onNpcPlaybackFinished(qso);
    setQso(next);
    cw.clearInput();
    if (next.phase === QSO_PHASES.QSO_COMPLETE) setCredits((current) => current + next.creditsAwarded);
  }

  async function submitReply() {
    if (!powered || !qsoCanAcceptPlayer(qso) || !cw.analysis.pulseCount || cw.isPlaying || cw.isKeying) return;
    const decoded = cw.analysis.decoded;
    await cw.replayInput();
    setQso(submitPlayerMessage(qso, decoded));
    cw.clearInput();
  }

  function startNewQso() {
    const nextSerial = qsoSerial + 1;
    const nextNpc = selectNpcForQso(propagationMap, { seed: `${propagationKey}:${nextSerial}` });
    setQsoSerial(nextSerial);
    setQso(createQso({ npc: nextNpc, playerCallsign: "SIM-K7QX" }));
    setSaved(false);
    cw.clearInput();
  }

  function saveOrRestart() {
    if (qso.phase === QSO_PHASES.QSO_FAILED) {
      setQso(restartQso(qso));
      cw.clearInput();
      return;
    }
    if (qso.phase !== QSO_PHASES.QSO_COMPLETE || saved) return;
    const entry = createQsoLogEntry(qso);
    setLogRows((current) => [entry, ...current].slice(0, 6));
    setSaved(true);
  }

  function handleKeyPointerDown(event) {
    if (!powered || !qsoCanAcceptPlayer(qso)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (keyType === "manual") {
      cw.beginManual();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    cw.tapAutomatic(event.clientX < bounds.left + bounds.width / 2 ? "." : "-");
  }

  function handleKeyPointerEnd() {
    if (keyType === "manual") cw.endManual();
  }

  function togglePower() {
    if (powered) cw.stopAll();
    setPowered((current) => !current);
  }

  const phaseText = {
    [QSO_PHASES.WAITING_CQ]: t.phaseWaiting,
    [QSO_PHASES.PLAYER_REPLY]: t.phaseReply,
    [QSO_PHASES.NPC_RST]: t.phaseNpcRst,
    [QSO_PHASES.PLAYER_RST_AND_73]: t.phasePlayerRst,
    [QSO_PHASES.NPC_73_AND_SK]: t.phaseFinal,
    [QSO_PHASES.QSO_COMPLETE]: t.phaseComplete,
    [QSO_PHASES.QSO_FAILED]: t.phaseFailed,
  }[qso.phase];
  const decodedText = cw.analysis.decoded || "---";
  const utc = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const local = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const displayLineFull = qso.phase === QSO_PHASES.QSO_COMPLETE ? `QSO COMPLETE +${qso.creditsAwarded}`
    : qso.phase === QSO_PHASES.QSO_FAILED ? "QSO FAILED"
      : qsoCanAcceptPlayer(qso) ? (cw.analysis.decoded || "...") : qso.npcMessage;
  const displayLine = tailPreview(displayLineFull, 64);
  const decodedPreview = tailPreview(decodedText, 40, "---");
  const f3Label = qso.phase === QSO_PHASES.QSO_FAILED ? t.restartQso : saved ? t.saved : t.saveLog;
  return (
    <main className={`screen station-screen ${isTx ? "transmitting" : ""} ${powered ? "station-powered" : "station-off"}`} style={{ "--room": `url(${ASSETS.room})` }}>
      <header className="station-topbar">
        <div className="clock-group"><span>UTC <b>{utc}</b></span><i /><span>LOCAL <b>{local}</b></span></div>
        <div className="station-name"><Radio size={18} weight="fill" /> SIM-K7QX · {t.station} · {t.credits} {credits}</div>
        <div className="top-actions"><IconButton label={t.back} onClick={onBack}><ArrowLeft size={21} /></IconButton><IconButton label={t.settings} onClick={onSettings}><GearSix size={21} /></IconButton></div>
      </header>
      <div className="station-grid">
        <aside className="log-panel metal-panel">
          <div className="panel-title"><span>{t.log}</span><b>LOG // {String(logRows.length).padStart(3, "0")}</b></div>
          <div className="log-head"><span>{t.time}</span><span>{t.call}</span><span>{t.frequency}</span><span>{t.mode}</span></div>
          <div className="log-list">{logRows.map((row, index) => <button key={row.id} className={index === 0 ? "active" : ""}><span>{row.time}</span><span>{row.callsign}</span><span>{row.frequency}</span><span>{row.mode}</span></button>)}</div>
          <div className="contact-card"><span className="panel-kicker">{t.contact} · SIM</span><h2>{qso.npc.callsign}</h2><dl>
            <div><dt>{t.time}</dt><dd>{utc} UTC</dd></div><div><dt>{t.frequency}</dt><dd>21.060 MHz</dd></div>
            <div><dt>{t.mode}</dt><dd>CW</dd></div><div><dt>{t.sent}</dt><dd>{qso.sentRst ?? "---"}</dd></div><div><dt>{t.received}</dt><dd>{qso.receivedRst ?? "---"}</dd></div>
            <div><dt>{t.location}</dt><dd>{qso.npc.regionId}</dd></div><div><dt>{t.notes}</dt><dd>SIM / P{qso.npc.finalLevel}</dd></div>
          </dl></div>
          <div className="panel-actions"><button onClick={startNewQso}>{t.newContact}</button><button className="muted" onClick={cw.clearInput}>{t.delete}</button></div>
        </aside>
        <section className={`hardware-panel metal-panel ${powered ? "powered" : "power-off"}`}>
          <div className="board-stage"><img className="board-asset" src={ASSETS.board} alt="squid01 yellow PCB under an acrylic cover" /><span className={`tx-led ${isTx ? "on" : ""}`} aria-label={isTx ? t.tx : powered ? t.idle : t.powerOff}><i />TX</span></div>
          <div className="hardware-status">
            <button className={`station-power ${powered ? "on" : ""}`} onClick={togglePower} aria-pressed={powered} aria-label={powered ? t.powerOff : t.powerOn}><Power size={16} weight="fill" /> SQUID01 / {powered ? "ON" : "OFF"}</button>
            <span>{t.detectedSpeed}: <b>{powered ? `${cw.analysis.wpm} WPM` : "--"}</b></span>
            <span className={isTx ? "tx-active" : cw.status === "playing" && powered ? "rx-active" : ""}><Broadcast size={16} weight="fill" />{!powered ? t.powerOff : isTx ? t.tx : cw.status === "playing" ? t.cwReceiving : t.idle}</span>
          </div>
          <div className="key-stage">
            <img className={cw.isKeying ? "key-active" : ""} src={keyType === "manual" ? ASSETS.manual : ASSETS.automatic} alt={keyType === "manual" ? t.manual : t.automatic} aria-disabled={!powered}
              onPointerDown={handleKeyPointerDown} onPointerUp={handleKeyPointerEnd} onPointerCancel={handleKeyPointerEnd} draggable="false" />
            <div><strong>{keyType === "manual" ? t.manual : t.automatic}</strong><span>{keyType === "manual" ? t.manualHint : t.automaticHint}</span></div>
          </div>
        </section>
        <aside className="propagation-panel metal-panel">
          <div className="panel-title"><span>{t.propagation}</span><b>HF / LIVE</b></div>
          <button className="map-preview" onClick={() => setMapOpen(true)} aria-label={t.openMap}><PropagationMap map={propagationMap} mode={mapMode} ariaLabel="" /><span><MapTrifold size={19} />{t.openMap}</span></button>
          <div className="mini-legend">{[0, 1, 2, 3, 4].map((level) => <span key={level}><i className={`level-${level}`} />{level}</span>)}</div>
          <div className="signal-note"><span>21.060 MHz</span><strong>{t.propLevel}: P{qso.npc.finalLevel}</strong><small>{qso.npc.regionId} · {qso.npc.isStrongStation ? "DX+" : "SIM"} · {t.noControls}</small></div>
        </aside>
      </div>
      <footer className="qso-console metal-panel">
        <div className="morse-display" aria-live="polite">
          <span>{displayLine}</span>
          <small>{phaseText}{qso.lastError ? ` // ${t.invalidReply} (${qso.attempts}/2)` : ""} // {t.decoded}: {decodedPreview} // {t.accuracy}: {cw.analysis.accuracy}% // {t.rhythm}: {cw.analysis.rhythm}%</small>
        </div>
        <button className="reply-button" onClick={playNpcMessage} disabled={!powered || !qsoNeedsNpcPlayback(qso) || cw.isPlaying || cw.isKeying}><Lightning size={23} weight="fill" />{t.playNpc}<kbd>F1</kbd></button>
        <button onClick={submitReply} disabled={!powered || !qsoCanAcceptPlayer(qso) || !cw.analysis.pulseCount || cw.isPlaying || cw.isKeying}><Broadcast size={20} />{t.submitReply}<kbd>F2</kbd></button>
        <button onClick={saveOrRestart} disabled={![QSO_PHASES.QSO_COMPLETE, QSO_PHASES.QSO_FAILED].includes(qso.phase) || saved}><FloppyDisk size={20} />{f3Label}<kbd>F3</kbd></button>
      </footer>
      {mapOpen && <MapModal language={language} mapMode={mapMode} setMapMode={setMapMode} propagationMap={propagationMap} onClose={() => setMapOpen(false)} />}
    </main>
  );
}

export function App() {
  const [language, setLanguage] = useState(detectLanguage);
  const [keyType, setKeyType] = useState("manual");
  const [screen, setScreen] = useState("start");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [playerLocation, setPlayerLocation] = useState(DEFAULT_PLAYER_LOCATION);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  let currentScreen;
  if (screen === "start") currentScreen = <StartScreen language={language} setLanguage={setLanguage} onStart={() => setLocationOpen(true)} onPractice={() => setScreen("practice")} onSettings={() => setSettingsOpen(true)} />;
  else if (screen === "practice") currentScreen = <PracticeScreen language={language} inputBlocked={settingsOpen} onSettings={() => setSettingsOpen(true)} onBack={() => setScreen("start")} />;
  else currentScreen = <StationScreen language={language} keyType={keyType} playerLocation={playerLocation} inputBlocked={settingsOpen} onSettings={() => setSettingsOpen(true)} onBack={() => setScreen("start")} />;
  return <>
    {currentScreen}
    {settingsOpen && <SettingsModal language={language} setLanguage={setLanguage} keyType={keyType} setKeyType={setKeyType} onClose={() => setSettingsOpen(false)} />}
    {locationOpen && <StationLocationModal language={language} current={playerLocation} onClose={() => setLocationOpen(false)} onConfirm={(location) => { setPlayerLocation(location); setLocationOpen(false); setScreen("station"); }} />}
  </>;
}
