import { ACCESSORIES } from "./accessoryCatalog.js";
import { ANTENNAS } from "./antennaCatalog.js";
import { TRANSMITTERS } from "./equipmentCatalog.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function own(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function boundedNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
}

function boundedId(value, maximum = 64) {
  const normalized = String(value ?? "").trim().slice(0, maximum);
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(normalized) ? normalized : null;
}

function boundedCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase().slice(0, 12);
  return /^[A-Z0-9]{2,12}$/.test(normalized) ? normalized : null;
}

export const EXPEDITION_SITES = deepFreeze([
  {
    id: "sunward-hill", nameKey: "expeditionSiteSunward", qthCode: "SUNWARD",
    latitude: 35.447, longitude: 139.573, timeZone: "Asia/Tokyo",
    propagationBias: 1, fictional: true,
  },
  {
    id: "cedar-breeze-hill", nameKey: "expeditionSiteCedarBreeze", qthCode: "CEDAR",
    latitude: 45.493, longitude: -122.718, timeZone: "America/Los_Angeles",
    propagationBias: 0, fictional: true,
  },
  {
    id: "lakeview-hill", nameKey: "expeditionSiteLakeview", qthCode: "LAKEVIEW",
    latitude: 48.154, longitude: 11.528, timeZone: "Europe/Berlin",
    propagationBias: -1, fictional: true,
  },
]);

export const EXPEDITION_LOAN_KIT = deepFreeze({
  radio: {
    id: "loan-portable-cw", exchangePowerWatts: 5,
    receiveDrawWatts: 2, transmitDrawWatts: 12,
  },
  antenna: { id: "loan-wire-dipole", exchangeCode: "WIRE" },
  battery: { id: "loan-lifepo4-96wh", capacityWh: 96 },
});

const FIELD_RADIO_DRAWS = Object.freeze({
  "squid-01": Object.freeze({ receiveDrawWatts: 2, transmitDrawWatts: 12 }),
  "usdr-8": Object.freeze({ receiveDrawWatts: 3, transmitDrawWatts: 18 }),
});
const FIELD_ANTENNA_CODES = Object.freeze({
  dipole: "DIPOLE",
  "yagi-3el": "YAGI",
  vertical: "VERTICAL",
});

export const EXPEDITION_FIELD_COMPATIBILITY = deepFreeze({
  radios: TRANSMITTERS
    .filter((radio) => FIELD_RADIO_DRAWS[radio.id] && radio.modes?.includes("CW"))
    .map((radio) => ({
      id: radio.id,
      outputPowerWatts: radio.powerWatts,
      ...FIELD_RADIO_DRAWS[radio.id],
    })),
  antennas: ANTENNAS
    .filter((antenna) => FIELD_ANTENNA_CODES[antenna.id])
    .map((antenna) => ({ id: antenna.id, antennaCode: FIELD_ANTENNA_CODES[antenna.id] })),
  batteries: ACCESSORIES
    .filter((accessory) => accessory.expeditionCategory === "battery"
      && Number.isFinite(accessory.capacityWh) && accessory.capacityWh > 0)
    .map((accessory) => ({ id: accessory.id, capacityWh: accessory.capacityWh })),
  // No ordinary accessory is currently a field battery, so owned combinations intentionally fail closed.
  ownedCombinations: [],
});

function canonicalLoanLoadout() {
  return {
    source: "loan",
    radioId: EXPEDITION_LOAN_KIT.radio.id,
    antennaId: EXPEDITION_LOAN_KIT.antenna.id,
    batteryId: EXPEDITION_LOAN_KIT.battery.id,
    outputPowerWatts: EXPEDITION_LOAN_KIT.radio.exchangePowerWatts,
    receiveDrawWatts: EXPEDITION_LOAN_KIT.radio.receiveDrawWatts,
    transmitDrawWatts: EXPEDITION_LOAN_KIT.radio.transmitDrawWatts,
    antennaCode: EXPEDITION_LOAN_KIT.antenna.exchangeCode,
    capacityWh: EXPEDITION_LOAN_KIT.battery.capacityWh,
  };
}

