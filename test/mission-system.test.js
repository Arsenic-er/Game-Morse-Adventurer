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
import {
  beginServiceNetRun,
  createServiceNetRun,
  normalizeServiceNetState,
  receiveServiceNetMessage,
  submitServiceNetText,
} from "../src/game/serviceNetRun.js";
import { settleServiceNetRun } from "../src/game/serviceNetSettlement.js";
import {
  beginCoordinateRelayRun, coordinatePacketText, createCoordinateRelayRun, normalizeCoordinateRelayState,
  receiveCoordinatePacket, receiveRelayConfirmation, submitCoordinateRelayText,
} from "../src/game/coordinateRelayRun.js";
import { settleCoordinateRelayRun } from "../src/game/coordinateRelaySettlement.js";
import {
  CONTEST_MODES, contestCqText, contestExchangeText, createContestRun, finishContestRun,
  normalizeContestState, selectContestMode, submitContestText,
} from "../src/game/contestRun.js";
import { settleContestRun } from "../src/game/contestSettlement.js";
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

function withLaterOrdinaryContact(save, eventKind, id, startedAt, completedAt) {
  const source = save.qsoLogs.find((entry) => entry.eventKind === eventKind);
  const laterLog = normalizeQsoLogEntry({
    ...source,
    id,
    eventKind: null,
    eventRunId: null,
    startedAt,
    completedAt,
  });
  assert.ok(laterLog, `${eventKind} later QSO must normalize`);
  return {
    ...save,
    qsoLogs: [...save.qsoLogs, laterLog],
    operatorRelationships: recordCompletedOperatorRelationship(save.operatorRelationships, laterLog),
  };
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
  assert.equal(missionBoard(storySixClaimed({ withQsl: false })).story.find(({ id }) => id === "story-07").status, "locked");
  const accepted = acceptMission(storySixClaimed(), "story-07", "2026-08-28T00:00:00.000Z");
  assert.equal(accepted.accepted, true);
  assert.equal(missionBoard(accepted.save).story.find(({ id }) => id === "story-07").status, "active");

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
  assert.equal(missionBoard(settled.save).story.find(({ id }) => id === "story-07").status, "ready");
  const afterLaterContact = withLaterOrdinaryContact(settled.save, "qsl-story", "later-qsl-story-contact", "2026-08-28T00:05:10.000Z", "2026-08-28T00:05:20.000Z");
  assert.equal(missionBoard(afterLaterContact).story.find(({ id }) => id === "story-07").status, "ready");

  const claimed = claimMission(afterLaterContact, "story-07", "2026-08-28T00:06:00.000Z");
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
  assert.equal(missionBoard(acceptedAfter.save).story.find(({ id }) => id === "story-07").status, "active");

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
  assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-07").status, "active");
  assert.equal(claimMission(forged, "story-07").reason, "MISSION_NOT_COMPLETE");
});

function completedServiceNetRun(seed = "mission-story-08") {
  let run = beginServiceNetRun(createServiceNetRun({
    playerCallsign: "BH1ABC", seed, startedAt: "2026-08-28T01:01:00.000Z",
  }));
  run = submitServiceNetText(run, "BH1ABC CHECK IN K", { safeToCommit: true }, "2026-08-28T01:01:10.000Z");
  for (let index = 0; index < 3; index += 1) {
    run = receiveServiceNetMessage(run, `2026-08-28T01:0${index + 2}:00.000Z`);
    const message = run.messages[run.priorityOrder[run.currentPosition]];
    run = submitServiceNetText(run, `ACK ${message.messageId} PRI ${message.priority} K`,
      { safeToCommit: true }, `2026-08-28T01:0${index + 2}:10.000Z`);
  }
  return run;
}

function storySevenClaimed() {
  const base = storySixClaimed();
  return {
    ...base,
    missionState: {
      ...base.missionState,
      claimedMissionIds: [...base.missionState.claimedMissionIds, "story-07"],
      history: [...base.missionState.history, {
        id: "story-07", claimedAt: "2026-08-28T00:30:00.000Z", moneyReward: 750,
        technologyPointsReward: 3, outcome: "completed",
      }],
    },
  };
}

