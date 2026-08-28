import { parseStructuredFields, tokenizeStructuredMessage } from "./structuredMessage.js";

export const SERVICE_NET_STATE_VERSION = 1;
export const SERVICE_NET_DURATION_MILLISECONDS = 600_000;
export const MAX_SERVICE_NET_RECEIPTS = 80;
export const MAX_SERVICE_NET_SETTLED_RUN_IDS = 100;

export const SERVICE_NET_PHASES = Object.freeze({
  BRIEFING: "BRIEFING",
  CHECK_IN: "CHECK_IN",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  PLAYER_ACK: "PLAYER_ACK",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

export const SERVICE_NET_ITEMS = Object.freeze(["WATER", "POWER", "MEDKIT", "SHELTER"]);
const PHASES = new Set(Object.values(SERVICE_NET_PHASES));
const TERMINAL_PHASES = new Set([
  SERVICE_NET_PHASES.COMPLETED, SERVICE_NET_PHASES.FAILED, SERVICE_NET_PHASES.ABANDONED,
]);
const ERRORS = new Set([
  "CALLSIGN_MISMATCH", "CHECK_IN_INVALID", "MESSAGE_ID_MISMATCH", "PRIORITY_MISMATCH",
  "OUT_OF_ORDER", "FORMAT_INVALID", "SEMANTIC_UNSAFE",
]);
const FAILURE_REASONS = new Set(["TOO_MANY_ERRORS", "TIMED_OUT"]);
const RECOVERY_ACTIONS = new Set(["AGN", "QRS"]);
const INITIAL_REPLY_WPM = 16;
const MAX_ERRORS = 8;
const MAX_RECOVERIES = 12;

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
  for (const character of String(value)) {
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
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value")
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
      || lengthDescriptor.value > 0xFFFF_FFFF) return null;
    const result = [];
    for (let index = Math.max(0, lengthDescriptor.value - maximum); index < lengthDescriptor.value; index += 1) {
      if (!Object.hasOwn(value, index)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")
        || Object.hasOwn(descriptor, "get") || Object.hasOwn(descriptor, "set")) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function strictEnumArray(value, maximum, allowlist) {
  const candidates = retainedOwnValues(value, maximum);
  if (!candidates) return null;
  return candidates.every((candidate) => allowlist.has(candidate)) ? candidates : null;
}

function normalizeMessage(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const message = {
      messageId: typeof own(value, "messageId") === "string" && /^\d{3}$/.test(own(value, "messageId"))
        ? own(value, "messageId") : null,
      priority: integer(own(value, "priority"), 3, 1),
      people: integer(own(value, "people"), 99),
      item: SERVICE_NET_ITEMS.includes(own(value, "item")) ? own(value, "item") : null,
      quantity: integer(own(value, "quantity"), 99),
      sequence: integer(own(value, "sequence"), 2),
    };
    return Object.values(message).every((candidate) => candidate != null) ? deepFreeze(message) : null;
  } catch {
    return null;
  }
}

function normalizeRunReceipt(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      messageId: typeof own(value, "messageId") === "string" && /^\d{3}$/.test(own(value, "messageId"))
        ? own(value, "messageId") : null,
      priority: integer(own(value, "priority"), 3, 1),
      acknowledgedAt: iso(own(value, "acknowledgedAt")),
    };
    return result.messageId && result.priority && result.acknowledgedAt ? deepFreeze(result) : null;
  } catch {
    return null;
  }
}

function scheduleFor(seed) {
  const used = new Set();
  const messages = [];
  for (let sequence = 0; sequence < 3; sequence += 1) {
    const value = hash32(`${seed}|${sequence}`);
    let numericId = 1 + (value % 999);
    while (used.has(numericId)) numericId = numericId === 999 ? 1 : numericId + 1;
    used.add(numericId);
    messages.push(deepFreeze({
      messageId: String(numericId).padStart(3, "0"),
      priority: 1 + ((value >>> 8) % 3),
      people: (value >>> 12) % 100,
      item: SERVICE_NET_ITEMS[(value >>> 19) % SERVICE_NET_ITEMS.length],
      quantity: (value >>> 22) % 100,
      sequence,
    }));
  }
  return deepFreeze(messages);
}

function orderFor(messages) {
  return deepFreeze(messages.map((_, index) => index).sort((left, right) => (
    messages[left].priority - messages[right].priority
    || messages[left].sequence - messages[right].sequence
  )));
}

