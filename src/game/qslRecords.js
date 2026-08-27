export const QSL_RECORDS_VERSION = 1;
export const MAX_QSL_RECORDS = 100;
export const QSL_CHOICES = Object.freeze(["believe", "request-review", "defer"]);

const NARRATIVE_KEYS = new Set([
  "qsl.player.hill-signal",
  "qsl.operator.sora-hill-reply",
  "qsl.player.lights-contact",
  "qsl.operator.lights-reply",
  "qsl.player.clarification-request",
  "qsl.operator.sora-clarification",
]);
const RECORD_KEYS = Object.freeze([
  "version", "id", "personId", "stationId", "callsign", "qsoId", "eventRunId",
  "playerNarrativeKey", "operatorNarrativeKey", "createdAt", "choice", "confirmedAt",
]);

function ownData(value, key) {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function bounded(value, maximum) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum || /[\u0000-\u001F\u007F]/.test(text)) return null;
  return text;
}

function id(value, maximum = 128) {
  const text = bounded(value, maximum);
  return text && /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(text) ? text : null;
}

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function callsign(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{1,16}$/.test(text) ? text : null;
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const recordId = id(ownData(value, "id"));
  const personId = id(ownData(value, "personId"));
  const stationId = id(ownData(value, "stationId"));
  const normalizedCallsign = callsign(ownData(value, "callsign"));
  const qsoId = ownData(value, "qsoId") == null ? null : id(ownData(value, "qsoId"));
  const eventRunId = ownData(value, "eventRunId") == null ? null : id(ownData(value, "eventRunId"));
  const playerNarrativeKey = bounded(ownData(value, "playerNarrativeKey"), 64);
  const operatorNarrativeKey = bounded(ownData(value, "operatorNarrativeKey"), 64);
  const createdAt = iso(ownData(value, "createdAt"));
  const choiceValue = ownData(value, "choice");
  const choice = QSL_CHOICES.includes(choiceValue) ? choiceValue : null;
  const confirmedAt = choice ? iso(ownData(value, "confirmedAt")) : null;
  if (!recordId || !personId || !personId.startsWith("person:") || !stationId
    || !stationId.startsWith("station:") || !normalizedCallsign || (!qsoId && !eventRunId)
    || !NARRATIVE_KEYS.has(playerNarrativeKey) || !NARRATIVE_KEYS.has(operatorNarrativeKey)
    || !createdAt || (choice && (!confirmedAt || Date.parse(confirmedAt) < Date.parse(createdAt)))) return null;
  return Object.freeze({
    version: QSL_RECORDS_VERSION,
    id: recordId,
    personId,
    stationId,
    callsign: normalizedCallsign,
    qsoId,
    eventRunId,
    playerNarrativeKey,
    operatorNarrativeKey,
    createdAt,
    choice,
    confirmedAt,
  });
}

export function createQslRecord(value) {
  try {
    return normalizeRecord(value);
  } catch {
    return null;
  }
}

function hash32(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

export function createExpeditionQslRecord(run, qsoId) {
  const runId = id(run?.runId);
  const contact = Array.isArray(run?.contacts) ? run.contacts[0] : null;
  if (!runId || !contact) return null;
  const prefix = "qsl:expedition:";
  const fullId = `${prefix}${runId}`;
  const recordId = fullId.length <= 128
    ? fullId : `${prefix}${runId.slice(0, 128 - prefix.length - 9)}-${hash32(runId)}`;
  return createQslRecord({
    id: recordId,
    personId: contact.personId,
    stationId: contact.stationId,
    callsign: contact.callsign,
    qsoId,
    eventRunId: runId,
    playerNarrativeKey: "qsl.player.hill-signal",
    operatorNarrativeKey: "qsl.operator.sora-hill-reply",
    createdAt: run.result?.completedAt,
  });
}

export function normalizeQslRecords(value) {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
    const records = [];
    const ids = new Set();
    const start = Math.max(0, value.length - (MAX_QSL_RECORDS * 4));
    for (let index = start; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")) continue;
      const record = normalizeRecord(descriptor.value);
      if (!record || ids.has(record.id)) continue;
      ids.add(record.id);
      records.push(record);
    }
    return Object.freeze(records.slice(-MAX_QSL_RECORDS));
  } catch {
    return Object.freeze([]);
  }
}

function isCanonicalRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.isFrozen(value)
    || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== RECORD_KEYS.length || RECORD_KEYS.some((key) => !names.includes(key))) return false;
  const normalized = normalizeRecord(value);
  return Boolean(normalized && RECORD_KEYS.every((key) => ownData(value, key) === normalized[key]));
}

function isCanonicalRecordList(value) {
  if (!Array.isArray(value) || !Object.isFrozen(value) || value.length > MAX_QSL_RECORDS
    || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes("length")) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !isCanonicalRecord(descriptor.value)) return false;
  }
  return true;
}

export function confirmQslChoice(value, recordIdValue, choiceValue, confirmedAtValue) {
  let records = Object.freeze([]);
  try {
    records = isCanonicalRecordList(value) ? value : normalizeQslRecords(value);
    const recordId = id(recordIdValue);
    const confirmedAt = iso(confirmedAtValue);
    if (!recordId || !QSL_CHOICES.includes(choiceValue) || !confirmedAt) {
      return { records, confirmed: false, reason: "INVALID_CHOICE", record: null };
    }
    const index = records.findIndex((record) => record.id === recordId);
    if (index < 0) return { records, confirmed: false, reason: "UNKNOWN_RECORD", record: null };
    if (records[index].choice) {
      return { records, confirmed: false, reason: "ALREADY_CONFIRMED", record: records[index] };
    }
    if (Date.parse(confirmedAt) < Date.parse(records[index].createdAt)) {
      return { records, confirmed: false, reason: "INVALID_CHOICE", record: null };
    }
    const record = normalizeRecord({ ...records[index], choice: choiceValue, confirmedAt });
    const next = Object.freeze(records.map((candidate, candidateIndex) => candidateIndex === index ? record : candidate));
    return { records: next, confirmed: true, reason: null, record };
  } catch {
    return { records, confirmed: false, reason: "INVALID_CHOICE", record: null };
  }
}
