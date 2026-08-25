import {
  calculateQsoRewardBreakdown,
  isWeakSignalLevel,
  normalizeQsoRewardBreakdown,
} from "../game/qsoRewards.js";
import { settleResearchProjects } from "../game/researchProjects.js";
import { recordMissionQsoEvent } from "../game/missionSystem.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION, recordCompletedOperatorRelationship,
} from "./operatorRelationships.js";
import { personIdForOperator, stationIdentityForCallsign } from "../game/personIdentity.js";

export const QSO_LOG_VERSION = 8;
const OPTIONAL_EXCHANGE_QUESTION_IDS = Object.freeze([
  "power", "location", "weather", "name", "age", "rig", "antenna",
]);
export const MAX_QSO_LOGS = 200;
export const MAX_QSO_ATTEMPT_HISTORY = 50;

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeCallsign(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9/-]/g, "").slice(0, 16);
}

function normalizeRst(value) {
  const rst = String(value ?? "");
  return /^[1-5][1-9][1-9]$/.test(rst) ? rst : null;
}

function normalizeCoordinate(value, minimum, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(clamp(numeric, 0, 100).toFixed(1)) : null;
}

function normalizeId(value, callsign, completedAt) {
  const supplied = String(value ?? "").trim().slice(0, 96);
  return supplied || `${callsign}-${new Date(completedAt).getTime()}`;
}

function normalizeRepeatRequests(value) {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(finiteNumber(value))));
}

function normalizeGuidanceLevel(value) {
  return ["full", "hints", "off"].includes(value) ? value : "full";
}

function normalizeEventId(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48);
  return normalized || null;
}

function normalizeEventMode(value) {
  return ["story", "annual", "practice"].includes(value) ? value : null;
}

function normalizeEventRegion(value) {
  const normalized = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  return normalized || null;
}

function identifierHash(value) {
  let left = 2166136261;
  let right = 5381;
  for (const character of String(value)) {
    const code = character.charCodeAt(0);
    left = Math.imul(left ^ code, 16777619);
    right = Math.imul(right, 33) ^ code;
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeEventRunId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length <= 128) return normalized;
  const suffix = `:${identifierHash(normalized)}`;
  return `${normalized.slice(0, 128 - suffix.length)}${suffix}`;
}

function normalizeAttemptMetric(value, maximum = 100) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(clamp(numeric, 0, maximum).toFixed(1)) : null;
}

function normalizeAttempt(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const result = ["accepted", "rejected", "repeat", "transmitted"].includes(candidate.result)
    ? candidate.result
    : null;
  if (!result) return null;
  const stage = String(candidate.stage ?? "UNKNOWN").trim().slice(0, 48) || "UNKNOWN";
  const message = String(candidate.message ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const reason = candidate.reason === null || candidate.reason === undefined || candidate.reason === ""
    ? null
    : String(candidate.reason).trim().slice(0, 48) || null;
  return {
    stage,
    message,
    result,
    reason,
    wpm: normalizeAttemptMetric(candidate.wpm, 120),
    accuracy: normalizeAttemptMetric(candidate.accuracy),
    rhythm: normalizeAttemptMetric(candidate.rhythm),
    cqQuality: normalizeAttemptMetric(candidate.cqQuality),
    copyScore: normalizeAttemptMetric(candidate.copyScore),
    remoteOutcome: ["copied", "query", "unreadable", "no-response"].includes(candidate.remoteOutcome)
      ? candidate.remoteOutcome
      : null,
    operatorProfileId: candidate.operatorProfileId
      ? String(candidate.operatorProfileId).trim().slice(0, 48) || null
      : null,
  };
}

function normalizeAttemptHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeAttempt)
    .filter(Boolean)
    .slice(-MAX_QSO_ATTEMPT_HISTORY);
}

