export const STORM_RELAY_STATE_VERSION = 1;
export const STORM_RELAY_RUN_VERSION = 1;

export const STORM_RELAY_PHASES = Object.freeze({
  CHECK_IN: "CHECK_IN",
  RECEIVING: "RECEIVING",
  CONFLICT: "CONFLICT",
  VERIFY_SOURCE: "VERIFY_SOURCE",
  RELAY: "RELAY",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

const TIMEOUT_MS = 720_000;
const MAX_BAD_RELAYS = 3;
const MAX_ERRORS = 8;
const PHASES = new Set(Object.values(STORM_RELAY_PHASES));
const TERMINAL = new Set([STORM_RELAY_PHASES.COMPLETED, STORM_RELAY_PHASES.FAILED, STORM_RELAY_PHASES.ABANDONED]);
const ERROR_CODES = new Set([
  "SEMANTIC_UNSAFE", "CHECK_IN_FORMAT_INVALID", "MESSAGE_ID_MISMATCH",
  "VERIFICATION_FORMAT_INVALID", "SOURCE_NOT_VERIFIED", "RELAY_FORMAT_INVALID",
  "REVISION_MISMATCH", "GRID_MISMATCH", "PEOPLE_MISMATCH", "ITEM_MISMATCH",
  "QUANTITY_MISMATCH", "CHECK_MISMATCH", "REPEAT_FORMAT_INVALID",
]);
const FAILURE_REASONS = new Set(["TIMED_OUT", "RELAY_ERROR_LIMIT"]);

const CONTROL = Object.freeze({
  callsign: "SIM12CS", npcId: "chapter12-control",
  personId: "person:procedural:chapter12-control", stationId: "station:procedural:chapter12-control",
});
const RELAY = Object.freeze({
  callsign: "SIM12RL", npcId: "chapter12-relay",
  personId: "person:procedural:chapter12-relay", stationId: "station:procedural:chapter12-relay",
});

function packetCheck({ msgId, revision, grid, people, item, quantity }) {
  const value = `${msgId}|${revision}|${grid}|${people}|${item}|${quantity}`;
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) sum = (sum + value.charCodeAt(index) * (index + 3)) % 100;
  return String(sum).padStart(2, "0");
}

function packet(input) {
  return Object.freeze({ ...input, check: packetCheck(input), isFictional: true });
}

const PACKETS = Object.freeze([
  packet({ id: "storm-214-r1-a", msgId: "214", revision: 1, grid: "PX-31", people: 6, item: "WATER", quantity: 4, sourceCallsign: RELAY.callsign }),
  packet({ id: "storm-214-r1-b", msgId: "214", revision: 1, grid: "PX-31", people: 8, item: "WATER", quantity: 4, sourceCallsign: RELAY.callsign }),
  packet({ id: "storm-214-r2", msgId: "214", revision: 2, grid: "PX-31", people: 8, item: "WATER", quantity: 6, sourceCallsign: CONTROL.callsign }),
]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch { return undefined; }
}

function ownArrayLength(value) {
  if (!Array.isArray(value)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "length");
    return descriptor && Object.hasOwn(descriptor, "value") && Number.isSafeInteger(descriptor.value)
      ? descriptor.value : null;
  } catch { return null; }
}

function strictArray(value, maximum, normalizeItem) {
  const length = ownArrayLength(value);
  if (length === null || length > maximum) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value, index);
    if (item === null) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

function boundedText(value, maximum = 96) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

function callsign(value) {
  if (typeof value !== "string" || value.length > 24) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{3,12}$/u.test(normalized) ? normalized : null;
}

