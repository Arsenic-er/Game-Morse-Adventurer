import { STORM_RELAY_PHASES } from "../game/stormRelayRun.js";

const en = {
  kicker: "THE UNFINISHED LOG · CHAPTER 12", title: "The Storm Relay",
  simulationWarning: "Fictional offline relay exercise. No real emergency traffic or live frequencies are used.",
  leave: "Leave", paused: "Relay clock paused while the page is inactive.", control: "Control", relay: "Relay station",
  timer: "Active time", packetsTitle: "Conflicting traffic", conflict: "Unverified", authoritative: "Authoritative revision",
  receive: "Receive queued traffic", promptCheckIn: "Check in to control", promptVerify: "Request the authoritative revision",
  promptRelay: "Relay the verified packet", keyAuto: "Z = dot · X = dash · F2 = send", keyManual: "Space = key · F2 = send",
  clear: "Clear", transmit: "Transmit", completed: "Revision two relayed", settle: "Save storm record",
  failed: "Relay attempt ended", retry: "Retry the same traffic", leaveConfirm: "This relay attempt is not saved. Leave it?",
  cancel: "Stay", confirmLeave: "Leave attempt", CHECK_IN: "Check in", RECEIVING: "Receiving", CONFLICT: "Conflict",
  VERIFY_SOURCE: "Verify source", RELAY: "Relay", COMPLETED: "Complete", FAILED: "Failed", ABANDONED: "Abandoned",
  SEMANTIC_UNSAFE: "The local safety check rejected this transmission.", CHECK_IN_FORMAT_INVALID: "Use the displayed check-in format.",
  MESSAGE_ID_MISMATCH: "The message number does not match.", VERIFICATION_FORMAT_INVALID: "Request revision verification exactly as shown.",
  SOURCE_NOT_VERIFIED: "Verify the authoritative revision before relaying.", RELAY_FORMAT_INVALID: "Relay every labelled field in order.",
  REVISION_MISMATCH: "The revision is obsolete.", GRID_MISMATCH: "The grid does not match revision two.",
  PEOPLE_MISMATCH: "The people count does not match revision two.", ITEM_MISMATCH: "The item does not match revision two.",
  QUANTITY_MISMATCH: "The quantity does not match revision two.", CHECK_MISMATCH: "The check value does not match.",
  REPEAT_FORMAT_INVALID: "Use AGN or QRS with message 214.", TIMED_OUT: "Twelve active minutes elapsed.",
  RELAY_ERROR_LIMIT: "Three incorrect relay attempts ended this run.",
};

