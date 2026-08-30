import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseFinalPromiseTone, createFinalPromiseRun, finalPromiseCallText,
  finalPromiseMessageText, receiveFinalPromiseAccount, reviewFinalPromise,
  submitFinalPromiseCall, submitFinalPromiseMessage,
} from "../src/game/finalPromiseRun.js";
import { settleFinalPromiseRun, verifiedFinalPromiseCompletion } from "../src/game/finalPromiseSettlement.js";
import { acceptMission, claimMission, emptyMissionState, missionBoard } from "../src/game/missionSystem.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const START = "2026-08-31T14:00:00.000Z";
const safe = Object.freeze({ safeToCommit: true });
const STORY_THIRTEEN = Object.freeze(Array.from({ length: 13 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`));

function sourceQsl() {
  return {
    version: 1, id: "qsl:expedition:chapter14-source", personId: "person:sora",
    stationId: "station:sim6jp", callsign: "SIM6JP", qsoId: "expedition-qso:source",
    eventRunId: "expedition:source", playerNarrativeKey: "qsl.player.hill-signal",
    operatorNarrativeKey: "qsl.operator.sora-hill-reply", createdAt: "2026-08-27T20:00:00.000Z",
    choice: "believe", confirmedAt: "2026-08-27T20:01:00.000Z",
  };
}

function baseSave() {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    money: 3000,
    technologyPoints: 50,
    qslRecords: [sourceQsl()],
    missionState: { ...emptyMissionState(), claimedMissionIds: [...STORY_THIRTEEN] },
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter07: {
        activeRun: null,
        cases: [{
          id: "qsl-case:chapter07", runId: "qsl-story:chapter07",
          sourceQslId: sourceQsl().id, qsoId: "qsl-story-qso:chapter07",
          personId: "person:sora", stationId: "station:sim6jp",
          initialChoice: "believe", finalChoice: "request-review",
          completedAt: "2026-08-28T00:00:00.000Z",
        }],
        settledRunIds: ["qsl-story:chapter07"], peopleTaskTreeUnlocked: true,
      },
    }),
  };
}

function completedRun(save = baseSave()) {
  let run = createFinalPromiseRun({ save, playerCallsign: "BH1ABC", seed: "story-14", startedAt: START });
  run = reviewFinalPromise(run);
  run = submitFinalPromiseCall(run, finalPromiseCallText(run), safe, "2026-08-31T14:01:00.000Z");
  run = receiveFinalPromiseAccount(run, "2026-08-31T14:02:00.000Z");
  run = chooseFinalPromiseTone(run, "warm");
  return submitFinalPromiseMessage(run, finalPromiseMessageText(run), safe, "2026-08-31T14:03:00.000Z");
}

function acceptedSave(run) {
  const accepted = acceptMission(baseSave(), "story-14", "2026-08-31T13:59:00.000Z");
  assert.equal(accepted.accepted, true, accepted.reason);
  return {
    ...accepted.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.save.storyContinuationState,
      chapter14: { activeRun: run },
    }),
  };
}

test("final promise settlement atomically links QSL, zero-credit event QSO, relationship, final page, and proof", () => {
  const run = completedRun();
  const result = settleFinalPromiseRun(acceptedSave(run), run, "2026-08-31T14:04:00.000Z");
  assert.equal(result.settled, true, result.reason);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.equal(result.save.money, 3000);
  assert.equal(result.save.technologyPoints, 50);
  const log = result.save.qsoLogs.find(({ id }) => id === result.qsoId);
  assert.equal(log.eventKind, "final-promise");
  assert.equal(log.eventRunId, run.runId);
  assert.equal(log.callsign, "SIM14FP");
  assert.equal(log.personId, "person:chapter14:final-recipient");
  assert.equal(log.stationId, "station:chapter14:sim14fp");
  assert.equal(log.credits, 0);
  assert.equal(log.isFictional, true);
  const relationship = result.save.operatorRelationships.find(({ personId }) => personId === run.personId);
  assert.equal(relationship.completedQsos, 1);
  const chapter = result.save.storyContinuationState.chapter14;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.equal(chapter.completedRuns[0].runId, run.runId);
  assert.equal(chapter.archive[0].sourceQslId, sourceQsl().id);
  assert.equal(chapter.archive[0].messageKey, "chapter14.message.warm");
  assert.equal(chapter.settlementProofs[0].qsoId, result.qsoId);
  assert.equal(chapter.settlementProofs[0].sourceQslId, sourceQsl().id);
  assert.equal(JSON.stringify(chapter).includes(finalPromiseMessageText(run)), false);
  const active = result.save.missionState.activeMissions[0];
  assert.equal(verifiedFinalPromiseCompletion(result.save, active), true);
  assert.equal(missionBoard(result.save).story.find(({ id }) => id === "story-14").status, "ready");

  const duplicate = settleFinalPromiseRun(result.save, run, "2026-08-31T14:05:00.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("claiming Chapter 14 pays once and seals the final-page replay tree", () => {
  const run = completedRun();
  const settled = settleFinalPromiseRun(acceptedSave(run), run, "2026-08-31T14:04:00.000Z");
  const claimed = claimMission(settled.save, "story-14", "2026-08-31T14:05:00.000Z");
  assert.equal(claimed.claimed, true, claimed.reason);
  assert.equal(claimed.moneyAwarded, 1700);
  assert.equal(claimed.technologyPointsAwarded, 7);
  assert.equal(claimed.save.money, 4700);
  assert.equal(claimed.save.technologyPoints, 57);
  assert.equal(claimed.save.storyContinuationState.chapter14.taskTreeUnlocked, true);
  const duplicate = claimMission(claimed.save, "story-14", "2026-08-31T14:06:00.000Z");
  assert.equal(duplicate.reason, "MISSION_ALREADY_CLAIMED");
  assert.strictEqual(duplicate.save, claimed.save);
});

test("proof chain fails closed for missing QSL, identity, log, relationship, and baseline evidence", () => {
  const run = completedRun();
  const save = settleFinalPromiseRun(acceptedSave(run), run, "2026-08-31T14:04:00.000Z").save;
  const active = save.missionState.activeMissions[0];
  assert.equal(verifiedFinalPromiseCompletion(save, { ...active, baselineFinalPromiseRunIds: [run.runId] }), false);
  assert.equal(verifiedFinalPromiseCompletion({ ...save, qslRecords: [] }, active), false);
  assert.equal(verifiedFinalPromiseCompletion({ ...save, qsoLogs: [] }, active), false);
  assert.equal(verifiedFinalPromiseCompletion({ ...save, operatorRelationships: [] }, active), false);
  const chapter = save.storyContinuationState.chapter14;
  for (const replacement of [
    { completedRuns: [] }, { settledRunIds: [] }, { settlementProofs: [] }, { archive: [] },
  ]) {
    const forged = { ...save, storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState, chapter14: { ...chapter, ...replacement },
    }) };
    assert.equal(verifiedFinalPromiseCompletion(forged, active), false);
  }
  const forgedIdentity = { ...save, qsoLogs: save.qsoLogs.map((log) => log.id === chapter.archive[0].qsoId ? { ...log, personId: "person:sora" } : log) };
  assert.equal(verifiedFinalPromiseCompletion(forgedIdentity, active), false);
});

test("settlement rejects inactive, noncanonical, stale, and source-mismatched runs without rewards", () => {
  const run = completedRun();
  const accepted = acceptedSave(run);
  for (const candidate of [
    { ...run, phase: "FAILED", summary: null, failureReason: "TIMED_OUT" },
    { ...run, personId: "person:sora" },
    { ...run, tone: "brief" },
  ]) {
    const rejected = settleFinalPromiseRun(accepted, candidate, "2026-08-31T14:04:00.000Z");
    assert.equal(rejected.settled, false);
    assert.equal(rejected.moneyAwarded, 0);
    assert.strictEqual(rejected.save, accepted);
  }
  const stale = settleFinalPromiseRun({ ...accepted, storyContinuationState: normalizeStoryContinuationState({
    ...accepted.storyContinuationState, chapter14: { activeRun: null },
  }) }, run, "2026-08-31T14:04:00.000Z");
  assert.equal(stale.reason, "RUN_STATE_MISMATCH");
});

test("Chapter 14 save migration is idempotent and never backfills rewards", () => {
  const run = completedRun();
  const settled = settleFinalPromiseRun(acceptedSave(run), run, "2026-08-31T14:04:00.000Z").save;
  const once = normalizeSave(JSON.parse(JSON.stringify(settled)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, 3000);
  assert.equal(twice.technologyPoints, 50);
  assert.equal(twice.storyContinuationState.chapter14.archive.length, 1);
});
