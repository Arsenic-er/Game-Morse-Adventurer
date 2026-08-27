import assert from "node:assert/strict";
import test from "node:test";

import { createQslRecord } from "../src/game/qslRecords.js";
import {
  confirmQslStoryChoice,
  createQslStoryRun,
  normalizeQslStoryState,
  receiveQslClarification,
  reviewQslAccounts,
  submitQslClarification,
} from "../src/game/qslStoryRun.js";
import { settleQslStoryRun } from "../src/game/qslStorySettlement.js";
import { createSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";
import { normalizeExpeditionState } from "../src/game/expeditionRun.js";
import { normalizeQsoLogEntry, normalizeQsoRecords } from "../src/qso/qsoLog.js";
import { recordCompletedOperatorRelationship } from "../src/qso/operatorRelationships.js";

const STARTED_AT = "2026-08-28T00:00:00.000Z";
const COMPLETED_AT = "2026-08-28T00:04:00.000Z";
const SETTLED_AT = "2026-08-28T00:05:00.000Z";

function sourceQsl() {
  return createQslRecord({
    id: "qsl:expedition:hill-1",
    personId: "person:sora",
    stationId: "station:sim6jp",
    callsign: "SIM6JP",
    qsoId: "expedition-qso:hill-1",
    eventRunId: "hill-1",
    playerNarrativeKey: "qsl.player.hill-signal",
    operatorNarrativeKey: "qsl.operator.sora-hill-reply",
    createdAt: "2026-08-27T23:00:00.000Z",
    choice: "believe",
    confirmedAt: "2026-08-27T23:01:00.000Z",
  });
}

function sourceExpeditionLog() {
  return normalizeQsoLogEntry({
    id: "expedition-qso:hill-1",
    startedAt: "2026-08-27T22:55:00.000Z",
    completedAt: "2026-08-27T23:00:00.000Z",
    playerCallsign: "BH1ABC",
    callsign: "SIM6JP",
    personId: "person:sora",
    stationId: "station:sim6jp",
    sent: "599",
    received: "599",
    location: "JP",
    playerLocationId: "expedition:sunward-hill",
    expeditionRunId: "hill-1",
    expeditionSiteId: "sunward-hill",
    isFictional: true,
  });
}

function sourceExpeditionState() {
  return normalizeExpeditionState({
    completedRuns: [{
      runId: "hill-1",
      completedAt: "2026-08-27T23:00:00.000Z",
      siteId: "sunward-hill",
      qsoId: "expedition-qso:hill-1",
      personId: "person:sora",
      stationId: "station:sim6jp",
    }],
    settledRunIds: ["hill-1"],
    settledQsoProofs: [{
      runId: "hill-1",
      qsoId: "expedition-qso:hill-1",
      siteId: "sunward-hill",
      personId: "person:sora",
      stationId: "station:sim6jp",
      completedAt: "2026-08-27T23:00:00.000Z",
      playerLocationId: "expedition:sunward-hill",
      isFictional: true,
    }],
  });
}

function completedRun() {
  let run = createQslStoryRun({ sourceQsl: sourceQsl(), playerCallsign: "BH1ABC", startedAt: STARTED_AT });
  run = reviewQslAccounts(run);
  run = submitQslClarification(run, "QSL HILL-1 DE BH1ABC PSE K", { safeToCommit: true }, "2026-08-28T00:01:00.000Z");
  run = receiveQslClarification(run, "2026-08-28T00:02:00.000Z");
  return confirmQslStoryChoice(run, "request-review", COMPLETED_AT);
}

function readySave(run = completedRun()) {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  const sourceLog = sourceExpeditionLog();
  return {
    ...save,
    money: 1234,
    technologyPoints: 7,
    qslRecords: [sourceQsl()],
    expeditionState: sourceExpeditionState(),
    qsoLogs: [sourceLog],
    qsoRecords: normalizeQsoRecords(null, [sourceLog]),
    operatorRelationships: recordCompletedOperatorRelationship([], sourceLog),
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter07: normalizeQslStoryState({ activeRun: run, cases: [], settledRunIds: [] }),
    }),
  };
}

