import assert from "node:assert/strict";
import test from "node:test";

import {
  SERVICE_NET_PHASES,
  abandonServiceNetRun,
  beginServiceNetRun,
  createServiceNetRun,
  emptyServiceNetState,
  normalizeServiceNetRun,
  normalizeServiceNetState,
  receiveServiceNetMessage,
  retryServiceNetRun,
  serviceNetMessageText,
  submitServiceNetText,
  tickServiceNetRun,
} from "../src/game/serviceNetRun.js";

const ISO = "2026-08-28T10:00:00.000Z";
const ISO2 = "2026-08-28T10:00:10.000Z";
const ISO3 = "2026-08-28T10:00:20.000Z";
const safeSemantic = () => ({ safeToCommit: true });

function checkedIn(seed = "story-08") {
  let run = beginServiceNetRun(createServiceNetRun({ playerCallsign: "BH1ABC", seed, startedAt: ISO }));
  run = submitServiceNetText(run, "BH1ABC CHECK IN K", safeSemantic(), ISO2);
  return run;
}

function acknowledgeCurrent(run, at = ISO3) {
  const receiving = receiveServiceNetMessage(run, at);
  const message = receiving.messages[receiving.priorityOrder[receiving.currentPosition]];
  return submitServiceNetText(receiving, `ACK ${message.messageId} PRI ${message.priority} K`, safeSemantic(), at);
}

