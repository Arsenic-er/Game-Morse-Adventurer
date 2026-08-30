import { appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords } from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { normalizeQslRecords } from "./qslRecords.js";
import {
  FINAL_PROMISE_PHASES, normalizeFinalPromiseProof, normalizeFinalPromiseRecord,
  normalizeFinalPromiseRun, normalizeFinalPromiseState,
} from "./finalPromiseRun.js";
import { STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState } from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function iso(value) { if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function count(value) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric))) : 0; }
function zero(save, reason) { return { save, settled: false, reason, qsoId: null, moneyAwarded: 0, technologyPointsAwarded: 0 }; }
function arrayTail(value, maximum) {
  if (!Array.isArray(value)) return null; let length;
  try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return null; }
  if (!Number.isSafeInteger(length) || length < 0) return null; const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null; result.push(descriptor.value);
  }
  return result;
}
function activeMission(save) {
  const missions = arrayTail(own(own(save, "missionState"), "activeMissions"), 4); if (!missions) return null;
  const mission = missions.find((entry) => own(entry, "id") === "story-14"); const contract = own(mission, "contract");
  return mission && iso(own(mission, "acceptedAt")) && own(contract, "missionPhase") === "final-promise"
    && own(contract, "targetCallsign") === "SIM14FP" ? mission : null;
}
function linkedQsl(save, run) {
  if (run.sourceQslId === null) return null;
  return normalizeQslRecords(own(save, "qslRecords")).find((record) => record.id === run.sourceQslId
    && record.personId === "person:sora" && record.stationId === "station:sim6jp" && record.callsign === "SIM6JP") ?? null;
}
function qsoCandidate(save, run, qsoId) {
  return {
    id: qsoId, startedAt: run.startedAt, completedAt: run.completedAt,
    playerCallsign: run.playerCallsign, callsign: run.targetCallsign,
    personId: run.personId, stationId: run.stationId,
    sent: "599", received: "599", location: "PX", distanceKm: 0, frequencyMhz: 0,
    basePropagationLevel: 3, finalPropagationLevel: 3, propagationSource: "FINAL_PROMISE_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"), antennaId: String(own(save, "antennaId") ?? "none"),
    accessoryId: String(own(save, "accessoryId") ?? "none"), playerLocationId: String(own(save, "locationId") ?? "unknown"),
    wpm: 15, transmitAccuracy: 100, keyingScore: 100,
    repeatRequests: run.recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: run.recoveryActions.length, cqQuality: 100, copyScore: 100, copyOutcome: "copied",
    operatorProfileId: "chapter14-final-recipient", operatorProfileRevision: 1, remoteWpm: run.accountWpm,
    optionalExchangeOutcome: "not-offered", guidanceLevel: "off", visualAssistUsed: false,
    independentWatch: true, attemptHistory: [], rewardBreakdown: null, credits: 0,
    eventId: "chapter-continuation", eventRunId: run.runId, eventMode: "story", eventKind: "final-promise",
    eventRegionCode: "PX", onAirCallsign: run.playerCallsign, operatorCallsign: run.targetCallsign, isFictional: true,
  };
}
function recordFor(run, qsoId) {
  return normalizeFinalPromiseRecord({ id: `final-page:${run.runId}`, runId: run.runId, qsoId,
    playerCallsign: run.playerCallsign, targetCallsign: run.targetCallsign, personId: run.personId,
    stationId: run.stationId, sourceQslId: run.sourceQslId, sourceQslChoice: run.sourceQslChoice,
    recallKeys: run.recallKeys, scheduledPersonIds: run.scheduledPersonIds, accountKey: run.accountKey,
    tone: run.tone, messageKey: run.messageKey, completedAt: run.completedAt, isFictional: true });
}
function proofFor(run, qsoId) {
  return normalizeFinalPromiseProof({ runId: run.runId, recordId: `final-page:${run.runId}`, qsoId,
    sourceQslId: run.sourceQslId, sourceQslChoice: run.sourceQslChoice, personId: run.personId,
    stationId: run.stationId, tone: run.tone, messageKey: run.messageKey, completedAt: run.completedAt });
}
function chronological(left, right) { return left.completedAt.localeCompare(right.completedAt) || left.runId.localeCompare(right.runId); }

