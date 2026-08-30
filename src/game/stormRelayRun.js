export const STORM_RELAY_STATE_VERSION = 1;

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

const frozenEmptyArray = () => Object.freeze([]);

export function normalizeStormRelayRun() {
  return null;
}

export function emptyStormRelayState() {
  return Object.freeze({
    version: STORM_RELAY_STATE_VERSION,
    activeRun: null,
    completedRuns: frozenEmptyArray(),
    settledRunIds: frozenEmptyArray(),
    settlementProofs: frozenEmptyArray(),
    archive: frozenEmptyArray(),
    taskTreeUnlocked: false,
  });
}

export function normalizeStormRelayState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.freeze({
    ...emptyStormRelayState(),
    taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
  });
}