test("story eight requires four linked service facts and rewards only once", () => {
  const base = storySevenClaimed();
  const accepted = acceptMission(base, "story-08", "2026-08-28T01:00:00.000Z");
  assert.equal(accepted.accepted, true);
  assert.equal(missionBoard(accepted.save).story.find(({ id }) => id === "story-08").status, "active");
  const run = completedServiceNetRun();
  const active = {
    ...accepted.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.save.storyContinuationState,
      chapter08: normalizeServiceNetState({ activeRun: run }),
    }),
  };
  const settled = settleServiceNetRun(active, run, "2026-08-28T01:06:00.000Z");
  assert.equal(settled.settled, true);
  assert.equal(missionBoard(settled.save).story.find(({ id }) => id === "story-08").status, "ready");
  const serviceLog = settled.save.qsoLogs.find(({ eventKind }) => eventKind === "service-net");
  const laterLog = normalizeQsoLogEntry({
    ...serviceLog,
    id: "later-service-controller-qso",
    eventKind: null,
    eventRunId: null,
    startedAt: "2026-08-28T01:06:10.000Z",
    completedAt: "2026-08-28T01:06:20.000Z",
  });
  const afterLaterContact = {
    ...settled.save,
    qsoLogs: [...settled.save.qsoLogs, laterLog],
    operatorRelationships: recordCompletedOperatorRelationship(settled.save.operatorRelationships, laterLog),
  };
  assert.equal(missionBoard(afterLaterContact).story.find(({ id }) => id === "story-08").status, "ready");
  const claimed = claimMission(afterLaterContact, "story-08", "2026-08-28T01:07:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 850);
  assert.equal(claimed.technologyPointsAwarded, 4);
  assert.equal(claimed.save.money, base.money + 850);
  assert.equal(claimed.save.technologyPoints, base.technologyPoints + 4);
  assert.equal(claimed.save.storyContinuationState.chapter08.taskTreeUnlocked, true);
  assert.equal(claimMission(claimed.save, "story-08").reason, "MISSION_ALREADY_CLAIMED");

  const replay = completedServiceNetRun("mission-story-08-replay");
  const replaySave = {
    ...claimed.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...claimed.save.storyContinuationState,
      chapter08: normalizeServiceNetState({
        ...claimed.save.storyContinuationState.chapter08, activeRun: replay,
      }),
    }),
  };
  const replayed = settleServiceNetRun(replaySave, replay, "2026-08-28T01:08:00.000Z");
  assert.equal(replayed.settled, true);
  assert.equal(replayed.save.money, claimed.save.money);
  assert.equal(replayed.save.technologyPoints, claimed.save.technologyPoints);
});

test("story eight rejects pre-acceptance and incomplete service proof sets", () => {
  const run = completedServiceNetRun("mission-story-08-forgery");
  const base = storySevenClaimed();
  const preAcceptedActive = {
    ...base,
    storyContinuationState: normalizeStoryContinuationState({
      ...base.storyContinuationState, chapter08: normalizeServiceNetState({ activeRun: run }),
    }),
  };
  const preAccepted = settleServiceNetRun(preAcceptedActive, run, "2026-08-28T01:06:00.000Z").save;
  const acceptedAfter = acceptMission(preAccepted, "story-08", "2026-08-28T01:07:00.000Z");
  assert.equal(missionBoard(acceptedAfter.save).story.find(({ id }) => id === "story-08").status, "active");

  const accepted = acceptMission(base, "story-08", "2026-08-28T01:00:00.000Z").save;
  const active = {
    ...accepted,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.storyContinuationState, chapter08: normalizeServiceNetState({ activeRun: run }),
    }),
  };
  const settled = settleServiceNetRun(active, run, "2026-08-28T01:06:00.000Z").save;
  for (const forged of [
    { ...settled, qsoLogs: [] },
    { ...settled, operatorRelationships: [] },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({
      ...settled.storyContinuationState,
      chapter08: normalizeServiceNetState({ ...settled.storyContinuationState.chapter08, receipts: settled.storyContinuationState.chapter08.receipts.slice(0, 2) }),
    }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({
      ...settled.storyContinuationState,
      chapter08: normalizeServiceNetState({ ...settled.storyContinuationState.chapter08, settledRunIds: [] }),
    }) },
  ]) {
    assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-08").status, "active");
    assert.equal(claimMission(forged, "story-08").reason, "MISSION_NOT_COMPLETE");
  }
});

