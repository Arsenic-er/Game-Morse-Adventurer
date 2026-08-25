import { getLocation } from "./locations.js";
import { LIGHTS_EVENT, LIGHTS_EVENT_REGIONS } from "./lightsEventCatalog.js";
import { scoreLightsResult } from "./lightsScoring.js";
import { advanceWorldCalendarState, recordLightsAnnualResult } from "./worldCalendar.js";
import {
  appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs, normalizeQsoRecords,
} from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";

export const LIGHTS_EVENT_STATE_VERSION = 1;
const MAX_SETTLED_RUN_IDS = 200;
const MAX_SETTLED_RUN_INPUTS = MAX_SETTLED_RUN_IDS * 4;
const MAX_PRACTICE_RECORDS = 31;
const MAX_PRACTICE_RECORD_INPUTS = MAX_PRACTICE_RECORDS * 4;
const GRADE_RANK = Object.freeze({ none: 0, base: 1, silver: 2, gold: 3 });
const GRADE_BONUS = Object.freeze({ none: 0, base: 0, silver: 100, gold: 200 });
const PRACTICE_REWARD = Object.freeze({ none: 0, base: 40, silver: 60, gold: 80 });
const RUN_MODES = new Set(["story", "annual", "practice"]);

function integer(value, maximum = 999) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
}

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function grade(value) {
  return Object.hasOwn(GRADE_RANK, value) ? value : "none";
}

function betterGrade(left, right) {
  return GRADE_RANK[grade(left)] >= GRADE_RANK[grade(right)] ? grade(left) : grade(right);
}

function normalizeBest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    runId: String(value.runId ?? "").trim().slice(0, 128) || null,
    score: integer(value.score),
    grade: grade(value.grade),
    completedAt: iso(value.completedAt),
  };
}

function normalizePracticeRecord(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value?.dateKey ?? ""))) return null;
  const bestGrade = grade(value.bestGrade);
  return {
    dateKey: String(value.dateKey),
    bestScore: integer(value.bestScore),
    bestGrade,
    moneyPaid: Math.min(PRACTICE_REWARD.gold, integer(value.moneyPaid)),
  };
}

export function emptyLightsEventState() {
  return {
    version: LIGHTS_EVENT_STATE_VERSION,
    settledRunIds: [],
    storyBest: null,
    lifetimeGradePaid: 0,
    practiceRecords: [],
  };
}

export function normalizeLightsEventState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const settledRunSource = Array.isArray(source.settledRunIds)
    ? source.settledRunIds.slice(-MAX_SETTLED_RUN_INPUTS) : [];
  const settledRunIds = [...new Set(settledRunSource
    .map((id) => String(id ?? "").trim().slice(0, 128)).filter(Boolean))]
    .slice(-MAX_SETTLED_RUN_IDS);
  const records = new Map();
  const practiceRecordSource = Array.isArray(source.practiceRecords)
    ? source.practiceRecords.slice(-MAX_PRACTICE_RECORD_INPUTS) : [];
  for (const candidate of practiceRecordSource) {
    const record = normalizePracticeRecord(candidate);
    if (!record) continue;
    const previous = records.get(record.dateKey);
    records.set(record.dateKey, previous ? {
      dateKey: record.dateKey,
      bestScore: Math.max(previous.bestScore, record.bestScore),
      bestGrade: betterGrade(previous.bestGrade, record.bestGrade),
      moneyPaid: Math.max(previous.moneyPaid, record.moneyPaid),
    } : record);
  }
  return {
    version: LIGHTS_EVENT_STATE_VERSION,
    settledRunIds,
    storyBest: normalizeBest(source.storyBest),
    lifetimeGradePaid: Math.min(GRADE_BONUS.gold, integer(source.lifetimeGradePaid)),
    practiceRecords: [...records.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(-MAX_PRACTICE_RECORDS),
  };
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

function compactIdentifier(value, maximum) {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= maximum) return normalized;
  const suffix = `:${identifierHash(normalized)}`;
  return `${normalized.slice(0, maximum - suffix.length)}${suffix}`;
}

function runSettlementLedgerId(runId) {
  return compactIdentifier(`lights-run:${String(runId ?? "")}`, 96);
}

function practiceRewardLedgerId(dateKey, grade) {
  return `lights-practice:${dateKey}:${grade}`;
}

function durablePracticeReward(records, dateKey) {
  return Object.entries(PRACTICE_REWARD).reduce((best, [grade, reward]) => (
    records.settledQsoIds.includes(practiceRewardLedgerId(dateKey, grade)) ? Math.max(best, reward) : best
  ), 0);
}

