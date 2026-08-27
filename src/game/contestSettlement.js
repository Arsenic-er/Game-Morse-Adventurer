import { appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords } from "../qso/qsoLog.js";
import { OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship } from "../qso/operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { CONTEST_PHASES, normalizeContestRun, normalizeContestState, scoreContestRun } from "./contestRun.js";
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

function qsoCandidate(save, run, contact, qsoId) {
  return {
    id: qsoId, startedAt: run.startedAt, completedAt: contact.completedAt,
    playerCallsign: run.playerCallsign, callsign: contact.callsign,
    proceduralNpcId: contact.npcId, personId: contact.personId, stationId: contact.stationId,
    sent: "599", received: contact.rst, location: contact.regionCode, distanceKm: 0, frequencyMhz: 21.06,
    basePropagationLevel: 3, finalPropagationLevel: 3, propagationSource: "CONTEST_FIXED",
    equipmentId: String(own(save, "equipmentId") ?? "squid-01"), antennaId: String(own(save, "antennaId") ?? "none"),
    accessoryId: String(own(save, "accessoryId") ?? "none"), playerLocationId: String(own(save, "locationId") ?? "unknown"),
    wpm: contact.replyWpm, transmitAccuracy: 100, keyingScore: 100,
    repeatRequests: run.repeatRequests, copyQueries: run.repeatRequests, cqQuality: 100, copyScore: 100, copyOutcome: "copied",
    operatorProfileId: contact.operatorProfileId, operatorProfileRevision: 1, remoteWpm: contact.replyWpm,
    optionalExchangeOutcome: "not-offered", guidanceLevel: "off", visualAssistUsed: false, independentWatch: true,
    attemptHistory: [], rewardBreakdown: null, credits: 0,
    eventId: "chapter-continuation", eventRunId: run.runId, eventMode: "story", eventKind: "contest",
    eventRegionCode: contact.regionCode, onAirCallsign: run.playerCallsign, operatorCallsign: contact.callsign,
    isFictional: true,
  };
}

