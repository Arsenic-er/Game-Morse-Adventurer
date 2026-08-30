export const NIGHT_OPERATIONS_STATE_VERSION = 1;
export const NIGHT_OPERATIONS_RUN_VERSION = 1;

export const NIGHT_OPERATIONS_PHASES = Object.freeze({
  BOARD: "BOARD", WINDOW_OPEN: "WINDOW_OPEN", CALL: "CALL", EXCHANGE: "EXCHANGE",
  WINDOW_CLOSED: "WINDOW_CLOSED", COMPLETED: "COMPLETED", FAILED: "FAILED", ABANDONED: "ABANDONED",
});
export const NIGHT_OPERATIONS_BANDS = Object.freeze(["40M", "20M", "15M"]);

const RUN_TIMEOUT_MS = 390_000;
const WINDOW_DURATION_MS = 60_000;
const TERMINAL_PHASES = new Set(["COMPLETED", "FAILED", "ABANDONED"]);
const PHASES = new Set(Object.values(NIGHT_OPERATIONS_PHASES));
const FAILURE_REASONS = new Set(["MISSED_TWO_CONTACTS", "TIMED_OUT"]);
const PROPAGATION_GRADES = new Set(["P1", "P2", "P3", "P4"]);
const STORY_OPERATORS = Object.freeze([
  Object.freeze({ callsign: "SIM6JP", npcId: "fixed-sora", personId: "person:sora", stationId: "station:sim6jp" }),
  Object.freeze({ callsign: "SIM8NC", npcId: "chapter08-net-control", personId: "person:procedural:chapter08-net-control", stationId: "station:procedural:chapter08-net-control" }),
  Object.freeze({ callsign: "SIM9CR", npcId: "chapter09-source", personId: "person:procedural:chapter09-source", stationId: "station:procedural:chapter09-source" }),
  Object.freeze({ callsign: "SIM9RL", npcId: "chapter09-relay", personId: "person:procedural:chapter09-relay", stationId: "station:procedural:chapter09-relay" }),
  Object.freeze({ callsign: "SIM12CS", npcId: "chapter12-control", personId: "person:procedural:chapter12-control", stationId: "station:procedural:chapter12-control" }),
  Object.freeze({ callsign: "SIM12RL", npcId: "chapter12-relay", personId: "person:procedural:chapter12-relay", stationId: "station:procedural:chapter12-relay" }),
]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function ownArrayLength(value) {
  if (!Array.isArray(value)) return null;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, "length"); return descriptor && Object.hasOwn(descriptor, "value") && Number.isSafeInteger(descriptor.value) && descriptor.value >= 0 ? descriptor.value : null; }
  catch { return null; }
}
function strictArray(value, maximum, normalizeItem) {
  const length = ownArrayLength(value); if (length === null || length > maximum) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value, index); if (item === null) return null; result.push(item);
  }
  return Object.freeze(result);
}
function strictArrayTail(value, maximum, normalizeItem) {
  const length = ownArrayLength(value); if (length === null) return null; const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = normalizeItem(descriptor.value, index); if (item === null) return null; result.push(item);
  }
  return Object.freeze(result);
}
function text(value, maximum = 96) { return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null; }
function callsign(value) {
  if (typeof value !== "string" || value.length > 24) return null;
  const result = value.trim().toUpperCase(); return /^[A-Z0-9]{3,12}$/u.test(result) ? result : null;
}
function iso(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}
function integer(value, minimum, maximum) { return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null; }
function hashNumber(value) {
  let hash = 2166136261; for (const character of String(value)) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function hash32(value) { return hashNumber(value).toString(16).padStart(8, "0"); }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value); }