test("QSL story settlement writes linked case, event QSO, relationship, and settled id once", () => {
  const run = completedRun();
  const initial = readySave(run);
  const first = settleQslStoryRun(initial, run, SETTLED_AT);

  assert.equal(first.settled, true);
  assert.equal(first.reason, null);
  assert.equal(first.moneyAwarded, 0);
  assert.equal(first.technologyPointsAwarded, 0);
  assert.equal(first.save.money, 1234);
  assert.equal(first.save.technologyPoints, 7);
  assert.equal(first.save.qsoLogs.length, 2);
  const storyLog = first.save.qsoLogs.find(({ id }) => id === first.qsoId);
  assert.equal(storyLog.eventKind, "qsl-story");
  assert.equal(storyLog.eventRunId, run.runId);
  assert.equal(storyLog.personId, "person:sora");
  assert.equal(storyLog.stationId, "station:sim6jp");
  assert.equal(storyLog.credits, 0);
  assert.equal(storyLog.rewardBreakdown, null);
  assert.equal(first.save.qsoRecords.total, 2);
  assert.ok(first.save.qsoRecords.settledQsoIds.includes(first.qsoId));
  const relationship = first.save.operatorRelationships.find(({ personId }) => personId === "person:sora");
  assert.equal(relationship.completedQsos, 2);
  assert.equal(relationship.lastQsoId, first.qsoId);
  assert.equal(first.save.storyContinuationState.chapter07.activeRun, null);
  assert.deepEqual(first.save.storyContinuationState.chapter07.settledRunIds, [run.runId]);
  assert.equal(first.save.storyContinuationState.chapter07.cases[0].runId, run.runId);
  assert.equal(first.save.storyContinuationState.chapter07.cases[0].initialChoice, "believe");
  assert.equal(first.save.storyContinuationState.chapter07.cases[0].finalChoice, "request-review");

  const duplicate = settleQslStoryRun(first.save, run, "2026-08-28T00:06:00.000Z");
  assert.equal(duplicate.settled, false);
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, first.save);
  assert.equal(duplicate.moneyAwarded, 0);
});

test("settlement rejects missing source, mismatched active run, player identity, and chronology", () => {
  const run = completedRun();
  const valid = readySave(run);
  const cases = [
    [{ ...valid, qslRecords: [] }, "SOURCE_QSL_MISSING"],
    [{ ...valid, expeditionState: normalizeExpeditionState({}) }, "SOURCE_QSL_UNVERIFIED"],
    [{ ...valid, qsoLogs: valid.qsoLogs.filter(({ id }) => id !== "expedition-qso:hill-1") }, "SOURCE_QSL_UNVERIFIED"],
    [{ ...valid, callsign: "JA1OTHER" }, "RUN_STATE_MISMATCH"],
    [{ ...valid, storyContinuationState: normalizeStoryContinuationState(valid.storyContinuationState) }, null],
  ];
  cases[4][0] = {
    ...valid,
    storyContinuationState: normalizeStoryContinuationState({
      ...valid.storyContinuationState,
      chapter07: { activeRun: null, cases: [], settledRunIds: [] },
    }),
  };
  cases[4][1] = "RUN_STATE_MISMATCH";

  for (const [save, reason] of cases) {
    const result = settleQslStoryRun(save, run, SETTLED_AT);
    assert.equal(result.settled, false, reason);
    assert.equal(result.reason, reason);
    assert.strictEqual(result.save, save);
  }
  const early = settleQslStoryRun(valid, run, "2026-08-28T00:03:59.999Z");
  assert.equal(early.reason, "INVALID_SETTLEMENT_TIME");
});

test("failed, abandoned, forged, inherited, and accessor-tainted runs grant nothing", () => {
  const run = completedRun();
  const valid = readySave(run);
  for (const candidate of [
    { ...run, phase: "FAILED", finalChoice: null, errors: ["FORMAT_INVALID", "FORMAT_INVALID", "FORMAT_INVALID"] },
    { ...run, phase: "ABANDONED", finalChoice: null },
    { ...run, runId: "qsl-story:forged" },
    Object.create(run),
  ]) {
    const result = settleQslStoryRun(valid, candidate, SETTLED_AT);
    assert.equal(result.settled, false);
    assert.strictEqual(result.save, valid);
  }

  let getterCalls = 0;
  const accessor = { ...run };
  Object.defineProperty(accessor, "runId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return run.runId;
    },
  });
  assert.equal(settleQslStoryRun(valid, accessor, SETTLED_AT).settled, false);
  assert.equal(getterCalls, 0);
});