export function normalizeQsoLogEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const startedAt = normalizeIso(entry.startedAt);
  const completedAt = normalizeIso(entry.completedAt);
  const callsign = normalizeCallsign(entry.callsign ?? entry.npcCallsign);
  const playerCallsign = normalizeCallsign(entry.playerCallsign);
  if (!startedAt || !completedAt || !callsign || !playerCallsign) return null;
  if (Date.parse(completedAt) < Date.parse(startedAt)) return null;

  const location = String(entry.location ?? entry.regionId ?? "SIM").trim().slice(0, 32) || "SIM";
  const distanceKm = Math.max(0, finiteNumber(entry.distanceKm));
  const basePropagationLevel = Math.round(clamp(finiteNumber(entry.basePropagationLevel ?? entry.baseLevel), 0, 4));
  const finalPropagationLevel = Math.round(clamp(finiteNumber(entry.finalPropagationLevel ?? entry.finalLevel), 0, 4));

  const guidanceLevel = normalizeGuidanceLevel(entry.guidanceLevel);
  const visualAssistUsed = entry.visualAssistUsed === true;
  const rewardBreakdown = normalizeQsoRewardBreakdown(entry.rewardBreakdown);
  const candidateQuestion = OPTIONAL_EXCHANGE_QUESTION_IDS.includes(entry.optionalExchangeQuestion)
    ? entry.optionalExchangeQuestion
    : null;
  const optionalExchangeOutcome = candidateQuestion && ["answered", "skipped"].includes(entry.optionalExchangeOutcome)
    ? entry.optionalExchangeOutcome : "not-offered";
  const optionalExchangeQuestion = optionalExchangeOutcome === "not-offered" ? null : candidateQuestion;
  const eventId = normalizeEventId(entry.eventId);
  const personId = personIdForOperator({ ...entry, callsign });
  const station = stationIdentityForCallsign(callsign, entry);
  if (!personId || !station) return null;
  const suppliedPropagationRecorded = entry.propagationLevelRecorded;
  const rawPropagationLevel = entry.finalPropagationLevel ?? entry.finalLevel;
  const propagationLevelRecorded = suppliedPropagationRecorded === false ? false : (
    rawPropagationLevel !== null && rawPropagationLevel !== undefined && rawPropagationLevel !== ""
      && Number.isFinite(Number(rawPropagationLevel))
      && Number(rawPropagationLevel) >= 0
      && Number(rawPropagationLevel) <= 4
  );
  return {
    version: QSO_LOG_VERSION,
    id: normalizeId(entry.id, callsign, completedAt),
    startedAt,
    completedAt,
    playerCallsign,
    callsign,
    personId,
    stationId: station.stationId,
    frequencyMhz: Math.max(0, finiteNumber(entry.frequencyMhz ?? entry.frequency, 21.06)),
    mode: "CW",
    sent: normalizeRst(entry.sent ?? entry.sentRst),
    received: normalizeRst(entry.received ?? entry.receivedRst),
    location,
    npcLatitude: normalizeCoordinate(entry.npcLatitude ?? entry.latitude, -90, 90),
    npcLongitude: normalizeCoordinate(entry.npcLongitude ?? entry.longitude, -180, 180),
    distanceKm: Number(distanceKm.toFixed(1)),
    basePropagationLevel,
    finalPropagationLevel,
    propagationLevelRecorded,
    propagationSource: String(entry.propagationSource ?? "OFFLINE_DEFAULT").trim().slice(0, 48) || "OFFLINE_DEFAULT",
    equipmentId: String(entry.equipmentId ?? "squid-01").trim().slice(0, 48) || "squid-01",
    antennaId: String(entry.antennaId ?? "none").trim().slice(0, 48) || "none",
    accessoryId: String(entry.accessoryId ?? "none").trim().slice(0, 48) || "none",
    playerLocationId: String(entry.playerLocationId ?? entry.locationId ?? "unknown").trim().slice(0, 64) || "unknown",
    wpm: Number(Math.max(0, finiteNumber(entry.wpm)).toFixed(1)),
    transmitAccuracy: normalizeScore(entry.transmitAccuracy ?? entry.copyAccuracy ?? entry.accuracy),
    keyingScore: normalizeScore(entry.keyingScore),
    repeatRequests: normalizeRepeatRequests(entry.repeatRequests),
    copyQueries: normalizeRepeatRequests(entry.copyQueries),
    cqQuality: normalizeScore(entry.cqQuality),
    copyScore: normalizeScore(entry.copyScore),
    copyOutcome: ["copied", "query", "unreadable", "no-response"].includes(entry.copyOutcome)
      ? entry.copyOutcome
      : null,
    operatorProfileId: String(entry.operatorProfileId ?? "legacy-standard").trim().slice(0, 48) || "legacy-standard",
    operatorProfileRevision: Math.max(0, Math.floor(finiteNumber(entry.operatorProfileRevision))),
    remoteWpm: entry.remoteWpm === null || entry.remoteWpm === undefined || entry.remoteWpm === ""
      ? null
      : Number(clamp(finiteNumber(entry.remoteWpm), 0, 60).toFixed(1)),
    optionalExchangeQuestion,
    optionalExchangeOutcome,
    optionalExchangeRepeatRequests: optionalExchangeQuestion ? normalizeRepeatRequests(entry.optionalExchangeRepeatRequests) : 0,
    guidanceLevel,
    visualAssistUsed,
    independentWatch: entry.independentWatch === true && guidanceLevel === "off" && !visualAssistUsed,
    attemptHistory: normalizeAttemptHistory(entry.attemptHistory),
    rewardBreakdown,
    credits: rewardBreakdown?.total
      ?? Math.max(0, Math.floor(finiteNumber(entry.credits ?? entry.creditsAwarded))),
    eventId,
    eventRunId: eventId ? normalizeEventRunId(entry.eventRunId ?? entry.runId) : null,
    eventMode: eventId ? normalizeEventMode(entry.eventMode) : null,
    eventRegionCode: eventId ? normalizeEventRegion(entry.eventRegionCode) : null,
    onAirCallsign: eventId ? normalizeCallsign(entry.onAirCallsign) || null : null,
    operatorCallsign: eventId ? normalizeCallsign(entry.operatorCallsign) || null : null,
    isFictional: entry.isFictional !== false,
  };
}

