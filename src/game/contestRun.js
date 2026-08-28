import { generateProceduralNpc, PROCEDURAL_NPC_REGIONS } from "../qso/proceduralNpc.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { parseStructuredFields, tokenizeStructuredMessage } from "./structuredMessage.js";

export const CONTEST_STATE_VERSION = 1;
export const CONTEST_DURATION_MILLISECONDS = 300_000;
export const CONTEST_CONTACT_LIMIT = 10;
export const CONTEST_RECORD_LIMIT = 40;
export const CONTEST_SETTLED_RUN_LIMIT = 100;

export const CONTEST_MODES = Object.freeze({ RUN: "RUN", SP: "SP" });
export const CONTEST_PHASES = Object.freeze({
  BRIEFING: "BRIEFING", MODE_SELECT: "MODE_SELECT", RUN_CQ: "RUN_CQ", RUN_PILEUP: "RUN_PILEUP",
  SP_POOL: "SP_POOL", EXCHANGE: "EXCHANGE", COMPLETED: "COMPLETED",
  FAILED: "FAILED", ABANDONED: "ABANDONED",
});

const PHASES = new Set(Object.values(CONTEST_PHASES));
const MODES = new Set(Object.values(CONTEST_MODES));
const TERMINAL = new Set([CONTEST_PHASES.COMPLETED, CONTEST_PHASES.FAILED, CONTEST_PHASES.ABANDONED]);
const REGION_CODE = Object.freeze({ JP: "JP", US: "US", CN: "CN", DE: "GE", CH: "CH", FI: "FI" });
const RECOVERY = new Set(["AGN", "QRS"]);
const MAX_ERRORS = 12;

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
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= minimum && result <= maximum ? result : null;
}

