import {
  ArrowClockwise, Broadcast, CheckCircle, FloppyDisk, Gauge, MapPin, Radio,
  Ruler, ShieldCheck, WarningCircle, X,
} from "@phosphor-icons/react";
import { QsoRewardBreakdown } from "../components/QsoRewardBreakdown.jsx";

const TEXT = {
  "zh-CN": {
    success: "通联完成", failed: "通联未完成", saved: "已写入永久日志", unsaved: "等待写入日志",
    callsign: "对方呼号", region: "地区", distance: "距离", rst: "双方 RST", propagation: "传播等级",
    equipment: "设备快照", speed: "检测速度", accuracy: "发报准确率", rhythm: "发报节奏", repeats: "请求重发",
    credits: "本次信用点", sim: "虚构台站", newRegion: "首次通联地区", newDistance: "最远距离纪录",
    save: "写入日志并结算", next: "开始下一次通联", restart: "重新开始本次通联", continue: "返回发射台",
    failedHint: "本次回应未通过最小 QSO 流程判定，不会扣除信用点，也不会写入日志。",
  },
  "zh-TW": {
    success: "通聯完成", failed: "通聯未完成", saved: "已寫入永久日誌", unsaved: "等待寫入日誌",
    callsign: "對方呼號", region: "地區", distance: "距離", rst: "雙方 RST", propagation: "傳播等級",
    equipment: "設備快照", speed: "偵測速度", accuracy: "發報準確率", rhythm: "發報節奏", repeats: "請求重發",
    credits: "本次信用點", sim: "虛構臺站", newRegion: "首次通聯地區", newDistance: "最遠距離紀錄",
    save: "寫入日誌並結算", next: "開始下一次通聯", restart: "重新開始本次通聯", continue: "返回發射臺",
    failedHint: "本次回應未通過最小 QSO 流程判定，不會扣除信用點，也不會寫入日誌。",
  },
  ja: {
    success: "交信完了", failed: "交信未完了", saved: "永久ログに保存済み", unsaved: "ログ保存待ち",
    callsign: "相手局", region: "地域", distance: "距離", rst: "双方の RST", propagation: "伝搬レベル",
    equipment: "装備スナップショット", speed: "検出速度", accuracy: "送信正確度", rhythm: "送信リズム", repeats: "再送要求",
    credits: "今回のクレジット", sim: "架空局", newRegion: "初交信地域", newDistance: "最長距離記録",
    save: "ログ保存と精算", next: "次の交信を開始", restart: "この交信をやり直す", continue: "運用卓へ戻る",
    failedHint: "最小 QSO 手順を完了できませんでした。クレジット消費やログ記録はありません。",
  },
  en: {
    success: "QSO Complete", failed: "QSO Incomplete", saved: "Saved to permanent log", unsaved: "Waiting to be logged",
    callsign: "Remote callsign", region: "Region", distance: "Distance", rst: "RST exchanged", propagation: "Propagation level",
    equipment: "Equipment snapshot", speed: "Detected speed", accuracy: "Transmit accuracy", rhythm: "Keying rhythm", repeats: "Repeat requests",
    credits: "Credits earned", sim: "Fictional station", newRegion: "First contact in region", newDistance: "New distance record",
    save: "Save log and settle", next: "Start next QSO", restart: "Restart this QSO", continue: "Return to station",
    failedHint: "The reply did not complete the minimum QSO flow. No credits are deducted and no log entry is written.",
  },
  es: {
    success: "QSO completado", failed: "QSO incompleto", saved: "Guardado en el registro permanente", unsaved: "Pendiente de registro",
    callsign: "Indicativo remoto", region: "Región", distance: "Distancia", rst: "RST intercambiado", propagation: "Nivel de propagación",
    equipment: "Resumen de equipo", speed: "Velocidad detectada", accuracy: "Precisión de transmisión", rhythm: "Ritmo de manipulación", repeats: "Peticiones de repetición",
    credits: "Créditos obtenidos", sim: "Estación ficticia", newRegion: "Primer contacto en la región", newDistance: "Nuevo récord de distancia",
    save: "Guardar registro y liquidar", next: "Iniciar siguiente QSO", restart: "Reiniciar este QSO", continue: "Volver a la estación",
    failedHint: "La respuesta no completó el flujo QSO mínimo. No se descuentan créditos ni se escribe ninguna entrada.",
  },
  de: {
    success: "QSO abgeschlossen", failed: "QSO unvollständig", saved: "Im dauerhaften Log gespeichert", unsaved: "Wartet auf Protokollierung",
    callsign: "Gegenstationsrufzeichen", region: "Region", distance: "Entfernung", rst: "Ausgetauschter RST", propagation: "Ausbreitungsstufe",
    equipment: "Ausrüstungsübersicht", speed: "Erkannte Geschwindigkeit", accuracy: "Sendegenauigkeit", rhythm: "Tastrhythmus", repeats: "Wiederholungsanfragen",
    credits: "Verdiente Kredite", sim: "Fiktive Station", newRegion: "Erster Kontakt in der Region", newDistance: "Neuer Entfernungsrekord",
    save: "Log speichern und abrechnen", next: "Nächstes QSO starten", restart: "Dieses QSO neu starten", continue: "Zurück zur Station",
    failedHint: "Die Antwort hat den minimalen QSO-Ablauf nicht abgeschlossen. Es werden keine Kredite abgezogen und kein Logeintrag geschrieben.",
  },
  ru: {
    success: "QSO завершено", failed: "QSO не завершено", saved: "Сохранено в постоянном журнале", unsaved: "Ожидает записи в журнал",
    callsign: "Позывной корреспондента", region: "Регион", distance: "Расстояние", rst: "Обмен RST", propagation: "Уровень прохождения",
    equipment: "Снимок оборудования", speed: "Определённая скорость", accuracy: "Точность передачи", rhythm: "Ритм ключа", repeats: "Запросы повтора",
    credits: "Получено кредитов", sim: "Вымышленная станция", newRegion: "Первая связь в регионе", newDistance: "Новый рекорд расстояния",
    save: "Сохранить журнал и рассчитать", next: "Начать следующее QSO", restart: "Начать это QSO заново", continue: "Вернуться на станцию",
    failedHint: "Ответ не завершил минимальный порядок QSO. Кредиты не списываются, запись в журнал не создаётся.",
  },
};

