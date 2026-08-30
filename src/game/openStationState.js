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

export function normalizeOpenStationGoal(value) {
  return typeof value === "string" && OPEN_STATION_GOALS.includes(value) ? value : null;
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
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
  const requestedUnlock = own(source, "unlocked") === true;
  const firstGoal = requestedUnlock ? normalizeOpenStationGoal(own(source, "firstGoal")) : null;
  const activeGoal = requestedUnlock ? normalizeOpenStationGoal(own(source, "activeGoal")) : null;
  const goalUpdatedAt = activeGoal ? normalizeTimestamp(own(source, "goalUpdatedAt")) : null;
  const unlocked = Boolean(requestedUnlock && firstGoal && activeGoal && goalUpdatedAt);
  return Object.freeze({
    version: OPEN_STATION_STATE_VERSION,
    unlocked,
    firstGoal: unlocked ? firstGoal : null,
    activeGoal: unlocked ? activeGoal : null,
    goalUpdatedAt: unlocked ? goalUpdatedAt : null,
  });
}