function verifiedLog(log, proof, runId) {
  const callsign = String(own(log, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
  const claim = log ? { callsign, personId: own(log, "personId"), stationId: own(log, "stationId"), proceduralNpcId: proof.npcId } : null;
  return Boolean(log) && own(log, "id") === proof.qsoId && own(log, "eventKind") === "contest" && own(log, "eventRunId") === runId
    && own(log, "personId") === proof.personId && own(log, "stationId") === proof.stationId && callsign === proof.callsign
    && personIdForOperator(claim) === proof.personId && stationIdentityForCallsign(callsign, claim)?.stationId === proof.stationId
    && own(log, "isFictional") === true && own(log, "eventRegionCode") === proof.regionCode
    && Date.parse(own(log, "completedAt") ?? "") === Date.parse(proof.completedAt) && Number(own(log, "credits")) === 0;
}

export function verifiedContestCompletion(save, active, logs = own(save, "qsoLogs")) {
  try {
    const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
    if (!Number.isFinite(acceptedAt)) return false;
    const baselineRaw = own(active, "baselineContestRunIds");
    const baseline = new Set(Array.isArray(baselineRaw) ? baselineRaw.slice(-100) : []);
    const chapter = normalizeContestState(normalizeStoryContinuationState(own(save, "storyContinuationState")).chapter10);
    const retainedLogs = Array.isArray(logs) ? logs.slice(-200) : [];
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    for (const record of chapter.records) {
      if (baseline.has(record.runId) || !chapter.settledRunIds.includes(record.runId) || Date.parse(record.completedAt) < acceptedAt
        || !["complete", "silver", "gold"].includes(record.grade) || record.validContacts < 6 || record.runContacts < 2 || record.spContacts < 2 || record.uniqueRegions < 3) continue;
      let valid = true;
      for (const proof of record.contacts) {
        const log = retainedLogs.find((entry) => own(entry, "id") === proof.qsoId);
        const relationship = relationships.find((entry) => entry.personId === proof.personId);
        if (!verifiedLog(log, proof, record.runId) || Date.parse(proof.completedAt) < acceptedAt
          || relationship?.completedQsos < 1 || relationship.lastQsoId !== proof.qsoId) { valid = false; break; }
      }
      if (valid && new Set(record.contacts.map(({ personId }) => personId)).size === record.validContacts) return true;
    }
    return false;
  } catch { return false; }
}

export function settleContestRun(save, runValue, settledAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const run = normalizeContestRun(runValue); const settledAt = iso(settledAtValue);
  if (!run || run.phase !== CONTEST_PHASES.COMPLETED) return zero(save, "RUN_NOT_COMPLETED");
  if (!settledAt || Date.parse(settledAt) < Date.parse(run.completedAt)) return zero(save, "INVALID_SETTLEMENT_TIME");
  const scored = scoreContestRun(run);
  if (scored.grade === "none" || scored.facts.validContacts !== run.contacts.length || scored.facts.uniqueContacts !== run.contacts.length) return zero(save, "INVALID_RESULT");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeContestState(continuation.chapter10);
  if (chapter.settledRunIds.includes(run.runId)) return zero(save, "ALREADY_SETTLED");
  if (!chapter.activeRun || chapter.activeRun.runId !== run.runId || !same(chapter.activeRun, run)
    || String(own(save, "callsign") ?? "").trim().toUpperCase() !== run.playerCallsign) return zero(save, "RUN_STATE_MISMATCH");

  const suffix = run.runId.slice("contest:".length);
  const qsoIds = run.contacts.map((contact) => `contest-qso:${suffix}:${String(contact.serialNumber).padStart(3, "0")}`);
  const currentLogs = normalizeQsoLogs(own(save, "qsoLogs"));
  const currentRecords = normalizeQsoRecords(own(save, "qsoRecords"), currentLogs);
  if (qsoIds.some((id) => currentRecords.settledQsoIds.includes(id))) return zero(save, "QSO_ALREADY_SETTLED");
  const logs = run.contacts.map((contact, index) => normalizeQsoLogEntry(qsoCandidate(save, run, contact, qsoIds[index])));
  if (logs.some((log, index) => !log || log.personId !== run.contacts[index].personId || log.stationId !== run.contacts[index].stationId)) return zero(save, "INVALID_QSO");
  let qsoLogs = currentLogs;
  let operatorRelationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
  for (const log of logs) {
    qsoLogs = appendQsoLog(qsoLogs, log);
    operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, log);
  }
  const qsoRecords = {
    ...currentRecords,
    total: Math.min(Number.MAX_SAFE_INTEGER, count(currentRecords.total) + logs.length),
    contactedRegions: [...new Set([...currentRecords.contactedRegions, ...logs.map(({ location }) => location)])].sort(),
    settledQsoIds: [...new Set([...currentRecords.settledQsoIds, ...qsoIds])].sort(),
  };
  const record = {
    id: `contest-record:${suffix}`, runId: run.runId, score: scored.score, grade: scored.grade,
    validContacts: scored.facts.validContacts, uniqueRegions: scored.facts.uniqueRegions,
    runContacts: scored.facts.runContacts, spContacts: scored.facts.spContacts,
    repeatRequests: scored.facts.repeatRequests, bustedCalls: scored.facts.bustedCalls, interruptions: scored.facts.interruptions,
    contactQsoIds: qsoIds,
    contacts: run.contacts.map((contact, index) => ({
      qsoId: qsoIds[index], personId: contact.personId, stationId: contact.stationId, npcId: contact.npcId,
      callsign: contact.callsign, mode: contact.mode, serialNumber: contact.serialNumber,
      regionCode: contact.regionCode, powerWatts: contact.powerWatts, completedAt: contact.completedAt,
    })),
    completedAt: run.completedAt,
  };
  const records = [...chapter.records, record].sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.id.localeCompare(right.id));
  const personalBest = !chapter.personalBest || record.score > chapter.personalBest.score ? record : chapter.personalBest;
  const chapter10 = normalizeContestState({ activeRun: null, records, settledRunIds: [...chapter.settledRunIds, run.runId], personalBest, taskTreeUnlocked: chapter.taskTreeUnlocked });
  const persistedRecord = chapter10.records.find(({ runId }) => runId === run.runId);
  if (!chapter10.settledRunIds.includes(run.runId) || !persistedRecord || persistedRecord.contactQsoIds.length !== qsoIds.length) return zero(save, "STATE_REJECTED");
  return {
    save: { ...save, qsoLogs, qsoRecords, operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION, operatorRelationships, storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION, storyContinuationState: Object.freeze({ ...continuation, chapter10 }) },
    settled: true, reason: null, qsoIds, record: persistedRecord, moneyAwarded: 0, technologyPointsAwarded: 0,
  };
}
