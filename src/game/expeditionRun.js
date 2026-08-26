import {
  createExpeditionLoadout, expeditionSiteById, normalizeExpeditionLoadout,
} from "./expeditionCatalog.js";
import { parseExpeditionExchange } from "./expeditionExchange.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";

export const EXPEDITION_RUN_VERSION = 1;
export const EXPEDITION_STATE_VERSION = 1;
export const EXPEDITION_DURATION_SECONDS = 900;
export const MAX_EXPEDITION_CONTACTS = 8;
const MAX_RECOVERY_ACTIONS = 4;
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
  const site = expeditionSiteById(value?.id ?? value);
  return site ? { ...site } : null;
}

function normalizePropagationSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capturedAt = iso(value.capturedAt);
  if (!capturedAt) return null;
  return {
    level: integer(value.level, 0, 4, 2),
    noise: integer(value.noise, 0, 4, 2),
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
  const normalizedCallsign = String(value.callsign ?? "").trim().toUpperCase().slice(0, 16);
  const identitySource = { ...value, callsign: normalizedCallsign };
  const personId = personIdForOperator(identitySource);
  const station = stationIdentityForCallsign(normalizedCallsign, identitySource);
  const startedAt = iso(value.startedAt);
  if (!personId || !station || !startedAt) return null;
  const completedAt = completed ? iso(value.completedAt) : null;
  if (completed && (!completedAt || Date.parse(completedAt) < Date.parse(startedAt))) return null;
  const topics = Array.isArray(value.topics)
    ? [...new Set(value.topics.slice(-12)
      .filter((topic) => ["QTH", "POWER", "ANTENNA"].includes(topic)))].slice(0, 3)
    : [];
  const recoveryActions = Array.isArray(value.recoveryActions)
    ? value.recoveryActions.slice(-MAX_RECOVERY_ACTIONS * 4)
      .filter((action) => ["AGN", "QRS"].includes(action)).slice(-MAX_RECOVERY_ACTIONS)
    : [];
  return {
    callsign: station.callsign,
    personId,
    stationId: station.stationId,
    locationId: boundedText(value.locationId || "fictional-expedition-contact", 64),
    distanceKm: Number(finite(value.distanceKm, 0, 50_000, 0).toFixed(1)),
    sentRst: rst(value.sentRst, "579"),
    receivedRst: rst(value.receivedRst, "559"),
    remoteWpm: Number(finite(value.remoteWpm, 5, 60, 18).toFixed(1)),
    operatorProfileId: boundedText(value.operatorProfileId || "legacy-standard", 48),
    startedAt,
    ...(completed ? {
      completedAt,
      topics,
      recoveryActions,
      exchange: {
        qthCode: boundedText(value.exchange?.qthCode, 12).toUpperCase(),
        powerWatts: finite(value.exchange?.powerWatts, 1, 100, 5),
        antennaCode: boundedText(value.exchange?.antennaCode, 12).toUpperCase(),
      },
    } : {}),
  };
}

function normalizeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outcome = ["success", "failed", "abandoned"].includes(value.outcome) ? value.outcome : null;
  const completedAt = iso(value.completedAt);
  if (!outcome || !completedAt) return null;
  return { outcome, completedAt, contactCount: integer(value.contactCount, 0, MAX_EXPEDITION_CONTACTS, 0) };
}

