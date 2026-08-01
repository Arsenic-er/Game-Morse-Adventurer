import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise, ArrowLeft, BookOpenText, Broadcast, Check, FloppyDisk, GearSix,
  GlobeHemisphereWest, GridFour, Lightning, MapTrifold, Play,
  Power, Question, Radio, Translate, X,
} from "@phosphor-icons/react";
import { NetworkIndicator } from "./components/NetworkIndicator.jsx";
import {
  GuidanceChoices, QsoBriefingModal, QsoDutyCoach, normalizeQsoGuidance,
  qsoCoachText, qsoErrorMessage,
} from "./components/QsoDutyCoach.jsx";
import {
  DEFAULT_AUTOMATIC_KEY_WPM,
  MAX_AUTOMATIC_KEY_WPM,
  MIN_AUTOMATIC_KEY_WPM,
  normalizeAutomaticKeyWpm,
} from "./cw/automaticKeyer.js";
import { useCwCore } from "./cw/useCwCore.js";
import { tailPreview } from "./cw/display.js";
import { scoreDecodedText } from "./cw/inputAnalyzer.js";
import { LocationArtwork } from "./game/LocationArtwork.jsx";
import { getAccessory } from "./game/accessoryCatalog.js";
import { getAntenna } from "./game/antennaCatalog.js";
import { equipmentName, getTransmitter } from "./game/equipmentCatalog.js";
import { equipOwnedItem, purchaseItem } from "./game/economy.js";
import { findNewlyUnlockedAchievements } from "./game/achievements.js";
import { getLocation, toPropagationLocation } from "./game/locations.js";
import {
  loadActiveSaveId, loadSaves, persistActiveSaveId, persistSaves,
} from "./game/saveStore.js";
import { PracticeScreen } from "./practice/PracticeScreen.jsx";
import { practiceStatsByMode, recordPracticeAttempt, updatePracticePreference } from "./practice/practiceRecords.js";
import { PropagationMap } from "./propagation/PropagationMap.jsx";
import {
  channelProfileForLevel, generatePropagationMap, selectNpcForQso, selectNpcResponseForCq,
} from "./propagation/propagationEngine.js";
import {
  QSO_PHASES, createQso, createQsoLogEntry, markQsoAssisted, onNpcPlaybackFinished,
  qsoCanAcceptPlayer, qsoNeedsNpcPlayback, resolveCqResponse, restartQso, submitPlayerMessage,
} from "./qso/qsoEngine.js";
import { recordCompletedQso } from "./qso/qsoLog.js";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { QsoResultModal } from "./screens/QsoResultModal.jsx";
import { SaveSelectScreen } from "./screens/SaveSelectScreen.jsx";
import { StationManualModal } from "./screens/StationManualModal.jsx";
import { AchievementNotification } from "./screens/AchievementsModal.jsx";
import { LANGUAGES, loadLanguagePreference, persistLanguagePreference } from "./i18n/languageRegistry.js";

const ASSETS = {
  room: "./assets/radio-room-bg.png",
  boardOff: "./assets/squid01-board-off.png",
  boardOn: "./assets/squid01-board-on.png",
  manual: "./assets/manual-key.png",
  automatic: "./assets/automatic-key.png",
  world: "./assets/world-map.png",
  propagation: "./assets/propagation-map.png",
};

const BUILD_VERSION = "0.23.0";
const ANTENNA_STATUS = {
  "zh-CN": { missing: "未装备天线，射频通联已停用", equip: "请在管理中心的仓库内装备天线" },
  "zh-TW": { missing: "未裝備天線，射頻通聯已停用", equip: "請在管理中心的倉庫內裝備天線" },
  ja: { missing: "アンテナ未装備のため無線交信は停止中", equip: "管理センターの倉庫でアンテナを装備してください" },
  en: { missing: "No antenna equipped — RF operation disabled", equip: "Equip an antenna in the Management Center warehouse" },
  es: { missing: "No hay antena equipada — operación RF desactivada", equip: "Equipa una antena en el almacén del Centro de Gestión" },
  de: { missing: "Keine Antenne ausgerüstet — Funkbetrieb deaktiviert", equip: "Rüste im Lager des Verwaltungszentrums eine Antenne aus" },
  ru: { missing: "Антенна не установлена — радиосвязь отключена", equip: "Установите антенну на складе Центра управления" },
};

