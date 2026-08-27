import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ACTIVE_DAILY_MISSIONS,
  acceptMission,
  abandonMission,
  claimMission,
  dailyMissionDefinitions,
  emptyMissionState,
  missionBoard,
  missionSummary,
  normalizeMissionState,
  recordMissionQsoEvent,
  recentMissionDna,
  targetCallsignForActiveMission,
} from "../src/game/missionSystem.js";
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

function log(overrides = {}) {
  return {
    id: overrides.id ?? `qso-${Math.random()}`,
    completedAt: "2026-08-11T12:00:00.000Z",
    callsign: "SIM7QX",
    location: "NA-W",
    operatorProfileId: "careful-beginner",
    repeatRequests: 0,
    attemptHistory: [],
    transmitAccuracy: 92,
    keyingScore: 86,
    finalPropagationLevel: 3,
    distanceKm: 2500,
    independentWatch: false,
    ...overrides,
  };
}

function save(overrides = {}) {
  return {
    id: "station-alpha",
    money: 40,
    technologyPoints: 2,
    knownOperatorNames: [],
    qsoLogs: [],
    qsoRecords: { total: 0 },
    missionState: emptyMissionState(),
    ...overrides,
  };
}

const STORY_CLAIMED_THROUGH_SIX = Object.freeze([
  "story-01", "story-02", "story-03", "story-04", "story-05", "story-06",
]);

function chapterSevenQsl() {
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

function chapterSevenSourceLog() {
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

function chapterSevenSourceExpeditionState() {
  return normalizeExpeditionState({
    completedRuns: [{
      runId: "hill-1", completedAt: "2026-08-27T23:00:00.000Z", siteId: "sunward-hill",
      qsoId: "expedition-qso:hill-1", personId: "person:sora", stationId: "station:sim6jp",
    }],
    settledRunIds: ["hill-1"],
    settledQsoProofs: [{
      runId: "hill-1", qsoId: "expedition-qso:hill-1", siteId: "sunward-hill",
      personId: "person:sora", stationId: "station:sim6jp",
      completedAt: "2026-08-27T23:00:00.000Z",
      playerLocationId: "expedition:sunward-hill", isFictional: true,
    }],
  });
}

function chapterSevenRun() {
  let run = createQslStoryRun({
    sourceQsl: chapterSevenQsl(),
    playerCallsign: "BH1ABC",
    startedAt: "2026-08-28T00:01:00.000Z",
  });
  run = reviewQslAccounts(run);
  run = submitQslClarification(
    run,
    "QSL HILL-1 DE BH1ABC PSE K",
    { safeToCommit: true },
    "2026-08-28T00:02:00.000Z",
  );
  run = receiveQslClarification(run, "2026-08-28T00:03:00.000Z");
  return confirmQslStoryChoice(run, "request-review", "2026-08-28T00:04:00.000Z");
}

function storySixClaimed({ withQsl = true } = {}) {
  const base = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  const sourceLog = chapterSevenSourceLog();
  return {
    ...base,
    money: 100,
    technologyPoints: 2,
    qslRecords: withQsl ? [chapterSevenQsl()] : [],
    expeditionState: chapterSevenSourceExpeditionState(),
    qsoLogs: [sourceLog],
    qsoRecords: normalizeQsoRecords(null, [sourceLog]),
    operatorRelationships: recordCompletedOperatorRelationship([], sourceLog),
    missionState: {
      ...emptyMissionState(),
      claimedMissionIds: [...STORY_CLAIMED_THROUGH_SIX],
      history: STORY_CLAIMED_THROUGH_SIX.map((id, index) => ({
        id,
        claimedAt: new Date(Date.UTC(2026, 7, 27, 0, index)).toISOString(),
        moneyReward: 0,
        technologyPointsReward: 0,
        outcome: "completed",
      })),
    },
  };
}

test("daily mission boards are deterministic per save and UTC day", () => {
  const first = dailyMissionDefinitions(save(), "2026-08-11T01:00:00.000Z");
  const second = dailyMissionDefinitions(save(), "2026-08-11T22:00:00.000Z");
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map(({ id }) => id)).size, 3);
  assert.ok(first.every(({ id }) => id.startsWith("daily:2026-08-11:")));
});

