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