function value(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "---" : `${value}${suffix}`;
}

const REVIEW_TEXT = {
  "zh-CN": {
    title: "操作复盘", empty: "旧版日志没有逐次操作记录", stage: "阶段", message: "电文", reason: "原因",
    accepted: "接受", error: "错误", repeat: "重发", unknown: "未记录", wpm: "WPM", accuracy: "准确率", rhythm: "节奏",
    guidance: "引导级别", full: "完整引导", hints: "仅提示", off: "关闭", visualAssist: "视觉辅助", used: "已使用", unused: "未使用",
    independent: "独立值守", qualified: "达成", notQualified: "未达成", unavailable: "旧日志未记录", rewardBreakdown: "奖励拆分",
    baseReward: "基础奖励", independentBonus: "独立值守奖励", totalReward: "合计",
    PLAYER_CQ: "呼叫 CQ", PLAYER_RST_AND_73: "交换 RST / 73", missingCq: "缺少 CQ", missingDe: "缺少 DE", missingPlayerCallsign: "缺少自己的呼号", wrongCqOrder: "CQ 电文顺序错误", missingK: "结尾缺少 K", invalidAgn: "重发请求必须为 AGN K", missingCallsign: "缺少双方呼号", invalidRst: "RST 格式无效", missing73: "缺少 73", wrongReplyOrder: "回复电文顺序错误", notWaitingForPlayer: "当前阶段不接受发报",
  },
  "zh-TW": {
    title: "操作複盤", empty: "舊版日誌沒有逐次操作記錄", stage: "階段", message: "電文", reason: "原因",
    accepted: "接受", error: "錯誤", repeat: "重發", unknown: "未記錄", wpm: "WPM", accuracy: "準確率", rhythm: "節奏",
    guidance: "引導級別", full: "完整引導", hints: "僅提示", off: "關閉", visualAssist: "視覺輔助", used: "已使用", unused: "未使用",
    independent: "獨立值守", qualified: "達成", notQualified: "未達成", unavailable: "舊日誌未記錄", rewardBreakdown: "獎勵拆分",
    baseReward: "基礎獎勵", independentBonus: "獨立值守獎勵", totalReward: "合計",
    PLAYER_CQ: "呼叫 CQ", PLAYER_RST_AND_73: "交換 RST / 73", missingCq: "缺少 CQ", missingDe: "缺少 DE", missingPlayerCallsign: "缺少自己的呼號", wrongCqOrder: "CQ 電文順序錯誤", missingK: "結尾缺少 K", invalidAgn: "重發請求必須為 AGN K", missingCallsign: "缺少雙方呼號", invalidRst: "RST 格式無效", missing73: "缺少 73", wrongReplyOrder: "回覆電文順序錯誤", notWaitingForPlayer: "目前階段不接受發報",
  },
  ja: {
    title: "運用レビュー", empty: "旧形式のログには操作履歴がありません", stage: "段階", message: "電文", reason: "理由",
    accepted: "受付", error: "エラー", repeat: "再送", unknown: "記録なし", wpm: "WPM", accuracy: "正確度", rhythm: "リズム",
    guidance: "ガイド", full: "フルガイド", hints: "ヒントのみ", off: "オフ", visualAssist: "視覚補助", used: "使用", unused: "未使用",
    independent: "単独運用", qualified: "達成", notQualified: "未達成", unavailable: "旧ログは未記録", rewardBreakdown: "報酬内訳",
    baseReward: "基本報酬", independentBonus: "単独運用ボーナス", totalReward: "合計",
    PLAYER_CQ: "CQ 呼出", PLAYER_RST_AND_73: "RST / 73 交換", missingCq: "CQ がありません", missingDe: "DE がありません", missingPlayerCallsign: "自局コールサインがありません", wrongCqOrder: "CQ 電文の順序が違います", missingK: "末尾の K がありません", invalidAgn: "再送要求は AGN K にしてください", missingCallsign: "両局のコールサインが必要です", invalidRst: "RST 形式が無効です", missing73: "73 がありません", wrongReplyOrder: "応答電文の順序が違います", notWaitingForPlayer: "現在は送信を受け付けていません",
  },
  en: {
    title: "Operating Review", empty: "No attempt history is available in this legacy log", stage: "Stage", message: "Message", reason: "Reason",
    accepted: "Accepted", error: "Error", repeat: "Repeat", unknown: "Not recorded", wpm: "WPM", accuracy: "Accuracy", rhythm: "Rhythm",
    guidance: "Guidance", full: "Full", hints: "Hints only", off: "Off", visualAssist: "Visual assist", used: "Used", unused: "Not used",
    independent: "Independent watch", qualified: "Qualified", notQualified: "Not qualified", unavailable: "Not recorded in legacy log", rewardBreakdown: "Reward breakdown",
    baseReward: "Base reward", independentBonus: "Independent-watch bonus", totalReward: "Total",
    PLAYER_CQ: "Call CQ", PLAYER_RST_AND_73: "Exchange RST / 73", missingCq: "CQ is missing", missingDe: "DE is missing", missingPlayerCallsign: "Your callsign is missing", wrongCqOrder: "CQ message is out of order", missingK: "Final K is missing", invalidAgn: "A repeat request must be AGN K", missingCallsign: "Both callsigns are required", invalidRst: "RST format is invalid", missing73: "73 is missing", wrongReplyOrder: "Reply message is out of order", notWaitingForPlayer: "This stage is not accepting a transmission",
  },
  es: {
    title: "Revisión de operación", empty: "Este registro antiguo no contiene historial de intentos", stage: "Etapa", message: "Mensaje", reason: "Motivo",
    accepted: "Aceptado", error: "Error", repeat: "Repetición", unknown: "Sin registro", wpm: "WPM", accuracy: "Precisión", rhythm: "Ritmo",
    guidance: "Guía", full: "Completa", hints: "Solo pistas", off: "Desactivada", visualAssist: "Ayuda visual", used: "Usada", unused: "No usada",
    independent: "Guardia independiente", qualified: "Apto", notQualified: "No apto", unavailable: "No consta en el registro antiguo", rewardBreakdown: "Desglose de recompensa",
    baseReward: "Recompensa base", independentBonus: "Bono de guardia independiente", totalReward: "Total",
    PLAYER_CQ: "Llamar CQ", PLAYER_RST_AND_73: "Intercambiar RST / 73", missingCq: "Falta CQ", missingDe: "Falta DE", missingPlayerCallsign: "Falta tu indicativo", wrongCqOrder: "El mensaje CQ está desordenado", missingK: "Falta la K final", invalidAgn: "La petición de repetición debe ser AGN K", missingCallsign: "Se requieren ambos indicativos", invalidRst: "El formato RST no es válido", missing73: "Falta 73", wrongReplyOrder: "El mensaje de respuesta está desordenado", notWaitingForPlayer: "Esta etapa no acepta una transmisión",
  },
  de: {
    title: "Betriebsauswertung", empty: "Dieses ältere Log enthält keinen Versuchsverlauf", stage: "Phase", message: "Nachricht", reason: "Grund",
    accepted: "Akzeptiert", error: "Fehler", repeat: "Wiederholung", unknown: "Nicht erfasst", wpm: "WPM", accuracy: "Genauigkeit", rhythm: "Rhythmus",
    guidance: "Führung", full: "Vollständig", hints: "Nur Hinweise", off: "Aus", visualAssist: "Visuelle Hilfe", used: "Benutzt", unused: "Nicht benutzt",
    independent: "Selbstständige Wache", qualified: "Bestanden", notQualified: "Nicht bestanden", unavailable: "Im älteren Log nicht erfasst", rewardBreakdown: "Belohnungsaufschlüsselung",
    baseReward: "Grundbelohnung", independentBonus: "Bonus für selbstständige Wache", totalReward: "Gesamt",
    PLAYER_CQ: "CQ rufen", PLAYER_RST_AND_73: "RST / 73 austauschen", missingCq: "CQ fehlt", missingDe: "DE fehlt", missingPlayerCallsign: "Dein Rufzeichen fehlt", wrongCqOrder: "CQ-Nachricht hat die falsche Reihenfolge", missingK: "Abschließendes K fehlt", invalidAgn: "Eine Wiederholungsanfrage muss AGN K sein", missingCallsign: "Beide Rufzeichen sind erforderlich", invalidRst: "RST-Format ist ungültig", missing73: "73 fehlt", wrongReplyOrder: "Antwort hat die falsche Reihenfolge", notWaitingForPlayer: "Diese Phase nimmt keine Sendung an",
  },
  ru: {
    title: "Разбор работы", empty: "В старой записи нет истории попыток", stage: "Этап", message: "Сообщение", reason: "Причина",
    accepted: "Принято", error: "Ошибка", repeat: "Повтор", unknown: "Не записано", wpm: "WPM", accuracy: "Точность", rhythm: "Ритм",
    guidance: "Подсказки", full: "Полные", hints: "Только намёки", off: "Выкл.", visualAssist: "Визуальная помощь", used: "Использована", unused: "Не использована",
    independent: "Самостоятельная вахта", qualified: "Зачёт", notQualified: "Нет зачёта", unavailable: "Нет в старой записи", rewardBreakdown: "Состав награды",
    baseReward: "Базовая награда", independentBonus: "Бонус самостоятельной вахты", totalReward: "Итого",
    PLAYER_CQ: "Вызвать CQ", PLAYER_RST_AND_73: "Обменяться RST / 73", missingCq: "Отсутствует CQ", missingDe: "Отсутствует DE", missingPlayerCallsign: "Отсутствует ваш позывной", wrongCqOrder: "Неверный порядок сообщения CQ", missingK: "Нет завершающего K", invalidAgn: "Запрос повтора должен быть AGN K", missingCallsign: "Нужны оба позывных", invalidRst: "Неверный формат RST", missing73: "Отсутствует 73", wrongReplyOrder: "Неверный порядок ответа", notWaitingForPlayer: "На этом этапе передача не принимается",
  },
};

