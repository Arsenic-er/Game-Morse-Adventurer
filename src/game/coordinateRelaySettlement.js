import { appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords } from "../qso/qsoLog.js";
import { OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship } from "../qso/operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { COORDINATE_RELAY_PHASES, coordinatePacketText, normalizeCoordinateRelayRun, normalizeCoordinateRelayState } from "./coordinateRelayRun.js";
import { STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState } from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
function iso(value) { const date = new Date(value); return typeof value === "string" && value.length <= 40 && Number.isFinite(date.getTime()) ? date.toISOString() : null; }
function count(value) { const result = Number(value); return Number.isFinite(result) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(result))) : 0; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function zero(save, reason) { return { save, settled: false, reason, qsoIds: [], moneyAwarded: 0, technologyPointsAwarded: 0 }; }

function qsoCandidate(save, run, identity, id, completedAt, role) {
  return {
    id, startedAt: run.startedAt, completedAt, playerCallsign: run.playerCallsign,
    callsign: identity.callsign, proceduralNpcId: identity.npcId,
    personId: identity.personId, stationId: identity.stationId,
    sent: "599", received: "599", location: "PX", distanceKm: 0, frequencyMhz: 21.06,
    basePropagationLevel: 3, finalPropagationLevel: 3, propagationSource: "COORDINATE_RELAY_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"), antennaId: String(own(save, "antennaId") ?? "none"),
    accessoryId: String(own(save, "accessoryId") ?? "none"), playerLocationId: String(own(save, "locationId") ?? "unknown"),
    wpm: 16, transmitAccuracy: 100, keyingScore: 100, repeatRequests: run.recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: run.recoveryActions.length, cqQuality: 100, copyScore: 100, copyOutcome: "copied",
    operatorProfileId: identity.npcId, operatorProfileRevision: 1, remoteWpm: run.replyWpm,
    optionalExchangeOutcome: "not-offered", guidanceLevel: "off", visualAssistUsed: false, independentWatch: true,
    attemptHistory: [], rewardBreakdown: null, credits: 0, eventId: "chapter-continuation", eventRunId: run.runId,
    eventMode: "story", eventKind: "coordinate-relay", eventRegion: "PX", onAirCallsign: run.playerCallsign,
    operatorCallsign: identity.callsign, isFictional: true, coordinateRelayRole: role,
  };
}