const COPY = {
  "zh-CN": {
    subtitle: "业余无线电台站模拟", newGame: "开始值守", continue: "继续值守", practice: "CW 练习台", fieldGuide: "台站手册", callsignDisclaimer: "本游戏内所有呼号均与现实生活中的真实呼号无关，如有雷同，纯属巧合。",
    prototype: "M5 完整原型", language: "语言", settings: "设置", close: "关闭", interface: "界面语言",
    keyType: "电键类型", manual: "手键", automatic: "自动键", manualHint: "按住空格键发射",
    automaticHint: "Z 短音 / X 长音；长按连续发报", automaticSpeed: "自动键速度", automaticSpeedHint: "仅影响自动键；手键速度仍由系统检测", configuredSpeed: "自动键速度", apply: "应用设置", station: "值守台", log: "通联日志", time: "时间",
    call: "呼号", frequency: "频率", mode: "模式", contact: "当前通联", sent: "发送", received: "接收",
    location: "位置", notes: "备注", newContact: "新建通联", clearInput: "清空输入", propagation: "传播预览",
    openMap: "打开传播大图", detected: "系统自动识别", detectedSpeed: "识别速度", tx: "发射", idle: "接收中",
    reply: "回应", send: "发送", saveLog: "保存日志", saved: "日志已保存", map: "传播地图",
    worldMode: "普通世界地图", heatMode: "传播等级地图", legend: "传播等级", back: "返回开始界面",
    qsoReady: "等待对方台结束呼叫…", qsoReply: "正在发送回应…", qsoSent: "回应已发出，等待回报…",
    fixedToneHint: "套件音调固定；自动键速度可调，手键速度由系统检测", filterActive: "500 Hz 滤波", playCq: "播放 CQ", replayInput: "回放输入", target: "目标",
    decoded: "解码", accuracy: "发报准确率", rhythm: "节奏", powerOn: "开机", powerOff: "关机", cwReady: "CW 核心就绪", cwPlaying: "正在播放标准 CQ",
    cwKeying: "正在记录发报", cwReplay: "正在回放输入", cwCaptured: "输入已记录", cwReceiving: "接收 CW",
    playNpc: "播放对方", submitReply: "发送回应", restartQso: "重新开始", credits: "信用点", sim: "虚构台站", propLevel: "传播等级",
    phaseWaiting: "等待播放 NPC 呼叫", phaseReply: "请发送双方呼号", phaseNpcRst: "等待播放对方 RST", phasePlayerRst: "请发送 RST 与 73",
    phaseFinal: "等待播放 73 / SK", phaseComplete: "通联完成，可写入日志", phaseFailed: "通联失败，请重新开始", invalidReply: "回应格式不正确",
  },
  "zh-TW": {
    subtitle: "業餘無線電臺站模擬", newGame: "開始值守", continue: "繼續值守", practice: "CW 練習臺", fieldGuide: "臺站手冊", callsignDisclaimer: "本遊戲內所有呼號均與現實生活中的真實呼號無關，如有雷同，純屬巧合。",
    prototype: "M5 完整原型", language: "語言", settings: "設定", close: "關閉", interface: "介面語言",
    keyType: "電鍵類型", manual: "手鍵", automatic: "自動鍵", manualHint: "按住空白鍵發射",
    automaticHint: "Z 短音 / X 長音；長按連續發報", automaticSpeed: "自動鍵速度", automaticSpeedHint: "僅影響自動鍵；手鍵速度仍由系統偵測", configuredSpeed: "自動鍵速度", apply: "套用設定", station: "值守臺", log: "通聯日誌", time: "時間",
    call: "呼號", frequency: "頻率", mode: "模式", contact: "目前通聯", sent: "發送", received: "接收",
    location: "位置", notes: "備註", newContact: "新建通聯", clearInput: "清除輸入", propagation: "傳播預覽",
    openMap: "開啟傳播大圖", detected: "系統自動識別", detectedSpeed: "識別速度", tx: "發射", idle: "接收中",
    reply: "回應", send: "發送", saveLog: "儲存日誌", saved: "日誌已儲存", map: "傳播地圖",
    worldMode: "普通世界地圖", heatMode: "傳播等級地圖", legend: "傳播等級", back: "返回開始介面",
    qsoReady: "等待對方臺結束呼叫…", qsoReply: "正在發送回應…", qsoSent: "回應已發出，等待回報…",
    fixedToneHint: "套件音調固定；自動鍵速度可調，手鍵速度由系統偵測", filterActive: "500 Hz 濾波", playCq: "播放 CQ", replayInput: "重播輸入", target: "目標",
    decoded: "解碼", accuracy: "發報準確率", rhythm: "節奏", powerOn: "開機", powerOff: "關機", cwReady: "CW 核心就緒", cwPlaying: "正在播放標準 CQ",
    cwKeying: "正在記錄發報", cwReplay: "正在重播輸入", cwCaptured: "輸入已記錄", cwReceiving: "接收 CW",
    playNpc: "播放對方", submitReply: "發送回應", restartQso: "重新開始", credits: "信用點", sim: "虛構臺站", propLevel: "傳播等級",
    phaseWaiting: "等待播放 NPC 呼叫", phaseReply: "請發送雙方呼號", phaseNpcRst: "等待播放對方 RST", phasePlayerRst: "請發送 RST 與 73",
    phaseFinal: "等待播放 73 / SK", phaseComplete: "通聯完成，可寫入日誌", phaseFailed: "通聯失敗，請重新開始", invalidReply: "回應格式不正確",
  },
  ja: {
    subtitle: "アマチュア無線局シミュレーター", newGame: "運用を開始", continue: "運用を続ける", practice: "CW 練習台", fieldGuide: "局運用ガイド", callsignDisclaimer: "ゲーム内のコールサインは実在するコールサインとは無関係です。類似があってもすべて偶然です。",
    prototype: "M5 完成プロトタイプ", language: "言語", settings: "設定", close: "閉じる", interface: "表示言語",
    keyType: "電鍵タイプ", manual: "縦振り電鍵", automatic: "オートキー", manualHint: "スペースを押して送信",
    automaticHint: "Z 短点 / X 長点・長押しで連続送信", automaticSpeed: "オートキー速度", automaticSpeedHint: "オートキーにのみ適用。縦振り電鍵の速度は自動検出されます", configuredSpeed: "設定速度", apply: "設定を適用", station: "運用卓", log: "交信ログ", time: "時刻",
    call: "コール", frequency: "周波数", mode: "モード", contact: "現在の交信", sent: "送信", received: "受信",
    location: "位置", notes: "メモ", newContact: "新規交信", clearInput: "入力をクリア", propagation: "伝搬プレビュー",
    openMap: "伝搬マップを開く", detected: "システム自動認識", detectedSpeed: "認識速度", tx: "送信", idle: "受信中",
    reply: "応答", send: "送信", saveLog: "ログ保存", saved: "ログを保存しました", map: "伝搬マップ",
    worldMode: "通常の世界地図", heatMode: "伝搬レベル地図", legend: "伝搬レベル", back: "開始画面へ戻る",
    qsoReady: "相手局の呼出終了を待っています…", qsoReply: "応答を送信中…", qsoSent: "応答を送信しました。レポート待ち…",
    fixedToneHint: "音程は固定です。オートキー速度は調整でき、縦振り電鍵は自動検出されます", filterActive: "500 Hz フィルター", playCq: "CQ を再生", replayInput: "入力を再生", target: "目標",
    decoded: "復号", accuracy: "送信正確度", rhythm: "リズム", powerOn: "電源オン", powerOff: "電源オフ", cwReady: "CW コア準備完了", cwPlaying: "標準 CQ を再生中",
    cwKeying: "送信を記録中", cwReplay: "入力を再生中", cwCaptured: "入力を記録しました", cwReceiving: "CW 受信中",
    playNpc: "相手局を再生", submitReply: "応答を送信", restartQso: "やり直す", credits: "クレジット", sim: "架空局", propLevel: "伝搬レベル",
    phaseWaiting: "NPC の CQ を再生してください", phaseReply: "両局のコールを送信", phaseNpcRst: "相手局の RST を再生", phasePlayerRst: "RST と 73 を送信",
    phaseFinal: "73 / SK を再生", phaseComplete: "交信完了・ログ保存可能", phaseFailed: "交信失敗・やり直してください", invalidReply: "応答形式が正しくありません",
  },
  en: {
    subtitle: "Amateur Radio Station Simulator", newGame: "Begin Watch", continue: "Continue Watch", practice: "CW Practice", fieldGuide: "Station Manual", callsignDisclaimer: "All callsigns in this game are unrelated to real-world callsigns. Any resemblance is purely coincidental.",
    prototype: "M5 Complete Prototype", language: "Language", settings: "Settings", close: "Close", interface: "Interface language",
    keyType: "Key type", manual: "Straight key", automatic: "Automatic paddle", manualHint: "Hold Space to transmit",
    automaticHint: "Z sends dots / X sends dashes; hold to repeat", automaticSpeed: "Automatic key speed", automaticSpeedHint: "Affects the automatic key only; straight-key speed remains auto-detected", configuredSpeed: "Keyer speed", apply: "Apply settings", station: "Station watch", log: "QSO log", time: "Time",
    call: "Callsign", frequency: "Frequency", mode: "Mode", contact: "Current QSO", sent: "Sent", received: "Received",
    location: "Location", notes: "Notes", newContact: "New QSO", clearInput: "Clear input", propagation: "Propagation",
    openMap: "Open propagation map", detected: "System auto detect", detectedSpeed: "Detected speed", tx: "Transmit", idle: "Receiving",
    reply: "Reply", send: "Send", saveLog: "Save log", saved: "Log saved", map: "Propagation map",
    worldMode: "Normal world map", heatMode: "Propagation level map", legend: "Propagation level", back: "Back to title",
    qsoReady: "Waiting for the calling station…", qsoReply: "Sending reply…", qsoSent: "Reply sent. Waiting for report…",
    fixedToneHint: "Kit tone is fixed; automatic-key speed is adjustable and straight-key speed is auto-detected", filterActive: "500 Hz filter", playCq: "Play CQ", replayInput: "Replay input", target: "Target",
    decoded: "Decoded", accuracy: "Transmit accuracy", rhythm: "Rhythm", powerOn: "Power on", powerOff: "Power off", cwReady: "CW core ready", cwPlaying: "Playing standard CQ",
    cwKeying: "Recording keying", cwReplay: "Replaying input", cwCaptured: "Input captured", cwReceiving: "Receiving CW",
    playNpc: "Play station", submitReply: "Send reply", restartQso: "Restart", credits: "Credits", sim: "Fictional station", propLevel: "Propagation level",
    phaseWaiting: "Play the NPC calling message", phaseReply: "Send both callsigns", phaseNpcRst: "Play the NPC RST", phasePlayerRst: "Send RST and 73",
    phaseFinal: "Play 73 / SK", phaseComplete: "QSO complete; save the log", phaseFailed: "QSO failed; restart", invalidReply: "Reply format is not valid",
  },
  es: {
    subtitle: "Simulador de estación de radioaficionado", newGame: "Iniciar guardia", continue: "Continuar guardia", practice: "Práctica de CW", fieldGuide: "Manual de estación", callsignDisclaimer: "Todos los indicativos de este juego son ajenos a los indicativos reales. Cualquier parecido es pura coincidencia.",
    prototype: "Prototipo completo M5", language: "Idioma", settings: "Ajustes", close: "Cerrar", interface: "Idioma de la interfaz",
    keyType: "Tipo de manipulador", manual: "Manipulador vertical", automatic: "Pala automática", manualHint: "Mantén Espacio para transmitir",
    automaticHint: "Z envía puntos / X envía rayas; mantén para repetir", automaticSpeed: "Velocidad de la pala automática", automaticSpeedHint: "Solo afecta a la pala automática; la velocidad del manipulador vertical se detecta automáticamente", configuredSpeed: "Velocidad del manipulador", apply: "Aplicar ajustes", station: "Guardia de estación", log: "Registro QSO", time: "Hora",
    call: "Indicativo", frequency: "Frecuencia", mode: "Modo", contact: "QSO actual", sent: "Enviado", received: "Recibido",
    location: "Ubicación", notes: "Notas", newContact: "Nuevo QSO", clearInput: "Borrar entrada", propagation: "Propagación",
    openMap: "Abrir mapa de propagación", detected: "Detección automática", detectedSpeed: "Velocidad detectada", tx: "Transmitir", idle: "Recibiendo",
    reply: "Responder", send: "Enviar", saveLog: "Guardar registro", saved: "Registro guardado", map: "Mapa de propagación",
    worldMode: "Mapa mundial normal", heatMode: "Mapa de nivel de propagación", legend: "Nivel de propagación", back: "Volver al inicio",
    qsoReady: "Esperando a que termine la llamada de la otra estación…", qsoReply: "Enviando respuesta…", qsoSent: "Respuesta enviada. Esperando reporte…",
    fixedToneHint: "El tono del kit es fijo; la velocidad automática es ajustable y la manual se detecta", filterActive: "Filtro de 500 Hz", playCq: "Reproducir CQ", replayInput: "Reproducir entrada", target: "Objetivo",
    decoded: "Decodificado", accuracy: "Precisión de transmisión", rhythm: "Ritmo", powerOn: "Encender", powerOff: "Apagar", cwReady: "Núcleo CW listo", cwPlaying: "Reproduciendo CQ estándar",
    cwKeying: "Grabando manipulación", cwReplay: "Reproduciendo entrada", cwCaptured: "Entrada capturada", cwReceiving: "Recibiendo CW",
    playNpc: "Reproducir estación", submitReply: "Enviar respuesta", restartQso: "Reiniciar", credits: "Créditos", sim: "Estación ficticia", propLevel: "Nivel de propagación",
    phaseWaiting: "Reproduce la llamada de la estación NPC", phaseReply: "Envía ambos indicativos", phaseNpcRst: "Reproduce el RST de la estación NPC", phasePlayerRst: "Envía RST y 73",
    phaseFinal: "Reproduce 73 / SK", phaseComplete: "QSO completado; guarda el registro", phaseFailed: "QSO fallido; reinicia", invalidReply: "El formato de respuesta no es válido",
  },
  de: {
    subtitle: "Amateurfunk-Stationssimulator", newGame: "Funkwache beginnen", continue: "Funkwache fortsetzen", practice: "CW-Training", fieldGuide: "Stationshandbuch", callsignDisclaimer: "Alle Rufzeichen in diesem Spiel stehen in keinem Zusammenhang mit realen Rufzeichen. Ähnlichkeiten sind rein zufällig.",
    prototype: "Vollständiger M5-Prototyp", language: "Sprache", settings: "Einstellungen", close: "Schließen", interface: "Oberflächensprache",
    keyType: "Tastentyp", manual: "Handtaste", automatic: "Automatische Taste", manualHint: "Leertaste zum Senden halten",
    automaticHint: "Z sendet Punkte / X Striche; halten zum Wiederholen", automaticSpeed: "Tempo der automatischen Taste", automaticSpeedHint: "Wirkt nur auf die automatische Taste; das Tempo der Handtaste wird automatisch erkannt", configuredSpeed: "Tasttempo", apply: "Einstellungen anwenden", station: "Funkwache", log: "QSO-Log", time: "Zeit",
    call: "Rufzeichen", frequency: "Frequenz", mode: "Betriebsart", contact: "Aktuelles QSO", sent: "Gesendet", received: "Empfangen",
    location: "Standort", notes: "Notizen", newContact: "Neues QSO", clearInput: "Eingabe löschen", propagation: "Ausbreitung",
    openMap: "Ausbreitungskarte öffnen", detected: "Automatisch erkannt", detectedSpeed: "Erkanntes Tempo", tx: "Senden", idle: "Empfang",
    reply: "Antwort", send: "Senden", saveLog: "Log speichern", saved: "Log gespeichert", map: "Ausbreitungskarte",
    worldMode: "Normale Weltkarte", heatMode: "Karte der Ausbreitungsstufe", legend: "Ausbreitungsstufe", back: "Zurück zum Titel",
    qsoReady: "Warten auf das Ende des Gegenrufs…", qsoReply: "Antwort wird gesendet…", qsoSent: "Antwort gesendet. Warte auf Rapport…",
    fixedToneHint: "Der Bausatzton ist fest; das Automatiktasten-Tempo ist einstellbar, Handtasten-Tempo wird erkannt", filterActive: "500-Hz-Filter", playCq: "CQ abspielen", replayInput: "Eingabe abspielen", target: "Ziel",
    decoded: "Dekodiert", accuracy: "Sendegenauigkeit", rhythm: "Rhythmus", powerOn: "Einschalten", powerOff: "Ausschalten", cwReady: "CW-Kern bereit", cwPlaying: "Standard-CQ wird abgespielt",
    cwKeying: "Tastung wird aufgezeichnet", cwReplay: "Eingabe wird abgespielt", cwCaptured: "Eingabe erfasst", cwReceiving: "CW-Empfang",
    playNpc: "Station abspielen", submitReply: "Antwort senden", restartQso: "Neu starten", credits: "Kredite", sim: "Fiktive Station", propLevel: "Ausbreitungsstufe",
    phaseWaiting: "Ruf der NPC-Station abspielen", phaseReply: "Beide Rufzeichen senden", phaseNpcRst: "RST der NPC-Station abspielen", phasePlayerRst: "RST und 73 senden",
    phaseFinal: "73 / SK abspielen", phaseComplete: "QSO abgeschlossen; Log speichern", phaseFailed: "QSO fehlgeschlagen; neu starten", invalidReply: "Antwortformat ist ungültig",
  },
  ru: {
    subtitle: "Симулятор любительской радиостанции", newGame: "Начать дежурство", continue: "Продолжить дежурство", practice: "Практика CW", fieldGuide: "Руководство станции", callsignDisclaimer: "Все позывные в этой игре не связаны с реальными позывными. Любые совпадения случайны.",
    prototype: "Полный прототип M5", language: "Язык", settings: "Настройки", close: "Закрыть", interface: "Язык интерфейса",
    keyType: "Тип ключа", manual: "Ручной ключ", automatic: "Автоматический ключ", manualHint: "Удерживайте Пробел для передачи",
    automaticHint: "Z передаёт точки / X тире; удерживайте для повтора", automaticSpeed: "Скорость автоматического ключа", automaticSpeedHint: "Влияет только на автоматический ключ; скорость ручного ключа определяется автоматически", configuredSpeed: "Скорость ключа", apply: "Применить настройки", station: "Дежурство", log: "Журнал QSO", time: "Время",
    call: "Позывной", frequency: "Частота", mode: "Режим", contact: "Текущее QSO", sent: "Передано", received: "Принято",
    location: "Место", notes: "Заметки", newContact: "Новое QSO", clearInput: "Очистить ввод", propagation: "Прохождение",
    openMap: "Открыть карту прохождения", detected: "Автоопределение", detectedSpeed: "Определённая скорость", tx: "Передача", idle: "Приём",
    reply: "Ответ", send: "Передать", saveLog: "Сохранить журнал", saved: "Журнал сохранён", map: "Карта прохождения",
    worldMode: "Обычная карта мира", heatMode: "Карта уровня прохождения", legend: "Уровень прохождения", back: "Назад к заставке",
    qsoReady: "Ожидание окончания вызова другой станции…", qsoReply: "Передача ответа…", qsoSent: "Ответ передан. Ожидание рапорта…",
    fixedToneHint: "Тон набора фиксирован; скорость автоматического ключа регулируется, ручного — определяется", filterActive: "Фильтр 500 Гц", playCq: "Воспроизвести CQ", replayInput: "Воспроизвести ввод", target: "Цель",
    decoded: "Декодировано", accuracy: "Точность передачи", rhythm: "Ритм", powerOn: "Включить", powerOff: "Выключить", cwReady: "Ядро CW готово", cwPlaying: "Воспроизводится стандартный CQ",
    cwKeying: "Запись манипуляции", cwReplay: "Воспроизведение ввода", cwCaptured: "Ввод записан", cwReceiving: "Приём CW",
    playNpc: "Воспроизвести станцию", submitReply: "Передать ответ", restartQso: "Начать заново", credits: "Кредиты", sim: "Вымышленная станция", propLevel: "Уровень прохождения",
    phaseWaiting: "Воспроизведите вызов станции NPC", phaseReply: "Передайте оба позывных", phaseNpcRst: "Воспроизведите RST станции NPC", phasePlayerRst: "Передайте RST и 73",
    phaseFinal: "Воспроизведите 73 / SK", phaseComplete: "QSO завершено; сохраните журнал", phaseFailed: "QSO не удалось; начните заново", invalidReply: "Неверный формат ответа",
  },
};