function normalizeContact(value, index, result) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const callsign = String(value.callsign ?? "").toUpperCase().replace(/[^A-Z0-9/-]/g, "").slice(0, 16);
  const eventRegionCode = String(value.eventRegionCode ?? "").toUpperCase();
  if (!callsign || !LIGHTS_EVENT_REGIONS.includes(eventRegionCode)) return null;
  return {
    id: compactIdentifier(value.id ?? `${result.runId}:${index}`, 96)
      || compactIdentifier(`${result.runId}:${index}`, 96),
    callsign,
    eventRegionCode,
    locationId: String(value.locationId ?? `event-${eventRegionCode.toLowerCase()}`).trim().slice(0, 64),
    operatorName: String(value.operatorName ?? "").trim().slice(0, 80),
    operatorProfileId: String(value.operatorProfileId ?? "legacy-standard").trim().slice(0, 48) || "legacy-standard",
    remoteRst: /^[1-5][1-9][1-9]$/.test(String(value.remoteRst)) ? String(value.remoteRst) : "599",
    sentRst: /^[1-5][1-9][1-9]$/.test(String(value.sentRst)) ? String(value.sentRst) : "599",
    onAirCallsign: LIGHTS_EVENT.callsign,
    operatorCallsign: String(result.playerCallsign ?? value.operatorCallsign ?? "").toUpperCase()
      .replace(/[^A-Z0-9]/g, "").slice(0, 7),
  };
}

function normalizeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runId = compactIdentifier(value.runId, 128);
  const mode = RUN_MODES.has(value.mode) ? value.mode : null;
  const startedAt = iso(value.startedAt);
  const completedAt = iso(value.completedAt);
  const playerCallsign = String(value.playerCallsign ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (!runId || !mode || !startedAt || !completedAt || !playerCallsign
    || Date.parse(completedAt) < Date.parse(startedAt)) return null;
  const contacts = (Array.isArray(value.contacts) ? value.contacts : [])
    .slice(0, 7).map((contact, index) => normalizeContact(contact, index, { ...value, runId, playerCallsign }))
    .filter(Boolean);
  const facts = {
    validQsoCount: contacts.length,
    distinctRegionCount: new Set(contacts.map(({ eventRegionCode }) => eventRegionCode)).size,
    resolvedPileupCount: integer(value.resolvedPileupCount),
    successfulPartialCount: integer(value.successfulPartialCount),
    misidentificationCount: integer(value.misidentificationCount),
    agnRequestCount: integer(value.agnRequestCount),
  };
  return {
    version: 1, runId, mode, startedAt, completedAt, playerCallsign,
    playerRegion: String(value.playerRegion ?? "").toUpperCase().slice(0, 2),
    chaseCompleted: value.chaseCompleted === true,
    contacts,
    ...facts,
    ...scoreLightsResult(facts),
  };
}

function bestResult(previous, result) {
  if (!previous || result.score > previous.score
    || (result.score === previous.score && GRADE_RANK[result.grade] > GRADE_RANK[previous.grade])) {
    return { runId: result.runId, score: result.score, grade: result.grade, completedAt: result.completedAt };
  }
  return previous;
}

function eventLog(save, result, contact, index) {
  const completedAt = new Date(Date.parse(result.completedAt) + index).toISOString();
  return normalizeQsoLogEntry({
    id: contact.id,
    startedAt: result.startedAt,
    completedAt,
    playerCallsign: result.playerCallsign,
    callsign: contact.callsign,
    frequencyMhz: 21.06,
    sent: contact.sentRst,
    received: contact.remoteRst,
    location: contact.locationId,
    distanceKm: 0,
    basePropagationLevel: 3,
    finalPropagationLevel: 3,
    propagationSource: "LIGHTS_EVENT",
    equipmentId: save.equipmentId,
    antennaId: save.antennaId,
    accessoryId: save.accessoryId,
    playerLocationId: save.locationId,
    operatorProfileId: contact.operatorProfileId,
    copyOutcome: "copied",
    rewardBreakdown: null,
    credits: 0,
    eventId: LIGHTS_EVENT.id,
    eventMode: result.mode,
    eventRegionCode: contact.eventRegionCode,
    onAirCallsign: LIGHTS_EVENT.callsign,
    operatorCallsign: result.playerCallsign,
    isFictional: true,
  });
}

function recordEventContacts(save, result) {
  let qsoLogs = normalizeQsoLogs(save.qsoLogs);
  let qsoRecords = normalizeQsoRecords(save.qsoRecords, qsoLogs);
  let operatorRelationships = normalizeOperatorRelationships(save.operatorRelationships);
  for (const [index, contact] of result.contacts.entries()) {
    const log = eventLog(save, result, contact, index);
    if (!log || qsoRecords.settledQsoIds.includes(log.id)) continue;
    qsoLogs = appendQsoLog(qsoLogs, log);
    qsoRecords = {
      ...qsoRecords,
      total: qsoRecords.total + 1,
      contactedRegions: [...new Set([...qsoRecords.contactedRegions, log.location])].sort(),
      settledQsoIds: [...new Set([...qsoRecords.settledQsoIds, log.id])].sort(),
    };
    operatorRelationships = recordCompletedOperatorRelationship(operatorRelationships, log);
  }
  const settlementId = runSettlementLedgerId(result.runId);
  if (!qsoRecords.settledQsoIds.includes(settlementId)) {
    qsoRecords = {
      ...qsoRecords,
      settledQsoIds: [...qsoRecords.settledQsoIds, settlementId].sort(),
    };
  }
  return { qsoLogs, qsoRecords, operatorRelationships };
}

