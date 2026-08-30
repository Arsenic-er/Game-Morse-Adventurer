import assert from "node:assert/strict";
import test from "node:test";

import {
  LISTENING_PHASES,
  abandonListeningRun,
  createListeningRun,
  finishListeningWait,
  normalizeListeningRun,
  observeListeningWindow,
  recordListeningSilence,
  retryListeningRun,
  submitListeningCall,
  tickListeningRun,
} from "../src/game/listeningRun.js";

const ISO = "2026-08-31T00:00:00.000Z";
const ISO1 = "2026-08-31T00:01:00.000Z";
const ISO2 = "2026-08-31T00:02:00.000Z";
const ISO3 = "2026-08-31T00:03:00.000Z";
const safeSemantic = Object.freeze({ safeToCommit: true });

function fresh() {
  return createListeningRun({ playerCallsign: "BH1ABC", seed: "story-11", startedAt: ISO });
}

function observed(run = fresh()) {
  run = observeListeningWindow(run, "2026-08-31T00:00:10.000Z");
  run = observeListeningWindow(run, "2026-08-31T00:00:20.000Z");
  return observeListeningWindow(run, "2026-08-31T00:00:30.000Z");
}

function waitedOnce(run = observed()) {
  run = submitListeningCall(run, "SIM11LS DE BH1ABC K", safeSemantic, ISO1);
  return finishListeningWait(run, ISO2);
}

test("one directed call and three listening windows can record silence", () => {
  const ready = observed();
  assert.equal(ready.phase, LISTENING_PHASES.CALL_READY);
  assert.deepEqual(ready.observedWindowIds, ["window-1", "window-2", "window-3"]);

  const completed = recordListeningSilence(waitedOnce(ready), ISO3);

  assert.equal(completed.phase, LISTENING_PHASES.COMPLETED);
  assert.equal(completed.callCount, 1);
  assert.deepEqual(completed.summary, {
    runId: completed.runId,
    playerCallsign: "BH1ABC",
    targetCallsign: "SIM11LS",
    stationId: "station:chapter11:sim11ls",
    personId: "person:chapter11:silent-listener",
    observationIds: ["window-1", "window-2", "window-3"],
    callCount: 1,
    activeMilliseconds: 0,
    conclusionKey: "chapter11.conclusion.no-reply-after-listening",
    completedAt: ISO3,
  });
  assert.equal(JSON.stringify(completed).includes("SIM11LS DE BH1ABC K"), false);
  assert.equal(JSON.stringify(completed).includes("response"), false);
});

test("a second call is tolerated but a third call fails closed", () => {
  let run = waitedOnce();
  run = submitListeningCall(run, "SIM11LS BH1ABC K", safeSemantic, ISO2);
  run = finishListeningWait(run, "2026-08-31T00:02:30.000Z");
  assert.equal(run.phase, LISTENING_PHASES.DECISION);
  assert.equal(run.callCount, 2);

  const failed = submitListeningCall(run, "SIM11LS DE BH1ABC K", safeSemantic, ISO3);
  assert.equal(failed.phase, LISTENING_PHASES.FAILED);
  assert.equal(failed.failureReason, "CALL_LIMIT_EXCEEDED");
  assert.equal(failed.callCount, 2);
});

test("hard call fields and semantic safety both gate the waiting phase", () => {
  const run = observed();
  const unsafe = submitListeningCall(run, "SIM11LS DE BH1ABC K", { safeToCommit: false }, ISO1);
  const wrongTarget = submitListeningCall(run, "SIM12CS DE BH1ABC K", safeSemantic, ISO1);
  const wrongPlayer = submitListeningCall(run, "SIM11LS DE N0BAD K", safeSemantic, ISO1);

  assert.equal(unsafe.phase, LISTENING_PHASES.CALL_READY);
  assert.deepEqual(unsafe.errors, ["SEMANTIC_UNSAFE"]);
  assert.deepEqual(wrongTarget.errors, ["TARGET_CALLSIGN_MISMATCH"]);
  assert.deepEqual(wrongPlayer.errors, ["PLAYER_CALLSIGN_MISMATCH"]);
});

test("paused ticks cost no time while ten active minutes time out", () => {
  const run = fresh();
  const paused = tickListeningRun(run, { seconds: 599, paused: true }, ISO1);
  assert.equal(paused, run);

  const almost = tickListeningRun(run, { seconds: 599.5, paused: false }, ISO1);
  assert.equal(almost.phase, LISTENING_PHASES.BRIEFING);
  assert.equal(almost.activeMilliseconds, 599_500);

  const timedOut = tickListeningRun(almost, { seconds: 0.5, paused: false }, ISO2);
  assert.equal(timedOut.phase, LISTENING_PHASES.FAILED);
  assert.equal(timedOut.failureReason, "TIMED_OUT");
});

test("abandon is terminal and retry creates a clean deterministic attempt", () => {
  const abandoned = abandonListeningRun(waitedOnce(), ISO3);
  assert.equal(abandoned.phase, LISTENING_PHASES.ABANDONED);
  assert.equal(recordListeningSilence(abandoned, ISO3), abandoned);

  const retried = retryListeningRun(abandoned, "2026-08-31T01:00:00.000Z");
  assert.equal(retried.phase, LISTENING_PHASES.BRIEFING);
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.callCount, 0);
  assert.deepEqual(retried.observedWindowIds, []);
  assert.notEqual(retried.runId, abandoned.runId);
  assert.deepEqual(retried.windows, abandoned.windows);
});

test("run normalization is own-only bounded and JSON idempotent", () => {
  const completed = recordListeningSilence(waitedOnce(), ISO3);
  assert.deepEqual(normalizeListeningRun(JSON.parse(JSON.stringify(completed))), completed);

  const inherited = Object.create(completed);
  assert.equal(normalizeListeningRun(inherited), null);

  const sparse = JSON.parse(JSON.stringify(completed));
  sparse.observedWindowIds.length = 3;
  delete sparse.observedWindowIds[1];
  assert.equal(normalizeListeningRun(sparse), null);

  let numericReads = 0;
  const huge = new Proxy(Array.from({ length: 10_000 }, (_, index) => `window-${index}`), {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property))) numericReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const hostile = { ...completed, observedWindowIds: huge };
  assert.equal(normalizeListeningRun(hostile), null);
  assert.equal(numericReads <= 3, true);
});
