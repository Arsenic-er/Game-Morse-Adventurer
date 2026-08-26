import assert from "node:assert/strict";
import test from "node:test";

import { createExpeditionLoadout } from "../src/game/expeditionCatalog.js";
import {
  EXPEDITION_RUN_VERSION,
  MAX_EXPEDITION_SETTLED_QSO_PROOFS,
  abandonExpeditionRun,
  advanceExpeditionSetup,
  attemptExpeditionSetup,
  beginExpeditionCq,
  createExpeditionRun,
  emptyExpeditionState,
  normalizeExpeditionRun,
  normalizeExpeditionSettlementProofs,
  normalizeExpeditionState,
  receiveExpeditionContact,
  requestExpeditionRecovery,
  retryExpeditionRun,
  selectExpeditionSite,
  submitExpeditionExchange,
  tickExpeditionRun,
} from "../src/game/expeditionRun.js";

const STARTED_AT = "2026-08-25T09:00:00.000Z";

function fresh(runId = "expedition:story-06:run-1") {
  return createExpeditionRun({
    runId,
    playerCallsign: "BH1ABC",
    loadout: createExpeditionLoadout({}, { source: "loan" }),
    startedAt: STARTED_AT,
  });
}

function ready(run = fresh()) {
  const selected = selectExpeditionSite(run, "sunward-hill", "2026-08-25T09:01:00.000Z");
  const antenna = advanceExpeditionSetup(selected, "antenna", "2026-08-25T09:02:00.000Z");
  return advanceExpeditionSetup(antenna, "power", "2026-08-25T09:03:00.000Z");
}

function exchanging({ level = 3, run = ready() } = {}) {
  const calling = beginExpeditionCq(run, {
    observedAt: "2026-08-25T09:04:00.000Z",
    propagationSnapshot: { level, noise: 1, capturedAt: "2026-08-25T09:04:00.000Z" },
  });
  return receiveExpeditionContact(calling, {
    callsign: "SIM6JP",
    personId: "person:sora",
    stationId: "station:sim6jp",
    locationId: "japan-osaka-kansai",
    distanceKm: 410,
    sentRst: "579",
    receivedRst: "559",
    remoteWpm: 18,
    operatorProfileId: "youth-club",
  }, "2026-08-25T09:05:00.000Z");
}

test("site selection and setup are pure and keep the temporary loadout isolated", () => {
  const initial = fresh();
  const initialSnapshot = structuredClone(initial);
  assert.equal(initial.version, EXPEDITION_RUN_VERSION);
  assert.equal(initial.status, "site-selection");

  const selected = selectExpeditionSite(initial, "sunward-hill", "2026-08-25T09:01:00.000Z");
  assert.equal(selected.status, "setup");
  assert.equal(selected.fieldSite.id, "sunward-hill");
  assert.equal(selected.fieldSite.timeZone, "Asia/Tokyo");
  assert.deepEqual(initial, initialSnapshot);

  const antenna = advanceExpeditionSetup(selected, "antenna", "2026-08-25T09:02:00.000Z");
  assert.deepEqual(antenna.setup, { antenna: true, power: false });
  const completed = advanceExpeditionSetup(antenna, "power", "2026-08-25T09:03:00.000Z");
  assert.equal(completed.status, "ready");
  assert.deepEqual(completed.setup, { antenna: true, power: true });
  assert.equal(completed.loadout.source, "loan");
  assert.equal(completed.power.remainingWh, 96);
});

test("CQ freezes one propagation snapshot and later transitions never reroll it", () => {
  const prepared = ready();
  const first = beginExpeditionCq(prepared, {
    observedAt: "2026-08-25T09:04:00.000Z",
    propagationSnapshot: { level: 2, noise: 3, capturedAt: "2026-08-25T09:04:00.000Z" },
  });
  const second = beginExpeditionCq(first, {
    observedAt: "2026-08-25T09:04:05.000Z",
    propagationSnapshot: { level: 4, noise: 0, capturedAt: "2026-08-25T09:04:05.000Z" },
  });
  assert.equal(first.status, "calling");
  assert.deepEqual(second.propagationSnapshot, first.propagationSnapshot);
  assert.equal(second.propagationSnapshot.level, 2);
  assert.equal(Object.isFrozen(second.propagationSnapshot), true);
  assert.ok(first.power.remainingWh < prepared.power.remainingWh);
});

