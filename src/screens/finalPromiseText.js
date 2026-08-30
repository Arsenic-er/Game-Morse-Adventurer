import { FINAL_PROMISE_PHASES } from "../game/finalPromiseRun.js";

const en = {
  kicker: "THE UNFINISHED LOG · CHAPTER 14", title: "The Unfinished Promise",
  simulationWarning: "Fictional offline story contact. No real person, frequency, or service is represented.",
  leave: "Leave", paused: "The promise clock is paused while this page is inactive.",
  review: "Review the old log", reviewAction: "Finish reviewing", recalledFacts: "Bounded recalled facts",
  recipient: "Final recipient", call: "Send the directed call", account: "Recipient account",
  receiveAccount: "Finish receiving account", chooseTone: "Choose a final tone",
  brief: "Brief", steady: "Steady", warm: "Warm", finalMessage: "Send the final message",
  keyAuto: "Z dit · X dah · F2 transmit", keyManual: "Space key · F2 transmit",
  clear: "Clear", transmit: "Transmit", completed: "The old log has a final page",
  settle: "Seal final page", settled: "Final page, linked QSO, and proof saved.",
  failed: "Promise attempt ended", retry: "Retry frozen account", leaveConfirm: "This final page is not saved. Leave?",
  cancel: "Stay", confirmLeave: "Leave attempt",
  REVIEW: "Review", CALL: "Call", ACCOUNT: "Account", FINAL_CHOICE: "Choice",
  FINAL_MESSAGE: "Final message", COMPLETED: "Completed", FAILED: "Failed", ABANDONED: "Abandoned",
  TIMED_OUT: "The fictional contact window ended.",
  "chapter14.recall.qsl.believe": "The QSL was accepted in good faith.",
  "chapter14.recall.qsl.request-review": "The QSL was kept with a request for review.",
  "chapter14.recall.qsl.defer": "The QSL decision was deliberately deferred.",
  "chapter14.recall.qsl.neutral": "The earlier QSL stance is unavailable in this migrated log.",
  "chapter14.recall.listening.patient-stop": "You listened, called once, and stopped patiently.",
  "chapter14.recall.listening.neutral": "The earlier listening record is unavailable.",
  "chapter14.recall.storm.corrected-packet": "You verified the corrected fictional storm packet before relaying it.",
  "chapter14.recall.storm.neutral": "The earlier relay packet is unavailable.",
  "chapter14.recall.schedule.known-people": "The night board scheduled people already known through the story.",
  "chapter14.recall.schedule.neutral": "The earlier station schedule is unavailable.",
  "chapter14.account.unfinished-log": "The recipient remembers a log left unfinished, not a role waiting to be imitated.",
  "chapter14.account.witnessed-work": "The recipient recognizes the work you completed in your own way.",
  "chapter14.account.forward-promise": "The recipient asks only that the next page be honestly yours.",
  "chapter14.message.brief": "Thanks and 73.", "chapter14.message.steady": "I will continue and 73.",
  "chapter14.message.warm": "Your log continues, with thanks and 73.",
};

function merged(overrides) { return Object.freeze({ ...en, ...overrides }); }