function historyResult(result, t) {
  const normalized = String(result ?? "").toLowerCase();
  if (["accepted", "accept", "correct", "success", "ok"].includes(normalized)) return { label: t.accepted, className: "accepted" };
  if (["repeat", "repeated", "agn", "retry"].includes(normalized)) return { label: t.repeat, className: "repeat" };
  if (["error", "incorrect", "rejected", "failed", "invalid"].includes(normalized)) return { label: t.error, className: "error" };
  return { label: result || t.unknown, className: "unknown" };
}

function reviewMetric(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "---" : `${value}${suffix}`;
}

function QsoAttemptHistory({ entry, language }) {
  const t = REVIEW_TEXT[language] ?? REVIEW_TEXT.en;
  const history = Array.isArray(entry?.attemptHistory) ? entry.attemptHistory.filter((attempt) => attempt && typeof attempt === "object") : [];
  const hasReviewData = history.length > 0;
  return (
    <section className="qso-operation-review" aria-label={t.title} data-attempt-count={history.length} data-guidance-level={hasReviewData ? entry?.guidanceLevel : "legacy"}>
      <header>
        <h3>{t.title}</h3>
        <div className="qso-review-status">
          <span>{t.guidance}: <b>{hasReviewData && entry?.guidanceLevel ? (t[entry.guidanceLevel] ?? entry.guidanceLevel) : "---"}</b></span>
          <span data-visual-assist={hasReviewData ? String(entry?.visualAssistUsed === true) : "legacy"}>{t.visualAssist}: <b>{hasReviewData && typeof entry?.visualAssistUsed === "boolean" ? (entry.visualAssistUsed ? t.used : t.unused) : "---"}</b></span>
          <span data-independent-watch={hasReviewData ? String(entry?.independentWatch === true) : "legacy"}>{t.independent}: <b>{hasReviewData && typeof entry?.independentWatch === "boolean" ? (entry.independentWatch ? t.qualified : t.notQualified) : t.unavailable}</b></span>
        </div>
      </header>
      {history.length ? (
        <ol className="qso-attempt-history">
          {history.map((attempt, index) => {
            const result = historyResult(attempt.result, t);
            return (
              <li className={result.className} data-review-result={result.className} key={`${attempt.stage ?? "stage"}-${index}`}>
                <div><b>#{String(index + 1).padStart(2, "0")} · {t[attempt.stage] ?? attempt.stage ?? t.stage}</b><em>{result.label}</em></div>
                <code>{attempt.message || "---"}</code>
                <small>{t.wpm} {reviewMetric(attempt.wpm)} · {t.accuracy} {reviewMetric(attempt.accuracy, "%")} · {t.rhythm} {reviewMetric(attempt.rhythm, "%")}</small>
                <p><span>{t.reason}</span>{attempt.reason ? (t[attempt.reason] ?? attempt.reason) : "---"}</p>
              </li>
            );
          })}
        </ol>
      ) : <p className="qso-review-empty">{t.empty}</p>}
    </section>
  );
}

