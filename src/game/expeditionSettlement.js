import { createExpeditionLoadout } from "./expeditionCatalog.js";
import { normalizeExpeditionRun, normalizeExpeditionState } from "./expeditionRun.js";
import { recordCompletedQso } from "../qso/qsoLog.js";

export const EXPEDITION_MONEY_REWARD = 250;
export const EXPEDITION_TECHNOLOGY_POINTS_REWARD = 1;

function boundedNumber(value, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
}

function boundedAdd(left, right, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.min(maximum, boundedNumber(left, maximum) + boundedNumber(right, maximum));
}

function own(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function sameNormalizedValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function hash32(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function qsoIdForRun(runId) {
  const prefix = "expedition-qso:";
  const raw = String(runId);
  if (`${prefix}${raw}`.length <= 96) return `${prefix}${raw}`;
  return `${prefix}${raw.slice(0, 96 - prefix.length - 9)}-${hash32(raw)}`;
}

function zeroResult(save, reason) {
  return {
    save,
    settled: false,
    reason,
    qsoId: null,
    qsoMoneyAwarded: 0,
    qsoTechnologyPointsAwarded: 0,
    expeditionMoneyAwarded: 0,
    expeditionTechnologyPointsAwarded: 0,
  };
}

function qsoCandidate(save, run, contact, qsoId) {
  const recoveryActions = contact.recoveryActions ?? [];
  return {
    id: qsoId,
    startedAt: contact.startedAt,
    completedAt: contact.completedAt,
    playerCallsign: run.playerCallsign,
    callsign: contact.callsign,
    personId: contact.personId,
    stationId: contact.stationId,
    sent: contact.sentRst,
    received: contact.receivedRst,
    location: contact.locationId,
    distanceKm: contact.distanceKm,
    frequencyMhz: 14.06,
    basePropagationLevel: run.propagationSnapshot?.level ?? 2,
    finalPropagationLevel: run.propagationSnapshot?.level ?? 2,
    propagationSource: "EXPEDITION_SNAPSHOT",
    equipmentId: run.loadout.radioId,
    antennaId: run.loadout.antennaId,
    accessoryId: run.loadout.batteryId,
    playerLocationId: `expedition:${run.fieldSite.id}`,
    wpm: 18,
    transmitAccuracy: 95,
    keyingScore: 90,
    repeatRequests: recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: recoveryActions.length,
    cqQuality: 90,
    copyScore: 90,
    copyOutcome: "copied",
    operatorProfileId: contact.operatorProfileId,
    remoteWpm: contact.remoteWpm,
    attemptHistory: recoveryActions.map((action) => ({
      stage: "EXPEDITION_EXCHANGE",
      message: `${action} K`,
      result: "repeat",
      remoteOutcome: "query",
      operatorProfileId: contact.operatorProfileId,
    })),
    guidanceLevel: "off",
    visualAssistUsed: false,
    independentWatch: true,
    isFictional: true,
  };
}

export function settleExpeditionRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) {
    throw new TypeError("A save record is required.");
  }
  const run = normalizeExpeditionRun(runValue);
  const settledAt = iso(settledAtValue);
  if (!settledAt || run.status !== "completed" || run.result?.outcome !== "success" || run.contacts.length === 0) {
    return zeroResult(save, "RUN_NOT_SUCCESSFUL");
  }
  const expeditionState = normalizeExpeditionState(own(save, "expeditionState"));
  if (expeditionState.settledRunIds.includes(run.runId)) return zeroResult(save, "ALREADY_SETTLED");
  const activeRun = expeditionState.activeRun;
  if (!activeRun || activeRun.runId !== run.runId || !sameNormalizedValue(activeRun, run)) {
    return zeroResult(save, "RUN_STATE_MISMATCH");
  }
  const playerCallsign = String(own(save, "callsign") ?? "").trim().toUpperCase();
  const verifiedLoadout = createExpeditionLoadout(save, run.loadout);
  if (run.playerCallsign !== playerCallsign || !verifiedLoadout
    || !sameNormalizedValue(verifiedLoadout, run.loadout)) {
    return zeroResult(save, "RUN_STATE_MISMATCH");
  }
  const contact = run.contacts[0];
  const qsoId = qsoIdForRun(run.runId);
  const completedRun = {
    runId: run.runId,
    completedAt: run.result.completedAt,
    siteId: run.fieldSite.id,
    qsoId,
  };
  const pendingSave = {
    ...save,
    expeditionStateVersion: 1,
    expeditionState: normalizeExpeditionState({
      ...expeditionState,
      activeRun: expeditionState.activeRun?.runId === run.runId ? null : expeditionState.activeRun,
      settledRunIds: [...expeditionState.settledRunIds, run.runId],
      completedRuns: [...expeditionState.completedRuns, completedRun],
    }),
  };
  const qsoSettlement = recordCompletedQso(pendingSave, qsoCandidate(save, run, contact, qsoId));
  if (!qsoSettlement.added) return zeroResult(save, "QSO_ALREADY_SETTLED");
  const settledSave = {
    ...qsoSettlement.save,
    money: boundedAdd(qsoSettlement.save.money, EXPEDITION_MONEY_REWARD),
    technologyPoints: boundedAdd(
      qsoSettlement.save.technologyPoints,
      EXPEDITION_TECHNOLOGY_POINTS_REWARD,
    ),
  };
  return {
    save: settledSave,
    settled: true,
    reason: null,
    qsoId,
    qsoMoneyAwarded: boundedNumber(qsoSettlement.moneyAwarded),
    qsoTechnologyPointsAwarded: boundedNumber(qsoSettlement.technologyPointsAwarded, 1_000_000),
    expeditionMoneyAwarded: EXPEDITION_MONEY_REWARD,
    expeditionTechnologyPointsAwarded: EXPEDITION_TECHNOLOGY_POINTS_REWARD,
  };
}
