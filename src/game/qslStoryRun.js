import { QSL_CHOICES, createQslRecord } from "./qslRecords.js";

export const QSL_STORY_STATE_VERSION = 1;
export const MAX_QSL_STORY_CASES = 40;
export const MAX_QSL_STORY_SETTLED_RUN_IDS = 100;
const MAX_ERRORS = 3;
const MAX_RECOVERY_ACTIONS = 6;
const INITIAL_REPLY_WPM = 16;

export const QSL_STORY_PHASES = Object.freeze({
  CASE_OPEN: "CASE_OPEN",
  PLAYER_CLARIFICATION_CALL: "PLAYER_CLARIFICATION_CALL",
  SORA_CLARIFICATION_REPLY: "SORA_CLARIFICATION_REPLY",
  PLAYER_FINAL_CHOICE: "PLAYER_FINAL_CHOICE",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

const PHASES = new Set(Object.values(QSL_STORY_PHASES));
const TERMINAL_PHASES = new Set([
  QSL_STORY_PHASES.COMPLETED,
  QSL_STORY_PHASES.FAILED,
  QSL_STORY_PHASES.ABANDONED,
]);
const ERRORS = new Set([
  "CASE_MISMATCH", "CALLSIGN_MISMATCH", "QSL_REQUIRED", "FORMAT_INVALID", "SEMANTIC_UNSAFE",
]);
const RECOVERY_ACTIONS = new Set(["AGN", "QRS"]);
const REPLY_NARRATIVE_KEY = "qsl.operator.sora-clarification";

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function boundedText(value, maximum = 128) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= maximum && !/[\u0000-\u001F\u007F]/.test(result) ? result : null;
}

function id(value, maximum = 128) {
  const result = boundedText(value, maximum);
  return result && /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(result) ? result : null;
}

function callsign(value) {
  const result = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{1,7}$/.test(result) ? result : null;
}

function iso(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 0 ? Math.min(result, maximum) : 0;
}

function hash32(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function strictArray(value, maximum, allowlist) {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value")
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const result = [];
    const start = Math.max(0, lengthDescriptor.value - maximum);
    for (let index = start; index < lengthDescriptor.value; index += 1) {
      if (!Object.hasOwn(value, index)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value") || !allowlist.has(descriptor.value)) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function caseIdFor(sourceQslId) {
  const direct = /^qsl-([A-Za-z0-9-]{1,24})$/.exec(sourceQslId);
  const expedition = /^qsl:expedition:([A-Za-z0-9-]{1,24})$/.exec(sourceQslId);
  return (direct?.[1] ?? expedition?.[1])?.toUpperCase()
    ?? `CASE-${hash32(sourceQslId).slice(0, 6).toUpperCase()}`;
}

function runIdFor(sourceQslId, startedAt, retryCount) {
  return `qsl-story:${hash32(`${sourceQslId}|${startedAt}|${retryCount}`)}`;
}

function newRun(source, playerCallsign, startedAt, retryCount = 0) {
  const run = {
    version: QSL_STORY_STATE_VERSION,
    runId: runIdFor(source.id, startedAt, retryCount),
    sourceQslId: source.id,
    sourceQsoId: source.qsoId,
    sourceEventRunId: source.eventRunId,
    caseId: caseIdFor(source.id),
    playerCallsign,
    personId: "person:sora",
    stationId: "station:sim6jp",
    callsign: "SIM6JP",
    initialChoice: source.choice,
    finalChoice: null,
    phase: QSL_STORY_PHASES.CASE_OPEN,
    startedAt,
    completedAt: null,
    clarificationAcceptedAt: null,
    replyReceivedAt: null,
    replyNarrativeKey: REPLY_NARRATIVE_KEY,
    replyWpm: INITIAL_REPLY_WPM,
    recoveryActions: [],
    errors: [],
    retryCount,
  };
  return deepFreeze(run);
}

function transition(run, changes) {
  return deepFreeze({ ...run, ...changes });
}

function failure(run, reason, at) {
  const errors = [...run.errors, reason].slice(-MAX_ERRORS);
  return transition(run, {
    errors,
    phase: errors.length >= MAX_ERRORS ? QSL_STORY_PHASES.FAILED : run.phase,
    completedAt: errors.length >= MAX_ERRORS ? at : null,
  });
}

function safeSemantic(value) {
  return own(value, "safeToCommit") === true;
}

function tokens(value) {
  try {
    const text = String(value ?? "").toUpperCase().trim();
    if (!text || text.length > 128) return [];
    return text.replace(/[^A-Z0-9-]+/g, " ").trim().split(/\s+/).slice(0, 16);
  } catch {
    return [];
  }
}

function clarificationError(run, decoded) {
  const parts = tokens(decoded);
  if (parts[0] !== "QSL") return "QSL_REQUIRED";
  if (parts[1] !== run.caseId) return "CASE_MISMATCH";
  if (parts[2] === "DE") {
    if (parts[3] !== run.playerCallsign) return "CALLSIGN_MISMATCH";
    return parts.length === 6 && parts[4] === "PSE" && parts[5] === "K" ? null : "FORMAT_INVALID";
  }
  if (parts[2] !== run.playerCallsign) return "CALLSIGN_MISMATCH";
  return parts.length === 4 && parts[3] === "K" ? null : "FORMAT_INVALID";
}

export function createQslStoryRun({ sourceQsl, playerCallsign, startedAt } = {}) {
  try {
    const source = createQslRecord(sourceQsl);
    const player = callsign(playerCallsign);
    const start = iso(startedAt);
    if (!source || !source.choice || !player || !start || source.personId !== "person:sora"
      || source.stationId !== "station:sim6jp" || source.callsign !== "SIM6JP") return null;
    return newRun(source, player, start);
  } catch {
    return null;
  }
}

export function reviewQslAccounts(value) {
  const run = normalizeQslStoryRun(value);
  return run?.phase === QSL_STORY_PHASES.CASE_OPEN
    ? transition(run, { phase: QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL })
    : value;
}

export function submitQslClarification(value, decoded, semanticResult, observedAt) {
  const run = normalizeQslStoryRun(value);
  const at = iso(observedAt);
  if (!run || !at || TERMINAL_PHASES.has(run.phase)) return value;

  const submitted = tokens(decoded);
  const recovery = submitted.length === 2 && submitted[1] === "K" && RECOVERY_ACTIONS.has(submitted[0])
    ? submitted[0] : null;
  if (run.phase === QSL_STORY_PHASES.PLAYER_FINAL_CHOICE && recovery) {
    if (!safeSemantic(semanticResult)) return failure(run, "SEMANTIC_UNSAFE", at);
    return transition(run, {
      phase: QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY,
      replyWpm: recovery === "QRS" ? Math.max(5, run.replyWpm - 3) : run.replyWpm,
      recoveryActions: [...run.recoveryActions, recovery].slice(-MAX_RECOVERY_ACTIONS),
    });
  }
  if (run.phase !== QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL) return value;
  if (!safeSemantic(semanticResult)) return failure(run, "SEMANTIC_UNSAFE", at);
  const reason = clarificationError(run, decoded);
  return reason
    ? failure(run, reason, at)
    : transition(run, {
      phase: QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY,
      clarificationAcceptedAt: at,
    });
}

export function receiveQslClarification(value, observedAt) {
  const run = normalizeQslStoryRun(value);
  const at = iso(observedAt);
  return run?.phase === QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY && at
    ? transition(run, { phase: QSL_STORY_PHASES.PLAYER_FINAL_CHOICE, replyReceivedAt: at })
    : value;
}

export function confirmQslStoryChoice(value, choice, observedAt) {
  const run = normalizeQslStoryRun(value);
  const at = iso(observedAt);
  return run?.phase === QSL_STORY_PHASES.PLAYER_FINAL_CHOICE && QSL_CHOICES.includes(choice) && at
    ? transition(run, { phase: QSL_STORY_PHASES.COMPLETED, finalChoice: choice, completedAt: at })
    : value;
}

export function abandonQslStoryRun(value, observedAt) {
  const run = normalizeQslStoryRun(value);
  const at = iso(observedAt);
  return run && at && !TERMINAL_PHASES.has(run.phase)
    ? transition(run, { phase: QSL_STORY_PHASES.ABANDONED, completedAt: at })
    : value;
}

export function retryQslStoryRun(value, startedAt) {
  const run = normalizeQslStoryRun(value);
  const start = iso(startedAt);
  if (!run || !start || ![QSL_STORY_PHASES.FAILED, QSL_STORY_PHASES.ABANDONED].includes(run.phase)) return value;
  return newRun({
    id: run.sourceQslId,
    qsoId: run.sourceQsoId,
    eventRunId: run.sourceEventRunId,
    choice: run.initialChoice,
  }, run.playerCallsign, start, run.retryCount + 1);
}

export function normalizeQslStoryRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const phase = own(value, "phase");
    const startedAt = iso(own(value, "startedAt"));
    const completedAtValue = own(value, "completedAt");
    const completedAt = completedAtValue == null ? null : iso(completedAtValue);
    const clarificationValue = own(value, "clarificationAcceptedAt");
    const replyValue = own(value, "replyReceivedAt");
    const run = {
      version: QSL_STORY_STATE_VERSION,
      runId: id(own(value, "runId")),
      sourceQslId: id(own(value, "sourceQslId")),
      sourceQsoId: id(own(value, "sourceQsoId"), 96),
      sourceEventRunId: id(own(value, "sourceEventRunId")),
      caseId: id(own(value, "caseId"), 32)?.toUpperCase() ?? null,
      playerCallsign: callsign(own(value, "playerCallsign")),
      personId: id(own(value, "personId"), 96),
      stationId: id(own(value, "stationId"), 96),
      callsign: callsign(own(value, "callsign")),
      initialChoice: QSL_CHOICES.includes(own(value, "initialChoice")) ? own(value, "initialChoice") : null,
      finalChoice: own(value, "finalChoice") == null ? null : own(value, "finalChoice"),
      phase,
      startedAt,
      completedAt,
      clarificationAcceptedAt: clarificationValue == null ? null : iso(clarificationValue),
      replyReceivedAt: replyValue == null ? null : iso(replyValue),
      replyNarrativeKey: own(value, "replyNarrativeKey"),
      replyWpm: safeInteger(own(value, "replyWpm"), INITIAL_REPLY_WPM),
      recoveryActions: strictArray(own(value, "recoveryActions"), MAX_RECOVERY_ACTIONS, RECOVERY_ACTIONS),
      errors: strictArray(own(value, "errors"), MAX_ERRORS, ERRORS),
      retryCount: safeInteger(own(value, "retryCount"), 100),
    };
    const terminal = TERMINAL_PHASES.has(phase);
    const startedMs = Date.parse(startedAt);
    const clarificationMs = run.clarificationAcceptedAt ? Date.parse(run.clarificationAcceptedAt) : null;
    const replyMs = run.replyReceivedAt ? Date.parse(run.replyReceivedAt) : null;
    const completedMs = completedAt ? Date.parse(completedAt) : null;
    const requiresClarification = [
      QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY,
      QSL_STORY_PHASES.PLAYER_FINAL_CHOICE,
      QSL_STORY_PHASES.COMPLETED,
    ].includes(phase);
    const requiresReply = [QSL_STORY_PHASES.PLAYER_FINAL_CHOICE, QSL_STORY_PHASES.COMPLETED].includes(phase);
    if (!run.runId || !run.sourceQslId || !run.sourceQsoId || !run.sourceEventRunId || !run.caseId
      || !run.playerCallsign || run.personId !== "person:sora" || run.stationId !== "station:sim6jp"
      || run.callsign !== "SIM6JP" || !run.initialChoice || !PHASES.has(phase) || !startedAt
      || run.runId !== runIdFor(run.sourceQslId, startedAt, run.retryCount)
      || run.caseId !== caseIdFor(run.sourceQslId)
      || (terminal !== Boolean(completedAt)) || (completedAt && Date.parse(completedAt) < Date.parse(startedAt))
      || (run.finalChoice != null && !QSL_CHOICES.includes(run.finalChoice))
      || ((phase === QSL_STORY_PHASES.COMPLETED) !== Boolean(run.finalChoice))
      || (phase === QSL_STORY_PHASES.FAILED && run.errors.length !== MAX_ERRORS)
      || (phase !== QSL_STORY_PHASES.FAILED && run.errors.length >= MAX_ERRORS)
      || (requiresClarification && !run.clarificationAcceptedAt)
      || (requiresReply && !run.replyReceivedAt)
      || (clarificationMs != null && clarificationMs < startedMs)
      || (replyMs != null && (clarificationMs == null || replyMs < clarificationMs))
      || (completedMs != null && completedMs < (replyMs ?? clarificationMs ?? startedMs))
      || run.replyNarrativeKey !== REPLY_NARRATIVE_KEY || run.replyWpm < 5 || run.replyWpm > INITIAL_REPLY_WPM
      || !run.recoveryActions || !run.errors) return null;
    return deepFreeze(run);
  } catch {
    return null;
  }
}

function normalizeCase(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      id: id(own(value, "id")),
      runId: id(own(value, "runId")),
      sourceQslId: id(own(value, "sourceQslId")),
      qsoId: id(own(value, "qsoId"), 96),
      personId: id(own(value, "personId"), 96),
      stationId: id(own(value, "stationId"), 96),
      initialChoice: own(value, "initialChoice"),
      finalChoice: own(value, "finalChoice"),
      completedAt: iso(own(value, "completedAt")),
    };
    return result.id && result.runId && result.sourceQslId && result.qsoId
      && result.personId === "person:sora" && result.stationId === "station:sim6jp"
      && QSL_CHOICES.includes(result.initialChoice) && QSL_CHOICES.includes(result.finalChoice)
      && result.completedAt ? deepFreeze(result) : null;
  } catch {
    return null;
  }
}

