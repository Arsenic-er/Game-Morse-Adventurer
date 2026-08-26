function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
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

export function expeditionSiteById(value) {
  const id = String(value ?? "").trim();
  return EXPEDITION_SITES.find((site) => site.id === id) ?? null;
}

export function normalizeExpeditionLoadout(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value.source === "owned" ? "owned" : value.source === "loan" ? "loan" : null;
  const radioId = boundedId(value.radioId);
  const antennaId = boundedId(value.antennaId);
  const batteryId = boundedId(value.batteryId);
  const antennaCode = boundedCode(value.antennaCode);
  if (!source || !radioId || !antennaId || !batteryId || !antennaCode) return null;
  const loadout = {
    source,
    radioId,
    antennaId,
    batteryId,
    outputPowerWatts: boundedNumber(value.outputPowerWatts, 1, 100, 5),
    receiveDrawWatts: boundedNumber(value.receiveDrawWatts, 0.1, 100, 2),
    transmitDrawWatts: boundedNumber(value.transmitDrawWatts, 0.1, 500, 12),
    antennaCode,
    capacityWh: boundedNumber(value.capacityWh, 1, 2_000, 96),
  };
  if (source === "loan") {
    const canonical = {
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
    if (Object.keys(canonical).some((key) => loadout[key] !== canonical[key])) return null;
  }
  return deepFreeze(loadout);
}

export function createExpeditionLoadout(save, choice = {}) {
  const source = choice?.source === "owned" ? "owned" : "loan";
  if (source === "loan") {
    return normalizeExpeditionLoadout({
      source,
      radioId: EXPEDITION_LOAN_KIT.radio.id,
      antennaId: EXPEDITION_LOAN_KIT.antenna.id,
      batteryId: EXPEDITION_LOAN_KIT.battery.id,
      outputPowerWatts: EXPEDITION_LOAN_KIT.radio.exchangePowerWatts,
      receiveDrawWatts: EXPEDITION_LOAN_KIT.radio.receiveDrawWatts,
      transmitDrawWatts: EXPEDITION_LOAN_KIT.radio.transmitDrawWatts,
      antennaCode: EXPEDITION_LOAN_KIT.antenna.exchangeCode,
      capacityWh: EXPEDITION_LOAN_KIT.battery.capacityWh,
    });
  }
  const normalized = normalizeExpeditionLoadout({ ...choice, source: "owned" });
  if (!normalized) return null;
  const recentOwned = (value) => Array.isArray(value) ? value.slice(-1_000) : [];
  const ownedEquipment = new Set(recentOwned(save?.ownedEquipment));
  const ownedAntennas = new Set(recentOwned(save?.ownedAntennas));
  const ownedAccessories = new Set(recentOwned(save?.accessories));
  return ownedEquipment.has(normalized.radioId)
    && ownedAntennas.has(normalized.antennaId)
    && ownedAccessories.has(normalized.batteryId)
    ? normalized : null;
}
