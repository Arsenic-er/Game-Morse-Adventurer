const TEXT = Object.freeze({
  "zh-CN": { title: "放弃当前通联？", active: "本次通联仍在进行。现在退出将丢弃当前电键输入和全部通联进度。", unsaved: "本次通联已完成但尚未保存。现在退出将丢弃通联日志和本次获得的全部信用点。", stay: "继续通联", leave: "仍要退出" },
  "zh-TW": { title: "放棄目前的通聯？", active: "本次通聯仍在進行。現在退出將捨棄目前的電鍵輸入與全部通聯進度。", unsaved: "本次通聯已完成但尚未儲存。現在退出將捨棄通聯日誌與本次獲得的全部信用點。", stay: "繼續通聯", leave: "仍要退出" },
  ja: { title: "現在の交信を中断しますか？", active: "交信はまだ進行中です。終了すると、入力中のCWと交信の進行状況はすべて破棄されます。", unsaved: "交信は完了していますが、まだ保存されていません。終了すると、交信ログと獲得したクレジットはすべて失われます。", stay: "交信を続ける", leave: "終了する" },
  en: { title: "Abandon the current QSO?", active: "This contact is still in progress. Quitting now will discard the current CW input and all QSO progress.", unsaved: "This QSO is complete but has not been saved. Quitting now will discard its log and all credits earned from it.", stay: "Continue QSO", leave: "Quit anyway" },
  es: { title: "¿Abandonar el QSO actual?", active: "Este contacto sigue en curso. Si sales ahora, se descartarán la entrada CW actual y todo el progreso del QSO.", unsaved: "Este QSO ha finalizado, pero aún no se ha guardado. Si sales ahora, se perderán el registro y todos los créditos obtenidos.", stay: "Continuar el QSO", leave: "Salir de todos modos" },
  de: { title: "Aktuelles QSO abbrechen?", active: "Dieser Funkkontakt läuft noch. Beim Beenden werden die aktuelle CW-Eingabe und der gesamte QSO-Fortschritt verworfen.", unsaved: "Dieses QSO ist abgeschlossen, aber noch nicht gespeichert. Beim Beenden gehen der Logeintrag und alle verdienten Kredite verloren.", stay: "QSO fortsetzen", leave: "Trotzdem beenden" },
  ru: { title: "Прервать текущее QSO?", active: "Связь ещё не завершена. Если выйти сейчас, текущий ввод CW и весь прогресс QSO будут потеряны.", unsaved: "QSO завершено, но ещё не сохранено. Если выйти сейчас, запись в журнале и все заработанные кредиты будут потеряны.", stay: "Продолжить QSO", leave: "Всё равно выйти" },
});

function qsoExitDialogOptions({ risk, language } = {}) {
  const text = TEXT[language] ?? TEXT.en;
  return {
    type: "warning",
    buttons: [text.stay, text.leave],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: text.title,
    message: text.title,
    detail: risk === "unsaved" ? text.unsaved : text.active,
  };
}

module.exports = { QSO_EXIT_DIALOG_TEXT: TEXT, qsoExitDialogOptions };
