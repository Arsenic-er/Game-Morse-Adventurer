import { QSO_PHASES } from "./qsoEngine.js";

export const QSO_EXIT_RISKS = Object.freeze({
  NONE: "none",
  ACTIVE: "active",
  UNSAVED: "unsaved",
});

export function qsoExitRisk(qso, { saved = false, pulseCount = 0, isKeying = false } = {}) {
  if (!qso || typeof qso !== "object") return QSO_EXIT_RISKS.NONE;
  if (qso.phase === QSO_PHASES.QSO_COMPLETE) {
    return saved ? QSO_EXIT_RISKS.NONE : QSO_EXIT_RISKS.UNSAVED;
  }
  if (qso.phase === QSO_PHASES.QSO_FAILED) return QSO_EXIT_RISKS.NONE;
  if (qso.phase !== QSO_PHASES.PLAYER_CQ) return QSO_EXIT_RISKS.ACTIVE;

  const hasProgress = isKeying === true
    || Number(pulseCount) > 0
    || (Array.isArray(qso.attemptHistory) && qso.attemptHistory.length > 0)
    || Number(qso.unansweredCalls) > 0
    || qso.hasContact === true;
  return hasProgress ? QSO_EXIT_RISKS.ACTIVE : QSO_EXIT_RISKS.NONE;
}