function normalizeObjectLedger(value, maximum, normalizer) {
  try {
    if (!Array.isArray(value)) return [];
    const result = [];
    const ids = new Set();
    let previous = null;
    for (let index = Math.max(0, value.length - maximum); index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) return [];
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return [];
      const item = normalizer(descriptor.value);
      if (!item || ids.has(item.id)) return [];
      if (previous) {
        const delta = Date.parse(item.completedAt) - Date.parse(previous.completedAt);
        if (delta < 0 || (delta === 0 && item.id <= previous.id)) return [];
      }
      ids.add(item.id);
      result.push(item);
      previous = item;
    }
    return deepFreeze(result);
  } catch {
    return [];
  }
}

function normalizeIdLedger(value) {
  try {
    if (!Array.isArray(value)) return [];
    const result = [];
    const seen = new Set();
    for (let index = Math.max(0, value.length - MAX_QSL_STORY_SETTLED_RUN_IDS); index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) return [];
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      const runId = descriptor && Object.hasOwn(descriptor, "value") ? id(descriptor.value) : null;
      if (!runId || seen.has(runId)) return [];
      seen.add(runId);
      result.push(runId);
    }
    return deepFreeze(result);
  } catch {
    return [];
  }
}

export function emptyQslStoryState() {
  return deepFreeze({
    activeRun: null, cases: [], settledRunIds: [], peopleTaskTreeUnlocked: false,
  });
}

export function qslStoryReplayAvailable(save) {
  try {
    const chapter = normalizeQslStoryState(own(own(save, "storyContinuationState"), "chapter07"));
    const missionState = own(save, "missionState");
    const claimed = own(missionState, "claimedMissionIds");
    return chapter.peopleTaskTreeUnlocked === true
      || (Array.isArray(claimed) && claimed.slice(-100).includes("story-07"));
  } catch {
    return false;
  }
}

export function normalizeQslStoryState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const activeValue = own(source, "activeRun");
    return deepFreeze({
      activeRun: activeValue == null ? null : normalizeQslStoryRun(activeValue),
      cases: normalizeObjectLedger(own(source, "cases") ?? [], MAX_QSL_STORY_CASES, normalizeCase),
      settledRunIds: normalizeIdLedger(own(source, "settledRunIds") ?? []),
      peopleTaskTreeUnlocked: own(source, "peopleTaskTreeUnlocked") === true,
    });
  } catch {
    return emptyQslStoryState();
  }
}
