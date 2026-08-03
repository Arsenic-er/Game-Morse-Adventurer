import { useEffect, useState } from "react";
import {
  ArrowLeft, Books, Broadcast, Check, Coins, GearSix, Laptop, MapPin, Notebook,
  Package, Radio, Storefront, Trophy, Warehouse, Wrench, X,
} from "@phosphor-icons/react";
import { ANTENNAS, antennaName, getAntenna } from "../game/antennaCatalog.js";
import { ACCESSORIES, accessoryName, getAccessory } from "../game/accessoryCatalog.js";
import { TRANSMITTERS, equipmentName, getTransmitter } from "../game/equipmentCatalog.js";
import { getLocation, locationName } from "../game/locations.js";
import { LocationArtwork } from "../game/LocationArtwork.jsx";
import { QsoRewardBreakdown } from "../components/QsoRewardBreakdown.jsx";
import { summarizePracticeProgress } from "../practice/practiceRecords.js";
import { AchievementsModal } from "./AchievementsModal.jsx";
import { StoreModal } from "./StoreModal.jsx";

const TEXT = {
  "zh-CN": { title: "管理中心", station: "进入发射台", practice: "CW 练习与教学", practiceProgress: "课程进度", warehouse: "仓库", store: "商店", log: "通联日志", achievements: "成就", placeholder: "功能占位", later: "该功能将在后续版本开放。", back: "返回存档", settings: "设置", local: "当地时间", close: "关闭" },
  "zh-TW": { title: "管理中心", station: "進入發射臺", practice: "CW 練習與教學", practiceProgress: "課程進度", warehouse: "倉庫", store: "商店", log: "通聯日誌", achievements: "成就", placeholder: "功能預留", later: "此功能將在後續版本開放。", back: "返回存檔", settings: "設定", local: "當地時間", close: "關閉" },
  ja: { title: "管理センター", station: "運用卓へ", practice: "CW 練習・レッスン", practiceProgress: "レッスン進捗", warehouse: "倉庫", store: "ショップ", log: "交信ログ", achievements: "実績", placeholder: "準備中", later: "この機能は今後のバージョンで開放されます。", back: "セーブへ戻る", settings: "設定", local: "現地時刻", close: "閉じる" },
  en: { title: "Management Center", station: "Enter Station", practice: "CW Practice & Lessons", practiceProgress: "Lesson progress", warehouse: "Warehouse", store: "Store", log: "QSO Log", achievements: "Achievements", placeholder: "Coming Soon", later: "This feature will open in a later version.", back: "Back to Saves", settings: "Settings", local: "Local time", close: "Close" },
  es: { title: "Centro de Gestión", station: "Entrar en la estación", practice: "Práctica y lecciones de CW", practiceProgress: "Progreso de lecciones", warehouse: "Almacén", store: "Tienda", log: "Registro QSO", achievements: "Logros", placeholder: "Próximamente", later: "Esta función se abrirá en una versión posterior.", back: "Volver a partidas", settings: "Ajustes", local: "Hora local", close: "Cerrar" },
  de: { title: "Verwaltungszentrum", station: "Station betreten", practice: "CW-Übung und Lektionen", practiceProgress: "Lektionsfortschritt", warehouse: "Lager", store: "Laden", log: "QSO-Logbuch", achievements: "Erfolge", placeholder: "Demnächst", later: "Diese Funktion wird in einer späteren Version geöffnet.", back: "Zurück zu Spielständen", settings: "Einstellungen", local: "Ortszeit", close: "Schließen" },
  ru: { title: "Центр управления", station: "Войти на станцию", practice: "Практика и уроки CW", practiceProgress: "Прогресс уроков", warehouse: "Склад", store: "Магазин", log: "Журнал QSO", achievements: "Достижения", placeholder: "Скоро", later: "Эта функция появится в следующей версии.", back: "Назад к сохранениям", settings: "Настройки", local: "Местное время", close: "Закрыть" },
};

