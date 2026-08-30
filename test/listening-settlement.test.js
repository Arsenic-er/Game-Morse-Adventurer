import assert from "node:assert/strict";
import test from "node:test";

import {
  createListeningRun, finishListeningWait, normalizeListeningState,
  observeListeningWindow, recordListeningSilence, submitListeningCall,
} from "../src/game/listeningRun.js";
import { settleListeningRun, verifiedListeningCompletion } from "../src/game/listeningSettlement.js";
import {
  acceptMission, claimMission, emptyMissionState, missionBoard,
} from "../src/game/missionSystem.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const ACCEPTED = "2026-08-31T00:00:00.000Z";
const STARTED = "2026-08-31T00:00:10.000Z";
const COMPLETED = "2026-08-31T00:03:00.000Z";
const SETTLED = "2026-08-31T00:04:00.000Z";
const CLAIMED = "2026-08-31T00:05:00.000Z";
const STORY_TEN = Object.freeze(Array.from({ length: 10 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`));

function completedRun(seed = "listening-settlement") {
  let run = createListeningRun({ playerCallsign: "BH1ABC", seed, startedAt: STARTED });
  run = observeListeningWindow(run, "2026-08-31T00:00:20.000Z");
  run = observeListeningWindow(run, "2026-08-31T00:00:30.000Z");
  run = observeListeningWindow(run, "2026-08-31T00:00:40.000Z");
  run = submitListeningCall(run, "SIM11LS DE BH1ABC K", { safeToCommit: true }, "2026-08-31T00:01:00.000Z");
  run = finishListeningWait(run, "2026-08-31T00:02:00.000Z");
  return recordListeningSilence(run, COMPLETED);
}

function chapterTenClaimed() {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    money: 900,
    technologyPoints: 20,
    missionState: {
      ...emptyMissionState(),
      claimedMissionIds: [...STORY_TEN],
    },
  };
}

function acceptedSave(run = completedRun()) {
  const accepted = acceptMission(chapterTenClaimed(), "story-11", ACCEPTED);
  assert.equal(accepted.accepted, true);
  return {
    ...accepted.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.save.storyContinuationState,
      chapter11: normalizeListeningState({ activeRun: run }),
    }),
  };
}

test("Chapter 11 settlement writes monitoring proof but no QSO or reward", () => {
  const run = completedRun();
  const before = acceptedSave(run);
  const result = settleListeningRun(before, run, SETTLED);

  assert.equal(result.settled, true);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.strictEqual(result.save.qsoLogs, before.qsoLogs);
  assert.deepEqual(result.save.qsoRecords, before.qsoRecords);
  assert.strictEqual(result.save.operatorRelationships, before.operatorRelationships);
  assert.equal(result.save.money, 900);
  assert.equal(result.save.technologyPoints, 20);

  const chapter = result.save.storyContinuationState.chapter11;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.deepEqual(chapter.completedRuns, [run.summary]);
  assert.deepEqual(chapter.archive, [{
    id: `listening-record:${run.runId}`,
    runId: run.runId,
    playerCallsign: "BH1ABC",
    targetCallsign: "SIM11LS",
    stationId: "station:chapter11:sim11ls",
    personId: "person:chapter11:silent-listener",
    observationIds: ["window-1", "window-2", "window-3"],
    callCount: 1,
    activeMilliseconds: 0,
    conclusionKey: "chapter11.conclusion.no-reply-after-listening",
    completedAt: COMPLETED,
  }]);
  assert.equal(chapter.settlementProofs.length, 1);
  assert.equal(chapter.settlementProofs[0].recordId, chapter.archive[0].id);
  assert.equal(verifiedListeningCompletion(result.save, result.save.missionState.activeMissions[0]), true);
  assert.equal(missionBoard(result.save).story.find(({ id }) => id === "story-11").status, "ready");

  const duplicate = settleListeningRun(result.save, run, "2026-08-31T00:04:10.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("claiming Chapter 11 pays once and unlocks its listening task tree", () => {
  const run = completedRun("listening-claim");
  const settled = settleListeningRun(acceptedSave(run), run, SETTLED);
  const claimed = claimMission(settled.save, "story-11", CLAIMED);

  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 1_200);
  assert.equal(claimed.technologyPointsAwarded, 5);
  assert.equal(claimed.save.money, 2_100);
  assert.equal(claimed.save.technologyPoints, 25);
  assert.equal(claimed.save.storyContinuationState.chapter11.taskTreeUnlocked, true);
  const duplicate = claimMission(claimed.save, "story-11", "2026-08-31T00:06:00.000Z");
  assert.equal(duplicate.reason, "MISSION_ALREADY_CLAIMED");
  assert.equal(duplicate.moneyAwarded, 0);
  assert.strictEqual(duplicate.save, claimed.save);
});

test("settlement and mission verification fail closed on mismatched evidence", () => {
  const run = completedRun("listening-forged");
  const save = acceptedSave(run);
  assert.equal(settleListeningRun(save, { ...run, runId: "listening:forged" }, SETTLED).settled, false);
  assert.equal(settleListeningRun(save, run, "2026-08-31T00:02:00.000Z").reason, "INVALID_SETTLEMENT_TIME");
  const missingActive = {
    ...save,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter11: normalizeListeningState({}),
    }),
  };
  assert.equal(settleListeningRun(missingActive, run, SETTLED).reason, "RUN_STATE_MISMATCH");

  const settled = settleListeningRun(save, run, SETTLED).save;
  const active = settled.missionState.activeMissions[0];
  const chapter = settled.storyContinuationState.chapter11;
  for (const forgedChapter of [
    { ...chapter, completedRuns: [] },
    { ...chapter, settledRunIds: [] },
    { ...chapter, settlementProofs: [] },
    { ...chapter, archive: [] },
  ]) {
    const forged = {
      ...settled,
      storyContinuationState: normalizeStoryContinuationState({
        ...settled.storyContinuationState,
        chapter11: normalizeListeningState(forgedChapter),
      }),
    };
    assert.equal(verifiedListeningCompletion(forged, active), false);
    assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-11").status, "active");
  }
  assert.equal(verifiedListeningCompletion(settled, { ...active, baselineListeningRunIds: [run.runId] }), false);
});

test("listening settlement survives two save normalizations without backfill", () => {
  const run = completedRun("listening-idempotent");
  const settled = settleListeningRun(acceptedSave(run), run, SETTLED).save;
  const once = normalizeSave(JSON.parse(JSON.stringify(settled)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.qsoLogs.length, 0);
  assert.equal(twice.operatorRelationships.length, 0);
  assert.equal(twice.money, 900);
  assert.equal(twice.technologyPoints, 20);
  assert.equal(missionBoard(twice).story.find(({ id }) => id === "story-11").status, "ready");
});