function knownStoryPeople(save) {
  const relationships = own(save, "operatorRelationships"); const length = ownArrayLength(relationships);
  if (length === null) return new Set(); const known = new Set();
  for (let index = Math.max(0, length - 2_000); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(relationships, String(index)); } catch { return new Set(); }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return new Set(); const relationship = descriptor.value;
    const match = STORY_OPERATORS.find(({ personId, callsign: expected }) => own(relationship, "personId") === personId && callsign(own(relationship, "callsign")) === expected);
    if (match && Number.isSafeInteger(own(relationship, "completedQsos")) && own(relationship, "completedQsos") > 0) known.add(match.personId);
  }
  return known;
}
function createSchedule(knownPersonIds, seed) {
  const known = new Set(knownPersonIds);
  const ordered = [...STORY_OPERATORS].sort((left, right) => Number(!known.has(left.personId)) - Number(!known.has(right.personId))
    || hashNumber(`${seed}|${left.personId}`) - hashNumber(`${seed}|${right.personId}`) || left.personId.localeCompare(right.personId)).slice(0, 4);
  const bandOffset = hashNumber(`${seed}|bands`) % NIGHT_OPERATIONS_BANDS.length;
  return ordered.map((identity, index) => {
    const opensAtMilliseconds = 30_000 + index * 90_000;
    return { id: `night-window-${index + 1}`, order: index + 1, ...identity,
      band: NIGHT_OPERATIONS_BANDS[(index + bandOffset) % 3], propagationGrade: `P${1 + hashNumber(`${seed}|grade|${identity.personId}`) % 4}`,
      opensAtMilliseconds, closesAtMilliseconds: opensAtMilliseconds + WINDOW_DURATION_MS };
  });
}
function runId(seed, startedAt, retryCount) { return `night-operations:${hash32(`${seed}|${startedAt}|${retryCount}`)}`; }
function createAttempt({ save, seed, startedAt, retryCount = 0, windows = null, knownPersonIds = null }) {
  const playerCallsign = callsign(own(save, "callsign")); const normalizedSeed = text(seed); const normalizedStartedAt = iso(startedAt);
  const normalizedRetry = integer(retryCount, 0, 1_000); if (!playerCallsign || !normalizedSeed || !normalizedStartedAt || normalizedRetry === null) return null;
  const familiarPersonIds = knownPersonIds ?? Object.freeze([...knownStoryPeople(save)].sort());
  return deepFreeze({ version: NIGHT_OPERATIONS_RUN_VERSION, runId: runId(normalizedSeed, normalizedStartedAt, normalizedRetry), seed: normalizedSeed,
    playerCallsign, knownPersonIds: familiarPersonIds, windows: windows ?? createSchedule(familiarPersonIds, normalizedSeed), contacts: [], missedWindowIds: [], currentWindowId: null,
    recoveryActions: [], phase: NIGHT_OPERATIONS_PHASES.BOARD, activeMilliseconds: 0, startedAt: normalizedStartedAt,
    completedAt: null, failureReason: null, retryCount: normalizedRetry, summary: null });
}
export function createNightOperationsRun(input = {}) { return createAttempt({ save: own(input, "save"), seed: own(input, "seed"), startedAt: own(input, "startedAt") }); }
function terminal(run) { return TERMINAL_PHASES.has(run?.phase); }
function availableWindow(run) { return run.windows.find((window) => run.activeMilliseconds >= window.opensAtMilliseconds && run.activeMilliseconds < window.closesAtMilliseconds && !run.missedWindowIds.includes(window.id) && !run.contacts.some(({ windowId }) => windowId === window.id)); }