function canonicalOwnedLoadout(value) {
  const radioId = boundedId(own(value, "radioId"));
  const antennaId = boundedId(own(value, "antennaId"));
  const batteryId = boundedId(own(value, "batteryId"));
  const combination = EXPEDITION_FIELD_COMPATIBILITY.ownedCombinations.find((candidate) => (
    candidate.radioId === radioId
      && candidate.antennaId === antennaId
      && candidate.batteryId === batteryId
  ));
  if (!combination) return null;
  const radio = EXPEDITION_FIELD_COMPATIBILITY.radios.find(({ id }) => id === radioId);
  const antenna = EXPEDITION_FIELD_COMPATIBILITY.antennas.find(({ id }) => id === antennaId);
  const battery = EXPEDITION_FIELD_COMPATIBILITY.batteries.find(({ id }) => id === batteryId);
  return radio && antenna && battery ? {
    source: "owned",
    radioId,
    antennaId,
    batteryId,
    outputPowerWatts: radio.outputPowerWatts,
    receiveDrawWatts: radio.receiveDrawWatts,
    transmitDrawWatts: radio.transmitDrawWatts,
    antennaCode: antenna.antennaCode,
    capacityWh: battery.capacityWh,
  } : null;
}

export function expeditionSiteById(value) {
  const id = String(value ?? "").trim();
  return EXPEDITION_SITES.find((site) => site.id === id) ?? null;
}

export function normalizeExpeditionLoadout(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const suppliedSource = own(value, "source");
  const source = suppliedSource === "owned" ? "owned" : suppliedSource === "loan" ? "loan" : null;
  if (!source) return null;
  if (source === "owned") {
    const canonicalOwned = canonicalOwnedLoadout(value);
    return canonicalOwned ? deepFreeze(canonicalOwned) : null;
  }
  const radioId = boundedId(own(value, "radioId"));
  const antennaId = boundedId(own(value, "antennaId"));
  const batteryId = boundedId(own(value, "batteryId"));
  const antennaCode = boundedCode(own(value, "antennaCode"));
  if (!source || !radioId || !antennaId || !batteryId || !antennaCode) return null;
  const loadout = {
    source,
    radioId,
    antennaId,
    batteryId,
    outputPowerWatts: boundedNumber(own(value, "outputPowerWatts"), 1, 100, 5),
    receiveDrawWatts: boundedNumber(own(value, "receiveDrawWatts"), 0.1, 100, 2),
    transmitDrawWatts: boundedNumber(own(value, "transmitDrawWatts"), 0.1, 500, 12),
    antennaCode,
    capacityWh: boundedNumber(own(value, "capacityWh"), 1, 2_000, 96),
  };
  const canonical = canonicalLoanLoadout();
  if (Object.keys(canonical).some((key) => loadout[key] !== canonical[key])) return null;
  return deepFreeze(loadout);
}

export function createExpeditionLoadout(save, choice = {}) {
  const source = own(choice, "source") === "owned" ? "owned" : "loan";
  if (source === "loan") {
    return normalizeExpeditionLoadout(canonicalLoanLoadout());
  }
  const normalized = normalizeExpeditionLoadout({ ...choice, source: "owned" });
  if (!normalized) return null;
  const recentOwned = (value) => Array.isArray(value) ? value.slice(-1_000) : [];
  const ownedEquipment = new Set(recentOwned(own(save, "ownedEquipment")));
  const ownedAntennas = new Set(recentOwned(own(save, "ownedAntennas")));
  const ownedAccessories = new Set(recentOwned(own(save, "accessories")));
  return ownedEquipment.has(normalized.radioId)
    && ownedAntennas.has(normalized.antennaId)
    && ownedAccessories.has(normalized.batteryId)
    ? normalized : null;
}