test("invalid field wiring has a bounded temporary penalty and correct setup can recover", () => {
  const selected = selectExpeditionSite(fresh(), "sunward-hill", "2026-08-25T09:01:00.000Z");
  const mistaken = attemptExpeditionSetup(
    selected,
    "antenna",
    { valid: false, errorCode: "INVALID_WIRING" },
    "2026-08-25T09:01:30.000Z",
  );
  assert.equal(mistaken.status, "setup");
  assert.deepEqual(mistaken.setup, { antenna: false, power: false });
  assert.equal(mistaken.setupMistakes, 1);
  assert.equal(mistaken.setupPropagationPenalty, 1);
  assert.equal(mistaken.elapsedMilliseconds, 30_000);
  assert.ok(mistaken.power.remainingWh < 96);
  assert.equal(mistaken.loadout.radioId, "loan-portable-cw");

  const antenna = advanceExpeditionSetup(mistaken, "antenna", "2026-08-25T09:02:00.000Z");
  const corrected = advanceExpeditionSetup(antenna, "power", "2026-08-25T09:02:30.000Z");
  assert.equal(corrected.status, "ready");
  assert.deepEqual(corrected.setup, { antenna: true, power: true });
  const calling = beginExpeditionCq(corrected, {
    observedAt: "2026-08-25T09:03:00.000Z",
    propagationSnapshot: { level: 3, noise: 1, capturedAt: "2026-08-25T09:03:00.000Z" },
  });
  assert.equal(calling.propagationSnapshot.level, 2);

  const abandoned = abandonExpeditionRun(calling, "2026-08-25T09:03:30.000Z");
  const retried = retryExpeditionRun(abandoned, {
    runId: "expedition:story-06:setup-retry",
    startedAt: "2026-08-25T10:00:00.000Z",
  });
  assert.equal(retried.setupMistakes, 0);
  assert.equal(retried.setupPropagationPenalty, 0);
  assert.equal(retried.power.remainingWh, 96);
  assert.equal(retried.loadout.radioId, "loan-portable-cw");
});

test("a complete hard-field exchange closes a normal expedition contact", () => {
  const inExchange = exchanging();
  const completed = submitExpeditionExchange(
    inExchange,
    "QTH SUNWARD PWR 5W ANT WIRE K",
    { safeToCommit: true },
    "2026-08-25T09:06:00.000Z",
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.result.outcome, "success");
  assert.equal(completed.contacts.length, 1);
  assert.equal(completed.contacts[0].personId, "person:sora");
  assert.deepEqual(completed.contacts[0].topics, ["QTH", "POWER", "ANTENNA"]);
});

test("completed runs fail closed when any trusted completion invariant is absent", () => {
  const valid = submitExpeditionExchange(
    exchanging(),
    "QTH SUNWARD PWR 5W ANT WIRE K",
    { safeToCommit: true },
    "2026-08-25T09:06:00.000Z",
  );
  const variants = [
    { ...valid, setup: { antenna: false, power: true } },
    { ...valid, propagationSnapshot: null },
    { ...valid, lastExchange: { accepted: false, errors: [] } },
    { ...valid, result: { ...valid.result, contactCount: 0 } },
    { ...valid, contacts: valid.contacts.map((contact) => ({ ...contact, topics: ["QTH", "POWER"] })) },
    { ...valid, contacts: valid.contacts.map((contact) => ({
      ...contact, exchange: { ...contact.exchange, qthCode: "LAKEVIEW" },
    })) },
    { ...valid, loadout: { ...valid.loadout, antennaCode: "EFHW" } },
    Object.create(valid),
  ];
  for (const variant of variants) {
    const normalized = normalizeExpeditionRun(variant);
    assert.equal(normalized.status, "failed");
    assert.equal(normalized.result.outcome, "failed");
    assert.equal(normalized.failureReason, "CORRUPT_RUN");
    assert.equal(normalizeExpeditionRun(normalized).status, "failed");
  }
});

test("a weak link requires AGN or QRS recovery without changing its frozen propagation", () => {
  const weak = exchanging({ level: 1 });
  const firstTry = submitExpeditionExchange(
    weak,
    "SUNWARD 5W WIRE",
    { safeToCommit: true },
    "2026-08-25T09:06:00.000Z",
  );
  assert.equal(firstTry.status, "recovering");
  assert.equal(firstTry.failureReason, "WEAK_LINK_REQUIRES_RECOVERY");
  const waiting = tickExpeditionRun(firstTry, { seconds: 10 }, "2026-08-25T09:06:10.000Z");
  assert.equal(waiting.status, "recovering");
  const recovered = requestExpeditionRecovery(waiting, "QRS", "2026-08-25T09:06:30.000Z");
  assert.equal(recovered.status, "exchange");
  assert.deepEqual(recovered.recoveryActions, ["QRS"]);
  const completed = submitExpeditionExchange(
    recovered,
    "QTH SUNWARD PWR 5W ANT WIRE",
    { safeToCommit: true },
    "2026-08-25T09:07:00.000Z",
  );
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.propagationSnapshot, weak.propagationSnapshot);
  assert.deepEqual(completed.contacts[0].recoveryActions, ["QRS"]);
});