function iso(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

function integer(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function hash32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function runId(seed, startedAt, retryCount) {
  return `storm-relay:${hash32(`${seed}|${startedAt}|${retryCount}`)}`;
}

function safeSemantic(value) { return own(value, "safeToCommit") === true; }
function terminal(run) { return TERMINAL.has(run?.phase); }

function appendError(run, code) {
  return deepFreeze({ ...run, errors: [...run.errors, code].slice(-MAX_ERRORS) });
}

function fail(run, reason, at) {
  if (terminal(run)) return run;
  return deepFreeze({ ...run, phase: STORM_RELAY_PHASES.FAILED, failureReason: reason, completedAt: iso(at, true), summary: null });
}

function attempt({ playerCallsign, seed, startedAt, retryCount = 0 }) {
  const player = callsign(playerCallsign);
  const normalizedSeed = boundedText(seed);
  const start = iso(startedAt);
  const retry = integer(retryCount, 0, 1_000);
  if (!player || !normalizedSeed || !start || retry === null) return null;
  return deepFreeze({
    version: STORM_RELAY_RUN_VERSION,
    runId: runId(normalizedSeed, start, retry),
    seed: normalizedSeed,
    playerCallsign: player,
    control: { ...CONTROL },
    relay: { ...RELAY },
    packets: PACKETS.map((entry) => ({ ...entry })),
    phase: STORM_RELAY_PHASES.CHECK_IN,
    verifiedPacketId: null,
    verificationRequested: false,
    badRelayCount: 0,
    recoveryActions: [],
    errors: [],
    activeMilliseconds: 0,
    startedAt: start,
    checkInAt: null,
    conflictReceivedAt: null,
    verifiedAt: null,
    completedAt: null,
    failureReason: null,
    retryCount: retry,
    summary: null,
  });
}

export function createStormRelayRun(input = {}) {
  return attempt({ playerCallsign: own(input, "playerCallsign"), seed: own(input, "seed"), startedAt: own(input, "startedAt") });
}

export function stormPacketText(value) {
  const msgId = own(value, "msgId");
  const revision = own(value, "revision");
  const grid = own(value, "grid");
  const people = own(value, "people");
  const item = own(value, "item");
  const quantity = own(value, "quantity");
  const check = own(value, "check");
  return `MSG ${msgId} REV ${revision} GRID ${grid} PEOPLE ${people} ITEM ${item} QTY ${quantity} CHECK ${check}`;
}

function tokens(text, maximum = 160) {
  if (typeof text !== "string" || text.length < 1 || text.length > maximum) return null;
  return text.trim().toUpperCase().split(/\s+/u);
}

export function submitStormCheckIn(run, text, semantic, at) {
  if (!run || run.phase !== STORM_RELAY_PHASES.CHECK_IN) return run;
  if (!safeSemantic(semantic)) return appendError(run, "SEMANTIC_UNSAFE");
  const value = tokens(text);
  if (!value || value.length !== 5 || value[0] !== CONTROL.callsign || value[1] !== "DE" || value[2] !== run.playerCallsign || value[3] !== "QTC" || value[4] !== "K") {
    return appendError(run, "CHECK_IN_FORMAT_INVALID");
  }
  const checkInAt = iso(at);
  if (!checkInAt || Date.parse(checkInAt) < Date.parse(run.startedAt)) return run;
  return deepFreeze({ ...run, phase: STORM_RELAY_PHASES.RECEIVING, checkInAt });
}

export function receiveStormConflict(run, at) {
  if (!run || run.phase !== STORM_RELAY_PHASES.RECEIVING) return run;
  const conflictReceivedAt = iso(at);
  if (!conflictReceivedAt || !run.checkInAt || Date.parse(conflictReceivedAt) < Date.parse(run.checkInAt)) return run;
  return deepFreeze({ ...run, phase: STORM_RELAY_PHASES.CONFLICT, conflictReceivedAt });
}

export function requestStormVerification(run, text, semantic, at) {
  if (!run || run.phase !== STORM_RELAY_PHASES.CONFLICT) return run;
  if (!safeSemantic(semantic)) return appendError(run, "SEMANTIC_UNSAFE");
  const value = tokens(text);
  if (!value || value[0] !== "AGN" || value[1] !== "MSG") return appendError(run, "VERIFICATION_FORMAT_INVALID");
  if (value[2] !== "214") return appendError(run, "MESSAGE_ID_MISMATCH");
  if (value.length !== 5 || value[3] !== "REV" || value[4] !== "K") return appendError(run, "VERIFICATION_FORMAT_INVALID");
  const verifiedAt = iso(at);
  if (!verifiedAt || !run.conflictReceivedAt || Date.parse(verifiedAt) < Date.parse(run.conflictReceivedAt)) return run;
  return deepFreeze({
    ...run,
    phase: STORM_RELAY_PHASES.RELAY,
    verifiedPacketId: "storm-214-r2",
    verificationRequested: true,
    verifiedAt,
  });
}

function parseRelay(text, canonical) {
  const value = tokens(text);
  if (!value || value.length !== 14 || value[0] !== "MSG" || value[2] !== "REV" || value[4] !== "GRID"
    || value[6] !== "PEOPLE" || value[8] !== "ITEM" || value[10] !== "QTY" || value[12] !== "CHECK") {
    return "RELAY_FORMAT_INVALID";
  }
  if (value[1] !== canonical.msgId) return "MESSAGE_ID_MISMATCH";
  if (value[3] !== String(canonical.revision)) return "REVISION_MISMATCH";
  if (value[5] !== canonical.grid) return "GRID_MISMATCH";
  if (value[7] !== String(canonical.people)) return "PEOPLE_MISMATCH";
  if (value[9] !== canonical.item) return "ITEM_MISMATCH";
  if (value[11] !== String(canonical.quantity)) return "QUANTITY_MISMATCH";
  if (value[13] !== canonical.check) return "CHECK_MISMATCH";
  return null;
}

function completedSummary(run, canonical, completedAt) {
  return {
    runId: run.runId,
    playerCallsign: run.playerCallsign,
    controlPersonId: run.control.personId,
    controlStationId: run.control.stationId,
    relayPersonId: run.relay.personId,
    relayStationId: run.relay.stationId,
    canonicalPacketId: canonical.id,
    msgId: canonical.msgId,
    revision: canonical.revision,
    grid: canonical.grid,
    people: canonical.people,
    item: canonical.item,
    quantity: canonical.quantity,
    check: canonical.check,
    verificationRequested: true,
    recoveryActions: [...run.recoveryActions],
    activeMilliseconds: run.activeMilliseconds,
    completedAt,
    isFictional: true,
  };
}

export function submitStormRelay(run, text, semantic, at) {
  if (!run || ![STORM_RELAY_PHASES.CONFLICT, STORM_RELAY_PHASES.RELAY].includes(run.phase)) return run;
  if (run.phase !== STORM_RELAY_PHASES.RELAY || !run.verifiedPacketId) return appendError(run, "SOURCE_NOT_VERIFIED");
  if (!safeSemantic(semantic)) return appendError(run, "SEMANTIC_UNSAFE");
  const canonical = run.packets.find(({ id }) => id === run.verifiedPacketId);
  const error = parseRelay(text, canonical);
  if (error) {
    const badRelayCount = run.badRelayCount + 1;
    const next = deepFreeze({ ...run, badRelayCount, errors: [...run.errors, error].slice(-MAX_ERRORS) });
    return badRelayCount >= MAX_BAD_RELAYS ? fail(next, "RELAY_ERROR_LIMIT", at) : next;
  }
  const completedAt = iso(at);
  if (!completedAt || !run.verifiedAt || Date.parse(completedAt) < Date.parse(run.verifiedAt)) return run;
  return deepFreeze({
    ...run,
    phase: STORM_RELAY_PHASES.COMPLETED,
    completedAt,
    failureReason: null,
    summary: completedSummary(run, canonical, completedAt),
  });
}

export function repeatStormMessage(run, text, semantic) {
  if (!run || terminal(run) || ![STORM_RELAY_PHASES.RECEIVING, STORM_RELAY_PHASES.CONFLICT, STORM_RELAY_PHASES.RELAY].includes(run.phase)) return run;
  if (!safeSemantic(semantic)) return appendError(run, "SEMANTIC_UNSAFE");
  const value = tokens(text);
  if (!value || value.length !== 4 || !["AGN", "QRS"].includes(value[0]) || value[1] !== "MSG" || value[2] !== "214" || value[3] !== "K") {
    return appendError(run, "REPEAT_FORMAT_INVALID");
  }
  return deepFreeze({ ...run, recoveryActions: [...run.recoveryActions, value[0]].slice(-8) });
}

export function tickStormRelayRun(run, input = {}, at = null) {
  if (!run || terminal(run) || own(input, "paused") === true) return run;
  const seconds = own(input, "seconds");
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3_600) return run;
  const activeMilliseconds = Math.min(TIMEOUT_MS, run.activeMilliseconds + Math.round(seconds * 1_000));
  if (activeMilliseconds >= TIMEOUT_MS) return fail({ ...run, activeMilliseconds }, "TIMED_OUT", at);
  return deepFreeze({ ...run, activeMilliseconds });
}

export function abandonStormRelayRun(run, at) {
  if (!run || terminal(run)) return run;
  const completedAt = iso(at);
  if (!completedAt) return run;
  return deepFreeze({ ...run, phase: STORM_RELAY_PHASES.ABANDONED, completedAt, summary: null });
}

export function retryStormRelayRun(run, startedAt) {
  if (!run || ![STORM_RELAY_PHASES.FAILED, STORM_RELAY_PHASES.ABANDONED].includes(run.phase)) return run;
  return attempt({ playerCallsign: run.playerCallsign, seed: run.seed, startedAt, retryCount: run.retryCount + 1 }) ?? run;
}

function normalizeIdentity(value, expected) {
  if (own(value, "callsign") !== expected.callsign || own(value, "npcId") !== expected.npcId
    || own(value, "personId") !== expected.personId || own(value, "stationId") !== expected.stationId) return null;
  return { ...expected };
}

function normalizePacket(value, index) {
  const expected = PACKETS[index];
  if (!expected) return null;
  for (const key of ["id", "msgId", "revision", "grid", "people", "item", "quantity", "check", "sourceCallsign", "isFictional"]) {
    if (own(value, key) !== expected[key]) return null;
  }
  return { ...expected };
}

function normalizeSummary(value, run) {
  if (value === null && run.phase !== STORM_RELAY_PHASES.COMPLETED) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const canonical = PACKETS[2];
  const recoveryActions = strictArray(own(value, "recoveryActions"), 8, (entry) => (["AGN", "QRS"].includes(entry) ? entry : null));
  const completedAt = iso(own(value, "completedAt"));
  if (!recoveryActions || !completedAt || completedAt !== run.completedAt) return undefined;
  const expected = completedSummary({ ...run, recoveryActions, activeMilliseconds: run.activeMilliseconds }, canonical, completedAt);
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (key === "recoveryActions") continue;
    if (own(value, key) !== expectedValue) return undefined;
  }
  return expected;
}