export function QsoResultModal({
  language, failed = false, entry = null, creditsAwarded = 0, saved = false,
  rewardBreakdown = null, onSave, onRestart, onNext, onClose,
}) {
  const t = TEXT[language] ?? TEXT.en;
  return (
    <div className="qso-result-backdrop">
      <section className={`qso-result-modal ${failed ? "failed" : "success"}`} role="dialog" aria-modal="true" aria-labelledby="qso-result-title">
        <header>
          {failed ? <WarningCircle size={34} weight="fill" /> : <CheckCircle size={34} weight="fill" />}
          <div><small>{failed ? "QSO // FAILED" : "QSO // COMPLETE"}</small><h2 id="qso-result-title">{failed ? t.failed : t.success}</h2></div>
          {saved && <button className="icon-button" onClick={onClose} aria-label={t.continue}><X size={21} /></button>}
        </header>

        {failed ? (
          <div className="qso-result-failure">
            <WarningCircle size={76} weight="duotone" />
            <p>{t.failedHint}</p>
          </div>
        ) : (
          <div className="qso-result-body">
            <div className="qso-result-identity">
              <span><Radio size={19} weight="fill" />{t.callsign}</span>
              <strong>{entry?.callsign ?? "---"}</strong>
              <b>SIM // {t.sim}</b>
            </div>
            <dl className="qso-result-stats">
              <div><dt><MapPin size={18} />{t.region}</dt><dd>{value(entry?.location)}</dd></div>
              <div><dt><Ruler size={18} />{t.distance}</dt><dd>{value(entry?.distanceKm, " km")}</dd></div>
              <div><dt><ShieldCheck size={18} />{t.rst}</dt><dd>{value(entry?.sent)} / {value(entry?.received)}</dd></div>
              <div><dt><Broadcast size={18} />{t.propagation}</dt><dd>P{value(entry?.finalPropagationLevel)}</dd></div>
              <div><dt><Radio size={18} />{t.equipment}</dt><dd>{value(entry?.equipmentId)} / {value(entry?.antennaId)} / {value(entry?.accessoryId)}</dd></div>
              <div><dt><Gauge size={18} />{t.speed}</dt><dd>{value(entry?.wpm, " WPM")}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{value(entry?.transmitAccuracy, "%")}</dd></div>
              <div><dt>{t.rhythm}</dt><dd>{value(entry?.keyingScore, "%")}</dd></div>
              <div><dt>{t.repeats}</dt><dd>{value(entry?.repeatRequests ?? 0)}</dd></div>
            </dl>
            <QsoAttemptHistory entry={entry} language={language} />
            <div className="qso-result-rewards">
              <span>{saved ? t.saved : t.unsaved}</span>
              <strong>+{creditsAwarded} <small>{t.credits}</small></strong>
              <QsoRewardBreakdown language={language} breakdown={rewardBreakdown} credits={creditsAwarded} compact />
            </div>
          </div>
        )}

        <footer>
          {failed ? (
            <button className="qso-result-primary" onClick={onRestart}><ArrowClockwise size={21} weight="bold" />{t.restart}</button>
          ) : !saved ? (
            <button className="qso-result-primary" onClick={onSave}><FloppyDisk size={21} weight="fill" />{t.save}</button>
          ) : (
            <><button className="qso-result-primary" onClick={onNext}><Radio size={21} weight="fill" />{t.next}</button><button onClick={onClose}>{t.continue}</button></>
          )}
        </footer>
      </section>
    </div>
  );
}
