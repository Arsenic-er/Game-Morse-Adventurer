import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_QSL_RECORDS, QSL_CHOICES, QSL_RECORDS_VERSION, confirmQslChoice,
  createExpeditionQslRecord, createQslRecord, normalizeQslRecords,
} from "../src/game/qslRecords.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";

const BASE = {
  id: "qsl:expedition:run-1",
  personId: "person:sora",
  stationId: "station:sim6jp",
  callsign: "SIM6JP",
  qsoId: "expedition-qso:run-1",
  eventRunId: "run-1",
  playerNarrativeKey: "qsl.player.hill-signal",
  operatorNarrativeKey: "qsl.operator.sora-hill-reply",
  createdAt: "2026-08-26T03:05:00.000Z",
};

test("QSL records are versioned, person-linked, immutable and fixed-key only", () => {
  const record = createQslRecord(BASE);
  assert.equal(record.version, QSL_RECORDS_VERSION);
  assert.equal(record.personId, "person:sora");
  assert.equal(record.qsoId, "expedition-qso:run-1");
  assert.equal(record.eventRunId, "run-1");
  assert.equal(record.choice, null);
  assert.ok(Object.isFrozen(record));
  assert.deepEqual(QSL_CHOICES, ["believe", "request-review", "defer"]);
  assert.equal("message" in record, false);
  assert.equal("freeText" in record, false);
});

test("QSL records allow the fixed Chapter 7 clarification narrative pair", () => {
  const record = createQslRecord({
    ...BASE,
    id: "qsl:story:chapter-07",
    qsoId: "qsl-story-qso:chapter-07",
    eventRunId: "qsl-story:chapter-07",
    playerNarrativeKey: "qsl.player.clarification-request",
    operatorNarrativeKey: "qsl.operator.sora-clarification",
  });

  assert.equal(record.playerNarrativeKey, "qsl.player.clarification-request");
  assert.equal(record.operatorNarrativeKey, "qsl.operator.sora-clarification");
});

test("expedition settlement creates a bounded QSL linked to both QSO and event run", () => {
  const runId = `run-${"z".repeat(120)}`;
  const record = createExpeditionQslRecord({
    runId,
    result: { completedAt: BASE.createdAt },
    contacts: [{ personId: BASE.personId, stationId: BASE.stationId, callsign: BASE.callsign }],
  }, "expedition-qso:bounded-proof");
  assert.ok(record.id.length <= 128);
  assert.equal(record.eventRunId, runId);
  assert.equal(record.qsoId, "expedition-qso:bounded-proof");
  assert.equal(record.personId, BASE.personId);
  assert.equal(record.playerNarrativeKey, "qsl.player.hill-signal");
  assert.equal(record.operatorNarrativeKey, "qsl.operator.sora-hill-reply");
});

test("QSL choice confirms once, reloads unchanged, and duplicate confirmation is an exact no-op", () => {
  const initial = normalizeQslRecords([createQslRecord(BASE)]);
  const confirmed = confirmQslChoice(initial, BASE.id, "request-review", "2026-08-26T03:06:00.000Z");
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.record.choice, "request-review");
  assert.equal(confirmed.record.confirmedAt, "2026-08-26T03:06:00.000Z");
  const reloaded = normalizeQslRecords(JSON.parse(JSON.stringify(confirmed.records)));
  assert.deepEqual(reloaded, confirmed.records);
  const duplicate = confirmQslChoice(reloaded, BASE.id, "believe", "2026-08-26T03:07:00.000Z");
  assert.equal(duplicate.confirmed, false);
  assert.equal(duplicate.reason, "ALREADY_CONFIRMED");
  assert.strictEqual(duplicate.records, reloaded);
});

