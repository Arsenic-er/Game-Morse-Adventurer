import test from "node:test";
import assert from "node:assert/strict";
import { createSave } from "../src/game/saveStore.js";
import {
  LIGHTS_EVENT_STATE_VERSION,
  emptyLightsEventState,
  normalizeLightsEventState,
  settleLightsRun,
} from "../src/game/lightsSettlement.js";

function contact(index, region = ["JP", "US", "CN", "GE", "CH", "FI", "JP"][index]) {
  return {
    id: `story:lights:${index}`,
    callsign: `SIM${index}LT`,
    eventRegionCode: region,
    locationId: `event-${region.toLowerCase()}`,
    operatorName: `OPERATOR ${index}`,
    operatorProfileId: "steady-regular",
    remoteRst: "599",
    sentRst: "579",
    onAirCallsign: "SIM5LT",
    operatorCallsign: "JA1LGT",
  };
}

function result({ mode = "story", count = 7, score = 1, grade = "none", runId = `${mode}:run-1` } = {}) {
  const contacts = Array.from({ length: count }, (_, index) => contact(index));
  return {
    version: 1,
    runId,
    mode,
    startedAt: "2026-05-05T01:00:00.000Z",
    completedAt: "2026-05-05T01:08:00.000Z",
    playerCallsign: "JA1LGT",
    playerRegion: "JP",
    chaseCompleted: mode !== "story" || true,
    contacts,
    validQsoCount: count,
    distinctRegionCount: new Set(contacts.map(({ eventRegionCode }) => eventRegionCode)).size,
    resolvedPileupCount: count,
    successfulPartialCount: Math.max(0, count - 1),
    misidentificationCount: 0,
    agnRequestCount: 0,
    score,
    grade,
  };
}

function saveWithStoryComplete() {
  const save = createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" });
  return {
    ...save,
    missionState: { ...save.missionState, claimedMissionIds: ["story-05"] },
  };
}

test("lights event state has bounded hostile-input normalization", () => {
  assert.deepEqual(emptyLightsEventState(), {
    version: LIGHTS_EVENT_STATE_VERSION,
    settledRunIds: [],
    storyBest: null,
    lifetimeGradePaid: 0,
    practiceRecords: [],
  });
  const normalized = normalizeLightsEventState({
    settledRunIds: Array.from({ length: 500 }, (_, index) => ` run-${index} `),
    storyBest: { score: 99999, grade: "gold", completedAt: "bad" },
    lifetimeGradePaid: 9999,
    practiceRecords: Array.from({ length: 100 }, (_, index) => ({
      dateKey: `2026-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
      bestScore: index,
      bestGrade: "base",
      moneyPaid: 999,
    })),
  });
  assert.equal(normalized.settledRunIds.length, 200);
  assert.equal(normalized.storyBest.completedAt, null);
  assert.equal(normalized.lifetimeGradePaid, 200);
  assert.equal(normalized.practiceRecords.length, 31);
  assert.ok(normalized.practiceRecords.every(({ moneyPaid }) => moneyPaid === 80));
});

test("story settlement recomputes the grade, records event QSOs, and pays only lifetime grade bonus", () => {
  const save = createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" });
  const settled = settleLightsRun(save, result({ grade: "none", score: 1 }), {
    now: "2026-05-05T01:08:00.000Z",
  });
  assert.equal(settled.settled, true);
  assert.equal(settled.result.grade, "gold");
  assert.equal(settled.moneyAwarded, 200);
  assert.equal(settled.technologyPointsAwarded, 0);
  assert.equal(settled.save.money, 200);
  assert.equal(settled.save.lightsEventState.storyBest.grade, "gold");
  assert.equal(settled.save.qsoLogs.length, 7);
  assert.equal(settled.save.qsoRecords.total, 7);
  assert.equal(settled.save.operatorRelationships.length, 7);
  assert.ok(settled.save.qsoLogs.every((log) => (
    log.eventId === "lights-across-air"
      && log.eventMode === "story"
      && log.onAirCallsign === "SIM5LT"
      && log.operatorCallsign === "JA1LGT"
      && log.rewardBreakdown === null
      && log.credits === 0
  )));
});

test("settlement is idempotent by run id", () => {
  const first = settleLightsRun(createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" }), result());
  const repeated = settleLightsRun(first.save, result());
  assert.equal(repeated.settled, false);
  assert.equal(repeated.reason, "already-settled");
  assert.strictEqual(repeated.save, first.save);
  assert.equal(repeated.moneyAwarded, 0);
});

test("annual settlement grants 300 once per station year and improves the best record", () => {
  const save = saveWithStoryComplete();
  const first = settleLightsRun(save, result({ mode: "annual", count: 5, runId: "annual:first" }), {
    now: "2026-05-03T10:00:00.000Z",
  });
  assert.equal(first.settled, true);
  assert.equal(first.result.grade, "silver");
  assert.equal(first.moneyAwarded, 400); // 300 annual + first silver lifetime bonus.
  const improved = settleLightsRun(first.save, result({ mode: "annual", count: 7, runId: "annual:gold" }), {
    now: "2026-05-05T10:00:00.000Z",
  });
  assert.equal(improved.moneyAwarded, 100); // only silver -> gold lifetime difference.
  assert.equal(improved.save.worldCalendarState.annualRecords[0].bestGrade, "gold");
});

test("annual settlement rejects closed dates and pauses all money during rollback guard", () => {
  const closed = settleLightsRun(saveWithStoryComplete(), result({ mode: "annual" }), {
    now: "2026-06-01T10:00:00.000Z",
  });
  assert.equal(closed.settled, false);
  assert.equal(closed.reason, "annual-closed");

  const save = saveWithStoryComplete();
  save.worldCalendarState = {
    version: 1,
    lastTrustedAt: "2026-05-06T10:00:00.000Z",
    rollbackGuardUntil: "2026-05-06T10:00:00.000Z",
    annualRecords: [],
  };
  const rollback = settleLightsRun(save, result({ mode: "annual" }), {
    now: "2026-05-05T10:00:00.000Z",
  });
  assert.equal(rollback.settled, true);
  assert.equal(rollback.moneyAwarded, 0);
  assert.equal(rollback.reason, "clock-rollback");
  assert.equal(rollback.save.lightsEventState.lifetimeGradePaid, 0);
});

test("practice pays only the daily best grade delta", () => {
  const save = saveWithStoryComplete();
  const base = settleLightsRun(save, result({ mode: "practice", count: 3, runId: "practice:base" }), {
    now: "2026-06-01T10:00:00.000Z",
  });
  assert.equal(base.result.grade, "base");
  assert.equal(base.moneyAwarded, 40);
  const silver = settleLightsRun(base.save, result({ mode: "practice", count: 5, runId: "practice:silver" }), {
    now: "2026-06-01T11:00:00.000Z",
  });
  assert.equal(silver.moneyAwarded, 120); // daily +20 and first silver lifetime +100.
  const repeated = settleLightsRun(silver.save, result({ mode: "practice", count: 3, runId: "practice:again" }), {
    now: "2026-06-01T12:00:00.000Z",
  });
  assert.equal(repeated.moneyAwarded, 0);
});