function hash32(value) {
  let result = 2166136261;
  for (const character of String(value).normalize("NFC")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function retainedOwnValues(value, maximum) {
  try {
    if (!Array.isArray(value)) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value)
      || length.value < 0 || length.value > 0xFFFF_FFFF) return null;
    const result = [];
    for (let index = Math.max(0, length.value - maximum); index < length.value; index += 1) {
      if (!Object.hasOwn(value, index)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value") || Object.hasOwn(descriptor, "get") || Object.hasOwn(descriptor, "set")) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}

function stationFor(seed, index) {
  const region = PROCEDURAL_NPC_REGIONS[index % PROCEDURAL_NPC_REGIONS.length];
  const localIndex = hash32(`${seed}|station|${index}`) % region.quota;
  const npc = generateProceduralNpc({ worldSeed: seed, regionId: region.id, localIndex });
  const identity = { npcId: npc.npcId, callsign: npc.station.callsign };
  return deepFreeze({
    npcId: npc.npcId,
    personId: personIdForOperator(identity),
    stationId: stationIdentityForCallsign(npc.station.callsign, identity)?.stationId,
    callsign: npc.station.callsign,
    regionCode: REGION_CODE[region.id],
    locationId: npc.station.locationId,
    powerWatts: [5, 10, 20, 50, 100][hash32(`${seed}|power|${index}`) % 5],
    rst: "599",
    operatorProfileId: npc.qso.operatorProfileId,
    replyWpm: Math.min(32, Math.max(18, npc.radio.preferredWpm)),
    isFictional: true,
  });
}

function stationPoolFor(seed) {
  const result = [];
  const seen = new Set();
  for (let cursor = 0; result.length < CONTEST_CONTACT_LIMIT && cursor < 100; cursor += 1) {
    const candidate = stationFor(seed, cursor);
    if (seen.has(candidate.personId) || seen.has(candidate.callsign)) continue;
    seen.add(candidate.personId); seen.add(candidate.callsign); result.push(candidate);
  }
  return deepFreeze(result);
}

function runIdFor(contestId, startedAt, retryCount) {
  return `contest:${hash32(`${contestId}|${startedAt}|${retryCount}`).toString(16).padStart(8, "0")}`;
}

function newRun({ playerCallsign, contestId, stationPool, startedAt, retryCount = 0 }) {
  return deepFreeze({
    version: CONTEST_STATE_VERSION,
    runId: runIdFor(contestId, startedAt, retryCount),
    contestId,
    playerCallsign,
    controller: deepFreeze({
      callsign: "SIM0CT", npcId: "chapter10-contest-controller",
      personId: "person:procedural:chapter10-contest-controller",
      stationId: "station:procedural:chapter10-contest-controller",
    }),
    simulation: "fictional-five-minute-contest",
    phase: CONTEST_PHASES.BRIEFING,
    mode: null,
    stationPool,
    candidates: [],
    selectedStation: null,
    contacts: [],
    nextSerial: 1,
    elapsedMilliseconds: 0,
    repeatRequests: 0,
    bustedCalls: 0,
    interruptions: 0,
    duplicateAttempts: 0,
    exchangeErrors: 0,
    cleanExchanges: 0,
    currentExchangeRecovered: false,
    recoveryActions: [],
    errors: [],
    replyWpm: 22,
    retryCount,
    failureReason: null,
    completedAt: null,
    startedAt,
  });
}

function transition(run, changes) { return deepFreeze({ ...run, ...changes }); }
function safeSemantic(value) { return own(value, "safeToCommit") === true; }
function recoveryCommand(value) {
  const tokens = tokenizeStructuredMessage(value);
  return tokens.length === 2 && tokens[1] === "K" && RECOVERY.has(tokens[0]) ? tokens[0] : null;
}

function candidateSlice(run, mode) {
  const worked = new Set(run.contacts.map(({ personId }) => personId));
  const remaining = run.stationPool.filter(({ personId }) => !worked.has(personId));
  if (mode === CONTEST_MODES.RUN) return remaining.slice(0, 2 + (hash32(`${run.runId}|${run.contacts.length}`) % 2));
  return remaining.slice(0, 4);
}

function exchangeError(run, decoded) {
  const tokens = tokenizeStructuredMessage(decoded);
  const station = run.selectedStation;
  if (tokens.length < 3 || tokens[0] !== station.callsign || tokens[1] !== "DE" || tokens[2] !== run.playerCallsign) return "CALLSIGN_MISMATCH";
  const parsed = parseStructuredFields(tokens.slice(3).join(" "), {
    RST: { pattern: /^[1-5][1-9][1-9]$/ },
    NR: { pattern: /^\d{3}$/ },
    REGION: { pattern: /^[A-Z]{2}$/ },
    PWR: { pattern: /^(?:[1-9]|[1-9]\d{1,2}|1000)$/ },
  });
  if (!parsed.ok) return "FORMAT_INVALID";
  if (parsed.fields.RST !== station.rst) return "RST_MISMATCH";
  if (parsed.fields.NR !== String(run.nextSerial).padStart(3, "0")) return "SERIAL_MISMATCH";
  if (parsed.fields.REGION !== station.regionCode) return "REGION_MISMATCH";
  if (Number(parsed.fields.PWR) !== station.powerWatts) return "POWER_MISMATCH";
  return null;
}

function completionFacts(run) {
  const persons = new Set(run.contacts.map(({ personId }) => personId));
  const regions = new Set(run.contacts.map(({ regionCode }) => regionCode));
  const runContacts = run.contacts.filter(({ mode }) => mode === CONTEST_MODES.RUN).length;
  const spContacts = run.contacts.filter(({ mode }) => mode === CONTEST_MODES.SP).length;
  return {
    validContacts: run.contacts.length,
    uniqueContacts: persons.size,
    uniqueRegions: regions.size,
    runContacts,
    spContacts,
    bothModes: runContacts >= 2 && spContacts >= 2,
    noDuplicates: persons.size === run.contacts.length,
    cleanExchanges: run.cleanExchanges,
    repeatRequests: run.repeatRequests,
    bustedCalls: run.bustedCalls,
    interruptions: run.interruptions,
  };
}

function eligible(run) {
  const facts = completionFacts(run);
  return facts.validContacts >= 6 && facts.bothModes && facts.uniqueRegions >= 3 && facts.noDuplicates;
}

export function contestExchangeText(stationValue, playerCallsignValue, serialValue) {
  const station = normalizeContestStation(stationValue);
  const player = callsign(playerCallsignValue);
  const serial = integer(serialValue, 999, 1);
  return station && player && serial
    ? `${station.callsign} DE ${player} RST ${station.rst} NR ${String(serial).padStart(3, "0")} REGION ${station.regionCode} PWR ${station.powerWatts} K`
    : "";
}

export function contestCqText(playerCallsignValue) {
  const player = callsign(playerCallsignValue);
  return player ? `CQ TEST DE ${player} K` : "";
}

export function createContestRun({ playerCallsign, seed, startedAt } = {}) {
  try {
    const player = callsign(playerCallsign);
    const start = iso(startedAt);
    const seedValue = text(seed, 96);
    if (!player || !start || !seedValue) return null;
    const contestId = `contest-schedule:${hash32(seedValue).toString(16).padStart(8, "0")}`;
    return newRun({ playerCallsign: player, contestId, stationPool: stationPoolFor(`${seedValue}|${contestId}`), startedAt: start });
  } catch { return null; }
}

export function selectContestMode(value, mode) {
  const run = normalizeContestRun(value);
  if (!run || TERMINAL.has(run.phase) || ![CONTEST_PHASES.BRIEFING, CONTEST_PHASES.MODE_SELECT].includes(run.phase) || !MODES.has(mode)) return value;
  if (mode === CONTEST_MODES.RUN) return transition(run, {
    phase: CONTEST_PHASES.RUN_CQ,
    mode,
    candidates: [],
    selectedStation: null,
    errors: [],
    currentExchangeRecovered: false,
  });
  const candidates = candidateSlice(run, mode);
  if (candidates.length === 0) return finishContestRun(run, run.startedAt);
  return transition(run, {
    phase: CONTEST_PHASES.SP_POOL,
    mode, candidates, selectedStation: null, errors: [], currentExchangeRecovered: false,
  });
}

export function submitContestText(value, decodedValue, semanticResult, observedAt) {
  const run = normalizeContestRun(value);
  const at = iso(observedAt);
  if (!run || !at || Date.parse(at) < Date.parse(run.startedAt) || TERMINAL.has(run.phase)) return value;
  if (![CONTEST_PHASES.RUN_CQ, CONTEST_PHASES.RUN_PILEUP, CONTEST_PHASES.SP_POOL, CONTEST_PHASES.EXCHANGE].includes(run.phase)) return value;
  const decoded = typeof decodedValue === "string" ? decodedValue.slice(0, 256) : "";
  if (run.phase === CONTEST_PHASES.RUN_CQ) {
    if (!safeSemantic(semanticResult)) return transition(run, {
      errors: [...run.errors, "SEMANTIC_UNSAFE"].slice(-MAX_ERRORS),
      exchangeErrors: run.exchangeErrors + 1,
    });
    if (tokenizeStructuredMessage(decoded).join(" ") !== contestCqText(run.playerCallsign)) return transition(run, {
      errors: [...run.errors, "CQ_INVALID"].slice(-MAX_ERRORS),
      exchangeErrors: run.exchangeErrors + 1,
    });
    const candidates = candidateSlice(run, CONTEST_MODES.RUN);
    return candidates.length === 0 ? finishContestRun(run, at) : transition(run, {
      phase: CONTEST_PHASES.RUN_PILEUP,
      candidates,
      errors: [],
    });
  }
  const recovery = recoveryCommand(decoded);
  if (recovery) return transition(run, {
    repeatRequests: run.repeatRequests + 1,
    recoveryActions: [...run.recoveryActions, recovery].slice(-20),
    replyWpm: recovery === "QRS" ? Math.max(5, run.replyWpm - 3) : run.replyWpm,
    currentExchangeRecovered: run.phase === CONTEST_PHASES.EXCHANGE || run.currentExchangeRecovered,
  });
  if (run.phase !== CONTEST_PHASES.EXCHANGE) {
    const tokens = tokenizeStructuredMessage(decoded);
    if (tokens.includes("RST") || tokens.includes("NR")) return transition(run, {
      interruptions: run.interruptions + 1,
      errors: [...run.errors, "INTERRUPTION"].slice(-MAX_ERRORS),
    });
    const supplied = tokens.length === 1 ? callsign(tokens[0]) : null;
    if (!supplied) return transition(run, { bustedCalls: run.bustedCalls + 1, errors: [...run.errors, "CALLSIGN_MISMATCH"].slice(-MAX_ERRORS) });
    if (run.contacts.some(({ callsign: worked }) => worked === supplied)) return transition(run, {
      duplicateAttempts: run.duplicateAttempts + 1,
      errors: [...run.errors, "DUPLICATE_STATION"].slice(-MAX_ERRORS),
    });
    const selectedStation = run.candidates.find(({ callsign: candidate }) => candidate === supplied);
    return selectedStation
      ? transition(run, { phase: CONTEST_PHASES.EXCHANGE, selectedStation, errors: [], currentExchangeRecovered: false })
      : transition(run, { bustedCalls: run.bustedCalls + 1, errors: [...run.errors, "BUSTED_CALL"].slice(-MAX_ERRORS) });
  }
  if (!safeSemantic(semanticResult)) return transition(run, { errors: [...run.errors, "SEMANTIC_UNSAFE"].slice(-MAX_ERRORS), exchangeErrors: run.exchangeErrors + 1 });
  const reason = exchangeError(run, decoded);
  if (reason) return transition(run, {
    bustedCalls: run.bustedCalls + (reason === "CALLSIGN_MISMATCH" ? 1 : 0),
    exchangeErrors: run.exchangeErrors + 1,
    errors: [...run.errors, reason].slice(-MAX_ERRORS),
  });
  if (run.contacts.some(({ personId }) => personId === run.selectedStation.personId)) return transition(run, {
    phase: run.mode === CONTEST_MODES.RUN ? CONTEST_PHASES.RUN_PILEUP : CONTEST_PHASES.SP_POOL,
    selectedStation: null, duplicateAttempts: run.duplicateAttempts + 1,
    errors: [...run.errors, "DUPLICATE_STATION"].slice(-MAX_ERRORS),
    currentExchangeRecovered: false,
  });
  const contact = deepFreeze({
    contactId: `${run.runId}:contact:${String(run.nextSerial).padStart(3, "0")}`,
    ...run.selectedStation,
    mode: run.mode,
    serialNumber: run.nextSerial,
    completedAt: at,
  });
  const contacts = [...run.contacts, contact];
  const reachedCap = contacts.length >= CONTEST_CONTACT_LIMIT;
  return transition(run, {
    contacts,
    nextSerial: run.nextSerial + 1,
    cleanExchanges: run.cleanExchanges + (run.currentExchangeRecovered || run.errors.length > 0 ? 0 : 1),
    phase: reachedCap ? CONTEST_PHASES.COMPLETED : CONTEST_PHASES.MODE_SELECT,
    completedAt: reachedCap ? at : null,
    mode: null,
    candidates: [],
    selectedStation: null,
    errors: [],
    currentExchangeRecovered: false,
  });
}

export function scoreContestRun(value) {
  const run = normalizeContestRun(value);
  if (!run) return deepFreeze({ score: 0, grade: "none", facts: deepFreeze({ validContacts: 0, uniqueContacts: 0, uniqueRegions: 0, runContacts: 0, spContacts: 0, bothModes: false, noDuplicates: false, cleanExchanges: 0, repeatRequests: 0, bustedCalls: 0, interruptions: 0 }) });
  const facts = completionFacts(run);
  const score = Math.max(0,
    facts.validContacts * 100 + facts.uniqueRegions * 40 + (facts.bothModes ? 150 : 0)
    + Math.min(facts.cleanExchanges * 20, 120)
    - Math.min(facts.repeatRequests * 10, 60)
    - Math.min(facts.bustedCalls * 40, 160)
    - Math.min(facts.interruptions * 30, 120));
  const complete = eligible(run);
  const grade = !complete ? "none" : score >= 1100 && facts.bustedCalls === 0 && facts.interruptions === 0
    ? "gold" : score >= 900 ? "silver" : "complete";
  return deepFreeze({ score, grade, facts: deepFreeze(facts) });
}

export function finishContestRun(value, observedAt) {
  const run = normalizeContestRun(value);
  const at = iso(observedAt);
  if (!run || !at || Date.parse(at) < Date.parse(run.startedAt) || TERMINAL.has(run.phase)) return value;
  const complete = eligible(run);
  return transition(run, { phase: complete ? CONTEST_PHASES.COMPLETED : CONTEST_PHASES.FAILED, completedAt: at, failureReason: complete ? null : "MINIMUM_NOT_MET", mode: null, candidates: [], selectedStation: null, currentExchangeRecovered: false });
}

export function tickContestRun(value, { seconds = 0, paused = false } = {}, observedAt) {
  const run = normalizeContestRun(value);
  if (!run || paused || TERMINAL.has(run.phase)) return value;
  const duration = Number(seconds);
  const at = iso(observedAt);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600 || !at) return value;
  const elapsedMilliseconds = Math.min(CONTEST_DURATION_MILLISECONDS, run.elapsedMilliseconds + Math.round(duration * 1000));
  if (elapsedMilliseconds < CONTEST_DURATION_MILLISECONDS) return transition(run, { elapsedMilliseconds });
  const complete = eligible(run);
  return transition(run, { elapsedMilliseconds, phase: complete ? CONTEST_PHASES.COMPLETED : CONTEST_PHASES.FAILED, completedAt: at, failureReason: complete ? null : "TIMED_OUT", mode: null, candidates: [], selectedStation: null, currentExchangeRecovered: false });
}

export function abandonContestRun(value, observedAt) {
  const run = normalizeContestRun(value); const at = iso(observedAt);
  return run && at && Date.parse(at) >= Date.parse(run.startedAt) && !TERMINAL.has(run.phase)
    ? transition(run, { phase: CONTEST_PHASES.ABANDONED, completedAt: at, mode: null, candidates: [], selectedStation: null, currentExchangeRecovered: false }) : value;
}

export function retryContestRun(value, startedAt) {
  const run = normalizeContestRun(value); const at = iso(startedAt);
  if (!run || !at || ![CONTEST_PHASES.FAILED, CONTEST_PHASES.ABANDONED].includes(run.phase)) return value;
  return newRun({ playerCallsign: run.playerCallsign, contestId: run.contestId, stationPool: run.stationPool, startedAt: at, retryCount: run.retryCount + 1 });
}

export function normalizeContestStation(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      npcId: identifier(own(value, "npcId"), 64), personId: identifier(own(value, "personId"), 96), stationId: identifier(own(value, "stationId"), 96),
      callsign: callsign(own(value, "callsign")), regionCode: typeof own(value, "regionCode") === "string" && /^[A-Z]{2}$/.test(own(value, "regionCode")) ? own(value, "regionCode") : null,
      locationId: identifier(own(value, "locationId"), 64), powerWatts: integer(own(value, "powerWatts"), 1000, 1), rst: /^[1-5][1-9][1-9]$/.test(own(value, "rst")) ? own(value, "rst") : null,
      operatorProfileId: identifier(own(value, "operatorProfileId"), 48), replyWpm: integer(own(value, "replyWpm"), 60, 5), isFictional: own(value, "isFictional") === true,
    };
    if (Object.values(result).some((candidate) => candidate == null || candidate === false)) return null;
    const claim = { npcId: result.npcId, callsign: result.callsign };
    if (personIdForOperator(claim) !== result.personId || stationIdentityForCallsign(result.callsign, claim)?.stationId !== result.stationId) return null;
    return deepFreeze(result);
  } catch { return null; }
}

function normalizeContact(value) {
  const station = normalizeContestStation(value);
  const mode = own(value, "mode");
  const contactId = identifier(own(value, "contactId"));
  const serialNumber = integer(own(value, "serialNumber"), CONTEST_CONTACT_LIMIT, 1);
  const completedAt = iso(own(value, "completedAt"));
  return station && MODES.has(mode) && contactId && serialNumber && completedAt
    ? deepFreeze({ contactId, ...station, mode, serialNumber, completedAt }) : null;
}

export function normalizeContestRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const stationRaw = retainedOwnValues(own(value, "stationPool"), CONTEST_CONTACT_LIMIT);
    if (!stationRaw || stationRaw.length !== CONTEST_CONTACT_LIMIT) return null;
    const stationPool = stationRaw.map(normalizeContestStation);
    if (stationPool.some((station) => !station) || new Set(stationPool.map(({ personId }) => personId)).size !== CONTEST_CONTACT_LIMIT) return null;
    const stationMap = new Map(stationPool.map((station) => [station.personId, station]));
    const contactRaw = retainedOwnValues(own(value, "contacts"), CONTEST_CONTACT_LIMIT);
    const contacts = contactRaw?.map(normalizeContact);
    if (!contacts || contacts.some((contact) => !contact) || new Set(contacts.map(({ personId }) => personId)).size !== contacts.length) return null;
    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index]; const station = stationMap.get(contact.personId);
      const { contactId: _contactId, mode: _mode, serialNumber: _serialNumber, completedAt: _completedAt, ...contactStation } = contact;
      if (!station || JSON.stringify(station) !== JSON.stringify(contactStation)
        || contact.serialNumber !== index + 1 || (index > 0 && Date.parse(contact.completedAt) < Date.parse(contacts[index - 1].completedAt))) return null;
    }
    const candidateRaw = retainedOwnValues(own(value, "candidates"), 4);
    const candidates = candidateRaw?.map(normalizeContestStation);
    if (!candidates || candidates.some((station) => !station) || candidates.some((station) => JSON.stringify(stationMap.get(station.personId)) !== JSON.stringify(station))) return null;
    const selectedRaw = own(value, "selectedStation");
    const selectedStation = selectedRaw == null ? null : normalizeContestStation(selectedRaw);
    if (selectedStation && JSON.stringify(stationMap.get(selectedStation.personId)) !== JSON.stringify(selectedStation)) return null;
    const startedAt = iso(own(value, "startedAt")); const completedRaw = own(value, "completedAt"); const completedAt = completedRaw == null ? null : iso(completedRaw);
    const phase = own(value, "phase"); const mode = own(value, "mode");
    const errorRaw = retainedOwnValues(own(value, "errors"), MAX_ERRORS);
    const recoveryRaw = retainedOwnValues(own(value, "recoveryActions"), 20);
    if (!errorRaw || errorRaw.some((item) => !identifier(item, 48)) || !recoveryRaw || recoveryRaw.some((item) => !RECOVERY.has(item))) return null;
    const run = {
      version: CONTEST_STATE_VERSION, runId: identifier(own(value, "runId")), contestId: identifier(own(value, "contestId")), playerCallsign: callsign(own(value, "playerCallsign")),
      controller: own(value, "controller"), simulation: own(value, "simulation"), phase, mode: mode == null ? null : mode,
      stationPool: deepFreeze(stationPool), candidates: deepFreeze(candidates), selectedStation, contacts: deepFreeze(contacts),
      nextSerial: integer(own(value, "nextSerial"), 11, 1), elapsedMilliseconds: integer(own(value, "elapsedMilliseconds"), CONTEST_DURATION_MILLISECONDS),
      repeatRequests: integer(own(value, "repeatRequests"), 1_000_000), bustedCalls: integer(own(value, "bustedCalls"), 1_000_000), interruptions: integer(own(value, "interruptions"), 1_000_000), duplicateAttempts: integer(own(value, "duplicateAttempts"), 1_000_000), exchangeErrors: integer(own(value, "exchangeErrors"), 1_000_000), cleanExchanges: integer(own(value, "cleanExchanges"), CONTEST_CONTACT_LIMIT),
      currentExchangeRecovered: own(value, "currentExchangeRecovered") === true,
      recoveryActions: deepFreeze(recoveryRaw), errors: deepFreeze(errorRaw), replyWpm: integer(own(value, "replyWpm"), 60, 5), retryCount: integer(own(value, "retryCount"), 100),
      failureReason: own(value, "failureReason") == null ? null : identifier(own(value, "failureReason"), 48), completedAt, startedAt,
    };
    if (Object.entries(run).some(([key, candidate]) => !["mode", "selectedStation", "failureReason", "completedAt"].includes(key) && candidate == null)) return null;
    if (!PHASES.has(phase) || (mode != null && !MODES.has(mode)) || run.simulation !== "fictional-five-minute-contest"
      || own(run.controller, "callsign") !== "SIM0CT" || own(run.controller, "npcId") !== "chapter10-contest-controller"
      || run.nextSerial !== contacts.length + 1 || run.cleanExchanges > contacts.length || (completedAt && Date.parse(completedAt) < Date.parse(startedAt))) return null;
    if (phase === CONTEST_PHASES.EXCHANGE && (!selectedStation || !MODES.has(mode))) return null;
    if (phase !== CONTEST_PHASES.EXCHANGE && run.currentExchangeRecovered) return null;
    if (phase !== CONTEST_PHASES.EXCHANGE && selectedStation) return null;
    if (phase === CONTEST_PHASES.RUN_CQ && (mode !== CONTEST_MODES.RUN || candidates.length !== 0)) return null;
    if ([CONTEST_PHASES.RUN_PILEUP, CONTEST_PHASES.SP_POOL].includes(phase) && (!MODES.has(mode) || candidates.length === 0)) return null;
    if (![CONTEST_PHASES.RUN_CQ, CONTEST_PHASES.RUN_PILEUP, CONTEST_PHASES.SP_POOL, CONTEST_PHASES.EXCHANGE].includes(phase) && (mode || candidates.length)) return null;
    if (TERMINAL.has(phase) !== Boolean(completedAt)) return null;
    if (phase === CONTEST_PHASES.COMPLETED && !eligible(run)) return null;
    return deepFreeze(run);
  } catch { return null; }
}

