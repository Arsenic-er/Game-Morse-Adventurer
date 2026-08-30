import assert from "node:assert/strict";
import test from "node:test";

import {
  createStormRelayRun, normalizeStormRelayState, receiveStormConflict,
  requestStormVerification, stormPacketText, submitStormCheckIn, submitStormRelay,
} from "../src/game/stormRelayRun.js";
import {
  settleStormRelayRun, verifiedStormRelayCompletion,
} from "../src/game/stormRelaySettlement.js";
import {
  acceptMission, claimMission, emptyMissionState, missionBoard,
} from "../src/game/missionSystem.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const ACCEPTED = "2026-08-31T00:59:00.000Z";
const STARTED = "2026-08-31T01:00:00.000Z";
const COMPLETED = "2026-08-31T01:01:00.000Z";
const SETTLED = "2026-08-31T01:02:00.000Z";
const CLAIMED = "2026-08-31T01:03:00.000Z";
const safe = Object.freeze({ safeToCommit: true });
const STORY_ELEVEN = Object.freeze(Array.from({ length: 11 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`));

function completedRun(seed = "storm-settlement") {
  let run = createStormRelayRun({ playerCallsign: "BH1ABC", seed, startedAt: STARTED });
  run = submitStormCheckIn(run, "SIM12CS DE BH1ABC QTC K", safe, "2026-08-31T01:00:10.000Z");
  run = receiveStormConflict(run, "2026-08-31T01:00:20.000Z");
  run = requestStormVerification(run, "AGN MSG 214 REV K", safe, "2026-08-31T01:00:30.000Z");
  const canonical = run.packets.find(({ id }) => id === run.verifiedPacketId);
  return submitStormRelay(run, stormPacketText(canonical), safe, COMPLETED);
}

function chapterElevenClaimed() {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    money: 1_000,
    technologyPoints: 30,
    missionState: { ...emptyMissionState(), claimedMissionIds: [...STORY_ELEVEN] },
  };
}

function acceptedSave(run = completedRun()) {
  const accepted = acceptMission(chapterElevenClaimed(), "story-12", ACCEPTED);
  assert.equal(accepted.accepted, true);
  return {
    ...accepted.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.save.storyContinuationState,
      chapter12: normalizeStormRelayState({ activeRun: run }),
    }),
  };
}

test("storm settlement atomically links the canonical record, two event QSOs, relationships, and proof", () => {
  const run = completedRun();
  const before = acceptedSave(run);
  const result = settleStormRelayRun(before, run, SETTLED);

  assert.equal(result.settled, true);
  assert.deepEqual(result.qsoIds.length, 2);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.equal(result.save.money, 1_000);
  assert.equal(result.save.technologyPoints, 30);
  const logs = result.qsoIds.map((id) => result.save.qsoLogs.find((entry) => entry.id === id));
  assert.deepEqual(logs.map(({ eventKind }) => eventKind), ["storm-relay", "storm-relay"]);
  assert.deepEqual(logs.map(({ personId }) => personId), [run.control.personId, run.relay.personId]);
  assert.ok(logs.every(({ eventRunId, credits, frequencyMhz, isFictional }) => (
    eventRunId === run.runId && credits === 0 && frequencyMhz === 21.06 && isFictional === true
  )));
  assert.deepEqual(
    result.save.operatorRelationships
      .filter(({ personId }) => [run.control.personId, run.relay.personId].includes(personId))
      .map(({ completedQsos }) => completedQsos),
    [1, 1],
  );

  const chapter = result.save.storyContinuationState.chapter12;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.deepEqual(chapter.completedRuns, [run.summary]);
  assert.equal(chapter.archive.length, 1);
  assert.equal(chapter.archive[0].canonicalPacketId, "storm-214-r2");
  assert.equal(chapter.archive[0].revision, 2);
  assert.equal(chapter.archive[0].quantity, 6);
  assert.deepEqual(chapter.archive[0].qsoIds, result.qsoIds);
  assert.equal(chapter.settlementProofs[0].recordId, chapter.archive[0].id);
  const active = result.save.missionState.activeMissions[0];
  assert.equal(verifiedStormRelayCompletion(result.save, active), true);
  assert.equal(missionBoard(result.save).story.find(({ id }) => id === "story-12").status, "ready");

  const duplicate = settleStormRelayRun(result.save, run, "2026-08-31T01:02:10.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("claiming Chapter 12 pays exactly once and unlocks advanced rescue projects", () => {
  const run = completedRun("storm-claim");
  const settled = settleStormRelayRun(acceptedSave(run), run, SETTLED);
  const claimed = claimMission(settled.save, "story-12", CLAIMED);
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 1_350);
  assert.equal(claimed.technologyPointsAwarded, 6);
  assert.equal(claimed.save.money, 2_350);
  assert.equal(claimed.save.technologyPoints, 36);
  assert.equal(claimed.save.storyContinuationState.chapter12.taskTreeUnlocked, true);
  const duplicate = claimMission(claimed.save, "story-12", "2026-08-31T01:04:00.000Z");
  assert.equal(duplicate.reason, "MISSION_ALREADY_CLAIMED");
  assert.equal(duplicate.moneyAwarded, 0);
  assert.strictEqual(duplicate.save, claimed.save);
});

test("storm completion fails closed when any linked evidence is absent or forged", () => {
  const run = completedRun("storm-forged");
  const save = acceptedSave(run);
  assert.equal(settleStormRelayRun(save, { ...run, runId: "storm-relay:forged" }, SETTLED).settled, false);
  assert.equal(settleStormRelayRun(save, run, "2026-08-31T01:00:59.000Z").reason, "INVALID_SETTLEMENT_TIME");
  const missingActive = {
    ...save,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState, chapter12: normalizeStormRelayState({}),
    }),
  };
  assert.equal(settleStormRelayRun(missingActive, run, SETTLED).reason, "RUN_STATE_MISMATCH");

  const settled = settleStormRelayRun(save, run, SETTLED).save;
  const active = settled.missionState.activeMissions[0];
  const chapter = settled.storyContinuationState.chapter12;
  for (const forged of [
    { ...settled, qsoLogs: settled.qsoLogs.slice(1) },
    { ...settled, operatorRelationships: settled.operatorRelationships.slice(1) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter12: normalizeStormRelayState({ ...chapter, completedRuns: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter12: normalizeStormRelayState({ ...chapter, settledRunIds: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter12: normalizeStormRelayState({ ...chapter, settlementProofs: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter12: normalizeStormRelayState({ ...chapter, archive: [] }) }) },
  ]) assert.equal(verifiedStormRelayCompletion(forged, active), false);
  assert.equal(verifiedStormRelayCompletion(settled, { ...active, baselineStormRelayRunIds: [run.runId] }), false);
});

test("storm archive survives two JSON save normalizations without back-paying value", () => {
  const run = completedRun("storm-idempotent");
  const settled = settleStormRelayRun(acceptedSave(run), run, SETTLED).save;
  const once = normalizeSave(JSON.parse(JSON.stringify(settled)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, 1_000);
  assert.equal(twice.technologyPoints, 30);
  assert.equal(twice.qsoLogs.length, 2);
  assert.equal(missionBoard(twice).story.find(({ id }) => id === "story-12").status, "ready");
});
