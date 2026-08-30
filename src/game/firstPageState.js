import { OPEN_STATION_GOALS } from "./openStationState.js";

export const FIRST_PAGE_STATE_VERSION = 1;
export const FIRST_PAGE_RECORD_LIMIT = 40;

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch { return undefined; }
}

function text(value, maximum) {
  return typeof value === "string" && value.length <= maximum && value.trim() === value && value ? value : null;
}

function iso(value) {
  if (typeof value !== "string" || value.length > 32) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

export function normalizeFirstPageGoal(value) {
  return typeof value === "string" && OPEN_STATION_GOALS.includes(value) ? value : null;
}

export function normalizeFirstPageRun() { return null; }

export function normalizeFirstPageSummary(value) {
  const runId = text(own(value, "runId"), 128);
  const qsoId = text(own(value, "qsoId"), 96);
  const goal = normalizeFirstPageGoal(own(value, "goal"));
  const completedAt = iso(own(value, "completedAt"));
  return runId === `first-page:${qsoId}` && qsoId && goal && completedAt
    ? Object.freeze({ runId, qsoId, goal, completedAt }) : null;
}

export function normalizeFirstPageProof(value) {
  const summary = normalizeFirstPageSummary(value);
  const acceptedAt = iso(own(value, "acceptedAt"));
  const qsoCompletedAt = iso(own(value, "qsoCompletedAt"));
  return summary && acceptedAt && qsoCompletedAt
    && Date.parse(acceptedAt) <= Date.parse(qsoCompletedAt)
    && Date.parse(qsoCompletedAt) <= Date.parse(summary.completedAt)
    ? Object.freeze({ ...summary, acceptedAt, qsoCompletedAt }) : null;
}

export function normalizeFirstPageRecord(value) {
  const summary = normalizeFirstPageSummary(value);
  const callsign = text(own(value, "callsign"), 16);
  const personId = text(own(value, "personId"), 96);
  const stationId = text(own(value, "stationId"), 96);
  const location = text(own(value, "location"), 32);
  const qsoCompletedAt = iso(own(value, "qsoCompletedAt"));
  return summary && callsign && personId && stationId && location && qsoCompletedAt
    && Date.parse(qsoCompletedAt) <= Date.parse(summary.completedAt)
    ? Object.freeze({ ...summary, callsign, personId, stationId, location, qsoCompletedAt }) : null;
}

function normalizeList(value, normalizer, key) {
  if (!Array.isArray(value)) return [];
  let length;
  try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return []; }
  if (!Number.isSafeInteger(length) || length < 0) return [];
  const result = [];
  const ids = new Set();
  for (let index = Math.max(0, length - FIRST_PAGE_RECORD_LIMIT); index < length; index += 1) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return []; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return [];
    const normalized = normalizer(descriptor.value);
    const id = normalized?.[key];
    if (!normalized || ids.has(id)) return [];
    const previous = result.at(-1);
    if (previous && (previous.completedAt > normalized.completedAt
      || (previous.completedAt === normalized.completedAt && previous[key] >= id))) return [];
    ids.add(id);
    result.push(normalized);
  }
  return result;
}

function normalizeSettledIds(value) {
  if (!Array.isArray(value)) return [];
  let length;
  try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return []; }
  if (!Number.isSafeInteger(length) || length < 0) return [];
  const result = [];
  for (let index = Math.max(0, length - FIRST_PAGE_RECORD_LIMIT); index < length; index += 1) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return []; }
    const id = descriptor && Object.hasOwn(descriptor, "value") ? text(descriptor.value, 128) : null;
    if (!id?.startsWith("first-page:") || (result.at(-1) && result.at(-1) >= id)) return [];
    result.push(id);
  }
  return result;
}

const frozenEmptyArray = () => Object.freeze([]);

export function emptyFirstPageState() {
  return Object.freeze({
    version: FIRST_PAGE_STATE_VERSION,
    activeRun: null,
    completedRuns: frozenEmptyArray(),
    settledRunIds: frozenEmptyArray(),
    settlementProofs: frozenEmptyArray(),
    archive: frozenEmptyArray(),
    taskTreeUnlocked: false,
  });
}

export function normalizeFirstPageState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const completedRuns = normalizeList(own(source, "completedRuns"), normalizeFirstPageSummary, "runId");
  const settledRunIds = normalizeSettledIds(own(source, "settledRunIds"));
  const settlementProofs = normalizeList(own(source, "settlementProofs"), normalizeFirstPageProof, "runId");
  const archive = normalizeList(own(source, "archive"), normalizeFirstPageRecord, "runId");
  return Object.freeze({
    version: FIRST_PAGE_STATE_VERSION,
    activeRun: null,
    completedRuns: Object.freeze(completedRuns),
    settledRunIds: Object.freeze(settledRunIds),
    settlementProofs: Object.freeze(settlementProofs),
    archive: Object.freeze(archive),
    taskTreeUnlocked: own(source, "taskTreeUnlocked") === true,
  });
}