const WAREHOUSE_TEXT = {
  "zh-CN": { title: "设备仓库", rack: "设备架", radio: "电台", antenna: "天线", accessories: "配件", antennaDrawer: "天线抽屉", accessoryBar: "配件栏", later: "后续开放", current: "当前配置", fixed: "固定", replaceable: "可更换", reserved: "预留", equip: "装备", equipped: "已装备", noAntenna: "空天线槽", noAccessory: "空配件槽", locked: "未开放", back: "返回管理中心", propagation: "传播修正", noise: "噪声修正" },
  "zh-TW": { title: "設備倉庫", rack: "設備架", radio: "電臺", antenna: "天線", accessories: "配件", antennaDrawer: "天線抽屜", accessoryBar: "配件欄", later: "後續開放", current: "目前配置", fixed: "固定", replaceable: "可更換", reserved: "預留", equip: "裝備", equipped: "已裝備", noAntenna: "空天線槽", noAccessory: "空配件槽", locked: "未開放", back: "返回管理中心", propagation: "傳播修正", noise: "雜訊修正" },
  ja: { title: "装備倉庫", rack: "装備ラック", radio: "無線機", antenna: "アンテナ", accessories: "アクセサリー", antennaDrawer: "アンテナ引出し", accessoryBar: "アクセサリー欄", later: "今後開放", current: "現在の構成", fixed: "固定", replaceable: "交換可能", reserved: "予約", equip: "装備", equipped: "装備中", noAntenna: "空きアンテナ枠", noAccessory: "空きアクセサリー枠", locked: "未開放", back: "管理センターへ戻る", propagation: "伝搬補正", noise: "ノイズ補正" },
  en: { title: "Equipment Warehouse", rack: "Equipment Rack", radio: "Radio", antenna: "Antenna", accessories: "Accessories", antennaDrawer: "Antenna Drawer", accessoryBar: "Accessory Rack", later: "Coming later", current: "Current Loadout", fixed: "Fixed", replaceable: "Replaceable", reserved: "Reserved", equip: "Equip", equipped: "Equipped", noAntenna: "Empty antenna slot", noAccessory: "Empty accessory slot", locked: "Locked", back: "Back to Management Center", propagation: "Propagation modifier", noise: "Noise modifier" },
  es: { title: "Almacén de equipos", rack: "Estante de equipos", radio: "Radio", antenna: "Antena", accessories: "Accesorios", antennaDrawer: "Cajón de antenas", accessoryBar: "Estante de accesorios", later: "Más adelante", current: "Equipo actual", fixed: "Fijo", replaceable: "Sustituible", reserved: "Reservado", equip: "Equipar", equipped: "Equipado", noAntenna: "Ranura de antena vacía", noAccessory: "Ranura de accesorio vacía", locked: "Bloqueado", back: "Volver al Centro de Gestión", propagation: "Modificador de propagación", noise: "Modificador de ruido" },
  de: { title: "Ausrüstungslager", rack: "Ausrüstungsregal", radio: "Funkgerät", antenna: "Antenne", accessories: "Zubehör", antennaDrawer: "Antennenschublade", accessoryBar: "Zubehörregal", later: "Später verfügbar", current: "Aktuelle Ausrüstung", fixed: "Fest", replaceable: "Austauschbar", reserved: "Reserviert", equip: "Ausrüsten", equipped: "Ausgerüstet", noAntenna: "Leerer Antennenplatz", noAccessory: "Leerer Zubehörplatz", locked: "Gesperrt", back: "Zurück zum Verwaltungszentrum", propagation: "Ausbreitungsmodifikator", noise: "Rauschmodifikator" },
  ru: { title: "Склад оборудования", rack: "Стеллаж оборудования", radio: "Радиостанция", antenna: "Антенна", accessories: "Аксессуары", antennaDrawer: "Ящик антенн", accessoryBar: "Полка аксессуаров", later: "Позже", current: "Текущая комплектация", fixed: "Фиксировано", replaceable: "Заменяемо", reserved: "Зарезервировано", equip: "Установить", equipped: "Установлено", noAntenna: "Пустое место антенны", noAccessory: "Пустое место аксессуара", locked: "Заблокировано", back: "Назад в Центр управления", propagation: "Модификатор прохождения", noise: "Модификатор шума" },
};

const PANEL_ICONS = { store: Storefront, log: Notebook, achievements: Trophy };

