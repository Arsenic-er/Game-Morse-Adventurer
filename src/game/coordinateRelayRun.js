import { parseStructuredFields, tokenizeStructuredMessage } from "./structuredMessage.js";

export const COORDINATE_RELAY_STATE_VERSION = 1;
export const COORDINATE_RELAY_DURATION_MILLISECONDS = 600_000;
export const MAX_COORDINATE_PACKETS = 80;
export const MAX_COORDINATE_SETTLED_RUN_IDS = 100;

export const COORDINATE_RELAY_PHASES = Object.freeze({
  BRIEFING: "BRIEFING",
  RECEIVE_PACKET: "RECEIVE_PACKET",
  PLAYER_READBACK: "PLAYER_READBACK",
  FIELD_CORRECTION: "FIELD_CORRECTION",
  RELAY_PACKET: "RELAY_PACKET",
  RELAY_CONFIRMATION: "RELAY_CONFIRMATION",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

const PHASES = new Set(Object.values(COORDINATE_RELAY_PHASES));
const TERMINAL = new Set([COORDINATE_RELAY_PHASES.COMPLETED, COORDINATE_RELAY_PHASES.FAILED, COORDINATE_RELAY_PHASES.ABANDONED]);
const ERRORS = new Set(["MESSAGE_ID_MISMATCH", "GRID_MISMATCH", "TIME_MISMATCH", "PEOPLE_MISMATCH", "CHECK_MISMATCH", "FORMAT_INVALID", "SEMANTIC_UNSAFE", "RELAY_CONFIRMATION_INVALID"]);
const FAILURES = new Set(["TOO_MANY_ERRORS", "TIMED_OUT"]);
const RECOVERIES = new Set(["AGN", "QRS"]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
function text(value, maximum = 128) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= maximum && !/[\u0000-\u001F\u007F]/.test(result) ? result : null;
}
function identifier(value, maximum = 128) {
  const result = text(value, maximum);
  return result && /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(result) ? result : null;
}
function callsign(value) {
  const result = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z0-9]{1,7}$/.test(result) ? result : null;
}
function iso(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function integer(value, maximum, minimum = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}
function hash32(value) {
  let result = 2166136261;
  for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) freeze(value[key]);
  return Object.freeze(value);
}
function retainedOwnValues(value, maximum) {
  try {
    if (!Array.isArray(value)) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > 0xFFFF_FFFF) return null;
    const result = [];
    for (let index = Math.max(0, length.value - maximum); index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}

function packetFields(packet) {
  const packetId = typeof own(packet, "packetId") === "string" && /^\d{3}$/.test(own(packet, "packetId")) ? own(packet, "packetId") : null;
  const grid = typeof own(packet, "grid") === "string" && /^PX-\d{4}-\d{4}$/.test(own(packet, "grid")) ? own(packet, "grid") : null;
  const utc = typeof own(packet, "utc") === "string" && /^(?:[01]\d|2[0-3])[0-5]\dZ$/.test(own(packet, "utc")) ? own(packet, "utc") : null;
  const people = integer(own(packet, "people"), 99);
  return packetId && grid && utc && people != null ? { packetId, grid, utc, people } : null;
}

export function computeCoordinatePacketCheck(packet) {
  try {
    const fields = packetFields(packet);
    if (!fields) return null;
    const canonical = `MSG ${fields.packetId} GRID ${fields.grid} TIME ${fields.utc} PEOPLE ${String(fields.people).padStart(2, "0")}`;
    let checksum = 0;
    for (const character of canonical) checksum = (checksum + character.charCodeAt(0)) % 97;
    return checksum;
  } catch { return null; }
}

function normalizePacket(value) {
  try {
    const fields = packetFields(value);
    const check = integer(own(value, "check"), 96);
    return fields && check === computeCoordinatePacketCheck(fields) ? freeze({ ...fields, check }) : null;
  } catch { return null; }
}

export function coordinatePacketText(packetValue) {
  const packet = normalizePacket(packetValue);
  return packet ? `MSG ${packet.packetId} GRID ${packet.grid} TIME ${packet.utc} PEOPLE ${String(packet.people).padStart(2, "0")} CHECK ${String(packet.check).padStart(2, "0")}` : "";
}

function packetFor(seed) {
  const hash = hash32(seed);
  const packet = {
    packetId: String((hash % 999) + 1).padStart(3, "0"),
    grid: `PX-${String((hash >>> 3) % 10000).padStart(4, "0")}-${String((hash >>> 15) % 10000).padStart(4, "0")}`,
    utc: `${String((hash >>> 20) % 24).padStart(2, "0")}${String((hash >>> 8) % 60).padStart(2, "0")}Z`,
    people: (hash >>> 24) % 100,
  };
  return freeze({ ...packet, check: computeCoordinatePacketCheck(packet) });
}

function runId(packet, startedAt, retryCount) {
  return `coordinate-relay:${packet.packetId}:${hash32(`${packet.grid}:${startedAt}:${retryCount}`).toString(16).padStart(8, "0")}`;
}
function baseRun({ playerCallsign, packet, startedAt, retryCount = 0, checked = false }) {
  return freeze({
    version: COORDINATE_RELAY_STATE_VERSION,
    runId: runId(packet, startedAt, retryCount),
    playerCallsign,
    source: freeze({ callsign: "SIM9CR", npcId: "chapter09-source", personId: "person:procedural:chapter09-source", stationId: "station:procedural:chapter09-source" }),
    relay: freeze({ callsign: "SIM9RL", npcId: "chapter09-relay", personId: "person:procedural:chapter09-relay", stationId: "station:procedural:chapter09-relay" }),
    simulation: "fictional-pixel-grid",
    phase: checked ? COORDINATE_RELAY_PHASES.RECEIVE_PACKET : COORDINATE_RELAY_PHASES.BRIEFING,
    packet,
    attempts: freeze([]),
    recoveryActions: freeze([]),
    replyWpm: 16,
    readbackCompletedAt: null,
    relaySentAt: null,
    completedAt: null,
    elapsedMilliseconds: 0,
    failureReason: null,
    lastError: null,
    retryCount,
    startedAt,
  });
}
function transition(run, patch) { return freeze({ ...run, ...patch }); }
function safeSemantic(result) { return result == null || result.safeToCommit === true; }
function recovery(input) {
  const normalized = tokenizeStructuredMessage(input).join(" ");
  if (normalized === "AGN K") return "AGN";
  if (normalized === "QRS K" || normalized === "PSE QRS K") return "QRS";
  return null;
}

const PACKET_SCHEMA = Object.freeze({
  MSG: { pattern: /^\d{3}$/ }, GRID: { pattern: /^PX-\d{4}-\d{4}$/ },
  TIME: { pattern: /^(?:[01]\d|2[0-3])[0-5]\dZ$/ }, PEOPLE: { pattern: /^\d{1,2}$/ }, CHECK: { pattern: /^\d{1,2}$/ },
});
function packetError(packet, input) {
  const parsed = parseStructuredFields(input, PACKET_SCHEMA);
  if (!parsed.ok) {
    const joined = parsed.errors.join(" ");
    if (/TIME/.test(joined)) return "TIME_MISMATCH";
    if (/GRID/.test(joined)) return "GRID_MISMATCH";
    if (/PEOPLE/.test(joined)) return "PEOPLE_MISMATCH";
    if (/CHECK/.test(joined)) return "CHECK_MISMATCH";
    if (/MSG/.test(joined)) return "MESSAGE_ID_MISMATCH";
    return "FORMAT_INVALID";
  }
  if (parsed.fields.MSG !== packet.packetId) return "MESSAGE_ID_MISMATCH";
  if (parsed.fields.GRID !== packet.grid) return "GRID_MISMATCH";
  if (parsed.fields.TIME !== packet.utc) return "TIME_MISMATCH";
  if (Number(parsed.fields.PEOPLE) !== packet.people) return "PEOPLE_MISMATCH";
  if (Number(parsed.fields.CHECK) !== packet.check) return "CHECK_MISMATCH";
  return null;
}
function failedAttempt(run, error, at, stage) {
  const attempts = [...run.attempts, freeze({ id: `attempt:${run.runId}:${run.attempts.length + 1}`, stage, error, observedAt: at })].slice(-6);
  const failures = attempts.filter((attempt) => attempt.stage === "READBACK").length;
  return transition(run, {
    attempts, lastError: error,
    phase: failures >= 3 ? COORDINATE_RELAY_PHASES.FAILED : COORDINATE_RELAY_PHASES.FIELD_CORRECTION,
    failureReason: failures >= 3 ? "TOO_MANY_ERRORS" : null,
    completedAt: failures >= 3 ? at : null,
  });
}

export function createCoordinateRelayRun({ playerCallsign, seed, startedAt } = {}) {
  const player = callsign(playerCallsign); const start = iso(startedAt); const seedValue = text(seed, 96);
  return player && start && seedValue ? baseRun({ playerCallsign: player, packet: packetFor(seedValue), startedAt: start }) : null;
}
export function beginCoordinateRelayRun(value) {
  const run = normalizeCoordinateRelayRun(value);
  return run?.phase === COORDINATE_RELAY_PHASES.BRIEFING ? transition(run, { phase: COORDINATE_RELAY_PHASES.RECEIVE_PACKET }) : value;
}
export function receiveCoordinatePacket(value) {
  const run = normalizeCoordinateRelayRun(value);
  return run && [COORDINATE_RELAY_PHASES.RECEIVE_PACKET, COORDINATE_RELAY_PHASES.FIELD_CORRECTION].includes(run.phase)
    ? transition(run, { phase: COORDINATE_RELAY_PHASES.PLAYER_READBACK, lastError: null }) : value;
}
export function submitCoordinateRelayText(value, input, semanticResult, observedAt) {
  const run = normalizeCoordinateRelayRun(value); const at = iso(observedAt);
  if (!run || !at || Date.parse(at) < Date.parse(run.startedAt) || TERMINAL.has(run.phase)) return value;
  if (![COORDINATE_RELAY_PHASES.PLAYER_READBACK, COORDINATE_RELAY_PHASES.RELAY_PACKET].includes(run.phase)) return value;
  if (!safeSemantic(semanticResult)) return failedAttempt(run, "SEMANTIC_UNSAFE", at, run.phase === COORDINATE_RELAY_PHASES.RELAY_PACKET ? "RELAY" : "READBACK");
  const command = recovery(input);
  if (command) return transition(run, {
    phase: COORDINATE_RELAY_PHASES.RECEIVE_PACKET,
    recoveryActions: freeze([...run.recoveryActions, command].slice(-12)),
    replyWpm: command === "QRS" ? Math.max(5, run.replyWpm - 3) : run.replyWpm,
    lastError: null,
  });
  const error = packetError(run.packet, input);
  if (error) return failedAttempt(run, error, at, run.phase === COORDINATE_RELAY_PHASES.RELAY_PACKET ? "RELAY" : "READBACK");
  return run.phase === COORDINATE_RELAY_PHASES.PLAYER_READBACK
    ? transition(run, { phase: COORDINATE_RELAY_PHASES.RELAY_PACKET, readbackCompletedAt: at, lastError: null })
    : transition(run, { phase: COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION, relaySentAt: at, lastError: null });
}
export function receiveRelayConfirmation(value, input, observedAt) {
  const run = normalizeCoordinateRelayRun(value); const at = iso(observedAt);
  if (!run || run.phase !== COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION || !at || Date.parse(at) < Date.parse(run.relaySentAt ?? "")) return value;
  const tokens = tokenizeStructuredMessage(input);
  const expected = ["QSL", "MSG", run.packet.packetId, "CHECK", String(run.packet.check).padStart(2, "0"), "K"];
  return tokens.length === expected.length && tokens.every((token, index) => token === expected[index])
    ? transition(run, { phase: COORDINATE_RELAY_PHASES.COMPLETED, completedAt: at })
    : failedAttempt(run, "RELAY_CONFIRMATION_INVALID", at, "CONFIRMATION");
}
export function tickCoordinateRelayRun(value, { seconds = 0, paused = false } = {}, observedAt) {
  const run = normalizeCoordinateRelayRun(value); const at = iso(observedAt); const amount = Number(seconds);
  if (!run || paused || TERMINAL.has(run.phase) || !at || !Number.isFinite(amount) || amount <= 0 || amount > 3600) return value;
  const elapsedMilliseconds = Math.min(COORDINATE_RELAY_DURATION_MILLISECONDS, run.elapsedMilliseconds + Math.round(amount * 1000));
  return elapsedMilliseconds === COORDINATE_RELAY_DURATION_MILLISECONDS
    ? transition(run, { elapsedMilliseconds, phase: COORDINATE_RELAY_PHASES.FAILED, failureReason: "TIMED_OUT", completedAt: at })
    : transition(run, { elapsedMilliseconds });
}
export function abandonCoordinateRelayRun(value, observedAt) {
  const run = normalizeCoordinateRelayRun(value); const at = iso(observedAt);
  return run && at && Date.parse(at) >= Date.parse(run.startedAt) && !TERMINAL.has(run.phase)
    ? transition(run, { phase: COORDINATE_RELAY_PHASES.ABANDONED, completedAt: at }) : value;
}
export function retryCoordinateRelayRun(value, startedAt) {
  const run = normalizeCoordinateRelayRun(value); const start = iso(startedAt);
  return run && start && [COORDINATE_RELAY_PHASES.FAILED, COORDINATE_RELAY_PHASES.ABANDONED].includes(run.phase)
    ? baseRun({ playerCallsign: run.playerCallsign, packet: run.packet, startedAt: start, retryCount: run.retryCount + 1, checked: true }) : value;
}

function normalizeIdentity(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = { callsign: callsign(own(value, "callsign")), npcId: identifier(own(value, "npcId"), 96), personId: identifier(own(value, "personId"), 96), stationId: identifier(own(value, "stationId"), 96) };
  return Object.entries(expected).every(([key, expectedValue]) => result[key] === expectedValue) ? freeze(result) : null;
}
function normalizeAttempts(value) {
  const items = retainedOwnValues(value, 6); if (!items) return null;
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const attempt = { id: identifier(own(item, "id")), stage: own(item, "stage"), error: own(item, "error"), observedAt: iso(own(item, "observedAt")) };
    if (!attempt.id || !["READBACK", "RELAY", "CONFIRMATION"].includes(attempt.stage) || !ERRORS.has(attempt.error) || !attempt.observedAt) return null;
    result.push(freeze(attempt));
  }
  return freeze(result);
}
function normalizeRecoveries(value) {
  const items = retainedOwnValues(value, 12); return items && items.every((item) => RECOVERIES.has(item)) ? freeze(items) : null;
}
export function normalizeCoordinateRelayRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const packet = normalizePacket(own(value, "packet"));
    const source = normalizeIdentity(own(value, "source"), { callsign: "SIM9CR", npcId: "chapter09-source", personId: "person:procedural:chapter09-source", stationId: "station:procedural:chapter09-source" });
    const relay = normalizeIdentity(own(value, "relay"), { callsign: "SIM9RL", npcId: "chapter09-relay", personId: "person:procedural:chapter09-relay", stationId: "station:procedural:chapter09-relay" });
    const attempts = normalizeAttempts(own(value, "attempts")); const recoveryActions = normalizeRecoveries(own(value, "recoveryActions"));
    const run = {
      version: COORDINATE_RELAY_STATE_VERSION, runId: identifier(own(value, "runId")), playerCallsign: callsign(own(value, "playerCallsign")),
      source, relay, simulation: own(value, "simulation"), phase: own(value, "phase"), packet, attempts, recoveryActions,
      replyWpm: integer(own(value, "replyWpm"), 16, 5), readbackCompletedAt: own(value, "readbackCompletedAt") == null ? null : iso(own(value, "readbackCompletedAt")),
      relaySentAt: own(value, "relaySentAt") == null ? null : iso(own(value, "relaySentAt")), completedAt: own(value, "completedAt") == null ? null : iso(own(value, "completedAt")),
      elapsedMilliseconds: integer(own(value, "elapsedMilliseconds"), COORDINATE_RELAY_DURATION_MILLISECONDS), failureReason: own(value, "failureReason") == null ? null : own(value, "failureReason"),
      lastError: own(value, "lastError") == null ? null : own(value, "lastError"), retryCount: integer(own(value, "retryCount"), 100), startedAt: iso(own(value, "startedAt")),
    };
    const terminal = TERMINAL.has(run.phase);
    const readbackRequired = [COORDINATE_RELAY_PHASES.RELAY_PACKET, COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION, COORDINATE_RELAY_PHASES.COMPLETED].includes(run.phase);
    const relayRequired = [COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION, COORDINATE_RELAY_PHASES.COMPLETED].includes(run.phase);
    if (!run.runId || !run.playerCallsign || !source || !relay || run.simulation !== "fictional-pixel-grid" || !PHASES.has(run.phase) || !packet || !attempts || !recoveryActions || run.replyWpm == null || run.elapsedMilliseconds == null || run.retryCount == null || !run.startedAt
      || run.runId !== runIdForNormalized(run) || terminal !== Boolean(run.completedAt) || (run.completedAt && Date.parse(run.completedAt) < Date.parse(run.startedAt))
      || readbackRequired !== Boolean(run.readbackCompletedAt) || relayRequired !== Boolean(run.relaySentAt)
      || (run.readbackCompletedAt && Date.parse(run.readbackCompletedAt) < Date.parse(run.startedAt)) || (run.relaySentAt && Date.parse(run.relaySentAt) < Date.parse(run.readbackCompletedAt ?? ""))
      || (run.phase === COORDINATE_RELAY_PHASES.FAILED && !FAILURES.has(run.failureReason)) || (run.phase !== COORDINATE_RELAY_PHASES.FAILED && run.failureReason !== null)
      || (run.lastError !== null && !ERRORS.has(run.lastError))) return null;
    return freeze(run);
  } catch { return null; }
}
function runIdForNormalized(run) { return runId(run.packet, run.startedAt, run.retryCount); }

