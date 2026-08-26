import assert from "node:assert/strict";
import test from "node:test";

import { createExpeditionLoadout } from "../src/game/expeditionCatalog.js";
import {
  abandonExpeditionRun,
  advanceExpeditionSetup,
  beginExpeditionCq,
  createExpeditionRun,
  emptyExpeditionState,
  normalizeExpeditionState,
  receiveExpeditionContact,
  selectExpeditionSite,
  submitExpeditionExchange,
  tickExpeditionRun,
} from "../src/game/expeditionRun.js";
import {
  EXPEDITION_MONEY_REWARD,
  EXPEDITION_TECHNOLOGY_POINTS_REWARD,
  settleExpeditionRun,
} from "../src/game/expeditionSettlement.js";
import {
  acceptMission, emptyMissionState, missionBoard, normalizeMissionState,
} from "../src/game/missionSystem.js";
import { normalizeSave } from "../src/game/saveStore.js";

const STARTED_AT = "2026-08-25T09:00:00.000Z";

function baseSave(overrides = {}) {
  return {
    id: "chapter-six-save",
    callsign: "BH1ABC",
    locationId: "china-beijing-outskirts",
    equipmentId: "squid-01",
    antennaId: "dipole",
    accessoryId: "none",
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
    money: 100,
    technologyPoints: 4,
    unlockedTechnologies: [],
    completedResearchProjects: [],
    qsoLogs: [],
    qsoRecords: { total: 0, longestDistanceKm: 0, longestQsoId: null, contactedRegions: [], weakSignalQsos: 0, settledQsoIds: [] },
    operatorRelationships: [],
    missionState: emptyMissionState(),
    expeditionState: emptyExpeditionState(),
    ...overrides,
  };
}

function completedRun(runId = "expedition:story-06:success-1") {
  let run = createExpeditionRun({
    runId,
    playerCallsign: "BH1ABC",
    loadout: createExpeditionLoadout({}, { source: "loan" }),
    startedAt: STARTED_AT,
  });
  run = selectExpeditionSite(run, "sunward-hill", "2026-08-25T09:01:00.000Z");
  run = advanceExpeditionSetup(run, "antenna", "2026-08-25T09:02:00.000Z");
  run = advanceExpeditionSetup(run, "power", "2026-08-25T09:03:00.000Z");
  run = beginExpeditionCq(run, {
    observedAt: "2026-08-25T09:04:00.000Z",
    propagationSnapshot: { level: 3, noise: 1, capturedAt: "2026-08-25T09:04:00.000Z" },
  });
  run = receiveExpeditionContact(run, {
    callsign: "SIM6JP",
    personId: "person:sora",
    stationId: "station:sim6jp",
    locationId: "japan-osaka-kansai",
    distanceKm: 410,
    sentRst: "579",
    receivedRst: "559",
    remoteWpm: 18,
    operatorProfileId: "youth-club",
  }, "2026-08-25T09:05:00.000Z");
  return submitExpeditionExchange(
    run,
    "QTH SUNWARD PWR 5W ANT WIRE K",
    { safeToCommit: true },
    "2026-08-25T09:06:00.000Z",
  );
}

function acceptedStorySixSave() {
  const unlocked = baseSave({
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
    }),
  });
  const accepted = acceptMission(unlocked, "story-06", STARTED_AT);
  assert.equal(accepted.accepted, true);
  return accepted.save;
}

function withActiveRun(save, run) {
  return {
    ...save,
    expeditionState: normalizeExpeditionState({
      ...save.expeditionState,
      activeRun: run,
    }),
  };
}