test("story chapters unlock sequentially and rewards settle once", () => {
  let current = save();
  const acceptedOne = acceptMission(current, "story-01", "2026-08-11T08:00:00.000Z");
  assert.equal(acceptedOne.accepted, true);
  current = acceptedOne.save;
  assert.equal(claimMission(current, "story-01").reason, "MISSION_NOT_COMPLETE");

  current = { ...current, qsoLogs: [log()], qsoRecords: { total: 1 } };
  const firstClaim = claimMission(current, "story-01", "2026-08-11T13:00:00.000Z");
  assert.equal(firstClaim.claimed, true);
  assert.equal(firstClaim.moneyAwarded, 150);
  assert.equal(firstClaim.save.money, 190);
  assert.equal(missionBoard(firstClaim.save).story[1].status, "available");
  assert.equal(claimMission(firstClaim.save, "story-01").reason, "MISSION_ALREADY_CLAIMED");

  const acceptedTwo = acceptMission(firstClaim.save, "story-02", "2026-08-11T13:05:00.000Z");
  assert.equal(acceptedTwo.accepted, true);
  assert.equal(targetCallsignForActiveMission(acceptedTwo.save), "SIM3RA");
  const agnAttempt = [{ message: "AGN K", result: "repeat" }];
  const wrongCall = { ...acceptedTwo.save, qsoLogs: [log({ callsign: "SIM5TU", repeatRequests: 1, attemptHistory: agnAttempt })] };
  assert.equal(missionBoard(wrongCall).story[1].status, "active");
  const qrsOnly = { ...acceptedTwo.save, qsoLogs: [log({ callsign: "SIM3RA", repeatRequests: 1,
    attemptHistory: [{ message: "QRS K", result: "repeat" }] })] };
  assert.equal(missionBoard(qrsOnly).story[1].status, "active");
  const confirmed = { ...acceptedTwo.save, qsoLogs: [log({ callsign: "SIM3RA", completedAt: "2026-08-11T13:30:00.000Z", repeatRequests: 1, attemptHistory: agnAttempt })] };
  assert.equal(missionBoard(confirmed).story[1].status, "ready");
  const secondClaim = claimMission(confirmed, "story-02", "2026-08-11T14:00:00.000Z");
  assert.equal(secondClaim.claimed, true);
  assert.equal(secondClaim.save.money, 410);
  assert.equal(secondClaim.save.technologyPoints, 3);
  assert.deepEqual(secondClaim.save.knownOperatorNames, ["MORSE"]);
});

test("story seven requires a confirmed hill QSL and four linked settlement facts", () => {
  assert.equal(missionBoard(storySixClaimed({ withQsl: false })).story.at(-1).status, "locked");
  const accepted = acceptMission(storySixClaimed(), "story-07", "2026-08-28T00:00:00.000Z");
  assert.equal(accepted.accepted, true);
  assert.equal(missionBoard(accepted.save).story.at(-1).status, "active");

  const run = chapterSevenRun();
  const withActiveRun = {
    ...accepted.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.save.storyContinuationState,
      chapter07: normalizeQslStoryState({ activeRun: run, cases: [], settledRunIds: [] }),
    }),
  };
  const settled = settleQslStoryRun(withActiveRun, run, "2026-08-28T00:05:00.000Z");
  assert.equal(settled.settled, true);
  assert.equal(missionBoard(settled.save).story.at(-1).status, "ready");

  const claimed = claimMission(settled.save, "story-07", "2026-08-28T00:06:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 750);
  assert.equal(claimed.technologyPointsAwarded, 3);
  assert.equal(claimed.save.money, 850);
  assert.equal(claimed.save.technologyPoints, 5);
  assert.equal(claimed.save.storyContinuationState.chapter07.peopleTaskTreeUnlocked, true);
  assert.equal(claimMission(claimed.save, "story-07", "2026-08-28T00:07:00.000Z").reason, "MISSION_ALREADY_CLAIMED");
});