const STATION_FLOW_COPY = {
  "zh-CN": {
    sendCq: "发送 CQ", sendMessage: "发送电文", receiverLive: "接收机已开启 · 背景噪声", receiverRecovering: "接收中断，正在自动恢复…",
    phaseCq: "请发送 CQ 呼叫", phaseWaitingResponse: "CQ 已发出，正在守听…",
    phaseNpcReply: "收到回应，正在自动接收对方呼号…", phasePlayerRst: "请发送双方呼号、RST 与 73",
    phaseFinal: "正在自动接收对方 73 / SK", noResponse: "本轮无人回应，可再次呼叫 CQ",
    invalidCq: "CQ 格式不正确", noContact: "尚无回应", blindContact: "盲听中 · 请从音频抄收呼号", blindIncomingLine: "REMOTE // CW 接收中", listeningLine: "LISTENING // 21.060 MHz",
  },
  "zh-TW": {
    sendCq: "發送 CQ", sendMessage: "發送電文", receiverLive: "接收機已開啟 · 背景雜訊", receiverRecovering: "接收中斷，正在自動恢復…",
    phaseCq: "請發送 CQ 呼叫", phaseWaitingResponse: "CQ 已發出，正在守聽…",
    phaseNpcReply: "收到回應，正在自動接收對方呼號…", phasePlayerRst: "請發送雙方呼號、RST 與 73",
    phaseFinal: "正在自動接收對方 73 / SK", noResponse: "本輪無人回應，可再次呼叫 CQ",
    invalidCq: "CQ 格式不正確", noContact: "尚無回應", blindContact: "盲聽中 · 請從音訊抄收呼號", blindIncomingLine: "REMOTE // CW 接收中", listeningLine: "LISTENING // 21.060 MHz",
  },
  ja: {
    sendCq: "CQ を送信", sendMessage: "電文を送信", receiverLive: "受信機動作中・バックグラウンドノイズ", receiverRecovering: "受信が中断しました。自動復帰中…",
    phaseCq: "CQ 呼出を送信してください", phaseWaitingResponse: "CQ を送信しました。応答を待っています…",
    phaseNpcReply: "応答局のコールサインを自動受信中…", phasePlayerRst: "両局のコール、RST、73 を送信",
    phaseFinal: "相手局の 73 / SK を自動受信中", noResponse: "今回は応答がありません。もう一度 CQ を出せます",
    invalidCq: "CQ の形式が正しくありません", noContact: "応答局なし", blindContact: "ブラインド受信中・音からコールをコピー", blindIncomingLine: "REMOTE // CW 受信中", listeningLine: "LISTENING // 21.060 MHz",
  },
  en: {
    sendCq: "Send CQ", sendMessage: "Send message", receiverLive: "Receiver open · background noise", receiverRecovering: "Reception interrupted · recovering automatically…",
    phaseCq: "Send a CQ call", phaseWaitingResponse: "CQ sent. Listening for replies…",
    phaseNpcReply: "Automatically receiving a responding station…", phasePlayerRst: "Send both callsigns, RST, and 73",
    phaseFinal: "Automatically receiving 73 / SK", noResponse: "No reply this time. You may call CQ again.",
    invalidCq: "CQ format is not valid", noContact: "No response yet", blindContact: "Blind copy · identify the call from audio", blindIncomingLine: "REMOTE // CW RX", listeningLine: "LISTENING // 21.060 MHz",
  },
  es: {
    sendCq: "Enviar CQ", sendMessage: "Enviar mensaje", receiverLive: "Receptor abierto · ruido de fondo", receiverRecovering: "Recepción interrumpida · recuperación automática…",
    phaseCq: "Envía una llamada CQ", phaseWaitingResponse: "CQ enviado. Escuchando respuestas…", phaseNpcReply: "Recibiendo automáticamente una estación que responde…", phasePlayerRst: "Envía ambos indicativos, RST y 73",
    phaseFinal: "Recibiendo automáticamente 73 / SK", noResponse: "No hubo respuesta. Puedes volver a llamar CQ.", invalidCq: "El formato de CQ no es válido", noContact: "Aún no hay respuesta", blindContact: "Copia a oído · identifica el indicativo por el audio", blindIncomingLine: "REMOTE // RX CW", listeningLine: "ESCUCHANDO // 21.060 MHz",
  },
  de: {
    sendCq: "CQ senden", sendMessage: "Nachricht senden", receiverLive: "Empfänger offen · Hintergrundrauschen", receiverRecovering: "Empfang unterbrochen · automatische Wiederherstellung…",
    phaseCq: "CQ-Ruf senden", phaseWaitingResponse: "CQ gesendet. Warte auf Antworten…", phaseNpcReply: "Antwortende Station wird automatisch empfangen…", phasePlayerRst: "Beide Rufzeichen, RST und 73 senden",
    phaseFinal: "73 / SK wird automatisch empfangen", noResponse: "Diesmal keine Antwort. Du kannst erneut CQ rufen.", invalidCq: "CQ-Format ist ungültig", noContact: "Noch keine Antwort", blindContact: "Blindmitschrift · Rufzeichen aus dem Ton erkennen", blindIncomingLine: "REMOTE // CW RX", listeningLine: "EMPFANG // 21.060 MHz",
  },
  ru: {
    sendCq: "Передать CQ", sendMessage: "Передать сообщение", receiverLive: "Приёмник открыт · фоновый шум", receiverRecovering: "Приём прерван · автоматическое восстановление…",
    phaseCq: "Передайте вызов CQ", phaseWaitingResponse: "CQ передан. Слушаем ответы…", phaseNpcReply: "Автоматический приём ответившей станции…", phasePlayerRst: "Передайте оба позывных, RST и 73",
    phaseFinal: "Автоматический приём 73 / SK", noResponse: "В этот раз ответа нет. Можно снова вызвать CQ.", invalidCq: "Неверный формат CQ", noContact: "Ответа пока нет", blindContact: "Слепой приём · определите позывной по звуку", blindIncomingLine: "REMOTE // ПРИЁМ CW", listeningLine: "ПРИЁМ // 21.060 MHz",
  },
};