export function normalizeQsoLogs(entries) {
  if (!Array.isArray(entries)) return [];
  const unique = new Map();
  for (const candidate of entries) {
    const entry = normalizeQsoLogEntry(candidate);
    if (entry && !unique.has(entry.id)) unique.set(entry.id, entry);
  }
  return [...unique.values()]
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt) || left.id.localeCompare(right.id))
    .slice(0, MAX_QSO_LOGS);
}

export const normalizeQsoLogEntries = normalizeQsoLogs;

export function appendQsoLog(entries, entry) {
  const normalized = normalizeQsoLogEntry(entry);
  if (!normalized) throw new TypeError("A valid completed QSO log entry is required.");
  return normalizeQsoLogs([normalized, ...(Array.isArray(entries) ? entries : [])]);
}

export function normalizeQsoRecords(records, entries = []) {
  const logs = normalizeQsoLogs(entries);
  const supplied = records && typeof records === "object" ? records : {};
  const suppliedRegions = Array.isArray(supplied.contactedRegions) ? supplied.contactedRegions : [];
  const contactedRegions = new Set(suppliedRegions.map((region) => String(region).trim()).filter(Boolean));
  for (const log of logs) contactedRegions.add(log.location);
  const suppliedSettledIds = Array.isArray(supplied.settledQsoIds) ? supplied.settledQsoIds : [];
  const settledQsoIds = new Set(suppliedSettledIds
    .map((id) => String(id ?? "").trim().slice(0, 96))
    .filter(Boolean));
  for (const log of logs) settledQsoIds.add(log.id);
  const retainedWeakSignalQsos = (Array.isArray(entries) ? entries : []).filter((candidate) => {
    if (!normalizeQsoLogEntry(candidate)) return false;
    if (candidate?.propagationLevelRecorded === false) return false;
    const value = candidate?.finalPropagationLevel ?? candidate?.finalLevel;
    if (value === null || value === undefined || value === "") return false;
    const level = Number(value);
    return Number.isFinite(level) && level >= 0 && level <= 2;
  }).length;
  const weakSignalQsos = Math.max(
    Math.floor(Math.max(0, finiteNumber(supplied.weakSignalQsos))),
    retainedWeakSignalQsos,
  );

  let longestDistanceKm = Math.max(0, finiteNumber(supplied.longestDistanceKm));
  let longestQsoId = String(supplied.longestQsoId ?? "") || null;
  for (const log of logs) {
    if (!longestQsoId || log.distanceKm > longestDistanceKm) {
      longestDistanceKm = log.distanceKm;
      longestQsoId = log.id;
    }
  }
  return {
    total: Math.max(Math.floor(finiteNumber(supplied.total)), logs.length),
    longestDistanceKm: Number(longestDistanceKm.toFixed(1)),
    longestQsoId,
    contactedRegions: [...contactedRegions].sort(),
    weakSignalQsos,
    settledQsoIds: [...settledQsoIds].sort(),
  };
}

