export const OPERATOR_RELATIONSHIPS_VERSION = 1;
export const MAX_OPERATOR_RELATIONSHIPS = 2000;

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

function callsign(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9/-]/g, "").slice(0, 16);
}

function topicCounts(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(RELATIONSHIP_TOPICS
    .map((topic) => [topic, boundedCount(source[topic])])
    .filter(([, count]) => count > 0));
}

export function normalizeOperatorRelationship(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const normalizedCallsign = callsign(candidate.callsign);
  const firstMetAt = iso(candidate.firstMetAt);
  const lastMetAt = iso(candidate.lastMetAt);
  if (!normalizedCallsign || !firstMetAt || !lastMetAt) return null;
  const chronologicalFirst = Date.parse(firstMetAt) <= Date.parse(lastMetAt) ? firstMetAt : lastMetAt;
  const chronologicalLast = Date.parse(firstMetAt) <= Date.parse(lastMetAt) ? lastMetAt : firstMetAt;
  const completedQsos = boundedCount(candidate.completedQsos);
  return {
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

export function normalizeOperatorRelationships(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const candidate of value) {
    const relationship = normalizeOperatorRelationship(candidate);
    if (!relationship) continue;
    const previous = unique.get(relationship.callsign);
    if (!previous || Date.parse(relationship.lastMetAt) >= Date.parse(previous.lastMetAt)) {
      unique.set(relationship.callsign, relationship);
    }
  }
  return [...unique.values()]
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
  const normalizedCallsign = callsign(callsignValue);
  const normalizedStartedAt = iso(startedAt);
  return normalizedCallsign && normalizedStartedAt ? `${normalizedCallsign}:${normalizedStartedAt}` : null;
}

export function recordOperatorEncounter(value, npc, observedAt, encounterId = null) {
  const metAt = iso(observedAt);
  const normalizedCallsign = callsign(npc?.callsign);
  const id = String(encounterId ?? operatorEncounterId(normalizedCallsign, metAt) ?? "").trim().slice(0, 128);
  if (!metAt || !normalizedCallsign || !id) throw new TypeError("A dated operator encounter is required.");
  const relationships = normalizeOperatorRelationships(value);
  const previous = relationships.find((entry) => entry.callsign === normalizedCallsign);
  if (previous?.lastEncounterId === id) return relationships;
  const next = {
    callsign: normalizedCallsign,
    operatorProfileId: String(npc?.operatorProfileId ?? previous?.operatorProfileId ?? "legacy-standard"),
    encounterCount: boundedCount(previous?.encounterCount) + 1,
    completedQsos: boundedCount(previous?.completedQsos),
    weakSignalRecoveries: boundedCount(previous?.weakSignalRecoveries),
    topicCounts: previous?.topicCounts ?? {},
    firstMetAt: previous?.firstMetAt ?? metAt,
    lastMetAt: metAt,
    lastEncounterId: id,
    lastQsoId: previous?.lastQsoId ?? null,
  };
  return normalizeOperatorRelationships([next, ...relationships.filter((entry) => entry.callsign !== normalizedCallsign)]);
}

export function recordCompletedOperatorRelationship(value, log) {
  const completedAt = iso(log?.completedAt);
  const normalizedCallsign = callsign(log?.callsign);
  if (!completedAt || !normalizedCallsign || !log?.id) {
    throw new TypeError("A completed QSO log is required to update an operator relationship.");
  }
  const relationships = normalizeOperatorRelationships(value);
  const previous = relationships.find((entry) => entry.callsign === normalizedCallsign);
  if (previous?.lastQsoId === log.id) return relationships;
  const encounterId = operatorEncounterId(normalizedCallsign, log.startedAt);
  const alreadyEncountered = encounterId && previous?.lastEncounterId === encounterId;
  const topic = log.optionalExchangeOutcome === "answered"
    && RELATIONSHIP_TOPICS.includes(log.optionalExchangeQuestion)
    ? log.optionalExchangeQuestion
    : null;
  const next = {
    callsign: normalizedCallsign,
    operatorProfileId: String(log.operatorProfileId ?? previous?.operatorProfileId ?? "legacy-standard"),
    encounterCount: boundedCount(previous?.encounterCount) + (alreadyEncountered ? 0 : 1),
    completedQsos: boundedCount(previous?.completedQsos) + 1,
    weakSignalRecoveries: boundedCount(previous?.weakSignalRecoveries) + (recoveredWeakSignal(log) ? 1 : 0),
    topicCounts: {
      ...(previous?.topicCounts ?? {}),
      ...(topic ? { [topic]: boundedCount(previous?.topicCounts?.[topic]) + 1 } : {}),
    },
    firstMetAt: previous?.firstMetAt ?? completedAt,
    lastMetAt: completedAt,
    lastEncounterId: encounterId ?? previous?.lastEncounterId ?? null,
    lastQsoId: String(log.id),
  };
  return normalizeOperatorRelationships([next, ...relationships.filter((entry) => entry.callsign !== normalizedCallsign)]);
}
