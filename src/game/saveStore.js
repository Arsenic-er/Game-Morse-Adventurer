import { normalizeChapterOnePresentation } from "./chapterOneStory.js";
import { ANTENNAS } from "./antennaCatalog.js";
import { ACCESSORIES } from "./accessoryCatalog.js";
import { KEY_OPTIONS, TRANSMITTERS } from "./equipmentCatalog.js";
import { getLocation } from "./locations.js";
import { normalizeQsoLogEntries, normalizeQsoRecords } from "../qso/qsoLog.js";
import {
  OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationships, recordCompletedOperatorRelationship,
} from "../qso/operatorRelationships.js";
import { DEFAULT_AUTOMATIC_KEY_WPM, normalizeAutomaticKeyWpm } from "../cw/automaticKeyer.js";
import { PRACTICE_RECORDS_VERSION, emptyPracticeRecords, normalizePracticeRecords } from "../practice/practiceRecords.js";
import {
  TECHNOLOGY_TREE_VERSION, normalizeTechnologyPoints, normalizeUnlockedTechnologies,
} from "./technologyTree.js";
import { RESEARCH_PROJECTS_VERSION, normalizeCompletedResearchProjects } from "./researchProjects.js";
import {
  ACHIEVEMENT_REWARDS_VERSION, baselineAchievementRewardIds, migrateAchievementRewardIds,
} from "./achievements.js";
import {
  MISSION_STATE_VERSION, emptyMissionState, normalizeMissionState,
} from "./missionSystem.js";
import {
  WORLD_CALENDAR_VERSION, advanceWorldCalendarState, emptyWorldCalendarState, normalizeWorldCalendarState,
} from "./worldCalendar.js";
import {
  LIGHTS_EVENT_STATE_VERSION, emptyLightsEventState, normalizeLightsEventState,
} from "./lightsSettlement.js";
import {
  EVENT_RUN_ARCHIVE_VERSION, emptyEventRunArchive, normalizeEventRunArchive,
} from "./eventRunArchive.js";
import {
  EXPEDITION_STATE_VERSION, emptyExpeditionState, normalizeExpeditionState,
} from "./expeditionRun.js";
import {
  QSL_RECORDS_VERSION, normalizeQslRecords,
} from "./qslRecords.js";
import {
  STORY_CONTINUATION_STATE_VERSION, emptyStoryContinuationState, normalizeStoryContinuationState,
} from "./storyContinuationState.js";

export const SAVE_STORAGE_KEY = "game-morse-adventurer.saves.v1";
export const ACTIVE_SAVE_KEY = "game-morse-adventurer.active-save.v1";
export const MAX_SAVE_SLOTS = 3;
export const QSO_GUIDANCE_LEVELS = Object.freeze(["full", "hints", "off"]);

export function sanitizeCallsign(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}
export function isValidCallsign(value) {
  return /^[A-Z0-9]{1,7}$/.test(String(value ?? ""));
}

export function normalizeMoney(value) {
  const money = Number(value);
  return Number.isFinite(money) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(money))) : 0;
}
export const normalizeCredits = normalizeMoney;

export function normalizeQsoGuidance(value) {
  return QSO_GUIDANCE_LEVELS.includes(value) ? value : "full";
}

function exactId(catalog, value, fallback) {
  return catalog.some((item) => item.id === value) ? value : fallback;
}

function normalizeOwned(values, catalog, starterIds) {
  const requested = Array.isArray(values) ? new Set(values) : new Set();
  starterIds.forEach((id) => requested.add(id));
  return catalog.map((item) => item.id).filter((id) => id !== "none" && requested.has(id));
}