export function recordCompletedQso(save, candidate) {
  if (!save || typeof save !== "object") throw new TypeError("A save record is required.");
  const entry = normalizeQsoLogEntry(candidate);
  if (!entry) throw new TypeError("A valid completed QSO log entry is required.");
  if (!entry.sent || !entry.received) {
    throw new TypeError("A completed QSO requires valid sent and received RST reports.");
  }
  const currentLogs = normalizeQsoLogs(save.qsoLogs);
  const previousRecords = normalizeQsoRecords(save.qsoRecords, currentLogs);
  if (previousRecords.settledQsoIds.includes(entry.id)) {
    const settledEntry = currentLogs.find((log) => log.id === entry.id) ?? null;
    return {
      save,
      added: false,
      newRegion: false,
      newDistanceRecord: false,
      moneyAwarded: 0,
      settledEntry,
      rewardBreakdown: settledEntry?.rewardBreakdown ?? null,
      creditsAwarded: 0, // Legacy API alias; remove after external consumers migrate.
    };
  }

  const newRegion = !previousRecords.contactedRegions.includes(entry.location);
  const newDistanceRecord = !previousRecords.longestQsoId || entry.distanceKm > previousRecords.longestDistanceKm;
  const settlementPropagationLevel = candidate?.finalPropagationLevel ?? candidate?.finalLevel;
  const rewardBreakdown = calculateQsoRewardBreakdown({
    independentWatch: entry.independentWatch,
    finalPropagationLevel: settlementPropagationLevel,
    newRegion,
    newDistanceRecord,
  });
  const settledEntry = normalizeQsoLogEntry({
    ...entry,
    rewardBreakdown,
    credits: rewardBreakdown.total,
  });
  const qsoLogs = appendQsoLog(currentLogs, settledEntry);
  const persistedEntry = qsoLogs.find((log) => log.id === settledEntry.id) ?? settledEntry;
  const contactedRegions = newRegion
    ? [...previousRecords.contactedRegions, entry.location].sort()
    : previousRecords.contactedRegions;
  const qsoRecords = {
    total: previousRecords.total + 1,
    longestDistanceKm: newDistanceRecord ? entry.distanceKm : previousRecords.longestDistanceKm,
    longestQsoId: newDistanceRecord ? entry.id : previousRecords.longestQsoId,
    contactedRegions,
    weakSignalQsos: previousRecords.weakSignalQsos + (isWeakSignalLevel(settlementPropagationLevel) ? 1 : 0),
    settledQsoIds: [...previousRecords.settledQsoIds, entry.id].sort(),
  };
  const money = Math.max(0, finiteNumber(save.money ?? save.credits)) + rewardBreakdown.total;
  const operatorRelationships = recordCompletedOperatorRelationship(save.operatorRelationships, persistedEntry);
  const researchSettlement = settleResearchProjects({
    ...save, money, qsoLogs, qsoRecords,
    operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
    operatorRelationships,
  });
  const missionSave = recordMissionQsoEvent(researchSettlement.save, persistedEntry);

  return {
    save: missionSave,
    added: true,
    newRegion,
    newDistanceRecord,
    settledEntry: persistedEntry,
    rewardBreakdown,
    creditsAwarded: rewardBreakdown.total, // Legacy API alias.
    technologyPointsAwarded: researchSettlement.technologyPointsAwarded,
    moneyAwarded: rewardBreakdown.total,
    completedResearchProjects: researchSettlement.newlyCompleted,
  };
}