export function tickNightOperationsRun(run, delta = {}, at = null) {
  if (!run || terminal(run)) return run; const milliseconds = own(delta, "milliseconds");
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) return run;
  const activeMilliseconds = Math.min(RUN_TIMEOUT_MS, run.activeMilliseconds + milliseconds); const missedWindowIds = [...run.missedWindowIds];
  for (const window of run.windows) if (window.closesAtMilliseconds <= activeMilliseconds && !run.contacts.some(({ windowId }) => windowId === window.id) && !missedWindowIds.includes(window.id)) missedWindowIds.push(window.id);
  const completedAt = iso(at, true) ?? new Date(Date.parse(run.startedAt) + activeMilliseconds).toISOString();
  if (missedWindowIds.length >= 2) return deepFreeze({ ...run, activeMilliseconds, missedWindowIds, currentWindowId: null, phase: NIGHT_OPERATIONS_PHASES.FAILED, failureReason: "MISSED_TWO_CONTACTS", completedAt, summary: null });
  if (activeMilliseconds >= RUN_TIMEOUT_MS) return deepFreeze({ ...run, activeMilliseconds, missedWindowIds, currentWindowId: null, phase: NIGHT_OPERATIONS_PHASES.FAILED, failureReason: "TIMED_OUT", completedAt, summary: null });
  const currentStillOpen = run.currentWindowId && !missedWindowIds.includes(run.currentWindowId);
  const partial = { ...run, activeMilliseconds, missedWindowIds, currentWindowId: currentStillOpen ? run.currentWindowId : null };
  if (currentStillOpen) return deepFreeze(partial);
  const phase = availableWindow(partial) ? NIGHT_OPERATIONS_PHASES.WINDOW_OPEN : activeMilliseconds < run.windows[0].opensAtMilliseconds ? NIGHT_OPERATIONS_PHASES.BOARD : NIGHT_OPERATIONS_PHASES.WINDOW_CLOSED;
  return deepFreeze({ ...partial, phase });
}
export function chooseNightWindow(run, windowId) {
  if (!run || terminal(run) || run.currentWindowId || !["BOARD", "WINDOW_OPEN", "WINDOW_CLOSED"].includes(run.phase)) return run;
  const window = run.windows.find(({ id }) => id === windowId);
  if (!window || run.activeMilliseconds < window.opensAtMilliseconds || run.activeMilliseconds >= window.closesAtMilliseconds || run.missedWindowIds.includes(window.id) || run.contacts.some(({ windowId: used, personId }) => used === window.id || personId === window.personId)) return run;
  return deepFreeze({ ...run, currentWindowId: window.id, phase: NIGHT_OPERATIONS_PHASES.CALL });
}
function currentWindow(run) { return run.windows.find(({ id }) => id === run.currentWindowId) ?? null; }
function compact(value) { return typeof value === "string" && value.length <= 128 ? value.trim().toUpperCase().replace(/\s+/gu, " ") : null; }
export function submitNightOperationsCall(run, message, semantic) {
  if (!run || run.phase !== "CALL" || own(semantic, "safeToCommit") !== true) return run;
  const window = currentWindow(run); if (!window || compact(message) !== `${window.callsign} DE ${run.playerCallsign} K`) return run;
  return deepFreeze({ ...run, phase: NIGHT_OPERATIONS_PHASES.EXCHANGE });
}
function buildSummary(run, contacts, completedAt) { return { runId: run.runId, playerCallsign: run.playerCallsign,
  contactIds: contacts.map(({ id }) => id), windowIds: contacts.map(({ windowId }) => windowId), personIds: contacts.map(({ personId }) => personId),
  scheduleSeed: run.seed, activeMilliseconds: run.activeMilliseconds, missedWindowIds: run.missedWindowIds, completedAt, isFictional: true }; }
export function submitNightExchange(run, message, semantic, at) {
  if (!run || run.phase !== "EXCHANGE" || own(semantic, "safeToCommit") !== true) return run;
  const window = currentWindow(run); const completedAt = iso(at);
  if (!window || compact(message) !== `${window.callsign} DE ${run.playerCallsign} 599 ${window.band} K` || !completedAt || Date.parse(completedAt) < Date.parse(run.startedAt) + run.activeMilliseconds) return run;
  const contact = { id: `night-contact:${run.runId.slice("night-operations:".length)}:${window.order}`, runId: run.runId, windowId: window.id,
    callsign: window.callsign, npcId: window.npcId, personId: window.personId, stationId: window.stationId, band: window.band,
    propagationGrade: window.propagationGrade, recoveryActions: run.recoveryActions, completedAt, isFictional: true };
  const contacts = [...run.contacts, contact];
  if (contacts.length === 3) return deepFreeze({ ...run, contacts, currentWindowId: null, phase: NIGHT_OPERATIONS_PHASES.COMPLETED, completedAt, failureReason: null, summary: buildSummary(run, contacts, completedAt) });
  return deepFreeze({ ...run, contacts, currentWindowId: null, recoveryActions: [], phase: NIGHT_OPERATIONS_PHASES.WINDOW_CLOSED });
}
export function requestNightOperationsRepeat(run, message, semantic) {
  if (!run || !["CALL", "EXCHANGE"].includes(run.phase) || own(semantic, "safeToCommit") !== true) return run;
  const action = compact(message)?.split(" ")[0]; if (!["AGN", "QRS"].includes(action) || run.recoveryActions.length >= 8) return run;
  return deepFreeze({ ...run, recoveryActions: [...run.recoveryActions, action] });
}
export function abandonNightOperationsRun(run, at) {
  if (!run || terminal(run)) return run; const completedAt = iso(at); if (!completedAt || Date.parse(completedAt) < Date.parse(run.startedAt)) return run;
  return deepFreeze({ ...run, phase: NIGHT_OPERATIONS_PHASES.ABANDONED, completedAt, currentWindowId: null, summary: null });
}
export function retryNightOperationsRun(run, startedAt) {
  if (!run || !["FAILED", "ABANDONED"].includes(run.phase)) return run; const normalizedStartedAt = iso(startedAt);
  if (!normalizedStartedAt || Date.parse(normalizedStartedAt) < Date.parse(run.startedAt)) return run;
  return createAttempt({ save: { callsign: run.playerCallsign }, seed: run.seed, startedAt: normalizedStartedAt, retryCount: run.retryCount + 1, windows: run.windows, knownPersonIds: run.knownPersonIds });
}

