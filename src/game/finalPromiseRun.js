import { normalizeListeningState } from "./listeningRun.js";
import { normalizeNightOperationsState } from "./nightOperationsRun.js";
import { normalizeQslRecords } from "./qslRecords.js";
import { normalizeQslStoryState } from "./qslStoryRun.js";
import { normalizeStormRelayState } from "./stormRelayRun.js";

export const FINAL_PROMISE_STATE_VERSION = 1;
export const FINAL_PROMISE_RUN_VERSION = 1;

export const FINAL_PROMISE_PHASES = Object.freeze({
  REVIEW: "REVIEW", CALL: "CALL", ACCOUNT: "ACCOUNT", FINAL_CHOICE: "FINAL_CHOICE",
  FINAL_MESSAGE: "FINAL_MESSAGE", COMPLETED: "COMPLETED", FAILED: "FAILED", ABANDONED: "ABANDONED",
});
export const FINAL_PROMISE_TONES = Object.freeze(["brief", "steady", "warm"]);

const TARGET_CALLSIGN = "SIM14FP";
const TARGET_PERSON_ID = "person:chapter14:final-recipient";
const TARGET_STATION_ID = "station:chapter14:sim14fp";
const ACTIVE_TIMEOUT_MS = 600_000;
const INITIAL_ACCOUNT_WPM = 15;
const MAX_RECOVERY_ACTIONS = 8;
const PHASES = new Set(Object.values(FINAL_PROMISE_PHASES));
const TERMINAL_PHASES = new Set([FINAL_PROMISE_PHASES.COMPLETED, FINAL_PROMISE_PHASES.FAILED, FINAL_PROMISE_PHASES.ABANDONED]);
const ACCOUNT_KEYS = Object.freeze([
  "chapter14.account.unfinished-log", "chapter14.account.witnessed-work", "chapter14.account.forward-promise",
]);
const RECALL_KEYS = Object.freeze({
  qslNeutral: "chapter14.recall.qsl.neutral",
  listeningPatient: "chapter14.recall.listening.patient-stop",
  listeningNeutral: "chapter14.recall.listening.neutral",
  stormCorrected: "chapter14.recall.storm.corrected-packet",
  stormNeutral: "chapter14.recall.storm.neutral",
  scheduleKnown: "chapter14.recall.schedule.known-people",
  scheduleNeutral: "chapter14.recall.schedule.neutral",
});
const MESSAGE_KEYS = Object.freeze({
  brief: "chapter14.message.brief", steady: "chapter14.message.steady", warm: "chapter14.message.warm",
});
const MESSAGE_BUILDERS = Object.freeze({
  brief: (run) => `${run.targetCallsign} DE ${run.playerCallsign} TNX 73`,
  steady: (run) => `${run.targetCallsign} DE ${run.playerCallsign} I WILL CONTINUE 73`,
  warm: (run) => `${run.targetCallsign} DE ${run.playerCallsign} YOUR LOG CONTINUES 73`,
});

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function arrayLength(value) {
  if (!Array.isArray(value)) return null;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, "length"); return descriptor && Object.hasOwn(descriptor, "value") && Number.isSafeInteger(descriptor.value) && descriptor.value >= 0 ? descriptor.value : null; }
  catch { return null; }
}
function strictArray(value, maximum, normalizer) {
  const length = arrayLength(value); if (length === null || length > maximum) return null; const result = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const normalized = normalizer(descriptor.value, index); if (normalized === null) return null; result.push(normalized);
  }
  return Object.freeze(result);
}
function strictArrayTail(value, maximum, normalizer) {
  const length = arrayLength(value); if (length === null) return null; const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const normalized = normalizer(descriptor.value, index); if (normalized === null) return null; result.push(normalized);
  }
  return Object.freeze(result);
}
function boundedText(value, maximum = 128) { return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001F\u007F]/u.test(value) ? value : null; }
function callsign(value) { if (typeof value !== "string" || value.length > 24) return null; const result = value.trim().toUpperCase(); return /^[A-Z0-9]{3,12}$/u.test(result) ? result : null; }
function iso(value, nullable = false) { if (nullable && value === null) return null; if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function integer(value, minimum, maximum) { return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null; }
function hash32(value) { let hash = 2166136261; for (const character of String(value)) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function hasClaimedChapter13(save) {
  const claimed = own(own(save, "missionState"), "claimedMissionIds"); const length = arrayLength(claimed);
  if (length === null || length > 100) return false; let found = false;
  for (let index = 0; index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(claimed, String(index)); } catch { return false; }
    if (!descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string") return false;
    if (descriptor.value === "story-13") found = true;
  }
  return found;
}
function latest(entries) { return entries.length ? entries[entries.length - 1] : null; }
function recallFromSave(save) {
  const continuation = own(save, "storyContinuationState");
  const chapter07 = normalizeQslStoryState(own(continuation, "chapter07")); const qslCase = latest(chapter07.cases);
  const sourceQsl = qslCase && normalizeQslRecords(own(save, "qslRecords")).find((record) => record.id === qslCase.sourceQslId && record.personId === "person:sora" && record.stationId === "station:sim6jp" && record.callsign === "SIM6JP");
  const qslChoice = sourceQsl ? qslCase.finalChoice : null;
  const chapter11 = normalizeListeningState(own(continuation, "chapter11")); const listeningRecord = latest(chapter11.archive);
  const patientStop = Boolean(listeningRecord && chapter11.settledRunIds.includes(listeningRecord.runId) && listeningRecord.conclusionKey === "chapter11.conclusion.no-reply-after-listening");
  const chapter12 = normalizeStormRelayState(own(continuation, "chapter12")); const stormRecord = latest(chapter12.archive);
  const correctedPacket = Boolean(stormRecord && chapter12.settledRunIds.includes(stormRecord.runId) && stormRecord.canonicalPacketId === "storm-214-r2" && stormRecord.revision === 2 && stormRecord.isFictional === true);
  const chapter13 = normalizeNightOperationsState(own(continuation, "chapter13")); const nightRecord = latest(chapter13.archive);
  const scheduledPersonIds = nightRecord && chapter13.settledRunIds.includes(nightRecord.runId) ? [...nightRecord.knownPersonIds] : [];
  return deepFreeze({ sourceQslId: sourceQsl?.id ?? null, sourceQslChoice: qslChoice, scheduledPersonIds, recallKeys: [
    qslChoice ? `chapter14.recall.qsl.${qslChoice}` : RECALL_KEYS.qslNeutral,
    patientStop ? RECALL_KEYS.listeningPatient : RECALL_KEYS.listeningNeutral,
    correctedPacket ? RECALL_KEYS.stormCorrected : RECALL_KEYS.stormNeutral,
    scheduledPersonIds.length ? RECALL_KEYS.scheduleKnown : RECALL_KEYS.scheduleNeutral,
  ] });
}
function runId(seed, startedAt, retryCount) { return `final-promise:${hash32(`${seed}|${startedAt}|${retryCount}`).toString(16).padStart(8, "0")}`; }
function createAttempt({ playerCallsign, seed, startedAt, retryCount = 0, recall = null }) {
  const normalizedCallsign = callsign(playerCallsign); const normalizedSeed = boundedText(seed, 96); const normalizedStartedAt = iso(startedAt); const normalizedRetry = integer(retryCount, 0, 1_000);
  if (!normalizedCallsign || !normalizedSeed || !normalizedStartedAt || normalizedRetry === null || !recall) return null;
  const accountKey = ACCOUNT_KEYS[hash32(`${normalizedSeed}|${recall.recallKeys.join("|")}`) % ACCOUNT_KEYS.length];
  return deepFreeze({ version: FINAL_PROMISE_RUN_VERSION, runId: runId(normalizedSeed, normalizedStartedAt, normalizedRetry), seed: normalizedSeed,
    playerCallsign: normalizedCallsign, targetCallsign: TARGET_CALLSIGN, personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID,
    sourceQslId: recall.sourceQslId, sourceQslChoice: recall.sourceQslChoice, recallKeys: [...recall.recallKeys], scheduledPersonIds: [...recall.scheduledPersonIds],
    accountKey, accountWpm: INITIAL_ACCOUNT_WPM, recoveryActions: [], tone: null, messageKey: null,
    phase: FINAL_PROMISE_PHASES.REVIEW, activeMilliseconds: 0, startedAt: normalizedStartedAt, callAcceptedAt: null,
    accountReceivedAt: null, completedAt: null, failureReason: null, retryCount: normalizedRetry, summary: null });
}

export function createFinalPromiseRun(input = {}) {
  try {
    const save = own(input, "save"); const playerCallsign = own(input, "playerCallsign");
    if (!save || !hasClaimedChapter13(save) || callsign(own(save, "callsign")) !== callsign(playerCallsign)) return null;
    return createAttempt({ playerCallsign, seed: own(input, "seed"), startedAt: own(input, "startedAt"), recall: recallFromSave(save) });
  } catch { return null; }
}
function terminal(run) { return TERMINAL_PHASES.has(run?.phase); }
export function finalPromiseCallText(run) { return normalizeFinalPromiseRun(run) ? `${TARGET_CALLSIGN} DE ${run.playerCallsign} K` : ""; }
export function finalPromiseMessageText(run) { const normalized = normalizeFinalPromiseRun(run); return normalized?.tone && MESSAGE_BUILDERS[normalized.tone] ? MESSAGE_BUILDERS[normalized.tone](normalized) : ""; }
export function reviewFinalPromise(run) { const normalized = normalizeFinalPromiseRun(run); return normalized?.phase === FINAL_PROMISE_PHASES.REVIEW ? deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.CALL }) : run; }
function compact(value) { return typeof value === "string" && value.length <= 128 ? value.trim().toUpperCase().replace(/\s+/gu, " ") : null; }
export function submitFinalPromiseCall(run, message, semantic, at) {
  const normalized = normalizeFinalPromiseRun(run); const submittedAt = iso(at);
  if (!normalized || normalized.phase !== FINAL_PROMISE_PHASES.CALL || own(semantic, "safeToCommit") !== true || compact(message) !== finalPromiseCallText(normalized) || !submittedAt || Date.parse(submittedAt) < Date.parse(normalized.startedAt)) return run;
  return deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.ACCOUNT, callAcceptedAt: submittedAt });
}
export function receiveFinalPromiseAccount(run, at) {
  const normalized = normalizeFinalPromiseRun(run); const receivedAt = iso(at);
  if (!normalized || normalized.phase !== FINAL_PROMISE_PHASES.ACCOUNT || !receivedAt || Date.parse(receivedAt) < Date.parse(normalized.callAcceptedAt ?? normalized.startedAt)) return run;
  return deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.FINAL_CHOICE, accountReceivedAt: receivedAt });
}
export function requestFinalPromiseRepeat(run, message, semantic) {
  const normalized = normalizeFinalPromiseRun(run); const action = compact(message)?.split(" ")[0];
  if (!normalized || ![FINAL_PROMISE_PHASES.ACCOUNT, FINAL_PROMISE_PHASES.FINAL_CHOICE].includes(normalized.phase) || !["AGN", "QRS"].includes(action) || compact(message) !== `${action} K` || normalized.recoveryActions.length >= MAX_RECOVERY_ACTIONS) return run;
  return deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.ACCOUNT, accountWpm: action === "QRS" ? Math.max(5, normalized.accountWpm - 3) : normalized.accountWpm, recoveryActions: [...normalized.recoveryActions, action] });
}
export function chooseFinalPromiseTone(run, tone) {
  const normalized = normalizeFinalPromiseRun(run);
  if (!normalized || normalized.phase !== FINAL_PROMISE_PHASES.FINAL_CHOICE || !FINAL_PROMISE_TONES.includes(tone)) return run;
  return deepFreeze({ ...normalized, tone, messageKey: MESSAGE_KEYS[tone], phase: FINAL_PROMISE_PHASES.FINAL_MESSAGE });
}
export function submitFinalPromiseMessage(run, message, semantic, at) {
  const normalized = normalizeFinalPromiseRun(run); const completedAt = iso(at);
  if (!normalized || normalized.phase !== FINAL_PROMISE_PHASES.FINAL_MESSAGE || own(semantic, "safeToCommit") !== true || compact(message) !== finalPromiseMessageText(normalized) || !completedAt || Date.parse(completedAt) < Date.parse(normalized.accountReceivedAt ?? normalized.startedAt)) return run;
  const summary = { runId: normalized.runId, playerCallsign: normalized.playerCallsign, targetCallsign: TARGET_CALLSIGN,
    personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID, sourceQslId: normalized.sourceQslId, sourceQslChoice: normalized.sourceQslChoice,
    recallKeys: normalized.recallKeys, scheduledPersonIds: normalized.scheduledPersonIds, accountKey: normalized.accountKey,
    tone: normalized.tone, messageKey: normalized.messageKey, recoveryActions: normalized.recoveryActions,
    activeMilliseconds: normalized.activeMilliseconds, completedAt, isFictional: true };
  return deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.COMPLETED, completedAt, failureReason: null, summary });
}
export function tickFinalPromiseRun(run, delta = {}, at = null) {
  const normalized = normalizeFinalPromiseRun(run);
  if (!normalized || terminal(normalized) || own(delta, "paused") === true) return run;
  const sampleMilliseconds = own(delta, "milliseconds");
  if (!Number.isFinite(sampleMilliseconds) || sampleMilliseconds <= 0) return run;
  const milliseconds = Math.round(Math.min(ACTIVE_TIMEOUT_MS, sampleMilliseconds));
  if (milliseconds <= 0) return run;
  const activeMilliseconds = Math.min(ACTIVE_TIMEOUT_MS, normalized.activeMilliseconds + milliseconds);
  if (activeMilliseconds < ACTIVE_TIMEOUT_MS) return deepFreeze({ ...normalized, activeMilliseconds });
  const completedAt = iso(at) ?? new Date(Date.parse(normalized.startedAt) + activeMilliseconds).toISOString();
  return deepFreeze({ ...normalized, activeMilliseconds, phase: FINAL_PROMISE_PHASES.FAILED, failureReason: "TIMED_OUT", completedAt, summary: null });
}
export function abandonFinalPromiseRun(run, at) {
  const normalized = normalizeFinalPromiseRun(run); const completedAt = iso(at);
  if (!normalized || terminal(normalized) || !completedAt || Date.parse(completedAt) < Date.parse(normalized.startedAt)) return run;
  return deepFreeze({ ...normalized, phase: FINAL_PROMISE_PHASES.ABANDONED, completedAt, summary: null });
}
export function retryFinalPromiseRun(run, startedAt) {
  const normalized = normalizeFinalPromiseRun(run); const nextStart = iso(startedAt);
  if (!normalized || ![FINAL_PROMISE_PHASES.FAILED, FINAL_PROMISE_PHASES.ABANDONED].includes(normalized.phase) || !nextStart || Date.parse(nextStart) < Date.parse(normalized.startedAt)) return run;
  return createAttempt({ playerCallsign: normalized.playerCallsign, seed: normalized.seed, startedAt: nextStart, retryCount: normalized.retryCount + 1,
    recall: { sourceQslId: normalized.sourceQslId, sourceQslChoice: normalized.sourceQslChoice, recallKeys: normalized.recallKeys, scheduledPersonIds: normalized.scheduledPersonIds } }) ?? run;
}

