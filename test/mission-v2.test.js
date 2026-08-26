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
import { emptyLightsEventState } from "../src/game/lightsSettlement.js";

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

function withExpeditionEvidence(save, overrides = {}) {
  const runId = overrides.runId ?? "new-run";
  const qsoId = overrides.qsoId ?? `expedition-qso:${runId}`;
  const siteId = overrides.siteId ?? "sunward-hill";
  const personId = overrides.personId ?? "person:sora";
  const stationId = overrides.stationId ?? "station:sim6jp";
  const completedAt = overrides.completedAt ?? "2026-08-12T10:00:00.000Z";
  return {
    ...save,
    expeditionState: {
      ...save.expeditionState,
      settledRunIds: [...(save.expeditionState?.settledRunIds ?? []), runId],
      completedRuns: [...(save.expeditionState?.completedRuns ?? []), {
        runId, completedAt, siteId, qsoId, personId, stationId,
      }],
    },
    qsoRecords: {
      ...(save.qsoRecords ?? {}),
      settledQsoIds: [...(save.qsoRecords?.settledQsoIds ?? []), qsoId],
    },
    qsoLogs: [{
      id: qsoId,
      callsign: "SIM6JP",
      completedAt,
      expeditionRunId: runId,
      expeditionSiteId: siteId,
      playerLocationId: `expedition:${siteId}`,
      personId,
      stationId,
      isFictional: true,
    }, ...(save.qsoLogs ?? [])],
  };
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

test("chapter five unlocks after chapter four and only accepts a new base lights result", () => {
  const completedAt = "2026-08-12T11:00:00.000Z";
  const oldResult = {
    runId: "story:old", score: 400, grade: "base", completedAt: "2026-08-12T08:00:00.000Z",
  };
  const unlocked = baseSave({
    knownOperatorNames: ["NOVA"],
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04"],
    }),
    lightsEventState: {
      ...emptyLightsEventState(), settledRunIds: [oldResult.runId], storyBest: oldResult,
    },
  });
  const board = missionBoard(unlocked).story;
  assert.equal(board.length, 6);
  assert.equal(board[4].status, "available");
  assert.equal(board[4].objective, "lights-event");
  assert.deepEqual(board[4].contract, {
    missionPhase: "lights-control",
    targetCallsign: null,
    requiredTopics: ["CALLSIGN", "RST", "REGION"],
    recoveryActions: ["AGN", "QRS"],
    maximumPropagationLevel: null,
    recoveryRequired: false,
    requiredDistinctOperators: 0,
    eventId: "lights-across-air",
    eventMode: "story",
    minimumGrade: "base",
  });

  const accepted = acceptMission(unlocked, "story-05", "2026-08-12T09:00:00.000Z");
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.save.missionState.activeMissions[0].baselineLightsRunIds, ["story:old"]);
  assert.equal(missionBoard(accepted.save).story[4].status, "active");

  const readySave = {
    ...accepted.save,
    lightsEventState: {
      ...accepted.save.lightsEventState,
      settledRunIds: ["story:old", "story:new"],
      storyBest: { runId: "story:new", score: 835, grade: "gold", completedAt },
    },
  };
  assert.equal(missionBoard(readySave).story[4].status, "ready");
  const claimed = claimMission(readySave, "story-05", "2026-08-12T11:05:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 500);
  assert.equal(claimed.technologyPointsAwarded, 2);
  assert.equal(claimed.save.money, 500);
  assert.equal(claimed.save.technologyPoints, 2);
  assert.deepEqual(claimed.save.knownOperatorNames, ["NOVA", "SORA"]);
  assert.equal(claimMission(claimed.save, "story-05").reason, "MISSION_ALREADY_CLAIMED");
});

test("chapter five remains locked before chapter four is claimed", () => {
  const board = missionBoard(baseSave({
    missionState: normalizeMissionState({ claimedMissionIds: ["story-01", "story-02", "story-03"] }),
  })).story;
  assert.equal(board[4].id, "story-05");
  assert.equal(board[4].status, "locked");
});

test("chapter six unlocks only after chapter five and needs no optional technology or money", () => {
  const noGrind = baseSave({
    money: 0,
    technologyPoints: 0,
    unlockedTechnologies: [],
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
    }),
  });
  const board = missionBoard(noGrind).story;
  assert.equal(board.length, 6);
  assert.equal(board.at(-1).id, "story-06");
  assert.equal(board.at(-1).status, "available");
  assert.equal(board.at(-1).objective, "hill-expedition");
  assert.deepEqual(board.at(-1).contract.requiredTopics, ["QTH", "POWER", "ANTENNA"]);
  assert.equal(acceptMission(noGrind, "story-06", ACCEPTED_AT).accepted, true);

  const locked = missionBoard(baseSave({
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04"],
    }),
  })).story.at(-1);
  assert.equal(locked.id, "story-06");
  assert.equal(locked.status, "locked");
});