export const FINAL_PROMISE_TEXT = Object.freeze({
  "zh-CN": merged({
    kicker: "未完成的日志 · 第14章", title: "未完成的约定", simulationWarning: "虚构离线剧情联络，不代表任何真人、真实频率或真实业务。",
    leave: "离开", paused: "页面未启用，约定时钟已暂停。", review: "回看旧日志", reviewAction: "完成回看",
    recalledFacts: "有限的过往事实", recipient: "最后的收件人", call: "发送定向呼叫", account: "收件人的说明",
    receiveAccount: "完成接收", chooseTone: "选择最后的语气", brief: "简短", steady: "坚定", warm: "温暖",
    finalMessage: "发送最后报文", keyAuto: "Z 点 · X 划 · F2 发射", keyManual: "空格键发报 · F2 发射",
    clear: "清除", transmit: "发射", completed: "旧日志已有最后一页", settle: "封存最后一页", settled: "最后一页、关联QSO与证明已保存。",
    failed: "本轮约定结束", retry: "按原说明重试", leaveConfirm: "最后一页尚未保存，确定离开？", cancel: "留下", confirmLeave: "离开尝试",
  }),
  "zh-TW": merged({
    kicker: "未完成的日誌 · 第14章", title: "未完成的約定", simulationWarning: "虛構離線劇情聯絡，不代表任何真人、真實頻率或真實業務。",
    leave: "離開", paused: "頁面未啟用，約定時鐘已暫停。", review: "回看舊日誌", reviewAction: "完成回看",
    recalledFacts: "有限的過往事實", recipient: "最後的收件人", call: "傳送定向呼叫", account: "收件人的說明",
    receiveAccount: "完成接收", chooseTone: "選擇最後的語氣", brief: "簡短", steady: "堅定", warm: "溫暖",
    finalMessage: "傳送最後報文", keyAuto: "Z 點 · X 劃 · F2 發射", keyManual: "空白鍵發報 · F2 發射",
    clear: "清除", transmit: "發射", completed: "舊日誌已有最後一頁", settle: "封存最後一頁", settled: "最後一頁、關聯QSO與證明已儲存。",
    failed: "本輪約定結束", retry: "按原說明重試", leaveConfirm: "最後一頁尚未儲存，確定離開？", cancel: "留下", confirmLeave: "離開嘗試",
  }),
  ja: merged({
    kicker: "未完成のログ · 第14章", title: "未完の約束", simulationWarning: "架空のオフライン物語交信です。実在の人物・周波数・業務を表しません。",
    leave: "退出", paused: "ページが非アクティブなため約束の時計を停止中です。", review: "古いログを読む", reviewAction: "確認を終える",
    recalledFacts: "限定された過去の事実", recipient: "最後の受取人", call: "指定呼出を送信", account: "受取人の話",
    receiveAccount: "受信を終える", chooseTone: "最後の調子を選ぶ", brief: "簡潔", steady: "確か", warm: "温かい",
    finalMessage: "最後の電文を送る", keyAuto: "Z 短点 · X 長点 · F2 送信", keyManual: "Space 電鍵 · F2 送信",
    clear: "消去", transmit: "送信", completed: "古いログの最終ページが完成", settle: "最終ページを封印", settled: "最終ページ・QSO・証明を保存しました。",
    failed: "約束の試行終了", retry: "同じ話で再試行", leaveConfirm: "最終ページは未保存です。退出しますか？", cancel: "残る", confirmLeave: "試行を退出",
  }),
  en: Object.freeze(en),
  es: merged({ kicker: "EL REGISTRO INACABADO · CAPÍTULO 14", title: "La promesa inacabada", leave: "Salir", paused: "El reloj está pausado mientras la página está inactiva.", review: "Revisar el registro antiguo", reviewAction: "Terminar revisión", recalledFacts: "Hechos recordados y limitados", call: "Enviar llamada dirigida", account: "Relato del destinatario", chooseTone: "Elegir tono final", brief: "Breve", steady: "Sereno", warm: "Cálido", finalMessage: "Enviar mensaje final", completed: "El registro antiguo tiene página final", settle: "Sellar página final", failed: "Intento terminado", retry: "Reintentar relato" }),
  de: merged({ kicker: "DAS UNVOLLENDETE LOG · KAPITEL 14", title: "Das unerfüllte Versprechen", leave: "Verlassen", paused: "Die Uhr ist bei inaktiver Seite pausiert.", review: "Altes Log prüfen", reviewAction: "Prüfung beenden", recalledFacts: "Begrenzte erinnerte Fakten", call: "Gerichteten Ruf senden", account: "Bericht des Empfängers", chooseTone: "Letzten Ton wählen", brief: "Kurz", steady: "Beständig", warm: "Warm", finalMessage: "Letzte Nachricht senden", completed: "Das alte Log hat eine letzte Seite", settle: "Letzte Seite versiegeln", failed: "Versuch beendet", retry: "Bericht wiederholen" }),
  ru: merged({ kicker: "НЕЗАКОНЧЕННЫЙ ЖУРНАЛ · ГЛАВА 14", title: "Незавершённое обещание", leave: "Выйти", paused: "Таймер остановлен, пока страница неактивна.", review: "Просмотреть старый журнал", reviewAction: "Закончить просмотр", recalledFacts: "Ограниченные факты прошлого", call: "Передать направленный вызов", account: "Рассказ получателя", chooseTone: "Выбрать итоговый тон", brief: "Кратко", steady: "Твёрдо", warm: "Тепло", finalMessage: "Передать последнее сообщение", completed: "У старого журнала появилась последняя страница", settle: "Запечатать страницу", failed: "Попытка завершена", retry: "Повторить рассказ" }),
});

export function finalPromiseLeaveRisk(run, settled = false) {
  if (settled || !run || [FINAL_PROMISE_PHASES.FAILED, FINAL_PROMISE_PHASES.ABANDONED].includes(run.phase)) return "none";
  return run.phase === FINAL_PROMISE_PHASES.COMPLETED ? "unsaved" : "active";
}