export function normalizeStormRelayRun(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const version = own(value, "version");
  const id = boundedText(own(value, "runId"), 64);
  const seed = boundedText(own(value, "seed"));
  const playerCallsign = callsign(own(value, "playerCallsign"));
  const control = normalizeIdentity(own(value, "control"), CONTROL);
  const relay = normalizeIdentity(own(value, "relay"), RELAY);
  const packets = strictArray(own(value, "packets"), 3, normalizePacket);
  const phase = own(value, "phase");
  const verifiedPacketId = own(value, "verifiedPacketId");
  const verificationRequested = own(value, "verificationRequested") === true;
  const badRelayCount = integer(own(value, "badRelayCount"), 0, MAX_BAD_RELAYS);
  const recoveryActions = strictArray(own(value, "recoveryActions"), 8, (entry) => (["AGN", "QRS"].includes(entry) ? entry : null));
  const errors = strictArray(own(value, "errors"), MAX_ERRORS, (entry) => (ERROR_CODES.has(entry) ? entry : null));
  const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, TIMEOUT_MS);
  const startedAt = iso(own(value, "startedAt"));
  const checkInAt = iso(own(value, "checkInAt"), true);
  const conflictReceivedAt = iso(own(value, "conflictReceivedAt"), true);
  const verifiedAt = iso(own(value, "verifiedAt"), true);
  const completedAt = iso(own(value, "completedAt"), true);
  const failureReason = own(value, "failureReason");
  const retryCount = integer(own(value, "retryCount"), 0, 1_000);
  if (
    version !== STORM_RELAY_RUN_VERSION || !id || !seed || !playerCallsign || !control || !relay
    || !packets || packets.length !== 3 || !PHASES.has(phase)
    || ![null, "storm-214-r2"].includes(verifiedPacketId) || badRelayCount === null
    || !recoveryActions || !errors || activeMilliseconds === null || !startedAt
    || checkInAt === undefined || conflictReceivedAt === undefined || verifiedAt === undefined || completedAt === undefined
    || (failureReason !== null && !FAILURE_REASONS.has(failureReason)) || retryCount === null
    || id !== runId(seed, startedAt, retryCount)
  ) return null;
  if (
    ([STORM_RELAY_PHASES.RECEIVING, STORM_RELAY_PHASES.CONFLICT, STORM_RELAY_PHASES.RELAY, STORM_RELAY_PHASES.COMPLETED].includes(phase) && !checkInAt)
    || ([STORM_RELAY_PHASES.CONFLICT, STORM_RELAY_PHASES.RELAY, STORM_RELAY_PHASES.COMPLETED].includes(phase) && !conflictReceivedAt)
    || ([STORM_RELAY_PHASES.RELAY, STORM_RELAY_PHASES.COMPLETED].includes(phase) && (!verifiedAt || verifiedPacketId !== "storm-214-r2" || !verificationRequested))
    || (phase === STORM_RELAY_PHASES.COMPLETED && (!completedAt || failureReason !== null))
    || (phase === STORM_RELAY_PHASES.FAILED && !failureReason)
    || (phase === STORM_RELAY_PHASES.ABANDONED && !completedAt)
    || (checkInAt && Date.parse(checkInAt) < Date.parse(startedAt))
    || (conflictReceivedAt && (!checkInAt || Date.parse(conflictReceivedAt) < Date.parse(checkInAt)))
    || (verifiedAt && (!conflictReceivedAt || Date.parse(verifiedAt) < Date.parse(conflictReceivedAt)))
    || (completedAt && Date.parse(completedAt) < Date.parse(startedAt))
  ) return null;
  const partial = {
    version, runId: id, seed, playerCallsign, control, relay, packets, phase,
    verifiedPacketId, verificationRequested, badRelayCount, recoveryActions, errors,
    activeMilliseconds, startedAt, checkInAt, conflictReceivedAt, verifiedAt, completedAt,
    failureReason, retryCount,
  };
  const summary = normalizeSummary(own(value, "summary"), partial);
  if (summary === undefined || (phase === STORM_RELAY_PHASES.COMPLETED && !summary)) return null;
  return deepFreeze({ ...partial, summary });
}

