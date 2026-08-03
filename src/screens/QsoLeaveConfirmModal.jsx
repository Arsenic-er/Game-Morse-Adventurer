import { useEffect, useRef } from "react";
import { ArrowLeft, Radio, WarningOctagon } from "@phosphor-icons/react";

const QSO_LEAVE_TEXT = {
  "zh-CN": {
    activeKicker: "QSO // 进行中", unsavedKicker: "QSO // 未保存", title: "放弃当前通联？",
    activeBody: "本次通联仍在进行。现在离开将丢弃当前电键输入和全部通联进度。",
    unsavedBody: "本次通联已经完成但尚未保存。现在离开将丢弃通联日志和本次获得的全部信用点。",
    irreversible: "此操作无法撤销。", stay: "继续通联", leaveHome: "放弃并返回管理中心", startNew: "放弃并开始新通联",
  },
  "zh-TW": {
    activeKicker: "QSO // 進行中", unsavedKicker: "QSO // 未儲存", title: "放棄目前的通聯？",
    activeBody: "本次通聯仍在進行。現在離開將捨棄目前的電鍵輸入與全部通聯進度。",
    unsavedBody: "本次通聯已完成但尚未儲存。現在離開將捨棄通聯日誌與本次獲得的全部信用點。",
    irreversible: "此操作無法復原。", stay: "繼續通聯", leaveHome: "放棄並返回管理中心", startNew: "放棄並開始新通聯",
  },
  ja: {
    activeKicker: "QSO // 交信中", unsavedKicker: "QSO // 未保存", title: "現在の交信を中断しますか？",
    activeBody: "交信はまだ進行中です。いま退出すると、入力中のCWと交信の進行状況はすべて破棄されます。",
    unsavedBody: "交信は完了していますが、まだ保存されていません。いま退出すると、交信ログと獲得したクレジットはすべて失われます。",
    irreversible: "この操作は元に戻せません。", stay: "交信を続ける", leaveHome: "中断して管理センターへ戻る", startNew: "中断して次の交信を始める",
  },
  en: {
    activeKicker: "QSO // ON AIR", unsavedKicker: "QSO // UNSAVED", title: "Abandon the current QSO?",
    activeBody: "This contact is still in progress. Leaving now will discard the current CW input and all QSO progress.",
    unsavedBody: "This QSO is complete but has not been saved. Leaving now will discard its log and all credits earned from it.",
    irreversible: "This action cannot be undone.", stay: "Continue QSO", leaveHome: "Abandon and return home", startNew: "Abandon and start a new QSO",
  },
  es: {
    activeKicker: "QSO // EN CURSO", unsavedKicker: "QSO // SIN GUARDAR", title: "¿Abandonar el QSO actual?",
    activeBody: "Este contacto sigue en curso. Si sales ahora, se descartarán la entrada CW actual y todo el progreso del QSO.",
    unsavedBody: "Este QSO ha finalizado, pero aún no se ha guardado. Si sales ahora, se perderán el registro y todos los créditos obtenidos.",
    irreversible: "Esta acción no se puede deshacer.", stay: "Continuar el QSO", leaveHome: "Abandonar y volver al centro", startNew: "Abandonar e iniciar otro QSO",
  },
  de: {
    activeKicker: "QSO // IN BETRIEB", unsavedKicker: "QSO // NICHT GESPEICHERT", title: "Aktuelles QSO abbrechen?",
    activeBody: "Dieser Funkkontakt läuft noch. Beim Verlassen werden die aktuelle CW-Eingabe und der gesamte QSO-Fortschritt verworfen.",
    unsavedBody: "Dieses QSO ist abgeschlossen, aber noch nicht gespeichert. Beim Verlassen gehen der Logeintrag und alle verdienten Kredite verloren.",
    irreversible: "Diese Aktion kann nicht rückgängig gemacht werden.", stay: "QSO fortsetzen", leaveHome: "Abbrechen und zur Zentrale", startNew: "Abbrechen und neues QSO starten",
  },
  ru: {
    activeKicker: "QSO // В ЭФИРЕ", unsavedKicker: "QSO // НЕ СОХРАНЕНО", title: "Прервать текущее QSO?",
    activeBody: "Связь ещё не завершена. Если выйти сейчас, текущий ввод CW и весь прогресс QSO будут потеряны.",
    unsavedBody: "QSO завершено, но ещё не сохранено. Если выйти сейчас, запись в журнале и все заработанные кредиты будут потеряны.",
    irreversible: "Это действие нельзя отменить.", stay: "Продолжить QSO", leaveHome: "Прервать и вернуться в центр", startNew: "Прервать и начать новое QSO",
  },
};

export function QsoLeaveConfirmModal({ language, reason, destination, onCancel, onConfirm, returnFocusTo }) {
  const t = QSO_LEAVE_TEXT[language] ?? QSO_LEAVE_TEXT.en;
  const stayRef = useRef(null);
  const leaveRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    stayRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const first = leaveRef.current;
      const last = stayRef.current;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => returnFocusTo?.focus?.());
    };
  }, [returnFocusTo]);

  const unsaved = reason === "unsaved";
  return (
    <div className="qso-leave-backdrop" data-testid="qso-leave-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section
        className="qso-leave-dialog"
        data-testid="qso-leave-dialog"
        data-leave-reason={reason}
        data-leave-destination={destination}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="qso-leave-title"
        aria-describedby="qso-leave-description"
      >
        <header><WarningOctagon size={37} weight="fill" /><div><small>{unsaved ? t.unsavedKicker : t.activeKicker}</small><h2 id="qso-leave-title">{t.title}</h2></div></header>
        <div className="qso-leave-body" id="qso-leave-description"><p>{unsaved ? t.unsavedBody : t.activeBody}</p><strong>{t.irreversible}</strong></div>
        <footer>
          <button ref={leaveRef} className="qso-leave-danger" data-action="confirm-qso-leave" onClick={onConfirm}><ArrowLeft size={20} weight="bold" />{destination === "new-qso" ? t.startNew : t.leaveHome}</button>
          <button ref={stayRef} className="qso-leave-stay" data-action="cancel-qso-leave" onClick={onCancel}><Radio size={20} weight="fill" />{t.stay}</button>
        </footer>
      </section>
    </div>
  );
}