const QSO_LOG_TEXT = {
  "zh-CN": {
    title: "通联日志", kicker: "台站记录", records: "记录", latest: "最新", dateTime: "台站当地 / UTC", callsign: "呼号",
    frequency: "频率", rst: "发送 / 接收 RST", region: "地区", distance: "距离", propagation: "传播等级", antenna: "天线",
    equipment: "设备", accessory: "配件", wpm: "速度", performance: "发报准确率 / 节奏", repeats: "请求重发", credits: "信用点", sim: "SIM · 虚构台站",
    stationTime: "台站当地", utcTime: "协调世界时",
    emptyTitle: "尚无通联记录", emptyText: "完成一次通联并保存日志后，记录会出现在这里。", back: "返回管理中心", close: "关闭通联日志",
  },
  "zh-TW": {
    title: "通聯日誌", kicker: "臺站記錄", records: "記錄", latest: "最新", dateTime: "臺站當地 / UTC", callsign: "呼號",
    frequency: "頻率", rst: "發送 / 接收 RST", region: "地區", distance: "距離", propagation: "傳播等級", antenna: "天線",
    equipment: "設備", accessory: "配件", wpm: "速度", performance: "發報準確率 / 節奏", repeats: "請求重發", credits: "信用點", sim: "SIM · 虛構臺站",
    stationTime: "臺站當地", utcTime: "協調世界時",
    emptyTitle: "尚無通聯記錄", emptyText: "完成一次通聯並儲存日誌後，記錄會顯示在這裡。", back: "返回管理中心", close: "關閉通聯日誌",
  },
  ja: {
    title: "交信ログ", kicker: "局運用記録", records: "件", latest: "最新", dateTime: "局の現地 / UTC", callsign: "コールサイン",
    frequency: "周波数", rst: "送信 / 受信 RST", region: "地域", distance: "距離", propagation: "伝搬レベル", antenna: "アンテナ",
    equipment: "無線機", accessory: "アクセサリー", wpm: "速度", performance: "送信正確度 / リズム", repeats: "再送要求", credits: "クレジット", sim: "SIM · 架空局",
    stationTime: "局の現地時刻", utcTime: "協定世界時",
    emptyTitle: "交信記録はありません", emptyText: "交信を完了してログを保存すると、ここに記録されます。", back: "管理センターへ戻る", close: "交信ログを閉じる",
  },
  en: {
    title: "QSO Log", kicker: "Station Record", records: "records", latest: "Latest", dateTime: "Station local / UTC", callsign: "Callsign",
    frequency: "Frequency", rst: "Sent / Received RST", region: "Region", distance: "Distance", propagation: "Propagation", antenna: "Antenna",
    equipment: "Equipment", accessory: "Accessory", wpm: "Speed", performance: "Transmit accuracy / Rhythm", repeats: "Repeat requests", credits: "Credits", sim: "SIM · Fictional station",
    stationTime: "Station local", utcTime: "Coordinated UTC",
    emptyTitle: "No QSO records yet", emptyText: "Complete a contact and save its log to add the first record.", back: "Back to Management Center", close: "Close QSO log",
  },
  es: {
    title: "Registro QSO", kicker: "Registro de estación", records: "registros", latest: "Más reciente", dateTime: "Hora local / UTC", callsign: "Indicativo",
    frequency: "Frecuencia", rst: "RST enviado / recibido", region: "Región", distance: "Distancia", propagation: "Propagación", antenna: "Antena",
    equipment: "Equipo", accessory: "Accesorio", wpm: "Velocidad", performance: "Precisión / Ritmo", repeats: "Peticiones de repetición", credits: "Créditos", sim: "SIM · Estación ficticia",
    stationTime: "Hora local de estación", utcTime: "UTC coordinado",
    emptyTitle: "Aún no hay registros QSO", emptyText: "Completa un contacto y guarda su registro para añadir la primera entrada.", back: "Volver al Centro de Gestión", close: "Cerrar registro QSO",
  },
  de: {
    title: "QSO-Logbuch", kicker: "Stationsprotokoll", records: "Einträge", latest: "Neuester", dateTime: "Stationszeit / UTC", callsign: "Rufzeichen",
    frequency: "Frequenz", rst: "Gesendeter / empfangener RST", region: "Region", distance: "Entfernung", propagation: "Ausbreitung", antenna: "Antenne",
    equipment: "Ausrüstung", accessory: "Zubehör", wpm: "Geschwindigkeit", performance: "Sendegenauigkeit / Rhythmus", repeats: "Wiederholungsanfragen", credits: "Kredite", sim: "SIM · Fiktive Station",
    stationTime: "Stationsortszeit", utcTime: "Koordinierte UTC",
    emptyTitle: "Noch keine QSO-Einträge", emptyText: "Schließe eine Verbindung ab und speichere ihr Log, um den ersten Eintrag anzulegen.", back: "Zurück zum Verwaltungszentrum", close: "QSO-Logbuch schließen",
  },
  ru: {
    title: "Журнал QSO", kicker: "Журнал станции", records: "записей", latest: "Последняя", dateTime: "Местное время / UTC", callsign: "Позывной",
    frequency: "Частота", rst: "Переданный / принятый RST", region: "Регион", distance: "Расстояние", propagation: "Прохождение", antenna: "Антенна",
    equipment: "Оборудование", accessory: "Аксессуар", wpm: "Скорость", performance: "Точность / Ритм", repeats: "Запросы повтора", credits: "Кредиты", sim: "SIM · Вымышленная станция",
    stationTime: "Местное время станции", utcTime: "Всемирное время UTC",
    emptyTitle: "Записей QSO пока нет", emptyText: "Завершите связь и сохраните журнал, чтобы добавить первую запись.", back: "Назад в Центр управления", close: "Закрыть журнал QSO",
  },
};