function normalizePacketRecord(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const packet = normalizePacket(own(value, "packet"));
    const record = { id: identifier(own(value, "id")), runId: identifier(own(value, "runId")), sourceQsoId: identifier(own(value, "sourceQsoId"), 96), relayQsoId: identifier(own(value, "relayQsoId"), 96), packet, readbackAttempts: integer(own(value, "readbackAttempts"), 3, 1), sourcePersonId: identifier(own(value, "sourcePersonId"), 96), sourceStationId: identifier(own(value, "sourceStationId"), 96), relayPersonId: identifier(own(value, "relayPersonId"), 96), relayStationId: identifier(own(value, "relayStationId"), 96), sourceCompletedAt: iso(own(value, "sourceCompletedAt")), completedAt: iso(own(value, "completedAt")) };
    return Object.values(record).every((item) => item != null)
      && Date.parse(record.sourceCompletedAt) <= Date.parse(record.completedAt) ? freeze(record) : null;
  } catch { return null; }
}
function normalizePacketLedger(value) {
  const items = retainedOwnValues(value, MAX_COORDINATE_PACKETS); if (!items) return freeze([]);
  const result = []; const ids = new Set(); let previous = null;
  for (const item of items) {
    const record = normalizePacketRecord(item); if (!record || ids.has(record.id)) return freeze([]);
    if (previous && (Date.parse(record.completedAt) < Date.parse(previous.completedAt) || (record.completedAt === previous.completedAt && record.id <= previous.id))) return freeze([]);
    result.push(record); ids.add(record.id); previous = record;
  }
  return freeze(result);
}
function normalizeIds(value) {
  const items = retainedOwnValues(value, MAX_COORDINATE_SETTLED_RUN_IDS); if (!items) return freeze([]);
  const result = []; const seen = new Set();
  for (const item of items) { const id = identifier(item); if (!id || seen.has(id)) return freeze([]); result.push(id); seen.add(id); }
  return freeze(result);
}
export function emptyCoordinateRelayState() { return freeze({ activeRun: null, packets: [], settledRunIds: [], toolUnlocked: false }); }
export function coordinateRelayReplayAvailable(save) {
  const state = normalizeCoordinateRelayState(own(own(save, "storyContinuationState"), "chapter09"));
  const claimed = own(own(save, "missionState"), "claimedMissionIds");
  return state.toolUnlocked || (Array.isArray(claimed) && claimed.slice(-100).includes("story-09"));
}
export function normalizeCoordinateRelayState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const active = own(source, "activeRun");
    return freeze({ activeRun: active == null ? null : normalizeCoordinateRelayRun(active), packets: normalizePacketLedger(own(source, "packets") ?? []), settledRunIds: normalizeIds(own(source, "settledRunIds") ?? []), toolUnlocked: own(source, "toolUnlocked") === true });
  } catch { return emptyCoordinateRelayState(); }
}
