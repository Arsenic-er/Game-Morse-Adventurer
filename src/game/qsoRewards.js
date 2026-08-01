export const QSO_REWARD_BREAKDOWN_VERSION = 1;

export const QSO_REWARD_VALUES = Object.freeze({
  base: 100,
  independentWatch: 50,
  weakSignal: 75,
  newRegion: 20,
  newDistanceRecord: 25,
});

const OPTIONAL_REWARD_KEYS = Object.freeze([
  "independentWatch",
  "weakSignal",
  "newRegion",
  "newDistanceRecord",
]);

function fixedReward(value, expected) {
  return Number(value) === expected ? expected : 0;
}

export function isWeakSignalLevel(value) {
  if (value === null || value === undefined || value === "") return false;
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= 2;
}

export function normalizeQsoRewardBreakdown(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Number(value.version) !== QSO_REWARD_BREAKDOWN_VERSION) return null;

  const base = fixedReward(value.base, QSO_REWARD_VALUES.base);
  if (base !== QSO_REWARD_VALUES.base) return null;

  const normalized = {
    version: QSO_REWARD_BREAKDOWN_VERSION,
    base,
  };
  for (const key of OPTIONAL_REWARD_KEYS) {
    normalized[key] = fixedReward(value[key], QSO_REWARD_VALUES[key]);
  }
  normalized.total = base + OPTIONAL_REWARD_KEYS.reduce((total, key) => total + normalized[key], 0);
  return normalized;
}

export function calculateQsoRewardBreakdown({
  independentWatch = false,
  finalPropagationLevel = null,
  newRegion = false,
  newDistanceRecord = false,
} = {}) {
  return normalizeQsoRewardBreakdown({
    version: QSO_REWARD_BREAKDOWN_VERSION,
    base: QSO_REWARD_VALUES.base,
    independentWatch: independentWatch === true ? QSO_REWARD_VALUES.independentWatch : 0,
    weakSignal: isWeakSignalLevel(finalPropagationLevel) ? QSO_REWARD_VALUES.weakSignal : 0,
    newRegion: newRegion === true ? QSO_REWARD_VALUES.newRegion : 0,
    newDistanceRecord: newDistanceRecord === true ? QSO_REWARD_VALUES.newDistanceRecord : 0,
  });
}
