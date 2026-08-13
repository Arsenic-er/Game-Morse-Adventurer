import { assessCqTransmission } from "./cqAssessment.js";
import { OPERATOR_PROFILES, resolveRemoteCopy } from "./operatorProfiles.js";
import { interpretCwTraffic } from "./semanticInterpreter.js";
import { observePlayerSignal } from "./signalObservation.js";

export const OPERATOR_CALIBRATION_SCHEMA_VERSION = 1;

export const CALIBRATION_OPERATORS = Object.freeze([
  Object.freeze({ profileId: "careful-beginner", callsign: "SIM7QX" }),
  Object.freeze({ profileId: "patient-veteran", callsign: "SIM3RA" }),
  Object.freeze({ profileId: "contest-sprinter", callsign: "SIM9AK" }),
  Object.freeze({ profileId: "youth-club", callsign: "SIM6JP" }),
  Object.freeze({ profileId: "traditional-fist", callsign: "SIM5TU" }),
  Object.freeze({ profileId: "weak-signal-listener", callsign: "SIM2DX" }),
  Object.freeze({ profileId: "friendly-ragchewer", callsign: "SIM8CW" }),
]);

export const OPERATOR_CALIBRATION_SIGNALS = Object.freeze([
  Object.freeze({
    id: "reference", message: "CQ CQ DE BH1ABC BH1ABC PSE K",
    level: 4, wpm: 18, accuracy: 100, rhythm: 95, seed: "calibration-reference",
  }),
  Object.freeze({
    id: "weak-path", message: "CQ CQ DE BH1ABC BH1ABC PSE K",
    level: 1, wpm: 16, accuracy: 100, rhythm: 90, seed: "calibration-weak",
  }),
  Object.freeze({
    id: "fast-call", message: "CQ CQ DE BH1ABC BH1ABC K",
    level: 4, wpm: 36, accuracy: 100, rhythm: 90, seed: "calibration-fast",
  }),
  Object.freeze({
    id: "noncanonical", message: "CQ CQ BH1ABC K",
    level: 3, wpm: 18, accuracy: 90, rhythm: 80, seed: "calibration-procedure",
  }),
  Object.freeze({
    id: "garbled", message: "CQ T T K",
    level: 2, wpm: 18, accuracy: 30, rhythm: 65, seed: "calibration-garbled",
  }),
]);

function semanticFor(signal, semanticResults) {
  return semanticResults?.[signal.id] ?? interpretCwTraffic({
    message: signal.message,
    phase: "PLAYER_CQ",
    selfCallsign: "BH1ABC",
    wpm: signal.wpm,
  });
}

export function runOperatorCalibration({ semanticResults = null } = {}) {
  return Object.freeze(OPERATOR_CALIBRATION_SIGNALS.flatMap((signal) => {
    const semanticResult = semanticFor(signal, semanticResults);
    const assessment = assessCqTransmission({
      message: signal.message,
      playerCallsign: "BH1ABC",
      wpm: signal.wpm,
      rhythm: signal.rhythm,
    });
    const signalObservation = observePlayerSignal({
      message: signal.message,
      wpm: signal.wpm,
      accuracy: signal.accuracy,
      rhythm: signal.rhythm,
      semanticResult,
    });
    return CALIBRATION_OPERATORS.map((operator) => {
      const decision = resolveRemoteCopy({
        assessment,
        semanticResult,
        signalObservation,
        npc: { callsign: operator.callsign, finalLevel: signal.level },
        playerCallsign: "BH1ABC",
        seed: signal.seed,
      });
      return Object.freeze({
        schemaVersion: OPERATOR_CALIBRATION_SCHEMA_VERSION,
        signalId: signal.id,
        profileId: operator.profileId,
        callsign: operator.callsign,
        outcome: decision.outcome,
        disposition: decision.disposition,
        copyScore: decision.copyScore,
        copyThreshold: decision.copyThreshold,
        queryThreshold: decision.queryThreshold,
        receptionTolerance: decision.receptionTolerance,
        replyWpm: decision.replyWpm,
        replyMessage: decision.replyMessage,
        reasonCodes: Object.freeze([...decision.reasonCodes]),
      });
    });
  }));
}

function cell(results, signalId, profileId) {
  return results.find((result) => result.signalId === signalId && result.profileId === profileId);
}

export function operatorCalibrationIssues(results = runOperatorCalibration()) {
  const issues = [];
  if (results.length !== OPERATOR_CALIBRATION_SIGNALS.length * CALIBRATION_OPERATORS.length) {
    issues.push("matrixSize");
    return Object.freeze(issues);
  }
  for (const operator of CALIBRATION_OPERATORS) {
    if (cell(results, "reference", operator.profileId)?.outcome !== "copied") {
      issues.push(`reference:${operator.profileId}`);
    }
  }
  const beginnerWeak = cell(results, "weak-path", "careful-beginner");
  const specialistWeak = cell(results, "weak-path", "weak-signal-listener");
  if (beginnerWeak?.outcome === "copied") issues.push("weakPathBeginnerTooStrong");
  if (specialistWeak?.outcome !== "copied") issues.push("weakPathSpecialistTooWeak");
  if ((specialistWeak?.copyScore ?? 0) <= (beginnerWeak?.copyScore ?? 100)) issues.push("weakPathSkillOrder");
  if (cell(results, "fast-call", "careful-beginner")?.outcome === "copied") issues.push("fastBeginnerTooStrong");
  if (cell(results, "fast-call", "contest-sprinter")?.outcome !== "copied") issues.push("fastContestTooWeak");
  if (OPERATOR_PROFILES["weak-signal-listener"].receptionTolerance
    <= OPERATOR_PROFILES["careful-beginner"].receptionTolerance) issues.push("toleranceOrder");
  const signatures = new Set(CALIBRATION_OPERATORS.map(({ profileId }) => results
    .filter((result) => result.profileId === profileId)
    .map((result) => `${result.outcome}:${result.replyWpm}:${result.copyThreshold}`)
    .join("|")));
  if (signatures.size !== CALIBRATION_OPERATORS.length) issues.push("duplicateBehaviorSignature");
  return Object.freeze(issues);
}

export function evaluateOperatorCalibration(options = {}) {
  const results = runOperatorCalibration(options);
  const issues = operatorCalibrationIssues(results);
  return Object.freeze({
    schemaVersion: OPERATOR_CALIBRATION_SCHEMA_VERSION,
    results,
    issues,
    releaseReady: issues.length === 0,
  });
}