function IconButton({ label, children, className = "", ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function LanguageMenu({ language, onSelect, compact = false }) {
  return (
    <div className={`language-menu ${compact ? "compact" : ""}`} role="menu">
      {LANGUAGES.map((item) => (
        <button key={item.id} data-language-id={item.id} className={language === item.id ? "selected" : ""} onClick={() => onSelect(item.id)} role="menuitem">
          <span className="language-short">{item.short}</span><span>{item.label}</span>
          {language === item.id && <Check size={17} weight="bold" />}
        </button>
      ))}
    </div>
  );
}

function StartScreen({ language, setLanguage, onStart, onPractice, onSettings, onManual }) {
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
        <button onClick={onManual}><BookOpenText size={22} />{t.fieldGuide}</button>
      </nav>
      <p className="callsign-disclaimer">{t.callsignDisclaimer}</p>
      <div className="build-tag">{t.prototype} · v{BUILD_VERSION}</div>
      <div className="start-language">
        {languageOpen && <LanguageMenu language={language} onSelect={(value) => { setLanguage(value); setLanguageOpen(false); }} compact />}
        <IconButton className="language-globe" label={t.language} onClick={() => setLanguageOpen((value) => !value)} aria-expanded={languageOpen}>
          <GlobeHemisphereWest size={27} weight="duotone" />
        </IconButton>
      </div>
    </main>
  );
}

function SettingsModal({ language, keyType, automaticKeyWpm, qsoGuidance, onApply, onClose }) {
  const t = COPY[language];
  const [draftKey, setDraftKey] = useState(keyType);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftWpm, setDraftWpm] = useState(() => normalizeAutomaticKeyWpm(automaticKeyWpm));
  const [draftGuidance, setDraftGuidance] = useState(() => normalizeQsoGuidance(qsoGuidance));
  function apply() {
    onApply({
      language: draftLanguage,
      keyType: draftKey,
      automaticKeyWpm: normalizeAutomaticKeyWpm(draftWpm),
      qsoGuidance: normalizeQsoGuidance(draftGuidance),
    });
    onClose();
  }
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
            {draftKey === "automatic" && (
              <div className="automatic-speed-setting" data-testid="keyer-wpm">
                <div>
                  <strong>{COPY[draftLanguage].automaticSpeed}</strong>
                  <span>
                    <button type="button" aria-label="Decrease WPM" onClick={() => setDraftWpm((value) => normalizeAutomaticKeyWpm(value - 1))}>−</button>
                    <output data-keyer-wpm>{draftWpm} WPM</output>
                    <button type="button" aria-label="Increase WPM" onClick={() => setDraftWpm((value) => normalizeAutomaticKeyWpm(value + 1))}>+</button>
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_AUTOMATIC_KEY_WPM}
                  max={MAX_AUTOMATIC_KEY_WPM}
                  step="1"
                  value={draftWpm}
                  aria-label={COPY[draftLanguage].automaticSpeed}
                  onChange={(event) => setDraftWpm(normalizeAutomaticKeyWpm(event.target.value))}
                />
                <small>{COPY[draftLanguage].automaticSpeedHint}</small>
              </div>
            )}
          </section>
          <section className="settings-guidance">
            <h3><Question size={20} />{qsoCoachText(draftLanguage).guidance}</h3>
            <GuidanceChoices language={draftLanguage} value={draftGuidance} onChange={setDraftGuidance} />
          </section>
        </div>
        <footer><span>{COPY[draftLanguage].fixedToneHint}</span><button className="primary-button" onClick={apply}><Check size={20} weight="bold" />{COPY[draftLanguage].apply}</button></footer>
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

