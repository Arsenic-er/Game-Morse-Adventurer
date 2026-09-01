import assert from "node:assert/strict";
import test from "node:test";

import {
  NIGHT_OPERATIONS_PHASES,
  chooseNightWindow,
  createNightOperationsRun,
  normalizeNightOperationsRun,
  retryNightOperationsRun,
  submitNightExchange,
  submitNightOperationsCall,
  tickNightOperationsRun,
} from "../src/game/nightOperationsRun.js";

const STARTED = "2026-08-31T12:00:00.000Z";
const safe = Object.freeze({ safeToCommit: true });

function relationship(personId, callsign, operatorProfileId, offset) {
  const metAt = new Date(Date.parse(STARTED) - offset * 60_000).toISOString();
  return {
    personId, callsign, operatorProfileId, encounterCount: 1, completedQsos: 1,
    weakSignalRecoveries: 0, topicCounts: {}, firstMetAt: metAt, lastMetAt: metAt,
    lastEncounterId: `${callsign}:${metAt}`, lastQsoId: `qso:${callsign}`,
  };
}

function knownPeopleSave() {
  return {
    callsign: "BH1ABC",
    operatorRelationships: [
      relationship("person:sora", "SIM6JP", "fixed-sora", 1),
      relationship("person:procedural:chapter08-net-control", "SIM8NC", "chapter08-net-control", 2),
      relationship("person:procedural:chapter09-source", "SIM9CR", "chapter09-source", 3),
      relationship("person:procedural:chapter09-relay", "SIM9RL", "chapter09-relay", 4),
      relationship("person:legacy:ZZ9ZZ", "ZZ9ZZ", "legacy-standard", 5),
    ],
  };
}

function advanceTo(run, milliseconds) {
  return tickNightOperationsRun(run, { milliseconds }, new Date(Date.parse(STARTED) + milliseconds).toISOString());
}

function completeWindow(run, window) {
  if (run.activeMilliseconds < window.opensAtMilliseconds) {
    run = tickNightOperationsRun(run, { milliseconds: window.opensAtMilliseconds - run.activeMilliseconds }, STARTED);
  }
  run = chooseNightWindow(run, window.id);
  assert.equal(run.phase, NIGHT_OPERATIONS_PHASES.CALL);
  run = submitNightOperationsCall(run, `${window.callsign} DE ${run.playerCallsign} K`, safe);
  assert.equal(run.phase, NIGHT_OPERATIONS_PHASES.EXCHANGE);
  const completedAt = new Date(Date.parse(run.startedAt) + run.activeMilliseconds).toISOString();
  run = submitNightExchange(run, `${window.callsign} DE ${run.playerCallsign} 599 ${window.band} K`, safe, completedAt);
  return run;
}

test("four deterministic known targets occupy frozen non-overlapping windows and three contacts complete the night", () => {
  const first = createNightOperationsRun({ save: knownPeopleSave(), seed: "story-13", startedAt: STARTED });
  const second = createNightOperationsRun({ save: knownPeopleSave(), seed: "story-13", startedAt: STARTED });
  assert.deepEqual(second, first);
  assert.equal(first.phase, NIGHT_OPERATIONS_PHASES.BOARD);
  assert.equal(first.windows.length, 4);
  assert.equal(new Set(first.windows.map(({ personId }) => personId)).size, 4);
  assert.deepEqual(new Set(first.windows.map(({ band }) => band)), new Set(["40M", "20M", "15M"]));
  for (let index = 1; index < first.windows.length; index += 1) {
    assert.ok(first.windows[index - 1].closesAtMilliseconds <= first.windows[index].opensAtMilliseconds);
  }
  assert.ok(first.windows.every(({ personId }) => personId !== "person:legacy:ZZ9ZZ"));

  let run = first;
  for (const window of first.windows.slice(0, 3)) run = completeWindow(run, window);
  assert.equal(run.phase, NIGHT_OPERATIONS_PHASES.COMPLETED);
  assert.equal(run.contacts.length, 3);
  assert.equal(new Set(run.contacts.map(({ personId }) => personId)).size, 3);
  assert.equal(new Set(run.contacts.map(({ windowId }) => windowId)).size, 3);
  assert.equal(run.summary.contactIds.length, 3);
});

test("stable story fallbacks fill missing known relationships without rerolling the seed", () => {
  const run = createNightOperationsRun({ save: { callsign: "BH1ABC", operatorRelationships: [] }, seed: "fallback", startedAt: STARTED });
  assert.equal(run.windows.length, 4);
  assert.equal(new Set(run.windows.map(({ personId }) => personId)).size, 4);
  assert.ok(run.windows.every(({ personId, stationId, callsign }) => personId && stationId && callsign));
  assert.deepEqual(createNightOperationsRun({ save: { callsign: "BH1ABC" }, seed: "fallback", startedAt: STARTED }).windows, run.windows);
});