test("story continuation missions reject inherited QSO log evidence", () => {
  const run = completedServiceNetRun("mission-story-08-inherited-log");
  const accepted = acceptMission(storySevenClaimed(), "story-08", "2026-08-28T01:00:00.000Z").save;
  const active = {
    ...accepted,
    storyContinuationState: normalizeStoryContinuationState({
      ...accepted.storyContinuationState,
      chapter08: normalizeServiceNetState({ activeRun: run }),
    }),
  };
  const settled = settleServiceNetRun(active, run, "2026-08-28T01:06:00.000Z").save;
  const serviceLog = settled.qsoLogs.find(({ eventKind }) => eventKind === "service-net");
  const inheritedLogs = new Array(1);
  const inheritedPrototype = Object.create(Array.prototype);
  Object.defineProperty(inheritedPrototype, "0", {
    value: serviceLog, enumerable: true, configurable: true, writable: true,
  });
  Object.setPrototypeOf(inheritedLogs, inheritedPrototype);
  const forged = { ...settled, qsoLogs: inheritedLogs };

  assert.equal(Object.hasOwn(inheritedLogs, 0), false);
  assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-08").status, "active");
  assert.equal(claimMission(forged, "story-08").reason, "MISSION_NOT_COMPLETE");
});

function completedCoordinateRelayRun(seed = "mission-story-09") {
  let run = beginCoordinateRelayRun(createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed, startedAt: "2026-08-28T02:01:00.000Z" }));
  run = receiveCoordinatePacket(run, "2026-08-28T02:01:10.000Z");
  run = submitCoordinateRelayText(run, coordinatePacketText(run.packet), { safeToCommit: true }, "2026-08-28T02:01:20.000Z");
  run = submitCoordinateRelayText(run, coordinatePacketText(run.packet), { safeToCommit: true }, "2026-08-28T02:01:30.000Z");
  return receiveRelayConfirmation(run, `QSL MSG ${run.packet.packetId} CHECK ${String(run.packet.check).padStart(2, "0")} K`, "2026-08-28T02:01:40.000Z");
}

function storyEightClaimed() {
  const base = storySevenClaimed();
  return {
    ...base,
    missionState: {
      ...base.missionState,
      claimedMissionIds: [...base.missionState.claimedMissionIds, "story-08"],
      history: [...base.missionState.history, { id: "story-08", claimedAt: "2026-08-28T01:30:00.000Z", moneyReward: 850, technologyPointsReward: 4, outcome: "completed" }],
    },
  };
}