export function settleFinalPromiseRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeFinalPromiseRun(runValue); const settledAt = iso(settledAtValue);
  if (!run || run.phase !== FINAL_PROMISE_PHASES.COMPLETED || !run.summary) return zero(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) return zero(save, "INVALID_SETTLEMENT_TIME");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeFinalPromiseState(continuation.chapter14);
  if (chapter.settledRunIds.includes(run.runId)) return zero(save, "ALREADY_SETTLED");
  const mission = activeMission(save);
  if (!mission || Date.parse(own(mission, "acceptedAt")) > Date.parse(run.startedAt)
    || !chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) return zero(save, "RUN_STATE_MISMATCH");
  if (run.sourceQslId !== null && !linkedQsl(save, run)) return zero(save, "SOURCE_QSL_MISSING");

  const qsoId = `final-promise-qso:${run.runId.slice("final-promise:".length)}`;
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs")); const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (currentRecords.settledQsoIds.includes(qsoId)) return zero(save, "QSO_ALREADY_SETTLED");
  const log = normalizeQsoLogEntry(qsoCandidate(save, run, qsoId));
  if (!log || log.personId !== run.personId || log.stationId !== run.stationId) return zero(save, "INVALID_QSO");
  const qsoLogs = appendQsoLog(currentLogs, log);
  const qsoRecords = { ...currentRecords, total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + 1),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, log.location])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, qsoId])].sort() };
  const operatorRelationships = recordCompletedOperatorRelationship(normalizeOperatorRelationships(own(save, "operatorRelationships")), log);
  const record = recordFor(run, qsoId); const proof = proofFor(run, qsoId);
  if (!record || !proof) return zero(save, "INVALID_FINAL_PAGE");
  const chapter14 = normalizeFinalPromiseState({ ...chapter, activeRun: null,
    completedRuns: [...chapter.completedRuns, run.summary].sort(chronological),
    settledRunIds: [...chapter.settledRunIds, run.runId].sort(),
    settlementProofs: [...chapter.settlementProofs, proof].sort(chronological),
    archive: [...chapter.archive, record].sort(chronological) });
  if (!chapter14.settledRunIds.includes(run.runId) || !chapter14.completedRuns.some(({ runId: id }) => id === run.runId)
    || !chapter14.settlementProofs.some(({ runId: id }) => id === run.runId)
    || !chapter14.archive.some(({ runId: id }) => id === run.runId)) return zero(save, "STATE_REJECTED");
  return { save: { ...save, qsoLogs, qsoRecords, operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
    operatorRelationships, storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
    storyContinuationState: Object.freeze({ ...continuation, chapter14 }) },
    settled: true, reason: null, qsoId, moneyAwarded: 0, technologyPointsAwarded: 0 };
}

function verifiedEventLog(log, record) {
  if (!log || own(log, "id") !== record.qsoId || own(log, "eventKind") !== "final-promise"
    || own(log, "eventRunId") !== record.runId || own(log, "callsign") !== record.targetCallsign
    || own(log, "personId") !== record.personId || own(log, "stationId") !== record.stationId
    || own(log, "playerCallsign") !== record.playerCallsign || own(log, "credits") !== 0
    || own(log, "isFictional") !== true || iso(own(log, "completedAt")) !== record.completedAt) return false;
  const claim = { callsign: record.targetCallsign, personId: own(log, "personId"), stationId: own(log, "stationId") };
  return personIdForOperator(claim) === record.personId
    && stationIdentityForCallsign(record.targetCallsign, claim)?.stationId === record.stationId;
}

export function verifiedFinalPromiseCompletion(save, active) {
  try {
    if (own(active, "id") !== "story-14") return false;
    const acceptedAt = iso(own(active, "acceptedAt")); const contract = own(active, "contract");
    if (!acceptedAt || own(contract, "missionPhase") !== "final-promise" || own(contract, "targetCallsign") !== "SIM14FP") return false;
    const baselineValues = arrayTail(own(active, "baselineFinalPromiseRunIds"), 100);
    if (!baselineValues || baselineValues.some((value) => typeof value !== "string" || value.length > 64)) return false;
    const baseline = new Set(baselineValues); const chapter = normalizeFinalPromiseState(own(own(save, "storyContinuationState"), "chapter14"));
    const logs = arrayTail(own(save, "qsoLogs"), 200); if (!logs) return false;
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    const qslRecords = normalizeQslRecords(own(save, "qslRecords"));
    for (const record of chapter.archive) {
      if (baseline.has(record.runId) || Date.parse(record.completedAt) < Date.parse(acceptedAt) || !chapter.settledRunIds.includes(record.runId)) continue;
      const summary = chapter.completedRuns.find(({ runId }) => runId === record.runId);
      const proof = chapter.settlementProofs.find(({ runId }) => runId === record.runId);
      if (!summary || !proof || proof.recordId !== record.id || proof.qsoId !== record.qsoId
        || proof.completedAt !== record.completedAt || summary.completedAt !== record.completedAt
        || summary.playerCallsign !== record.playerCallsign || summary.personId !== record.personId
        || summary.stationId !== record.stationId || summary.sourceQslId !== record.sourceQslId
        || summary.sourceQslChoice !== record.sourceQslChoice || proof.sourceQslId !== record.sourceQslId
        || proof.sourceQslChoice !== record.sourceQslChoice || proof.tone !== record.tone
        || proof.messageKey !== record.messageKey || summary.tone !== record.tone
        || summary.messageKey !== record.messageKey || !same(summary.recallKeys, record.recallKeys)
        || !same(summary.scheduledPersonIds, record.scheduledPersonIds)) continue;
      if (record.sourceQslId !== null && !qslRecords.some((qsl) => qsl.id === record.sourceQslId
        && qsl.personId === "person:sora" && qsl.stationId === "station:sim6jp" && qsl.callsign === "SIM6JP")) continue;
      if (!verifiedEventLog(logs.find((entry) => own(entry, "id") === record.qsoId), record)) continue;
      const relationship = relationships.find(({ personId }) => personId === record.personId);
      if (relationship?.completedQsos > 0 && Date.parse(relationship.firstMetAt) <= Date.parse(record.completedAt)
        && Date.parse(relationship.lastMetAt) >= Date.parse(record.completedAt)) return true;
    }
    return false;
  } catch { return false; }
}