function normalizeContestRecord(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      id: identifier(own(value, "id")), runId: identifier(own(value, "runId")), score: integer(own(value, "score"), 10_000),
      grade: ["complete", "silver", "gold"].includes(own(value, "grade")) ? own(value, "grade") : null,
      validContacts: integer(own(value, "validContacts"), CONTEST_CONTACT_LIMIT, 6), uniqueRegions: integer(own(value, "uniqueRegions"), 6, 3),
      runContacts: integer(own(value, "runContacts"), CONTEST_CONTACT_LIMIT, 2), spContacts: integer(own(value, "spContacts"), CONTEST_CONTACT_LIMIT, 2),
      repeatRequests: integer(own(value, "repeatRequests"), 1_000_000), bustedCalls: integer(own(value, "bustedCalls"), 1_000_000), interruptions: integer(own(value, "interruptions"), 1_000_000),
      contactQsoIds: retainedOwnValues(own(value, "contactQsoIds"), CONTEST_CONTACT_LIMIT),
      contacts: retainedOwnValues(own(value, "contacts"), CONTEST_CONTACT_LIMIT),
      completedAt: iso(own(value, "completedAt")),
    };
    if (Object.values(result).some((candidate) => candidate == null) || result.contactQsoIds.length !== result.validContacts || result.contacts.length !== result.validContacts
      || result.contactQsoIds.some((id) => !identifier(id)) || new Set(result.contactQsoIds).size !== result.contactQsoIds.length) return null;
    const contacts = result.contacts.map((candidate, index) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
      const proof = {
        qsoId: identifier(own(candidate, "qsoId")), personId: identifier(own(candidate, "personId"), 96), stationId: identifier(own(candidate, "stationId"), 96),
        npcId: identifier(own(candidate, "npcId"), 64), callsign: callsign(own(candidate, "callsign")), mode: own(candidate, "mode"),
        serialNumber: integer(own(candidate, "serialNumber"), CONTEST_CONTACT_LIMIT, 1), regionCode: typeof own(candidate, "regionCode") === "string" && /^[A-Z]{2}$/.test(own(candidate, "regionCode")) ? own(candidate, "regionCode") : null,
        powerWatts: integer(own(candidate, "powerWatts"), 1000, 1), completedAt: iso(own(candidate, "completedAt")),
      };
      if (Object.values(proof).some((field) => field == null) || !MODES.has(proof.mode) || proof.qsoId !== result.contactQsoIds[index] || proof.serialNumber !== index + 1) return null;
      const identity = { npcId: proof.npcId, callsign: proof.callsign };
      return personIdForOperator(identity) === proof.personId && stationIdentityForCallsign(proof.callsign, identity)?.stationId === proof.stationId ? deepFreeze(proof) : null;
    });
    if (contacts.some((contact) => !contact) || new Set(contacts.map(({ personId }) => personId)).size !== contacts.length) return null;
    return deepFreeze({ ...result, contactQsoIds: deepFreeze(result.contactQsoIds), contacts: deepFreeze(contacts) });
  } catch { return null; }
}

