import { normalizeQsoLogEntry } from "../qso/qsoLog.js";

export const ACHIEVEMENT_REWARDS_VERSION = 1;

export const ACHIEVEMENT_CATALOG = Object.freeze([
  { id: "first-qso", category: "contact", metric: "total", target: 1, tier: "bronze", moneyReward: 120, technologyPointsReward: 0 },
  { id: "qso-5", category: "contact", metric: "total", target: 5, tier: "silver", moneyReward: 250, technologyPointsReward: 0 },
  { id: "qso-10", category: "contact", metric: "total", target: 10, tier: "gold", moneyReward: 400, technologyPointsReward: 1 },
  { id: "dx-5000", category: "expedition", metric: "distance", target: 5000, tier: "gold", moneyReward: 350, technologyPointsReward: 1 },
  { id: "weak-signal", category: "operation", metric: "weakSignal", target: 1, tier: "silver", moneyReward: 250, technologyPointsReward: 0 },
  { id: "regions-3", category: "expedition", metric: "regions", target: 3, tier: "silver", moneyReward: 300, technologyPointsReward: 0 },
  { id: "independent-watch", category: "operation", metric: "independent", target: 1, tier: "silver", moneyReward: 250, technologyPointsReward: 0 },
  { id: "radio-upgrade", category: "equipment", metric: "radios", target: 2, tier: "bronze", moneyReward: 200, technologyPointsReward: 0 },
  { id: "antenna-upgrade", category: "equipment", metric: "antennas", target: 2, tier: "bronze", moneyReward: 200, technologyPointsReward: 0 },
  { id: "first-accessory", category: "equipment", metric: "accessories", target: 1, tier: "bronze", moneyReward: 150, technologyPointsReward: 0 },
  { id: "first-name", category: "people", metric: "knownNames", target: 1, tier: "bronze", moneyReward: 100, technologyPointsReward: 0 },
]);

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENT_CATALOG.map(({ id }) => id));

function nonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function safeInteger(value) {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(nonNegativeNumber(value)));
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

function uniqueKnownNames(save) {
  return new Set((Array.isArray(save?.knownOperatorNames) ? save.knownOperatorNames : [])
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean)).size;
}

function achievementMetrics(save) {
  const logs = completedLogs(save);
  const records = save?.qsoRecords && typeof save.qsoRecords === "object" ? save.qsoRecords : {};
  const total = Math.max(Math.floor(nonNegativeNumber(records.total)), logs.length);
  const logDistance = logs.reduce((longest, { normalized }) => Math.max(longest, normalized.distanceKm), 0);
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
  const independent = logs.filter(({ normalized }) => normalized.independentWatch).length;

  return {
    total,
    distance,
    weakSignal: Math.max(Math.floor(nonNegativeNumber(records.weakSignalQsos)), retainedWeakSignalCount),
    regions: regions.size,
    independent,
    radios: new Set(Array.isArray(save?.ownedEquipment) ? save.ownedEquipment : []).size,
    antennas: new Set(Array.isArray(save?.ownedAntennas) ? save.ownedAntennas : []).size,
    accessories: new Set(Array.isArray(save?.accessories) ? save.accessories : []).size,
    knownNames: uniqueKnownNames(save),
  };
}

export function normalizeClaimedAchievementRewards(values) {
  const requested = new Set(Array.isArray(values) ? values : []);
  return ACHIEVEMENT_CATALOG.map(({ id }) => id).filter((id) => requested.has(id));
}

export function evaluateAchievements(save) {
  const metrics = achievementMetrics(save);
  return ACHIEVEMENT_CATALOG.map((definition) => {
    const current = metrics[definition.metric] ?? 0;
    return {
      ...definition,
      current,
      unlocked: current >= definition.target,
      progress: Math.min(1, current / definition.target),
      rewardClaimed: Array.isArray(save?.claimedAchievementRewards)
        && save.claimedAchievementRewards.includes(definition.id),
    };
  });
}

export function baselineAchievementRewardIds(save) {
  return evaluateAchievements(save).filter(({ unlocked }) => unlocked).map(({ id }) => id);
}

export function findNewlyUnlockedAchievements(previousSave, nextSave) {
  const previousById = new Map(evaluateAchievements(previousSave).map((item) => [item.id, item]));
  return evaluateAchievements(nextSave).filter((item) => item.unlocked && !previousById.get(item.id)?.unlocked);
}

/** Atomically claims all currently eligible achievement rewards exactly once. */
export function settleAchievementRewards(save) {
  if (!save || typeof save !== "object") throw new TypeError("A save record is required.");
  const claimed = normalizeClaimedAchievementRewards(save.claimedAchievementRewards);
  const claimedSet = new Set(claimed);
  const newlyAwarded = evaluateAchievements(save)
    .filter(({ id, unlocked }) => unlocked && ACHIEVEMENT_IDS.has(id) && !claimedSet.has(id));
  if (!newlyAwarded.length) {
    return {
      save: { ...save, achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION, claimedAchievementRewards: claimed },
      newlyAwarded: [], moneyAwarded: 0, technologyPointsAwarded: 0,
    };
  }
  const moneyAwarded = newlyAwarded.reduce((total, item) => total + item.moneyReward, 0);
  const technologyPointsAwarded = newlyAwarded.reduce((total, item) => total + item.technologyPointsReward, 0);
  return {
    save: {
      ...save,
      achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION,
      claimedAchievementRewards: normalizeClaimedAchievementRewards([...claimed, ...newlyAwarded.map(({ id }) => id)]),
      money: safeInteger(save.money ?? save.credits) + moneyAwarded,
      technologyPoints: safeInteger(save.technologyPoints) + technologyPointsAwarded,
      updatedAt: new Date().toISOString(),
    },
    newlyAwarded,
    moneyAwarded,
    technologyPointsAwarded,
  };
}