test("story nine requires linked coordinate relay facts and rewards only once", () => {
  const base = storyEightClaimed();
  const accepted = acceptMission(base, "story-09", "2026-08-28T02:00:00.000Z");
  assert.equal(accepted.accepted, true);
  const run = completedCoordinateRelayRun();
  const active = { ...accepted.save, storyContinuationState: normalizeStoryContinuationState({ ...accepted.save.storyContinuationState, chapter09: normalizeCoordinateRelayState({ activeRun: run }) }) };
  const settled = settleCoordinateRelayRun(active, run, "2026-08-28T02:02:00.000Z");
  assert.equal(settled.settled, true);
  assert.equal(missionBoard(settled.save).story.find(({ id }) => id === "story-09").status, "ready");
  const afterLaterContact = withLaterOrdinaryContact(settled.save, "coordinate-relay", "later-coordinate-contact", "2026-08-28T02:02:10.000Z", "2026-08-28T02:02:20.000Z");
  assert.equal(missionBoard(afterLaterContact).story.find(({ id }) => id === "story-09").status, "ready");
  const claimed = claimMission(afterLaterContact, "story-09", "2026-08-28T02:03:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 950);
  assert.equal(claimed.technologyPointsAwarded, 4);
  assert.equal(claimed.save.money, base.money + 950);
  assert.equal(claimed.save.technologyPoints, base.technologyPoints + 4);
  assert.equal(claimed.save.storyContinuationState.chapter09.toolUnlocked, true);
  assert.equal(claimMission(claimed.save, "story-09").reason, "MISSION_ALREADY_CLAIMED");
});

test("story nine rejects pre-acceptance and partial coordinate proof sets", () => {
  const base = storyEightClaimed();
  const run = completedCoordinateRelayRun("mission-story-09-forged");
  const accepted = acceptMission(base, "story-09", "2026-08-28T02:00:00.000Z").save;
  const active = { ...accepted, storyContinuationState: normalizeStoryContinuationState({ ...accepted.storyContinuationState, chapter09: normalizeCoordinateRelayState({ activeRun: run }) }) };
  const settled = settleCoordinateRelayRun(active, run, "2026-08-28T02:02:00.000Z").save;
  for (const forged of [
    { ...settled, qsoLogs: settled.qsoLogs.slice(1) },
    { ...settled, operatorRelationships: settled.operatorRelationships.slice(1) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter09: normalizeCoordinateRelayState({ ...settled.storyContinuationState.chapter09, packets: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter09: normalizeCoordinateRelayState({ ...settled.storyContinuationState.chapter09, settledRunIds: [] }) }) },
  ]) {
    assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-09").status, "active");
    assert.equal(claimMission(forged, "story-09").reason, "MISSION_NOT_COMPLETE");
  }
});

function storyNineClaimed() {
  const base = storyEightClaimed();
  return {
    ...base,
    missionState: {
      ...base.missionState,
      claimedMissionIds: [...base.missionState.claimedMissionIds, "story-09"],
      history: [...base.missionState.history, { id: "story-09", claimedAt: "2026-08-28T02:30:00.000Z", moneyReward: 950, technologyPointsReward: 4, outcome: "completed" }],
    },
  };
}

function completedContestRun(seed = "mission-story-10") {
  const start = "2026-08-28T03:01:00.000Z";
  let run = createContestRun({ playerCallsign: "BH1ABC", seed, startedAt: start });
  for (let index = 0; index < 6; index += 1) {
    const mode = index < 3 ? CONTEST_MODES.RUN : CONTEST_MODES.SP;
    run = selectContestMode(run, mode);
    if (mode === CONTEST_MODES.RUN) {
      run = submitContestText(run, contestCqText(run.playerCallsign), { safeToCommit: true }, new Date(Date.parse(start) + (index * 8 + 4) * 1000).toISOString());
    }
    const station = run.candidates[0];
    const observedAt = new Date(Date.parse(start) + (index * 8 + 5) * 1000).toISOString();
    run = submitContestText(run, station.callsign, { safeToCommit: true }, observedAt);
    run = submitContestText(run, contestExchangeText(station, run.playerCallsign, run.nextSerial), { safeToCommit: true }, new Date(Date.parse(observedAt) + 1000).toISOString());
  }
  return finishContestRun(run, "2026-08-28T03:02:00.000Z");
}

test("story ten requires linked contest facts, rewards once, and unlocks the task tree", () => {
  const base = storyNineClaimed();
  const accepted = acceptMission(base, "story-10", "2026-08-28T03:00:00.000Z");
  assert.equal(accepted.accepted, true);
  const run = completedContestRun();
  const active = { ...accepted.save, storyContinuationState: normalizeStoryContinuationState({ ...accepted.save.storyContinuationState, chapter10: normalizeContestState({ activeRun: run }) }) };
  const settled = settleContestRun(active, run, "2026-08-28T03:04:00.000Z");
  assert.equal(settled.settled, true);
  assert.equal(missionBoard(settled.save).story.find(({ id }) => id === "story-10").status, "ready");
  const afterLaterContact = withLaterOrdinaryContact(settled.save, "contest", "later-contest-contact", "2026-08-28T03:04:10.000Z", "2026-08-28T03:04:20.000Z");
  assert.equal(missionBoard(afterLaterContact).story.find(({ id }) => id === "story-10").status, "ready");
  const claimed = claimMission(afterLaterContact, "story-10", "2026-08-28T03:05:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 1100);
  assert.equal(claimed.technologyPointsAwarded, 5);
  assert.equal(claimed.save.money, base.money + 1100);
  assert.equal(claimed.save.technologyPoints, base.technologyPoints + 5);
  assert.equal(claimed.save.storyContinuationState.chapter10.taskTreeUnlocked, true);
  assert.equal(claimMission(claimed.save, "story-10").reason, "MISSION_ALREADY_CLAIMED");
});

test("story ten rejects pre-acceptance and partial contest proof sets", () => {
  const base = storyNineClaimed();
  const run = completedContestRun("mission-story-10-forged");
  const accepted = acceptMission(base, "story-10", "2026-08-28T03:00:00.000Z").save;
  const active = { ...accepted, storyContinuationState: normalizeStoryContinuationState({ ...accepted.storyContinuationState, chapter10: normalizeContestState({ activeRun: run }) }) };
  const settled = settleContestRun(active, run, "2026-08-28T03:04:00.000Z").save;
  for (const forged of [
    { ...settled, qsoLogs: settled.qsoLogs.slice(1) },
    { ...settled, operatorRelationships: settled.operatorRelationships.slice(1) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter10: normalizeContestState({ ...settled.storyContinuationState.chapter10, records: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter10: normalizeContestState({ ...settled.storyContinuationState.chapter10, settledRunIds: [] }) }) },
  ]) {
    assert.equal(missionBoard(forged).story.find(({ id }) => id === "story-10").status, "active");
    assert.equal(claimMission(forged, "story-10").reason, "MISSION_NOT_COMPLETE");
  }
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

test("mission state normalization rejects corrupt or duplicate mission subledgers", () => {
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
  assert.deepEqual(normalized.claimedMissionIds, []);
  assert.deepEqual(normalized.history, []);
  assert.deepEqual(missionSummary(save()).storyClaimed, 0);

  assert.deepEqual(normalizeMissionState({
    claimedMissionIds: ["story-07", "story-07"],
  }).claimedMissionIds, []);

  const duplicateBaseline = normalizeMissionState({
    activeMissions: [{
      id: "story-07",
      acceptedAt: "2026-08-28T00:00:00.000Z",
      baselineQsoIds: ["q-1", "q-1"],
    }],
  });
  assert.equal(duplicateBaseline.activeMissions.length, 1);
  assert.deepEqual(duplicateBaseline.activeMissions[0].baselineQsoIds, []);

  assert.deepEqual(normalizeMissionState({
    activeMissions: [
      { id: "story-07", acceptedAt: "2026-08-28T00:00:00.000Z" },
      { id: "story-07", acceptedAt: "2026-08-28T00:01:00.000Z" },
    ],
  }).activeMissions, []);
});

test("mission state normalization rejects inherited slots and bounds hostile ledgers", () => {
  const inheritedClaims = [];
  inheritedClaims.length = 1;
  Object.setPrototypeOf(inheritedClaims, Object.assign(Object.create(Array.prototype), { 0: "story-07" }));
  const inheritedMission = Object.create({
    id: "story-08",
    acceptedAt: "2026-08-28T10:00:00.000Z",
  });
  const source = {};
  Object.defineProperties(source, {
    claimedMissionIds: { value: inheritedClaims, enumerable: true },
    activeMissions: { value: [inheritedMission], enumerable: true },
  });
  const inherited = normalizeMissionState(source);
  assert.deepEqual(inherited.claimedMissionIds, []);
  assert.deepEqual(inherited.activeMissions, []);

  let numericReads = 0;
  const hugeClaims = new Proxy(Array.from({ length: 10_000 }, (_, index) => index === 9_999 ? "story-07" : "invalid"), {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property))) numericReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const bounded = normalizeMissionState({ claimedMissionIds: hugeClaims });
  assert.deepEqual(bounded.claimedMissionIds, []);
  assert.equal(numericReads, 0);
});

test("mission state normalization fails closed on descriptor traps and hostile string coercion", () => {
  const hostileSource = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("source descriptor boom"); },
  });
  assert.doesNotThrow(() => normalizeMissionState(hostileSource));
  assert.deepEqual(normalizeMissionState(hostileSource), emptyMissionState());

  const hostileItem = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("item descriptor boom"); },
  });
  assert.doesNotThrow(() => normalizeMissionState({ activeMissions: [hostileItem] }));
  assert.deepEqual(normalizeMissionState({ activeMissions: [hostileItem] }).activeMissions, []);

  const hostileCoercion = Object.freeze({
    toString() { throw new Error("coercion boom"); },
  });
  assert.doesNotThrow(() => normalizeMissionState({ claimedMissionIds: [hostileCoercion, "story-07"] }));
  assert.deepEqual(
    normalizeMissionState({ claimedMissionIds: [hostileCoercion, "story-07"] }).claimedMissionIds,
    [],
  );
  assert.deepEqual(normalizeMissionState({ claimedMissionIds: [{}, "story-07"] }).claimedMissionIds, []);
  assert.deepEqual(normalizeMissionState({ claimedMissionIds: ["invalid", "story-07"] }).claimedMissionIds, []);
});