function strictArrayTail(value, maximum, normalizeItem) {
  const length = ownArrayLength(value);
  if (length === null) return null;
  const result = [];
  const start = Math.max(0, length - maximum);
  for (let index = start; index < length; index += 1) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value);
    if (item === null) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

function normalizeQsoIds(value) {
  const ids = strictArray(value, 2, (entry) => boundedText(entry, 96));
  return ids?.length === 2 && ids[0] !== ids[1] ? ids : null;
}

export function normalizeStormRelaySummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64);
  const playerCallsign = callsign(own(value, "playerCallsign"));
  const recoveryActions = strictArray(own(value, "recoveryActions"), 8, (entry) => (["AGN", "QRS"].includes(entry) ? entry : null));
  const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, TIMEOUT_MS);
  const completedAt = iso(own(value, "completedAt"));
  const canonical = PACKETS[2];
  if (!runIdValue || !playerCallsign || !recoveryActions || activeMilliseconds === null || !completedAt
    || own(value, "controlPersonId") !== CONTROL.personId || own(value, "controlStationId") !== CONTROL.stationId
    || own(value, "relayPersonId") !== RELAY.personId || own(value, "relayStationId") !== RELAY.stationId
    || own(value, "canonicalPacketId") !== canonical.id || own(value, "msgId") !== canonical.msgId
    || own(value, "revision") !== canonical.revision || own(value, "grid") !== canonical.grid
    || own(value, "people") !== canonical.people || own(value, "item") !== canonical.item
    || own(value, "quantity") !== canonical.quantity || own(value, "check") !== canonical.check
    || own(value, "verificationRequested") !== true || own(value, "isFictional") !== true) return null;
  return deepFreeze({
    runId: runIdValue, playerCallsign,
    controlPersonId: CONTROL.personId, controlStationId: CONTROL.stationId,
    relayPersonId: RELAY.personId, relayStationId: RELAY.stationId,
    canonicalPacketId: canonical.id, msgId: canonical.msgId, revision: canonical.revision,
    grid: canonical.grid, people: canonical.people, item: canonical.item,
    quantity: canonical.quantity, check: canonical.check, verificationRequested: true,
    recoveryActions, activeMilliseconds, completedAt, isFictional: true,
  });
}

function normalizeStormProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64);
  const recordId = boundedText(own(value, "recordId"), 96);
  const playerCallsign = callsign(own(value, "playerCallsign"));
  const qsoIds = normalizeQsoIds(own(value, "qsoIds"));
  const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || recordId !== `storm-record:${runIdValue}` || !playerCallsign || !qsoIds || !completedAt
    || own(value, "controlPersonId") !== CONTROL.personId || own(value, "controlStationId") !== CONTROL.stationId
    || own(value, "relayPersonId") !== RELAY.personId || own(value, "relayStationId") !== RELAY.stationId
    || own(value, "canonicalPacketId") !== PACKETS[2].id || own(value, "check") !== PACKETS[2].check) return null;
  return deepFreeze({
    runId: runIdValue, recordId, qsoIds, playerCallsign,
    controlPersonId: CONTROL.personId, controlStationId: CONTROL.stationId,
    relayPersonId: RELAY.personId, relayStationId: RELAY.stationId,
    canonicalPacketId: PACKETS[2].id, check: PACKETS[2].check, completedAt,
  });
}

function normalizeStormRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64);
  const id = boundedText(own(value, "id"), 96);
  const playerCallsign = callsign(own(value, "playerCallsign"));
  const qsoIds = normalizeQsoIds(own(value, "qsoIds"));
  const completedAt = iso(own(value, "completedAt"));
  const canonical = PACKETS[2];
  if (!runIdValue || id !== `storm-record:${runIdValue}` || !playerCallsign || !qsoIds || !completedAt
    || own(value, "controlPersonId") !== CONTROL.personId || own(value, "controlStationId") !== CONTROL.stationId
    || own(value, "relayPersonId") !== RELAY.personId || own(value, "relayStationId") !== RELAY.stationId
    || own(value, "canonicalPacketId") !== canonical.id || own(value, "msgId") !== canonical.msgId
    || own(value, "revision") !== canonical.revision || own(value, "grid") !== canonical.grid
    || own(value, "people") !== canonical.people || own(value, "item") !== canonical.item
    || own(value, "quantity") !== canonical.quantity || own(value, "check") !== canonical.check
    || own(value, "isFictional") !== true) return null;
  return deepFreeze({
    id, runId: runIdValue, qsoIds, playerCallsign,
    controlPersonId: CONTROL.personId, controlStationId: CONTROL.stationId,
    relayPersonId: RELAY.personId, relayStationId: RELAY.stationId,
    canonicalPacketId: canonical.id, msgId: canonical.msgId, revision: canonical.revision,
    grid: canonical.grid, people: canonical.people, item: canonical.item,
    quantity: canonical.quantity, check: canonical.check, completedAt, isFictional: true,
  });
}