function StationScreen({ language, keyType, save, onSaveUpdate, onSettings, onBack, inputBlocked = false }) {
  const t = COPY[language];
  const flow = STATION_FLOW_COPY[language] ?? STATION_FLOW_COPY.en;
  const antennaStatus = ANTENNA_STATUS[language] ?? ANTENNA_STATUS.en;
  const location = getLocation(save.locationId);
  const transmitter = getTransmitter(save.equipmentId);
  const antenna = getAntenna(save.antennaId);
  const accessory = getAccessory(save.accessoryId);
  const antennaReady = antenna.id !== "none";
  const transmitterPropagationBonus = Number.isFinite(transmitter.propagationBonus) ? transmitter.propagationBonus : 0;
  const transmitterNoiseGainMultiplier = Number.isFinite(transmitter.noiseGainMultiplier) ? transmitter.noiseGainMultiplier : 1;
  const transmitterQsbDepthMultiplier = Number.isFinite(transmitter.qsbDepthMultiplier) ? transmitter.qsbDepthMultiplier : 1;
  const combinedNoiseGainMultiplier = accessory.noiseGainMultiplier * transmitterNoiseGainMultiplier;
  const combinedQsbDepthMultiplier = antenna.qsbDepthMultiplier * transmitterQsbDepthMultiplier;
  const playerEquipmentBonus = antenna.propagationBonus + transmitterPropagationBonus;
  const playerLocation = useMemo(() => toPropagationLocation(location), [location]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState("propagation");
  const [briefingOpen, setBriefingOpen] = useState(() => save.qsoBriefSeen !== true && normalizeQsoGuidance(save.qsoGuidance) !== "off");
  const briefingOpenedManuallyRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [settlementMeta, setSettlementMeta] = useState(null);
  const [powered, setPowered] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [qsoMetrics, setQsoMetrics] = useState({ samples: 0, wpm: 0, accuracy: 0, rhythm: 0 });
  const [qsoSerial, setQsoSerial] = useState(0);
  const [npcPlaybackRetry, setNpcPlaybackRetry] = useState(0);
  const [npcPlaybackRecovering, setNpcPlaybackRecovering] = useState(false);
  const propagationKey = `${clock.getUTCFullYear()}-${clock.getUTCMonth()}-${clock.getUTCDate()}-${clock.getUTCHours()}-${Math.floor(clock.getUTCMinutes() / 10)}`;
  const propagationMap = useMemo(() => generatePropagationMap({ playerLocation, utc: clock }), [playerLocation, propagationKey]);
  const initialNpc = useMemo(() => selectNpcForQso(propagationMap, { playerEquipmentBonus, seed: `${propagationKey}:0` }), [playerEquipmentBonus, propagationMap, propagationKey]);
  const [qso, setQso] = useState(() => createQso({
    npc: initialNpc,
    playerCallsign: save.callsign,
    guidanceLevel: normalizeQsoGuidance(save.qsoGuidance),
  }));
  const logRows = save.qsoLogs ?? [];
  const recentLogRows = logRows.slice(0, 6);
  const selectedLog = logRows.find((entry) => entry.id === selectedLogId) ?? null;
  const credits = save.credits;
  const cw = useCwCore({
    targetText: qso.expectedPlayer ?? "",
    automaticWpm: save.automaticKeyWpm,
  });
  const isTx = cw.isTransmitting;
  const retryRequired = Boolean(qso.lastError && qso.lastError !== "noResponse");
  const npcChannel = useMemo(
    () => channelProfileForLevel(qso.npc.finalLevel, qso.npc, {
      qsbDepthMultiplier: combinedQsbDepthMultiplier,
      noiseGainMultiplier: combinedNoiseGainMultiplier,
      noiseFilterCenterHz: accessory.filterCenterHz,
      noiseFilterQ: accessory.filterQ,
    }),
    [accessory.filterCenterHz, accessory.filterQ, combinedNoiseGainMultiplier, combinedQsbDepthMultiplier, qso.npc],
  );
  const receiverChannel = useMemo(
    () => (qso.hasContact ? npcChannel : {
      noiseGain: .065 * combinedNoiseGainMultiplier,
      noiseFilterCenterHz: accessory.filterCenterHz,
      noiseFilterQ: accessory.filterQ,
    }),
    [accessory.filterCenterHz, accessory.filterQ, combinedNoiseGainMultiplier, npcChannel, qso.hasContact],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!powered) {
      cw.stopListening();
      return undefined;
    }
    cw.startListening(receiverChannel);
    return () => cw.stopListening();
  }, [cw.startListening, cw.stopListening, powered, receiverChannel]);

  useEffect(() => {
    if (briefingOpen || qso.phase !== QSO_PHASES.WAITING_RESPONSE || !powered || !antennaReady) return undefined;
    const delay = window.cwgameSystem?.qaCapture ? 60 : 1800;
    const timer = window.setTimeout(() => {
      const seed = `${propagationKey}:${qsoSerial}:${qso.unansweredCalls}:${save.callsign}`;
      const responder = window.cwgameSystem?.qaCapture
        ? selectNpcForQso(propagationMap, { playerEquipmentBonus, seed })
        : selectNpcResponseForCq(propagationMap, { playerEquipmentBonus, seed, rfEnabled: antennaReady });
      setQso((current) => (
        current.phase === QSO_PHASES.WAITING_RESPONSE ? resolveCqResponse(current, responder) : current
      ));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    antennaReady, briefingOpen, playerEquipmentBonus, powered, propagationKey, propagationMap,
    qso.phase, qso.unansweredCalls, qsoSerial, save.callsign,
  ]);

  useEffect(() => {
    if (briefingOpen || !qsoNeedsNpcPlayback(qso) || !powered || !antennaReady) return undefined;
    const activePhase = qso.phase;
    let cancelled = false;
    let retryTimer = null;
    let focusHandler = null;
    setNpcPlaybackRecovering(false);
    const requestRetry = () => {
      if (cancelled) return;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (focusHandler) window.removeEventListener("focus", focusHandler);
      setNpcPlaybackRetry((current) => current + 1);
    };
    const timer = window.setTimeout(async () => {
      const forcedQaFailure = window.cwgameSystem?.consumeQaIncomingFailure?.(activePhase) ?? false;
      const played = forcedQaFailure ? false : window.cwgameSystem?.qaCapture
        ? true
        : await cw.playIncoming(qso.npcMessage, qso.npc.wpm, npcChannel);
      if (cancelled) return;
      if (!played) {
        setNpcPlaybackRecovering(true);
        focusHandler = requestRetry;
        window.addEventListener("focus", focusHandler, { once: true });
        retryTimer = window.setTimeout(requestRetry, window.cwgameSystem?.qaCapture ? 80 : 2200);
        return;
      }
      setNpcPlaybackRecovering(false);
      setQso((current) => (
        current.phase === activePhase ? onNpcPlaybackFinished(current) : current
      ));
      cw.clearInput();
    }, window.cwgameSystem?.qaCapture ? 60 : 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (focusHandler) window.removeEventListener("focus", focusHandler);
    };
  }, [
    antennaReady, briefingOpen, cw.clearInput, cw.playIncoming, npcChannel, powered,
    npcPlaybackRetry, qso.npc.wpm, qso.npcMessage, qso.phase,
  ]);

  useEffect(() => {
    function onDown(event) {
      if (mapOpen || briefingOpen || inputBlocked || !powered || !antennaReady) return;
      if (["Space", "KeyZ", "KeyX", "F2", "F3"].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === "F2") { submitReply(); return; }
      if (event.code === "F3") { saveOrRestart(); return; }
      if (!qsoCanAcceptPlayer(qso) || retryRequired) return;
      if (keyType === "manual" && event.code === "Space") cw.beginManual();
      if (keyType === "automatic" && event.code === "KeyZ") cw.beginAutomatic(".");
      if (keyType === "automatic" && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function onUp(event) {
      if (keyType === "manual" && event.code === "Space") {
        event.preventDefault();
        cw.endManual();
      }
      if (keyType === "automatic" && event.code === "KeyZ") {
        event.preventDefault();
        cw.endAutomatic(".");
      }
      if (keyType === "automatic" && event.code === "KeyX") {
        event.preventDefault();
        cw.endAutomatic("-");
      }
    }
    function onBlur() { cw.stopAll(); }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      cw.stopAll();
    };
  }, [antennaReady, briefingOpen, cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, inputBlocked, keyType, mapOpen, powered, qso, retryRequired]);

  function submitReply() {
    if (!powered || !antennaReady || !qsoCanAcceptPlayer(qso) || retryRequired || !cw.analysis.pulseCount || cw.isPlaying || cw.isKeying) return;
    const decoded = cw.analysis.decoded;
    const normalizedDecoded = decoded.trim().replace(/\s+/g, " ").toUpperCase();
    const sample = {
      wpm: cw.analysis.wpm,
      accuracy: normalizedDecoded === "AGN K" ? scoreDecodedText(decoded, "AGN K") : cw.analysis.accuracy,
      rhythm: cw.analysis.rhythm,
    };
    const nextQso = submitPlayerMessage(qso, decoded, sample);
    setQso(nextQso);
    setQsoMetrics((current) => ({
      samples: current.samples + 1,
      wpm: current.wpm + sample.wpm,
      accuracy: current.accuracy + sample.accuracy,
      rhythm: current.rhythm + sample.rhythm,
    }));
    if (!nextQso.lastError) cw.clearInput();
  }

  function clearCurrentInput() {
    setSelectedLogId(null);
    cw.clearInput();
    if (retryRequired) setQso((current) => ({ ...current, lastError: null }));
  }

  function openBriefing() {
    cw.stopAll();
    briefingOpenedManuallyRef.current = true;
    setQso((current) => markQsoAssisted(current));
    setBriefingOpen(true);
  }

  function startBriefedWatch(level) {
    const nextLevel = normalizeQsoGuidance(level);
    if (!briefingOpenedManuallyRef.current) {
      setQso((current) => {
        const pristine = current.phase === QSO_PHASES.PLAYER_CQ
          && current.attemptHistory?.length === 0
          && current.unansweredCalls === 0
          && !current.hasContact;
        return pristine ? {
          ...current,
          guidanceLevel: nextLevel,
          visualAssistUsed: nextLevel !== "off",
        } : current;
      });
    }
    briefingOpenedManuallyRef.current = false;
    onSaveUpdate({ qsoGuidance: nextLevel, qsoBriefSeen: true });
    setBriefingOpen(false);
  }

  function skipBriefing() {
    if (!briefingOpenedManuallyRef.current) {
      setQso((current) => ({
        ...current,
        guidanceLevel: "off",
        visualAssistUsed: false,
      }));
    }
    briefingOpenedManuallyRef.current = false;
    onSaveUpdate({ qsoGuidance: "off", qsoBriefSeen: true });
    setBriefingOpen(false);
  }

  function closeBriefing() {
    briefingOpenedManuallyRef.current = false;
    onSaveUpdate({ qsoBriefSeen: true });
    setBriefingOpen(false);
  }

  function startNewQso() {
    if (qso.phase === QSO_PHASES.QSO_COMPLETE && !saved) return;
    const nextSerial = qsoSerial + 1;
    const nextNpc = selectNpcForQso(propagationMap, { playerEquipmentBonus, seed: `${propagationKey}:${nextSerial}` });
    setQsoSerial(nextSerial);
    setQso(createQso({
      npc: nextNpc,
      playerCallsign: save.callsign,
      guidanceLevel: normalizeQsoGuidance(save.qsoGuidance),
    }));
    setSaved(false);
    setResultDismissed(false);
    setSettlementMeta(null);
    setSelectedLogId(null);
    setQsoMetrics({ samples: 0, wpm: 0, accuracy: 0, rhythm: 0 });
    setNpcPlaybackRetry(0);
    setNpcPlaybackRecovering(false);
    cw.clearInput();
  }

  function createCurrentLogEntry() {
    const samples = Math.max(1, qsoMetrics.samples);
    return createQsoLogEntry(qso, {
      frequencyMhz: propagationMap.frequencyMhz,
      playerLocation,
      playerLocationId: save.locationId,
      equipmentId: save.equipmentId,
      antennaId: save.antennaId,
      accessoryId: save.accessoryId,
      propagationSource: propagationMap.source,
      wpm: keyType === "automatic"
        ? normalizeAutomaticKeyWpm(save.automaticKeyWpm)
        : Number((qsoMetrics.wpm / samples).toFixed(1)),
      transmitAccuracy: Number((qsoMetrics.accuracy / samples).toFixed(1)),
      keyingScore: Number((qsoMetrics.rhythm / samples).toFixed(1)),
    });
  }

  function saveOrRestart() {
    if (qso.phase === QSO_PHASES.QSO_FAILED) {
      setQso(restartQso(qso));
      setQsoMetrics({ samples: 0, wpm: 0, accuracy: 0, rhythm: 0 });
      setResultDismissed(false);
      cw.clearInput();
      return;
    }
    if (qso.phase !== QSO_PHASES.QSO_COMPLETE || saved) return;
    const entry = createCurrentLogEntry();
    const settlement = recordCompletedQso(save, entry);
    onSaveUpdate(settlement.added ? {
        credits: settlement.save.credits,
        qsoLogs: settlement.save.qsoLogs,
        qsoRecords: settlement.save.qsoRecords,
        firstWatchCompleted: true,
      } : { firstWatchCompleted: true }, { notifyAchievements: settlement.added });
    setSettlementMeta({
      newRegion: settlement.newRegion,
      newDistanceRecord: settlement.newDistanceRecord,
      creditsAwarded: settlement.added ? entry.credits : 0,
    });
    setSaved(true);
  }

  function handleKeyPointerDown(event) {
    if (!powered || !antennaReady || !qsoCanAcceptPlayer(qso) || retryRequired) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (keyType === "manual") {
      cw.beginManual();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    cw.beginAutomatic(event.clientX < bounds.left + bounds.width / 2 ? "." : "-");
  }

  function handleKeyPointerEnd() {
    if (keyType === "manual") {
      cw.endManual();
      return;
    }
    cw.endAutomatic(".");
    cw.endAutomatic("-");
  }

  function togglePower() {
    if (powered) {
      cw.stopAll();
      cw.stopListening();
      setNpcPlaybackRecovering(false);
    }
    setPowered((current) => !current);
  }

  const phaseText = {
    [QSO_PHASES.PLAYER_CQ]: flow.phaseCq,
    [QSO_PHASES.WAITING_RESPONSE]: flow.phaseWaitingResponse,
    [QSO_PHASES.NPC_REPLY]: flow.phaseNpcReply,
    [QSO_PHASES.PLAYER_RST_AND_73]: flow.phasePlayerRst,
    [QSO_PHASES.NPC_73_AND_SK]: flow.phaseFinal,
    [QSO_PHASES.QSO_COMPLETE]: t.phaseComplete,
    [QSO_PHASES.QSO_FAILED]: t.phaseFailed,
  }[qso.phase];
  const decodedText = cw.analysis.decoded || "---";
  const utc = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const local = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: location.timeZone });
  const displayLineFull = qso.phase === QSO_PHASES.QSO_COMPLETE ? `QSO COMPLETE +${qso.creditsAwarded}`
    : qso.phase === QSO_PHASES.QSO_FAILED ? "QSO FAILED"
      : qso.phase === QSO_PHASES.WAITING_RESPONSE ? flow.listeningLine
      : qsoCanAcceptPlayer(qso) ? (cw.analysis.decoded || "...")
        : qso.contactRevealed ? qso.npcMessage : flow.blindIncomingLine;
  const displayLine = tailPreview(displayLineFull, 64);
  const decodedPreview = tailPreview(decodedText, 40, "---");
  const f3Label = qso.phase === QSO_PHASES.QSO_FAILED ? t.restartQso : saved ? t.saved : t.saveLog;
  const resultEntry = qso.phase === QSO_PHASES.QSO_COMPLETE ? createCurrentLogEntry() : null;
  const pendingSettlement = resultEntry ? recordCompletedQso(save, resultEntry) : null;
  const resultMeta = settlementMeta ?? (pendingSettlement ? {
    newRegion: pendingSettlement.newRegion,
    newDistanceRecord: pendingSettlement.newDistanceRecord,
    creditsAwarded: pendingSettlement.added ? resultEntry.credits : 0,
  } : null);
  const liveContactRevealed = qso.contactRevealed === true;
  const blindContact = !selectedLog && qso.hasContact && !liveContactRevealed;
  const contactVisible = Boolean(selectedLog || liveContactRevealed);
  const contactCallsign = selectedLog?.callsign ?? (liveContactRevealed ? qso.npc.callsign : blindContact ? "REMOTE" : "---");
  const contactSent = selectedLog?.sent ?? qso.sentRst ?? "---";
  const contactReceived = selectedLog?.received ?? qso.receivedRst ?? "---";
  const contactLocation = selectedLog?.location ?? (liveContactRevealed ? qso.npc.regionId : "---");
  const contactLevel = selectedLog?.finalPropagationLevel ?? (liveContactRevealed ? qso.npc.finalLevel : "--");
  const contactTime = selectedLog
    ? new Date(selectedLog.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
    : liveContactRevealed ? utc : "--:--";
  return (
    <main
      className={`screen station-screen ${isTx ? "transmitting" : ""} ${powered ? "station-powered" : "station-off"} ${antennaReady ? "" : "antenna-missing"}`}
      data-qso-phase={qso.phase}
      data-contact-revealed={qso.contactRevealed}
      data-repeat-requests={qso.repeatRequests}
      data-guidance-level={qso.guidanceLevel}
      data-visual-assist-used={qso.visualAssistUsed}
      data-independent-watch={qso.independentWatch}
      data-attempt-count={qso.attemptHistory?.length ?? 0}
      data-qa-npc-callsign={window.cwgameSystem?.qaCapture ? qso.npc.callsign : undefined}
      data-decoded={cw.analysis.decoded}
      data-pulse-count={cw.analysis.pulseCount}
      data-receiver-active={cw.isListening}
      data-npc-playback-recovering={npcPlaybackRecovering}
      data-accessory-id={accessory.id}
      data-equipment-id={transmitter.id}
      data-equipment-propagation-bonus={transmitterPropagationBonus}
      data-player-equipment-bonus={playerEquipmentBonus}
      data-equipment-noise-gain-multiplier={transmitterNoiseGainMultiplier}
      data-equipment-qsb-depth-multiplier={transmitterQsbDepthMultiplier}
      data-channel-noise-gain={receiverChannel.noiseGain}
      data-channel-qsb-depth={npcChannel.qsbDepth}
      data-channel-qsb-depth-multiplier={combinedQsbDepthMultiplier}
      style={{ "--room": `url(${location.scene})` }}
    >
      <header className="station-topbar">
        <div className="clock-group"><span>UTC <b>{utc}</b></span><i /><span>LOCAL <b>{local}</b></span></div>
        <div className="station-name"><Radio size={18} weight="fill" /> {save.callsign} · {t.station} · {t.credits} {credits}</div>
        <div className="top-actions"><IconButton label={qsoCoachText(language).briefingTitle} onClick={openBriefing}><Question size={21} weight="bold" /></IconButton><IconButton label={t.back} data-action="back-home" onClick={onBack}><ArrowLeft size={21} /></IconButton><IconButton label={t.settings} onClick={onSettings}><GearSix size={21} /></IconButton></div>
      </header>
      <div className="station-grid">
        <aside className="log-panel metal-panel">
          <div className="panel-title"><span>{t.log}</span><b>LOG // {String(logRows.length).padStart(3, "0")}</b></div>
          <div className="log-head"><span>{t.time}</span><span>{t.call}</span><span>{t.frequency}</span><span>{t.mode}</span></div>
          <div className="log-list">{recentLogRows.map((row) => <button key={row.id} className={row.id === selectedLogId ? "active" : ""} onClick={() => setSelectedLogId(row.id)}><span>{new Date(row.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })}</span><span>{row.callsign}</span><span>{Number(row.frequencyMhz).toFixed(3)}</span><span>{row.mode}</span></button>)}</div>
          <div className="contact-card"><span className="panel-kicker">{t.contact} · SIM</span><h2>{contactCallsign}</h2>{!contactVisible && <small>{blindContact ? flow.blindContact : flow.noContact}</small>}<dl>
            <div><dt>{t.time}</dt><dd>{contactTime} UTC</dd></div><div><dt>{t.frequency}</dt><dd>{selectedLog ? Number(selectedLog.frequencyMhz).toFixed(3) : "21.060"} MHz</dd></div>
            <div><dt>{t.mode}</dt><dd>CW</dd></div><div><dt>{t.sent}</dt><dd>{contactSent}</dd></div><div><dt>{t.received}</dt><dd>{contactReceived}</dd></div>
            <div><dt>{t.location}</dt><dd>{contactLocation}</dd></div><div><dt>{t.notes}</dt><dd>SIM / P{contactLevel}</dd></div>
          </dl></div>
          <div className="panel-actions"><button onClick={startNewQso} disabled={qso.phase === QSO_PHASES.QSO_COMPLETE && !saved}>{t.newContact}</button><button className="muted" data-action="clear-input" onClick={clearCurrentInput}>{t.clearInput}</button></div>
        </aside>
        <section className={`hardware-panel metal-panel ${powered ? "powered" : "power-off"}`}>
          <div className="board-stage"><LocationArtwork location={location} antennaId={save.antennaId} clock={clock} className="station-board-scenery" /><img className="board-asset" data-testid="station-radio-art" data-radio-art-state={isTx ? "tx" : "idle"} src={isTx ? (transmitter.stationImageOn ?? transmitter.image ?? ASSETS.boardOn) : (transmitter.stationImageOff ?? transmitter.image ?? ASSETS.boardOff)} alt={`${equipmentName(transmitter, language)} — ${isTx ? t.tx : powered ? t.idle : t.powerOff}`} />{!antennaReady && <div className="antenna-warning"><Broadcast size={17} weight="fill" /><span>{antennaStatus.missing}</span></div>}</div>
          <div className="hardware-status">
            <button className={`station-power ${powered ? "on" : ""}`} data-testid="station-radio-power" onClick={togglePower} aria-pressed={powered} aria-label={powered ? t.powerOff : t.powerOn}><Power size={16} weight="fill" /> {transmitter.panelLabel ?? transmitter.id.toUpperCase()} / {powered ? "ON" : "OFF"}</button>
            <span>{keyType === "automatic" ? t.configuredSpeed : t.detectedSpeed}: <b>{powered ? `${keyType === "automatic" ? normalizeAutomaticKeyWpm(save.automaticKeyWpm) : cw.analysis.wpm} WPM` : "--"}</b></span>
            <span className={isTx ? "tx-active" : (cw.status === "playing" || cw.isListening) && powered ? "rx-active" : ""}><Broadcast size={16} weight="fill" />{!powered ? t.powerOff : !antennaReady ? antennaStatus.equip : isTx ? t.tx : cw.status === "playing" ? t.cwReceiving : flow.receiverLive}{accessory.id !== "none" ? ` · ${t.filterActive}` : ""}</span>
          </div>
          <div className="key-stage">
            <img className={cw.isKeying ? "key-active" : ""} src={keyType === "manual" ? ASSETS.manual : ASSETS.automatic} alt={keyType === "manual" ? t.manual : t.automatic} aria-disabled={!powered}
              onPointerDown={handleKeyPointerDown} onPointerUp={handleKeyPointerEnd} onPointerCancel={handleKeyPointerEnd} onLostPointerCapture={handleKeyPointerEnd} draggable="false" />
            <div><strong>{keyType === "manual" ? t.manual : t.automatic}</strong><span>{keyType === "manual" ? t.manualHint : t.automaticHint}</span></div>
          </div>
        </section>
        <aside className="propagation-panel metal-panel">
          <div className="panel-title"><span>{t.propagation}</span><b>HF / LIVE</b></div>
          <button className="map-preview" onClick={() => setMapOpen(true)} aria-label={t.openMap}><PropagationMap map={propagationMap} mode={mapMode} ariaLabel="" /><span><MapTrifold size={19} />{t.openMap}</span></button>
          <div className="mini-legend">{[0, 1, 2, 3, 4].map((level) => <span key={level}><i className={`level-${level}`} />{level}</span>)}</div>
          <div className="signal-note"><span>21.060 MHz</span><strong>{t.propLevel}: P{contactLevel}</strong><small>{selectedLog ? `${contactLocation} · SIM` : liveContactRevealed ? `${qso.npc.regionId} · ${qso.npc.isStrongStation ? "DX+" : "SIM"}` : flow.receiverLive} · {t.fixedToneHint}</small></div>
        </aside>
      </div>
      <footer className="qso-console metal-panel">
        <div className="qso-console-stack">
          <QsoDutyCoach language={language} guidance={qso.guidanceLevel} qso={qso} playerCallsign={save.callsign} powered={powered} antennaReady={antennaReady} saved={saved} onClearRetry={clearCurrentInput} />
          <div className="morse-display" aria-live="polite">
            <span>{displayLine}</span>
            <small>{phaseText}{qso.lastError === "noResponse" ? ` // ${flow.noResponse}` : qso.lastError ? ` // ${qsoErrorMessage(language, qso.lastError) || t.invalidReply} (${qso.attempts})` : ""} // {t.decoded}: {decodedPreview} // {t.accuracy}: {cw.analysis.accuracy}% // {t.rhythm}: {cw.analysis.rhythm}%</small>
          </div>
        </div>
        <div className={`receiver-live ${powered && cw.isListening ? "active" : ""} ${npcPlaybackRecovering ? "recovering" : ""}`} data-action="receiver-status"><Broadcast size={21} weight="fill" /><span>{!powered ? t.powerOff : npcPlaybackRecovering ? flow.receiverRecovering : flow.receiverLive}</span></div>
        <button data-action="replay-input" onClick={cw.replayInput} disabled={!cw.analysis.pulseCount || cw.isPlaying || cw.isKeying}><Play size={20} weight="fill" />{t.replayInput}</button>
        <button data-action="submit-reply" onClick={submitReply} disabled={!powered || !antennaReady || !qsoCanAcceptPlayer(qso) || retryRequired || !cw.analysis.pulseCount || cw.isPlaying || cw.isKeying}><Broadcast size={20} />{qso.phase === QSO_PHASES.PLAYER_CQ ? flow.sendCq : flow.sendMessage}<kbd>F2</kbd></button>
        <button data-action="save-or-restart" onClick={saveOrRestart} disabled={![QSO_PHASES.QSO_COMPLETE, QSO_PHASES.QSO_FAILED].includes(qso.phase) || saved}><FloppyDisk size={20} />{f3Label}<kbd>F3</kbd></button>
      </footer>
      {mapOpen && <MapModal language={language} mapMode={mapMode} setMapMode={setMapMode} propagationMap={propagationMap} onClose={() => setMapOpen(false)} />}
      {!mapOpen && briefingOpen && <QsoBriefingModal language={language} guidance={save.qsoGuidance} onStart={startBriefedWatch} onSkip={skipBriefing} onClose={closeBriefing} />}
      {!mapOpen && !briefingOpen && !resultDismissed && qso.phase === QSO_PHASES.QSO_FAILED && <QsoResultModal language={language} failed onRestart={saveOrRestart} />}
      {!mapOpen && !briefingOpen && !resultDismissed && qso.phase === QSO_PHASES.QSO_COMPLETE && <QsoResultModal
        language={language} entry={resultEntry} creditsAwarded={resultMeta?.creditsAwarded ?? 0} saved={saved}
        newRegion={resultMeta?.newRegion} newDistanceRecord={resultMeta?.newDistanceRecord}
        onSave={saveOrRestart} onNext={startNewQso} onClose={() => saved && setResultDismissed(true)}
      />}
    </main>
  );
}

export function App() {
  const [language, setLanguage] = useState(loadLanguagePreference);
  const [keyType, setKeyType] = useState("manual");
  const [automaticKeyWpm, setAutomaticKeyWpm] = useState(DEFAULT_AUTOMATIC_KEY_WPM);
  const [qsoGuidance, setQsoGuidance] = useState("full");
  const [screen, setScreen] = useState("start");
  const [practiceReturnScreen, setPracticeReturnScreen] = useState("start");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [saves, setSaves] = useState(() => loadSaves());
  const savesRef = useRef(saves);
  const [activeSaveId, setActiveSaveId] = useState(() => loadActiveSaveId());
  const activeSave = saves.find((save) => save.id === activeSaveId) ?? null;
  useEffect(() => {
    document.documentElement.lang = language;
    persistLanguagePreference(language);
  }, [language]);

  function commitSaves(nextSavesOrUpdater) {
    const nextSaves = typeof nextSavesOrUpdater === "function"
      ? nextSavesOrUpdater(savesRef.current)
      : nextSavesOrUpdater;
    const stored = persistSaves(nextSaves);
    savesRef.current = stored;
    setSaves(stored);
    return stored;
  }

  function selectSave(saveId) {
    const selected = savesRef.current.find((save) => save.id === saveId);
    if (selected) {
      setKeyType(selected.keyType ?? "manual");
      setAutomaticKeyWpm(normalizeAutomaticKeyWpm(selected.automaticKeyWpm));
    }
    setActiveSaveId(saveId);
    persistActiveSaveId(saveId);
    setScreen("home");
  }

  function createAndSelect(save) {
    const next = commitSaves((current) => [...current, save]);
    const created = next.find((item) => item.id === save.id) ?? next[next.length - 1];
    if (created) selectSave(created.id);
  }

  function deleteSave(saveId) {
    commitSaves((current) => current.filter((save) => save.id !== saveId));
    if (activeSaveId === saveId) {
      setActiveSaveId(null);
      persistActiveSaveId(null);
    }
  }

  function updateActiveSave(patch, { notifyAchievements = false } = {}) {
    if (!activeSaveId) return;
    const previousSave = savesRef.current.find((save) => save.id === activeSaveId) ?? null;
    const stored = commitSaves((current) => current.map((save) => save.id === activeSaveId
      ? { ...save, ...patch, updatedAt: new Date().toISOString() }
      : save));
    if (!notifyAchievements || !previousSave) return;
    const nextSave = stored.find((save) => save.id === activeSaveId) ?? null;
    if (!nextSave) return;
    const unlocked = findNewlyUnlockedAchievements(previousSave, nextSave)
      .map((achievement) => ({ ...achievement, saveId: activeSaveId }));
    if (!unlocked.length) return;
    setAchievementQueue((current) => {
      const known = new Set(current.map((achievement) => `${achievement.saveId}:${achievement.id}`));
      return [...current, ...unlocked.filter((achievement) => !known.has(`${achievement.saveId}:${achievement.id}`))];
    });
  }

  function recordActivePracticeAttempt(mode, result) {
    if (!activeSaveId) return;
    commitSaves((current) => current.map((save) => save.id === activeSaveId
      ? {
          ...save,
          practiceRecords: recordPracticeAttempt(save.practiceRecords, mode, result),
          updatedAt: new Date().toISOString(),
        }
      : save));
  }

  function purchaseForActiveSave(request) {
    if (!activeSaveId) return null;
    let transaction = null;
    commitSaves((current) => current.map((save) => {
      if (save.id !== activeSaveId) return save;
      transaction = purchaseItem(save, request);
      return transaction.save;
    }));
    return transaction;
  }

  function equipForActiveSave(request) {
    if (!activeSaveId) return null;
    let transaction = null;
    commitSaves((current) => current.map((save) => {
      if (save.id !== activeSaveId) return save;
      transaction = equipOwnedItem(save, request);
      return transaction.save;
    }));
    return transaction;
  }

  function applySettings(next) {
    const nextWpm = normalizeAutomaticKeyWpm(next.automaticKeyWpm);
    setLanguage(next.language);
    setKeyType(next.keyType);
    setAutomaticKeyWpm(nextWpm);
    setQsoGuidance(normalizeQsoGuidance(next.qsoGuidance));
    if (activeSave && ["home", "station"].includes(screen)) {
      updateActiveSave({ keyType: next.keyType, automaticKeyWpm: nextWpm, qsoGuidance: normalizeQsoGuidance(next.qsoGuidance) });
    }
  }

  function updateActivePracticePreference(mode, preferences) {
    if (!activeSaveId) return;
    commitSaves((current) => current.map((save) => save.id === activeSaveId
      ? {
          ...save,
          practiceRecords: updatePracticePreference(save.practiceRecords, mode, preferences),
          updatedAt: new Date().toISOString(),
        }
      : save));
  }

  function enterPractice(origin) {
    setPracticeReturnScreen(origin === "home" ? "home" : "start");
    setScreen("practice");
  }

  function leavePractice() {
    setScreen(practiceReturnScreen === "home" && activeSave ? "home" : "start");
  }

  let currentScreen;
  if (screen === "start") currentScreen = <StartScreen language={language} setLanguage={setLanguage} onStart={() => setScreen("saves")} onPractice={() => enterPractice("start")} onSettings={() => setSettingsOpen(true)} onManual={() => setManualOpen(true)} />;
  else if (screen === "saves") currentScreen = <SaveSelectScreen language={language} saves={saves} activeSaveId={activeSaveId} defaultKeyType={keyType} defaultAutomaticKeyWpm={automaticKeyWpm} defaultQsoGuidance={qsoGuidance} onLoad={selectSave} onCreate={createAndSelect} onDelete={deleteSave} onBack={() => setScreen("start")} />;
  else if (screen === "home" && activeSave) currentScreen = <HomeScreen language={language} save={activeSave} onPurchase={purchaseForActiveSave} onEquipItem={equipForActiveSave} onEnterStation={() => setScreen("station")} onEnterPractice={() => enterPractice("home")} onBack={() => setScreen("saves")} onSettings={() => setSettingsOpen(true)} />;
  else if (screen === "practice") {
    const persistentStats = practiceStatsByMode(activeSave?.practiceRecords);
    if (activeSave?.practiceRecords) {
      Object.keys(persistentStats).forEach((mode) => {
        persistentStats[mode].recentTargets = activeSave.practiceRecords[mode]?.recentTargets ?? [];
      });
    }
    currentScreen = <PracticeScreen
      language={language}
      automaticKeyWpm={activeSave?.automaticKeyWpm ?? automaticKeyWpm}
      inputBlocked={settingsOpen}
      persistentStats={persistentStats}
      recordingCallsign={activeSave?.callsign ?? null}
      onRecordAttempt={recordActivePracticeAttempt}
      onPreferenceChange={updateActivePracticePreference}
      onSessionComplete={() => {}}
      onSettings={() => setSettingsOpen(true)}
      onBack={leavePractice}
    />;
  }
  else if (activeSave) currentScreen = <StationScreen key={activeSave.id} language={language} keyType={activeSave.keyType ?? keyType} save={activeSave} onSaveUpdate={updateActiveSave} inputBlocked={settingsOpen} onSettings={() => setSettingsOpen(true)} onBack={() => setScreen("home")} />;
  else currentScreen = <SaveSelectScreen language={language} saves={saves} activeSaveId={activeSaveId} defaultKeyType={keyType} defaultAutomaticKeyWpm={automaticKeyWpm} defaultQsoGuidance={qsoGuidance} onLoad={selectSave} onCreate={createAndSelect} onDelete={deleteSave} onBack={() => setScreen("start")} />;
  return <>
    {currentScreen}
    <NetworkIndicator language={language} />
    <AchievementNotification
      language={language}
      activeAchievement={achievementQueue[0] ?? null}
      queueSize={achievementQueue.length}
      onDismiss={() => setAchievementQueue((current) => current.slice(1))}
    />
    {manualOpen && <StationManualModal language={language} onClose={() => setManualOpen(false)} />}
    {settingsOpen && <SettingsModal
      language={language}
      keyType={activeSave && ["home", "station"].includes(screen) ? activeSave.keyType : keyType}
      automaticKeyWpm={activeSave && ["home", "station"].includes(screen) ? activeSave.automaticKeyWpm : automaticKeyWpm}
      qsoGuidance={activeSave && ["home", "station"].includes(screen) ? activeSave.qsoGuidance : qsoGuidance}
      onApply={applySettings}
      onClose={() => setSettingsOpen(false)}
    />}
  </>;
}
