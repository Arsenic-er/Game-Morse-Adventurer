import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseNightWindow, createNightOperationsRun, normalizeNightOperationsState,
  submitNightExchange, submitNightOperationsCall, tickNightOperationsRun,
} from "../src/game/nightOperationsRun.js";
import { settleNightOperationsRun, verifiedNightOperationsCompletion } from "../src/game/nightOperationsSettlement.js";
import { acceptMission, claimMission, emptyMissionState, missionBoard } from "../src/game/missionSystem.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const STARTED = "2026-08-31T12:00:00.000Z";
const SETTLED = "2026-08-31T12:06:00.000Z";
const safe = Object.freeze({ safeToCommit: true });
const STORY_TWELVE = Object.freeze(Array.from({ length: 12 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`));

function relationship(personId, callsign, operatorProfileId, offset) {
  const metAt = new Date(Date.parse(STARTED) - offset * 60_000).toISOString();
  return { personId, callsign, operatorProfileId, encounterCount: 1, completedQsos: 1, weakSignalRecoveries: 0,
    topicCounts: {}, firstMetAt: metAt, lastMetAt: metAt, lastEncounterId: `${callsign}:${metAt}`, lastQsoId: `old:${callsign}` };
}

function baseSave() {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return { ...save, money: 2_000, technologyPoints: 40,
    operatorRelationships: [
      relationship("person:sora", "SIM6JP", "fixed-sora", 1),
      relationship("person:procedural:chapter08-net-control", "SIM8NC", "chapter08-net-control", 2),
      relationship("person:procedural:chapter09-source", "SIM9CR", "chapter09-source", 3),
      relationship("person:procedural:chapter09-relay", "SIM9RL", "chapter09-relay", 4),
    ], missionState: { ...emptyMissionState(), claimedMissionIds: [...STORY_TWELVE] } };
}

function completedRun(save = baseSave()) {
  let run = createNightOperationsRun({ save, seed: "story-13-settlement", startedAt: STARTED });
  for (const window of run.windows.slice(0, 3)) {
    const delta = window.opensAtMilliseconds - run.activeMilliseconds;
    if (delta > 0) run = tickNightOperationsRun(run, { milliseconds: delta }, new Date(Date.parse(STARTED) + window.opensAtMilliseconds).toISOString());
    run = chooseNightWindow(run, window.id);
    run = submitNightOperationsCall(run, `${window.callsign} DE BH1ABC K`, safe);
    run = submitNightExchange(run, `${window.callsign} DE BH1ABC 599 ${window.band} K`, safe,
      new Date(Date.parse(STARTED) + run.activeMilliseconds).toISOString());
  }
  return run;
}

function acceptedSave(run) {
  const accepted = acceptMission(baseSave(), "story-13", "2026-08-31T11:59:00.000Z");
  assert.equal(accepted.accepted, true);
  return { ...accepted.save, storyContinuationState: normalizeStoryContinuationState({
    ...accepted.save.storyContinuationState, chapter13: normalizeNightOperationsState({ activeRun: run }),
  }) };
}

test("night settlement atomically links three zero-credit event QSOs, relationships, schedule archive, and proof", () => {
  const run = completedRun();
  const result = settleNightOperationsRun(acceptedSave(run), run, SETTLED);
  assert.equal(result.settled, true, result.reason);
  assert.deepEqual(result.moneyAwarded, 0);
  assert.deepEqual(result.technologyPointsAwarded, 0);
  assert.equal(result.qsoIds.length, 3);
  assert.equal(result.save.money, 2_000);
  assert.equal(result.save.technologyPoints, 40);
  const logs = result.qsoIds.map((id) => result.save.qsoLogs.find((entry) => entry.id === id));
  assert.equal(logs.length, 3);
  assert.ok(logs.every(({ eventKind, eventRunId, credits, isFictional, frequencyMhz }) => (
    eventKind === "night-operations" && eventRunId === run.runId && credits === 0 && isFictional === true && frequencyMhz === 0
  )));
  assert.deepEqual(logs.map(({ personId }) => personId), run.contacts.map(({ personId }) => personId));
  for (const contact of run.contacts) {
    const relation = result.save.operatorRelationships.find(({ personId }) => personId === contact.personId);
    assert.equal(relation.completedQsos, 2);
  }
  const chapter = result.save.storyContinuationState.chapter13;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.equal(chapter.completedRuns[0].runId, run.runId);
  assert.equal(chapter.archive[0].windows.length, 4);
  assert.equal(chapter.archive[0].contacts.length, 3);
  assert.deepEqual(chapter.settlementProofs[0].qsoIds, result.qsoIds);
  const active = result.save.missionState.activeMissions[0];
  assert.equal(verifiedNightOperationsCompletion(result.save, active), true, "linked night evidence");
  assert.equal(missionBoard(result.save).story.find(({ id }) => id === "story-13").status, "ready");

  const duplicate = settleNightOperationsRun(result.save, run, "2026-08-31T12:07:00.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("claiming Chapter 13 pays once and unlocks the read-only operations board", () => {
  const run = completedRun();
  const settled = settleNightOperationsRun(acceptedSave(run), run, SETTLED);
  const claimed = claimMission(settled.save, "story-13", "2026-08-31T12:08:00.000Z");
  assert.equal(claimed.claimed, true, claimed.reason);
  assert.equal(claimed.moneyAwarded, 1_500);
  assert.equal(claimed.technologyPointsAwarded, 6);
  assert.equal(claimed.save.money, 3_500);
  assert.equal(claimed.save.technologyPoints, 46);
  assert.equal(claimed.save.storyContinuationState.chapter13.taskTreeUnlocked, true);
  const duplicate = claimMission(claimed.save, "story-13", "2026-08-31T12:09:00.000Z");
  assert.equal(duplicate.reason, "MISSION_ALREADY_CLAIMED");
  assert.strictEqual(duplicate.save, claimed.save);
});

test("mission proof fails closed for baseline, missing, or forged linkage without regressing after later contacts", () => {
  const run = completedRun();
  const settled = settleNightOperationsRun(acceptedSave(run), run, SETTLED).save;
  const active = settled.missionState.activeMissions[0];
  assert.equal(verifiedNightOperationsCompletion(settled, { ...active, baselineNightOperationsRunIds: [run.runId] }), false);
  assert.equal(verifiedNightOperationsCompletion({ ...settled, qsoLogs: settled.qsoLogs.slice(1) }, active), false);
  assert.equal(verifiedNightOperationsCompletion({ ...settled, operatorRelationships: settled.operatorRelationships.slice(1) }, active), false);
  const chapter = settled.storyContinuationState.chapter13;
  for (const replacement of [
    { completedRuns: [] }, { settledRunIds: [] }, { settlementProofs: [] }, { archive: [] },
  ]) {
    const forged = { ...settled, storyContinuationState: normalizeStoryContinuationState({
      ...settled.storyContinuationState, chapter13: normalizeNightOperationsState({ ...chapter, ...replacement }),
    }) };
    assert.equal(verifiedNightOperationsCompletion(forged, active), false);
  }
  const later = { ...settled, operatorRelationships: settled.operatorRelationships.map((entry) => ({
    ...entry, lastQsoId: `later:${entry.personId}`, lastMetAt: "2026-08-31T13:00:00.000Z",
  })) };
  assert.equal(verifiedNightOperationsCompletion(later, active), true);
});

test("night archive remains idempotent through two JSON save normalizations without back-pay", () => {
  const run = completedRun();
  const settled = settleNightOperationsRun(acceptedSave(run), run, SETTLED).save;
  const once = normalizeSave(JSON.parse(JSON.stringify(settled)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, 2_000);
  assert.equal(twice.technologyPoints, 40);
  assert.equal(twice.qsoLogs.filter(({ eventKind }) => eventKind === "night-operations").length, 3);
  assert.equal(missionBoard(twice).story.find(({ id }) => id === "story-13").status, "ready");
});
