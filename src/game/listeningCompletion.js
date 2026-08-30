import { normalizeListeningState } from "./listeningRun.js";

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

function matchingSummaryRecordProof(chapter, runId) {
  const summary = chapter.completedRuns.find((entry) => entry.runId === runId);
  const record = chapter.archive.find((entry) => entry.runId === runId);
  const proof = chapter.settlementProofs.find((entry) => entry.runId === runId);
  if (!summary || !record || !proof || !chapter.settledRunIds.includes(runId)) return false;
  return proof.recordId === record.id
    && summary.playerCallsign === record.playerCallsign && proof.playerCallsign === record.playerCallsign
    && summary.targetCallsign === record.targetCallsign && proof.targetCallsign === record.targetCallsign
    && summary.stationId === record.stationId && proof.stationId === record.stationId
    && summary.personId === record.personId && proof.personId === record.personId
    && summary.callCount === record.callCount && proof.callCount === record.callCount
    && summary.activeMilliseconds === record.activeMilliseconds
    && summary.conclusionKey === record.conclusionKey && proof.conclusionKey === record.conclusionKey
    && summary.completedAt === record.completedAt && proof.completedAt === record.completedAt
    && same(summary.observationIds, record.observationIds)
    && proof.observationCount === record.observationIds.length;
}

export function verifiedListeningCompletion(save, active) {
  try {
    if (own(active, "id") !== "story-11") return false;
    const acceptedAt = iso(own(active, "acceptedAt"));
    const contract = own(active, "contract");
    if (
      !acceptedAt
      || own(contract, "missionPhase") !== "listening-silence"
      || own(contract, "targetCallsign") !== "SIM11LS"
    ) return false;
    const baselineValues = ownArrayTail(own(active, "baselineListeningRunIds"), 100);
    if (!baselineValues || baselineValues.some((value) => typeof value !== "string" || value.length > 64)) return false;
    const baseline = new Set(baselineValues);
    const chapter = normalizeListeningState(own(own(save, "storyContinuationState"), "chapter11"));
    for (const record of chapter.archive) {
      if (
        baseline.has(record.runId)
        || Date.parse(record.completedAt) < Date.parse(acceptedAt)
        || !matchingSummaryRecordProof(chapter, record.runId)
      ) continue;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
