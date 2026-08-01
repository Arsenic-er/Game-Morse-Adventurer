import { ANTENNAS } from "./antennaCatalog.js";
import { ACCESSORIES } from "./accessoryCatalog.js";
import { KEY_OPTIONS, TRANSMITTERS } from "./equipmentCatalog.js";
import { getLocation } from "./locations.js";
import { normalizeQsoLogEntries, normalizeQsoRecords } from "../qso/qsoLog.js";
import { DEFAULT_AUTOMATIC_KEY_WPM, normalizeAutomaticKeyWpm } from "../cw/automaticKeyer.js";
import { PRACTICE_RECORDS_VERSION, emptyPracticeRecords, normalizePracticeRecords } from "../practice/practiceRecords.js";

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

export function normalizeCredits(value) {
  const credits = Number(value);
  return Number.isFinite(credits) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(credits))) : 0;
}

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
    inventoryVersion: 2,
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
    credits: 0,
    qsoLogs: [],
    qsoRecords: normalizeQsoRecords(null, []),
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
  return {
    inventoryVersion: 2,
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
    credits: normalizeCredits(save.credits),
    qsoLogs,
    qsoRecords: normalizeQsoRecords(save?.qsoRecords, qsoLogSource),
    practiceRecordsVersion: PRACTICE_RECORDS_VERSION,
    practiceRecords: normalizePracticeRecords(save?.practiceRecords),
    qsoGuidance: normalizeQsoGuidance(save?.qsoGuidance),
    qsoBriefSeen: save?.qsoBriefSeen === true,
    firstWatchCompleted: save?.firstWatchCompleted === true,
    createdAt: save.createdAt || new Date().toISOString(),
    updatedAt: save.updatedAt || new Date().toISOString(),
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