function runIdFor(scheduleId, startedAt, retryCount) {
  return `service-net:${hash32(`${scheduleId}|${startedAt}|${retryCount}`).toString(16).padStart(8, "0")}`;
}

function newRun({ playerCallsign, scheduleId, messages, priorityOrder, startedAt, retryCount = 0, checkedIn = false }) {
  return deepFreeze({
    version: SERVICE_NET_STATE_VERSION,
    runId: runIdFor(scheduleId, startedAt, retryCount),
    scheduleId,
    playerCallsign,
    personId: "person:procedural:chapter08-net-control",
    stationId: "station:procedural:chapter08-net-control",
    callsign: "SIM8PS",
    npcId: "chapter08-net-control",
    simulation: "fictional-public-service",
    phase: checkedIn ? SERVICE_NET_PHASES.RECEIVE_MESSAGE : SERVICE_NET_PHASES.BRIEFING,
    messages,
    priorityOrder,
    currentPosition: 0,
    receipts: [],
    checkedInAt: checkedIn ? startedAt : null,
    completedAt: null,
    elapsedMilliseconds: 0,
    currentMessageErrors: 0,
    errors: [],
    recoveryActions: [],
    replyWpm: INITIAL_REPLY_WPM,
    retryCount,
    failureReason: null,
    startedAt,
  });
}

function transition(run, changes) {
  return deepFreeze({ ...run, ...changes });
}

function safeSemantic(value) {
  return own(value, "safeToCommit") === true;
}

function failInput(run, reason, at) {
  const currentMessageErrors = run.currentMessageErrors + 1;
  const failed = currentMessageErrors >= 3;
  return transition(run, {
    errors: [...run.errors, reason].slice(-MAX_ERRORS),
    currentMessageErrors,
    phase: failed ? SERVICE_NET_PHASES.FAILED : run.phase,
    failureReason: failed ? "TOO_MANY_ERRORS" : null,
    completedAt: failed ? at : null,
  });
}

function checkInError(run, decoded) {
  const tokens = tokenizeStructuredMessage(decoded);
  let call = null;
  let validShape = false;
  if (tokens.length === 4 && tokens[1] === "CHECK" && tokens[2] === "IN" && tokens[3] === "K") {
    call = tokens[0];
    validShape = true;
  } else if (tokens.length === 3 && tokens[1] === "CHECKIN" && tokens[2] === "K") {
    call = tokens[0];
    validShape = true;
  }
  if (!validShape) return "CHECK_IN_INVALID";
  const parsed = parseStructuredFields(`CALL ${call}`, { CALL: { pattern: /^[A-Z0-9]{1,7}$/ } });
  if (!parsed.ok) return "CHECK_IN_INVALID";
  return parsed.fields.CALL === run.playerCallsign ? null : "CALLSIGN_MISMATCH";
}

function recoveryCommand(decoded) {
  const tokens = tokenizeStructuredMessage(decoded);
  return tokens.length === 2 && tokens[1] === "K" && RECOVERY_ACTIONS.has(tokens[0]) ? tokens[0] : null;
}

function acknowledgementError(run, decoded) {
  const parsed = parseStructuredFields(decoded, {
    ACK: { pattern: /^\d{3}$/ },
    PRI: { values: ["1", "2", "3"] },
  });
  if (!parsed.ok) return "FORMAT_INVALID";
  const current = run.messages[run.priorityOrder[run.currentPosition]];
  const candidate = run.messages.find((message) => message.messageId === parsed.fields.ACK);
  if (candidate && candidate.messageId !== current.messageId) return "OUT_OF_ORDER";
  if (parsed.fields.ACK !== current.messageId) return "MESSAGE_ID_MISMATCH";
  return Number(parsed.fields.PRI) === current.priority ? null : "PRIORITY_MISMATCH";
}

export function serviceNetMessageText(messageValue) {
  const message = normalizeMessage(messageValue);
  return message
    ? `MSG ${message.messageId} PRI ${message.priority} PEOPLE ${message.people} ITEM ${message.item} QTY ${message.quantity}`
    : "";
}

export function createServiceNetRun({ playerCallsign, seed, startedAt } = {}) {
  try {
    const player = callsign(playerCallsign);
    const start = iso(startedAt);
    const seedValue = text(seed, 96);
    if (!player || !start || !seedValue) return null;
    const scheduleId = `schedule:${hash32(seedValue).toString(16).padStart(8, "0")}`;
    const messages = scheduleFor(scheduleId);
    return newRun({ playerCallsign: player, scheduleId, messages, priorityOrder: orderFor(messages), startedAt: start });
  } catch {
    return null;
  }
}

