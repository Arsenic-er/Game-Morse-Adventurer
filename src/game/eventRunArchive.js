import { LOCATIONS } from "./locations.js";
import { stationCalendarDate } from "./worldCalendar.js";
import {
  personIdForOperator,
  stationIdentityForCallsign,
} from "./personIdentity.js";

export const EVENT_RUN_ARCHIVE_VERSION = 1;
export const MAX_EVENT_RUN_CONTACTS = 7;
export const MAX_ANNUAL_EVENT_RUNS = 20;
export const MAX_PRACTICE_EVENT_RUNS = 31;

const MAX_ARCHIVE_INPUT_MULTIPLIER = 4;
const MODES = new Set(["story", "annual", "practice"]);
const GRADES = Object.freeze({ none: 0, base: 1, silver: 2, gold: 3 });
const STAMPS = new Set(["none", "standard", "special"]);
export const FICTIONAL_WEATHER_CODES = Object.freeze([
  "clear", "cloudy", "rain", "mist", "wind", "snow",
]);
export const LIGHTS_ARCHIVE_MESSAGE_KEYS = Object.freeze([
  "lights.archive.message.clear",
  "lights.archive.message.steady",
  "lights.archive.message.thanks",
  "lights.archive.message.shared-sky",
  "lights.archive.message.signal",
  "lights.archive.message.return",
]);
const FICTIONAL_WEATHER_CODE_SET = new Set(FICTIONAL_WEATHER_CODES);
const LIGHTS_ARCHIVE_MESSAGE_KEY_SET = new Set(LIGHTS_ARCHIVE_MESSAGE_KEYS);
const MAX_TIME_ZONE_LENGTH = 64;

function hash32(value) {
  let hash = 2166136261;
  for (const character of String(value).normalize("NFC")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function compactIdentifier(value, maximum = 128) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length <= maximum) return normalized;
  const suffix = `:${hash32(normalized).toString(16).padStart(8, "0")}`;
  return `${normalized.slice(0, maximum - suffix.length)}${suffix}`;
}

function integer(value, maximum = 999) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
}

function grade(value) {
  return Object.hasOwn(GRADES, value) ? value : "none";
}

function validStationDate(value) {
  const normalized = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function playerCallsign(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{1,7}$/.test(normalized) ? normalized : null;
}

function eventRegionCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return ["JP", "US", "CN", "GE", "CH", "FI"].includes(normalized) ? normalized : null;
}

function ownValue(candidate, key) {
  return Object.hasOwn(candidate, key) ? candidate[key] : undefined;
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > MAX_TIME_ZONE_LENGTH) return null;
  const normalized = value.trim();
  if (!normalized || !/^(?:UTC|[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9][A-Za-z0-9._+-]*)+)$/.test(normalized)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
    return normalized;
  } catch {
    return null;
  }
}

function normalizeContact(candidate, eventRunId, fallbackCompletedAt) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const location = LOCATIONS.find(({ id }) => id === String(candidate.locationId ?? ""));
  const completedAt = iso(candidate.completedAt) ?? fallbackCompletedAt;
  const onAirCallsign = candidate.callsign ?? candidate.onAirCallsign;
  const personId = personIdForOperator({ ...candidate, callsign: onAirCallsign });
  const station = stationIdentityForCallsign(onAirCallsign, candidate);
  const regionCode = eventRegionCode(candidate.eventRegionCode ?? candidate.regionCode);
  if (!location || !completedAt || !personId || !station || !regionCode) return null;
  const factSeed = `${eventRunId}|${personId}|${completedAt}`;
  const suppliedWeatherCode = ownValue(candidate, "weatherCode");
  const suppliedMessageKey = ownValue(candidate, "messageKey");
  return {
    personId,
    stationId: station.stationId,
    onAirCallsign: station.callsign,
    eventRegionCode: regionCode,
    locationId: location.id,
    timeZone: validTimeZone(ownValue(candidate, "timeZone")) ?? location.timeZone,
    completedAt,
    weatherCode: FICTIONAL_WEATHER_CODE_SET.has(suppliedWeatherCode)
      ? suppliedWeatherCode
      : FICTIONAL_WEATHER_CODES[hash32(factSeed) % FICTIONAL_WEATHER_CODES.length],
    messageKey: LIGHTS_ARCHIVE_MESSAGE_KEY_SET.has(suppliedMessageKey)
      ? suppliedMessageKey
      : LIGHTS_ARCHIVE_MESSAGE_KEYS[hash32(`${factSeed}:message`) % LIGHTS_ARCHIVE_MESSAGE_KEYS.length],
  };
}