function verifiedLog(log, { id, runId, identity, completedAt }) {
  const callsign = String(own(log, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
  const claim = log ? { callsign, personId: own(log, "personId"), stationId: own(log, "stationId") } : null;
  return Boolean(log) && own(log, "id") === id && own(log, "eventKind") === "coordinate-relay" && own(log, "eventRunId") === runId
    && own(log, "personId") === identity.personId && own(log, "stationId") === identity.stationId && callsign === identity.callsign
    && personIdForOperator(claim) === identity.personId && stationIdentityForCallsign(callsign, claim)?.stationId === identity.stationId
    && own(log, "isFictional") === true && Date.parse(own(log, "completedAt") ?? "") === Date.parse(completedAt);
}

export function verifiedCoordinateRelayCompletion(save, active, logs = own(save, "qsoLogs")) {
  try {
    const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
    if (!Number.isFinite(acceptedAt)) return false;
    const baselineRaw = own(active, "baselineCoordinateRelayRunIds");
    const baseline = new Set(Array.isArray(baselineRaw) ? baselineRaw.slice(-100) : []);
    const chapter = normalizeCoordinateRelayState(normalizeStoryContinuationState(own(save, "storyContinuationState")).chapter09);
    const retainedLogs = Array.isArray(logs) ? logs.slice(-200) : [];
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    for (const packet of chapter.packets) {
      if (baseline.has(packet.runId) || !chapter.settledRunIds.includes(packet.runId) || Date.parse(packet.completedAt) < acceptedAt) continue;
      const sourceIdentity = { callsign: "SIM9CR", personId: packet.sourcePersonId, stationId: packet.sourceStationId };
      const relayIdentity = { callsign: "SIM9RL", personId: packet.relayPersonId, stationId: packet.relayStationId };
      const sourceLog = retainedLogs.find((entry) => own(entry, "id") === packet.sourceQsoId);
      const relayLog = retainedLogs.find((entry) => own(entry, "id") === packet.relayQsoId);
      if (!verifiedLog(sourceLog, { id: packet.sourceQsoId, runId: packet.runId, identity: sourceIdentity, completedAt: packet.sourceCompletedAt })
        || !verifiedLog(relayLog, { id: packet.relayQsoId, runId: packet.runId, identity: relayIdentity, completedAt: packet.completedAt })
        || Date.parse(own(sourceLog, "completedAt") ?? "") < acceptedAt
        || coordinatePacketText(packet.packet) === "") continue;
      const sourceRelationship = relationships.find((entry) => entry.personId === packet.sourcePersonId);
      const relayRelationship = relationships.find((entry) => entry.personId === packet.relayPersonId);
      const sourceCompletedAt = Date.parse(packet.sourceCompletedAt);
      const relayCompletedAt = Date.parse(packet.completedAt);
      if (sourceRelationship?.completedQsos > 0
        && Date.parse(sourceRelationship.firstMetAt) <= sourceCompletedAt
        && Date.parse(sourceRelationship.lastMetAt) >= sourceCompletedAt
        && relayRelationship?.completedQsos > 0
        && Date.parse(relayRelationship.firstMetAt) <= relayCompletedAt
        && Date.parse(relayRelationship.lastMetAt) >= relayCompletedAt) return true;
    }
    return false;
  } catch { return false; }
}

export function settleCoordinateRelayRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeCoordinateRelayRun(runValue); const settledAt = iso(settledAtValue);
  if (!run || run.phase !== COORDINATE_RELAY_PHASES.COMPLETED) return zero(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) return zero(save, "INVALID_SETTLEMENT_TIME");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeCoordinateRelayState(continuation.chapter09);
  if (chapter.settledRunIds.includes(run.runId)) return zero(save, "ALREADY_SETTLED");
  if (!chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) return zero(save, "RUN_STATE_MISMATCH");

  const suffix = run.runId.slice("coordinate-relay:".length);
  const qsoIds = [`coordinate-source-qso:${suffix}`, `coordinate-relay-qso:${suffix}`];
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs"));
  const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (qsoIds.some((id) => currentRecords.settledQsoIds.includes(id))) return zero(save, "QSO_ALREADY_SETTLED");
  const sourceLog = normalizeQsoLogEntry(qsoCandidate(save, run, run.source, qsoIds[0], run.readbackCompletedAt, "source"));
  const relayLog = normalizeQsoLogEntry(qsoCandidate(save, run, run.relay, qsoIds[1], run.completedAt, "relay"));
  if (!sourceLog || !relayLog || sourceLog.personId !== run.source.personId || relayLog.personId !== run.relay.personId) return zero(save, "INVALID_QSO");
  let qsoLogs = appendQsoLog(currentLogs, sourceLog); qsoLogs = appendQsoLog(qsoLogs, relayLog);
  const qsoRecords = { ...currentRecords, total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + 2), contactedRegions: [...new Set([...currentRecords.contactedRegions, "PX"])].sort(), settledQsoIds: [...new Set([...currentRecords.settledQsoIds, ...qsoIds])].sort() };
  let operatorRelationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
  operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, sourceLog);
  operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, relayLog);
  const packetRecord = {
    id: `coordinate-packet:${suffix}`, runId: run.runId, sourceQsoId: qsoIds[0], relayQsoId: qsoIds[1], packet: run.packet,
    readbackAttempts: Math.min(3, run.attempts.filter(({ stage }) => stage === "READBACK").length + 1),
    sourcePersonId: run.source.personId, sourceStationId: run.source.stationId, relayPersonId: run.relay.personId, relayStationId: run.relay.stationId, sourceCompletedAt: run.readbackCompletedAt,
    completedAt: run.completedAt,
  };
  const chapter09 = normalizeCoordinateRelayState({ activeRun: null, packets: [...chapter.packets, packetRecord].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id.localeCompare(b.id)), settledRunIds: [...chapter.settledRunIds, run.runId], toolUnlocked: chapter.toolUnlocked });
  if (!chapter09.settledRunIds.includes(run.runId) || !chapter09.packets.some(({ runId }) => runId === run.runId)) return zero(save, "STATE_REJECTED");
  return {
    save: { ...save, qsoLogs, qsoRecords, operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION, operatorRelationships, storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION, storyContinuationState: Object.freeze({ ...continuation, chapter09 }) },
    settled: true, reason: null, qsoIds, moneyAwarded: 0, technologyPointsAwarded: 0,
  };
}
