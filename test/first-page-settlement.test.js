import assert from "node:assert/strict";
import test from "node:test";

import { settleFirstPage, verifiedFirstPageCompletion } from "../src/game/firstPageSettlement.js";
import { acceptMission, claimMission, emptyMissionState, missionBoard } from "../src/game/missionSystem.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";

const ACCEPTED_AT = "2026-08-31T16:00:00.000Z";
const QSO_AT = "2026-08-31T16:10:00.000Z";
const PAGE_AT = "2026-08-31T16:11:00.000Z";
const STORY_FOURTEEN = Object.freeze(Array.from({ length: 14 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`));

function baseSave() {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    money: 4000,
    technologyPoints: 70,
    missionState: { ...emptyMissionState(), claimedMissionIds: [...STORY_FOURTEEN] },
  };
}

function qso(id, completedAt = QSO_AT) {
  return {
    id,
    startedAt: new Date(Date.parse(completedAt) - 120_000).toISOString(),
    completedAt,
    playerCallsign: "BH1ABC",
    callsign: "SIM4US",
    sent: "599",
    received: "579",
    location: "US",
    distanceKm: 5200,
    frequencyMhz: 14.06,
    basePropagationLevel: 3,
    finalPropagationLevel: 3,
    propagationLevelRecorded: true,
    equipmentId: "squid-01",
    antennaId: "none",
    accessoryId: "none",
    playerLocationId: "japan-tokyo-kanto",
    wpm: 15,
    transmitAccuracy: 94,
    keyingScore: 90,
    repeatRequests: 0,
    copyQueries: 0,
    cqQuality: 95,
    copyScore: 92,
    copyOutcome: "copied",
    independentWatch: true,
    guidanceLevel: "off",
    visualAssistUsed: false,
    isFictional: true,
  };
}

function acceptedWithNewQso() {
  const accepted = acceptMission(baseSave(), "story-15", ACCEPTED_AT);
  assert.equal(accepted.accepted, true, accepted.reason);
  const recorded = recordCompletedQso(accepted.save, qso("ordinary:first-page"));
  assert.equal(recorded.added, true);
  assert.ok(recorded.moneyAwarded > 0);
  return recorded.save;
}

test("only a retained post-acceptance positive ordinary QSO can become the first page", () => {
  const old = recordCompletedQso(baseSave(), qso("ordinary:old", "2026-08-31T15:30:00.000Z")).save;
  const accepted = acceptMission(old, "story-15", ACCEPTED_AT);
  assert.equal(accepted.accepted, true, accepted.reason);
  assert.equal(settleFirstPage(accepted.save, { qsoId: "ordinary:old", goal: "world-log", completedAt: PAGE_AT }).reason, "QSO_NOT_ELIGIBLE");

  const recorded = recordCompletedQso(accepted.save, qso("ordinary:new"));
  const result = settleFirstPage(recorded.save, { qsoId: "ordinary:new", goal: "world-log", completedAt: PAGE_AT });
  assert.equal(result.settled, true, result.reason);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.equal(result.save.money, recorded.save.money);
  assert.equal(result.save.technologyPoints, recorded.save.technologyPoints);

  const chapter = result.save.storyContinuationState.chapter15;
  assert.deepEqual(chapter.settledRunIds, ["first-page:ordinary:new"]);
  assert.equal(chapter.archive[0].qsoId, "ordinary:new");
  assert.equal(chapter.archive[0].goal, "world-log");
  assert.equal(chapter.archive[0].callsign, "SIM4US");
  assert.equal(chapter.archive[0].personId, result.save.qsoLogs.find(({ id }) => id === "ordinary:new").personId);
  assert.equal(chapter.archive[0].stationId, result.save.qsoLogs.find(({ id }) => id === "ordinary:new").stationId);
  assert.equal(chapter.archive[0].qsoCompletedAt, QSO_AT);
  assert.equal(chapter.settlementProofs[0].acceptedAt, ACCEPTED_AT);
  assert.equal(chapter.settlementProofs[0].qsoId, "ordinary:new");
  assert.equal(verifiedFirstPageCompletion(result.save, result.save.missionState.activeMissions[0]), true);
  assert.equal(missionBoard(result.save).story.find(({ id }) => id === "story-15").status, "ready");

  const duplicate = settleFirstPage(result.save, { qsoId: "ordinary:new", goal: "world-log", completedAt: "2026-08-31T16:12:00.000Z" });
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("event, zero-credit, missing-ledger, evicted, and forged first-page evidence fail closed", () => {
  const save = acceptedWithNewQso();
  const original = save.qsoLogs.find(({ id }) => id === "ordinary:first-page");
  const mutations = [
    { ...save, qsoLogs: save.qsoLogs.map((entry) => entry.id === original.id ? { ...entry, eventId: "chapter-continuation", eventRunId: "event:forged", eventMode: "story", eventKind: "final-promise" } : entry) },
    { ...save, qsoLogs: save.qsoLogs.map((entry) => entry.id === original.id ? { ...entry, rewardBreakdown: null, credits: 0 } : entry) },
    { ...save, qsoRecords: { ...save.qsoRecords, settledQsoIds: [] } },
    { ...save, qsoLogs: [] },
  ];
  for (const candidate of mutations) {
    const rejected = settleFirstPage(candidate, { qsoId: original.id, goal: "world-log", completedAt: PAGE_AT });
    assert.equal(rejected.settled, false);
    assert.equal(rejected.moneyAwarded, 0);
    assert.strictEqual(rejected.save, candidate);
  }
  for (const goal of ["", "write-anything", "world-log\n<script>", new String("world-log")]) {
    const rejected = settleFirstPage(save, { qsoId: original.id, goal, completedAt: PAGE_AT });
    assert.equal(rejected.reason, "INVALID_GOAL");
  }
});

test("claiming Chapter 15 pays once and unlocks Open Station with an immutable first goal", () => {
  const save = acceptedWithNewQso();
  const settled = settleFirstPage(save, { qsoId: "ordinary:first-page", goal: "field-operations", completedAt: PAGE_AT });
  const claimed = claimMission(settled.save, "story-15", "2026-08-31T16:12:00.000Z");
  assert.equal(claimed.claimed, true, claimed.reason);
  assert.equal(claimed.moneyAwarded, 2000);
  assert.equal(claimed.technologyPointsAwarded, 8);
  assert.equal(claimed.save.storyContinuationState.chapter15.taskTreeUnlocked, true);
  assert.deepEqual(claimed.save.storyContinuationState.openStation, {
    version: 1,
    unlocked: true,
    firstGoal: "field-operations",
    activeGoal: "field-operations",
    goalUpdatedAt: "2026-08-31T16:12:00.000Z",
  });
  const duplicate = claimMission(claimed.save, "story-15", "2026-08-31T16:13:00.000Z");
  assert.equal(duplicate.reason, "MISSION_ALREADY_CLAIMED");
  assert.strictEqual(duplicate.save, claimed.save);
});

test("first-page proof chains and save migration are strict, idempotent, and reward neutral", () => {
  const before = acceptedWithNewQso();
  const settled = settleFirstPage(before, { qsoId: "ordinary:first-page", goal: "people-network", completedAt: PAGE_AT }).save;
  const active = settled.missionState.activeMissions[0];
  const chapter = settled.storyContinuationState.chapter15;
  for (const replacement of [
    { completedRuns: [] }, { settledRunIds: [] }, { settlementProofs: [] }, { archive: [] },
  ]) {
    const forged = { ...settled, storyContinuationState: normalizeStoryContinuationState({
      ...settled.storyContinuationState, chapter15: { ...chapter, ...replacement },
    }) };
    assert.equal(verifiedFirstPageCompletion(forged, active), false);
  }
  assert.equal(verifiedFirstPageCompletion(settled, { ...active, baselineQsoIds: ["ordinary:first-page"] }), false);
  const once = normalizeSave(JSON.parse(JSON.stringify(settled)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, settled.money);
  assert.equal(twice.technologyPoints, settled.technologyPoints);
  assert.equal(JSON.stringify(twice.storyContinuationState.chapter15).includes("<script>"), false);
});