test("closed, overlapping, duplicate, unsafe, and malformed work never advances", () => {
  let run = createNightOperationsRun({ save: knownPeopleSave(), seed: "reject", startedAt: STARTED });
  assert.strictEqual(chooseNightWindow(run, run.windows[0].id), run, "not open yet");
  run = advanceTo(run, run.windows[0].opensAtMilliseconds);
  const selected = chooseNightWindow(run, run.windows[0].id);
  assert.strictEqual(chooseNightWindow(selected, run.windows[1].id), selected, "cannot overlap an active contact");
  assert.strictEqual(submitNightOperationsCall(selected, `${run.windows[0].callsign} DE BH1ABC K`, null), selected);
  assert.strictEqual(submitNightOperationsCall(selected, "SIMBAD DE BH1ABC K", safe), selected);
  const exchange = submitNightOperationsCall(selected, `${run.windows[0].callsign} DE BH1ABC K`, safe);
  assert.strictEqual(submitNightExchange(exchange, `${run.windows[0].callsign} DE BH1ABC 599 80M K`, safe, STARTED), exchange);
  const contactedAt = new Date(Date.parse(exchange.startedAt) + exchange.activeMilliseconds).toISOString();
  const contacted = submitNightExchange(exchange, `${run.windows[0].callsign} DE BH1ABC 599 ${run.windows[0].band} K`, safe, contactedAt);
  assert.strictEqual(chooseNightWindow(contacted, run.windows[0].id), contacted, "same person/window cannot be reused");
  const closed = advanceTo(contacted, run.windows[1].closesAtMilliseconds + 1);
  assert.strictEqual(chooseNightWindow(closed, run.windows[1].id), closed);
});

test("only active monotonic ticks consume windows; missing two contacts fails", () => {
  let run = createNightOperationsRun({ save: knownPeopleSave(), seed: "clock", startedAt: STARTED });
  assert.strictEqual(tickNightOperationsRun(run, { milliseconds: 0 }, STARTED), run);
  assert.strictEqual(tickNightOperationsRun(run, { milliseconds: -1 }, STARTED), run);
  run = tickNightOperationsRun(run, { milliseconds: run.windows[1].closesAtMilliseconds + 1 }, STARTED);
  assert.equal(run.activeMilliseconds, run.windows[1].closesAtMilliseconds + 1);
  assert.deepEqual(run.missedWindowIds, [run.windows[0].id, run.windows[1].id]);
  assert.equal(run.phase, NIGHT_OPERATIONS_PHASES.FAILED);
  assert.equal(run.failureReason, "MISSED_TWO_CONTACTS");
});

test("fractional browser clock samples advance the integer night schedule", () => {
  const run = createNightOperationsRun({ save: knownPeopleSave(), seed: "fractional-clock", startedAt: STARTED });
  const advanced = tickNightOperationsRun(run, { milliseconds: 250.4 }, STARTED);
  assert.notStrictEqual(advanced, run);
  assert.equal(advanced.activeMilliseconds, 250);
  assert.equal(advanced.phase, NIGHT_OPERATIONS_PHASES.BOARD);
});

test("retry preserves the frozen schedule but clears attempt work", () => {
  let run = createNightOperationsRun({ save: knownPeopleSave(), seed: "retry", startedAt: STARTED });
  run = advanceTo(run, run.windows[0].opensAtMilliseconds);
  run = completeWindow(run, run.windows[0]);
  run = advanceTo(run, run.windows[2].closesAtMilliseconds + 1);
  assert.equal(run.phase, NIGHT_OPERATIONS_PHASES.FAILED);
  const retried = retryNightOperationsRun(run, "2026-08-31T13:00:00.000Z");
  assert.deepEqual(retried.windows, run.windows);
  assert.equal(retried.seed, run.seed);
  assert.equal(retried.retryCount, 1);
  assert.deepEqual(retried.contacts, []);
  assert.deepEqual(retried.missedWindowIds, []);
  assert.equal(retried.activeMilliseconds, 0);
  assert.equal(retried.phase, NIGHT_OPERATIONS_PHASES.BOARD);
});

test("normalization is JSON-idempotent and fails closed on hostile, sparse, or overlapping data", () => {
  let run = createNightOperationsRun({ save: knownPeopleSave(), seed: "normalize", startedAt: STARTED });
  run = advanceTo(run, run.windows[0].opensAtMilliseconds);
  run = completeWindow(run, run.windows[0]);
  const once = normalizeNightOperationsRun(JSON.parse(JSON.stringify(run)));
  const twice = normalizeNightOperationsRun(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(normalizeNightOperationsRun({ ...run, windows: [, ...run.windows.slice(1)] }), null);
  assert.equal(normalizeNightOperationsRun({ ...run, windows: run.windows.map((window, index) => index === 1 ? { ...window, opensAtMilliseconds: 0 } : window) }), null);
  assert.equal(normalizeNightOperationsRun({ ...run, windows: run.windows.map((window, index) => index === 1 ? { ...window, personId: run.windows[0].personId } : window) }), null);
  const pristine = createNightOperationsRun({ save: knownPeopleSave(), seed: "normalize", startedAt: STARTED });
  const forgedIdentity = {
    ...pristine.windows[0], callsign: "SIM12CS", npcId: "chapter12-control",
    personId: "person:procedural:chapter12-control", stationId: "station:procedural:chapter12-control",
  };
  assert.equal(normalizeNightOperationsRun({ ...pristine, windows: [forgedIdentity, ...pristine.windows.slice(1)] }), null);
  const alternateBand = pristine.windows[0].band === "40M" ? "20M" : "40M";
  assert.equal(normalizeNightOperationsRun({ ...pristine, windows: [{ ...pristine.windows[0], band: alternateBand }, ...pristine.windows.slice(1)] }), null);
  assert.equal(normalizeNightOperationsRun({ ...run, seed: "x".repeat(10_000) }), null);
});