export function normalizeExpeditionRun(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const runId = boundedText(source.runId || "invalid-expedition-run", 128) || "invalid-expedition-run";
  const startedAt = iso(source.startedAt, new Date(0).toISOString());
  const loadout = normalizeExpeditionLoadout(source.loadout)
    ?? createExpeditionLoadout({}, { source: "loan" });
  const fieldSite = normalizeFieldSite(source.fieldSite ?? source.fieldSiteId);
  const setup = {
    antenna: source.setup?.antenna === true,
    power: source.setup?.power === true,
  };
  const powerCapacity = finite(source.power?.capacityWh, 1, 2_000, loadout.capacityWh);
  const powerRemaining = finite(source.power?.remainingWh, 0, powerCapacity, powerCapacity);
  const contacts = (Array.isArray(source.contacts) ? source.contacts : [])
    .slice(-MAX_EXPEDITION_CONTACTS * 2)
    .map((contact) => normalizedContact(contact, { completed: true }))
    .filter(Boolean)
    .slice(-MAX_EXPEDITION_CONTACTS);
  const activeContact = normalizedContact(source.activeContact);
  const recoveryActions = (Array.isArray(source.recoveryActions) ? source.recoveryActions : [])
    .slice(-MAX_RECOVERY_ACTIONS * 4)
    .filter((action) => ["AGN", "QRS"].includes(action))
    .slice(-MAX_RECOVERY_ACTIONS);
  const result = normalizeResult(source.result);
  let status = RUN_STATUSES.has(source.status) ? source.status : "failed";
  let failureReason = boundedText(source.failureReason, 48) || null;
  if (status !== "site-selection" && !fieldSite) {
    status = "failed";
    failureReason = "CORRUPT_RUN";
  }
  if (status === "completed" && (result?.outcome !== "success" || contacts.length === 0)) {
    status = "failed";
    failureReason = "CORRUPT_RUN";
  }
  const terminalResult = status === "failed" && result?.outcome !== "failed"
    ? { outcome: "failed", completedAt: iso(source.updatedAt, startedAt), contactCount: 0 }
    : status === "abandoned" && result?.outcome !== "abandoned"
      ? { outcome: "abandoned", completedAt: iso(source.updatedAt, startedAt), contactCount: 0 }
      : result;
  return deepFreeze({
    version: EXPEDITION_RUN_VERSION,
    runId,
    playerCallsign: callsign(source.playerCallsign),
    status,
    fieldSite,
    loadout,
    power: {
      capacityWh: Number(powerCapacity.toFixed(3)),
      remainingWh: Number(powerRemaining.toFixed(3)),
      consumedWh: Number((powerCapacity - powerRemaining).toFixed(3)),
    },
    setup,
    propagationSnapshot: normalizePropagationSnapshot(source.propagationSnapshot),
    activeContact,
    contacts,
    attempts: integer(source.attempts, 0, 3, 0),
    recoveryActions,
    elapsedSeconds: integer(source.elapsedSeconds, 0, EXPEDITION_DURATION_SECONDS, 0),
    failureReason,
    lastExchange: source.lastExchange && typeof source.lastExchange === "object" ? {
      accepted: source.lastExchange.accepted === true,
      errors: (Array.isArray(source.lastExchange.errors) ? source.lastExchange.errors : [])
        .map((error) => boundedText(error, 48)).filter(Boolean).slice(0, 8),
    } : null,
    result: terminalResult,
    settlementStatus: source.settlementStatus === "settled" ? "settled" : "pending",
    startedAt,
    updatedAt: iso(source.updatedAt, startedAt),
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
    contacts: [],
    attempts: 0,
    recoveryActions: [],
    elapsedSeconds: 0,
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

export function advanceExpeditionSetup(value, stage, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (run.status !== "setup" || !["antenna", "power"].includes(stage) || !at) return run;
  const setup = { ...run.setup, [stage]: true };
  return changed(run, {
    setup,
    status: setup.antenna && setup.power ? "ready" : "setup",
    updatedAt: at,
  });
}

function consumePower(run, seconds, transmitting) {
  const boundedSeconds = finite(seconds, 0, EXPEDITION_DURATION_SECONDS, 0);
  const drawWatts = transmitting ? run.loadout.transmitDrawWatts : run.loadout.receiveDrawWatts;
  const consumedWh = drawWatts * boundedSeconds / 3600;
  return Math.max(0, run.power.remainingWh - consumedWh);
}

export function tickExpeditionRun(value, { seconds = 0, transmitting = false } = {}, observedAt) {
  const run = normalizeExpeditionRun(value);
  const at = iso(observedAt);
  if (TERMINAL_STATUSES.has(run.status) || !at) return run;
  const nextElapsed = integer(run.elapsedSeconds + finite(seconds, 0, EXPEDITION_DURATION_SECONDS, 0), 0, EXPEDITION_DURATION_SECONDS, run.elapsedSeconds);
  const remainingWh = consumePower(run, seconds, transmitting);
  const timedOut = nextElapsed >= EXPEDITION_DURATION_SECONDS;
  const depleted = remainingWh <= 0;
  const terminalFailure = timedOut ? "TIMED_OUT" : depleted ? "POWER_DEPLETED" : null;
  return changed(run, {
    elapsedSeconds: nextElapsed,
    power: { capacityWh: run.power.capacityWh, remainingWh },
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
  const snapshot = run.propagationSnapshot
    ?? normalizePropagationSnapshot(propagationSnapshot)
    ?? derivedPropagation(run, at);
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
  const runId = boundedText(value?.runId, 128);
  const completedAt = iso(value?.completedAt);
  const site = expeditionSiteById(value?.siteId);
  if (!runId || !completedAt || !site) return null;
  return {
    runId,
    completedAt,
    siteId: site.id,
    qsoId: boundedText(value?.qsoId, 96) || null,
  };
}

export function normalizeExpeditionState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const completedMap = new Map();
  for (const candidate of (Array.isArray(source.completedRuns) ? source.completedRuns : []).slice(-80)) {
    const summary = normalizeRunSummary(candidate);
    if (summary) completedMap.set(summary.runId, summary);
  }
  const completedRuns = [...completedMap.values()]
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .slice(-20);
  const suppliedSettled = (Array.isArray(source.settledRunIds) ? source.settledRunIds.slice(-200) : [])
    .map((id) => boundedText(id, 128)).filter(Boolean).slice(-200);
  const migrationBaseline = Number(source.version) >= EXPEDITION_STATE_VERSION
    ? [] : completedRuns.map(({ runId }) => runId);
  const settledRunIds = [...new Set([...suppliedSettled, ...migrationBaseline])].slice(-100);
  return deepFreeze({
    version: EXPEDITION_STATE_VERSION,
    activeRun: source.activeRun ? normalizeExpeditionRun(source.activeRun) : null,
    settledRunIds,
    completedRuns,
    expeditionTreeUnlocked: source.expeditionTreeUnlocked === true,
  });
}