const QSO_REVIEW_TEXT = {
  "zh-CN": {
    title: "操作复盘", empty: "旧版日志没有逐次操作记录", guidance: "引导", visual: "视觉辅助", independent: "独立值守",
    full: "完整引导", hints: "仅提示", off: "关闭", used: "已使用", unused: "未使用", yes: "达成", no: "未达成",
    accepted: "接受", transmitted: "已发射", error: "错误", repeat: "重发", unknown: "未记录", reason: "原因", accuracy: "准确率", rhythm: "节奏",
    PLAYER_CQ: "呼叫 CQ", PLAYER_RST_AND_73: "交换 RST / 73", missingCq: "缺少 CQ", missingDe: "缺少 DE", missingPlayerCallsign: "缺少自己的呼号", wrongCqOrder: "CQ 电文顺序错误", missingK: "结尾缺少 K", invalidAgn: "重发请求必须为 AGN K", missingCallsign: "缺少双方呼号", invalidRst: "RST 格式无效", missing73: "缺少 73", wrongReplyOrder: "回复电文顺序错误", notWaitingForPlayer: "当前阶段不接受发报",
  },
  "zh-TW": {
    title: "操作複盤", empty: "舊版日誌沒有逐次操作記錄", guidance: "引導", visual: "視覺輔助", independent: "獨立值守",
    full: "完整引導", hints: "僅提示", off: "關閉", used: "已使用", unused: "未使用", yes: "達成", no: "未達成",
    accepted: "接受", transmitted: "已發射", error: "錯誤", repeat: "重發", unknown: "未記錄", reason: "原因", accuracy: "準確率", rhythm: "節奏",
    PLAYER_CQ: "呼叫 CQ", PLAYER_RST_AND_73: "交換 RST / 73", missingCq: "缺少 CQ", missingDe: "缺少 DE", missingPlayerCallsign: "缺少自己的呼號", wrongCqOrder: "CQ 電文順序錯誤", missingK: "結尾缺少 K", invalidAgn: "重發請求必須為 AGN K", missingCallsign: "缺少雙方呼號", invalidRst: "RST 格式無效", missing73: "缺少 73", wrongReplyOrder: "回覆電文順序錯誤", notWaitingForPlayer: "目前階段不接受發報",
  },
  ja: {
    title: "運用レビュー", empty: "旧形式のログには操作履歴がありません", guidance: "ガイド", visual: "視覚補助", independent: "単独運用",
    full: "フルガイド", hints: "ヒントのみ", off: "オフ", used: "使用", unused: "未使用", yes: "達成", no: "未達成",
    accepted: "受付", transmitted: "送信済み", error: "エラー", repeat: "再送", unknown: "記録なし", reason: "理由", accuracy: "正確度", rhythm: "リズム",
    PLAYER_CQ: "CQ 呼出", PLAYER_RST_AND_73: "RST / 73 交換", missingCq: "CQ がありません", missingDe: "DE がありません", missingPlayerCallsign: "自局コールサインがありません", wrongCqOrder: "CQ 電文の順序が違います", missingK: "末尾の K がありません", invalidAgn: "再送要求は AGN K にしてください", missingCallsign: "両局のコールサインが必要です", invalidRst: "RST 形式が無効です", missing73: "73 がありません", wrongReplyOrder: "応答電文の順序が違います", notWaitingForPlayer: "現在は送信を受け付けていません",
  },
  en: {
    title: "Operating Review", empty: "No attempt history is available in this legacy log", guidance: "Guidance", visual: "Visual assist", independent: "Independent watch",
    full: "Full", hints: "Hints only", off: "Off", used: "Used", unused: "Not used", yes: "Qualified", no: "Not qualified",
    accepted: "Accepted", transmitted: "Transmitted", error: "Error", repeat: "Repeat", unknown: "Not recorded", reason: "Reason", accuracy: "Accuracy", rhythm: "Rhythm",
    PLAYER_CQ: "Call CQ", PLAYER_RST_AND_73: "Exchange RST / 73", missingCq: "CQ is missing", missingDe: "DE is missing", missingPlayerCallsign: "Your callsign is missing", wrongCqOrder: "CQ message is out of order", missingK: "Final K is missing", invalidAgn: "A repeat request must be AGN K", missingCallsign: "Both callsigns are required", invalidRst: "RST format is invalid", missing73: "73 is missing", wrongReplyOrder: "Reply message is out of order", notWaitingForPlayer: "This stage is not accepting a transmission",
  },
  es: {
    title: "Revisión de operación", empty: "Este registro antiguo no contiene historial de intentos", guidance: "Guía", visual: "Ayuda visual", independent: "Guardia independiente",
    full: "Completa", hints: "Solo pistas", off: "Desactivada", used: "Usada", unused: "No usada", yes: "Apto", no: "No apto",
    accepted: "Aceptado", transmitted: "Transmitido", error: "Error", repeat: "Repetición", unknown: "Sin registro", reason: "Motivo", accuracy: "Precisión", rhythm: "Ritmo",
    PLAYER_CQ: "Llamar CQ", PLAYER_RST_AND_73: "Intercambiar RST / 73", missingCq: "Falta CQ", missingDe: "Falta DE", missingPlayerCallsign: "Falta tu indicativo", wrongCqOrder: "El mensaje CQ está desordenado", missingK: "Falta la K final", invalidAgn: "La petición de repetición debe ser AGN K", missingCallsign: "Se requieren ambos indicativos", invalidRst: "El formato RST no es válido", missing73: "Falta 73", wrongReplyOrder: "El mensaje de respuesta está desordenado", notWaitingForPlayer: "Esta etapa no acepta una transmisión",
  },
  de: {
    title: "Betriebsauswertung", empty: "Dieses ältere Log enthält keinen Versuchsverlauf", guidance: "Führung", visual: "Visuelle Hilfe", independent: "Selbstständige Wache",
    full: "Vollständig", hints: "Nur Hinweise", off: "Aus", used: "Benutzt", unused: "Nicht benutzt", yes: "Bestanden", no: "Nicht bestanden",
    accepted: "Akzeptiert", transmitted: "Gesendet", error: "Fehler", repeat: "Wiederholung", unknown: "Nicht erfasst", reason: "Grund", accuracy: "Genauigkeit", rhythm: "Rhythmus",
    PLAYER_CQ: "CQ rufen", PLAYER_RST_AND_73: "RST / 73 austauschen", missingCq: "CQ fehlt", missingDe: "DE fehlt", missingPlayerCallsign: "Dein Rufzeichen fehlt", wrongCqOrder: "CQ-Nachricht hat die falsche Reihenfolge", missingK: "Abschließendes K fehlt", invalidAgn: "Eine Wiederholungsanfrage muss AGN K sein", missingCallsign: "Beide Rufzeichen sind erforderlich", invalidRst: "RST-Format ist ungültig", missing73: "73 fehlt", wrongReplyOrder: "Antwort hat die falsche Reihenfolge", notWaitingForPlayer: "Diese Phase nimmt keine Sendung an",
  },
  ru: {
    title: "Разбор работы", empty: "В старой записи нет истории попыток", guidance: "Подсказки", visual: "Визуальная помощь", independent: "Самостоятельная вахта",
    full: "Полные", hints: "Только намёки", off: "Выкл.", used: "Использована", unused: "Не использована", yes: "Зачёт", no: "Нет зачёта",
    accepted: "Принято", transmitted: "Передано", error: "Ошибка", repeat: "Повтор", unknown: "Не записано", reason: "Причина", accuracy: "Точность", rhythm: "Ритм",
    PLAYER_CQ: "Вызвать CQ", PLAYER_RST_AND_73: "Обменяться RST / 73", missingCq: "Отсутствует CQ", missingDe: "Отсутствует DE", missingPlayerCallsign: "Отсутствует ваш позывной", wrongCqOrder: "Неверный порядок сообщения CQ", missingK: "Нет завершающего K", invalidAgn: "Запрос повтора должен быть AGN K", missingCallsign: "Нужны оба позывных", invalidRst: "Неверный формат RST", missing73: "Отсутствует 73", wrongReplyOrder: "Неверный порядок ответа", notWaitingForPlayer: "На этом этапе передача не принимается",
  },
};

