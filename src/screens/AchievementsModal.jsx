import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Broadcast,
  CheckCircle,
  GlobeHemisphereEast,
  LockKey,
  Radio,
  Ruler,
  ShieldCheck,
  Trophy,
  X,
} from "@phosphor-icons/react";
import { evaluateAchievements } from "../game/achievements.js";

const TEXT = {
  "zh-CN": {
    title: "成就档案",
    kicker: "电台员行动记录",
    operator: "电台呼号",
    unlockedCount: "已解锁",
    progress: "进度",
    unlocked: "已解锁",
    locked: "未解锁",
    complete: "完成",
    close: "返回管理中心",
    achievements: {
      "first-qso": { title: "第一次通联", description: "成功完成并记录首次通联。" },
      "qso-5": { title: "空中相会", description: "累计完成 5 次通联。" },
      "qso-10": { title: "活跃电台员", description: "累计完成 10 次通联。" },
      "dx-5000": { title: "跨越五千公里", description: "完成一次距离至少 5,000 km 的远程通联。" },
      "weak-signal": { title: "弱信号猎手", description: "在微弱传播条件下成功完成通联。" },
      "regions-3": { title: "电波旅行者", description: "与至少 3 个不同地区的电台完成通联。" },
    },
  },
  "zh-TW": {
    title: "成就檔案",
    kicker: "電臺員行動記錄",
    operator: "電臺呼號",
    unlockedCount: "已解鎖",
    progress: "進度",
    unlocked: "已解鎖",
    locked: "未解鎖",
    complete: "完成",
    close: "返回管理中心",
    achievements: {
      "first-qso": { title: "第一次通聯", description: "成功完成並記錄首次通聯。" },
      "qso-5": { title: "空中相會", description: "累計完成 5 次通聯。" },
      "qso-10": { title: "活躍電臺員", description: "累計完成 10 次通聯。" },
      "dx-5000": { title: "跨越五千公里", description: "完成一次距離至少 5,000 km 的遠程通聯。" },
      "weak-signal": { title: "弱訊號獵手", description: "在微弱傳播條件下成功完成通聯。" },
      "regions-3": { title: "電波旅行者", description: "與至少 3 個不同地區的電臺完成通聯。" },
    },
  },
  ja: {
    title: "実績ファイル",
    kicker: "オペレーター活動記録",
    operator: "コールサイン",
    unlockedCount: "解除済み",
    progress: "進捗",
    unlocked: "解除済み",
    locked: "未解除",
    complete: "完了",
    close: "管理センターへ戻る",
    achievements: {
      "first-qso": { title: "初めての交信", description: "初めての交信を完了し、ログに記録する。" },
      "qso-5": { title: "空での出会い", description: "累計 5 回の交信を完了する。" },
      "qso-10": { title: "アクティブ局", description: "累計 10 回の交信を完了する。" },
      "dx-5000": { title: "5,000 km の彼方", description: "5,000 km 以上離れた局との遠距離交信を完了する。" },
      "weak-signal": { title: "微弱信号ハンター", description: "微弱な伝搬条件で交信を成功させる。" },
      "regions-3": { title: "電波の旅人", description: "3 つ以上の異なる地域の局と交信する。" },
    },
  },
  en: {
    title: "Achievement Archive",
    kicker: "Operator Activity Record",
    operator: "Station Callsign",
    unlockedCount: "Unlocked",
    progress: "Progress",
    unlocked: "Unlocked",
    locked: "Locked",
    complete: "Complete",
    close: "Back to Management Center",
    achievements: {
      "first-qso": { title: "First Contact", description: "Complete and log your first QSO." },
      "qso-5": { title: "Meeting on the Air", description: "Complete a total of 5 QSOs." },
      "qso-10": { title: "Active Operator", description: "Complete a total of 10 QSOs." },
      "dx-5000": { title: "Beyond 5,000 Kilometers", description: "Complete a DX contact over at least 5,000 km." },
      "weak-signal": { title: "Weak-Signal Hunter", description: "Complete a QSO under weak propagation conditions." },
      "regions-3": { title: "Radio-Wave Traveler", description: "Contact stations in at least 3 different regions." },
    },
  },
  es: {
    title: "Archivo de logros", kicker: "Registro de actividad del operador", operator: "Indicativo de estación", unlockedCount: "Desbloqueados", progress: "Progreso", unlocked: "Desbloqueado", locked: "Bloqueado", complete: "Completo", close: "Volver al Centro de Gestión",
    achievements: {
      "first-qso": { title: "Primer contacto", description: "Completa y registra tu primer QSO." },
      "qso-5": { title: "Encuentro en el aire", description: "Completa un total de 5 QSO." },
      "qso-10": { title: "Operador activo", description: "Completa un total de 10 QSO." },
      "dx-5000": { title: "Más allá de 5.000 kilómetros", description: "Completa un contacto DX de al menos 5.000 km." },
      "weak-signal": { title: "Cazador de señales débiles", description: "Completa un QSO con propagación débil." },
      "regions-3": { title: "Viajero de las ondas", description: "Contacta estaciones de al menos 3 regiones diferentes." },
    },
  },
  de: {
    title: "Erfolgsarchiv", kicker: "Betriebsaktivitätsprotokoll", operator: "Stationsrufzeichen", unlockedCount: "Freigeschaltet", progress: "Fortschritt", unlocked: "Freigeschaltet", locked: "Gesperrt", complete: "Abgeschlossen", close: "Zurück zum Verwaltungszentrum",
    achievements: {
      "first-qso": { title: "Erster Kontakt", description: "Schließe dein erstes QSO ab und protokolliere es." },
      "qso-5": { title: "Treffen auf der Frequenz", description: "Schließe insgesamt 5 QSOs ab." },
      "qso-10": { title: "Aktiver Operator", description: "Schließe insgesamt 10 QSOs ab." },
      "dx-5000": { title: "Mehr als 5.000 Kilometer", description: "Schließe eine DX-Verbindung über mindestens 5.000 km ab." },
      "weak-signal": { title: "Schwachsignaljäger", description: "Schließe ein QSO bei schwacher Ausbreitung ab." },
      "regions-3": { title: "Funkwellenreisender", description: "Kontaktiere Stationen in mindestens 3 verschiedenen Regionen." },
    },
  },
  ru: {
    title: "Архив достижений", kicker: "Журнал активности оператора", operator: "Позывной станции", unlockedCount: "Открыто", progress: "Прогресс", unlocked: "Открыто", locked: "Закрыто", complete: "Выполнено", close: "Назад в Центр управления",
    achievements: {
      "first-qso": { title: "Первая связь", description: "Проведите и запишите первое QSO." },
      "qso-5": { title: "Встреча в эфире", description: "Проведите всего 5 QSO." },
      "qso-10": { title: "Активный оператор", description: "Проведите всего 10 QSO." },
      "dx-5000": { title: "За 5 000 километров", description: "Проведите DX-связь на расстоянии не менее 5 000 км." },
      "weak-signal": { title: "Охотник за слабым сигналом", description: "Проведите QSO при слабом прохождении." },
      "regions-3": { title: "Путешественник по радиоволнам", description: "Свяжитесь со станциями как минимум из 3 разных регионов." },
    },
  },
};