export function settleLightsRun(save, candidate, { now = new Date() } = {}) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const result = normalizeResult(candidate);
  if (!result) return { save, result: null, settled: false, reason: "invalid-result", moneyAwarded: 0, technologyPointsAwarded: 0 };
  const state = normalizeLightsEventState(save.lightsEventState);
  const qsoRecords = normalizeQsoRecords(save.qsoRecords, save.qsoLogs);
  if (state.settledRunIds.includes(result.runId)
    || qsoRecords.settledQsoIds.includes(runSettlementLedgerId(result.runId))) {
    return { save, result, settled: false, reason: "already-settled", moneyAwarded: 0, technologyPointsAwarded: 0 };
  }

  const storyCompleted = Array.isArray(save.missionState?.claimedMissionIds)
    && save.missionState.claimedMissionIds.includes(LIGHTS_EVENT.missionId);
  if (result.mode !== "story" && !storyCompleted) {
    return { save, result, settled: false, reason: "story-incomplete", moneyAwarded: 0, technologyPointsAwarded: 0 };
  }
  const timeZone = getLocation(save.locationId).timeZone;
  let worldCalendarState = save.worldCalendarState;
  let reason = null;
  let modeMoney = 0;
  let practiceRecords = state.practiceRecords;
  let rewardsPaused = false;
  let practiceRewardMarker = null;
  let annualStamp = null;
  let annualStampGranted = false;

  if (result.mode === "annual") {
    const annual = recordLightsAnnualResult(worldCalendarState, {
      now, timeZone, storyCompleted, score: result.score, grade: result.grade,
    });
    if (!annual.accepted) {
      return { save, result, settled: false, reason: annual.reason, moneyAwarded: 0, technologyPointsAwarded: 0 };
    }
    worldCalendarState = annual.state;
    reason = annual.reason;
    rewardsPaused = annual.reason === "clock-rollback";
    modeMoney = annual.rewardGranted ? 300 : 0;
    annualStamp = annual.record.stamp;
    annualStampGranted = annual.stampGranted;
  } else if (result.mode === "practice") {
    const calendar = advanceWorldCalendarState(worldCalendarState, { now, timeZone });
    worldCalendarState = calendar.state;
    const dateKey = calendar.stationDate.dateKey;
    const previous = practiceRecords.find((record) => record.dateKey === dateKey)
      ?? { dateKey, bestScore: 0, bestGrade: "none", moneyPaid: 0 };
    const targetReward = PRACTICE_REWARD[result.grade];
    const previousPaid = Math.max(previous.moneyPaid, durablePracticeReward(qsoRecords, dateKey));
    modeMoney = Math.max(0, targetReward - previousPaid);
    practiceRewardMarker = targetReward > 0 ? practiceRewardLedgerId(dateKey, result.grade) : null;
    const record = {
      dateKey,
      bestScore: Math.max(previous.bestScore, result.score),
      bestGrade: betterGrade(previous.bestGrade, result.grade),
      moneyPaid: Math.max(previousPaid, targetReward),
    };
    practiceRecords = practiceRecords.filter((candidateRecord) => candidateRecord.dateKey !== dateKey)
      .concat(record).sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(-MAX_PRACTICE_RECORDS);
  }

  const targetGradePaid = GRADE_BONUS[result.grade];
  const gradeMoney = rewardsPaused ? 0 : Math.max(0, targetGradePaid - state.lifetimeGradePaid);
  const moneyAwarded = modeMoney + gradeMoney;
  const nextState = normalizeLightsEventState({
    ...state,
    settledRunIds: [...state.settledRunIds, result.runId],
    storyBest: result.mode === "story" ? bestResult(state.storyBest, result) : state.storyBest,
    lifetimeGradePaid: state.lifetimeGradePaid + gradeMoney,
    practiceRecords,
  });
  const contacts = recordEventContacts(save, result);
  if (practiceRewardMarker && !contacts.qsoRecords.settledQsoIds.includes(practiceRewardMarker)) {
    contacts.qsoRecords = {
      ...contacts.qsoRecords,
      settledQsoIds: [...contacts.qsoRecords.settledQsoIds, practiceRewardMarker].sort(),
    };
  }
  const nextSave = {
    ...save,
    money: integer(save.money ?? save.credits, Number.MAX_SAFE_INTEGER) + moneyAwarded,
    worldCalendarState,
    lightsEventStateVersion: LIGHTS_EVENT_STATE_VERSION,
    lightsEventState: nextState,
    qsoLogs: contacts.qsoLogs,
    qsoRecords: contacts.qsoRecords,
    operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
    operatorRelationships: contacts.operatorRelationships,
    updatedAt: iso(now) ?? result.completedAt,
  };
  return {
    save: nextSave, result, settled: true, reason, moneyAwarded, technologyPointsAwarded: 0,
    annualStamp, annualStampGranted,
  };
}
