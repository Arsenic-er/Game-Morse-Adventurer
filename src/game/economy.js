import { ANTENNAS } from "./antennaCatalog.js";
import { TRANSMITTERS } from "./equipmentCatalog.js";

export const ECONOMY_RESULT = Object.freeze({
  PURCHASED: "PURCHASED",
  EQUIPPED: "EQUIPPED",
  UNKNOWN_CATEGORY: "UNKNOWN_CATEGORY",
  UNKNOWN_ITEM: "UNKNOWN_ITEM",
  NOT_PURCHASABLE: "NOT_PURCHASABLE",
  ALREADY_OWNED: "ALREADY_OWNED",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  NOT_OWNED: "NOT_OWNED",
  NO_CHANGE: "NO_CHANGE",
});

export const STORE_CATEGORIES = Object.freeze(["radio", "antenna", "accessories"]);

const CATEGORY_CONFIG = Object.freeze({
  radio: { catalog: TRANSMITTERS, ownedField: "ownedEquipment", equippedField: "equipmentId" },
  antenna: { catalog: ANTENNAS, ownedField: "ownedAntennas", equippedField: "antennaId" },
  accessories: { catalog: [], ownedField: "accessories", equippedField: null },
});

function categoryConfig(category) {
  return CATEGORY_CONFIG[category] ?? null;
}

function exactItem(config, itemId) {
  return config.catalog.find((item) => item.id === itemId) ?? null;
}

function safeCredits(value) {
  const credits = Number(value);
  if (!Number.isFinite(credits)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(credits)));
}

export function ownsItem(save, { category, itemId }) {
  if (category === "antenna" && itemId === "none") return true;
  const config = categoryConfig(category);
  if (!config) return false;
  return Array.isArray(save?.[config.ownedField]) && save[config.ownedField].includes(itemId);
}

export function purchaseItem(save, { category, itemId }) {
  const config = categoryConfig(category);
  if (!config) return { save, purchased: false, reason: ECONOMY_RESULT.UNKNOWN_CATEGORY };
  const item = exactItem(config, itemId);
  if (!item) return { save, purchased: false, reason: ECONOMY_RESULT.UNKNOWN_ITEM };
  if (!item.purchasable) return { save, purchased: false, reason: ECONOMY_RESULT.NOT_PURCHASABLE };
  if (ownsItem(save, { category, itemId })) {
    return { save, purchased: false, reason: ECONOMY_RESULT.ALREADY_OWNED };
  }
  const price = Number(item.price);
  if (!Number.isSafeInteger(price) || price < 0) {
    return { save, purchased: false, reason: ECONOMY_RESULT.NOT_PURCHASABLE };
  }
  const credits = safeCredits(save?.credits);
  if (credits < price) {
    return { save, purchased: false, reason: ECONOMY_RESULT.INSUFFICIENT_CREDITS };
  }
  const owned = Array.isArray(save?.[config.ownedField]) ? save[config.ownedField] : [];
  const nextSave = {
    ...save,
    credits: credits - price,
    [config.ownedField]: [...owned, item.id],
    updatedAt: new Date().toISOString(),
  };
  return { save: nextSave, purchased: true, reason: ECONOMY_RESULT.PURCHASED };
}

export function equipOwnedItem(save, { category, itemId }) {
  const config = categoryConfig(category);
  if (!config) return { save, equipped: false, reason: ECONOMY_RESULT.UNKNOWN_CATEGORY };
  const item = exactItem(config, itemId);
  if (!item) return { save, equipped: false, reason: ECONOMY_RESULT.UNKNOWN_ITEM };
  if (!config.equippedField) {
    return { save, equipped: false, reason: ECONOMY_RESULT.NOT_OWNED };
  }
  if (!ownsItem(save, { category, itemId })) {
    return { save, equipped: false, reason: ECONOMY_RESULT.NOT_OWNED };
  }
  if (save?.[config.equippedField] === itemId) {
    return { save, equipped: false, reason: ECONOMY_RESULT.NO_CHANGE };
  }
  return {
    save: { ...save, [config.equippedField]: itemId, updatedAt: new Date().toISOString() },
    equipped: true,
    reason: ECONOMY_RESULT.EQUIPPED,
  };
}
