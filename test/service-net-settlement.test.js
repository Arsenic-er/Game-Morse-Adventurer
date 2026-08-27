import assert from "node:assert/strict";
import test from "node:test";

import {
  beginServiceNetRun, createServiceNetRun, normalizeServiceNetState,
  receiveServiceNetMessage, submitServiceNetText,
} from "../src/game/serviceNetRun.js";
import { settleServiceNetRun } from "../src/game/serviceNetSettlement.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const STARTED_AT = "2026-08-28T10:00:00.000Z";
const SETTLED_AT = "2026-08-28T10:05:00.000Z";
const safeSemantic = () => ({ safeToCommit: true });

function completedRun(seed = "settlement") {
  let run = beginServiceNetRun(createServiceNetRun({ playerCallsign: "BH1ABC", seed, startedAt: STARTED_AT }));
  run = submitServiceNetText(run, "BH1ABC CHECK IN K", safeSemantic(), "2026-08-28T10:00:10.000Z");
  for (let index = 0; index < 3; index += 1) {
    run = receiveServiceNetMessage(run, `2026-08-28T10:0${index + 1}:00.000Z`);
    const message = run.messages[run.priorityOrder[run.currentPosition]];
    run = submitServiceNetText(
      run,
      `ACK ${message.messageId} PRI ${message.priority} K`,
      safeSemantic(),
      `2026-08-28T10:0${index + 1}:10.000Z`,
    );
  }
  return run;
}

function readySave(run = completedRun()) {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    money: 400,
    technologyPoints: 9,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter08: normalizeServiceNetState({ activeRun: run }),
    }),
  };
}

test("service-net settlement atomically links three receipts, event QSO, relationship, and settled id", () => {
  const run = completedRun();
  const initial = readySave(run);
  const result = settleServiceNetRun(initial, run, SETTLED_AT);
  assert.equal(result.settled, true);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.equal(result.save.money, 400);
  assert.equal(result.save.technologyPoints, 9);
  const chapter = result.save.storyContinuationState.chapter08;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.equal(chapter.receipts.length, 3);
  assert.deepEqual(chapter.receipts.map(({ messageId, priority }) => ({ messageId, priority })),
    run.receipts.map(({ messageId, priority }) => ({ messageId, priority })));
  const log = result.save.qsoLogs.find(({ id }) => id === result.qsoId);
  assert.equal(log.eventKind, "service-net");
  assert.equal(log.eventRunId, run.runId);
  assert.equal(log.personId, "person:procedural:chapter08-net-control");
  assert.equal(log.stationId, "station:procedural:chapter08-net-control");
  assert.equal(log.credits, 0);
  assert.equal(result.save.qsoRecords.total, 1);
  const relationship = result.save.operatorRelationships.find(({ personId }) => personId === log.personId);
  assert.equal(relationship.completedQsos, 1);
  assert.equal(relationship.lastQsoId, result.qsoId);

  const duplicate = settleServiceNetRun(result.save, run, "2026-08-28T10:06:00.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("service settlement rejects partial, mismatched, forged, inherited, and early evidence", () => {
  const run = completedRun();
  const valid = readySave(run);
  const candidates = [
    [{ ...run, phase: "PLAYER_ACK", completedAt: null, receipts: run.receipts.slice(0, 2), currentPosition: 2 }, "RUN_NOT_COMPLETED"],
    [{ ...run, runId: "service-net:forged" }, "RUN_NOT_COMPLETED"],
    [Object.create(run), "RUN_NOT_COMPLETED"],
  ];
  for (const [candidate, reason] of candidates) {
    const result = settleServiceNetRun(valid, candidate, SETTLED_AT);
    assert.equal(result.reason, reason);
    assert.strictEqual(result.save, valid);
  }
  const missingActive = {
    ...valid,
    storyContinuationState: normalizeStoryContinuationState({
      ...valid.storyContinuationState,
      chapter08: normalizeServiceNetState({}),
    }),
  };
  assert.equal(settleServiceNetRun(missingActive, run, SETTLED_AT).reason, "RUN_STATE_MISMATCH");
  assert.equal(settleServiceNetRun(valid, run, "2026-08-28T10:03:09.999Z").reason, "INVALID_SETTLEMENT_TIME");
});

test("service state survives two JSON normalizations without inventing rewards", () => {
  const run = completedRun();
  const result = settleServiceNetRun(readySave(run), run, SETTLED_AT);
  const once = normalizeStoryContinuationState(JSON.parse(JSON.stringify(result.save.storyContinuationState)));
  const twice = normalizeStoryContinuationState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(result.save.money, 400);
  assert.equal(result.save.technologyPoints, 9);
  const saveOnce = normalizeSave(JSON.parse(JSON.stringify(result.save)));
  const saveTwice = normalizeSave(JSON.parse(JSON.stringify(saveOnce)));
  assert.deepEqual(saveTwice, saveOnce);
  assert.equal(saveTwice.money, 400);
  assert.equal(saveTwice.technologyPoints, 9);
  assert.equal(saveTwice.qsoLogs.length, 1);
});
