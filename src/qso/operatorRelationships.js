import { personIdForOperator, personIdForPersonOnlyRecord } from "../game/personIdentity.js";

export const OPERATOR_RELATIONSHIPS_VERSION = 2;
export const MAX_OPERATOR_RELATIONSHIPS = 2000;
const MAX_OPERATOR_RELATIONSHIP_INPUTS = MAX_OPERATOR_RELATIONSHIPS * 4;

const RELATIONSHIP_TOPICS = Object.freeze([
  "power", "location", "weather", "name", "age", "rig", "antenna",
]);

function boundedCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric)))
    : 0;
}

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function boundedSum(left, right) {
  return boundedCount(boundedCount(left) + boundedCount(right));
}

function relationshipCallsign(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9/-]/g, "").slice(0, 16) || null;
}

function topicCounts(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(RELATIONSHIP_TOPICS
    .map((topic) => [topic, boundedCount(source[topic])])
    .filter(([, count]) => count > 0));
}

export function normalizeOperatorRelationship(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const normalizedCallsign = relationshipCallsign(candidate.callsign);
  const personId = personIdForPersonOnlyRecord({ ...candidate, callsign: normalizedCallsign });
  const firstMetAt = iso(candidate.firstMetAt);
  const lastMetAt = iso(candidate.lastMetAt);
  if (!personId || !normalizedCallsign || !firstMetAt || !lastMetAt) return null;
  const chronologicalFirst = Date.parse(firstMetAt) <= Date.parse(lastMetAt) ? firstMetAt : lastMetAt;
  const chronologicalLast = Date.parse(firstMetAt) <= Date.parse(lastMetAt) ? lastMetAt : firstMetAt;
  const completedQsos = boundedCount(candidate.completedQsos);
  return {
    personId,
    callsign: normalizedCallsign,
    operatorProfileId: String(candidate.operatorProfileId ?? "legacy-standard").trim().slice(0, 48) || "legacy-standard",
    encounterCount: Math.max(completedQsos, boundedCount(candidate.encounterCount)),
    completedQsos,
    weakSignalRecoveries: Math.min(completedQsos, boundedCount(candidate.weakSignalRecoveries)),
    topicCounts: topicCounts(candidate.topicCounts),
    firstMetAt: chronologicalFirst,
    lastMetAt: chronologicalLast,
    lastEncounterId: String(candidate.lastEncounterId ?? "").trim().slice(0, 128) || null,
    lastQsoId: String(candidate.lastQsoId ?? "").trim().slice(0, 96) || null,
  };
}

function mergeTopicCounts(left, right) {
  return Object.fromEntries(RELATIONSHIP_TOPICS.map((topic) => [
    topic, boundedSum(left?.[topic], right?.[topic]),
  ]).filter(([, count]) => count > 0));
}

function mergeDifferentCallsignRows(left, right) {
  const latest = Date.parse(right.lastMetAt) >= Date.parse(left.lastMetAt) ? right : left;
  const earliest = Date.parse(right.firstMetAt) < Date.parse(left.firstMetAt) ? right : left;
  const latestQso = [left, right]
    .filter((entry) => entry.lastQsoId)
    .sort((a, b) => Date.parse(b.lastMetAt) - Date.parse(a.lastMetAt))[0];
  const completedQsos = boundedSum(left.completedQsos, right.completedQsos);
  return {
    personId: left.personId,
    callsign: latest.callsign,
    operatorProfileId: latest.operatorProfileId,
    encounterCount: Math.max(completedQsos, boundedSum(left.encounterCount, right.encounterCount)),
    completedQsos,
    weakSignalRecoveries: Math.min(
      completedQsos,
      boundedSum(left.weakSignalRecoveries, right.weakSignalRecoveries),
    ),
    topicCounts: mergeTopicCounts(left.topicCounts, right.topicCounts),
    firstMetAt: earliest.firstMetAt,
    lastMetAt: latest.lastMetAt,
    lastEncounterId: latest.lastEncounterId,
    lastQsoId: latestQso?.lastQsoId ?? null,
  };
}

export function normalizeOperatorRelationships(value) {
  if (!Array.isArray(value)) return [];
  const aliases = new Map();
  for (const candidate of value.slice(-MAX_OPERATOR_RELATIONSHIP_INPUTS)) {
    const relationship = normalizeOperatorRelationship(candidate);
    if (!relationship) continue;
    const aliasKey = `${relationship.personId}\u0000${relationship.callsign}`;
    const previous = aliases.get(aliasKey);
    if (!previous || Date.parse(relationship.lastMetAt) >= Date.parse(previous.lastMetAt)) {
      aliases.set(aliasKey, relationship);
    }
  }
  const people = new Map();
  for (const relationship of aliases.values()) {
    const previous = people.get(relationship.personId);
    people.set(
      relationship.personId,
      previous ? mergeDifferentCallsignRows(previous, relationship) : relationship,
    );
  }
  return [...people.values()]
    .sort((left, right) => Date.parse(right.lastMetAt) - Date.parse(left.lastMetAt)
      || left.callsign.localeCompare(right.callsign))
    .slice(0, MAX_OPERATOR_RELATIONSHIPS);
}

