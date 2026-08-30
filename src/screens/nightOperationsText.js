import { NIGHT_OPERATIONS_PHASES } from "../game/nightOperationsRun.js";

const en = {
  kicker: "THE UNFINISHED LOG · CHAPTER 13", title: "The Same Night",
  simulationWarning: "Fictional offline scheduling exercise. Band names are scenario labels, not live tuning advice.",
  leave: "Leave", paused: "Operations clock paused while this page is inactive.", board: "Station operations board",
  window: "Window", band: "Simulated band", propagation: "Propagation", opens: "Opens", closes: "Closes",
  available: "Available", closed: "Closed", complete: "Contact complete", select: "Select window",
  call: "Send directed call", exchange: "Send RST and band", keyAuto: "Z dit · X dah · F2 transmit",
  keyManual: "Space key · F2 transmit", clear: "Clear", transmit: "Transmit", contacts: "Contacts",
  missed: "Missed", completed: "Three people reached", settle: "Save night schedule", settled: "Schedule and three event QSOs saved.",
  failed: "Night attempt ended", retry: "Retry frozen schedule", leaveConfirm: "This night attempt is not saved. Leave?",
  cancel: "Stay", confirmLeave: "Leave attempt", BOARD: "Board", WINDOW_OPEN: "Window open", CALL: "Call",
  EXCHANGE: "Exchange", WINDOW_CLOSED: "Window closed", COMPLETED: "Completed", FAILED: "Failed", ABANDONED: "Abandoned",
  MISSED_TWO_CONTACTS: "Two available contacts were missed.", TIMED_OUT: "The simulated night schedule ended.",
};