test("hard-field errors recover twice and then fail closed", () => {
  let run = exchanging();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    run = submitExpeditionExchange(
      run,
      "QTH WRONG PWR 50W ANT WRONG",
      { safeToCommit: true },
      `2026-08-25T09:0${5 + attempt}:00.000Z`,
    );
    if (attempt < 3) {
      assert.equal(run.status, "recovering");
      run = requestExpeditionRecovery(run, "AGN", `2026-08-25T09:0${5 + attempt}:30.000Z`);
    }
  }
  assert.equal(run.status, "failed");
  assert.equal(run.failureReason, "EXCHANGE_RETRIES_EXHAUSTED");
  assert.equal(run.contacts.length, 0);
});

test("power and elapsed time are bounded, while timeout and abandon produce no contact", () => {
  const calling = beginExpeditionCq(ready(), { observedAt: "2026-08-25T09:04:00.000Z" });
  const timedOut = tickExpeditionRun(calling, { seconds: 5_000, transmitting: false }, "2026-08-25T10:30:00.000Z");
  assert.equal(timedOut.status, "failed");
  assert.equal(timedOut.failureReason, "TIMED_OUT");
  assert.equal(timedOut.elapsedSeconds, 900);
  assert.deepEqual(timedOut.contacts, []);

  const abandoned = abandonExpeditionRun(calling, "2026-08-25T09:05:00.000Z");
  assert.equal(abandoned.status, "abandoned");
  assert.equal(abandoned.result.outcome, "abandoned");
  assert.deepEqual(abandoned.contacts, []);
});

test("subsecond ticks accumulate exactly like one 900-second tick", () => {
  const calling = beginExpeditionCq(ready(), { observedAt: "2026-08-25T09:04:00.000Z" });
  let incremental = calling;
  for (let index = 0; index < 1_800; index += 1) {
    incremental = tickExpeditionRun(
      incremental,
      { seconds: 0.5, transmitting: false },
      "2026-08-25T09:19:00.000Z",
    );
  }
  const single = tickExpeditionRun(
    calling,
    { seconds: 900, transmitting: false },
    "2026-08-25T09:19:00.000Z",
  );
  assert.equal(incremental.status, "failed");
  assert.equal(incremental.failureReason, "TIMED_OUT");
  assert.equal(incremental.elapsedMilliseconds, 900_000);
  assert.equal(incremental.elapsedSeconds, 900);
  assert.deepEqual(incremental.power, single.power);
  assert.equal(incremental.elapsedMilliseconds, single.elapsedMilliseconds);
});

test("retry resets temporary work without duplicating the loan kit or stale propagation", () => {
  const failed = tickExpeditionRun(
    beginExpeditionCq(ready(), { observedAt: "2026-08-25T09:04:00.000Z" }),
    { seconds: 5_000 },
    "2026-08-25T10:30:00.000Z",
  );
  const retried = retryExpeditionRun(failed, {
    runId: "expedition:story-06:run-2",
    startedAt: "2026-08-25T11:00:00.000Z",
  });
  assert.equal(retried.runId, "expedition:story-06:run-2");
  assert.equal(retried.status, "setup");
  assert.equal(retried.fieldSite.id, "sunward-hill");
  assert.equal(retried.power.remainingWh, 96);
  assert.equal(retried.propagationSnapshot, null);
  assert.deepEqual(retried.contacts, []);
  assert.equal(retried.loadout.radioId, "loan-portable-cw");
});

test("hostile and legacy expedition aggregates normalize to bounded idempotent state", () => {
  const hostile = normalizeExpeditionRun({
    version: 99,
    runId: "R".repeat(10_000),
    playerCallsign: "bad!",
    status: "completed",
    contacts: Array.from({ length: 200 }, () => ({ callsign: "<script>" })),
    recoveryActions: Array(100).fill("DROP TABLE"),
    elapsedSeconds: 1e30,
    power: { capacityWh: 1e30, remainingWh: 1e30 },
  });
  assert.equal(hostile.status, "failed");
  assert.ok(hostile.runId.length <= 128);
  assert.ok(hostile.contacts.length <= 8);
  assert.ok(hostile.recoveryActions.length <= 4);
  assert.ok(hostile.elapsedSeconds <= 900);

  const legacy = normalizeExpeditionState({
    completedRuns: [{ runId: "legacy-complete", completedAt: "2025-01-01T00:00:00Z", siteId: "sunward-hill" }],
  });
  assert.deepEqual(legacy.settledRunIds, ["legacy-complete"]);
  assert.deepEqual(normalizeExpeditionState(structuredClone(legacy)), legacy);
  assert.deepEqual(emptyExpeditionState(), {
    version: 1,
    activeRun: null,
    settledRunIds: [],
    completedRuns: [],
    settledQsoProofs: [],
    expeditionTreeUnlocked: false,
  });
});