function logReviewResult(result, t) {
  const normalized = String(result ?? "").toLowerCase();
  if (["accepted", "accept", "correct", "success", "ok"].includes(normalized)) return { label: t.accepted, className: "accepted" };
  if (normalized === "transmitted") return { label: t.transmitted, className: "transmitted" };
  if (["repeat", "repeated", "agn", "retry"].includes(normalized)) return { label: t.repeat, className: "repeat" };
  if (["error", "incorrect", "rejected", "failed", "invalid"].includes(normalized)) return { label: t.error, className: "error" };
  return { label: result || t.unknown, className: "unknown" };
}

function QsoLogReview({ entry, language }) {
  const t = QSO_REVIEW_TEXT[language] ?? QSO_REVIEW_TEXT.en;
  const history = Array.isArray(entry?.attemptHistory) ? entry.attemptHistory.filter((attempt) => attempt && typeof attempt === "object") : [];
  const hasReviewData = history.length > 0;
  const booleanLabel = (item, positive, negative) => typeof item === "boolean" ? (item ? positive : negative) : "---";
  return (
    <section className="qso-log-review" aria-label={t.title} data-attempt-count={history.length} data-guidance-level={hasReviewData ? entry?.guidanceLevel : "legacy"}>
      <header>
        <h4>{t.title}</h4>
        <div>
          <span>{t.guidance}: <b>{hasReviewData && entry?.guidanceLevel ? (t[entry.guidanceLevel] ?? entry.guidanceLevel) : "---"}</b></span>
          <span data-visual-assist={hasReviewData ? String(entry?.visualAssistUsed === true) : "legacy"}>{t.visual}: <b>{hasReviewData ? booleanLabel(entry?.visualAssistUsed, t.used, t.unused) : "---"}</b></span>
          <span data-independent-watch={hasReviewData ? String(entry?.independentWatch === true) : "legacy"}>{t.independent}: <b>{hasReviewData ? booleanLabel(entry?.independentWatch, t.yes, t.no) : "---"}</b></span>
        </div>
      </header>
      {history.length ? (
        <ol>
          {history.map((attempt, index) => {
            const result = logReviewResult(attempt.result, t);
            return (
              <li className={result.className} data-review-result={result.className} key={`${attempt.stage ?? "stage"}-${index}`}>
                <b>#{String(index + 1).padStart(2, "0")} · {t[attempt.stage] ?? attempt.stage ?? "---"}</b>
                <em>{result.label}</em>
                <code>{attempt.message || "---"}</code>
                <small>{attempt.wpm ?? "---"} WPM · {t.accuracy} {attempt.accuracy ?? "---"}% · {t.rhythm} {attempt.rhythm ?? "---"}%</small>
                <p>{t.reason}: {attempt.reason ? (t[attempt.reason] ?? attempt.reason) : "---"}</p>
              </li>
            );
          })}
        </ol>
      ) : <p className="qso-log-review-empty">{t.empty}</p>}
    </section>
  );
}

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
  const locales = { "zh-CN": "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", en: "en-US", es: "es-ES", de: "de-DE", ru: "ru-RU" };
  const locale = locales[language] ?? "en-US";
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