test("QSL confirmation timestamps cannot predate record creation", () => {
  const beforeCreation = "2026-08-26T03:04:59.999Z";
  assert.equal(createQslRecord({
    ...BASE,
    choice: "believe",
    confirmedAt: beforeCreation,
  }), null);

  const records = normalizeQslRecords([createQslRecord(BASE)]);
  const rejected = confirmQslChoice(records, BASE.id, "believe", beforeCreation);
  assert.equal(rejected.confirmed, false);
  assert.equal(rejected.reason, "INVALID_CHOICE");
  assert.strictEqual(rejected.records, records);
  assert.equal(rejected.record, null);
});

test("QSL hostile input is own-only, bounded, prototype-safe and never persists player text", () => {
  let getterCalls = 0;
  const hostile = Object.create({
    id: BASE.id,
    personId: BASE.personId,
    qsoId: BASE.qsoId,
    playerNarrativeKey: BASE.playerNarrativeKey,
    operatorNarrativeKey: BASE.operatorNarrativeKey,
    freeText: "inherited player transmission",
  });
  Object.defineProperty(hostile, "callsign", { enumerable: true, get() { getterCalls += 1; return "SIM6JP"; } });
  assert.equal(createQslRecord(hostile), null);
  assert.equal(getterCalls, 0);

  const oversized = Array.from({ length: MAX_QSL_RECORDS + 200 }, (_, index) => ({
    ...BASE, id: `qsl:expedition:${index}`, qsoId: `qso-${index}`,
  }));
  const normalized = normalizeQslRecords(oversized);
  assert.equal(normalized.length, MAX_QSL_RECORDS);
  assert.ok(normalized.every((record) => !JSON.stringify(record).includes("player transmission")));
  assert.equal(createQslRecord({ ...BASE, playerNarrativeKey: "player wrote CQ CQ" }), null);
  assert.equal(createQslRecord({ ...BASE, operatorNarrativeKey: "<script>alert(1)</script>" }), null);
  assert.equal(createQslRecord({ ...BASE, id: "x".repeat(5000) }), null);

  const clean = createQslRecord({ ...BASE, id: "qsl:expedition:clean", qsoId: "qso-clean" });
  const tainted = Object.freeze({
    ...createQslRecord({ ...BASE, id: "qsl:expedition:tainted", qsoId: "qso-tainted" }),
    freeText: "PLAYER SECRET",
  });
  const sanitizedChoice = confirmQslChoice(
    Object.freeze([tainted, clean]), clean.id, "defer", "2026-08-26T03:07:00.000Z",
  );
  assert.equal(sanitizedChoice.confirmed, true);
  assert.equal(sanitizedChoice.records.some((record) => Object.hasOwn(record, "freeText")), false);

  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true, configurable: false,
    get() { getterCalls += 1; return clean; },
  });
  Object.freeze(accessorArray);
  const rejectedAccessor = confirmQslChoice(accessorArray, clean.id, "believe", "2026-08-26T03:07:00.000Z");
  assert.equal(rejectedAccessor.confirmed, false);
  assert.equal(getterCalls, 0);

  const throwingProxy = new Proxy([clean], {
    getOwnPropertyDescriptor() { throw new Error("must not escape"); },
  });
  assert.doesNotThrow(() => normalizeQslRecords(throwingProxy));
  assert.deepEqual(normalizeQslRecords(throwingProxy), []);
  assert.doesNotThrow(() => confirmQslChoice(throwingProxy, clean.id, "believe", BASE.createdAt));
});

test("save migration normalizes QSL twice idempotently and never backfills old saves", () => {
  const legacy = createSave({ callsign: "BH1ABC", locationId: "tokyo" });
  delete legacy.qslRecords;
  delete legacy.qslRecordsVersion;
  const first = normalizeSave(legacy);
  const second = normalizeSave(first);
  assert.deepEqual(first, second);
  assert.equal(first.qslRecordsVersion, QSL_RECORDS_VERSION);
  assert.deepEqual(first.qslRecords, []);

  const withRecord = normalizeSave({ ...legacy, qslRecords: [createQslRecord(BASE)] });
  assert.deepEqual(normalizeSave(withRecord).qslRecords, withRecord.qslRecords);
});
