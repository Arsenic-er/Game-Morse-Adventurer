export const PERSON_ID_SORA = "person:sora";
export const STATION_ID_SIM6JP = "station:sim6jp";
export const STATION_ID_LIGHTS_SIM5LT = "station:lights-sim5lt";
export const PERSON_ID_FINAL_RECIPIENT = "person:chapter14:final-recipient";
export const STATION_ID_FINAL_RECIPIENT = "station:chapter14:sim14fp";

const MAX_ID_LENGTH = 96;
const MAX_CALLSIGN_LENGTH = 16;
const MAX_NPC_ID_LENGTH = 64;
const PERSON_PROCEDURAL_PREFIX = "person:procedural:";
const STATION_PROCEDURAL_PREFIX = "station:procedural:";

function hash32(value) {
  let hash = 2166136261;
  for (const character of String(value).normalize("NFC")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compactId(prefix, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const maximumValueLength = MAX_ID_LENGTH - prefix.length;
  if (raw.length <= maximumValueLength) return `${prefix}${raw}`;
  const suffix = `-${hash32(raw)}`;
  return `${prefix}${raw.slice(0, maximumValueLength - suffix.length)}${suffix}`;
}

export function normalizeIdentityCallsign(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length <= MAX_CALLSIGN_LENGTH && /^[A-Z0-9][A-Z0-9/-]*$/.test(normalized)
    ? normalized
    : null;
}

function normalizeNpcId(value) {
  if (typeof value !== "string" || value.length > MAX_NPC_ID_LENGTH) return null;
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9:_-]+$/.test(normalized)) return null;
  return normalized;
}

export function normalizePersonId(value) {
  if (typeof value !== "string" || value.length > MAX_ID_LENGTH) return null;
  const normalized = value.trim();
  if ([PERSON_ID_SORA, PERSON_ID_FINAL_RECIPIENT].includes(normalized)) return normalized;
  const procedural = normalized.match(/^person:procedural:([A-Za-z0-9:_-]+)$/);
  if (procedural) return compactId(PERSON_PROCEDURAL_PREFIX, procedural[1]);
  const legacy = normalized.match(/^person:legacy:([A-Z0-9][A-Z0-9/-]*)$/);
  if (legacy && legacy[1].length <= MAX_CALLSIGN_LENGTH) return `person:legacy:${legacy[1]}`;
  return null;
}

export function normalizeStationId(value) {
  if (typeof value !== "string" || value.length > MAX_ID_LENGTH) return null;
  const normalized = value.trim();
  if ([STATION_ID_SIM6JP, STATION_ID_LIGHTS_SIM5LT, STATION_ID_FINAL_RECIPIENT].includes(normalized)) return normalized;
  const procedural = normalized.match(/^station:procedural:([A-Za-z0-9:_-]+)$/);
  if (procedural) return compactId(STATION_PROCEDURAL_PREFIX, procedural[1]);
  const legacy = normalized.match(/^station:legacy:([A-Z0-9][A-Z0-9/-]*)$/);
  if (legacy && legacy[1].length <= MAX_CALLSIGN_LENGTH) return `station:legacy:${legacy[1]}`;
  return null;
}

function ownValue(source, key) {
  return Object.hasOwn(source, key) ? source[key] : undefined;
}

function npcIdFrom(source) {
  return normalizeNpcId(ownValue(source, "npcId"))
    ?? normalizeNpcId(ownValue(source, "proceduralNpcId"));
}

function fixedIdentity(callsign) {
  if (callsign === "SIM6JP") {
    return { personId: PERSON_ID_SORA, stationId: STATION_ID_SIM6JP, callsign };
  }
  if (callsign === "SIM5LT") {
    return { personId: PERSON_ID_SORA, stationId: STATION_ID_LIGHTS_SIM5LT, callsign };
  }
  if (callsign === "SIM14FP") {
    return { personId: PERSON_ID_FINAL_RECIPIENT, stationId: STATION_ID_FINAL_RECIPIENT, callsign };
  }
  return null;
}

function proceduralSuffix(value, prefix) {
  return value?.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function strictIdentity(source) {
  const callsign = normalizeIdentityCallsign(source.callsign ?? source.onAirCallsign);
  if (!callsign) return null;
  const npcId = npcIdFrom(source);
  if (npcId) {
    return {
      personId: compactId(PERSON_PROCEDURAL_PREFIX, npcId),
      stationId: compactId(STATION_PROCEDURAL_PREFIX, npcId),
      callsign,
    };
  }
  const fixed = fixedIdentity(callsign);
  if (fixed) return fixed;
  const suppliedPersonId = normalizePersonId(ownValue(source, "personId"));
  const suppliedStationId = normalizeStationId(ownValue(source, "stationId"));
  const personSuffix = proceduralSuffix(suppliedPersonId, PERSON_PROCEDURAL_PREFIX);
  const stationSuffix = proceduralSuffix(suppliedStationId, STATION_PROCEDURAL_PREFIX);
  if (personSuffix && personSuffix === stationSuffix) {
    return { personId: suppliedPersonId, stationId: suppliedStationId, callsign };
  }
  return {
    personId: `person:legacy:${callsign}`,
    stationId: `station:legacy:${callsign}`,
    callsign,
  };
}

export function personIdForOperator(operator) {
  const source = operator && typeof operator === "object" ? operator : { callsign: operator };
  return strictIdentity(source)?.personId ?? null;
}

export function personIdForPersonOnlyRecord(operator) {
  const source = operator && typeof operator === "object" ? operator : { callsign: operator };
  const callsign = normalizeIdentityCallsign(source.callsign ?? source.onAirCallsign);
  if (!callsign) return null;
  const npcId = npcIdFrom(source);
  if (npcId) return compactId(PERSON_PROCEDURAL_PREFIX, npcId);
  const fixed = fixedIdentity(callsign);
  if (fixed) return fixed.personId;
  const suppliedPersonId = normalizePersonId(ownValue(source, "personId"));
  if (proceduralSuffix(suppliedPersonId, PERSON_PROCEDURAL_PREFIX)) return suppliedPersonId;
  return `person:legacy:${callsign}`;
}

export function stationIdentityForCallsign(value, operator = {}) {
  const source = value && typeof value === "object" ? value : { ...operator, callsign: value };
  const identity = strictIdentity(source);
  return identity ? { stationId: identity.stationId, callsign: identity.callsign } : null;
}
