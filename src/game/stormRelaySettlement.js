import { appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords } from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";
import { STORM_RELAY_PHASES, normalizeStormRelayRun, normalizeStormRelayState } from "./stormRelayRun.js";
import { STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState } from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch { return undefined; }
}
function iso(value) { const time = typeof value === "string" && value.length <= 32 ? Date.parse(value) : NaN; return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function count(value) { const number = Number(value); return Number.isFinite(number) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number))) : 0; }
function zero(save, reason) { return { save, settled: false, reason, qsoIds: [], moneyAwarded: 0, technologyPointsAwarded: 0 }; }

function ownArrayTail(value, maximum) {
  if (!Array.isArray(value)) return null;
  let length;
  try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return null; }
  if (!Number.isSafeInteger(length) || length < 0) return null;
  const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    result.push(descriptor.value);
  }
  return result;
}

function activeMission(save) {
  const missions = ownArrayTail(own(own(save, "missionState"), "activeMissions"), 4);
  if (!missions) return null;
  const mission = missions.find((entry) => own(entry, "id") === "story-12");
  const contract = own(mission, "contract");
  return mission && iso(own(mission, "acceptedAt")) && own(contract, "missionPhase") === "fictional-storm-relay"
    ? mission : null;
}

function qsoCandidate(save, run, identity, id) {
  return {
    id, startedAt: run.startedAt, completedAt: run.completedAt, playerCallsign: run.playerCallsign,
    callsign: identity.callsign, proceduralNpcId: identity.npcId,
    personId: identity.personId, stationId: identity.stationId,
    sent: "599", received: "599", location: "PX", distanceKm: 0, frequencyMhz: 21.06,
    basePropagationLevel: 2, finalPropagationLevel: 2, propagationSource: "STORM_RELAY_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"),
    antennaId: String(own(save, "antennaId") ?? "none"), accessoryId: String(own(save, "accessoryId") ?? "none"),
    playerLocationId: String(own(save, "locationId") ?? "unknown"), wpm: 16,
    transmitAccuracy: 100, keyingScore: 100,
    repeatRequests: run.recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: run.recoveryActions.length, cqQuality: 100, copyScore: 100, copyOutcome: "copied",
    operatorProfileId: identity.npcId, operatorProfileRevision: 1, remoteWpm: 16,
    optionalExchangeOutcome: "not-offered", guidanceLevel: "off", visualAssistUsed: false,
    independentWatch: true, attemptHistory: [], rewardBreakdown: null, credits: 0,
    eventId: "chapter-continuation", eventRunId: run.runId, eventMode: "story",
    eventKind: "storm-relay", eventRegionCode: "PX", onAirCallsign: run.playerCallsign,
    operatorCallsign: identity.callsign, isFictional: true,
  };
}

function recordForRun(run, qsoIds) {
  const summary = run.summary;
  return {
    id: `storm-record:${run.runId}`, runId: run.runId, qsoIds, playerCallsign: run.playerCallsign,
    controlPersonId: run.control.personId, controlStationId: run.control.stationId,
    relayPersonId: run.relay.personId, relayStationId: run.relay.stationId,
    canonicalPacketId: summary.canonicalPacketId, msgId: summary.msgId, revision: summary.revision,
    grid: summary.grid, people: summary.people, item: summary.item, quantity: summary.quantity,
    check: summary.check, completedAt: summary.completedAt, isFictional: true,
  };
}

function proofForRun(run, record) {
  return {
    runId: run.runId, recordId: record.id, qsoIds: record.qsoIds,
    playerCallsign: run.playerCallsign,
    controlPersonId: run.control.personId, controlStationId: run.control.stationId,
    relayPersonId: run.relay.personId, relayStationId: run.relay.stationId,
    canonicalPacketId: run.summary.canonicalPacketId, check: run.summary.check,
    completedAt: run.completedAt,
  };
}

function chronological(left, right) { return left.completedAt.localeCompare(right.completedAt) || left.runId.localeCompare(right.runId); }

export function settleStormRelayRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeStormRelayRun(runValue);
  const settledAt = iso(settledAtValue);
  if (!run || run.phase !== STORM_RELAY_PHASES.COMPLETED || !run.summary) return zero(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) return zero(save, "INVALID_SETTLEMENT_TIME");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeStormRelayState(continuation.chapter12);
  if (chapter.settledRunIds.includes(run.runId)) return zero(save, "ALREADY_SETTLED");
  const mission = activeMission(save);
  if (!mission || Date.parse(own(mission, "acceptedAt")) > Date.parse(run.startedAt)
    || !chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) return zero(save, "RUN_STATE_MISMATCH");

  const suffix = run.runId.slice("storm-relay:".length);
  const qsoIds = [`storm-control-qso:${suffix}`, `storm-relay-qso:${suffix}`];
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs"));
  const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (qsoIds.some((id) => currentRecords.settledQsoIds.includes(id))) return zero(save, "QSO_ALREADY_SETTLED");
  const controlLog = normalizeQsoLogEntry(qsoCandidate(save, run, run.control, qsoIds[0]));
  const relayLog = normalizeQsoLogEntry(qsoCandidate(save, run, run.relay, qsoIds[1]));
  if (!controlLog || !relayLog || controlLog.personId !== run.control.personId || relayLog.personId !== run.relay.personId) return zero(save, "INVALID_QSO");
  let qsoLogs = appendQsoLog(currentLogs, controlLog);
  qsoLogs = appendQsoLog(qsoLogs, relayLog);
  const qsoRecords = {
    ...currentRecords,
    total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + 2),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, "PX"])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, ...qsoIds])].sort(),
  };
  let operatorRelationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
  operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, controlLog);
  operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, relayLog);
  const record = recordForRun(run, qsoIds);
  const proof = proofForRun(run, record);
  const chapter12 = normalizeStormRelayState({
    ...chapter, activeRun: null,
    completedRuns: [...chapter.completedRuns, run.summary].sort(chronological),
    settledRunIds: [...chapter.settledRunIds, run.runId].sort(),
    settlementProofs: [...chapter.settlementProofs, proof].sort(chronological),
    archive: [...chapter.archive, record].sort(chronological),
  });
  if (!chapter12.settledRunIds.includes(run.runId)
    || !chapter12.completedRuns.some(({ runId }) => runId === run.runId)
    || !chapter12.settlementProofs.some(({ runId }) => runId === run.runId)
    || !chapter12.archive.some(({ runId }) => runId === run.runId)) return zero(save, "STATE_REJECTED");
  return {
    save: {
      ...save, qsoLogs, qsoRecords,
      operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION, operatorRelationships,
      storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
      storyContinuationState: Object.freeze({ ...continuation, chapter12 }),
    },
    settled: true, reason: null, qsoIds, moneyAwarded: 0, technologyPointsAwarded: 0,
  };
}

export { verifiedStormRelayCompletion } from "./stormRelayCompletion.js";