export function beginServiceNetRun(value) {
  const run = normalizeServiceNetRun(value);
  return run?.phase === SERVICE_NET_PHASES.BRIEFING
    ? transition(run, { phase: SERVICE_NET_PHASES.CHECK_IN }) : value;
}

export function receiveServiceNetMessage(value) {
  const run = normalizeServiceNetRun(value);
  return run?.phase === SERVICE_NET_PHASES.RECEIVE_MESSAGE
    ? transition(run, { phase: SERVICE_NET_PHASES.PLAYER_ACK }) : value;
}

export function submitServiceNetText(value, decoded, semanticResult, observedAt) {
  const run = normalizeServiceNetRun(value);
  const at = iso(observedAt);
  if (!run || !at || Date.parse(at) < Date.parse(run.startedAt) || TERMINAL_PHASES.has(run.phase)) return value;
  if (![SERVICE_NET_PHASES.CHECK_IN, SERVICE_NET_PHASES.PLAYER_ACK].includes(run.phase)) return value;
  if (run.phase === SERVICE_NET_PHASES.CHECK_IN) {
    if (!safeSemantic(semanticResult)) return failInput(run, "SEMANTIC_UNSAFE", at);
    const reason = checkInError(run, decoded);
    return reason ? failInput(run, reason, at) : transition(run, {
      phase: SERVICE_NET_PHASES.RECEIVE_MESSAGE,
      checkedInAt: at,
      currentMessageErrors: 0,
    });
  }
  const recovery = recoveryCommand(decoded);
  if (recovery) return transition(run, {
    phase: SERVICE_NET_PHASES.RECEIVE_MESSAGE,
    recoveryActions: [...run.recoveryActions, recovery].slice(-MAX_RECOVERIES),
    replyWpm: recovery === "QRS" ? Math.max(5, run.replyWpm - 3) : run.replyWpm,
  });
  if (!safeSemantic(semanticResult)) return failInput(run, "SEMANTIC_UNSAFE", at);
  const reason = acknowledgementError(run, decoded);
  if (reason) return failInput(run, reason, at);
  const message = run.messages[run.priorityOrder[run.currentPosition]];
  const receipts = [...run.receipts, deepFreeze({
    messageId: message.messageId, priority: message.priority, acknowledgedAt: at,
  })];
  const currentPosition = run.currentPosition + 1;
  const complete = currentPosition === run.messages.length;
  return transition(run, {
    receipts,
    currentPosition,
    currentMessageErrors: 0,
    phase: complete ? SERVICE_NET_PHASES.COMPLETED : SERVICE_NET_PHASES.RECEIVE_MESSAGE,
    completedAt: complete ? at : null,
  });
}

export function tickServiceNetRun(value, { seconds = 0, paused = false } = {}, observedAt) {
  const run = normalizeServiceNetRun(value);
  if (!run || paused || TERMINAL_PHASES.has(run.phase)) return value;
  const duration = Number(seconds);
  const at = iso(observedAt);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600 || !at) return value;
  const elapsedMilliseconds = Math.min(
    SERVICE_NET_DURATION_MILLISECONDS,
    run.elapsedMilliseconds + Math.round(duration * 1000),
  );
  const timedOut = elapsedMilliseconds >= SERVICE_NET_DURATION_MILLISECONDS;
  return transition(run, {
    elapsedMilliseconds,
    phase: timedOut ? SERVICE_NET_PHASES.FAILED : run.phase,
    failureReason: timedOut ? "TIMED_OUT" : run.failureReason,
    completedAt: timedOut ? at : run.completedAt,
  });
}

export function abandonServiceNetRun(value, observedAt) {
  const run = normalizeServiceNetRun(value);
  const at = iso(observedAt);
  return run && at && Date.parse(at) >= Date.parse(run.startedAt) && !TERMINAL_PHASES.has(run.phase)
    ? transition(run, { phase: SERVICE_NET_PHASES.ABANDONED, completedAt: at }) : value;
}