const ACHIEVEMENT_ICONS = {
  "first-qso": Radio,
  "qso-5": Broadcast,
  "qso-10": Trophy,
  "dx-5000": Ruler,
  "weak-signal": ShieldCheck,
  "regions-3": GlobeHemisphereEast,
};

const NOTIFICATION_TEXT = {
  "zh-CN": { unlocked: "成就解锁", remaining: "队列中还剩 {count} 项", dismiss: "关闭成就通知" },
  "zh-TW": { unlocked: "成就解鎖", remaining: "佇列中還有 {count} 項", dismiss: "關閉成就通知" },
  ja: { unlocked: "実績を解除", remaining: "残り {count} 件", dismiss: "実績通知を閉じる" },
  en: { unlocked: "Achievement Unlocked", remaining: "{count} remaining", dismiss: "Dismiss achievement notification" },
  es: { unlocked: "Logro desbloqueado", remaining: "Quedan {count}", dismiss: "Cerrar notificación de logro" },
  de: { unlocked: "Erfolg freigeschaltet", remaining: "Noch {count}", dismiss: "Erfolgsmeldung schließen" },
  ru: { unlocked: "Достижение открыто", remaining: "Осталось: {count}", dismiss: "Закрыть уведомление о достижении" },
};

function progressPercent(achievement) {
  const progress = Number(achievement.progress);
  if (!Number.isFinite(progress)) {
    const current = Number(achievement.current) || 0;
    const target = Number(achievement.target) || 1;
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }
  const normalized = progress <= 1 ? progress * 100 : progress;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

/**
 * Persistent, application-level achievement announcement.
 *
 * queueSize is the total number of queued notifications including the active
 * one. The component never moves focus or dismisses itself; its owner advances
 * the queue through onDismiss.
 */
export function AchievementNotification({
  language,
  activeAchievement,
  queueSize = 0,
  onDismiss,
}) {
  const t = TEXT[language] ?? TEXT.en;
  const notification = NOTIFICATION_TEXT[language] ?? NOTIFICATION_TEXT.en;
  const achievementId = typeof activeAchievement === "string"
    ? activeAchievement
    : activeAchievement?.id;
  const copy = achievementId
    ? (t.achievements[achievementId] ?? { title: achievementId, description: "" })
    : null;
  const Icon = ACHIEVEMENT_ICONS[achievementId] ?? Trophy;
  const numericQueueSize = Number(queueSize);
  const normalizedQueueSize = achievementId
    ? Math.max(1, Number.isFinite(numericQueueSize) ? Math.floor(numericQueueSize) : 1)
    : 0;
  const remainingCount = Math.max(0, normalizedQueueSize - 1);

  return (
    <div
      className="achievement-notification-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {copy && (
        <aside
          className="achievement-notification"
          data-testid="achievement-notification"
          data-achievement-id={achievementId}
          data-achievement-queue-size={normalizedQueueSize}
        >
          <div className="achievement-notification-icon" aria-hidden="true">
            <Icon size={32} weight="fill" />
          </div>
          <div className="achievement-notification-copy">
            <span>{notification.unlocked}</span>
            <strong>{copy.title}</strong>
            <p>{copy.description}</p>
            {remainingCount > 0 && <small>{notification.remaining.replace("{count}", String(remainingCount))}</small>}
          </div>
          <button
            type="button"
            data-action="dismiss-achievement-notification"
            onClick={onDismiss}
            aria-label={notification.dismiss}
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </aside>
      )}
    </div>
  );
}

