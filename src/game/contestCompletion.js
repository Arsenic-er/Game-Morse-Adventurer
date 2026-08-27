import { normalizeOperatorRelationships } from "../qso/operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { normalizeContestState } from "./contestRun.js";
import { normalizeStoryContinuationState } from "./storyContinuationState.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
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
