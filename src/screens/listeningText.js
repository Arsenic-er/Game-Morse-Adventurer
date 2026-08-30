import { LISTENING_PHASES } from "../game/listeningRun.js";

const en = {
  kicker: "THE UNFINISHED LOG · CHAPTER 11", title: "The One Who Cannot Hear",
  simulationWarning: "Fictional offline listening exercise. Silence is an observation, not an emergency claim.",
  leave: "Leave", paused: "Listening paused while the page is inactive.", target: "Listening target",
  observeTitle: "Three listening windows", observe: "Observe next window", observed: "Observed",
  propagation: "Propagation", noise: "Noise", high: "High", medium: "Medium", low: "Low",
  callPrompt: "Key one directed call", keyAuto: "Z = dot · X = dash · F2 = send", keyManual: "Space = key · F2 = send",
  clear: "Clear", transmit: "Send call", waiting: "Keep listening. No reply is being generated.",
  decision: "The window is complete. Record the silence, or make one final call.",
  callAgain: "Call once more", recordSilence: "Record silence", completed: "Listening record complete",
  settle: "Save monitoring record", failed: "Attempt ended", retry: "Retry with the same windows",
  leaveConfirm: "This listening attempt is not saved. Leave it?", cancel: "Stay", confirmLeave: "Leave attempt",
  SEMANTIC_UNSAFE: "The call was blocked by the local safety check.", CALL_FORMAT_INVALID: "Use the directed-call format shown above.",
  TARGET_CALLSIGN_MISMATCH: "The target callsign does not match this listening contract.",
  PLAYER_CALLSIGN_MISMATCH: "Your callsign does not match the active save.",
  TIMED_OUT: "Ten active minutes elapsed.", CALL_LIMIT_EXCEEDED: "A third call is not permitted. Stop and listen.",
};

