import test from "node:test";
import assert from "node:assert/strict";
import { createSave } from "../src/game/saveStore.js";
import {
  LIGHTS_EVENT_STATE_VERSION,
  emptyLightsEventState,
  normalizeLightsEventState,
  settleLightsRun,
} from "../src/game/lightsSettlement.js";
import { EVENT_RUN_ARCHIVE_VERSION } from "../src/game/eventRunArchive.js";

const LOCATION_BY_REGION = Object.freeze({
  JP: "japan-tokyo-kanto",
  US: "usa-new-england",
  CN: "china-chengdu-plain",
  GE: "europe-rhine-valley",
  CH: "europe-swiss-lake",
  FI: "europe-finland-lake",
});

function contact(index, region = ["JP", "US", "CN", "GE", "CH", "FI", "JP"][index]) {
  return {
    id: `story:lights:${index}`,
    npcId: `N1-${region}-${String(index + 1).padStart(4, "0")}`,
    callsign: `SIM${index}EV`,
    eventRegionCode: region,
    locationId: LOCATION_BY_REGION[region],
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

test("lights state normalization bounds the hostile arrays it scans", () => {
  const settledRunIds = Array.from({ length: 10_000 }, (_, index) => `run-${index}`);
  const practiceRecords = Array.from({ length: 10_000 }, (_, index) => ({
    dateKey: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    bestScore: 1, bestGrade: "base", moneyPaid: 40,
  }));
  settledRunIds[0] = { toString() { throw new Error("unbounded-run-scan"); } };
  Object.defineProperty(practiceRecords[0], "dateKey", { get() { throw new Error("unbounded-date-scan"); } });
  assert.doesNotThrow(() => normalizeLightsEventState({ settledRunIds, practiceRecords }));
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
  assert.equal(settled.save.operatorRelationships.length, 8);
  const sora = settled.save.operatorRelationships.find(({ personId }) => personId === "person:sora");
  assert.deepEqual({
    callsign: sora.callsign,
    encounterCount: sora.encounterCount,
    completedQsos: sora.completedQsos,
    lastEncounterId: sora.lastEncounterId,
  }, {
    callsign: "SIM5LT",
    encounterCount: 1,
    completedQsos: 0,
    lastEncounterId: "lights-chase:story:run-1",
  });
  assert.equal(settled.save.qsoLogs.some(({ personId }) => personId === "person:sora"), false);
  assert.ok(settled.save.qsoLogs.every((log) => (
    log.eventId === "lights-across-air"
      && log.eventMode === "story"
      && log.onAirCallsign === "SIM5LT"
      && log.operatorCallsign === "JA1LGT"
      && log.eventRunId === "story:run-1"
      && log.personId.startsWith("person:procedural:N1-")
      && log.stationId.startsWith("station:procedural:N1-")
      && log.rewardBreakdown === null
      && log.credits === 0
  )));
  assert.equal(settled.save.eventRunArchiveVersion, EVENT_RUN_ARCHIVE_VERSION);
  assert.equal(settled.save.eventRunArchive.storyBest.eventRunId, "story:run-1");
  assert.equal(settled.save.eventRunArchive.storyBest.contacts.length, 7);
  assert.deepEqual(new Set(settled.save.eventRunArchive.storyBest.contacts.map(({ timeZone }) => timeZone)), new Set([
    "Asia/Tokyo", "America/New_York", "Asia/Shanghai", "Europe/Berlin", "Europe/Zurich", "Europe/Helsinki",
  ]));
});

test("settlement is idempotent by run id", () => {
  const first = settleLightsRun(createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" }), result());
  const repeated = settleLightsRun(first.save, result());
  assert.equal(repeated.settled, false);
  assert.equal(repeated.reason, "already-settled");
  assert.strictEqual(repeated.save, first.save);
  assert.equal(repeated.moneyAwarded, 0);
});

test("long retry identifiers remain distinct and preserve every contact", () => {
  const prefix = `story:${"retry-chain-".repeat(20)}`;
  const firstResult = result({ runId: `${prefix}:first` });
  firstResult.contacts = firstResult.contacts.map((entry, index) => ({
    ...entry, id: `${prefix}:first:${index}`,
  }));
  const secondResult = result({ runId: `${prefix}:second` });
  secondResult.contacts = secondResult.contacts.map((entry, index) => ({
    ...entry, id: `${prefix}:second:${index}`,
  }));
  const first = settleLightsRun(createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" }), firstResult);
  const second = settleLightsRun(first.save, secondResult);
  assert.equal(first.settled, true);
  assert.equal(second.settled, true);
  assert.equal(new Set(second.save.qsoLogs.map(({ id }) => id)).size, 14);
  assert.equal(second.save.qsoLogs.length, 14);
  assert.deepEqual(new Set(second.save.qsoLogs.map(({ eventRunId }) => eventRunId)), new Set([
    first.result.runId,
    second.result.runId,
  ]));
});

test("annual settlement grants 300 once per station year and improves the best record", () => {
  const save = saveWithStoryComplete();
  const first = settleLightsRun(save, {
    ...result({ mode: "annual", count: 5, runId: "annual:first" }),
    startedAt: "2026-05-03T09:52:00.000Z",
    completedAt: "2026-05-03T10:00:00.000Z",
  }, {
    now: "2026-05-03T10:00:00.000Z",
  });
  assert.equal(first.settled, true);
  assert.equal(first.result.grade, "silver");
  assert.equal(first.moneyAwarded, 400); // 300 annual + first silver lifetime bonus.
  assert.equal(first.annualStamp, "standard");
  assert.equal(first.annualStampGranted, true);
  const improved = settleLightsRun(first.save, {
    ...result({ mode: "annual", count: 7, runId: "annual:gold" }),
    startedAt: "2026-05-05T09:52:00.000Z",
    completedAt: "2026-05-05T10:00:00.000Z",
  }, {
    now: "2026-05-05T10:00:00.000Z",
  });
  assert.equal(improved.moneyAwarded, 100); // only silver -> gold lifetime difference.
  assert.equal(improved.save.worldCalendarState.annualRecords[0].bestGrade, "gold");
  assert.equal(improved.annualStamp, "special");
  assert.equal(improved.annualStampGranted, true);
});

test("annual settlement rejects closed dates and pauses all money during rollback guard", () => {
  const closed = settleLightsRun(saveWithStoryComplete(), {
    ...result({ mode: "annual" }),
    startedAt: "2026-06-01T09:52:00.000Z",
    completedAt: "2026-06-01T10:00:00.000Z",
  }, {
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
  assert.equal(rollback.annualStamp, "none");
  assert.equal(rollback.annualStampGranted, false);
});

test("delayed annual settlement keeps Tokyo, New York, and Rhine event dates while observation controls rollback", () => {
  const cases = [
    {
      name: "Tokyo closes at the end of the May 7 station day",
      locationId: "japan-tokyo-kanto",
      completedAt: "2026-05-07T14:59:00.000Z",
    },
    {
      name: "New York remains open late on the May 7 station day",
      locationId: "usa-new-england",
      completedAt: "2026-05-08T03:59:00.000Z",
    },
    {
      name: "Rhine opens at the start of the May 1 station day",
      locationId: "europe-rhine-valley",
      completedAt: "2026-04-30T22:30:00.000Z",
    },
  ];
  for (const { name, locationId, completedAt } of cases) {
    const save = {
      ...createSave({ callsign: "JA1LGT", locationId }),
      missionState: { claimedMissionIds: ["story-05"] },
      worldCalendarState: {
        version: 1,
        lastTrustedAt: "2026-06-02T12:00:00.000Z",
        rollbackGuardUntil: null,
        annualRecords: [],
      },
    };
    const settled = settleLightsRun(save, {
      ...result({ mode: "annual", count: 3, runId: `boundary:${locationId}` }),
      startedAt: "2026-04-30T22:00:00.000Z",
      completedAt,
    }, { observedAt: "2026-06-01T12:00:00.000Z" });
    assert.equal(settled.settled, true, name);
    assert.equal(settled.reason, "clock-rollback", name);
    assert.equal(settled.moneyAwarded, 0, name);
    assert.equal(settled.save.worldCalendarState.lastTrustedAt, "2026-06-02T12:00:00.000Z", name);
    assert.equal(settled.save.worldCalendarState.rollbackGuardUntil, "2026-06-02T12:00:00.000Z", name);
    assert.equal(settled.save.worldCalendarState.annualRecords[0].year, 2026, name);
  }
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

test("evicted recent run ids remain permanently idempotent through the QSO ledger", () => {
  let save = createSave({ callsign: "JA1LGT", locationId: "japan-tokyo-kanto" });
  for (let index = 0; index < 205; index += 1) {
    save = settleLightsRun(save, result({ runId: `story:archive-${index}` }), {
      now: `2026-05-05T${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
    }).save;
  }
  assert.equal(save.lightsEventState.settledRunIds.includes("story:archive-0"), false);
  const replay = settleLightsRun(save, result({ runId: "story:archive-0" }), {
    now: "2026-05-06T12:00:00.000Z",
  });
  assert.equal(replay.settled, false);
  assert.equal(replay.reason, "already-settled");
});

test("practice rewards stay available during rollback while pruned daily rewards remain durable", () => {
  let save = saveWithStoryComplete();
  for (let index = 0; index < 35; index += 1) {
    const day = new Date(Date.UTC(2026, 5, 1 + index, 12));
    save = settleLightsRun(save, result({
      mode: "practice", count: 3, runId: `practice:day-${index}`,
    }), { now: day }).save;
  }
  const replay = settleLightsRun(save, result({
    mode: "practice", count: 3, runId: "practice:old-date-new-run",
  }), { now: "2026-06-01T12:00:00.000Z" });
  assert.equal(replay.moneyAwarded, 0);
  assert.equal(replay.reason, null);

  const newDay = settleLightsRun(save, result({
    mode: "practice", count: 5, runId: "practice:rollback-new-day",
  }), { now: "2026-06-02T12:00:00.000Z" });
  assert.equal(newDay.moneyAwarded, 120);
  assert.equal(newDay.reason, null);
});
