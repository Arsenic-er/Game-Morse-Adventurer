import {
  createExpeditionLoadout, expeditionSiteById, normalizeExpeditionLoadout,
} from "./expeditionCatalog.js";
import { parseExpeditionExchange } from "./expeditionExchange.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";

export const EXPEDITION_RUN_VERSION = 1;
export const EXPEDITION_STATE_VERSION = 1;
export const EXPEDITION_DURATION_SECONDS = 900;
export const EXPEDITION_DURATION_MILLISECONDS = EXPEDITION_DURATION_SECONDS * 1_000;
export const MAX_EXPEDITION_CONTACTS = 8;
const MAX_RECOVERY_ACTIONS = 4;
const MILLIWATT_MILLISECONDS_PER_WH = 3_600_000_000;
const SETUP_MISTAKE_TIME_PENALTY_MILLISECONDS = 30_000;
const SETUP_MISTAKE_ENERGY_PENALTY_WH = 1;
const MAX_SETUP_MISTAKES = 3;
const RUN_STATUSES = new Set([
  "site-selection", "setup", "ready", "calling", "exchange", "recovering",
  "completed", "failed", "abandoned",
]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "abandoned"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function own(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function finite(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
}

function integer(value, minimum, maximum, fallback = minimum) {
  return Math.floor(finite(value, minimum, maximum, fallback));
}

function iso(value, fallback = null) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function boundedText(value, maximum = 128) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maximum);
}

function callsign(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{1,7}$/.test(normalized) ? normalized : "";
}

function rst(value, fallback) {
  const normalized = String(value ?? "").trim();
  return /^[1-5][1-9][1-9]$/.test(normalized) ? normalized : fallback;
}

function normalizeFieldSite(value) {
  const site = expeditionSiteById(
    value && typeof value === "object" ? own(value, "id") : value,
  );
  return site ? { ...site } : null;
}

function normalizePropagationSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capturedAt = iso(own(value, "capturedAt"));
  if (!capturedAt) return null;
  return {
    level: integer(own(value, "level"), 0, 4, 2),
    noise: integer(own(value, "noise"), 0, 4, 2),
    capturedAt,
  };
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function derivedPropagation(run, capturedAt) {
  const seed = hash(`${run.runId}:${run.fieldSite?.id}:expedition-propagation-v1`);
  const bias = integer(run.fieldSite?.propagationBias, -1, 1, 0);
  return {
    level: integer(1 + (seed % 4) + bias, 0, 4, 2),
    noise: integer((seed >>> 3) % 5, 0, 4, 2),
    capturedAt,
  };
}

