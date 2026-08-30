export const LISTENING_STATE_VERSION = 1;
export const LISTENING_RUN_VERSION = 1;

export const LISTENING_PHASES = Object.freeze({
  BRIEFING: "BRIEFING",
  LISTENING: "LISTENING",
  CALL_READY: "CALL_READY",
  WAITING: "WAITING",
  DECISION: "DECISION",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

const TARGET_CALLSIGN = "SIM11LS";
const TARGET_STATION_ID = "station:chapter11:sim11ls";
const TARGET_PERSON_ID = "person:chapter11:silent-listener";
const CONCLUSION_KEY = "chapter11.conclusion.no-reply-after-listening";
const ACTIVE_TIMEOUT_MS = 600_000;
const MAX_CALLS = 2;
const MAX_ERRORS = 3;
const TERMINAL_PHASES = new Set([
  LISTENING_PHASES.COMPLETED,
  LISTENING_PHASES.FAILED,
  LISTENING_PHASES.ABANDONED,
]);
const PHASES = new Set(Object.values(LISTENING_PHASES));
const FAILURE_REASONS = new Set(["TIMED_OUT", "CALL_LIMIT_EXCEEDED"]);
const ERROR_CODES = new Set([
  "SEMANTIC_UNSAFE",
  "CALL_FORMAT_INVALID",
  "TARGET_CALLSIGN_MISMATCH",
  "PLAYER_CALLSIGN_MISMATCH",
]);

const LISTENING_WINDOWS = Object.freeze([
  Object.freeze({ id: "window-1", propagationLevel: 1, noiseLevel: "high" }),
  Object.freeze({ id: "window-2", propagationLevel: 1, noiseLevel: "medium" }),
  Object.freeze({ id: "window-3", propagationLevel: 0, noiseLevel: "low" }),
]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownArrayLength(value) {
  if (!Array.isArray(value)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "length");
    return descriptor && Object.hasOwn(descriptor, "value") && Number.isSafeInteger(descriptor.value)
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function strictArray(value, maxLength, normalizeItem) {
  const length = ownArrayLength(value);
  if (length === null || length > maxLength) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return null;
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value, index);
    if (item === null) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

function boundedText(value, maxLength = 96) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) return null;
  return value;
}

function normalizeCallsign(value) {
  if (typeof value !== "string" || value.length > 24) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{3,12}$/.test(normalized) ? normalized : null;
}

function normalizeIso(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

function safeInteger(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function hash32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function makeRunId(seed, startedAt, retryCount) {
  return `listening:${hash32(`${seed}|${startedAt}|${retryCount}`)}`;
}

function normalizedWindows(value) {
  const windows = strictArray(value, LISTENING_WINDOWS.length, (entry, index) => {
    const expected = LISTENING_WINDOWS[index];
    if (
      own(entry, "id") !== expected.id
      || own(entry, "propagationLevel") !== expected.propagationLevel
      || own(entry, "noiseLevel") !== expected.noiseLevel
    ) return null;
    return { ...expected };
  });
  return windows?.length === LISTENING_WINDOWS.length ? windows : null;
}

function normalizedObservedIds(value) {
  return strictArray(value, LISTENING_WINDOWS.length, (entry, index) => (
    entry === LISTENING_WINDOWS[index].id ? entry : null
  ));
}

function normalizedErrors(value) {
  return strictArray(value, MAX_ERRORS, (entry) => (ERROR_CODES.has(entry) ? entry : null));
}

function appendError(run, code) {
  return deepFreeze({ ...run, errors: [...run.errors, code].slice(-MAX_ERRORS) });
}

function terminal(run) {
  return TERMINAL_PHASES.has(run?.phase);
}

function failRun(run, reason, at) {
  if (terminal(run)) return run;
  return deepFreeze({
    ...run,
    phase: LISTENING_PHASES.FAILED,
    failureReason: reason,
    completedAt: normalizeIso(at, true),
    summary: null,
  });
}

function createAttempt({ playerCallsign, seed, startedAt, retryCount = 0 }) {
  const callsign = normalizeCallsign(playerCallsign);
  const normalizedSeed = boundedText(seed, 96);
  const normalizedStartedAt = normalizeIso(startedAt);
  const normalizedRetryCount = safeInteger(retryCount, 0, 1_000);
  if (!callsign || !normalizedSeed || !normalizedStartedAt || normalizedRetryCount === null) return null;
  return deepFreeze({
    version: LISTENING_RUN_VERSION,
    runId: makeRunId(normalizedSeed, normalizedStartedAt, normalizedRetryCount),
    seed: normalizedSeed,
    playerCallsign: callsign,
    targetCallsign: TARGET_CALLSIGN,
    stationId: TARGET_STATION_ID,
    personId: TARGET_PERSON_ID,
    windows: LISTENING_WINDOWS.map((entry) => ({ ...entry })),
    observedWindowIds: [],
    callCount: 0,
    phase: LISTENING_PHASES.BRIEFING,
    activeMilliseconds: 0,
    startedAt: normalizedStartedAt,
    completedAt: null,
    lastCallAt: null,
    lastWaitCompletedAt: null,
    errors: [],
    failureReason: null,
    retryCount: normalizedRetryCount,
    summary: null,
  });
}

export function createListeningRun(input = {}) {
  return createAttempt({
    playerCallsign: own(input, "playerCallsign"),
    seed: own(input, "seed"),
    startedAt: own(input, "startedAt"),
  });
}

export function observeListeningWindow(run, at) {
  if (!run || ![LISTENING_PHASES.BRIEFING, LISTENING_PHASES.LISTENING].includes(run.phase)) return run;
  const observedAt = normalizeIso(at);
  const next = LISTENING_WINDOWS[run.observedWindowIds.length];
  if (!observedAt || !next || Date.parse(observedAt) < Date.parse(run.startedAt)) return run;
  const observedWindowIds = [...run.observedWindowIds, next.id];
  return deepFreeze({
    ...run,
    observedWindowIds,
    phase: observedWindowIds.length === LISTENING_WINDOWS.length
      ? LISTENING_PHASES.CALL_READY
      : LISTENING_PHASES.LISTENING,
  });
}

function parseCall(text, run) {
  if (typeof text !== "string" || text.length > 96) return "CALL_FORMAT_INVALID";
  const tokens = text.trim().toUpperCase().split(/\s+/u);
  if (tokens[0] !== run.targetCallsign) return "TARGET_CALLSIGN_MISMATCH";
  const compact = tokens.length === 3 && tokens[2] === "K";
  const canonical = tokens.length === 4 && tokens[1] === "DE" && tokens[3] === "K";
  if (!compact && !canonical) return "CALL_FORMAT_INVALID";
  const player = compact ? tokens[1] : tokens[2];
  return player === run.playerCallsign ? null : "PLAYER_CALLSIGN_MISMATCH";
}

export function submitListeningCall(run, text, semantic, at) {
  if (!run || ![LISTENING_PHASES.CALL_READY, LISTENING_PHASES.DECISION].includes(run.phase)) return run;
  if (run.callCount >= MAX_CALLS) return failRun(run, "CALL_LIMIT_EXCEEDED", at);
  if (own(semantic, "safeToCommit") !== true) return appendError(run, "SEMANTIC_UNSAFE");
  const error = parseCall(text, run);
  if (error) return appendError(run, error);
  const submittedAt = normalizeIso(at);
  if (!submittedAt || Date.parse(submittedAt) < Date.parse(run.startedAt)) return run;
  return deepFreeze({ ...run, callCount: run.callCount + 1, phase: LISTENING_PHASES.WAITING, lastCallAt: submittedAt });
}

export function finishListeningWait(run, at) {
  if (!run || run.phase !== LISTENING_PHASES.WAITING) return run;
  const completedAt = normalizeIso(at);
  if (!completedAt || !run.lastCallAt || Date.parse(completedAt) < Date.parse(run.lastCallAt)) return run;
  return deepFreeze({ ...run, phase: LISTENING_PHASES.DECISION, lastWaitCompletedAt: completedAt });
}

export function recordListeningSilence(run, at) {
  if (!run || run.phase !== LISTENING_PHASES.DECISION) return run;
  const completedAt = normalizeIso(at);
  if (
    !completedAt
    || run.observedWindowIds.length !== LISTENING_WINDOWS.length
    || run.callCount < 1
    || run.callCount > MAX_CALLS
    || !run.lastWaitCompletedAt
    || Date.parse(completedAt) < Date.parse(run.lastWaitCompletedAt)
  ) return run;
  const summary = {
    runId: run.runId,
    playerCallsign: run.playerCallsign,
    targetCallsign: run.targetCallsign,
    stationId: run.stationId,
    personId: run.personId,
    observationIds: [...run.observedWindowIds],
    callCount: run.callCount,
    activeMilliseconds: run.activeMilliseconds,
    conclusionKey: CONCLUSION_KEY,
    completedAt,
  };
  return deepFreeze({ ...run, phase: LISTENING_PHASES.COMPLETED, completedAt, failureReason: null, summary });
}

export function tickListeningRun(run, input = {}, at = null) {
  if (!run || terminal(run) || own(input, "paused") === true) return run;
  const seconds = own(input, "seconds");
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3_600) return run;
  const activeMilliseconds = Math.min(ACTIVE_TIMEOUT_MS, run.activeMilliseconds + Math.round(seconds * 1_000));
  if (activeMilliseconds >= ACTIVE_TIMEOUT_MS) return failRun({ ...run, activeMilliseconds }, "TIMED_OUT", at);
  return deepFreeze({ ...run, activeMilliseconds });
}

export function abandonListeningRun(run, at) {
  if (!run || terminal(run)) return run;
  const completedAt = normalizeIso(at);
  if (!completedAt) return run;
  return deepFreeze({ ...run, phase: LISTENING_PHASES.ABANDONED, completedAt, summary: null });
}

export function retryListeningRun(run, startedAt) {
  if (!run || ![LISTENING_PHASES.FAILED, LISTENING_PHASES.ABANDONED].includes(run.phase)) return run;
  return createAttempt({ playerCallsign: run.playerCallsign, seed: run.seed, startedAt, retryCount: run.retryCount + 1 }) ?? run;
}

function normalizeSummary(value, run) {
  if (value === null && run.phase !== LISTENING_PHASES.COMPLETED) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const observationIds = normalizedObservedIds(own(value, "observationIds"));
  const completedAt = normalizeIso(own(value, "completedAt"));
  const callCount = safeInteger(own(value, "callCount"), 1, MAX_CALLS);
  const activeMilliseconds = safeInteger(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS);
  if (
    own(value, "runId") !== run.runId
    || own(value, "playerCallsign") !== run.playerCallsign
    || own(value, "targetCallsign") !== TARGET_CALLSIGN
    || own(value, "stationId") !== TARGET_STATION_ID
    || own(value, "personId") !== TARGET_PERSON_ID
    || !observationIds
    || observationIds.length !== LISTENING_WINDOWS.length
    || callCount === null
    || activeMilliseconds === null
    || own(value, "conclusionKey") !== CONCLUSION_KEY
    || !completedAt
    || completedAt !== run.completedAt
  ) return undefined;
  return {
    runId: run.runId,
    playerCallsign: run.playerCallsign,
    targetCallsign: TARGET_CALLSIGN,
    stationId: TARGET_STATION_ID,
    personId: TARGET_PERSON_ID,
    observationIds,
    callCount,
    activeMilliseconds,
    conclusionKey: CONCLUSION_KEY,
    completedAt,
  };
}

export function normalizeListeningRun(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const version = own(value, "version");
  const runId = boundedText(own(value, "runId"), 64);
  const seed = boundedText(own(value, "seed"), 96);
  const playerCallsign = normalizeCallsign(own(value, "playerCallsign"));
  const windows = normalizedWindows(own(value, "windows"));
  const observedWindowIds = normalizedObservedIds(own(value, "observedWindowIds"));
  const callCount = safeInteger(own(value, "callCount"), 0, MAX_CALLS);
  const phase = own(value, "phase");
  const activeMilliseconds = safeInteger(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS);
  const startedAt = normalizeIso(own(value, "startedAt"));
  const completedAt = normalizeIso(own(value, "completedAt"), true);
  const lastCallAt = normalizeIso(own(value, "lastCallAt"), true);
  const lastWaitCompletedAt = normalizeIso(own(value, "lastWaitCompletedAt"), true);
  const errors = normalizedErrors(own(value, "errors"));
  const failureReason = own(value, "failureReason");
  const retryCount = safeInteger(own(value, "retryCount"), 0, 1_000);
  if (
    version !== LISTENING_RUN_VERSION || !runId || !seed || !playerCallsign
    || own(value, "targetCallsign") !== TARGET_CALLSIGN
    || own(value, "stationId") !== TARGET_STATION_ID
    || own(value, "personId") !== TARGET_PERSON_ID
    || !windows || !observedWindowIds || callCount === null || !PHASES.has(phase)
    || activeMilliseconds === null || !startedAt || completedAt === undefined
    || lastCallAt === undefined || lastWaitCompletedAt === undefined || !errors || retryCount === null
    || (failureReason !== null && !FAILURE_REASONS.has(failureReason))
    || runId !== makeRunId(seed, startedAt, retryCount)
  ) return null;
  if (
    (phase === LISTENING_PHASES.BRIEFING && observedWindowIds.length !== 0)
    || (phase === LISTENING_PHASES.LISTENING && ![1, 2].includes(observedWindowIds.length))
    || ([LISTENING_PHASES.CALL_READY, LISTENING_PHASES.WAITING, LISTENING_PHASES.DECISION, LISTENING_PHASES.COMPLETED].includes(phase)
      && observedWindowIds.length !== LISTENING_WINDOWS.length)
    || (phase === LISTENING_PHASES.WAITING && (!lastCallAt || callCount < 1))
    || (phase === LISTENING_PHASES.DECISION && (!lastWaitCompletedAt || callCount < 1))
    || (phase === LISTENING_PHASES.COMPLETED && (!completedAt || failureReason !== null))
    || (phase === LISTENING_PHASES.FAILED && !failureReason)
    || (phase === LISTENING_PHASES.ABANDONED && !completedAt)
    || Date.parse(completedAt ?? startedAt) < Date.parse(startedAt)
    || (lastCallAt && Date.parse(lastCallAt) < Date.parse(startedAt))
    || (lastWaitCompletedAt && (!lastCallAt || Date.parse(lastWaitCompletedAt) < Date.parse(lastCallAt)))
  ) return null;
  const partial = {
    version, runId, seed, playerCallsign,
    targetCallsign: TARGET_CALLSIGN,
    stationId: TARGET_STATION_ID,
    personId: TARGET_PERSON_ID,
    windows, observedWindowIds, callCount, phase, activeMilliseconds,
    startedAt, completedAt, lastCallAt, lastWaitCompletedAt,
    errors, failureReason, retryCount,
  };
  const summary = normalizeSummary(own(value, "summary"), partial);
  if (summary === undefined || (phase === LISTENING_PHASES.COMPLETED && !summary)) return null;
  return deepFreeze({ ...partial, summary });
}

function strictArrayTail(value, maxLength, normalizeItem) {
  const length = ownArrayLength(value);
  if (length === null) return null;
  const result = [];
  const start = Math.max(0, length - maxLength);
  for (let index = start; index < length; index += 1) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return null;
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value, index - start);
    if (item === null) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

export function normalizeListeningSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runId = boundedText(own(value, "runId"), 64);
  const playerCallsign = normalizeCallsign(own(value, "playerCallsign"));
  const observationIds = normalizedObservedIds(own(value, "observationIds"));
  const callCount = safeInteger(own(value, "callCount"), 1, MAX_CALLS);
  const activeMilliseconds = safeInteger(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS);
  const completedAt = normalizeIso(own(value, "completedAt"));
  if (
    !runId || !playerCallsign || own(value, "targetCallsign") !== TARGET_CALLSIGN
    || own(value, "stationId") !== TARGET_STATION_ID || own(value, "personId") !== TARGET_PERSON_ID
    || !observationIds || observationIds.length !== LISTENING_WINDOWS.length
    || callCount === null || activeMilliseconds === null
    || own(value, "conclusionKey") !== CONCLUSION_KEY || !completedAt
  ) return null;
  return deepFreeze({
    runId, playerCallsign, targetCallsign: TARGET_CALLSIGN, stationId: TARGET_STATION_ID,
    personId: TARGET_PERSON_ID, observationIds, callCount, activeMilliseconds,
    conclusionKey: CONCLUSION_KEY, completedAt,
  });
}

function normalizeListeningProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runId = boundedText(own(value, "runId"), 64);
  const recordId = boundedText(own(value, "recordId"), 96);
  const playerCallsign = normalizeCallsign(own(value, "playerCallsign"));
  const completedAt = normalizeIso(own(value, "completedAt"));
  const observationCount = safeInteger(own(value, "observationCount"), 3, 3);
  const callCount = safeInteger(own(value, "callCount"), 1, MAX_CALLS);
  if (
    !runId || recordId !== `listening-record:${runId}` || !playerCallsign || !completedAt
    || own(value, "targetCallsign") !== TARGET_CALLSIGN
    || own(value, "stationId") !== TARGET_STATION_ID || own(value, "personId") !== TARGET_PERSON_ID
    || observationCount === null || callCount === null || own(value, "conclusionKey") !== CONCLUSION_KEY
  ) return null;
  return deepFreeze({
    runId, recordId, playerCallsign, targetCallsign: TARGET_CALLSIGN,
    stationId: TARGET_STATION_ID, personId: TARGET_PERSON_ID, observationCount,
    callCount, conclusionKey: CONCLUSION_KEY, completedAt,
  });
}

function normalizeListeningRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runId = boundedText(own(value, "runId"), 64);
  const id = boundedText(own(value, "id"), 96);
  const playerCallsign = normalizeCallsign(own(value, "playerCallsign"));
  const observationIds = normalizedObservedIds(own(value, "observationIds"));
  const callCount = safeInteger(own(value, "callCount"), 1, MAX_CALLS);
  const activeMilliseconds = safeInteger(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS);
  const completedAt = normalizeIso(own(value, "completedAt"));
  if (
    !runId || id !== `listening-record:${runId}` || !playerCallsign || !observationIds
    || observationIds.length !== LISTENING_WINDOWS.length || callCount === null
    || activeMilliseconds === null || !completedAt
    || own(value, "targetCallsign") !== TARGET_CALLSIGN
    || own(value, "stationId") !== TARGET_STATION_ID || own(value, "personId") !== TARGET_PERSON_ID
    || own(value, "conclusionKey") !== CONCLUSION_KEY
  ) return null;
  return deepFreeze({
    id, runId, playerCallsign, targetCallsign: TARGET_CALLSIGN, stationId: TARGET_STATION_ID,
    personId: TARGET_PERSON_ID, observationIds, callCount, activeMilliseconds,
    conclusionKey: CONCLUSION_KEY, completedAt,
  });
}

