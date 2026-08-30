export const OPEN_STATION_STATE_VERSION = 1;

export const OPEN_STATION_GOALS = Object.freeze([
  "world-log",
  "people-network",
  "field-operations",
  "public-service",
  "contest-craft",
]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function normalizeGoal(value) {
  return typeof value === "string" && OPEN_STATION_GOALS.includes(value) ? value : null;
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function emptyOpenStationState() {
  return Object.freeze({
    version: OPEN_STATION_STATE_VERSION,
    unlocked: false,
    firstGoal: null,
    activeGoal: null,
    goalUpdatedAt: null,
  });
}

export function normalizeOpenStationState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const unlocked = own(source, "unlocked") === true;
  const firstGoal = unlocked ? normalizeGoal(own(source, "firstGoal")) : null;
  const activeGoal = unlocked ? normalizeGoal(own(source, "activeGoal")) : null;
  return Object.freeze({
    version: OPEN_STATION_STATE_VERSION,
    unlocked,
    firstGoal,
    activeGoal,
    goalUpdatedAt: activeGoal ? normalizeTimestamp(own(source, "goalUpdatedAt")) : null,
  });
}
