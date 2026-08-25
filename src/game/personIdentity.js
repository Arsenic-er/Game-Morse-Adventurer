export const PERSON_ID_SORA = "person:sora";
export const STATION_ID_SIM6JP = "station:sim6jp";
export const STATION_ID_LIGHTS_SIM5LT = "station:lights-sim5lt";

const MAX_ID_LENGTH = 96;
const MAX_CALLSIGN_LENGTH = 16;

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
  const normalized = String(value ?? "").trim();
  if (!normalized || !/^[A-Za-z0-9:_-]+$/.test(normalized)) return null;
  return normalized;
}

export function normalizePersonId(value) {
  const normalized = String(value ?? "").trim();
  if (normalized === PERSON_ID_SORA) return normalized;
  const procedural = normalized.match(/^person:procedural:([A-Za-z0-9:_-]+)$/);
  if (procedural) return compactId("person:procedural:", procedural[1]);
  const legacy = normalized.match(/^person:legacy:([A-Z0-9][A-Z0-9/-]*)$/);
  if (legacy && legacy[1].length <= MAX_CALLSIGN_LENGTH) return `person:legacy:${legacy[1]}`;
  return null;
}

export function normalizeStationId(value) {
  const normalized = String(value ?? "").trim();
  if ([STATION_ID_SIM6JP, STATION_ID_LIGHTS_SIM5LT].includes(normalized)) return normalized;
  const procedural = normalized.match(/^station:procedural:([A-Za-z0-9:_-]+)$/);
  if (procedural) return compactId("station:procedural:", procedural[1]);
  const legacy = normalized.match(/^station:legacy:([A-Z0-9][A-Z0-9/-]*)$/);
  if (legacy && legacy[1].length <= MAX_CALLSIGN_LENGTH) return `station:legacy:${legacy[1]}`;
  return null;
}

export function personIdForOperator(operator) {
  const source = operator && typeof operator === "object" ? operator : { callsign: operator };
  const supplied = normalizePersonId(source.personId);
  if (supplied) return supplied;
  const npcId = normalizeNpcId(source.npcId ?? source.proceduralNpcId);
  if (npcId) return compactId("person:procedural:", npcId);
  const callsign = normalizeIdentityCallsign(source.callsign ?? source.onAirCallsign);
  if (!callsign) return null;
  if (callsign === "SIM6JP" || callsign === "SIM5LT") return PERSON_ID_SORA;
  return `person:legacy:${callsign}`;
}

export function stationIdentityForCallsign(value, operator = {}) {
  const source = value && typeof value === "object" ? value : { ...operator, callsign: value };
  const callsign = normalizeIdentityCallsign(source.callsign ?? source.onAirCallsign);
  if (!callsign) return null;
  const supplied = normalizeStationId(source.stationId);
  if (supplied) return { stationId: supplied, callsign };
  const npcId = normalizeNpcId(source.npcId ?? source.proceduralNpcId);
  if (npcId) return { stationId: compactId("station:procedural:", npcId), callsign };
  if (callsign === "SIM6JP") return { stationId: STATION_ID_SIM6JP, callsign };
  if (callsign === "SIM5LT") return { stationId: STATION_ID_LIGHTS_SIM5LT, callsign };
  return {
    stationId: `station:legacy:${callsign}`,
    callsign,
  };
}