function normalizedContact(value, { completed = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalizedCallsign = String(own(value, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
  const identitySource = { ...value, callsign: normalizedCallsign };
  const personId = personIdForOperator(identitySource);
  const station = stationIdentityForCallsign(normalizedCallsign, identitySource);
  const startedAt = iso(own(value, "startedAt"));
  if (!personId || !station || !startedAt) return null;
  const completedAt = completed ? iso(own(value, "completedAt")) : null;
  if (completed && (!completedAt || Date.parse(completedAt) < Date.parse(startedAt))) return null;
  const suppliedTopics = own(value, "topics");
  const topics = Array.isArray(suppliedTopics)
    ? [...new Set(suppliedTopics.slice(-12)
      .filter((topic) => ["QTH", "POWER", "ANTENNA"].includes(topic)))].slice(0, 3)
    : [];
  const suppliedRecoveryActions = own(value, "recoveryActions");
  const recoveryActions = Array.isArray(suppliedRecoveryActions)
    ? suppliedRecoveryActions.slice(-MAX_RECOVERY_ACTIONS * 4)
      .filter((action) => ["AGN", "QRS"].includes(action)).slice(-MAX_RECOVERY_ACTIONS)
    : [];
  return {
    callsign: station.callsign,
    personId,
    stationId: station.stationId,
    locationId: boundedText(own(value, "locationId") || "fictional-expedition-contact", 64),
    distanceKm: Number(finite(own(value, "distanceKm"), 0, 50_000, 0).toFixed(1)),
    sentRst: rst(own(value, "sentRst"), "579"),
    receivedRst: rst(own(value, "receivedRst"), "559"),
    remoteWpm: Number(finite(own(value, "remoteWpm"), 5, 60, 18).toFixed(1)),
    operatorProfileId: boundedText(own(value, "operatorProfileId") || "legacy-standard", 48),
    startedAt,
    ...(completed ? {
      completedAt,
      topics,
      recoveryActions,
      exchange: {
        qthCode: boundedText(own(own(value, "exchange"), "qthCode"), 12).toUpperCase(),
        powerWatts: finite(own(own(value, "exchange"), "powerWatts"), 1, 100, 5),
        antennaCode: boundedText(own(own(value, "exchange"), "antennaCode"), 12).toUpperCase(),
      },
    } : {}),
  };
}

function normalizeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const suppliedOutcome = own(value, "outcome");
  const outcome = ["success", "failed", "abandoned"].includes(suppliedOutcome) ? suppliedOutcome : null;
  const completedAt = iso(own(value, "completedAt"));
  if (!outcome || !completedAt) return null;
  return { outcome, completedAt, contactCount: integer(own(value, "contactCount"), 0, MAX_EXPEDITION_CONTACTS, 0) };
}

function contactMatchesExpedition(contact, fieldSite, loadout) {
  if (!contact || !fieldSite || !loadout) return false;
  if (!["QTH", "POWER", "ANTENNA"].every((topic) => contact.topics.includes(topic))) return false;
  const exchange = contact.exchange;
  const verification = parseExpeditionExchange(
    `QTH ${exchange.qthCode} PWR ${exchange.powerWatts}W ANT ${exchange.antennaCode}`,
    {
      qthCode: fieldSite.qthCode,
      powerWatts: loadout.outputPowerWatts,
      antennaCode: loadout.antennaCode,
    },
    { safeToCommit: true },
  );
  return verification.accepted;
}

export function normalizeExpeditionRun(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const runId = boundedText(own(source, "runId") || "invalid-expedition-run", 128) || "invalid-expedition-run";
  const startedAt = iso(own(source, "startedAt"), new Date(0).toISOString());
  const suppliedLoadout = normalizeExpeditionLoadout(own(source, "loadout"));
  const loadout = suppliedLoadout
    ?? createExpeditionLoadout({}, { source: "loan" });
  const fieldSite = normalizeFieldSite(own(source, "fieldSite") ?? own(source, "fieldSiteId"));
  const suppliedSetup = own(source, "setup");
  const setup = {
    antenna: own(suppliedSetup, "antenna") === true,
    power: own(suppliedSetup, "power") === true,
  };
  const suppliedPower = own(source, "power");
  const powerCapacity = finite(own(suppliedPower, "capacityWh"), 1, 2_000, loadout.capacityWh);
  const maximumEnergy = Math.round(powerCapacity * MILLIWATT_MILLISECONDS_PER_WH);
  const legacyRemaining = finite(own(suppliedPower, "remainingWh"), 0, powerCapacity, powerCapacity);
  const usedMilliWattMilliseconds = integer(
    own(suppliedPower, "usedMilliWattMilliseconds"),
    0,
    maximumEnergy,
    Math.round((powerCapacity - legacyRemaining) * MILLIWATT_MILLISECONDS_PER_WH),
  );
  const powerRemaining = Math.max(
    0,
    powerCapacity - usedMilliWattMilliseconds / MILLIWATT_MILLISECONDS_PER_WH,
  );
  const suppliedContacts = own(source, "contacts");
  const contacts = (Array.isArray(suppliedContacts) ? suppliedContacts : [])
    .slice(-MAX_EXPEDITION_CONTACTS * 2)
    .map((contact) => normalizedContact(contact, { completed: true }))
    .filter(Boolean)
    .slice(-MAX_EXPEDITION_CONTACTS);
  const activeContact = normalizedContact(own(source, "activeContact"));
  const suppliedRecoveryActions = own(source, "recoveryActions");
  const recoveryActions = (Array.isArray(suppliedRecoveryActions) ? suppliedRecoveryActions : [])
    .slice(-MAX_RECOVERY_ACTIONS * 4)
    .filter((action) => ["AGN", "QRS"].includes(action))
    .slice(-MAX_RECOVERY_ACTIONS);
  const result = normalizeResult(own(source, "result"));
  let status = RUN_STATUSES.has(own(source, "status")) ? own(source, "status") : "failed";
  let failureReason = boundedText(own(source, "failureReason"), 48) || null;
  if (status !== "site-selection" && (!fieldSite || !suppliedLoadout)) {
    status = "failed";
    failureReason = "CORRUPT_RUN";
  }
  const suppliedLastExchange = own(source, "lastExchange");
  const lastExchange = suppliedLastExchange && typeof suppliedLastExchange === "object" ? {
    accepted: own(suppliedLastExchange, "accepted") === true,
    errors: (Array.isArray(own(suppliedLastExchange, "errors"))
      ? own(suppliedLastExchange, "errors") : [])
      .slice(-8).map((error) => boundedText(error, 48)).filter(Boolean),
  } : null;
  const completedAtMatches = contacts.length > 0
    && result?.completedAt === contacts.at(-1)?.completedAt;
  const trustworthyCompletion = result?.outcome === "success"
    && result.contactCount === contacts.length
    && contacts.length > 0
    && setup.antenna
    && setup.power
    && normalizePropagationSnapshot(own(source, "propagationSnapshot")) !== null
    && activeContact === null
    && lastExchange?.accepted === true
    && lastExchange.errors.length === 0
    && completedAtMatches
    && contacts.every((contact) => contactMatchesExpedition(contact, fieldSite, suppliedLoadout));
  if (status === "completed" && !trustworthyCompletion) {
    status = "failed";
    failureReason = "CORRUPT_RUN";
  }
  const terminalResult = status === "failed" && result?.outcome !== "failed"
    ? { outcome: "failed", completedAt: iso(own(source, "updatedAt"), startedAt), contactCount: 0 }
    : status === "abandoned" && result?.outcome !== "abandoned"
      ? { outcome: "abandoned", completedAt: iso(own(source, "updatedAt"), startedAt), contactCount: 0 }
      : result;
  const elapsedMilliseconds = integer(
    own(source, "elapsedMilliseconds"),
    0,
    EXPEDITION_DURATION_MILLISECONDS,
    integer(own(source, "elapsedSeconds") * 1_000, 0, EXPEDITION_DURATION_MILLISECONDS, 0),
  );
  return deepFreeze({
    version: EXPEDITION_RUN_VERSION,
    runId,
    playerCallsign: callsign(own(source, "playerCallsign")),
    status,
    fieldSite,
    loadout,
    power: {
      capacityWh: Number(powerCapacity.toFixed(3)),
      remainingWh: Number(powerRemaining.toFixed(6)),
      consumedWh: Number((powerCapacity - powerRemaining).toFixed(6)),
      usedMilliWattMilliseconds,
    },
    setup,
    setupMistakes: integer(own(source, "setupMistakes"), 0, MAX_SETUP_MISTAKES, 0),
    setupPropagationPenalty: integer(own(source, "setupPropagationPenalty"), 0, 2, 0),
    propagationSnapshot: normalizePropagationSnapshot(own(source, "propagationSnapshot")),
    activeContact,
    contacts,
    attempts: integer(own(source, "attempts"), 0, 3, 0),
    recoveryActions,
    elapsedMilliseconds,
    elapsedSeconds: Math.floor(elapsedMilliseconds / 1_000),
    failureReason,
    lastExchange,
    result: terminalResult,
    settlementStatus: own(source, "settlementStatus") === "settled" ? "settled" : "pending",
    startedAt,
    updatedAt: iso(own(source, "updatedAt"), startedAt),
  });
}

function changed(run, changes) {
  return normalizeExpeditionRun({ ...run, ...changes });
}

export function createExpeditionRun({ runId, playerCallsign, loadout, startedAt } = {}) {
  const start = iso(startedAt);
  const normalizedLoadout = normalizeExpeditionLoadout(loadout);
  if (!boundedText(runId, 128) || !callsign(playerCallsign) || !normalizedLoadout || !start) {
    throw new TypeError("A run id, player callsign, temporary loadout, and start time are required.");
  }
  return normalizeExpeditionRun({
    version: EXPEDITION_RUN_VERSION,
    runId,
    playerCallsign,
    status: "site-selection",
    fieldSite: null,
    loadout: normalizedLoadout,
    power: { capacityWh: normalizedLoadout.capacityWh, remainingWh: normalizedLoadout.capacityWh },
    setup: { antenna: false, power: false },
    setupMistakes: 0,
    setupPropagationPenalty: 0,
    contacts: [],
    attempts: 0,
    recoveryActions: [],
    elapsedSeconds: 0,
    elapsedMilliseconds: 0,
    settlementStatus: "pending",
    startedAt: start,
    updatedAt: start,
  });
}

export function selectExpeditionSite(value, siteId, observedAt) {
  const run = normalizeExpeditionRun(value);
  const site = expeditionSiteById(siteId);
  const at = iso(observedAt);
  if (run.status !== "site-selection" || !site || !at) return run;
  return changed(run, { status: "setup", fieldSite: site, updatedAt: at });
}

export function attemptExpeditionSetup(value, stage, attempt = {}, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (run.status !== "setup" || !["antenna", "power"].includes(stage) || !at) return run;
  if (own(attempt, "valid") !== true) {
    const permittedErrors = stage === "antenna"
      ? new Set(["INVALID_WIRING", "INVALID_ANTENNA"])
      : new Set(["INVALID_POWER"]);
    const suppliedErrorCode = own(attempt, "errorCode");
    const errorCode = permittedErrors.has(suppliedErrorCode)
      ? suppliedErrorCode
      : stage === "antenna" ? "INVALID_WIRING" : "INVALID_POWER";
    const setupMistakes = Math.min(MAX_SETUP_MISTAKES, run.setupMistakes + 1);
    const elapsedMilliseconds = Math.min(
      EXPEDITION_DURATION_MILLISECONDS,
      run.elapsedMilliseconds + SETUP_MISTAKE_TIME_PENALTY_MILLISECONDS,
    );
    const maximumEnergy = Math.round(run.power.capacityWh * MILLIWATT_MILLISECONDS_PER_WH);
    const usedMilliWattMilliseconds = Math.min(
      maximumEnergy,
      run.power.usedMilliWattMilliseconds
        + SETUP_MISTAKE_ENERGY_PENALTY_WH * MILLIWATT_MILLISECONDS_PER_WH,
    );
    const exhausted = setupMistakes >= MAX_SETUP_MISTAKES;
    return changed(run, {
      setupMistakes,
      setupPropagationPenalty: Math.min(2, run.setupPropagationPenalty + 1),
      elapsedMilliseconds,
      power: { capacityWh: run.power.capacityWh, usedMilliWattMilliseconds },
      status: exhausted ? "failed" : "setup",
      failureReason: exhausted ? "SETUP_RETRIES_EXHAUSTED" : errorCode,
      result: exhausted ? { outcome: "failed", completedAt: at, contactCount: 0 } : null,
      updatedAt: at,
    });
  }
  const setup = { ...run.setup, [stage]: true };
  return changed(run, {
    setup,
    status: setup.antenna && setup.power ? "ready" : "setup",
    failureReason: null,
    updatedAt: at,
  });
}

export function advanceExpeditionSetup(value, stage, observedAt) {
  return attemptExpeditionSetup(value, stage, { valid: true }, observedAt);
}

function consumedEnergy(run, elapsedMilliseconds, transmitting) {
  const drawWatts = transmitting ? run.loadout.transmitDrawWatts : run.loadout.receiveDrawWatts;
  const drawMilliWatts = Math.round(drawWatts * 1_000);
  return Math.min(
    Math.round(run.power.capacityWh * MILLIWATT_MILLISECONDS_PER_WH),
    run.power.usedMilliWattMilliseconds + drawMilliWatts * elapsedMilliseconds,
  );
}

export function tickExpeditionRun(value, { seconds = 0, transmitting = false } = {}, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (TERMINAL_STATUSES.has(run.status) || !at) return run;
  const requestedMilliseconds = integer(
    finite(seconds, 0, EXPEDITION_DURATION_SECONDS, 0) * 1_000,
    0,
    EXPEDITION_DURATION_MILLISECONDS,
    0,
  );
  const effectiveMilliseconds = Math.min(
    requestedMilliseconds,
    EXPEDITION_DURATION_MILLISECONDS - run.elapsedMilliseconds,
  );
  const nextElapsed = run.elapsedMilliseconds + effectiveMilliseconds;
  const usedMilliWattMilliseconds = consumedEnergy(run, effectiveMilliseconds, transmitting);
  const depleted = usedMilliWattMilliseconds
    >= Math.round(run.power.capacityWh * MILLIWATT_MILLISECONDS_PER_WH);
  const timedOut = nextElapsed >= EXPEDITION_DURATION_MILLISECONDS;
  const terminalFailure = timedOut ? "TIMED_OUT" : depleted ? "POWER_DEPLETED" : null;
  return changed(run, {
    elapsedMilliseconds: nextElapsed,
    power: { capacityWh: run.power.capacityWh, usedMilliWattMilliseconds },
    status: terminalFailure ? "failed" : run.status,
    failureReason: terminalFailure ?? run.failureReason,
    result: terminalFailure ? { outcome: "failed", completedAt: at, contactCount: 0 } : run.result,
    activeContact: terminalFailure ? null : run.activeContact,
    updatedAt: at,
  });
}

export function beginExpeditionCq(value, { observedAt, propagationSnapshot = null } = {}) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (!at || run.status === "calling") return run;
  if (run.status !== "ready") return run;
  const powered = tickExpeditionRun(run, { seconds: 3, transmitting: true }, at);
  if (powered.status === "failed") return powered;
  const baseSnapshot = run.propagationSnapshot
    ?? normalizePropagationSnapshot(propagationSnapshot)
    ?? derivedPropagation(run, at);
  const snapshot = run.propagationSnapshot ?? {
    ...baseSnapshot,
    level: Math.max(0, baseSnapshot.level - run.setupPropagationPenalty),
  };
  return changed(powered, {
    status: "calling",
    propagationSnapshot: snapshot,
    failureReason: null,
    updatedAt: at,
  });
}

export function receiveExpeditionContact(value, contact, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  const normalized = normalizedContact({ ...contact, startedAt: at });
  if (run.status !== "calling" || !normalized || !at) return run;
  return changed(run, {
    status: "exchange",
    activeContact: normalized,
    attempts: 0,
    recoveryActions: [],
    failureReason: null,
    updatedAt: at,
  });
}

export function requestExpeditionRecovery(value, action, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  const normalizedAction = String(action ?? "").trim().toUpperCase();
  if (run.status !== "recovering" || !["AGN", "QRS"].includes(normalizedAction) || !at) return run;
  return changed(run, {
    status: "exchange",
    recoveryActions: [...run.recoveryActions, normalizedAction].slice(-MAX_RECOVERY_ACTIONS),
    failureReason: null,
    updatedAt: at,
  });
}

export function submitExpeditionExchange(value, message, semantic, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (run.status !== "exchange" || !run.activeContact || !run.fieldSite || !at) return run;
  const powered = tickExpeditionRun(run, { seconds: 12, transmitting: true }, at);
  if (powered.status === "failed") return powered;
  const parsed = parseExpeditionExchange(message, {
    qthCode: powered.fieldSite.qthCode,
    powerWatts: powered.loadout.outputPowerWatts,
    antennaCode: powered.loadout.antennaCode,
  }, semantic);
  const attempts = Math.min(3, powered.attempts + 1);
  const lastExchange = { accepted: parsed.accepted, errors: parsed.errors };
  if (!parsed.accepted) {
    const exhausted = attempts >= 3;
    return changed(powered, {
      status: exhausted ? "failed" : "recovering",
      attempts,
      failureReason: exhausted ? "EXCHANGE_RETRIES_EXHAUSTED" : parsed.errors[0] ?? "EXCHANGE_NOT_COPIED",
      lastExchange,
      activeContact: exhausted ? null : powered.activeContact,
      result: exhausted ? { outcome: "failed", completedAt: at, contactCount: 0 } : null,
      updatedAt: at,
    });
  }
  if (powered.propagationSnapshot.level <= 1 && powered.recoveryActions.length === 0) {
    return changed(powered, {
      status: "recovering",
      attempts,
      failureReason: "WEAK_LINK_REQUIRES_RECOVERY",
      lastExchange,
      updatedAt: at,
    });
  }
  const contact = normalizedContact({
    ...powered.activeContact,
    completedAt: at,
    topics: parsed.topics,
    recoveryActions: powered.recoveryActions,
    exchange: parsed.fields,
  }, { completed: true });
  if (!contact) {
    return changed(powered, {
      status: "failed",
      failureReason: "CORRUPT_CONTACT",
      activeContact: null,
      result: { outcome: "failed", completedAt: at, contactCount: 0 },
      updatedAt: at,
    });
  }
  const contacts = [...powered.contacts, contact].slice(-MAX_EXPEDITION_CONTACTS);
  return changed(powered, {
    status: "completed",
    attempts,
    failureReason: null,
    activeContact: null,
    contacts,
    lastExchange,
    result: { outcome: "success", completedAt: at, contactCount: contacts.length },
    updatedAt: at,
  });
}

export function abandonExpeditionRun(value, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (TERMINAL_STATUSES.has(run.status) || !at) return run;
  return changed(run, {
    status: "abandoned",
    activeContact: null,
    contacts: [],
    failureReason: "ABANDONED",
    result: { outcome: "abandoned", completedAt: at, contactCount: 0 },
    updatedAt: at,
  });
}

export function retryExpeditionRun(value, { runId, startedAt } = {}) {
  const run = normalizeExpeditionRun(value);
  if (!["failed", "abandoned"].includes(run.status)) return run;
  const fresh = createExpeditionRun({
    runId,
    playerCallsign: run.playerCallsign,
    loadout: run.loadout,
    startedAt,
  });
  return run.fieldSite ? selectExpeditionSite(fresh, run.fieldSite.id, startedAt) : fresh;
}

export function emptyExpeditionState() {
  return {
    version: EXPEDITION_STATE_VERSION,
    activeRun: null,
    settledRunIds: [],
    completedRuns: [],
    expeditionTreeUnlocked: false,
  };
}

function normalizeRunSummary(value) {
  const runId = boundedText(own(value, "runId"), 128);
  const completedAt = iso(own(value, "completedAt"));
  const site = expeditionSiteById(own(value, "siteId"));
  if (!runId || !completedAt || !site) return null;
  return {
    runId,
    completedAt,
    siteId: site.id,
    qsoId: boundedText(own(value, "qsoId"), 96) || null,
  };
}

export function normalizeExpeditionState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const completedMap = new Map();
  const suppliedCompletedRuns = own(source, "completedRuns");
  for (const candidate of (Array.isArray(suppliedCompletedRuns) ? suppliedCompletedRuns : []).slice(-80)) {
    const summary = normalizeRunSummary(candidate);
    if (summary) completedMap.set(summary.runId, summary);
  }
  const completedRuns = [...completedMap.values()]
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .slice(-20);
  const suppliedSettledRunIds = own(source, "settledRunIds");
  const suppliedSettled = (Array.isArray(suppliedSettledRunIds) ? suppliedSettledRunIds.slice(-200) : [])
    .map((id) => boundedText(id, 128)).filter(Boolean).slice(-200);
  const migrationBaseline = Number(own(source, "version")) >= EXPEDITION_STATE_VERSION
    ? [] : completedRuns.map(({ runId }) => runId);
  const settledRunIds = [...new Set([...suppliedSettled, ...migrationBaseline])].slice(-100);
  return deepFreeze({
    version: EXPEDITION_STATE_VERSION,
    activeRun: own(source, "activeRun") ? normalizeExpeditionRun(own(source, "activeRun")) : null,
    settledRunIds,
    completedRuns,
    expeditionTreeUnlocked: own(source, "expeditionTreeUnlocked") === true,
  });
}
