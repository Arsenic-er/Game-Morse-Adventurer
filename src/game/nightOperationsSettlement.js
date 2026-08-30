import { appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords } from "../qso/qsoLog.js";
import { OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship } from "../qso/operatorRelationships.js";
import { NIGHT_OPERATIONS_PHASES, normalizeNightOperationsRun, normalizeNightOperationsState } from "./nightOperationsRun.js";
import { STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState } from "./storyContinuationState.js";

export { verifiedNightOperationsCompletion } from "./nightOperationsCompletion.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function iso(value) { if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function count(value) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric))) : 0; }
function zero(save, reason) { return { save, settled: false, reason, qsoIds: [], moneyAwarded: 0, technologyPointsAwarded: 0 }; }
function ownArrayTail(value, maximum) {
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
  const missions = ownArrayTail(own(own(save, "missionState"), "activeMissions"), 4); if (!missions) return null;
  const mission = missions.find((entry) => own(entry, "id") === "story-13"); const contract = own(mission, "contract");
  return mission && iso(own(mission, "acceptedAt")) && own(contract, "missionPhase") === "night-operations" && own(contract, "requiredDistinctOperators") === 3 ? mission : null;
}
function qsoCandidate(save, run, contact, id) {
  return { id, startedAt: run.startedAt, completedAt: contact.completedAt, playerCallsign: run.playerCallsign,
    callsign: contact.callsign, ...(contact.personId === "person:sora" ? {} : { proceduralNpcId: contact.npcId }),
    personId: contact.personId, stationId: contact.stationId, sent: "599", received: "599", location: "PX",
    distanceKm: 0, frequencyMhz: 0, basePropagationLevel: Number(contact.propagationGrade.slice(1)),
    finalPropagationLevel: Number(contact.propagationGrade.slice(1)), propagationSource: "NIGHT_OPERATIONS_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"), antennaId: String(own(save, "antennaId") ?? "none"),
    accessoryId: String(own(save, "accessoryId") ?? "none"), playerLocationId: String(own(save, "locationId") ?? "unknown"),
    wpm: 16, transmitAccuracy: 100, keyingScore: 100,
    repeatRequests: contact.recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: contact.recoveryActions.length, cqQuality: 100, copyScore: 100, copyOutcome: "copied",
    operatorProfileId: contact.npcId, operatorProfileRevision: 1, remoteWpm: 16,
    optionalExchangeOutcome: "not-offered", guidanceLevel: "off", visualAssistUsed: false, independentWatch: true,
    attemptHistory: [], rewardBreakdown: null, credits: 0, eventId: "chapter-continuation", eventRunId: run.runId,
    eventMode: "story", eventKind: "night-operations", eventRegionCode: contact.band, onAirCallsign: run.playerCallsign,
    operatorCallsign: contact.callsign, isFictional: true };
}
function recordForRun(run, qsoIds) {
  return { id: `night-record:${run.runId}`, runId: run.runId, playerCallsign: run.playerCallsign, scheduleSeed: run.seed,
    knownPersonIds: run.knownPersonIds, windows: run.windows, contacts: run.contacts.map((contact, index) => ({
      qsoId: qsoIds[index], contactId: contact.id, windowId: contact.windowId, personId: contact.personId,
      stationId: contact.stationId, npcId: contact.npcId, callsign: contact.callsign, band: contact.band,
      propagationGrade: contact.propagationGrade, completedAt: contact.completedAt,
    })), completedAt: run.completedAt, isFictional: true };
}
function proofForRun(run, qsoIds) {
  return { runId: run.runId, recordId: `night-record:${run.runId}`, contactIds: run.summary.contactIds, qsoIds,
    windowIds: run.summary.windowIds, personIds: run.summary.personIds, completedAt: run.completedAt };
}
function chronological(left, right) { return left.completedAt.localeCompare(right.completedAt) || left.runId.localeCompare(right.runId); }

export function settleNightOperationsRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeNightOperationsRun(runValue); const settledAt = iso(settledAtValue);
  if (!run || run.phase !== NIGHT_OPERATIONS_PHASES.COMPLETED || !run.summary) return zero(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) return zero(save, "INVALID_SETTLEMENT_TIME");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState")); const chapter = normalizeNightOperationsState(continuation.chapter13);
  if (chapter.settledRunIds.includes(run.runId)) return zero(save, "ALREADY_SETTLED");
  const mission = activeMission(save);
  if (!mission || Date.parse(own(mission, "acceptedAt")) > Date.parse(run.startedAt) || !chapter.activeRun
    || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) return zero(save, "RUN_STATE_MISMATCH");
  const suffix = run.runId.slice("night-operations:".length);
  const qsoIds = run.contacts.map((contact, index) => `night-qso:${suffix}:${index + 1}`);
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs")); const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (qsoIds.some((id) => currentRecords.settledQsoIds.includes(id))) return zero(save, "QSO_ALREADY_SETTLED");
  const logs = run.contacts.map((contact, index) => normalizeQsoLogEntry(qsoCandidate(save, run, contact, qsoIds[index])));
  if (logs.some((log, index) => !log || log.personId !== run.contacts[index].personId || log.stationId !== run.contacts[index].stationId)) return zero(save, "INVALID_QSO");
  let qsoLogs = currentLogs; let operatorRelationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
  for (const log of logs) { qsoLogs = appendQsoLog(qsoLogs, log); operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, log); }
  const qsoRecords = { ...currentRecords, total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + 3),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, "PX"])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, ...qsoIds])].sort() };
  const record = recordForRun(run, qsoIds); const proof = proofForRun(run, qsoIds);
  const chapter13 = normalizeNightOperationsState({ ...chapter, activeRun: null,
    completedRuns: [...chapter.completedRuns, run.summary].sort(chronological),
    settledRunIds: [...chapter.settledRunIds, run.runId].sort(), settlementProofs: [...chapter.settlementProofs, proof].sort(chronological),
    archive: [...chapter.archive, record].sort(chronological) });
  if (!chapter13.settledRunIds.includes(run.runId) || !chapter13.completedRuns.some(({ runId: id }) => id === run.runId)
    || !chapter13.settlementProofs.some(({ runId: id }) => id === run.runId) || !chapter13.archive.some(({ runId: id }) => id === run.runId)) return zero(save, "STATE_REJECTED");
  return { save: { ...save, qsoLogs, qsoRecords, operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION, operatorRelationships,
    storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION, storyContinuationState: Object.freeze({ ...continuation, chapter13 }) },
    settled: true, reason: null, qsoIds, moneyAwarded: 0, technologyPointsAwarded: 0 };
}