test("mission history and event ledgers fail closed on invalid, duplicate, or noncanonical records", () => {
  const story07 = {
    id: "story-07",
    claimedAt: "2026-08-28T01:00:00.000Z",
    moneyReward: 800,
    technologyPointsReward: 4,
  };
  const story08 = {
    id: "story-08",
    claimedAt: "2026-08-28T02:00:00.000Z",
    moneyReward: 850,
    technologyPointsReward: 4,
  };
  assert.deepEqual(normalizeMissionState({ history: [{}, story07] }).history, []);
  assert.deepEqual(normalizeMissionState({ history: [story07, story07] }).history, []);
  assert.deepEqual(normalizeMissionState({ history: [story08, story07] }).history, []);
  assert.deepEqual(normalizeMissionState({ history: [story07, story08] }).history.map(({ id }) => id), ["story-07", "story-08"]);

  const event1 = {
    id: "mission-qso:q-1",
    qsoId: "q-1",
    occurredAt: "2026-08-28T01:00:00.000Z",
    missionIds: ["story-07"],
  };
  const event2 = {
    id: "mission-qso:q-2",
    qsoId: "q-2",
    occurredAt: "2026-08-28T02:00:00.000Z",
    missionIds: ["story-08"],
  };
  assert.deepEqual(normalizeMissionState({ events: [{}, event1] }).events, []);
  assert.deepEqual(normalizeMissionState({ events: [event1, event1] }).events, []);
  assert.deepEqual(normalizeMissionState({ events: [event2, event1] }).events, []);
  assert.deepEqual(normalizeMissionState({ events: [event1, event2] }).events.map(({ id }) => id), ["mission-qso:q-1", "mission-qso:q-2"]);

  const invalidMissionIds = normalizeMissionState({
    events: [{ ...event1, missionIds: ["invalid", "story-07"] }],
  });
  assert.equal(invalidMissionIds.events.length, 1);
  assert.deepEqual(invalidMissionIds.events[0].missionIds, []);
});
