export const LISTENING_STATE_VERSION = 1;

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function frozenEmptyArray() {
  return Object.freeze([]);
}

export function normalizeListeningRun() {
  return null;
}

export function emptyListeningState() {
  return Object.freeze({
    version: LISTENING_STATE_VERSION,
    activeRun: null,
    completedRuns: frozenEmptyArray(),
    settledRunIds: frozenEmptyArray(),
    settlementProofs: frozenEmptyArray(),
    archive: frozenEmptyArray(),
    taskTreeUnlocked: false,
  });
}

export function normalizeListeningState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.freeze({
    ...emptyListeningState(),
    taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
  });
}