export const NIGHT_OPERATIONS_TEXT = Object.freeze({
  "zh-CN": Object.freeze({
    kicker: "未完成的日志 · 第13章", title: "同一个夜晚", simulationWarning: "虚构离线排班练习；波段名只是情景标签，不是实时调谐建议。",
    leave: "离开", paused: "页面未启用，作业时钟已暂停。", board: "电台作业板", window: "窗口", band: "模拟波段", propagation: "传播",
    opens: "开启", closes: "关闭", available: "可联络", closed: "已关闭", complete: "联络完成", select: "选择窗口", call: "发送定向呼叫",
    exchange: "发送RST与波段", keyAuto: "Z 点 · X 划 · F2 发射", keyManual: "空格键发报 · F2 发射", clear: "清除", transmit: "发射",
    contacts: "已联络", missed: "错过", completed: "已联络三位不同的人", settle: "保存夜间排班", settled: "排班与三条事件QSO已保存。",
    failed: "本轮夜间作业结束", retry: "按原排班重试", leaveConfirm: "本轮夜间作业尚未保存，确定离开？", cancel: "留下", confirmLeave: "离开尝试",
    BOARD: "作业板", WINDOW_OPEN: "窗口开启", CALL: "呼叫", EXCHANGE: "交换", WINDOW_CLOSED: "窗口关闭", COMPLETED: "完成", FAILED: "失败", ABANDONED: "放弃",
    MISSED_TWO_CONTACTS: "错过了两个可用联系人。", TIMED_OUT: "模拟夜间排班已结束。",
  }),
  "zh-TW": Object.freeze({
    kicker: "未完成的日誌 · 第13章", title: "同一個夜晚", simulationWarning: "虛構離線排班練習；波段名稱只是情境標籤，不是即時調諧建議。",
    leave: "離開", paused: "頁面未啟用，作業時鐘已暫停。", board: "電臺作業板", window: "窗口", band: "模擬波段", propagation: "傳播",
    opens: "開啟", closes: "關閉", available: "可聯絡", closed: "已關閉", complete: "聯絡完成", select: "選擇窗口", call: "傳送定向呼叫",
    exchange: "傳送RST與波段", keyAuto: "Z 點 · X 劃 · F2 發射", keyManual: "空白鍵發報 · F2 發射", clear: "清除", transmit: "發射",
    contacts: "已聯絡", missed: "錯過", completed: "已聯絡三位不同的人", settle: "儲存夜間排班", settled: "排班與三條事件QSO已儲存。",
    failed: "本輪夜間作業結束", retry: "按原排班重試", leaveConfirm: "本輪夜間作業尚未儲存，確定離開？", cancel: "留下", confirmLeave: "離開嘗試",
    BOARD: "作業板", WINDOW_OPEN: "窗口開啟", CALL: "呼叫", EXCHANGE: "交換", WINDOW_CLOSED: "窗口關閉", COMPLETED: "完成", FAILED: "失敗", ABANDONED: "放棄",
    MISSED_TWO_CONTACTS: "錯過了兩個可用聯絡人。", TIMED_OUT: "模擬夜間排班已結束。",
  }),
  ja: Object.freeze({
    kicker: "未完成のログ · 第13章", title: "同じ夜", simulationWarning: "架空のオフライン日程訓練です。バンド名はシナリオ用で、実際の同調案内ではありません。",
    leave: "退出", paused: "ページが非アクティブなため運用時計を停止中です。", board: "局運用ボード", window: "窓", band: "模擬バンド", propagation: "伝搬",
    opens: "開始", closes: "終了", available: "連絡可能", closed: "終了", complete: "交信完了", select: "窓を選択", call: "指定呼出を送信",
    exchange: "RSTとバンドを送信", keyAuto: "Z 短点 · X 長点 · F2 送信", keyManual: "Space 電鍵 · F2 送信", clear: "消去", transmit: "送信",
    contacts: "交信", missed: "不在", completed: "異なる3人と交信済み", settle: "夜間日程を保存", settled: "日程と3件のイベントQSOを保存しました。",
    failed: "夜間運用終了", retry: "同じ日程で再試行", leaveConfirm: "この夜間運用は未保存です。退出しますか？", cancel: "残る", confirmLeave: "試行を退出",
    BOARD: "ボード", WINDOW_OPEN: "窓が開いています", CALL: "呼出", EXCHANGE: "交換", WINDOW_CLOSED: "窓が終了", COMPLETED: "完了", FAILED: "失敗", ABANDONED: "中止",
    MISSED_TWO_CONTACTS: "連絡可能な2人を逃しました。", TIMED_OUT: "模擬夜間日程が終了しました。",
  }),
  en: Object.freeze(en),
  es: Object.freeze({ ...en, kicker: "EL REGISTRO INACABADO · CAPÍTULO 13", title: "La misma noche", simulationWarning: "Ejercicio ficticio sin conexión; las bandas son etiquetas, no consejos de sintonía.", leave: "Salir", paused: "Reloj pausado mientras la página está inactiva.", board: "Panel de operaciones", select: "Elegir ventana", call: "Enviar llamada dirigida", exchange: "Enviar RST y banda", completed: "Tres personas contactadas", settle: "Guardar horario nocturno", settled: "Horario y tres QSO de evento guardados.", failed: "Intento nocturno terminado", retry: "Reintentar el horario", leaveConfirm: "El intento no está guardado. ¿Salir?", cancel: "Quedarse", confirmLeave: "Salir del intento" }),
  de: Object.freeze({ ...en, kicker: "DAS UNVOLLENDETE LOG · KAPITEL 13", title: "Dieselbe Nacht", simulationWarning: "Fiktive Offline-Planung; Bandnamen sind Szenariobezeichnungen, keine Abstimmhinweise.", leave: "Verlassen", paused: "Betriebsuhr bei inaktiver Seite pausiert.", board: "Stationsbetriebsplan", select: "Fenster wählen", call: "Gerichteten Ruf senden", exchange: "RST und Band senden", completed: "Drei Personen erreicht", settle: "Nachtplan speichern", settled: "Plan und drei Event-QSOs gespeichert.", failed: "Nachtversuch beendet", retry: "Gleichen Plan wiederholen", leaveConfirm: "Dieser Versuch ist nicht gespeichert. Verlassen?", cancel: "Bleiben", confirmLeave: "Versuch verlassen" }),
  ru: Object.freeze({ ...en, kicker: "НЕЗАКОНЧЕННЫЙ ЖУРНАЛ · ГЛАВА 13", title: "Та же ночь", simulationWarning: "Вымышленное автономное расписание; диапазоны — метки сценария, не советы по настройке.", leave: "Выйти", paused: "Таймер остановлен, пока страница неактивна.", board: "Панель работы станции", select: "Выбрать окно", call: "Передать направленный вызов", exchange: "Передать RST и диапазон", completed: "Связь с тремя людьми завершена", settle: "Сохранить расписание", settled: "Расписание и три событийных QSO сохранены.", failed: "Ночная попытка завершена", retry: "Повторить расписание", leaveConfirm: "Попытка не сохранена. Выйти?", cancel: "Остаться", confirmLeave: "Выйти из попытки" }),
});

export function nightOperationsLeaveRisk(run, settled = false) {
  if (settled || !run || [NIGHT_OPERATIONS_PHASES.FAILED, NIGHT_OPERATIONS_PHASES.ABANDONED].includes(run.phase)) return "none";
  return run.phase === NIGHT_OPERATIONS_PHASES.COMPLETED ? "unsaved" : "active";
}