function normalizeLedger(value, maximum, normalizer) {
  const raw = retainedOwnValues(value, maximum); if (!raw) return deepFreeze([]);
  const result = []; const ids = new Set(); let previous = null;
  for (const candidate of raw) {
    const record = normalizer(candidate);
    if (!record || ids.has(record.id) || (previous && (Date.parse(record.completedAt) < Date.parse(previous.completedAt)
      || (record.completedAt === previous.completedAt && record.id <= previous.id)))) return deepFreeze([]);
    result.push(record); ids.add(record.id); previous = record;
  }
  return deepFreeze(result);
}

function normalizeIds(value) {
  const raw = retainedOwnValues(value, CONTEST_SETTLED_RUN_LIMIT); if (!raw) return deepFreeze([]);
  const result = []; const seen = new Set();
  for (const candidate of raw) { const id = identifier(candidate); if (!id || seen.has(id)) return deepFreeze([]); seen.add(id); result.push(id); }
  return deepFreeze(result);
}

export function emptyContestState() { return deepFreeze({ activeRun: null, records: [], settledRunIds: [], personalBest: null, taskTreeUnlocked: false }); }
export function normalizeContestState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const active = own(source, "activeRun");
    const records = normalizeLedger(own(source, "records") ?? [], CONTEST_RECORD_LIMIT, normalizeContestRecord);
    const personalBestRaw = own(source, "personalBest");
    const personalBest = personalBestRaw == null ? null : normalizeContestRecord(personalBestRaw);
    return deepFreeze({
      activeRun: active == null ? null : normalizeContestRun(active),
      records,
      settledRunIds: normalizeIds(own(source, "settledRunIds") ?? []),
      personalBest,
      taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
    });
  } catch { return emptyContestState(); }
}

export function contestReplayAvailable(save) {
  return normalizeContestState(own(own(save, "storyContinuationState"), "chapter10")).taskTreeUnlocked;
}
