import {
  LISTENING_PHASES, normalizeListeningRun, normalizeListeningState,
} from "./listeningRun.js";
import {
  STORY_CONTINUATION_STATE_VERSION, normalizeStoryContinuationState,
} from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function iso(value) {
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function zeroResult(save, reason) {
  return {
    save,
    settled: false,
    reason,
    moneyAwarded: 0,
    technologyPointsAwarded: 0,
  };
}

function ownArrayTail(value, maximum) {
  if (!Array.isArray(value)) return null;
  let lengthDescriptor;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return null;
  }
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length < 0) return null;
  const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return null;
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    result.push(descriptor.value);
  }
  return result;
}

function activeListeningMission(save) {
  const missions = ownArrayTail(own(own(save, "missionState"), "activeMissions"), 4);
  if (!missions) return null;
  for (const mission of missions) {
    if (own(mission, "id") !== "story-11") continue;
    const acceptedAt = iso(own(mission, "acceptedAt"));
    const contract = own(mission, "contract");
    if (
      acceptedAt
      && own(contract, "missionPhase") === "listening-silence"
      && own(contract, "targetCallsign") === "SIM11LS"
    ) return mission;
    return null;
  }
  return null;
}

function recordForRun(run) {
  return {
    id: `listening-record:${run.runId}`,
    runId: run.runId,
    playerCallsign: run.playerCallsign,
    targetCallsign: run.targetCallsign,
    stationId: run.stationId,
    personId: run.personId,
    observationIds: [...run.summary.observationIds],
    callCount: run.summary.callCount,
    activeMilliseconds: run.summary.activeMilliseconds,
    conclusionKey: run.summary.conclusionKey,
    completedAt: run.summary.completedAt,
  };
}

function proofForRun(run, recordId) {
  return {
    runId: run.runId,
    recordId,
    playerCallsign: run.playerCallsign,
    targetCallsign: run.targetCallsign,
    stationId: run.stationId,
    personId: run.personId,
    observationCount: run.summary.observationIds.length,
    callCount: run.summary.callCount,
    conclusionKey: run.summary.conclusionKey,
    completedAt: run.summary.completedAt,
  };
}

function chronological(left, right) {
  return left.completedAt.localeCompare(right.completedAt) || left.runId.localeCompare(right.runId);
}

export function settleListeningRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) {
    throw new TypeError("A save record is required.");
  }
  const run = normalizeListeningRun(runValue);
  const settledAt = iso(settledAtValue);
  if (!run || run.phase !== LISTENING_PHASES.COMPLETED || !run.summary) {
    return zeroResult(save, "RUN_NOT_COMPLETED");
  }
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) {
    return zeroResult(save, "INVALID_SETTLEMENT_TIME");
  }
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeListeningState(continuation.chapter11);
  if (chapter.settledRunIds.includes(run.runId)) return zeroResult(save, "ALREADY_SETTLED");
  const activeMission = activeListeningMission(save);
  if (
    !activeMission
    || Date.parse(own(activeMission, "acceptedAt")) > Date.parse(run.startedAt)
    || !chapter.activeRun
    || chapter.activeRun.runId !== run.runId
    || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign
  ) return zeroResult(save, "RUN_STATE_MISMATCH");

  const record = recordForRun(run);
  const proof = proofForRun(run, record.id);
  const chapter11 = normalizeListeningState({
    ...chapter,
    activeRun: null,
    completedRuns: [...chapter.completedRuns, run.summary].sort(chronological),
    settledRunIds: [...chapter.settledRunIds, run.runId].sort(),
    settlementProofs: [...chapter.settlementProofs, proof].sort(chronological),
    archive: [...chapter.archive, record].sort(chronological),
  });
  if (
    !chapter11.settledRunIds.includes(run.runId)
    || !chapter11.completedRuns.some((entry) => entry.runId === run.runId)
    || !chapter11.settlementProofs.some((entry) => entry.runId === run.runId)
    || !chapter11.archive.some((entry) => entry.runId === run.runId)
  ) return zeroResult(save, "STATE_REJECTED");

  return {
    save: {
      ...save,
      storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
      storyContinuationState: Object.freeze({ ...continuation, chapter11 }),
    },
    settled: true,
    reason: null,
    moneyAwarded: 0,
    technologyPointsAwarded: 0,
  };
}

export { verifiedListeningCompletion } from "./listeningCompletion.js";
