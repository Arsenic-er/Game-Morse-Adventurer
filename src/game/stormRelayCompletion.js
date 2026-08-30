import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { normalizeStormRelayState } from "./stormRelayRun.js";
import { normalizeOperatorRelationships } from "../qso/operatorRelationships.js";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch { return undefined; }
}

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

function iso(value) {
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

function verifiedLog(log, { id, runId, callsign, npcId, personId, stationId, completedAt }) {
  const claim = log ? {
    callsign: own(log, "callsign"), personId: own(log, "personId"), stationId: own(log, "stationId"),
  } : null;
  return Boolean(log) && own(log, "id") === id && own(log, "eventKind") === "storm-relay"
    && own(log, "eventRunId") === runId && own(log, "callsign") === callsign
    && own(log, "operatorProfileId") === npcId && own(log, "personId") === personId
    && own(log, "stationId") === stationId && own(log, "credits") === 0
    && own(log, "isFictional") === true && Date.parse(own(log, "completedAt") ?? "") === Date.parse(completedAt)
    && personIdForOperator(claim) === personId
    && stationIdentityForCallsign(callsign, claim)?.stationId === stationId;
}

export function verifiedStormRelayCompletion(save, active) {
  try {
    if (own(active, "id") !== "story-12") return false;
    const acceptedAt = iso(own(active, "acceptedAt"));
    const contract = own(active, "contract");
    if (!acceptedAt || own(contract, "missionPhase") !== "fictional-storm-relay") return false;
    const baselineValues = ownArrayTail(own(active, "baselineStormRelayRunIds"), 100);
    if (!baselineValues || baselineValues.some((value) => typeof value !== "string" || value.length > 64)) return false;
    const baseline = new Set(baselineValues);
    const chapter = normalizeStormRelayState(own(own(save, "storyContinuationState"), "chapter12"));
    const logs = ownArrayTail(own(save, "qsoLogs"), 200);
    if (!logs) return false;
    const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));
    for (const record of chapter.archive) {
      if (baseline.has(record.runId) || Date.parse(record.completedAt) < Date.parse(acceptedAt)
        || !chapter.settledRunIds.includes(record.runId)) continue;
      const summary = chapter.completedRuns.find(({ runId }) => runId === record.runId);
      const proof = chapter.settlementProofs.find(({ runId }) => runId === record.runId);
      if (!summary || !proof || proof.recordId !== record.id
        || JSON.stringify(proof.qsoIds) !== JSON.stringify(record.qsoIds)
        || summary.canonicalPacketId !== record.canonicalPacketId || summary.check !== record.check
        || summary.completedAt !== record.completedAt || proof.completedAt !== record.completedAt
        || summary.playerCallsign !== record.playerCallsign || proof.playerCallsign !== record.playerCallsign) continue;
      const [controlId, relayId] = record.qsoIds;
      const controlLog = logs.find((entry) => own(entry, "id") === controlId);
      const relayLog = logs.find((entry) => own(entry, "id") === relayId);
      if (!verifiedLog(controlLog, {
        id: controlId, runId: record.runId, callsign: "SIM12CS", npcId: "chapter12-control",
        personId: record.controlPersonId, stationId: record.controlStationId, completedAt: record.completedAt,
      }) || !verifiedLog(relayLog, {
        id: relayId, runId: record.runId, callsign: "SIM12RL", npcId: "chapter12-relay",
        personId: record.relayPersonId, stationId: record.relayStationId, completedAt: record.completedAt,
      })) continue;
      const completedAt = Date.parse(record.completedAt);
      const relationshipValid = [record.controlPersonId, record.relayPersonId].every((personId) => {
        const relationship = relationships.find((entry) => entry.personId === personId);
        return relationship?.completedQsos > 0
          && Date.parse(relationship.firstMetAt) <= completedAt
          && Date.parse(relationship.lastMetAt) >= completedAt;
      });
      if (relationshipValid) return true;
    }
    return false;
  } catch { return false; }
}