export function retryServiceNetRun(value, startedAt) {
  const run = normalizeServiceNetRun(value);
  const start = iso(startedAt);
  if (!run || !start || ![SERVICE_NET_PHASES.FAILED, SERVICE_NET_PHASES.ABANDONED].includes(run.phase)) return value;
  return newRun({
    playerCallsign: run.playerCallsign,
    scheduleId: run.scheduleId,
    messages: run.messages,
    priorityOrder: run.priorityOrder,
    startedAt: start,
    retryCount: run.retryCount + 1,
    checkedIn: true,
  });
}

export function normalizeServiceNetRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const messagesRaw = retainedOwnValues(own(value, "messages"), 3);
    const messages = messagesRaw?.length === 3 ? messagesRaw.map(normalizeMessage) : null;
    if (!messages || messages.some((message) => !message)) return null;
    const ids = new Set(messages.map((message) => message.messageId));
    const sequences = new Set(messages.map((message) => message.sequence));
    if (ids.size !== 3 || sequences.size !== 3) return null;
    const orderRaw = retainedOwnValues(own(value, "priorityOrder"), 3);
    const priorityOrder = orderRaw?.length === 3
      && orderRaw.every((item) => integer(item, 2) != null) ? orderRaw : null;
    if (!priorityOrder || new Set(priorityOrder).size !== 3
      || priorityOrder.some((item, index) => item !== orderFor(messages)[index])) return null;
    const receiptsRaw = retainedOwnValues(own(value, "receipts"), 3);
    const receipts = receiptsRaw ? receiptsRaw.map(normalizeRunReceipt) : null;
    if (!receipts || receipts.some((receipt) => !receipt)) return null;
    for (let index = 0; index < receipts.length; index += 1) {
      const message = messages[priorityOrder[index]];
      if (receipts[index].messageId !== message.messageId || receipts[index].priority !== message.priority
        || (index > 0 && Date.parse(receipts[index].acknowledgedAt) < Date.parse(receipts[index - 1].acknowledgedAt))) return null;
    }
    const phase = own(value, "phase");
    const startedAt = iso(own(value, "startedAt"));
    const checkedInValue = own(value, "checkedInAt");
    const completedValue = own(value, "completedAt");
    const checkedInAt = checkedInValue == null ? null : iso(checkedInValue);
    const completedAt = completedValue == null ? null : iso(completedValue);
    const errors = strictEnumArray(own(value, "errors"), MAX_ERRORS, ERRORS);
    const recoveryActions = strictEnumArray(own(value, "recoveryActions"), MAX_RECOVERIES, RECOVERY_ACTIONS);
    const run = {
      version: SERVICE_NET_STATE_VERSION,
      runId: identifier(own(value, "runId")),
      scheduleId: identifier(own(value, "scheduleId")),
      playerCallsign: callsign(own(value, "playerCallsign")),
      personId: identifier(own(value, "personId"), 96),
      stationId: identifier(own(value, "stationId"), 96),
      callsign: callsign(own(value, "callsign")),
      npcId: identifier(own(value, "npcId"), 96),
      simulation: own(value, "simulation"),
      phase,
      messages: deepFreeze(messages),
      priorityOrder: deepFreeze(priorityOrder),
      currentPosition: integer(own(value, "currentPosition"), 3),
      receipts: deepFreeze(receipts),
      checkedInAt,
      completedAt,
      elapsedMilliseconds: integer(own(value, "elapsedMilliseconds"), SERVICE_NET_DURATION_MILLISECONDS),
      currentMessageErrors: integer(own(value, "currentMessageErrors"), 3),
      errors,
      recoveryActions,
      replyWpm: integer(own(value, "replyWpm"), INITIAL_REPLY_WPM, 5),
      retryCount: integer(own(value, "retryCount"), 100),
      failureReason: own(value, "failureReason") == null ? null : own(value, "failureReason"),
      startedAt,
    };
    const terminal = TERMINAL_PHASES.has(phase);
    const checkedInRequired = ![SERVICE_NET_PHASES.BRIEFING, SERVICE_NET_PHASES.CHECK_IN].includes(phase);
    if (!run.runId || !run.scheduleId || !run.playerCallsign || run.personId !== "person:procedural:chapter08-net-control"
      || run.stationId !== "station:procedural:chapter08-net-control" || run.callsign !== "SIM8PS"
      || run.npcId !== "chapter08-net-control" || run.simulation !== "fictional-public-service"
      || !PHASES.has(phase) || !startedAt || run.runId !== runIdFor(run.scheduleId, startedAt, run.retryCount)
      || run.currentPosition == null || run.currentPosition !== receipts.length || run.elapsedMilliseconds == null
      || run.currentMessageErrors == null || !errors || !recoveryActions || run.replyWpm == null
      || (checkedInRequired !== Boolean(checkedInAt)) || (checkedInAt && Date.parse(checkedInAt) < Date.parse(startedAt))
      || (terminal !== Boolean(completedAt)) || (completedAt && Date.parse(completedAt) < Date.parse(checkedInAt ?? startedAt))
      || (phase === SERVICE_NET_PHASES.COMPLETED && receipts.length !== 3)
      || (receipts.length === 3 && phase !== SERVICE_NET_PHASES.COMPLETED)
      || (phase === SERVICE_NET_PHASES.FAILED && !FAILURE_REASONS.has(run.failureReason))
      || (phase !== SERVICE_NET_PHASES.FAILED && run.failureReason !== null)
      || (run.failureReason === "TOO_MANY_ERRORS" && run.currentMessageErrors !== 3)
      || (run.failureReason === "TIMED_OUT" && run.elapsedMilliseconds !== SERVICE_NET_DURATION_MILLISECONDS)) return null;
    return deepFreeze(run);
  } catch {
    return null;
  }
}

