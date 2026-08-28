import {
  appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords,
} from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION,
  normalizeOperatorRelationships,
  recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import {
  SERVICE_NET_PHASES, normalizeServiceNetRun, normalizeServiceNetState,
} from "./serviceNetRun.js";
import {
  STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState,
} from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function iso(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function count(value) {
  const result = Number(value);
  return Number.isFinite(result) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(result))) : 0;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function zeroResult(save, reason) {
  return { save, settled: false, reason, qsoId: null, moneyAwarded: 0, technologyPointsAwarded: 0 };
}

function qsoCandidate(save, run, qsoId) {
  return {
    id: qsoId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    playerCallsign: run.playerCallsign,
    callsign: run.callsign,
    proceduralNpcId: run.npcId,
    personId: run.personId,
    stationId: run.stationId,
    sent: "599",
    received: "599",
    location: "JP",
    distanceKm: 0,
    frequencyMhz: 21.06,
    basePropagationLevel: 3,
    finalPropagationLevel: 3,
    propagationSource: "SERVICE_NET_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"),
    antennaId: String(own(save, "antennaId") ?? "none"),
    accessoryId: String(own(save, "accessoryId") ?? "none"),
    playerLocationId: String(own(save, "locationId") ?? "unknown"),
    wpm: 16,
    transmitAccuracy: 100,
    keyingScore: 100,
    repeatRequests: run.recoveryActions.filter((action) => action === "AGN").length,
    copyQueries: run.recoveryActions.length,
    cqQuality: 100,
    copyScore: 100,
    copyOutcome: "copied",
    operatorProfileId: "chapter08-net-control",
    operatorProfileRevision: 1,
    remoteWpm: run.replyWpm,
    optionalExchangeOutcome: "not-offered",
    guidanceLevel: "off",
    visualAssistUsed: false,
    independentWatch: true,
    attemptHistory: [],
    rewardBreakdown: null,
    credits: 0,
    eventId: "chapter-continuation",
    eventRunId: run.runId,
    eventMode: "story",
    eventKind: "service-net",
    onAirCallsign: run.playerCallsign,
    operatorCallsign: run.callsign,
    isFictional: true,
  };
}