export function createSave({
  callsign,
  locationId,
  keyType = "manual",
  automaticKeyWpm = DEFAULT_AUTOMATIC_KEY_WPM,
  qsoGuidance = "full",
}) {
  const cleanCallsign = sanitizeCallsign(callsign);
  if (!isValidCallsign(cleanCallsign)) throw new Error("INVALID_CALLSIGN");
  const now = new Date().toISOString();
  return {
    inventoryVersion: 3,
    id: globalThis.crypto?.randomUUID?.() ?? `save-${Date.now()}`,
    callsign: cleanCallsign,
    locationId: getLocation(locationId).id,
    equipmentId: "squid-01",
    antennaId: "dipole",
    accessoryId: "none",
    keyType: exactId(KEY_OPTIONS, keyType, "manual"),
    automaticKeyWpm: normalizeAutomaticKeyWpm(automaticKeyWpm),
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
    money: 0,
    achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION,
    claimedAchievementRewards: [],
    knownOperatorNames: [],
    technologyTreeVersion: TECHNOLOGY_TREE_VERSION,
    missionStateVersion: MISSION_STATE_VERSION,
    missionState: emptyMissionState(),
    chapterOnePresentation: normalizeChapterOnePresentation(null),
    worldCalendarVersion: WORLD_CALENDAR_VERSION,
    worldCalendarState: emptyWorldCalendarState(),
    lightsEventStateVersion: LIGHTS_EVENT_STATE_VERSION,
    lightsEventState: emptyLightsEventState(),
    eventRunArchiveVersion: EVENT_RUN_ARCHIVE_VERSION,
    eventRunArchive: emptyEventRunArchive(),
    expeditionStateVersion: EXPEDITION_STATE_VERSION,
    expeditionState: emptyExpeditionState(),
    qslRecordsVersion: QSL_RECORDS_VERSION,
    qslRecords: normalizeQslRecords([]),
    storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
    storyContinuationState: emptyStoryContinuationState(),
    technologyPoints: 0,
    unlockedTechnologies: normalizeUnlockedTechnologies([]),
    researchProjectsVersion: RESEARCH_PROJECTS_VERSION,
    completedResearchProjects: [],
    qsoLogs: [],
    qsoRecords: normalizeQsoRecords(null, []),
    operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
    operatorRelationships: [],
    practiceRecordsVersion: PRACTICE_RECORDS_VERSION,
    practiceRecords: emptyPracticeRecords(),
    qsoGuidance: normalizeQsoGuidance(qsoGuidance),
    qsoBriefSeen: false,
    firstWatchCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSave(save) {
  const callsign = sanitizeCallsign(save?.callsign);
  if (!isValidCallsign(callsign)) return null;
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(save ?? {}, key);
  const hasInventory = Number(save?.inventoryVersion) >= 1
    || hasOwn("ownedEquipment")
    || hasOwn("ownedAntennas")
    || hasOwn("accessories");
  const legacyAntennaId = exactId(ANTENNAS, save?.antennaId, "dipole");
  const ownedEquipment = normalizeOwned(
    // Pre-inventory saves were released when SQUID-01 was the only radio.
    // Do not let newly added catalog ids turn a legacy/tampered equipmentId
    // into free ownership during migration.
    hasInventory ? save?.ownedEquipment : ["squid-01"],
    TRANSMITTERS,
    ["squid-01"],
  );
  const ownedAntennas = normalizeOwned(
    hasInventory ? save?.ownedAntennas : [legacyAntennaId],
    ANTENNAS,
    ["dipole"],
  );
  const ownedAccessories = normalizeOwned(
    hasInventory ? save?.accessories : [],
    ACCESSORIES,
    [],
  );
  const requestedEquipmentId = exactId(TRANSMITTERS, save?.equipmentId, "squid-01");
  const requestedAntennaId = exactId(ANTENNAS, save?.antennaId, "dipole");
  const requestedAccessoryId = exactId(ACCESSORIES, save?.accessoryId, "none");
  const equipmentId = ownedEquipment.includes(requestedEquipmentId) ? requestedEquipmentId : "squid-01";
  const antennaId = requestedAntennaId === "none" || ownedAntennas.includes(requestedAntennaId)
    ? requestedAntennaId
    : "dipole";
  const accessoryId = requestedAccessoryId === "none" || ownedAccessories.includes(requestedAccessoryId)
    ? requestedAccessoryId
    : "none";
  const qsoLogSource = Array.isArray(save?.qsoLogs) ? save.qsoLogs : save?.qsoLogEntries;
  const qsoLogs = normalizeQsoLogEntries(qsoLogSource);
  const operatorRelationships = hasOwn("operatorRelationships")
    ? normalizeOperatorRelationships(save?.operatorRelationships)
    : [...qsoLogs].reverse().reduce((relationships, log) => (
      recordCompletedOperatorRelationship(relationships, log)
    ), []);
  const hasTechnologyProgress = Number(save?.technologyTreeVersion) >= 1
    || hasOwn("technologyPoints")
    || hasOwn("unlockedTechnologies");
  const ownedTechnologyItems = [
    ...ownedEquipment.map((itemId) => ({ category: "radio", itemId })),
    ...ownedAntennas.map((itemId) => ({ category: "antenna", itemId })),
    ...ownedAccessories.map((itemId) => ({ category: "accessories", itemId })),
  ];
  const hasAchievementRewardLedger = Number(save?.achievementRewardsVersion) >= 1
    || hasOwn("claimedAchievementRewards");
  const normalized = {
    inventoryVersion: 3,
    id: String(save.id || `save-${Date.now()}`),
    callsign,
    locationId: getLocation(save.locationId).id,
    equipmentId,
    antennaId,
    accessoryId,
    keyType: exactId(KEY_OPTIONS, save.keyType, "manual"),
    automaticKeyWpm: normalizeAutomaticKeyWpm(save.automaticKeyWpm),
    ownedEquipment,
    ownedAntennas,
    accessories: ownedAccessories,
    money: normalizeMoney(save.money ?? save.credits),
    technologyTreeVersion: TECHNOLOGY_TREE_VERSION,
    knownOperatorNames: [...new Set((Array.isArray(save?.knownOperatorNames) ? save.knownOperatorNames : [])
      .map((value) => String(value ?? "").trim().slice(0, 80)).filter(Boolean))].slice(0, 1000),
    missionStateVersion: MISSION_STATE_VERSION,
    missionState: normalizeMissionState(save?.missionState),
    chapterOnePresentation: normalizeChapterOnePresentation(Object.getOwnPropertyDescriptor(save, "chapterOnePresentation")?.value),
    worldCalendarVersion: WORLD_CALENDAR_VERSION,
    worldCalendarState: normalizeWorldCalendarState(save?.worldCalendarState),
    lightsEventStateVersion: LIGHTS_EVENT_STATE_VERSION,
    lightsEventState: normalizeLightsEventState(save?.lightsEventState),
    eventRunArchiveVersion: EVENT_RUN_ARCHIVE_VERSION,
    eventRunArchive: normalizeEventRunArchive(save?.eventRunArchive),
    expeditionStateVersion: EXPEDITION_STATE_VERSION,
    expeditionState: normalizeExpeditionState(save?.expeditionState),
    qslRecordsVersion: QSL_RECORDS_VERSION,
    qslRecords: normalizeQslRecords(save?.qslRecords),
    storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
    storyContinuationState: normalizeStoryContinuationState(save?.storyContinuationState),
    technologyPoints: normalizeTechnologyPoints(save?.technologyPoints),
    unlockedTechnologies: normalizeUnlockedTechnologies(save?.unlockedTechnologies, {
      // Equipment released before the research system remains available to old saves.
      unlockAllCurrent: !hasTechnologyProgress,
      ownedItems: ownedTechnologyItems,
    }),
    researchProjectsVersion: RESEARCH_PROJECTS_VERSION,
    completedResearchProjects: normalizeCompletedResearchProjects(save?.completedResearchProjects),
    qsoLogs,
    qsoRecords: normalizeQsoRecords(save?.qsoRecords, qsoLogSource),
    operatorRelationshipsVersion: OPERATOR_RELATIONSHIPS_VERSION,
    operatorRelationships,
    practiceRecordsVersion: PRACTICE_RECORDS_VERSION,
    practiceRecords: normalizePracticeRecords(save?.practiceRecords),
    qsoGuidance: normalizeQsoGuidance(save?.qsoGuidance),
    qsoBriefSeen: save?.qsoBriefSeen === true,
    firstWatchCompleted: save?.firstWatchCompleted === true,
    createdAt: save.createdAt || new Date().toISOString(),
    updatedAt: save.updatedAt || new Date().toISOString(),
  };
  normalized.achievementRewardsVersion = ACHIEVEMENT_REWARDS_VERSION;
  normalized.claimedAchievementRewards = hasAchievementRewardLedger
    ? migrateAchievementRewardIds(
        normalized,
        save?.claimedAchievementRewards,
        Number(save?.achievementRewardsVersion) || 1,
      )
    : baselineAchievementRewardIds({
        ...normalized,
        // Preserve whether legacy logs actually recorded a propagation level.
        qsoLogs: Array.isArray(qsoLogSource) ? qsoLogSource : [],
      });
  return normalized;
}

export function touchSaveWorldCalendar(save, now = new Date()) {
  if (!save || typeof save !== "object" || Array.isArray(save)) return save;
  const timeZone = getLocation(save.locationId).timeZone;
  const advanced = advanceWorldCalendarState(save.worldCalendarState, { now, timeZone });
  const canonicalState = JSON.stringify(save.worldCalendarState) === JSON.stringify(advanced.state);
  if (save.worldCalendarVersion === WORLD_CALENDAR_VERSION && canonicalState) return save;
  return {
    ...save,
    worldCalendarVersion: WORLD_CALENDAR_VERSION,
    worldCalendarState: advanced.state,
  };
}

export function loadSaves(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(SAVE_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.map(normalizeSave).filter(Boolean).slice(0, MAX_SAVE_SLOTS);
  } catch {
    return [];
  }
}

export function persistSaves(saves, storage = globalThis.localStorage) {
  const normalized = saves.map(normalizeSave).filter(Boolean).slice(0, MAX_SAVE_SLOTS);
  storage?.setItem(SAVE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadActiveSaveId(storage = globalThis.localStorage) {
  return storage?.getItem(ACTIVE_SAVE_KEY) || null;
}

export function persistActiveSaveId(saveId, storage = globalThis.localStorage) {
  if (!storage) return;
  if (saveId) storage.setItem(ACTIVE_SAVE_KEY, saveId);
  else storage.removeItem(ACTIVE_SAVE_KEY);
}

export function formatSaveTime(value, language = "en") {
  const locales = { "zh-CN": "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", en: "en-US", es: "es-ES", de: "de-DE", ru: "ru-RU" };
  const locale = locales[language] ?? "en-US";
  return new Date(value).toLocaleString(locale, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