export const STORM_RELAY_TEXT = Object.freeze({
  "zh-CN": Object.freeze({
    kicker: "未完成的日志 · 第12章", title: "风暴中继", simulationWarning: "虚构离线中继练习，不使用真实紧急通信或在线频率。", leave: "离开", paused: "页面未激活，中继计时已暂停。", control: "主控台", relay: "中继台", timer: "活动时间", packetsTitle: "冲突报文", conflict: "未核实", authoritative: "权威修订版", receive: "接收排队报文", promptCheckIn: "向主控台报到", promptVerify: "请求权威修订版", promptRelay: "中继已核实报文", keyAuto: "Z 点 · X 划 · F2 发送", keyManual: "空格键发报 · F2 发送", clear: "清空", transmit: "发射", completed: "修订版二已中继", settle: "保存风暴记录", failed: "中继尝试结束", retry: "重试相同报文", leaveConfirm: "本次中继尚未保存，确定离开？", cancel: "留下", confirmLeave: "离开尝试", CHECK_IN: "报到", RECEIVING: "接收", CONFLICT: "冲突", VERIFY_SOURCE: "核实来源", RELAY: "中继", COMPLETED: "完成", FAILED: "失败", ABANDONED: "放弃", SEMANTIC_UNSAFE: "本地安全检查拒绝了这次发射。", CHECK_IN_FORMAT_INVALID: "请使用显示的报到格式。", MESSAGE_ID_MISMATCH: "报文编号不匹配。", VERIFICATION_FORMAT_INVALID: "请按显示内容请求修订核实。", SOURCE_NOT_VERIFIED: "中继前必须核实权威修订版。", RELAY_FORMAT_INVALID: "请依次中继所有带标签字段。", REVISION_MISMATCH: "修订版已经过时。", GRID_MISMATCH: "网格与修订版二不符。", PEOPLE_MISMATCH: "人数与修订版二不符。", ITEM_MISMATCH: "物资与修订版二不符。", QUANTITY_MISMATCH: "数量与修订版二不符。", CHECK_MISMATCH: "校验值不匹配。", REPEAT_FORMAT_INVALID: "请对报文214使用AGN或QRS。", TIMED_OUT: "活动时间已满十二分钟。", RELAY_ERROR_LIMIT: "三次错误中继结束了本轮。",
  }),
  "zh-TW": Object.freeze({
    kicker: "未完成的日誌 · 第12章", title: "風暴中繼", simulationWarning: "虛構離線中繼練習，不使用真實緊急通訊或線上頻率。", leave: "離開", paused: "頁面未啟用，中繼計時已暫停。", control: "主控臺", relay: "中繼臺", timer: "活動時間", packetsTitle: "衝突報文", conflict: "未核實", authoritative: "權威修訂版", receive: "接收排隊報文", promptCheckIn: "向主控臺報到", promptVerify: "請求權威修訂版", promptRelay: "中繼已核實報文", keyAuto: "Z 點 · X 劃 · F2 傳送", keyManual: "空白鍵發報 · F2 傳送", clear: "清除", transmit: "發射", completed: "修訂版二已中繼", settle: "儲存風暴記錄", failed: "中繼嘗試結束", retry: "重試相同報文", leaveConfirm: "本次中繼尚未儲存，確定離開？", cancel: "留下", confirmLeave: "離開嘗試", CHECK_IN: "報到", RECEIVING: "接收", CONFLICT: "衝突", VERIFY_SOURCE: "核實來源", RELAY: "中繼", COMPLETED: "完成", FAILED: "失敗", ABANDONED: "放棄", SEMANTIC_UNSAFE: "本機安全檢查拒絕了這次發射。", CHECK_IN_FORMAT_INVALID: "請使用顯示的報到格式。", MESSAGE_ID_MISMATCH: "報文編號不符。", VERIFICATION_FORMAT_INVALID: "請依顯示內容請求修訂核實。", SOURCE_NOT_VERIFIED: "中繼前必須核實權威修訂版。", RELAY_FORMAT_INVALID: "請依序中繼所有標籤欄位。", REVISION_MISMATCH: "修訂版已過時。", GRID_MISMATCH: "網格與修訂版二不符。", PEOPLE_MISMATCH: "人數與修訂版二不符。", ITEM_MISMATCH: "物資與修訂版二不符。", QUANTITY_MISMATCH: "數量與修訂版二不符。", CHECK_MISMATCH: "校驗值不符。", REPEAT_FORMAT_INVALID: "請對報文214使用AGN或QRS。", TIMED_OUT: "活動時間已滿十二分鐘。", RELAY_ERROR_LIMIT: "三次錯誤中繼結束了本輪。",
  }),
  ja: Object.freeze({
    kicker: "未完成のログ · 第12章", title: "嵐のリレー", simulationWarning: "架空のオフライン中継訓練です。実在の緊急通信や周波数は使用しません。", leave: "退出", paused: "ページが非アクティブなため時計を停止しています。", control: "管制局", relay: "中継局", timer: "稼働時間", packetsTitle: "競合する電文", conflict: "未確認", authoritative: "正式な改訂", receive: "待機電文を受信", promptCheckIn: "管制局へチェックイン", promptVerify: "正式な改訂を照会", promptRelay: "確認済み電文を中継", keyAuto: "Z 点 · X 線 · F2 送信", keyManual: "Space 電鍵 · F2 送信", clear: "消去", transmit: "送信", completed: "改訂2を中継済み", settle: "嵐の記録を保存", failed: "中継試行終了", retry: "同じ電文で再試行", leaveConfirm: "中継は未保存です。退出しますか？", cancel: "残る", confirmLeave: "試行を退出", CHECK_IN: "チェックイン", RECEIVING: "受信", CONFLICT: "競合", VERIFY_SOURCE: "送信元確認", RELAY: "中継", COMPLETED: "完了", FAILED: "失敗", ABANDONED: "中止", SEMANTIC_UNSAFE: "ローカル安全確認が送信を拒否しました。", CHECK_IN_FORMAT_INVALID: "表示された形式でチェックインしてください。", MESSAGE_ID_MISMATCH: "電文番号が一致しません。", VERIFICATION_FORMAT_INVALID: "表示どおりに改訂確認を要求してください。", SOURCE_NOT_VERIFIED: "中継前に正式な改訂を確認してください。", RELAY_FORMAT_INVALID: "ラベル付き全項目を順番に中継してください。", REVISION_MISMATCH: "改訂が古いです。", GRID_MISMATCH: "グリッドが改訂2と一致しません。", PEOPLE_MISMATCH: "人数が改訂2と一致しません。", ITEM_MISMATCH: "物資が改訂2と一致しません。", QUANTITY_MISMATCH: "数量が改訂2と一致しません。", CHECK_MISMATCH: "チェック値が一致しません。", REPEAT_FORMAT_INVALID: "電文214にはAGNまたはQRSを使用してください。", TIMED_OUT: "稼働時間が12分に達しました。", RELAY_ERROR_LIMIT: "3回の誤中継で終了しました。",
  }),
  en: Object.freeze(en),
  es: Object.freeze({ ...en, kicker: "EL REGISTRO INACABADO · CAPÍTULO 12", title: "El relevo de la tormenta", simulationWarning: "Ejercicio ficticio sin conexión; no usa tráfico de emergencia ni frecuencias reales.", leave: "Salir", paused: "Reloj pausado mientras la página está inactiva.", control: "Control", relay: "Estación de relevo", timer: "Tiempo activo", packetsTitle: "Mensajes en conflicto", conflict: "Sin verificar", authoritative: "Revisión autorizada", receive: "Recibir tráfico en cola", promptCheckIn: "Registrarse con control", promptVerify: "Solicitar la revisión autorizada", promptRelay: "Retransmitir el mensaje verificado", clear: "Borrar", transmit: "Transmitir", completed: "Revisión dos retransmitida", settle: "Guardar registro", failed: "Intento terminado", retry: "Reintentar el mismo tráfico", leaveConfirm: "Este intento no está guardado. ¿Salir?", cancel: "Quedarse", confirmLeave: "Salir del intento" }),
  de: Object.freeze({ ...en, kicker: "DAS UNVOLLENDETE LOG · KAPITEL 12", title: "Das Sturmrelais", simulationWarning: "Fiktive Offline-Relaisübung ohne echten Notfunk oder Live-Frequenzen.", leave: "Verlassen", paused: "Relaisuhr pausiert bei inaktiver Seite.", control: "Leitstelle", relay: "Relaisstation", timer: "Aktive Zeit", packetsTitle: "Widersprüchliche Meldungen", conflict: "Ungeprüft", authoritative: "Verbindliche Revision", receive: "Wartende Meldungen empfangen", promptCheckIn: "Bei der Leitstelle einchecken", promptVerify: "Verbindliche Revision anfordern", promptRelay: "Geprüfte Meldung weitergeben", clear: "Löschen", transmit: "Senden", completed: "Revision zwei weitergegeben", settle: "Sturmprotokoll speichern", failed: "Relaisversuch beendet", retry: "Gleiche Meldung wiederholen", leaveConfirm: "Dieser Versuch ist nicht gespeichert. Verlassen?", cancel: "Bleiben", confirmLeave: "Versuch verlassen" }),
  ru: Object.freeze({ ...en, kicker: "НЕЗАКОНЧЕННЫЙ ЖУРНАЛ · ГЛАВА 12", title: "Штормовая ретрансляция", simulationWarning: "Вымышленное автономное упражнение без реального аварийного трафика и частот.", leave: "Выйти", paused: "Таймер остановлен, пока страница неактивна.", control: "Управление", relay: "Ретранслятор", timer: "Активное время", packetsTitle: "Противоречивые сообщения", conflict: "Не проверено", authoritative: "Официальная редакция", receive: "Принять очередь сообщений", promptCheckIn: "Зарегистрироваться у управления", promptVerify: "Запросить официальную редакцию", promptRelay: "Передать проверенное сообщение", clear: "Очистить", transmit: "Передать", completed: "Редакция два передана", settle: "Сохранить запись", failed: "Попытка завершена", retry: "Повторить те же сообщения", leaveConfirm: "Попытка не сохранена. Выйти?", cancel: "Остаться", confirmLeave: "Выйти из попытки" }),
});

export const STORM_RELAY_SETTLED_TEXT = Object.freeze({
  "zh-CN": "风暴记录与两条零收益事件联络已保存。", "zh-TW": "風暴記錄與兩條零收益事件聯絡已儲存。",
  ja: "嵐の記録と報酬なしの2件のイベントQSOを保存しました。", en: "Storm record and two zero-credit event QSOs saved.",
  es: "Registro y dos QSO de evento sin créditos guardados.", de: "Sturmprotokoll und zwei Event-QSOs ohne Gutschrift gespeichert.",
  ru: "Запись и два событийных QSO без награды сохранены.",
});

export function stormRelayLeaveRisk(run, settled = false) {
  if (settled || !run || [STORM_RELAY_PHASES.FAILED, STORM_RELAY_PHASES.ABANDONED].includes(run.phase)) return "none";
  return run.phase === STORM_RELAY_PHASES.COMPLETED ? "unsaved" : "active";
}
