import assert from "node:assert/strict";
import test from "node:test";

import {
  STORM_RELAY_PHASES, abandonStormRelayRun, createStormRelayRun,
  normalizeStormRelayRun, receiveStormConflict, repeatStormMessage,
  requestStormVerification, retryStormRelayRun, stormPacketText,
  submitStormCheckIn, submitStormRelay, tickStormRelayRun,
} from "../src/game/stormRelayRun.js";

const START = "2026-08-31T01:00:00.000Z";
const at = (seconds) => new Date(Date.parse(START) + seconds * 1_000).toISOString();
const safe = Object.freeze({ safeToCommit: true });

function fresh(seed = "story-12") {
  return createStormRelayRun({ playerCallsign: "BH1ABC", seed, startedAt: START });
}

function conflict(run = fresh()) {
  run = submitStormCheckIn(run, "SIM12CS DE BH1ABC QTC K", safe, at(10));
  return receiveStormConflict(run, at(20));
}

test("source verification exposes the canonical revision-two packet", () => {
  let run = conflict();
  assert.equal(run.phase, STORM_RELAY_PHASES.CONFLICT);
  assert.equal(run.verifiedPacketId, null);
  assert.equal(run.packets.filter(({ revision }) => revision === 1).length, 2);

  const revisionOne = stormPacketText(run.packets[0]);
  run = submitStormRelay(run, revisionOne, safe, at(30));
  assert.equal(run.phase, STORM_RELAY_PHASES.CONFLICT);
  assert.deepEqual(run.errors, ["SOURCE_NOT_VERIFIED"]);

  run = requestStormVerification(run, "AGN MSG 214 REV K", safe, at(40));
  assert.equal(run.phase, STORM_RELAY_PHASES.RELAY);
  assert.equal(run.verifiedPacketId, "storm-214-r2");
  const canonical = run.packets.find(({ id }) => id === run.verifiedPacketId);
  run = submitStormRelay(run, stormPacketText(canonical), safe, at(50));

  assert.equal(run.phase, STORM_RELAY_PHASES.COMPLETED);
  assert.deepEqual(run.summary, {
    runId: run.runId,
    playerCallsign: "BH1ABC",
    controlPersonId: "person:chapter12:control",
    controlStationId: "station:chapter12:sim12cs",
    relayPersonId: "person:chapter12:relay",
    relayStationId: "station:chapter12:sim12rl",
    canonicalPacketId: "storm-214-r2",
    msgId: "214",
    revision: 2,
    grid: "PX-31",
    people: 8,
    item: "WATER",
    quantity: 6,
    check: canonical.check,
    verificationRequested: true,
    recoveryActions: [],
    activeMilliseconds: 0,
    completedAt: at(50),
    isFictional: true,
  });
  assert.equal(JSON.stringify(run).includes(revisionOne), false);
});

test("hard fields, revision precedence, and semantic safety fail closed", () => {
  const run = conflict();
  assert.deepEqual(
    requestStormVerification(run, "AGN MSG 999 REV K", safe, at(30)).errors,
    ["MESSAGE_ID_MISMATCH"],
  );
  assert.deepEqual(
    requestStormVerification(run, "AGN MSG 214 REV K", { safeToCommit: false }, at(30)).errors,
    ["SEMANTIC_UNSAFE"],
  );
  const verified = requestStormVerification(run, "AGN MSG 214 REV K", safe, at(30));
  const canonical = verified.packets.find(({ id }) => id === verified.verifiedPacketId);
  const wrongGrid = stormPacketText({ ...canonical, grid: "PX-99" });
  const wrongCheck = stormPacketText({ ...canonical, check: "00" });
  assert.deepEqual(submitStormRelay(verified, wrongGrid, safe, at(40)).errors, ["GRID_MISMATCH"]);
  assert.deepEqual(submitStormRelay(verified, wrongCheck, safe, at(40)).errors, ["CHECK_MISMATCH"]);
  assert.deepEqual(submitStormRelay(verified, stormPacketText(canonical), { safeToCommit: false }, at(40)).errors, ["SEMANTIC_UNSAFE"]);
});

test("a third invalid relay ends the attempt without changing the canonical packet", () => {
  let run = requestStormVerification(conflict(), "AGN MSG 214 REV K", safe, at(30));
  const canonical = run.packets.find(({ id }) => id === run.verifiedPacketId);
  for (let index = 0; index < 3; index += 1) {
    run = submitStormRelay(run, stormPacketText({ ...canonical, people: 7 }), safe, at(40 + index));
  }
  assert.equal(run.phase, STORM_RELAY_PHASES.FAILED);
  assert.equal(run.failureReason, "RELAY_ERROR_LIMIT");
  assert.equal(run.badRelayCount, 3);
  assert.equal(run.packets.find(({ id }) => id === "storm-214-r2").people, 8);
});

test("AGN and QRS repeat fixed traffic without rerolling packets", () => {
  const run = conflict();
  const packets = run.packets;
  const agn = repeatStormMessage(run, "AGN MSG 214 K", safe, at(30));
  const qrs = repeatStormMessage(agn, "QRS MSG 214 K", safe, at(40));
  assert.deepEqual(qrs.packets, packets);
  assert.deepEqual(qrs.recoveryActions, ["AGN", "QRS"]);
  assert.equal(qrs.phase, STORM_RELAY_PHASES.CONFLICT);
});

test("paused time is free, timeout and abandon are terminal, and retry is clean", () => {
  const run = fresh("storm-retry");
  assert.equal(tickStormRelayRun(run, { seconds: 719, paused: true }, at(10)), run);
  const almost = tickStormRelayRun(run, { seconds: 719.5, paused: false }, at(10));
  assert.equal(almost.activeMilliseconds, 719_500);
  const timedOut = tickStormRelayRun(almost, { seconds: 0.5, paused: false }, at(20));
  assert.equal(timedOut.failureReason, "TIMED_OUT");
  assert.equal(timedOut.phase, STORM_RELAY_PHASES.FAILED);

  const abandoned = abandonStormRelayRun(conflict(fresh("storm-abandon")), at(50));
  assert.equal(abandoned.phase, STORM_RELAY_PHASES.ABANDONED);
  const retried = retryStormRelayRun(abandoned, at(60));
  assert.equal(retried.phase, STORM_RELAY_PHASES.CHECK_IN);
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.badRelayCount, 0);
  assert.deepEqual(retried.recoveryActions, []);
  assert.deepEqual(retried.packets, abandoned.packets);
  assert.notEqual(retried.runId, abandoned.runId);
});

test("storm run normalization is own-only, bounded, and JSON idempotent", () => {
  let completed = conflict(fresh("storm-normalize"));
  completed = requestStormVerification(completed, "AGN MSG 214 REV K", safe, at(30));
  completed = submitStormRelay(
    completed,
    stormPacketText(completed.packets.find(({ id }) => id === completed.verifiedPacketId)),
    safe,
    at(40),
  );
  assert.deepEqual(normalizeStormRelayRun(JSON.parse(JSON.stringify(completed))), completed);
  assert.equal(normalizeStormRelayRun(Object.create(completed)), null);
  const sparse = JSON.parse(JSON.stringify(completed));
  delete sparse.packets[1];
  assert.equal(normalizeStormRelayRun(sparse), null);

  let numericReads = 0;
  const huge = new Proxy(Array.from({ length: 10_000 }, () => "AGN"), {
    get(target, property, receiver) {
      if (/^\d+$/u.test(String(property))) numericReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.equal(normalizeStormRelayRun({ ...completed, recoveryActions: huge }), null);
  assert.equal(numericReads <= 3, true);
});