export function verifiedServiceNetCompletion(save, active, logs = own(save, "qsoLogs")) {
  try {
    const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
    if (!Number.isFinite(acceptedAt)) return false;
    const baselineValues = own(active, "baselineServiceNetRunIds");
    const baseline = new Set(Array.isArray(baselineValues) ? baselineValues.slice(-100) : []);
    const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
    const chapter = normalizeServiceNetState(continuation.chapter08);
    const retainedLogs = Array.isArray(logs) ? logs.slice(-200) : [];
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    for (const runId of chapter.settledRunIds) {
      if (baseline.has(runId)) continue;
      const receipts = chapter.receipts.filter((receipt) => receipt.runId === runId);
      if (receipts.length !== 3 || new Set(receipts.map(({ id }) => id)).size !== 3
        || new Set(receipts.map(({ messageId }) => messageId)).size !== 3
        || new Set(receipts.map(({ sequence }) => sequence)).size !== 3) continue;
      const qsoIds = new Set(receipts.map(({ qsoId }) => qsoId));
      if (qsoIds.size !== 1) continue;
      let ordered = true;
      for (let index = 0; index < receipts.length; index += 1) {
        if (Date.parse(receipts[index].completedAt) < acceptedAt
          || (index > 0 && (receipts[index - 1].priority > receipts[index].priority
            || (receipts[index - 1].priority === receipts[index].priority
              && receipts[index - 1].sequence > receipts[index].sequence)))) ordered = false;
      }
      if (!ordered) continue;
      const qsoId = receipts[0].qsoId;
      const log = retainedLogs.find((candidate) => own(candidate, "id") === qsoId);
      const logCallsign = String(own(log, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
      const identityClaim = log ? {
        callsign: logCallsign,
        personId: own(log, "personId"),
        stationId: own(log, "stationId"),
      } : null;
      const verifiedPerson = personIdForOperator(identityClaim);
      const verifiedStation = stationIdentityForCallsign(logCallsign, identityClaim ?? {});
      if (!log || own(log, "eventKind") !== "service-net" || own(log, "eventRunId") !== runId
        || own(log, "personId") !== "person:procedural:chapter08-net-control"
        || own(log, "stationId") !== "station:procedural:chapter08-net-control"
        || verifiedPerson !== own(log, "personId") || verifiedStation?.stationId !== own(log, "stationId")
        || logCallsign !== "SIM8PS" || own(log, "isFictional") !== true
        || Date.parse(own(log, "completedAt") ?? "") !== Date.parse(receipts.at(-1).acknowledgedAt)) continue;
      const relationship = relationships.find((candidate) => candidate.personId === own(log, "personId"));
      const completedAt = Date.parse(receipts.at(-1).acknowledgedAt);
      if (relationship?.callsign === logCallsign && relationship.completedQsos > 0
        && Date.parse(relationship.firstMetAt) <= completedAt
        && Date.parse(relationship.lastMetAt) >= completedAt) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function settleServiceNetRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeServiceNetRun(runValue);
  const settledAt = iso(settledAtValue);
  if (!run || run.phase !== SERVICE_NET_PHASES.COMPLETED || run.receipts.length !== 3) {
    return zeroResult(save, "RUN_NOT_COMPLETED");
  }
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) {
    return zeroResult(save, "INVALID_SETTLEMENT_TIME");
  }

  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeServiceNetState(continuation.chapter08);
  if (chapter.settledRunIds.includes(run.runId)) return zeroResult(save, "ALREADY_SETTLED");
  if (!chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) {
    return zeroResult(save, "RUN_STATE_MISMATCH");
  }

  const qsoId = `service-net-qso:${run.runId.slice("service-net:".length)}`;
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs"));
  const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (currentRecords.settledQsoIds.includes(qsoId)) return zeroResult(save, "QSO_ALREADY_SETTLED");
  const log = normalizeQsoLogEntry(qsoCandidate(save, run, qsoId));
  if (!log || log.personId !== run.personId || log.stationId !== run.stationId) {
    return zeroResult(save, "INVALID_QSO");
  }
  const qsoLogs = appendQsoLog(currentLogs, log);
  const qsoRecords = {
    ...currentRecords,
    total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + 1),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, log.location])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, qsoId])].sort(),
  };
  const operatorRelationships = recordCompletedOperatorRelationship(
    normalizeOperatorRelationships(own(save, "operatorRelationships")),
    log,
  );
  const receipts = run.receipts.map((receipt, index) => {
    const message = run.messages[run.priorityOrder[index]];
    return {
      id: `service-receipt:${run.runId.slice("service-net:".length)}:${String(index + 1).padStart(2, "0")}`,
      runId: run.runId,
      qsoId,
      messageId: message.messageId,
      priority: message.priority,
      sequence: message.sequence,
      people: message.people,
      item: message.item,
      quantity: message.quantity,
      acknowledgedAt: receipt.acknowledgedAt,
      completedAt: receipt.acknowledgedAt,
    };
  });
  const chapter08 = normalizeServiceNetState({
    activeRun: null,
    receipts: [...chapter.receipts, ...receipts].sort((left, right) => (
      Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.id.localeCompare(right.id)
    )),
    settledRunIds: [...chapter.settledRunIds, run.runId],
    taskTreeUnlocked: chapter.taskTreeUnlocked,
  });
  if (!chapter08.settledRunIds.includes(run.runId)
    || chapter08.receipts.filter((candidate) => candidate.runId === run.runId).length !== 3) {
    return zeroResult(save, "STATE_REJECTED");
  }

  return {
    save: {
      ...save,
      qsoLogs,
      qsoRecords,
      operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
      operatorRelationships,
      storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
      storyContinuationState: Object.freeze({ ...continuation, chapter08 }),
    },
    settled: true,
    reason: null,
    qsoId,
    moneyAwarded: 0,
    technologyPointsAwarded: 0,
  };
}