function orderedUnique(entries) {
  let previous = null;
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.runId)) return false;
    if (previous && (entry.completedAt < previous.completedAt
      || (entry.completedAt === previous.completedAt && entry.runId <= previous.runId))) return false;
    ids.add(entry.runId);
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

const frozenEmptyArray = () => Object.freeze([]);

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
  const activeValue = own(source, "activeRun");
  const activeRun = activeValue === null || activeValue === undefined ? null : normalizeStormRelayRun(activeValue);
  const completedRuns = strictArrayTail(own(source, "completedRuns") ?? [], 80, normalizeStormRelaySummary);
  const settledRunIds = normalizeRunIds(own(source, "settledRunIds") ?? []);
  const settlementProofs = strictArrayTail(own(source, "settlementProofs") ?? [], 80, normalizeStormProof);
  const archive = strictArrayTail(own(source, "archive") ?? [], 80, normalizeStormRecord);
  if ((activeValue !== null && activeValue !== undefined && !activeRun)
    || !completedRuns || !settledRunIds || !settlementProofs || !archive
    || !orderedUnique(completedRuns) || !orderedUnique(settlementProofs) || !orderedUnique(archive)) {
    return emptyStormRelayState();
  }
  return deepFreeze({
    version: STORM_RELAY_STATE_VERSION, activeRun, completedRuns, settledRunIds,
    settlementProofs, archive, taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
  });
}

export function stormRelayReplayAvailable(save) {
  return normalizeStormRelayState(own(own(save, "storyContinuationState"), "chapter12")).taskTreeUnlocked;
}