function normalizeWindow(value, index) {
  const identity = STORY_OPERATORS.find(({ callsign: candidate }) => own(value, "callsign") === candidate);
  const opensAtMilliseconds = integer(own(value, "opensAtMilliseconds"), 0, RUN_TIMEOUT_MS); const closesAtMilliseconds = integer(own(value, "closesAtMilliseconds"), 1, RUN_TIMEOUT_MS);
  if (!identity || own(value, "id") !== `night-window-${index + 1}` || own(value, "order") !== index + 1 || own(value, "npcId") !== identity.npcId || own(value, "personId") !== identity.personId || own(value, "stationId") !== identity.stationId || !NIGHT_OPERATIONS_BANDS.includes(own(value, "band")) || !PROPAGATION_GRADES.has(own(value, "propagationGrade")) || opensAtMilliseconds === null || closesAtMilliseconds === null || closesAtMilliseconds - opensAtMilliseconds !== WINDOW_DURATION_MS) return null;
  return { id: own(value, "id"), order: index + 1, ...identity, band: own(value, "band"), propagationGrade: own(value, "propagationGrade"), opensAtMilliseconds, closesAtMilliseconds };
}
function normalizeStringList(value, maximum, allowed = null) {
  const items = strictArray(value, maximum, (entry) => text(entry, 128));
  return !items || new Set(items).size !== items.length || allowed && items.some((entry) => !allowed.has(entry)) ? null : items;
}
function normalizeContact(value, windows, runIdValue, startedAt) {
  const window = windows.find(({ id }) => id === own(value, "windowId")); const completedAt = iso(own(value, "completedAt"));
  const recoveryActions = strictArray(own(value, "recoveryActions"), 8, (entry) => ["AGN", "QRS"].includes(entry) ? entry : null);
  const completedAtMilliseconds = completedAt ? Date.parse(completedAt) - Date.parse(startedAt) : -1;
  if (!window || own(value, "id") !== `night-contact:${runIdValue.slice("night-operations:".length)}:${window.order}` || own(value, "runId") !== runIdValue || own(value, "callsign") !== window.callsign || own(value, "npcId") !== window.npcId || own(value, "personId") !== window.personId || own(value, "stationId") !== window.stationId || own(value, "band") !== window.band || own(value, "propagationGrade") !== window.propagationGrade || !recoveryActions || !completedAt || completedAtMilliseconds < window.opensAtMilliseconds || completedAtMilliseconds >= window.closesAtMilliseconds || own(value, "isFictional") !== true) return null;
  return { id: own(value, "id"), runId: runIdValue, windowId: window.id, callsign: window.callsign, npcId: window.npcId, personId: window.personId, stationId: window.stationId, band: window.band, propagationGrade: window.propagationGrade, recoveryActions, completedAt, isFictional: true };
}
export function normalizeNightOperationsSummary(value, run = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = text(own(value, "runId"), 64); const playerCallsign = callsign(own(value, "playerCallsign"));
  const contactIds = normalizeStringList(own(value, "contactIds"), 3); const windowIds = normalizeStringList(own(value, "windowIds"), 3);
  const personIds = normalizeStringList(own(value, "personIds"), 3); const scheduleSeed = text(own(value, "scheduleSeed"));
  const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, RUN_TIMEOUT_MS); const missedWindowIds = normalizeStringList(own(value, "missedWindowIds"), 1); const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || !playerCallsign || contactIds?.length !== 3 || windowIds?.length !== 3 || personIds?.length !== 3 || !scheduleSeed || activeMilliseconds === null || !missedWindowIds || !completedAt || own(value, "isFictional") !== true) return null;
  const summary = { runId: runIdValue, playerCallsign, contactIds, windowIds, personIds, scheduleSeed, activeMilliseconds, missedWindowIds, completedAt, isFictional: true };
  if (run && (runIdValue !== run.runId || playerCallsign !== run.playerCallsign || scheduleSeed !== run.seed || activeMilliseconds !== run.activeMilliseconds || completedAt !== run.completedAt || JSON.stringify(contactIds) !== JSON.stringify(run.contacts.map(({ id }) => id)) || JSON.stringify(windowIds) !== JSON.stringify(run.contacts.map(({ windowId }) => windowId)) || JSON.stringify(personIds) !== JSON.stringify(run.contacts.map(({ personId }) => personId)))) return null;
  return deepFreeze(summary);
}
export function normalizeNightOperationsRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) || own(value, "version") !== NIGHT_OPERATIONS_RUN_VERSION) return null;
    const seed = text(own(value, "seed")); const startedAt = iso(own(value, "startedAt")); const retryCount = integer(own(value, "retryCount"), 0, 1_000);
    const playerCallsign = callsign(own(value, "playerCallsign")); const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, RUN_TIMEOUT_MS);
    const phase = PHASES.has(own(value, "phase")) ? own(value, "phase") : null;
    if (!seed || !startedAt || retryCount === null || !playerCallsign || activeMilliseconds === null || !phase) return null;
    const expectedRunId = runId(seed, startedAt, retryCount); if (own(value, "runId") !== expectedRunId) return null;
    const allowedPersonIds = new Set(STORY_OPERATORS.map(({ personId }) => personId));
    const knownPersonIds = normalizeStringList(own(value, "knownPersonIds"), STORY_OPERATORS.length, allowedPersonIds);
    const windows = strictArray(own(value, "windows"), 4, normalizeWindow); if (!knownPersonIds || windows?.length !== 4 || new Set(windows.map(({ personId }) => personId)).size !== 4) return null;
    for (let index = 1; index < windows.length; index += 1) if (windows[index - 1].closesAtMilliseconds > windows[index].opensAtMilliseconds) return null;
    if (JSON.stringify(windows) !== JSON.stringify(createSchedule(knownPersonIds, seed))) return null;
    const allowedWindowIds = new Set(windows.map(({ id }) => id));
    const contacts = strictArray(own(value, "contacts"), 3, (entry) => normalizeContact(entry, windows, expectedRunId, startedAt));
    const missedWindowIds = normalizeStringList(own(value, "missedWindowIds"), 4, allowedWindowIds);
    const recoveryActions = strictArray(own(value, "recoveryActions"), 8, (entry) => ["AGN", "QRS"].includes(entry) ? entry : null);
    if (!contacts || !missedWindowIds || !recoveryActions || new Set(contacts.map(({ personId }) => personId)).size !== contacts.length || contacts.some(({ windowId }) => missedWindowIds.includes(windowId))) return null;
    const currentWindowId = own(value, "currentWindowId");
    if (currentWindowId !== null && (!allowedWindowIds.has(currentWindowId) || !["CALL", "EXCHANGE"].includes(phase))) return null;
    const completedAt = iso(own(value, "completedAt"), true); const failureReason = own(value, "failureReason");
    if (failureReason !== null && !FAILURE_REASONS.has(failureReason)) return null;
    const partial = { version: NIGHT_OPERATIONS_RUN_VERSION, runId: expectedRunId, seed, playerCallsign, knownPersonIds, windows, contacts, missedWindowIds, currentWindowId, recoveryActions, phase, activeMilliseconds, startedAt, completedAt, failureReason, retryCount, summary: null };
    if (phase === "COMPLETED") { if (contacts.length !== 3 || !completedAt || failureReason !== null) return null; const summary = normalizeNightOperationsSummary(own(value, "summary"), partial); return summary ? deepFreeze({ ...partial, summary }) : null; }
    if (own(value, "summary") !== null) return null;
    if (phase === "FAILED" && (!completedAt || !failureReason || missedWindowIds.length < 2 && failureReason !== "TIMED_OUT")) return null;
    if (phase === "ABANDONED" && !completedAt) return null;
    if (!TERMINAL_PHASES.has(phase) && (completedAt !== null || failureReason !== null)) return null;
    return deepFreeze(partial);
  } catch { return null; }
}
export function normalizeNightOperationsRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = text(own(value, "runId"), 64); const playerCallsign = callsign(own(value, "playerCallsign"));
  const scheduleSeed = text(own(value, "scheduleSeed")); const knownPersonIds = normalizeStringList(own(value, "knownPersonIds"), STORY_OPERATORS.length, new Set(STORY_OPERATORS.map(({ personId }) => personId)));
  const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || own(value, "id") !== `night-record:${runIdValue}` || !playerCallsign || !scheduleSeed || !knownPersonIds || !completedAt || own(value, "isFictional") !== true) return null;
  const windows = strictArray(own(value, "windows"), 4, normalizeWindow);
  if (windows?.length !== 4 || JSON.stringify(windows) !== JSON.stringify(createSchedule(knownPersonIds, scheduleSeed))) return null;
  const contacts = strictArray(own(value, "contacts"), 3, (entry) => {
    const window = windows.find(({ id }) => id === own(entry, "windowId")); const contactCompletedAt = iso(own(entry, "completedAt"));
    const qsoId = text(own(entry, "qsoId"), 96); const contactId = text(own(entry, "contactId"), 96);
    if (!window || !qsoId || !contactId || own(entry, "personId") !== window.personId || own(entry, "stationId") !== window.stationId
      || own(entry, "npcId") !== window.npcId || own(entry, "callsign") !== window.callsign || own(entry, "band") !== window.band
      || own(entry, "propagationGrade") !== window.propagationGrade || !contactCompletedAt) return null;
    return { qsoId, contactId, windowId: window.id, personId: window.personId, stationId: window.stationId, npcId: window.npcId,
      callsign: window.callsign, band: window.band, propagationGrade: window.propagationGrade, completedAt: contactCompletedAt };
  });
  if (contacts?.length !== 3 || new Set(contacts.map(({ personId }) => personId)).size !== 3 || new Set(contacts.map(({ qsoId }) => qsoId)).size !== 3) return null;
  return deepFreeze({ id: own(value, "id"), runId: runIdValue, playerCallsign, scheduleSeed, knownPersonIds, windows, contacts, completedAt, isFictional: true });
}
function normalizeProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = text(own(value, "runId"), 64); const contactIds = normalizeStringList(own(value, "contactIds"), 3);
  const qsoIds = normalizeStringList(own(value, "qsoIds"), 3); const windowIds = normalizeStringList(own(value, "windowIds"), 3);
  const personIds = normalizeStringList(own(value, "personIds"), 3); const completedAt = iso(own(value, "completedAt"));
  return runIdValue && own(value, "recordId") === `night-record:${runIdValue}` && contactIds?.length === 3 && qsoIds?.length === 3
    && windowIds?.length === 3 && personIds?.length === 3 && completedAt
    ? deepFreeze({ runId: runIdValue, recordId: own(value, "recordId"), contactIds, qsoIds, windowIds, personIds, completedAt }) : null;
}
function orderedUnique(entries) { const ids = new Set(); let previous = null; for (const entry of entries) { const id = typeof entry === "string" ? entry : entry.runId; if (ids.has(id)) return false; if (typeof entry !== "string" && previous && (entry.completedAt < previous.completedAt || entry.completedAt === previous.completedAt && id <= previous.runId)) return false; ids.add(id); previous = entry; } return true; }
const frozenEmptyArray = () => Object.freeze([]);
export function emptyNightOperationsState() { return Object.freeze({ version: NIGHT_OPERATIONS_STATE_VERSION, activeRun: null, completedRuns: frozenEmptyArray(), settledRunIds: frozenEmptyArray(), settlementProofs: frozenEmptyArray(), archive: frozenEmptyArray(), taskTreeUnlocked: false }); }
export function normalizeNightOperationsState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}; const activeValue = own(source, "activeRun");
    const activeRun = activeValue === null || activeValue === undefined ? null : normalizeNightOperationsRun(activeValue);
    const completedRuns = strictArrayTail(own(source, "completedRuns") ?? [], 80, normalizeNightOperationsSummary);
    const settledRunIds = strictArrayTail(own(source, "settledRunIds") ?? [], 80, (entry) => text(entry, 64));
    const settlementProofs = strictArrayTail(own(source, "settlementProofs") ?? [], 80, normalizeProof);
    const archive = strictArrayTail(own(source, "archive") ?? [], 80, normalizeNightOperationsRecord);
    if (activeValue !== null && activeValue !== undefined && !activeRun || !completedRuns || !settledRunIds || !settlementProofs || !archive || !orderedUnique(completedRuns) || !orderedUnique(settlementProofs) || !orderedUnique(archive) || !orderedUnique(settledRunIds)) return emptyNightOperationsState();
    return deepFreeze({ version: NIGHT_OPERATIONS_STATE_VERSION, activeRun, completedRuns, settledRunIds, settlementProofs, archive, taskTreeUnlocked: own(source, "taskTreeUnlocked") === true });
  } catch { return emptyNightOperationsState(); }
}
export function nightOperationsReplayAvailable(save) { return normalizeNightOperationsState(own(own(save, "storyContinuationState"), "chapter13")).taskTreeUnlocked; }