export const LISTENING_TEXT = Object.freeze({
  "zh-CN": Object.freeze({
    kicker: "未完成的日志 · 第11章", title: "听不见的人", simulationWarning: "虚构离线监听练习。静默是一项观察，不代表真实紧急情况。", leave: "离开", paused: "页面未激活，监听已暂停。", target: "监听目标", observeTitle: "三个监听窗口", observe: "观察下一个窗口", observed: "已观察", propagation: "传播", noise: "噪声", high: "高", medium: "中", low: "低", callPrompt: "键入一次定向呼叫", keyAuto: "Z 点 · X 划 · F2 发送", keyManual: "空格键发报 · F2 发送", clear: "清空", transmit: "发送呼叫", waiting: "继续监听。系统不会生成回复。", decision: "监听窗口已结束。记录静默，或进行最后一次呼叫。", callAgain: "再呼叫一次", recordSilence: "记录静默", completed: "监听记录已完成", settle: "保存监听记录", failed: "本次尝试结束", retry: "用相同窗口重试", leaveConfirm: "本次监听尚未保存，确定离开？", cancel: "留下", confirmLeave: "离开尝试", SEMANTIC_UNSAFE: "本地安全检查阻止了这次呼叫。", CALL_FORMAT_INVALID: "请使用上方显示的定向呼叫格式。", TARGET_CALLSIGN_MISMATCH: "目标呼号与监听合同不符。", PLAYER_CALLSIGN_MISMATCH: "你的呼号与当前存档不符。", TIMED_OUT: "活动时间已满十分钟。", CALL_LIMIT_EXCEEDED: "不允许第三次呼叫。请停下来监听。",
  }),
  "zh-TW": Object.freeze({
    kicker: "未完成的日誌 · 第11章", title: "聽不見的人", simulationWarning: "虛構離線監聽練習。靜默是一項觀察，不代表真實緊急情況。", leave: "離開", paused: "頁面未啟用，監聽已暫停。", target: "監聽目標", observeTitle: "三個監聽視窗", observe: "觀察下一個視窗", observed: "已觀察", propagation: "傳播", noise: "雜訊", high: "高", medium: "中", low: "低", callPrompt: "鍵入一次定向呼叫", keyAuto: "Z 點 · X 劃 · F2 傳送", keyManual: "空白鍵發報 · F2 傳送", clear: "清除", transmit: "傳送呼叫", waiting: "繼續監聽。系統不會生成回覆。", decision: "監聽視窗已結束。記錄靜默，或進行最後一次呼叫。", callAgain: "再呼叫一次", recordSilence: "記錄靜默", completed: "監聽記錄已完成", settle: "儲存監聽記錄", failed: "本次嘗試結束", retry: "用相同視窗重試", leaveConfirm: "本次監聽尚未儲存，確定離開？", cancel: "留下", confirmLeave: "離開嘗試", SEMANTIC_UNSAFE: "本機安全檢查阻止了這次呼叫。", CALL_FORMAT_INVALID: "請使用上方顯示的定向呼叫格式。", TARGET_CALLSIGN_MISMATCH: "目標呼號與監聽合同不符。", PLAYER_CALLSIGN_MISMATCH: "你的呼號與目前存檔不符。", TIMED_OUT: "活動時間已滿十分鐘。", CALL_LIMIT_EXCEEDED: "不允許第三次呼叫。請停下來監聽。",
  }),
  ja: Object.freeze({
    kicker: "未完成のログ · 第11章", title: "聞こえない人", simulationWarning: "架空のオフライン受信練習です。沈黙は観測であり、現実の緊急事態を意味しません。", leave: "退出", paused: "ページが非アクティブなため受信を一時停止しています。", target: "受信対象", observeTitle: "3つの受信窓", observe: "次の窓を観測", observed: "観測済み", propagation: "伝搬", noise: "雑音", high: "高", medium: "中", low: "低", callPrompt: "指向呼出を1回送信", keyAuto: "Z 短点 · X 長点 · F2 送信", keyManual: "Space 電鍵 · F2 送信", clear: "消去", transmit: "呼出送信", waiting: "受信を続けます。応答は生成されません。", decision: "受信窓が終了しました。沈黙を記録するか、最後にもう一度呼びます。", callAgain: "もう一度呼ぶ", recordSilence: "沈黙を記録", completed: "受信記録完了", settle: "監視記録を保存", failed: "試行終了", retry: "同じ窓で再試行", leaveConfirm: "この受信試行は未保存です。退出しますか？", cancel: "戻る", confirmLeave: "試行を退出", SEMANTIC_UNSAFE: "ローカル安全確認がこの呼出を止めました。", CALL_FORMAT_INVALID: "表示された指向呼出形式を使ってください。", TARGET_CALLSIGN_MISMATCH: "対象呼号が受信契約と一致しません。", PLAYER_CALLSIGN_MISMATCH: "自局呼号が現在のセーブと一致しません。", TIMED_OUT: "稼働時間が10分に達しました。", CALL_LIMIT_EXCEEDED: "3回目の呼出はできません。止まって聞いてください。",
  }),
  en: Object.freeze(en),
  es: Object.freeze({
    kicker: "EL REGISTRO INACABADO · CAPÍTULO 11", title: "Quien no puede oír", simulationWarning: "Ejercicio ficticio de escucha sin conexión. El silencio es una observación, no una emergencia real.", leave: "Salir", paused: "La escucha está en pausa mientras la página está inactiva.", target: "Objetivo de escucha", observeTitle: "Tres ventanas de escucha", observe: "Observar la siguiente ventana", observed: "Observada", propagation: "Propagación", noise: "Ruido", high: "Alto", medium: "Medio", low: "Bajo", callPrompt: "Teclea una llamada dirigida", keyAuto: "Z punto · X raya · F2 enviar", keyManual: "Espacio manipular · F2 enviar", clear: "Borrar", transmit: "Enviar llamada", waiting: "Sigue escuchando. No se generará respuesta.", decision: "La ventana terminó. Registra el silencio o llama una última vez.", callAgain: "Llamar una vez más", recordSilence: "Registrar silencio", completed: "Registro de escucha completo", settle: "Guardar registro", failed: "Intento terminado", retry: "Reintentar con las mismas ventanas", leaveConfirm: "Este intento no está guardado. ¿Salir?", cancel: "Quedarse", confirmLeave: "Salir del intento", SEMANTIC_UNSAFE: "La comprobación local de seguridad bloqueó la llamada.", CALL_FORMAT_INVALID: "Usa el formato de llamada dirigida mostrado.", TARGET_CALLSIGN_MISMATCH: "El indicativo objetivo no coincide con el contrato.", PLAYER_CALLSIGN_MISMATCH: "Tu indicativo no coincide con la partida activa.", TIMED_OUT: "Transcurrieron diez minutos activos.", CALL_LIMIT_EXCEEDED: "No se permite una tercera llamada. Detente y escucha.",
  }),
  de: Object.freeze({
    kicker: "DAS UNVOLLENDETE LOG · KAPITEL 11", title: "Der Mensch, der nicht hören kann", simulationWarning: "Fiktive Offline-Hörübung. Stille ist eine Beobachtung, kein realer Notfall.", leave: "Verlassen", paused: "Das Hören ist pausiert, solange die Seite inaktiv ist.", target: "Hörziel", observeTitle: "Drei Hörfenster", observe: "Nächstes Fenster beobachten", observed: "Beobachtet", propagation: "Ausbreitung", noise: "Rauschen", high: "Hoch", medium: "Mittel", low: "Niedrig", callPrompt: "Einen gerichteten Anruf geben", keyAuto: "Z Punkt · X Strich · F2 senden", keyManual: "Leertaste tasten · F2 senden", clear: "Löschen", transmit: "Anruf senden", waiting: "Weiter hören. Es wird keine Antwort erzeugt.", decision: "Das Fenster ist beendet. Stille erfassen oder ein letztes Mal rufen.", callAgain: "Noch einmal rufen", recordSilence: "Stille erfassen", completed: "Hörprotokoll vollständig", settle: "Beobachtung speichern", failed: "Versuch beendet", retry: "Mit denselben Fenstern wiederholen", leaveConfirm: "Dieser Hörversuch ist nicht gespeichert. Verlassen?", cancel: "Bleiben", confirmLeave: "Versuch verlassen", SEMANTIC_UNSAFE: "Die lokale Sicherheitsprüfung hat den Anruf blockiert.", CALL_FORMAT_INVALID: "Verwende das angezeigte Format für den gerichteten Anruf.", TARGET_CALLSIGN_MISMATCH: "Das Zielrufzeichen passt nicht zum Vertrag.", PLAYER_CALLSIGN_MISMATCH: "Dein Rufzeichen passt nicht zum aktiven Spielstand.", TIMED_OUT: "Zehn aktive Minuten sind vergangen.", CALL_LIMIT_EXCEEDED: "Ein dritter Anruf ist nicht erlaubt. Anhalten und hören.",
  }),
  ru: Object.freeze({
    kicker: "НЕЗАКОНЧЕННЫЙ ЖУРНАЛ · ГЛАВА 11", title: "Тот, кто не слышит", simulationWarning: "Вымышленное автономное упражнение. Тишина — наблюдение, а не реальная чрезвычайная ситуация.", leave: "Выйти", paused: "Прослушивание приостановлено, пока страница неактивна.", target: "Цель прослушивания", observeTitle: "Три окна прослушивания", observe: "Наблюдать следующее окно", observed: "Наблюдалось", propagation: "Прохождение", noise: "Шум", high: "Высокий", medium: "Средний", low: "Низкий", callPrompt: "Передайте один направленный вызов", keyAuto: "Z точка · X тире · F2 отправить", keyManual: "Пробел ключ · F2 отправить", clear: "Очистить", transmit: "Передать вызов", waiting: "Продолжайте слушать. Ответ не создаётся.", decision: "Окно завершено. Запишите тишину или вызовите ещё один раз.", callAgain: "Вызвать ещё раз", recordSilence: "Записать тишину", completed: "Запись прослушивания готова", settle: "Сохранить запись", failed: "Попытка завершена", retry: "Повторить с теми же окнами", leaveConfirm: "Эта попытка не сохранена. Выйти?", cancel: "Остаться", confirmLeave: "Выйти из попытки", SEMANTIC_UNSAFE: "Локальная проверка безопасности заблокировала вызов.", CALL_FORMAT_INVALID: "Используйте показанный формат направленного вызова.", TARGET_CALLSIGN_MISMATCH: "Целевой позывной не соответствует контракту.", PLAYER_CALLSIGN_MISMATCH: "Ваш позывной не соответствует активному сохранению.", TIMED_OUT: "Прошло десять активных минут.", CALL_LIMIT_EXCEEDED: "Третий вызов запрещён. Остановитесь и слушайте.",
  }),
});

export const LISTENING_SETTLED_TEXT = Object.freeze({
  "zh-CN": "监听记录已保存；没有创建QSO。", "zh-TW": "監聽記錄已儲存；沒有建立QSO。",
  ja: "受信記録を保存しました。QSOは作成されません。", en: "Monitoring record saved; no QSO was created.",
  es: "Registro guardado; no se creó ningún QSO.", de: "Beobachtung gespeichert; es wurde kein QSO erstellt.",
  ru: "Запись сохранена; QSO не создано.",
});

export function listeningLeaveRisk(run, settled = false) {
  if (settled || !run || [LISTENING_PHASES.FAILED, LISTENING_PHASES.ABANDONED].includes(run.phase)) return "none";
  return run.phase === LISTENING_PHASES.COMPLETED ? "unsaved" : "active";
}