function recoveredWeakSignal(log) {
  const level = Number(log?.finalPropagationLevel);
  const queried = boundedCount(log?.copyQueries) > 0
    || boundedCount(log?.repeatRequests) > 0
    || (Array.isArray(log?.attemptHistory) && log.attemptHistory.some((attempt) => (
      attempt?.remoteOutcome === "query" || attempt?.remoteOutcome === "unreadable"
    )));
  return Number.isFinite(level) && level >= 0 && level <= 2
    && log?.copyOutcome === "copied" && queried;
}

export function operatorEncounterId(callsignValue, startedAt) {
  const normalizedCallsign = relationshipCallsign(callsignValue);
  const normalizedStartedAt = iso(startedAt);
  return normalizedCallsign && normalizedStartedAt ? `${normalizedCallsign}:${normalizedStartedAt}` : null;
}

export function recordOperatorEncounter(value, npc, observedAt, encounterId = null) {
  const metAt = iso(observedAt);
  const normalizedCallsign = relationshipCallsign(npc?.callsign);
  const personId = personIdForOperator({ ...npc, callsign: normalizedCallsign });
  const id = String(encounterId ?? operatorEncounterId(normalizedCallsign, metAt) ?? "").trim().slice(0, 128);
  if (!metAt || !normalizedCallsign || !personId || !id) throw new TypeError("A dated operator encounter is required.");
  const relationships = normalizeOperatorRelationships(value);
  const previous = relationships.find((entry) => entry.personId === personId);
  if (previous?.lastEncounterId === id) return relationships;
  const next = {
    personId,
    callsign: normalizedCallsign,
    operatorProfileId: String(npc?.operatorProfileId ?? previous?.operatorProfileId ?? "legacy-standard"),
    encounterCount: boundedSum(previous?.encounterCount, 1),
    completedQsos: boundedCount(previous?.completedQsos),
    weakSignalRecoveries: boundedCount(previous?.weakSignalRecoveries),
    topicCounts: previous?.topicCounts ?? {},
    firstMetAt: previous?.firstMetAt ?? metAt,
    lastMetAt: metAt,
    lastEncounterId: id,
    lastQsoId: previous?.lastQsoId ?? null,
  };
  return normalizeOperatorRelationships([next, ...relationships.filter((entry) => entry.personId !== personId)]);
}

export function recordCompletedOperatorRelationship(value, log) {
  const completedAt = iso(log?.completedAt);
  const normalizedCallsign = relationshipCallsign(log?.callsign);
  const personId = personIdForOperator({ ...log, callsign: normalizedCallsign });
  if (!completedAt || !normalizedCallsign || !personId || !log?.id) {
    throw new TypeError("A completed QSO log is required to update an operator relationship.");
  }
  const relationships = normalizeOperatorRelationships(value);
  const previous = relationships.find((entry) => entry.personId === personId);
  if (previous?.lastQsoId === log.id) return relationships;
  const encounterId = operatorEncounterId(normalizedCallsign, log.startedAt);
  const alreadyEncountered = encounterId && previous?.lastEncounterId === encounterId;
  const topic = log.optionalExchangeOutcome === "answered"
    && RELATIONSHIP_TOPICS.includes(log.optionalExchangeQuestion)
    ? log.optionalExchangeQuestion
    : null;
  const next = {
    personId,
    callsign: normalizedCallsign,
    operatorProfileId: String(log.operatorProfileId ?? previous?.operatorProfileId ?? "legacy-standard"),
    encounterCount: boundedSum(previous?.encounterCount, alreadyEncountered ? 0 : 1),
    completedQsos: boundedSum(previous?.completedQsos, 1),
    weakSignalRecoveries: boundedSum(previous?.weakSignalRecoveries, recoveredWeakSignal(log) ? 1 : 0),
    topicCounts: {
      ...(previous?.topicCounts ?? {}),
      ...(topic ? { [topic]: boundedSum(previous?.topicCounts?.[topic], 1) } : {}),
    },
    firstMetAt: previous?.firstMetAt ?? completedAt,
    lastMetAt: completedAt,
    lastEncounterId: encounterId ?? previous?.lastEncounterId ?? null,
    lastQsoId: String(log.id),
  };
  return normalizeOperatorRelationships([next, ...relationships.filter((entry) => entry.personId !== personId)]);
}