function normalizeRecallKeys(value) {
  const allowed = new Set([...Object.values(RECALL_KEYS), "chapter14.recall.qsl.believe", "chapter14.recall.qsl.request-review", "chapter14.recall.qsl.defer"]);
  const result = strictArray(value, 4, (entry) => allowed.has(entry) ? entry : null); return result?.length === 4 ? result : null;
}
function normalizePersonIds(value) {
  const allowed = new Set(["person:sora", "person:procedural:chapter08-net-control", "person:procedural:chapter09-source", "person:procedural:chapter09-relay", "person:procedural:chapter12-control", "person:procedural:chapter12-relay"]);
  const result = strictArray(value, allowed.size, (entry) => allowed.has(entry) ? entry : null); return result && new Set(result).size === result.length ? result : null;
}
function normalizeRecovery(value) { return strictArray(value, MAX_RECOVERY_ACTIONS, (entry) => ["AGN", "QRS"].includes(entry) ? entry : null); }
export function normalizeFinalPromiseSummary(value, run = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64); const playerCallsign = callsign(own(value, "playerCallsign"));
  const sourceQslId = own(value, "sourceQslId") === null ? null : boundedText(own(value, "sourceQslId"), 128);
  const sourceQslChoice = own(value, "sourceQslChoice") === null ? null : own(value, "sourceQslChoice");
  const recallKeys = normalizeRecallKeys(own(value, "recallKeys")); const scheduledPersonIds = normalizePersonIds(own(value, "scheduledPersonIds"));
  const accountKey = ACCOUNT_KEYS.includes(own(value, "accountKey")) ? own(value, "accountKey") : null;
  const tone = FINAL_PROMISE_TONES.includes(own(value, "tone")) ? own(value, "tone") : null;
  const recoveryActions = normalizeRecovery(own(value, "recoveryActions")); const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS); const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || !playerCallsign || sourceQslId === undefined || sourceQslChoice === undefined || (sourceQslChoice !== null && !["believe", "request-review", "defer"].includes(sourceQslChoice)) || !recallKeys || !scheduledPersonIds || !accountKey || !tone || !recoveryActions || activeMilliseconds === null || !completedAt || own(value, "targetCallsign") !== TARGET_CALLSIGN || own(value, "personId") !== TARGET_PERSON_ID || own(value, "stationId") !== TARGET_STATION_ID || own(value, "messageKey") !== MESSAGE_KEYS[tone] || own(value, "isFictional") !== true) return null;
  const summary = deepFreeze({ runId: runIdValue, playerCallsign, targetCallsign: TARGET_CALLSIGN, personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID, sourceQslId, sourceQslChoice, recallKeys, scheduledPersonIds, accountKey, tone, messageKey: MESSAGE_KEYS[tone], recoveryActions, activeMilliseconds, completedAt, isFictional: true });
  return run && (!same(summary.recallKeys, run.recallKeys) || !same(summary.scheduledPersonIds, run.scheduledPersonIds) || summary.runId !== run.runId || summary.playerCallsign !== run.playerCallsign || summary.sourceQslId !== run.sourceQslId || summary.sourceQslChoice !== run.sourceQslChoice || summary.accountKey !== run.accountKey || summary.tone !== run.tone || summary.messageKey !== run.messageKey || !same(summary.recoveryActions, run.recoveryActions) || summary.activeMilliseconds !== run.activeMilliseconds || summary.completedAt !== run.completedAt) ? null : summary;
}
export function normalizeFinalPromiseRun(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) || own(value, "version") !== FINAL_PROMISE_RUN_VERSION) return null;
    const seed = boundedText(own(value, "seed"), 96); const startedAt = iso(own(value, "startedAt")); const retryCount = integer(own(value, "retryCount"), 0, 1_000);
    const playerCallsign = callsign(own(value, "playerCallsign")); const phase = PHASES.has(own(value, "phase")) ? own(value, "phase") : null; const activeMilliseconds = integer(own(value, "activeMilliseconds"), 0, ACTIVE_TIMEOUT_MS);
    if (!seed || !startedAt || retryCount === null || !playerCallsign || !phase || activeMilliseconds === null) return null;
    const expectedRunId = runId(seed, startedAt, retryCount);
    if (own(value, "runId") !== expectedRunId || own(value, "targetCallsign") !== TARGET_CALLSIGN || own(value, "personId") !== TARGET_PERSON_ID || own(value, "stationId") !== TARGET_STATION_ID) return null;
    const sourceQslId = own(value, "sourceQslId") === null ? null : boundedText(own(value, "sourceQslId"), 128); const sourceQslChoice = own(value, "sourceQslChoice") === null ? null : own(value, "sourceQslChoice");
    const recallKeys = normalizeRecallKeys(own(value, "recallKeys")); const scheduledPersonIds = normalizePersonIds(own(value, "scheduledPersonIds"));
    const accountKey = ACCOUNT_KEYS.includes(own(value, "accountKey")) ? own(value, "accountKey") : null; const accountWpm = integer(own(value, "accountWpm"), 5, INITIAL_ACCOUNT_WPM); const recoveryActions = normalizeRecovery(own(value, "recoveryActions"));
    const toneValue = own(value, "tone"); const tone = toneValue === null ? null : FINAL_PROMISE_TONES.includes(toneValue) ? toneValue : undefined;
    const messageKeyValue = own(value, "messageKey"); const messageKey = messageKeyValue === null ? null : Object.values(MESSAGE_KEYS).includes(messageKeyValue) ? messageKeyValue : undefined;
    const callAcceptedAt = iso(own(value, "callAcceptedAt"), true); const accountReceivedAt = iso(own(value, "accountReceivedAt"), true); const completedAt = iso(own(value, "completedAt"), true); const failureReason = own(value, "failureReason");
    if (sourceQslId === undefined || sourceQslChoice === undefined || (sourceQslChoice !== null && !["believe", "request-review", "defer"].includes(sourceQslChoice)) || !recallKeys || !scheduledPersonIds || !accountKey || accountWpm === null || !recoveryActions || tone === undefined || messageKey === undefined || callAcceptedAt === undefined || accountReceivedAt === undefined || completedAt === undefined || (failureReason !== null && failureReason !== "TIMED_OUT") || (sourceQslId === null) !== (sourceQslChoice === null) || recallKeys[0] !== (sourceQslChoice ? `chapter14.recall.qsl.${sourceQslChoice}` : RECALL_KEYS.qslNeutral) || recallKeys[3] !== (scheduledPersonIds.length ? RECALL_KEYS.scheduleKnown : RECALL_KEYS.scheduleNeutral) || (tone === null) !== (messageKey === null) || (tone && messageKey !== MESSAGE_KEYS[tone])) return null;
    if ([FINAL_PROMISE_PHASES.ACCOUNT, FINAL_PROMISE_PHASES.FINAL_CHOICE, FINAL_PROMISE_PHASES.FINAL_MESSAGE, FINAL_PROMISE_PHASES.COMPLETED].includes(phase) && !callAcceptedAt) return null;
    if ([FINAL_PROMISE_PHASES.FINAL_CHOICE, FINAL_PROMISE_PHASES.FINAL_MESSAGE, FINAL_PROMISE_PHASES.COMPLETED].includes(phase) && !accountReceivedAt) return null;
    if ([FINAL_PROMISE_PHASES.FINAL_MESSAGE, FINAL_PROMISE_PHASES.COMPLETED].includes(phase) && !tone) return null;
    if (phase === FINAL_PROMISE_PHASES.COMPLETED && (!completedAt || failureReason !== null)) return null;
    if (phase === FINAL_PROMISE_PHASES.FAILED && (!completedAt || failureReason !== "TIMED_OUT")) return null;
    if (phase === FINAL_PROMISE_PHASES.ABANDONED && !completedAt) return null;
    if (!TERMINAL_PHASES.has(phase) && (completedAt !== null || failureReason !== null)) return null;
    if (Date.parse(completedAt ?? startedAt) < Date.parse(startedAt) || callAcceptedAt && Date.parse(callAcceptedAt) < Date.parse(startedAt) || accountReceivedAt && (!callAcceptedAt || Date.parse(accountReceivedAt) < Date.parse(callAcceptedAt))) return null;
    const partial = { version: FINAL_PROMISE_RUN_VERSION, runId: expectedRunId, seed, playerCallsign, targetCallsign: TARGET_CALLSIGN, personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID, sourceQslId, sourceQslChoice, recallKeys, scheduledPersonIds, accountKey, accountWpm, recoveryActions, tone, messageKey, phase, activeMilliseconds, startedAt, callAcceptedAt, accountReceivedAt, completedAt, failureReason, retryCount, summary: null };
    if (phase === FINAL_PROMISE_PHASES.COMPLETED) { const summary = normalizeFinalPromiseSummary(own(value, "summary"), partial); return summary ? deepFreeze({ ...partial, summary }) : null; }
    if (own(value, "summary") !== null) return null; return deepFreeze(partial);
  } catch { return null; }
}
function normalizeId(value) { return boundedText(value, 96); }
function uniqueSortedIds(value) { const ids = strictArrayTail(value, 80, normalizeId); if (!ids || new Set(ids).size !== ids.length) return null; for (let index = 1; index < ids.length; index += 1) if (ids[index - 1] >= ids[index]) return null; return ids; }
export function normalizeFinalPromiseProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64); const qsoId = boundedText(own(value, "qsoId"), 96);
  const sourceQslId = own(value, "sourceQslId") === null ? null : boundedText(own(value, "sourceQslId"), 128);
  const sourceQslChoice = own(value, "sourceQslChoice") === null ? null : own(value, "sourceQslChoice");
  const tone = FINAL_PROMISE_TONES.includes(own(value, "tone")) ? own(value, "tone") : null; const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || own(value, "recordId") !== `final-page:${runIdValue}` || !qsoId
    || sourceQslId === undefined || sourceQslChoice === undefined
    || (sourceQslChoice !== null && !["believe", "request-review", "defer"].includes(sourceQslChoice))
    || (sourceQslId === null) !== (sourceQslChoice === null) || !tone || !completedAt
    || own(value, "personId") !== TARGET_PERSON_ID || own(value, "stationId") !== TARGET_STATION_ID
    || own(value, "messageKey") !== MESSAGE_KEYS[tone]) return null;
  return deepFreeze({ runId: runIdValue, recordId: `final-page:${runIdValue}`, qsoId, sourceQslId,
    sourceQslChoice, personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID,
    tone, messageKey: MESSAGE_KEYS[tone], completedAt });
}
export function normalizeFinalPromiseRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const runIdValue = boundedText(own(value, "runId"), 64); const qsoId = boundedText(own(value, "qsoId"), 96);
  const playerCallsign = callsign(own(value, "playerCallsign"));
  const sourceQslId = own(value, "sourceQslId") === null ? null : boundedText(own(value, "sourceQslId"), 128);
  const sourceQslChoice = own(value, "sourceQslChoice") === null ? null : own(value, "sourceQslChoice");
  const recallKeys = normalizeRecallKeys(own(value, "recallKeys")); const scheduledPersonIds = normalizePersonIds(own(value, "scheduledPersonIds"));
  const accountKey = ACCOUNT_KEYS.includes(own(value, "accountKey")) ? own(value, "accountKey") : null;
  const tone = FINAL_PROMISE_TONES.includes(own(value, "tone")) ? own(value, "tone") : null; const completedAt = iso(own(value, "completedAt"));
  if (!runIdValue || own(value, "id") !== `final-page:${runIdValue}` || !qsoId || !playerCallsign
    || sourceQslId === undefined || sourceQslChoice === undefined
    || (sourceQslChoice !== null && !["believe", "request-review", "defer"].includes(sourceQslChoice))
    || (sourceQslId === null) !== (sourceQslChoice === null) || !recallKeys || !scheduledPersonIds || !accountKey || !tone || !completedAt
    || own(value, "targetCallsign") !== TARGET_CALLSIGN || own(value, "personId") !== TARGET_PERSON_ID
    || own(value, "stationId") !== TARGET_STATION_ID || own(value, "messageKey") !== MESSAGE_KEYS[tone]
    || own(value, "isFictional") !== true) return null;
  return deepFreeze({ id: `final-page:${runIdValue}`, runId: runIdValue, qsoId, playerCallsign,
    targetCallsign: TARGET_CALLSIGN, personId: TARGET_PERSON_ID, stationId: TARGET_STATION_ID,
    sourceQslId, sourceQslChoice, recallKeys, scheduledPersonIds, accountKey,
    tone, messageKey: MESSAGE_KEYS[tone], completedAt, isFictional: true });
}
const frozenEmptyArray = () => Object.freeze([]);
export function emptyFinalPromiseState() { return Object.freeze({ version: FINAL_PROMISE_STATE_VERSION, activeRun: null, completedRuns: frozenEmptyArray(), settledRunIds: frozenEmptyArray(), settlementProofs: frozenEmptyArray(), archive: frozenEmptyArray(), taskTreeUnlocked: false }); }
export function normalizeFinalPromiseState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}; const activeValue = own(source, "activeRun"); const activeRun = activeValue == null ? null : normalizeFinalPromiseRun(activeValue);
    const completedRuns = strictArrayTail(own(source, "completedRuns") ?? [], 80, normalizeFinalPromiseSummary); const settledRunIds = uniqueSortedIds(own(source, "settledRunIds") ?? []);
    const settlementProofs = strictArrayTail(own(source, "settlementProofs") ?? [], 80, normalizeFinalPromiseProof);
    const archive = strictArrayTail(own(source, "archive") ?? [], 80, normalizeFinalPromiseRecord);
    if ((activeValue != null && !activeRun) || !completedRuns || !settledRunIds || !settlementProofs || !archive) return emptyFinalPromiseState();
    return deepFreeze({ version: FINAL_PROMISE_STATE_VERSION, activeRun, completedRuns, settledRunIds, settlementProofs, archive, taskTreeUnlocked: own(source, "taskTreeUnlocked") === true });
  } catch { return emptyFinalPromiseState(); }
}
export function finalPromiseReplayAvailable(save) { return normalizeFinalPromiseState(own(own(save, "storyContinuationState"), "chapter14")).taskTreeUnlocked; }