test("service messages are frozen and acknowledged in priority order", () => {
  const first = createServiceNetRun({ playerCallsign: "BH1ABC", seed: "story-08", startedAt: ISO });
  const second = createServiceNetRun({ playerCallsign: "BH1ABC", seed: "story-08", startedAt: ISO });
  assert.deepEqual(first, second);
  assert.equal(first.phase, SERVICE_NET_PHASES.BRIEFING);
  assert.equal(first.callsign, "SIM8PS");
  assert.equal(first.npcId, "chapter08-net-control");
  assert.equal(first.simulation, "fictional-public-service");
  assert.equal(first.messages.length, 3);
  assert.deepEqual([...first.priorityOrder].sort((a, b) => {
    const left = first.messages[a];
    const right = first.messages[b];
    return left.priority - right.priority || left.sequence - right.sequence;
  }), [...first.priorityOrder]);
  for (const message of first.messages) {
    assert.match(serviceNetMessageText(message), /^MSG \d{3} PRI [123] PEOPLE \d{1,2} ITEM (WATER|POWER|MEDKIT|SHELTER) QTY \d{1,2}$/);
    assert.doesNotMatch(JSON.stringify(message), /911|112|POLICE|FIRE|HOSPITAL|EMERGENCY/i);
  }

  let run = checkedIn();
  assert.equal(run.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  const firstMessage = run.messages[run.priorityOrder[0]];
  run = acknowledgeCurrent(run);
  assert.equal(run.receipts[0].messageId, firstMessage.messageId);
  assert.equal(run.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  run = acknowledgeCurrent(run, "2026-08-28T10:00:30.000Z");
  run = acknowledgeCurrent(run, "2026-08-28T10:00:40.000Z");
  assert.equal(run.phase, SERVICE_NET_PHASES.COMPLETED);
  assert.equal(run.receipts.length, 3);
});

test("check-in and acknowledgements require exact deterministic hard fields", () => {
  let briefing = beginServiceNetRun(createServiceNetRun({ playerCallsign: "BH1ABC", seed: "fields", startedAt: ISO }));
  const wrongCall = submitServiceNetText(briefing, "SIM8PS CHECK IN K", safeSemantic(), ISO2);
  assert.equal(wrongCall.phase, SERVICE_NET_PHASES.CHECK_IN);
  assert.equal(wrongCall.errors.at(-1), "CALLSIGN_MISMATCH");
  const unsafe = submitServiceNetText(briefing, "BH1ABC CHECK IN K", { safeToCommit: false }, ISO2);
  assert.equal(unsafe.errors.at(-1), "SEMANTIC_UNSAFE");

  let run = receiveServiceNetMessage(checkedIn("fields"), ISO3);
  const current = run.messages[run.priorityOrder[0]];
  const wrongId = submitServiceNetText(run, `ACK 999 PRI ${current.priority} K`, safeSemantic(), ISO3);
  assert.equal(wrongId.errors.at(-1), "MESSAGE_ID_MISMATCH");
  const wrongPriority = submitServiceNetText(run, `ACK ${current.messageId} PRI ${current.priority === 1 ? 2 : 1} K`, safeSemantic(), ISO3);
  assert.equal(wrongPriority.errors.at(-1), "PRIORITY_MISMATCH");
  const later = run.messages[run.priorityOrder[1]];
  const outOfOrder = submitServiceNetText(run, `ACK ${later.messageId} PRI ${later.priority} K`, safeSemantic(), ISO3);
  assert.equal(outOfOrder.errors.at(-1), "OUT_OF_ORDER");
  assert.equal(outOfOrder.receipts.length, 0);
});

test("exact AGN and QRS replay the same message even when the model cannot approve procedure-only text", () => {
  let run = receiveServiceNetMessage(checkedIn("recovery"), ISO3);
  const order = run.priorityOrder;
  run = submitServiceNetText(run, "QRS K", { safeToCommit: false }, ISO3);
  assert.equal(run.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  assert.deepEqual(run.priorityOrder, order);
  assert.equal(run.currentPosition, 0);
  assert.equal(run.receipts.length, 0);
  assert.equal(run.replyWpm, 13);
  run = receiveServiceNetMessage(run, "2026-08-28T10:00:30.000Z");
  run = submitServiceNetText(run, "AGN K", { safeToCommit: false }, "2026-08-28T10:00:31.000Z");
  assert.equal(run.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  assert.deepEqual(run.recoveryActions, ["QRS", "AGN"]);
});

test("a third bad acknowledgement fails and retry preserves the frozen schedule", () => {
  let run = receiveServiceNetMessage(checkedIn("retry"), ISO3);
  for (let index = 0; index < 3; index += 1) {
    run = submitServiceNetText(run, "ACK 999 PRI 3 K", safeSemantic(), `2026-08-28T10:00:${21 + index}.000Z`);
  }
  assert.equal(run.phase, SERVICE_NET_PHASES.FAILED);
  assert.equal(run.currentMessageErrors, 3);
  const retry = retryServiceNetRun(run, "2026-08-28T10:01:00.000Z");
  assert.equal(retry.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  assert.deepEqual(retry.messages, run.messages);
  assert.deepEqual(retry.priorityOrder, run.priorityOrder);
  assert.equal(retry.receipts.length, 0);
  assert.equal(retry.retryCount, 1);
});

test("pause freezes the service timer while active time can fail closed", () => {
  const run = checkedIn("timer");
  assert.strictEqual(tickServiceNetRun(run, { seconds: 30, paused: true }, ISO3), run);
  const advanced = tickServiceNetRun(run, { seconds: 30, paused: false }, ISO3);
  assert.equal(advanced.elapsedMilliseconds, 30_000);
  const timedOut = tickServiceNetRun(advanced, { seconds: 600, paused: false }, "2026-08-28T10:11:00.000Z");
  assert.equal(timedOut.phase, SERVICE_NET_PHASES.FAILED);
  assert.equal(timedOut.failureReason, "TIMED_OUT");
});

test("abandon and retry remain bounded terminal transitions", () => {
  const run = checkedIn("abandon");
  const abandoned = abandonServiceNetRun(run, ISO3);
  assert.equal(abandoned.phase, SERVICE_NET_PHASES.ABANDONED);
  const retry = retryServiceNetRun(abandoned, "2026-08-28T10:02:00.000Z");
  assert.equal(retry.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
  assert.notEqual(retry.runId, abandoned.runId);
});

test("hostile runs and ledgers fail closed and normalization is idempotent", () => {
  const run = checkedIn("normalize");
  assert.deepEqual(normalizeServiceNetRun(JSON.parse(JSON.stringify(run))), run);
  const sparse = [];
  sparse.length = 2;
  sparse[1] = { id: "receipt:one", runId: "service-net:one", qsoId: "service-net-qso:one", completedAt: ISO3 };
  assert.deepEqual(normalizeServiceNetState({ receipts: sparse }), emptyServiceNetState());
  const accessor = [];
  Object.defineProperty(accessor, 0, { get() { throw new Error("must not read"); }, enumerable: true });
  assert.doesNotThrow(() => normalizeServiceNetState({ receipts: accessor }));
  assert.deepEqual(normalizeServiceNetState({ receipts: accessor }), emptyServiceNetState());
  assert.equal(normalizeServiceNetRun({ ...run, messages: Array(10_000).fill(run.messages[0]) }), null);
});
