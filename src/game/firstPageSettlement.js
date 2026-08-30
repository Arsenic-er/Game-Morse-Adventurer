import { normalizeQsoLogEntry } from "../qso/qsoLog.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import {
  normalizeFirstPageGoal, normalizeFirstPageProof, normalizeFirstPageRecord,
  normalizeFirstPageState, normalizeFirstPageSummary,
} from "./firstPageState.js";
import { normalizeStoryContinuationState, STORY_CONTINUATION_STATE_VERSION } from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function iso(value) { if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function zero(save, reason) { return { save, settled: false, reason, runId: null, moneyAwarded: 0, technologyPointsAwarded: 0 }; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function ownTail(value, maximum) {
  if (!Array.isArray(value)) return null;
  let length; try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return null; }
  if (!Number.isSafeInteger(length) || length < 0) return null;
  const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    result.push(descriptor.value);
  }
  return result;
}

function activeMission(save) {
  const missions = ownTail(own(own(save, "missionState"), "activeMissions"), 4);
  if (!missions) return null;
  const mission = missions.find((entry) => own(entry, "id") === "story-15");
  const contract = own(mission, "contract");
  return mission && iso(own(mission, "acceptedAt")) && own(contract, "missionPhase") === "ordinary-first-page"
    ? mission : null;
}

function ownStringList(value, maximum, maxLength) {
  const candidates = ownTail(value, maximum); if (!candidates) return null;
  const result = [];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate || candidate.length > maxLength) return null;
    result.push(candidate);
  }
  return result;
}

function settledLedgerContains(save, qsoId) {
  const ids = own(own(save, "qsoRecords"), "settledQsoIds");
  if (!Array.isArray(ids)) return false;
  let length; try { length = Object.getOwnPropertyDescriptor(ids, "length")?.value; } catch { return false; }
  if (!Number.isSafeInteger(length) || length < 1) return false;
  let low = 0; let high = length - 1; let reads = 0;
  while (low <= high && reads < 64) {
    const middle = low + Math.floor((high - low) / 2); let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(ids, String(middle)); } catch { return false; }
    if (!descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string") return false;
    reads += 1;
    if (descriptor.value === qsoId) return true;
    if (descriptor.value < qsoId) low = middle + 1; else high = middle - 1;
  }
  return false;
}

function ordinaryQso(save, active, qsoId) {
  if (typeof qsoId !== "string" || !qsoId || qsoId.length > 96) return null;
  const baseline = ownStringList(own(active, "baselineQsoIds"), 200, 96);
  const rawLogs = ownTail(own(save, "qsoLogs"), 200);
  if (!baseline || !rawLogs || baseline.includes(qsoId)) return null;
  const raw = rawLogs.find((entry) => own(entry, "id") === qsoId);
  const log = normalizeQsoLogEntry(raw);
  const acceptedAt = iso(own(active, "acceptedAt"));
  if (!log || !acceptedAt || Date.parse(log.completedAt) < Date.parse(acceptedAt)
    || log.eventId !== null || log.eventRunId !== null || log.eventKind !== null
    || !Number.isSafeInteger(log.credits) || log.credits <= 0
    || !settledLedgerContains(save, qsoId)) return null;
  const claim = { callsign: log.callsign, personId: log.personId, stationId: log.stationId };
  return personIdForOperator(claim) === log.personId
    && stationIdentityForCallsign(log.callsign, claim)?.stationId === log.stationId ? log : null;
}

export function firstPageCandidate(save) {
  const active = activeMission(save); if (!active) return null;
  const chapter = normalizeFirstPageState(own(own(save, "storyContinuationState"), "chapter15"));
  if (chapter.settledRunIds.length) return null;
  const logs = ownTail(own(save, "qsoLogs"), 200); if (!logs) return null;
  for (const raw of logs) {
    const id = own(raw, "id"); const log = ordinaryQso(save, active, id);
    if (log) return Object.freeze({ qsoId: log.id, callsign: log.callsign, personId: log.personId,
      stationId: log.stationId, location: log.location, completedAt: log.completedAt, credits: log.credits });
  }
  return null;
}

