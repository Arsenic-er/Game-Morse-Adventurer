import { emptyQslStoryState, normalizeQslStoryState } from "./qslStoryRun.js";
import { emptyServiceNetState, normalizeServiceNetState } from "./serviceNetRun.js";

export const STORY_CONTINUATION_STATE_VERSION = 1;

const LIMITS = Object.freeze({
  chapter07: Object.freeze({ ledger: "cases", maximum: 40 }),
  chapter08: Object.freeze({ ledger: "receipts", maximum: 80, unlock: "taskTreeUnlocked" }),
  chapter09: Object.freeze({ ledger: "packets", maximum: 80, unlock: "toolUnlocked" }),
  chapter10: Object.freeze({ ledger: "records", maximum: 40, unlock: "taskTreeUnlocked" }),
});
const SETTLED_RUN_LIMIT = 100;

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function identifier(value, maximum = 128) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return candidate.length > 0 && candidate.length <= maximum
    && /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(candidate)
    ? candidate
    : null;
}

function iso(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function arrayLength(value) {
  if (!Array.isArray(value)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!descriptor || !Object.hasOwn(descriptor, "value")
    || Object.hasOwn(descriptor, "get") || Object.hasOwn(descriptor, "set")) return null;
  return Number.isSafeInteger(descriptor.value) && descriptor.value >= 0
    && descriptor.value <= 0xFFFF_FFFF && value.length === descriptor.value
    ? descriptor.value
    : null;
}

function retainedDataValues(value, maximum) {
  try {
    const length = arrayLength(value);
    if (length == null) return null;
    const retained = [];
    for (let index = Math.max(0, length - maximum); index < length; index += 1) {
      if (!Object.hasOwn(value, index)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")
        || Object.hasOwn(descriptor, "get") || Object.hasOwn(descriptor, "set")) return null;
      retained.push(descriptor.value);
    }
    return retained;
  } catch {
    return null;
  }
}

function normalizeRecord(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const id = identifier(own(value, "id"));
    const completedAt = iso(own(value, "completedAt"));
    return id && completedAt ? Object.freeze({ id, completedAt }) : null;
  } catch {
    return null;
  }
}

function normalizeLedger(value, maximum) {
  const candidates = retainedDataValues(value, maximum);
  if (!candidates) return Object.freeze([]);
  const records = [];
  const ids = new Set();
  let previous = null;
  for (const candidate of candidates) {
    const record = normalizeRecord(candidate);
    if (!record || ids.has(record.id)) return Object.freeze([]);
    if (previous) {
      const timeOrder = Date.parse(record.completedAt) - Date.parse(previous.completedAt);
      if (timeOrder < 0 || (timeOrder === 0 && record.id <= previous.id)) return Object.freeze([]);
    }
    ids.add(record.id);
    records.push(record);
    previous = record;
  }
  return Object.freeze(records);
}

function normalizeIdentifiers(value) {
  const candidates = retainedDataValues(value, SETTLED_RUN_LIMIT);
  if (!candidates) return Object.freeze([]);
  const result = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const id = identifier(candidate);
    if (!id || seen.has(id)) return Object.freeze([]);
    seen.add(id);
    result.push(id);
  }
  return Object.freeze(result);
}

function emptyChapter(chapter) {
  const shape = LIMITS[chapter];
  const result = {
    activeRun: null,
    [shape.ledger]: Object.freeze([]),
    settledRunIds: Object.freeze([]),
  };
  if (shape.unlock) result[shape.unlock] = false;
  return Object.freeze(result);
}

function normalizeChapter(value, chapter) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const shape = LIMITS[chapter];
  const result = {
    activeRun: null,
    [shape.ledger]: normalizeLedger(own(source, shape.ledger) ?? [], shape.maximum),
    settledRunIds: normalizeIdentifiers(own(source, "settledRunIds") ?? []),
  };
  if (shape.unlock) result[shape.unlock] = own(source, shape.unlock) === true;
  return Object.freeze(result);
}

export function emptyStoryContinuationState() {
  return Object.freeze({
    version: STORY_CONTINUATION_STATE_VERSION,
    chapter07: emptyQslStoryState(),
    chapter08: emptyServiceNetState(),
    chapter09: emptyChapter("chapter09"),
    chapter10: emptyChapter("chapter10"),
  });
}

export function normalizeStoryContinuationState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.freeze({
      version: STORY_CONTINUATION_STATE_VERSION,
      chapter07: normalizeQslStoryState(own(source, "chapter07")),
      chapter08: normalizeServiceNetState(own(source, "chapter08")),
      chapter09: normalizeChapter(own(source, "chapter09"), "chapter09"),
      chapter10: normalizeChapter(own(source, "chapter10"), "chapter10"),
    });
  } catch {
    return emptyStoryContinuationState();
  }
}
