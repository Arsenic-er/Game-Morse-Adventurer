import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { normalizeNightOperationsState } from "./nightOperationsRun.js";
import { normalizeOperatorRelationships } from "../qso/operatorRelationships.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function iso(value) { if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
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
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function verifiedLog(log, contact, runId, playerCallsign) {
  if (!log || own(log, "id") !== contact.qsoId || own(log, "eventKind") !== "night-operations"
    || own(log, "eventRunId") !== runId || own(log, "callsign") !== contact.callsign
    || own(log, "operatorProfileId") !== contact.npcId || own(log, "personId") !== contact.personId
    || own(log, "stationId") !== contact.stationId || own(log, "playerCallsign") !== playerCallsign
    || own(log, "credits") !== 0 || own(log, "isFictional") !== true
    || Date.parse(own(log, "completedAt") ?? "") !== Date.parse(contact.completedAt)) return false;
  const claim = { callsign: contact.callsign, personId: own(log, "personId"), stationId: own(log, "stationId"),
    ...(contact.personId === "person:sora" ? {} : { proceduralNpcId: contact.npcId }) };
  return personIdForOperator(claim) === contact.personId
    && stationIdentityForCallsign(contact.callsign, claim)?.stationId === contact.stationId;
}

export function verifiedNightOperationsCompletion(save, active) {
  try {
    if (own(active, "id") !== "story-13") return false;
    const acceptedAt = iso(own(active, "acceptedAt")); const contract = own(active, "contract");
    if (!acceptedAt || own(contract, "missionPhase") !== "night-operations" || own(contract, "requiredDistinctOperators") !== 3) return false;
    const baselineValues = ownArrayTail(own(active, "baselineNightOperationsRunIds"), 100);
    if (!baselineValues || baselineValues.some((value) => typeof value !== "string" || value.length > 64)) return false;
    const baseline = new Set(baselineValues); const chapter = normalizeNightOperationsState(own(own(save, "storyContinuationState"), "chapter13"));
    const logs = ownArrayTail(own(save, "qsoLogs"), 200); if (!logs) return false;
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    for (const record of chapter.archive) {
      if (baseline.has(record.runId) || Date.parse(record.completedAt) < Date.parse(acceptedAt) || !chapter.settledRunIds.includes(record.runId)) continue;
      const summary = chapter.completedRuns.find(({ runId }) => runId === record.runId);
      const proof = chapter.settlementProofs.find(({ runId }) => runId === record.runId);
      if (!summary || !proof || proof.recordId !== record.id || proof.completedAt !== record.completedAt
        || summary.completedAt !== record.completedAt || summary.playerCallsign !== record.playerCallsign
        || summary.scheduleSeed !== record.scheduleSeed || !same(summary.contactIds, proof.contactIds)
        || !same(summary.windowIds, proof.windowIds) || !same(summary.personIds, proof.personIds)
        || !same(proof.qsoIds, record.contacts.map(({ qsoId }) => qsoId))
        || !same(proof.contactIds, record.contacts.map(({ contactId }) => contactId))
        || !same(proof.windowIds, record.contacts.map(({ windowId }) => windowId))
        || !same(proof.personIds, record.contacts.map(({ personId }) => personId))) continue;
      if (!record.contacts.every((contact) => verifiedLog(logs.find((entry) => own(entry, "id") === contact.qsoId), contact, record.runId, record.playerCallsign))) continue;
      const relationshipsValid = record.contacts.every(({ personId, completedAt }) => {
        const relation = relationships.find((entry) => entry.personId === personId);
        const contactTime = Date.parse(completedAt);
        return relation?.completedQsos > 0 && Date.parse(relation.firstMetAt) <= contactTime && Date.parse(relation.lastMetAt) >= contactTime;
      });
      if (relationshipsValid) return true;
    }
    return false;
  } catch { return false; }
}