test("chapter six requires a bounded, fully linked expedition settlement before claim", () => {
  const accepted = acceptMission(baseSave({
    expeditionState: {
      version: 1,
      activeRun: null,
      settledRunIds: ["old-run"],
      completedRuns: [{
        runId: "old-run", completedAt: "2026-08-12T08:00:00.000Z",
        siteId: "sunward-hill", qsoId: "expedition-qso:old-run",
      }],
      expeditionTreeUnlocked: false,
    },
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
    }),
  }), "story-06", ACCEPTED_AT);
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.save.missionState.activeMissions[0].baselineExpeditionRunIds, ["old-run"]);
  assert.equal(missionBoard(accepted.save).story.at(-1).status, "active");

  const linked = withExpeditionEvidence(accepted.save);
  const summaryOnly = {
    ...accepted.save,
    expeditionState: {
      ...accepted.save.expeditionState,
      completedRuns: linked.expeditionState.completedRuns,
    },
  };
  const settledOnly = {
    ...summaryOnly,
    expeditionState: {
      ...summaryOnly.expeditionState,
      settledRunIds: linked.expeditionState.settledRunIds,
    },
  };
  const qsoOnly = {
    ...summaryOnly,
    qsoRecords: linked.qsoRecords,
    qsoLogs: linked.qsoLogs,
  };
  const qsoLedgerOnly = { ...settledOnly, qsoRecords: linked.qsoRecords };
  const wrongRunLink = {
    ...linked,
    qsoLogs: linked.qsoLogs.map((log) => ({ ...log, expeditionRunId: "other-run" })),
  };
  const wrongSiteLink = {
    ...linked,
    qsoLogs: linked.qsoLogs.map((log) => ({ ...log, expeditionSiteId: "lakeview-hill" })),
  };
  const wrongIdentityLink = {
    ...linked,
    qsoLogs: linked.qsoLogs.map((log) => ({ ...log, stationId: "station:other" })),
  };
  const forgedIdentityPair = {
    ...linked,
    expeditionState: {
      ...linked.expeditionState,
      completedRuns: linked.expeditionState.completedRuns.map((run) => ({
        ...run, personId: "person:legacy:SIM6JP", stationId: "station:legacy:SIM6JP",
      })),
    },
    qsoLogs: linked.qsoLogs.map((log) => ({
      ...log, personId: "person:legacy:SIM6JP", stationId: "station:legacy:SIM6JP",
    })),
  };
  for (const forged of [
    summaryOnly, settledOnly, qsoOnly, qsoLedgerOnly,
    wrongRunLink, wrongSiteLink, wrongIdentityLink, forgedIdentityPair,
  ]) {
    assert.equal(missionBoard(forged).story.at(-1).status, "active");
    const rejected = claimMission(forged, "story-06", "2026-08-12T10:05:00.000Z");
    assert.equal(rejected.claimed, false);
    assert.equal(rejected.reason, "MISSION_NOT_COMPLETE");
    assert.equal(rejected.save.money, forged.money);
    assert.equal(rejected.save.technologyPoints, forged.technologyPoints);
    assert.equal(rejected.save.expeditionState.expeditionTreeUnlocked, false);
  }

  assert.equal(missionBoard(linked).story.at(-1).status, "ready");
  const claimed = claimMission(linked, "story-06", "2026-08-12T10:05:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 650);
  assert.equal(claimed.technologyPointsAwarded, 3);
  assert.equal(claimed.save.expeditionState.expeditionTreeUnlocked, true);
});

test("story-six and earlier mission claims saturate integer rewards safely", () => {
  const earlierReady = {
    ...storyFourSave(),
    money: Number.MAX_SAFE_INTEGER,
    technologyPoints: Number.MAX_SAFE_INTEGER,
    qsoLogs: [rainLog()],
  };
  const earlierClaim = claimMission(earlierReady, "story-04", "2026-08-12T10:05:00.000Z");
  assert.equal(earlierClaim.claimed, true);
  assert.equal(earlierClaim.save.money, Number.MAX_SAFE_INTEGER);
  assert.equal(earlierClaim.save.technologyPoints, Number.MAX_SAFE_INTEGER);

  const accepted = acceptMission(baseSave({
    money: Number.MAX_SAFE_INTEGER,
    technologyPoints: Number.MAX_SAFE_INTEGER,
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
    }),
    expeditionState: { settledRunIds: [], completedRuns: [] },
  }), "story-06", ACCEPTED_AT).save;
  const ready = withExpeditionEvidence(accepted, { runId: "bounded-story-six" });
  const storySixClaim = claimMission(ready, "story-06", "2026-08-12T10:05:00.000Z");
  assert.equal(storySixClaim.claimed, true);
  assert.equal(storySixClaim.save.money, Number.MAX_SAFE_INTEGER);
  assert.equal(storySixClaim.save.technologyPoints, Number.MAX_SAFE_INTEGER);
  assert.equal(storySixClaim.save.expeditionState.expeditionTreeUnlocked, true);
});

test("chapter six mission evaluation bounds hostile expedition history scans", () => {
  const guarded = (tail) => new Proxy(
    [...Array(9_999).fill("old"), tail],
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded mission expedition scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const unlocked = baseSave({
    expeditionState: { settledRunIds: guarded("old-run"), completedRuns: [] },
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
    }),
  });
  const accepted = acceptMission(unlocked, "story-06", ACCEPTED_AT);
  assert.equal(accepted.accepted, true);
  assert.ok(accepted.save.missionState.activeMissions[0].baselineExpeditionRunIds.length <= 200);

  const completedRuns = guarded({
    runId: "new-run", completedAt: "2026-08-12T10:00:00.000Z",
    siteId: "sunward-hill", qsoId: "expedition-qso:new-run",
    personId: "person:sora", stationId: "station:sim6jp",
  });
  assert.equal(missionBoard({
    ...accepted.save,
    qsoLogs: guarded({
      id: "expedition-qso:new-run", completedAt: "2026-08-12T10:00:00.000Z",
      callsign: "SIM6JP",
      expeditionRunId: "new-run", expeditionSiteId: "sunward-hill",
      playerLocationId: "expedition:sunward-hill",
      personId: "person:sora", stationId: "station:sim6jp", isFictional: true,
    }),
    qsoRecords: { settledQsoIds: guarded("expedition-qso:new-run") },
    expeditionState: {
      ...accepted.save.expeditionState,
      settledRunIds: guarded("new-run"),
      completedRuns,
    },
  }).story.at(-1).status, "ready");
});
