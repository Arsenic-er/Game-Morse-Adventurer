import { getAntenna } from "./antennaCatalog.js";
import { getKeyOption, getTransmitter } from "./equipmentCatalog.js";
import { getLocation } from "./locations.js";
import { normalizeQsoLogEntries, normalizeQsoRecords } from "../qso/qsoLog.js";

export const SAVE_STORAGE_KEY = "game-morse-adventurer.saves.v1";
export const ACTIVE_SAVE_KEY = "game-morse-adventurer.active-save.v1";
export const MAX_SAVE_SLOTS = 3;

export function sanitizeCallsign(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}
export function isValidCallsign(value) {
  return /^[A-Z0-9]{1,7}$/.test(String(value ?? ""));
}

function normalizeCredits(value) {
  const credits = Number(value);
  return Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0;
}

export function createSave({ callsign, locationId, antennaId = "dipole", keyType = "manual" }) {
  const cleanCallsign = sanitizeCallsign(callsign);
  if (!isValidCallsign(cleanCallsign)) throw new Error("INVALID_CALLSIGN");
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `save-${Date.now()}`,
    callsign: cleanCallsign,
    locationId: getLocation(locationId).id,
    equipmentId: getTransmitter("squid-01").id,
    antennaId: getAntenna(antennaId).id,
    keyType: getKeyOption(keyType).id,
    credits: 0,
    qsoLogs: [],
    qsoRecords: normalizeQsoRecords(null, []),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSave(save) {
  const callsign = sanitizeCallsign(save?.callsign);
  if (!isValidCallsign(callsign)) return null;
  const qsoLogSource = Array.isArray(save?.qsoLogs) ? save.qsoLogs : save?.qsoLogEntries;
  const qsoLogs = normalizeQsoLogEntries(qsoLogSource);
  return {
    id: String(save.id || `save-${Date.now()}`),
    callsign,
    locationId: getLocation(save.locationId).id,
    equipmentId: getTransmitter(save.equipmentId).id,
    antennaId: getAntenna(save.antennaId).id,
    keyType: getKeyOption(save.keyType).id,
    credits: normalizeCredits(save.credits),
    qsoLogs,
    qsoRecords: normalizeQsoRecords(save?.qsoRecords, qsoLogs),
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
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : language === "ja" ? "ja-JP" : "en-US";
  return new Date(value).toLocaleString(locale, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