function normalizeCompletionReceipt(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      id: identifier(own(value, "id")),
      runId: identifier(own(value, "runId")),
      qsoId: identifier(own(value, "qsoId"), 96),
      messageId: typeof own(value, "messageId") === "string" && /^\d{3}$/.test(own(value, "messageId"))
        ? own(value, "messageId") : null,
      priority: integer(own(value, "priority"), 3, 1),
      sequence: integer(own(value, "sequence"), 2),
      people: integer(own(value, "people"), 99),
      item: SERVICE_NET_ITEMS.includes(own(value, "item")) ? own(value, "item") : null,
      quantity: integer(own(value, "quantity"), 99),
      acknowledgedAt: iso(own(value, "acknowledgedAt")),
      completedAt: iso(own(value, "completedAt")),
    };
    return Object.values(result).every((candidate) => candidate != null)
      && Date.parse(result.acknowledgedAt) <= Date.parse(result.completedAt) ? deepFreeze(result) : null;
  } catch {
    return null;
  }
}

function normalizeOrderedLedger(value, maximum, normalizer) {
  const candidates = retainedOwnValues(value, maximum);
  if (!candidates) return deepFreeze([]);
  const result = [];
  const ids = new Set();
  let previous = null;
  for (const candidate of candidates) {
    const item = normalizer(candidate);
    if (!item || ids.has(item.id)) return deepFreeze([]);
    if (previous) {
      const delta = Date.parse(item.completedAt) - Date.parse(previous.completedAt);
      if (delta < 0 || (delta === 0 && item.id <= previous.id)) return deepFreeze([]);
    }
    ids.add(item.id);
    result.push(item);
    previous = item;
  }
  return deepFreeze(result);
}

function normalizeIdLedger(value) {
  const candidates = retainedOwnValues(value, MAX_SERVICE_NET_SETTLED_RUN_IDS);
  if (!candidates) return deepFreeze([]);
  const result = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const idValue = identifier(candidate);
    if (!idValue || seen.has(idValue)) return deepFreeze([]);
    seen.add(idValue);
    result.push(idValue);
  }
  return deepFreeze(result);
}

export function emptyServiceNetState() {
  return deepFreeze({ activeRun: null, receipts: [], settledRunIds: [], taskTreeUnlocked: false });
}

export function serviceNetReplayAvailable(save) {
  try {
    const chapter = normalizeServiceNetState(own(own(save, "storyContinuationState"), "chapter08"));
    const missionState = own(save, "missionState");
    const claimed = own(missionState, "claimedMissionIds");
    return chapter.taskTreeUnlocked === true
      || (Array.isArray(claimed) && claimed.slice(-100).includes("story-08"));
  } catch {
    return false;
  }
}

export function normalizeServiceNetState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const activeValue = own(source, "activeRun");
    return deepFreeze({
      activeRun: activeValue == null ? null : normalizeServiceNetRun(activeValue),
      receipts: normalizeOrderedLedger(own(source, "receipts") ?? [], MAX_SERVICE_NET_RECEIPTS, normalizeCompletionReceipt),
      settledRunIds: normalizeIdLedger(own(source, "settledRunIds") ?? []),
      taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
    });
  } catch {
    return emptyServiceNetState();
  }
}
