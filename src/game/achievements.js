import { normalizeQsoLogEntry } from "../qso/qsoLog.js";

const ACHIEVEMENTS = [
  { id: "first-qso", metric: "total", target: 1 },
  { id: "qso-5", metric: "total", target: 5 },
  { id: "qso-10", metric: "total", target: 10 },
  { id: "dx-5000", metric: "distance", target: 5000 },
  { id: "weak-signal", metric: "weakSignal", target: 1 },
  { id: "regions-3", metric: "regions", target: 3 },
];

function nonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function rawLogsForSave(save) {
  if (Array.isArray(save?.qsoLogs)) return save.qsoLogs;
  return Array.isArray(save?.qsoLogEntries) ? save.qsoLogEntries : [];
}

function completedLogs(save) {
  return rawLogsForSave(save)
    .map((entry) => ({ raw: entry, normalized: normalizeQsoLogEntry(entry) }))
    .filter(({ normalized }) => normalized !== null);
}

function achievementMetrics(save) {
  const logs = completedLogs(save);
  const records = save?.qsoRecords && typeof save.qsoRecords === "object"
    ? save.qsoRecords
    : {};

  const recordedTotal = Math.floor(nonNegativeNumber(records.total));
  const total = Math.max(recordedTotal, logs.length);

  const logDistance = logs.reduce(
    (longest, { normalized }) => Math.max(longest, normalized.distanceKm),
    0,
  );
  const distance = Math.max(nonNegativeNumber(records.longestDistanceKm), logDistance);

  const regions = new Set();
  if (Array.isArray(records.contactedRegions)) {
    for (const value of records.contactedRegions) {
      const region = typeof value === "string" ? value.trim().toUpperCase() : "";
      if (region) regions.add(region);
    }
  }
  for (const { normalized } of logs) regions.add(normalized.location.toUpperCase());

  const retainedWeakSignalCount = logs.filter(({ raw }) => {
    const value = raw?.finalPropagationLevel ?? raw?.finalLevel;
    if (value === null || value === undefined || value === "") return false;
    const level = Number(value);
    return Number.isFinite(level) && level >= 0 && level <= 2;
  }).length;
  const weakSignal = Math.max(
    Math.floor(nonNegativeNumber(records.weakSignalQsos)),
    retainedWeakSignalCount,
  );

  return {
    total,
    distance,
    weakSignal,
    regions: regions.size,
  };
}

/**
 * Derives achievement state from both aggregate QSO records and retained logs.
 * The function is intentionally pure so old or partially corrupted saves can be
 * inspected without mutating or migrating them first.
 */
export function evaluateAchievements(save) {
  const metrics = achievementMetrics(save);
  return ACHIEVEMENTS.map(({ id, metric, target }) => {
    const current = metrics[metric];
    return {
      id,
      current,
      target,
      unlocked: current >= target,
      progress: Math.min(1, current / target),
    };
  });
}