test("successful expedition settlement is atomic and links QSO, SORA relationship, and mission progress", () => {
  const run = completedRun();
  const initial = withActiveRun(acceptedStorySixSave(), run);
  const permanent = {
    locationId: initial.locationId,
    equipmentId: initial.equipmentId,
    antennaId: initial.antennaId,
    ownedEquipment: initial.ownedEquipment,
    ownedAntennas: initial.ownedAntennas,
    accessories: initial.accessories,
  };
  const settled = settleExpeditionRun(initial, run, "2026-08-25T09:06:30.000Z");

  assert.equal(settled.settled, true);
  assert.equal(settled.expeditionMoneyAwarded, EXPEDITION_MONEY_REWARD);
  assert.equal(settled.expeditionTechnologyPointsAwarded, EXPEDITION_TECHNOLOGY_POINTS_REWARD);
  assert.ok(settled.qsoMoneyAwarded > 0);
  assert.equal(settled.save.money, 100 + settled.qsoMoneyAwarded + EXPEDITION_MONEY_REWARD);
  assert.equal(settled.save.technologyPoints, 4 + settled.qsoTechnologyPointsAwarded
    + EXPEDITION_TECHNOLOGY_POINTS_REWARD);
  assert.equal(settled.save.qsoLogs.length, 1);
  assert.equal(settled.save.qsoLogs[0].personId, "person:sora");
  assert.equal(settled.save.qsoLogs[0].stationId, "station:sim6jp");
  assert.equal(settled.save.qsoLogs[0].playerLocationId, "expedition:sunward-hill");
  assert.equal(settled.save.qsoLogs[0].expeditionRunId, run.runId);
  assert.equal(settled.save.qsoLogs[0].expeditionSiteId, "sunward-hill");
  assert.equal(settled.save.operatorRelationships[0].personId, "person:sora");
  assert.equal(settled.save.operatorRelationships[0].completedQsos, 1);
  assert.equal(missionBoard(settled.save).story.at(-1).status, "ready");
  assert.equal(settled.save.expeditionState.completedRuns[0].personId, "person:sora");
  assert.equal(settled.save.expeditionState.completedRuns[0].stationId, "station:sim6jp");
  const normalizedOnce = normalizeSave(settled.save);
  const normalizedTwice = normalizeSave(normalizedOnce);
  assert.deepEqual(normalizedTwice, normalizedOnce);
  assert.equal(missionBoard(normalizedTwice).story.at(-1).status, "ready");
  assert.deepEqual({
    locationId: settled.save.locationId,
    equipmentId: settled.save.equipmentId,
    antennaId: settled.save.antennaId,
    ownedEquipment: settled.save.ownedEquipment,
    ownedAntennas: settled.save.ownedAntennas,
    accessories: settled.save.accessories,
  }, permanent);
});

test("settling the same expedition twice is an exact no-op", () => {
  const run = completedRun();
  const first = settleExpeditionRun(
    withActiveRun(acceptedStorySixSave(), run), run, "2026-08-25T09:06:30.000Z",
  );
  const second = settleExpeditionRun(first.save, run, "2026-08-25T09:07:00.000Z");
  assert.equal(second.settled, false);
  assert.equal(second.reason, "ALREADY_SETTLED");
  assert.equal(second.qsoMoneyAwarded, 0);
  assert.equal(second.expeditionMoneyAwarded, 0);
  assert.equal(second.expeditionTechnologyPointsAwarded, 0);
  assert.equal(second.qsoTechnologyPointsAwarded, 0);
  assert.deepEqual(second.save, first.save);
});