function orderedUnique(entries, idKey, timeKey) {
  let previous = null;
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry[idKey])) return false;
    if (previous && (entry[timeKey] < previous[timeKey]
      || (entry[timeKey] === previous[timeKey] && entry[idKey] <= previous[idKey]))) return false;
    ids.add(entry[idKey]);
    previous = entry;
  }
  return true;
}

function normalizeRunIds(value) {
  const ids = strictArrayTail(value, 80, (entry) => boundedText(entry, 64));
  if (!ids) return null;
  for (let index = 1; index < ids.length; index += 1) if (ids[index - 1] >= ids[index]) return null;
  return ids;
}

function frozenEmptyArray() {
  return Object.freeze([]);
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
  const activeValue = own(source, "activeRun");
  const activeRun = activeValue === null || activeValue === undefined ? null : normalizeListeningRun(activeValue);
  const completedRuns = strictArrayTail(own(source, "completedRuns") ?? [], 80, normalizeListeningSummary);
  const settledRunIds = normalizeRunIds(own(source, "settledRunIds") ?? []);
  const settlementProofs = strictArrayTail(own(source, "settlementProofs") ?? [], 80, normalizeListeningProof);
  const archive = strictArrayTail(own(source, "archive") ?? [], 80, normalizeListeningRecord);
  if (
    (activeValue !== null && activeValue !== undefined && !activeRun)
    || !completedRuns || !settledRunIds || !settlementProofs || !archive
    || !orderedUnique(completedRuns, "runId", "completedAt")
    || !orderedUnique(settlementProofs, "runId", "completedAt")
    || !orderedUnique(archive, "runId", "completedAt")
  ) return emptyListeningState();
  return deepFreeze({
    version: LISTENING_STATE_VERSION,
    activeRun,
    completedRuns,
    settledRunIds,
    settlementProofs,
    archive,
    taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
  });
}