test("story seven ignores pre-acceptance and partially forged chapter evidence", () => {
  const run = chapterSevenRun();
  const preAcceptedBase = storySixClaimed();
  const preAccepted = settleQslStoryRun({
    ...preAcceptedBase,
    storyContinuationState: normalizeStoryContinuationState({
      ...preAcceptedBase.storyContinuationState,
      chapter07: normalizeQslStoryState({ activeRun: run, cases: [], settledRunIds: [] }),
    }),
  }, run, "2026-08-28T00:05:00.000Z").save;
  const acceptedAfter = acceptMission(preAccepted, "story-07", "2026-08-28T00:06:00.000Z");
  assert.equal(acceptedAfter.accepted, true);
  assert.equal(missionBoard(acceptedAfter.save).story.at(-1).status, "active");

  const accepted = acceptMission(storySixClaimed(), "story-07", "2026-08-28T00:00:00.000Z").save;
  const forged = {
    ...accepted,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.storyContinuationState,
      chapter07: preAccepted.storyContinuationState.chapter07,
    }),
    qsoLogs: accepted.qsoLogs,
    operatorRelationships: accepted.operatorRelationships,
  };
  assert.equal(missionBoard(forged).story.at(-1).status, "active");
  assert.equal(claimMission(forged, "story-07").reason, "MISSION_NOT_COMPLETE");
});

test("chapter three measures genuinely different operator profiles", () => {
  const base = save({
    missionState: {
      version: 1,
      activeMissions: [{ id: "story-03", acceptedAt: "2026-08-11T08:00:00.000Z" }],
      claimedMissionIds: ["story-01", "story-02"],
      history: [],
    },
    qsoLogs: [
      log({ id: "one", operatorProfileId: "careful-beginner" }),
      log({ id: "two", operatorProfileId: "patient-veteran" }),
      log({ id: "three", operatorProfileId: "youth-club" }),
      log({ id: "legacy", operatorProfileId: "legacy-standard" }),
    ],
  });
  const mission = missionBoard(base).story[2];
  assert.equal(mission.current, 3);
  assert.equal(mission.status, "ready");
  const claimed = claimMission(base, "story-03");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 300);
  assert.equal(claimed.technologyPointsAwarded, 1);
});

test("daily commissions only count contacts after acceptance and enforce the active limit", () => {
  const now = "2026-08-11T10:00:00.000Z";
  const available = dailyMissionDefinitions(save(), now);
  let current = save({ qsoLogs: [log({ completedAt: "2026-08-11T09:59:59.000Z" })] });
  for (const mission of available.slice(0, MAX_ACTIVE_DAILY_MISSIONS)) {
    const result = acceptMission(current, mission.id, now);
    assert.equal(result.accepted, true);
    current = result.save;
  }
  const limited = acceptMission(current, available[MAX_ACTIVE_DAILY_MISSIONS].id, now);
  assert.equal(limited.accepted, false);
  assert.equal(limited.reason, "DAILY_MISSION_LIMIT");
  assert.equal(missionBoard(current, now).daily.filter(({ status }) => status === "ready").length, 0);
  const abandoned = abandonMission(current, available[0].id);
  assert.equal(abandoned.abandoned, true);
  assert.equal(abandoned.save.missionState.activeMissions.length, 1);
});

test("mission state normalization removes corrupt, duplicate, and already claimed active records", () => {
  const normalized = normalizeMissionState({
    activeMissions: [
      { id: "story-01", acceptedAt: "2026-08-11T08:00:00Z" },
      { id: "story-01", acceptedAt: "2026-08-11T09:00:00Z" },
      { id: "invalid", acceptedAt: "2026-08-11T09:00:00Z" },
    ],
    claimedMissionIds: ["story-01", "story-01", "invalid"],
    history: [{ id: "story-01", claimedAt: "bad" }],
  });
  assert.deepEqual(normalized.activeMissions, []);
  assert.deepEqual(normalized.claimedMissionIds, ["story-01"]);
  assert.deepEqual(normalized.history, []);
  assert.deepEqual(missionSummary(save()).storyClaimed, 0);
});