test("failed, abandoned, corrupt, and legacy-baselined runs grant no reward or ordinary QSO", () => {
  const active = beginExpeditionCq(
    advanceExpeditionSetup(
      advanceExpeditionSetup(
        selectExpeditionSite(createExpeditionRun({
          runId: "failed-run",
          playerCallsign: "BH1ABC",
          loadout: createExpeditionLoadout({}, { source: "loan" }),
          startedAt: STARTED_AT,
        }), "sunward-hill", STARTED_AT),
        "antenna", STARTED_AT,
      ),
      "power", STARTED_AT,
    ),
    { observedAt: STARTED_AT },
  );
  const failed = tickExpeditionRun(active, { seconds: 5_000 }, "2026-08-25T10:00:00.000Z");
  const initial = acceptedStorySixSave();
  const rejected = settleExpeditionRun(initial, failed, "2026-08-25T10:00:01.000Z");
  assert.equal(rejected.settled, false);
  assert.equal(rejected.reason, "RUN_NOT_SUCCESSFUL");
  assert.deepEqual(rejected.save, initial);

  const abandoned = abandonExpeditionRun(active, "2026-08-25T10:00:00.000Z");
  const abandonedAttempt = settleExpeditionRun(initial, abandoned, "2026-08-25T10:00:01.000Z");
  assert.equal(abandonedAttempt.settled, false);
  assert.equal(abandonedAttempt.reason, "RUN_NOT_SUCCESSFUL");
  assert.deepEqual(abandonedAttempt.save, initial);

  const legacy = baseSave({
    expeditionState: {
      completedRuns: [{ runId: "legacy-run", completedAt: "2025-01-01T00:00:00Z", siteId: "sunward-hill" }],
    },
  });
  const legacyAttempt = settleExpeditionRun(legacy, completedRun("legacy-run"), "2026-08-25T11:00:00.000Z");
  assert.equal(legacyAttempt.settled, false);
  assert.equal(legacyAttempt.reason, "ALREADY_SETTLED");
  assert.deepEqual(legacyAttempt.save.qsoLogs, []);
  assert.equal(legacyAttempt.save.money, 100);
  assert.equal(legacyAttempt.save.technologyPoints, 4);
});

test("settlement reward counters saturate at safe integer bounds", () => {
  const run = completedRun("bounded-run");
  const initial = withActiveRun(acceptedStorySixSave(), run);
  const settled = settleExpeditionRun({
    ...initial,
    money: Number.MAX_SAFE_INTEGER,
    technologyPoints: Number.MAX_SAFE_INTEGER,
  }, run, "2026-08-25T09:06:30.000Z");
  assert.equal(settled.settled, true);
  assert.equal(settled.save.money, Number.MAX_SAFE_INTEGER);
  assert.equal(settled.save.technologyPoints, Number.MAX_SAFE_INTEGER);
});

test("settlement rejects isolated, mismatched, corrupt, and inherited successes without side effects", () => {
  const valid = completedRun("trusted-run");
  const initial = acceptedStorySixSave();
  const isolated = settleExpeditionRun(initial, valid, "2026-08-25T09:06:30.000Z");
  assert.equal(isolated.settled, false);
  assert.equal(isolated.reason, "RUN_STATE_MISMATCH");
  assert.deepEqual(isolated.save, initial);

  const active = withActiveRun(initial, valid);
  const forged = {
    ...valid,
    setup: { antenna: false, power: true },
    contacts: valid.contacts.map((contact) => ({
      ...contact,
      topics: ["QTH", "POWER", "ANTENNA"],
    })),
  };
  const corrupt = settleExpeditionRun(active, forged, "2026-08-25T09:06:30.000Z");
  assert.equal(corrupt.settled, false);
  assert.equal(corrupt.reason, "RUN_NOT_SUCCESSFUL");
  assert.deepEqual(corrupt.save, active);

  const inherited = Object.create(valid);
  const inheritedAttempt = settleExpeditionRun(active, inherited, "2026-08-25T09:06:30.000Z");
  assert.equal(inheritedAttempt.settled, false);
  assert.equal(inheritedAttempt.reason, "RUN_NOT_SUCCESSFUL");
  assert.deepEqual(inheritedAttempt.save, active);

  const different = completedRun("different-run");
  const mismatched = settleExpeditionRun(active, different, "2026-08-25T09:06:30.000Z");
  assert.equal(mismatched.settled, false);
  assert.equal(mismatched.reason, "RUN_STATE_MISMATCH");
  assert.deepEqual(mismatched.save, active);
  assert.deepEqual(active.qsoLogs, []);
  assert.deepEqual(active.operatorRelationships, []);
});
