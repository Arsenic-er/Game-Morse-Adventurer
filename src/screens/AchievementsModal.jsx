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
};

const ACHIEVEMENT_ICONS = {
  "first-qso": Radio,
  "qso-5": Broadcast,
  "qso-10": Trophy,
  "dx-5000": Ruler,
  "weak-signal": ShieldCheck,
  "regions-3": GlobeHemisphereEast,
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