test("expedition settlement proofs are own-only, fixed-shape, bounded, and idempotent", () => {
  const valid = (index = 0) => ({
    runId: `proof-run-${index}`,
    qsoId: `expedition-qso:proof-run-${index}`,
    siteId: "sunward-hill",
    personId: "person:sora",
    stationId: "station:sim6jp",
    completedAt: "2026-08-25T09:06:00.000Z",
    playerLocationId: "expedition:sunward-hill",
    isFictional: true,
    ignored: "must not survive",
  });
  const inherited = Object.create(valid("inherited"));
  const normalized = normalizeExpeditionSettlementProofs([
    inherited,
    { ...valid(1), playerLocationId: "expedition:lakeview-hill" },
    { ...valid(2), isFictional: false },
    valid(3),
  ]);
  assert.deepEqual(normalized, [{
    runId: "proof-run-3",
    qsoId: "expedition-qso:proof-run-3",
    siteId: "sunward-hill",
    personId: "person:sora",
    stationId: "station:sim6jp",
    completedAt: "2026-08-25T09:06:00.000Z",
    playerLocationId: "expedition:sunward-hill",
    isFictional: true,
  }]);
  assert.deepEqual(normalizeExpeditionSettlementProofs(structuredClone(normalized)), normalized);

  const hostile = new Proxy(
    Array.from({ length: 10_000 }, (_, index) => valid(index)),
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded expedition proof scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const bounded = normalizeExpeditionSettlementProofs(hostile);
  assert.equal(bounded.length, MAX_EXPEDITION_SETTLED_QSO_PROOFS);
  assert.equal(bounded[0].runId, "proof-run-9920");
  assert.equal(bounded.at(-1).runId, "proof-run-9999");

  const throwing = new Proxy([valid(4)], {
    get(target, property, receiver) {
      if (property === "0") throw new Error("hostile retained proof");
      return Reflect.get(target, property, receiver);
    },
  });
  assert.deepEqual(normalizeExpeditionSettlementProofs(throwing), []);

  const state = normalizeExpeditionState({ version: 1, settledQsoProofs: hostile });
  assert.equal(state.settledQsoProofs.length, MAX_EXPEDITION_SETTLED_QSO_PROOFS);
  assert.deepEqual(normalizeExpeditionState(structuredClone(state)), state);
});

test("state normalization bounds hostile settlement-ledger scans", () => {
  const guardedLedger = new Proxy(
    Array.from({ length: 10_000 }, (_, index) => `run-${index}`),
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded settlement-ledger scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const state = normalizeExpeditionState({
    version: 1,
    settledRunIds: guardedLedger,
  });
  assert.equal(state.settledRunIds.length, 100);
  assert.equal(state.settledRunIds.at(-1), "run-9999");
});

test("run normalization bounds hostile nested topic and recovery scans", () => {
  const guardedTail = (tail) => new Proxy(
    [...Array(9_990).fill("hostile-old-value"), ...tail],
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded nested scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const normalized = normalizeExpeditionRun({
    ...completedRunFixture(),
    recoveryActions: guardedTail(["AGN", "QRS"]),
    contacts: [{
      ...completedRunFixture().contacts[0],
      topics: guardedTail(["QTH", "POWER", "ANTENNA"]),
      recoveryActions: guardedTail(["AGN", "QRS"]),
    }],
  });
  assert.deepEqual(normalized.recoveryActions, ["AGN", "QRS"]);
  assert.deepEqual(normalized.contacts[0].topics, ["QTH", "POWER", "ANTENNA"]);
  assert.deepEqual(normalized.contacts[0].recoveryActions, ["AGN", "QRS"]);
});

test("run normalization bounds hostile last-exchange error scans", () => {
  const errors = new Proxy(
    [...Array(9_990).fill("ancient-error"), ...Array(10).fill("RECENT_ERROR")],
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded last-exchange scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const normalized = normalizeExpeditionRun({
    ...completedRunFixture(),
    lastExchange: { accepted: false, errors },
  });
  assert.deepEqual(normalized.lastExchange.errors, Array(8).fill("RECENT_ERROR"));
});

function completedRunFixture() {
  return submitExpeditionExchange(
    exchanging(),
    "QTH SUNWARD PWR 5W ANT WIRE",
    { safeToCommit: true },
    "2026-08-25T09:06:00.000Z",
  );
}
