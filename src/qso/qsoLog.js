export const MAX_QSO_LOGS = 200;

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

  return {
    version: 1,
    id: normalizeId(entry.id, callsign, completedAt),
    startedAt,
    completedAt,
    playerCallsign,
    callsign,
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
    propagationSource: String(entry.propagationSource ?? "OFFLINE_DEFAULT").trim().slice(0, 48) || "OFFLINE_DEFAULT",
    equipmentId: String(entry.equipmentId ?? "squid-01").trim().slice(0, 48) || "squid-01",
    antennaId: String(entry.antennaId ?? "none").trim().slice(0, 48) || "none",
    playerLocationId: String(entry.playerLocationId ?? entry.locationId ?? "unknown").trim().slice(0, 64) || "unknown",
    wpm: Number(Math.max(0, finiteNumber(entry.wpm)).toFixed(1)),
    copyAccuracy: normalizeScore(entry.copyAccuracy),
    keyingScore: normalizeScore(entry.keyingScore),
    credits: Math.max(0, Math.floor(finiteNumber(entry.credits ?? entry.creditsAwarded))),
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
    return { save, added: false, newRegion: false, newDistanceRecord: false };
  }

  const newRegion = !previousRecords.contactedRegions.includes(entry.location);
  const newDistanceRecord = !previousRecords.longestQsoId || entry.distanceKm > previousRecords.longestDistanceKm;
  const qsoLogs = appendQsoLog(currentLogs, entry);
  const contactedRegions = newRegion
    ? [...previousRecords.contactedRegions, entry.location].sort()
    : previousRecords.contactedRegions;
  const qsoRecords = {
    total: previousRecords.total + 1,
    longestDistanceKm: newDistanceRecord ? entry.distanceKm : previousRecords.longestDistanceKm,
    longestQsoId: newDistanceRecord ? entry.id : previousRecords.longestQsoId,
    contactedRegions,
    settledQsoIds: [...previousRecords.settledQsoIds, entry.id].sort(),
  };
  const credits = Math.max(0, finiteNumber(save.credits)) + entry.credits;

  return {
    save: { ...save, credits, qsoLogs, qsoRecords },
    added: true,
    newRegion,
    newDistanceRecord,
  };
}