export function AchievementsModal({ language, save, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const achievements = useMemo(() => evaluateAchievements(save), [save]);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop achievements-backdrop"
      data-testid="achievements-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="achievements-modal"
        data-testid="achievements-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-title"
      >
        <header className="achievements-header">
          <div className="achievements-title-block">
            <Trophy size={38} weight="fill" aria-hidden="true" />
            <div>
              <span>{t.kicker}</span>
              <h2 id="achievements-title">{t.title}</h2>
            </div>
          </div>
          <div className="achievements-summary">
            <span>{t.operator}</span>
            <strong>{save?.callsign || "-------"}</strong>
            <b>{t.unlockedCount} {unlockedCount}/{achievements.length}</b>
          </div>
          <button className="icon-button" data-action="close-achievements" onClick={onClose} aria-label={t.close}>
            <X size={22} weight="bold" />
          </button>
        </header>

        <div className="achievements-grid">
          {achievements.map((achievement, index) => {
            const copy = t.achievements[achievement.id] ?? { title: achievement.id, description: "" };
            const Icon = ACHIEVEMENT_ICONS[achievement.id] ?? Trophy;
            const percent = progressPercent(achievement);
            return (
              <article
                key={achievement.id}
                className={`achievement-card ${achievement.unlocked ? "unlocked" : "locked"}`}
                data-achievement-id={achievement.id}
                data-achievement-state={achievement.unlocked ? "unlocked" : "locked"}
              >
                <div className="achievement-card-index">ACH-{String(index + 1).padStart(2, "0")}</div>
                <div className="achievement-icon" aria-hidden="true">
                  <Icon size={40} weight={achievement.unlocked ? "fill" : "duotone"} />
                </div>
                <div className="achievement-copy">
                  <h3>{copy.title}</h3>
                  <p>{copy.description}</p>
                </div>
                <div className="achievement-progress">
                  <div className="achievement-progress-label">
                    <span>{t.progress}</span>
                    <strong>{Math.min(achievement.current, achievement.target)}/{achievement.target}</strong>
                  </div>
                  <div
                    className="achievement-progress-track"
                    role="progressbar"
                    aria-label={`${copy.title}: ${percent}%`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={percent}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="achievement-status">
                  {achievement.unlocked
                    ? <><CheckCircle size={18} weight="fill" />{t.unlocked}</>
                    : <><LockKey size={18} weight="fill" />{t.locked}</>}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="achievements-footer">
          <span>{save?.callsign || "-------"} // {unlockedCount}/{achievements.length} {t.complete}</span>
          <button data-action="close-achievements-footer" onClick={onClose}>
            <ArrowLeft size={19} weight="bold" />{t.close}
          </button>
        </footer>
      </section>
    </div>
  );
}