export function createEventRunSnapshot(candidate, {
  stationTimeZone = "UTC",
  stamp = candidate?.stamp,
} = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const eventRunId = compactIdentifier(candidate.eventRunId ?? candidate.runId);
  const mode = MODES.has(candidate.mode) ? candidate.mode : null;
  const startedAt = iso(candidate.startedAt);
  const completedAt = iso(candidate.completedAt);
  const normalizedPlayerCallsign = playerCallsign(candidate.playerCallsign);
  if (!eventRunId || !mode || !startedAt || !completedAt || !normalizedPlayerCallsign
    || Date.parse(completedAt) < Date.parse(startedAt)) return null;
  const stationDate = validStationDate(candidate.stationDate)
    ?? stationCalendarDate(completedAt, stationTimeZone).dateKey;
  const contacts = (Array.isArray(candidate.contacts) ? candidate.contacts : [])
    .slice(0, MAX_EVENT_RUN_CONTACTS)
    .map((contact) => normalizeContact(contact, eventRunId, completedAt))
    .filter(Boolean);
  return {
    version: EVENT_RUN_ARCHIVE_VERSION,
    eventRunId,
    mode,
    startedAt,
    completedAt,
    stationDate,
    score: integer(candidate.score),
    grade: grade(candidate.grade),
    stamp: STAMPS.has(stamp) ? stamp : "none",
    playerCallsign: normalizedPlayerCallsign,
    contacts,
  };
}

function betterSnapshot(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (right.score !== left.score) return right.score > left.score ? right : left;
  if (GRADES[right.grade] !== GRADES[left.grade]) return GRADES[right.grade] > GRADES[left.grade] ? right : left;
  if (Date.parse(right.completedAt) !== Date.parse(left.completedAt)) {
    return Date.parse(right.completedAt) > Date.parse(left.completedAt) ? right : left;
  }
  return right.eventRunId.localeCompare(left.eventRunId) > 0 ? right : left;
}

function bestByPeriod(value, mode, periodKey, limit) {
  if (!Array.isArray(value)) return [];
  const maximumInputs = limit * MAX_ARCHIVE_INPUT_MULTIPLIER;
  const periods = new Map();
  for (const candidate of value.slice(-maximumInputs)) {
    const snapshot = createEventRunSnapshot(candidate);
    if (!snapshot || snapshot.mode !== mode) continue;
    const key = periodKey(snapshot);
    periods.set(key, betterSnapshot(periods.get(key), snapshot));
  }
  return [...periods.values()]
    .sort((left, right) => left.stationDate.localeCompare(right.stationDate)
      || left.eventRunId.localeCompare(right.eventRunId))
    .slice(-limit);
}

export function emptyEventRunArchive() {
  return {
    version: EVENT_RUN_ARCHIVE_VERSION,
    storyBest: null,
    annualBests: [],
    practiceBests: [],
  };
}

export function normalizeEventRunArchive(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const storyBest = createEventRunSnapshot(source.storyBest);
  return {
    version: EVENT_RUN_ARCHIVE_VERSION,
    storyBest: storyBest?.mode === "story" ? storyBest : null,
    annualBests: bestByPeriod(source.annualBests, "annual", (snapshot) => snapshot.stationDate.slice(0, 4), MAX_ANNUAL_EVENT_RUNS),
    practiceBests: bestByPeriod(source.practiceBests, "practice", (snapshot) => snapshot.stationDate, MAX_PRACTICE_EVENT_RUNS),
  };
}

export function recordEventRunArchive(value, candidate, options = {}) {
  const archive = normalizeEventRunArchive(value);
  const snapshot = createEventRunSnapshot(candidate, options);
  if (!snapshot) return archive;
  if (snapshot.mode === "story") {
    return { ...archive, storyBest: betterSnapshot(archive.storyBest, snapshot) };
  }
  if (snapshot.mode === "annual") {
    return normalizeEventRunArchive({ ...archive, annualBests: [...archive.annualBests, snapshot] });
  }
  return normalizeEventRunArchive({ ...archive, practiceBests: [...archive.practiceBests, snapshot] });
}

export const appendEventRunArchive = recordEventRunArchive;
export const archiveEventRun = recordEventRunArchive;