function chronology(left, right) { return left.completedAt.localeCompare(right.completedAt) || left.runId.localeCompare(right.runId); }

export function settleFirstPage(save, input) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const qsoId = own(input, "qsoId"); const goal = normalizeFirstPageGoal(own(input, "goal")); const completedAt = iso(own(input, "completedAt"));
  if (!goal) return zero(save, "INVALID_GOAL");
  if (!completedAt) return zero(save, "INVALID_COMPLETION_TIME");
  const active = activeMission(save); if (!active) return zero(save, "MISSION_NOT_ACTIVE");
  const qso = ordinaryQso(save, active, qsoId); if (!qso) return zero(save, "QSO_NOT_ELIGIBLE");
  if (Date.parse(completedAt) < Date.parse(qso.completedAt)) return zero(save, "INVALID_COMPLETION_TIME");
  const runId = `first-page:${qso.id}`;
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeFirstPageState(continuation.chapter15);
  if (chapter.settledRunIds.includes(runId)) return zero(save, "ALREADY_SETTLED");
  const summary = normalizeFirstPageSummary({ runId, qsoId: qso.id, goal, completedAt });
  const proof = normalizeFirstPageProof({ ...summary, acceptedAt: own(active, "acceptedAt"), qsoCompletedAt: qso.completedAt });
  const record = normalizeFirstPageRecord({ ...summary, callsign: qso.callsign, personId: qso.personId,
    stationId: qso.stationId, location: qso.location, qsoCompletedAt: qso.completedAt });
  if (!summary || !proof || !record) return zero(save, "INVALID_FIRST_PAGE");
  const chapter15 = normalizeFirstPageState({ ...chapter,
    completedRuns: [...chapter.completedRuns, summary].sort(chronology),
    settledRunIds: [...chapter.settledRunIds, runId].sort(),
    settlementProofs: [...chapter.settlementProofs, proof].sort(chronology),
    archive: [...chapter.archive, record].sort(chronology) });
  if (!chapter15.settledRunIds.includes(runId)
    || !chapter15.completedRuns.some((entry) => same(entry, summary))
    || !chapter15.settlementProofs.some((entry) => same(entry, proof))
    || !chapter15.archive.some((entry) => same(entry, record))) return zero(save, "STATE_REJECTED");
  return { save: { ...save, storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
    storyContinuationState: Object.freeze({ ...continuation, chapter15 }) }, settled: true, reason: null,
    runId, moneyAwarded: 0, technologyPointsAwarded: 0 };
}

export function verifiedFirstPageCompletion(save, active) {
  try {
    if (own(active, "id") !== "story-15" || own(own(active, "contract"), "missionPhase") !== "ordinary-first-page") return false;
    const acceptedAt = iso(own(active, "acceptedAt")); if (!acceptedAt) return false;
    const baseline = ownStringList(own(active, "baselineQsoIds"), 200, 96); if (!baseline) return false;
    const chapter = normalizeFirstPageState(own(own(save, "storyContinuationState"), "chapter15"));
    for (const record of chapter.archive) {
      if (baseline.includes(record.qsoId) || Date.parse(record.qsoCompletedAt) < Date.parse(acceptedAt)
        || !chapter.settledRunIds.includes(record.runId)) continue;
      const summary = chapter.completedRuns.find(({ runId }) => runId === record.runId);
      const proof = chapter.settlementProofs.find(({ runId }) => runId === record.runId);
      const qso = ordinaryQso(save, active, record.qsoId);
      if (summary && proof && qso && summary.qsoId === record.qsoId && summary.goal === record.goal
        && summary.completedAt === record.completedAt && proof.qsoId === record.qsoId
        && proof.goal === record.goal && proof.completedAt === record.completedAt
        && proof.acceptedAt === acceptedAt && proof.qsoCompletedAt === record.qsoCompletedAt
        && qso.completedAt === record.qsoCompletedAt && qso.callsign === record.callsign
        && qso.personId === record.personId && qso.stationId === record.stationId
        && qso.location === record.location) return true;
    }
    return false;
  } catch { return false; }
}
