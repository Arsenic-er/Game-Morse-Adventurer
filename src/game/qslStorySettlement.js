import {
  appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords,
} from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION,
  normalizeOperatorRelationships,
  recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";
import { normalizeQslRecords, verifiedExpeditionQslRecords } from "./qslRecords.js";
import {
  QSL_STORY_PHASES,
  normalizeQslStoryRun,
  normalizeQslStoryState,
} from "./qslStoryRun.js";
import {
  STORY_CONTINUATION_STATE_VERSION,
  normalizeStoryContinuationState,
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

function boundedCount(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number)))
    : 0;
}

function hash32(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function boundedLinkedId(prefix, value, maximum) {
  const full = `${prefix}${value}`;
  if (full.length <= maximum) return full;
  const suffix = `-${hash32(value)}`;
  return `${prefix}${String(value).slice(0, maximum - prefix.length - suffix.length)}${suffix}`;
}

function zeroResult(save, reason) {
  return {
    save,
    settled: false,
    reason,
    qsoId: null,
    moneyAwarded: 0,
    technologyPointsAwarded: 0,
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function qsoCandidate(save, run, qsoId) {
  return {
    id: qsoId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    playerCallsign: run.playerCallsign,
    callsign: run.callsign,
    personId: run.personId,
    stationId: run.stationId,
    sent: "599",
    received: "599",
    location: "JP",
    distanceKm: 0,
    frequencyMhz: 14.06,
    basePropagationLevel: 3,
    finalPropagationLevel: 3,
    propagationSource: "QSL_STORY_FIXED",
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
    operatorProfileId: "sora-patient-mentor",
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
    eventKind: "qsl-story",
    onAirCallsign: run.playerCallsign,
    operatorCallsign: run.callsign,
    isFictional: true,
  };
}

function linkedSourceQsl(records, run) {
  return records.find((record) => (
    record.id === run.sourceQslId
    && record.qsoId === run.sourceQsoId
    && record.eventRunId === run.sourceEventRunId
    && record.personId === run.personId
    && record.stationId === run.stationId
    && record.callsign === run.callsign
    && record.choice === run.initialChoice
  )) ?? null;
}

export function settleQslStoryRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) {
    throw new TypeError("A save record is required.");
  }
  const run = normalizeQslStoryRun(runValue);
  const settledAt = iso(settledAtValue);
  if (!run || run.phase !== QSL_STORY_PHASES.COMPLETED) return zeroResult(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) {
    return zeroResult(save, "INVALID_SETTLEMENT_TIME");
  }

  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = continuation.chapter07;
  if (chapter.settledRunIds.includes(run.runId)) return zeroResult(save, "ALREADY_SETTLED");
  if (!chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) {
    return zeroResult(save, "RUN_STATE_MISMATCH");
  }
  const sourceRecords = normalizeQslRecords(own(save, "qslRecords"));
  if (!linkedSourceQsl(sourceRecords, run)) return zeroResult(save, "SOURCE_QSL_MISSING");
  if (!linkedSourceQsl(verifiedExpeditionQslRecords(save), run)) {
    return zeroResult(save, "SOURCE_QSL_UNVERIFIED");
  }

  const qsoId = boundedLinkedId("qsl-story-qso:", run.runId, 96);
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs"));
  const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (currentRecords.settledQsoIds.includes(qsoId)) return zeroResult(save, "QSO_ALREADY_SETTLED");
  const log = normalizeQsoLogEntry(qsoCandidate(save, run, qsoId));
  if (!log) return zeroResult(save, "INVALID_QSO");
  const qsoLogs = appendQsoLog(currentLogs, log);
  const qsoRecords = {
    ...currentRecords,
    total: Math.min(Number.MAX_SAFE_INTEGER, boundedCount(currentRecords.total) + 1),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, log.location])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, qsoId])].sort(),
  };
  const operatorRelationships = recordCompletedOperatorRelationship(
    normalizeOperatorRelationships(own(save, "operatorRelationships")),
    log,
  );
  const qslCase = {
    id: boundedLinkedId("qsl-case:", run.runId, 128),
    runId: run.runId,
    sourceQslId: run.sourceQslId,
    qsoId,
    personId: run.personId,
    stationId: run.stationId,
    initialChoice: run.initialChoice,
    finalChoice: run.finalChoice,
    completedAt: run.completedAt,
  };
  const cases = [...chapter.cases, qslCase].sort((left, right) => (
    Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.id.localeCompare(right.id)
  ));
  const chapter07 = normalizeQslStoryState({
    activeRun: null,
    cases,
    settledRunIds: [...chapter.settledRunIds, run.runId],
    peopleTaskTreeUnlocked: chapter.peopleTaskTreeUnlocked,
  });
  if (!chapter07.settledRunIds.includes(run.runId)
    || !chapter07.cases.some((candidate) => candidate.runId === run.runId)) {
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
      storyContinuationState: Object.freeze({ ...continuation, chapter07 }),
    },
    settled: true,
    reason: null,
    qsoId,
    moneyAwarded: 0,
    technologyPointsAwarded: 0,
  };
}