function accessorySnapshotName(entry, language) {
  const explicit = firstValue(entry.accessoryName, entry.accessoryLabel);
  if (explicit) return explicit;
  const accessory = getAccessory(firstValue(entry.accessoryId, entry.accessory));
  return accessory.id === "none" ? "—" : accessoryName(accessory, language);
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
  const accuracy = selected ? firstValue(selected.transmitAccuracy, selected.copyAccuracy, selected.accuracy) : null;
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
                <div className="qso-log-equipment-fact"><dt>{t.equipment} / {t.accessory}</dt><dd><Radio size={16} weight="fill" /><span>{equipmentSnapshotName(selected, language)}<br />{accessorySnapshotName(selected, language)}</span></dd></div>
                <div><dt>{t.wpm}</dt><dd>{formatMetric(firstValue(selected.wpm, selected.speedWpm), " WPM")}</dd></div>
                <div><dt>{t.performance}</dt><dd>{formatMetric(accuracy, "%")} / {formatMetric(rhythm, "%")}</dd></div>
                <div><dt>{t.repeats}</dt><dd>{formatMetric(firstValue(selected.repeatRequests, 0))}</dd></div>
                <div className="qso-log-credit-fact"><dt>{t.credits}</dt><dd><Coins size={17} weight="fill" />{formatCredits(firstValue(selected.credits, selected.creditsAwarded))}</dd></div>
              </dl>
              <QsoRewardBreakdown language={language} breakdown={selected.rewardBreakdown ?? null} credits={firstValue(selected.credits, selected.creditsAwarded)} compact />
              <QsoLogReview entry={selected} language={language} />
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

function EmptyAccessory({ size = 64 }) {
  return <span className="warehouse-empty-asset" aria-hidden="true"><Package size={size} /><X size={Math.round(size * .42)} weight="bold" /></span>;
}

function WarehouseModal({ language, save, onEquipItem, onClose }) {
  const t = WAREHOUSE_TEXT[language] ?? WAREHOUSE_TEXT.en;
  const transmitter = getTransmitter(save.equipmentId);
  const equippedAntenna = getAntenna(save.antennaId);
  const equippedAccessory = getAccessory(save.accessoryId);
  const [activeCategory, setActiveCategory] = useState("radio");
  const [draftRadioId, setDraftRadioId] = useState(save.equipmentId);
  const [draftAntennaId, setDraftAntennaId] = useState(save.antennaId);
  const [draftAccessoryId, setDraftAccessoryId] = useState(save.accessoryId ?? "none");
  const draftRadio = getTransmitter(draftRadioId);
  const draftAntenna = getAntenna(draftAntennaId);
  const draftAccessory = getAccessory(draftAccessoryId);
  const availableRadios = TRANSMITTERS.filter((radio) => radio.id === transmitter.id || (save.ownedEquipment ?? []).includes(radio.id));
  const availableAntennas = ANTENNAS.filter((antenna) => antenna.id === "none" || save.ownedAntennas.includes(antenna.id));
  const availableAccessories = ACCESSORIES.filter((accessory) => accessory.id === "none" || (save.accessories ?? []).includes(accessory.id));
  const category = activeCategory === "radio" ? {
    image: draftRadio.image,
    name: equipmentName(draftRadio, language),
  } : activeCategory === "antenna" ? {
    image: draftAntenna.image,
    name: antennaName(draftAntenna, language),
  } : {
    image: draftAccessory.image,
    name: accessoryName(draftAccessory, language),
  };
  const selectedItemId = activeCategory === "antenna" ? draftAntenna.id : activeCategory === "accessories" ? draftAccessory.id : draftRadio.id;
  const alreadyEquipped = (activeCategory === "radio" && draftRadio.id === transmitter.id)
    || (activeCategory === "antenna" && draftAntenna.id === equippedAntenna.id)
    || (activeCategory === "accessories" && draftAccessory.id === equippedAccessory.id);

  function chooseRadio(radioId) {
    setDraftRadioId(radioId);
    setActiveCategory("radio");
  }

  function chooseAntenna(antennaId) {
    setDraftAntennaId(antennaId);
    setActiveCategory("antenna");
  }

  function chooseAccessory(accessoryId) {
    setDraftAccessoryId(accessoryId);
    setActiveCategory("accessories");
  }

  function equipSelected() {
    if (activeCategory === "radio") onEquipItem({ category: "radio", itemId: draftRadio.id });
    if (activeCategory === "antenna") onEquipItem({ category: "antenna", itemId: draftAntenna.id });
    if (activeCategory === "accessories") onEquipItem({ category: "accessories", itemId: draftAccessory.id });
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
          <button data-warehouse-category="radio" className={activeCategory === "radio" ? "selected" : ""} onClick={() => setActiveCategory("radio")} aria-pressed={activeCategory === "radio"}>
            <span><img src={transmitter.image} alt="" /></span><strong>{t.radio}</strong>
          </button>
          <button className={activeCategory === "antenna" ? "selected" : ""} onClick={() => setActiveCategory("antenna")} aria-pressed={activeCategory === "antenna"}>
            <span>{equippedAntenna.image ? <img src={equippedAntenna.image} alt="" /> : <EmptyAntenna size={54} />}</span><strong>{t.antenna}</strong>
          </button>
          <button className={activeCategory === "accessories" ? "selected" : ""} onClick={() => setActiveCategory("accessories")} aria-pressed={activeCategory === "accessories"}>
            <span>{equippedAccessory.image ? <img src={equippedAccessory.image} alt="" /> : <Wrench size={55} weight="duotone" />}</span><strong>{t.accessories}</strong>
          </button>
        </aside>

        <main className="warehouse-equipment-rack">
          <div className="rack-title"><span />{t.rack}<span /></div>
          <section className={`rack-preview category-${activeCategory}`}>
            {category.image ? <img src={category.image} alt={category.name} /> : activeCategory === "antenna" ? <EmptyAntenna size={100} /> : activeCategory === "accessories" ? <EmptyAccessory size={100} /> : <Package size={104} weight="duotone" />}
            <strong>{category.name}</strong>
            <button className="rack-equip-button" data-action="equip-item" data-equipped-item-id={selectedItemId} disabled={alreadyEquipped} onClick={equipSelected}><Check size={20} weight="bold" />{alreadyEquipped ? t.equipped : t.equip}</button>
          </section>

          {activeCategory === "radio" && <section className="equipment-drawer antenna-drawer radio-drawer">
            <h3><span />{t.radio}<span /></h3>
            <div>
              {availableRadios.map((radio) => (
                <button key={radio.id} data-radio-id={radio.id} data-testid={`warehouse-radio-${radio.id}`} className={draftRadio.id === radio.id ? "selected" : ""} aria-pressed={draftRadio.id === radio.id} onClick={() => chooseRadio(radio.id)}>
                  {radio.image ? <img src={radio.image} alt="" /> : <Radio size={56} />}
                  <strong>{equipmentName(radio, language)}</strong>
                  <small>{t.propagation}: {radio.propagationBonus > 0 ? `+${radio.propagationBonus}` : radio.propagationBonus ?? 0}</small>
                </button>
              ))}
            </div>
          </section>}

          {activeCategory === "antenna" && <section className="equipment-drawer antenna-drawer">
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
          </section>}

          {activeCategory === "accessories" && <section className="equipment-drawer accessory-drawer">
            <h3><span />{t.accessoryBar}<span /></h3>
            <div className="accessory-placeholders">
              {availableAccessories.map((accessory) => (
                <button key={accessory.id} data-accessory-id={accessory.id} className={draftAccessory.id === accessory.id ? "selected" : ""} aria-pressed={draftAccessory.id === accessory.id} onClick={() => chooseAccessory(accessory.id)}>
                  {accessory.image ? <img src={accessory.image} alt="" /> : <EmptyAccessory size={42} />}
                  <strong>{accessory.id === "none" ? t.noAccessory : accessoryName(accessory, language)}</strong>
                  <small>{accessory.id === "none" ? t.noise + ": —" : `${t.noise}: -${Math.round((1 - accessory.noiseGainMultiplier) * 100)}%`}</small>
                </button>
              ))}
              {Array.from({ length: Math.max(0, 4 - availableAccessories.length) }, (_, slot) => <span className="locked-slot" key={slot}><Package size={30} /><small>{t.locked}</small></span>)}
            </div>
          </section>}
        </main>

        <aside className="warehouse-current-loadout">
          <button className="warehouse-return" onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.back}</button>
          <header><span />{t.current}<span /></header>
          <b>{save.callsign}</b>
          <ol>
            <li data-testid="current-radio-loadout" data-equipment-id={transmitter.id}><strong>1. {t.radio} ({t.replaceable})</strong><div><img src={transmitter.image} alt="" /></div><small>{equipmentName(transmitter, language)}</small></li>
            <li><strong>2. {t.antenna} ({t.replaceable})</strong><div>{equippedAntenna.image ? <img src={equippedAntenna.image} alt="" /> : <EmptyAntenna size={55} />}</div><small>{antennaName(equippedAntenna, language)}</small></li>
            <li className={equippedAccessory.id === "none" ? "reserved-slot" : ""}><strong>3. {t.accessories} ({t.replaceable})</strong><div>{equippedAccessory.image ? <img src={equippedAccessory.image} alt="" /> : <EmptyAccessory size={48} />}</div><small>{equippedAccessory.id === "none" ? t.noAccessory : accessoryName(equippedAccessory, language)}</small></li>
          </ol>
        </aside>
      </section>
    </div>
  );
}

