import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptMission,
  claimMission,
  dailyMissionDefinitions,
  emptyMissionState,
  missionBoard,
  normalizeMissionState,
  recentMissionDna,
  recordMissionQsoEvent,
} from "../src/game/missionSystem.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";

const ACCEPTED_AT = "2026-08-12T09:00:00.000Z";

function baseSave(overrides = {}) {
  return {
    id: "mission-v2-station",
    callsign: "BH1TEST",
    money: 0,
    technologyPoints: 0,
    qsoLogs: [],
    qsoRecords: { total: 0, longestDistanceKm: 0, longestQsoId: null, contactedRegions: [], weakSignalQsos: 0, settledQsoIds: [] },
    operatorRelationships: [],
    completedResearchProjects: [],
    activeResearchProjectId: null,
    missionState: emptyMissionState(),
    ...overrides,
  };
}

function rainLog(overrides = {}) {
  return {
    id: "rain-qso-1",
    completedAt: "2026-08-12T10:00:00.000Z",
    callsign: "SIM2DX",
    location: "JP-NE",
    sent: "579",
    finalPropagationLevel: 2,
    optionalExchangeQuestion: "weather",
    optionalExchangeOutcome: "answered",
    repeatRequests: 1,
    copyQueries: 1,
    attemptHistory: [{ message: "AGN K", result: "repeat", remoteOutcome: "query" }],
    ...overrides,
  };
}

function storyFourSave() {
  return baseSave({
    missionState: normalizeMissionState({
      activeMissions: [{ id: "story-04", acceptedAt: ACCEPTED_AT }],
      claimedMissionIds: ["story-01", "story-02", "story-03"],
    }),
  });
}

test("chapter four requires target, weak propagation, a recovered link, and weather exchange", () => {
  const initial = storyFourSave();
  assert.equal(missionBoard(initial).story[3].status, "active");

  for (const incomplete of [
    rainLog({ callsign: "SIM3RA" }),
    rainLog({ finalPropagationLevel: 3 }),
    rainLog({ repeatRequests: 0, copyQueries: 0, attemptHistory: [] }),
    rainLog({ optionalExchangeOutcome: "skipped" }),
  ]) {
    assert.equal(missionBoard({ ...initial, qsoLogs: [incomplete] }).story[3].status, "active");
  }

  const completed = { ...initial, qsoLogs: [rainLog()] };
  assert.equal(missionBoard(completed).story[3].status, "ready");
  const claimed = claimMission(completed, "story-04", "2026-08-12T10:05:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 420);
  assert.equal(claimed.technologyPointsAwarded, 2);
  assert.deepEqual(claimed.save.knownOperatorNames, ["NOVA"]);
});

test("accepted missions freeze their QSO baseline and store bounded communication events", () => {
  const oldLog = rainLog({ id: "old", completedAt: "2026-08-12T08:30:00.000Z" });
  const accepted = acceptMission(baseSave({ qsoLogs: [oldLog] }), "story-01", ACCEPTED_AT);
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.save.missionState.activeMissions[0].baselineQsoIds, ["old"]);
  assert.equal(missionBoard(accepted.save).story[0].status, "active");

  const updated = recordMissionQsoEvent(accepted.save, rainLog({ id: "new" }));
  assert.equal(updated.missionState.events.length, 1);
  assert.equal(updated.missionState.events[0].qsoId, "new");
  assert.deepEqual(updated.missionState.events[0].missionIds, ["story-01"]);
  assert.equal(recordMissionQsoEvent(updated, rainLog({ id: "new" })).missionState.events.length, 1);
});

test("completed QSO settlement atomically preserves the mission event", () => {
  const accepted = acceptMission(baseSave(), "story-01", ACCEPTED_AT).save;
  const settlement = recordCompletedQso(accepted, {
    ...rainLog({ id: "settled-qso" }),
    startedAt: "2026-08-12T09:58:00.000Z",
    playerCallsign: "BH1TEST",
    sent: "579",
    received: "559",
    distanceKm: 3200,
    frequencyMhz: 14.06,
    operatorProfileId: "weak-signal-listener",
    copyOutcome: "copied",
    transmitAccuracy: 90,
    keyingScore: 84,
  });
  assert.equal(settlement.added, true);
  assert.equal(settlement.save.missionState.events.at(-1).qsoId, "settled-qso");
  assert.equal(missionBoard(settlement.save).story[0].status, "ready");
});

test("daily mission DNA avoids the twelve most recent fingerprints when alternatives exist", () => {
  const firstBoard = dailyMissionDefinitions(baseSave(), "2026-08-12T12:00:00.000Z");
  const history = firstBoard.map((mission, index) => ({
    id: mission.id,
    claimedAt: `2026-08-12T1${index}:00:00.000Z`,
    dnaFingerprint: mission.dna.fingerprint,
  }));
  const next = dailyMissionDefinitions(baseSave({ missionState: normalizeMissionState({ history }) }), "2026-08-13T12:00:00.000Z");
  assert.ok(next.every(({ dna }) => !history.some(({ dnaFingerprint }) => dnaFingerprint === dna.fingerprint)));
  assert.deepEqual(recentMissionDna(baseSave({ missionState: normalizeMissionState({ history }) })), history.map(({ dnaFingerprint }) => dnaFingerprint));
});