export function HomeScreen({ language, save, onPurchase, onEquipItem, onEnterStation, onEnterPractice, onBack, onSettings }) {
  const t = TEXT[language] ?? TEXT.en;
  const location = getLocation(save.locationId);
  const practiceProgress = summarizePracticeProgress(save.practiceRecords);
  const practiceProgressLabel = `${t.practiceProgress} ${practiceProgress.completedLessons}/${practiceProgress.totalLessons} · ${practiceProgress.percent}%`;
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
      <button
        className="home-hotspot hotspot-practice"
        data-action="enter-practice"
        data-testid="home-practice-hotspot"
        data-practice-completed={practiceProgress.completedLessons}
        data-practice-total={practiceProgress.totalLessons}
        data-practice-percent={practiceProgress.percent}
        aria-label={`${t.practice} · ${practiceProgressLabel}`}
        onClick={onEnterPractice}
      >
        <i
          className="home-practice-progress"
          data-testid="home-practice-progress"
          data-practice-completed={practiceProgress.completedLessons}
          data-practice-total={practiceProgress.totalLessons}
          data-practice-percent={practiceProgress.percent}
          style={{ "--practice-progress": `${practiceProgress.percent}%` }}
          aria-hidden="true"
        />
        <span className="home-practice-label"><Books size={22} weight="fill" /><span><strong>{t.practice}</strong><small>{practiceProgressLabel}</small></span></span>
      </button>
      <button className="home-hotspot hotspot-log" aria-label={t.log} onClick={() => setPanel("log")}><span><Notebook size={22} weight="fill" />{t.log}</span></button>
      <button className="home-hotspot hotspot-achievements" aria-label={t.achievements} onClick={() => setPanel("achievements")}><span><Trophy size={22} weight="fill" />{t.achievements}</span></button>
      <span className="home-newspaper-callsign" aria-hidden="true">{save.callsign}</span>
      <span className="home-location-label"><Radio size={15} />{locationName(location, language)}</span>
      {panel === "warehouse" && <WarehouseModal language={language} save={save} onEquipItem={onEquipItem} onClose={() => setPanel(null)} />}
      {panel === "store" && <StoreModal language={language} save={save} onPurchase={onPurchase} onClose={() => setPanel(null)} />}
      {panel === "log" && <QsoLogModal language={language} save={save} onClose={() => setPanel(null)} />}
      {panel === "achievements" && <AchievementsModal language={language} save={save} onClose={() => setPanel(null)} />}
      {panel && !["warehouse", "store", "log", "achievements"].includes(panel) && <HomePlaceholder kind={panel} language={language} onClose={() => setPanel(null)} />}
    </main>
  );
}
