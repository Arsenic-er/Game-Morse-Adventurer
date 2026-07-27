import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAchievements,
  findNewlyUnlockedAchievements,
} from "../src/game/achievements.js";

function log(overrides = {}) {
  return {
    id: "qso-1",
    startedAt: "2026-07-27T00:00:00.000Z",
    completedAt: "2026-07-27T00:01:00.000Z",
    playerCallsign: "BH1ABC",
    callsign: "JA1SIM",
    location: "AS-JA",
    distanceKm: 1200,
    finalPropagationLevel: 3,
    ...overrides,
  };
}

test("returns six locked achievements for an empty or malformed old save", () => {
  for (const save of [null, {}, { qsoLogs: "bad", qsoRecords: { total: "nope" } }]) {
    const achievements = evaluateAchievements(save);
    assert.deepEqual(achievements.map(({ id }) => id), [
      "first-qso", "qso-5", "qso-10", "dx-5000", "weak-signal", "regions-3",
    ]);
    assert.equal(achievements.length, 6);
    for (const achievement of achievements) {
      assert.equal(achievement.current, 0);
      assert.equal(achievement.unlocked, false);
      assert.equal(achievement.progress, 0);
    }
  }
});

test("uses durable aggregate records for count, distance, and contacted regions", () => {
  const achievements = evaluateAchievements({
    qsoLogs: [],
    qsoRecords: {
      total: 7,
      longestDistanceKm: 6250.5,
      contactedRegions: ["AS-JA", "NA-W", "EU-W", "AS-JA"],
      weakSignalQsos: 2,
    },
  });
  const byId = Object.fromEntries(achievements.map((value) => [value.id, value]));

  assert.deepEqual(byId["first-qso"], {
    id: "first-qso", current: 7, target: 1, unlocked: true, progress: 1,
  });
  assert.deepEqual(byId["qso-5"], {
    id: "qso-5", current: 7, target: 5, unlocked: true, progress: 1,
  });
  assert.deepEqual(byId["qso-10"], {
    id: "qso-10", current: 7, target: 10, unlocked: false, progress: 0.7,
  });
  assert.deepEqual(byId["dx-5000"], {
    id: "dx-5000", current: 6250.5, target: 5000, unlocked: true, progress: 1,
  });
  assert.deepEqual(byId["weak-signal"], {
    id: "weak-signal", current: 2, target: 1, unlocked: true, progress: 1,
  });
  assert.deepEqual(byId["regions-3"], {
    id: "regions-3", current: 3, target: 3, unlocked: true, progress: 1,
  });
});

test("falls back to valid retained logs when aggregate records are absent", () => {
  const achievements = evaluateAchievements({
    qsoLogs: [
      log({ id: "one", location: "AS-JA", distanceKm: 1000 }),
      log({ id: "two", location: "NA-W", distanceKm: 5100, finalPropagationLevel: 2 }),
      log({ id: "three", location: "EU-W", distanceKm: 3000 }),
      { finalPropagationLevel: 1 },
    ],
  });
  const byId = Object.fromEntries(achievements.map((value) => [value.id, value]));

  assert.equal(byId["first-qso"].unlocked, true);
  assert.equal(byId["qso-5"].current, 3);
  assert.equal(byId["qso-5"].progress, 0.6);
  assert.equal(byId["dx-5000"].current, 5100);
  assert.equal(byId["dx-5000"].unlocked, true);
  assert.equal(byId["weak-signal"].unlocked, true);
  assert.equal(byId["regions-3"].unlocked, true);
});

test("does not award weak-signal achievement for invalid logs or missing levels", () => {
  const achievements = evaluateAchievements({
    qsoLogs: [
      log({ id: "missing-level", finalPropagationLevel: undefined }),
      log({ id: "invalid-level", finalPropagationLevel: -1 }),
      { finalPropagationLevel: 1 },
    ],
  });
  const weakSignal = achievements.find(({ id }) => id === "weak-signal");
  assert.deepEqual(weakSignal, {
    id: "weak-signal", current: 0, target: 1, unlocked: false, progress: 0,
  });
});

test("sanitizes corrupt aggregate numbers without lowering valid log progress", () => {
  const achievements = evaluateAchievements({
    qsoRecords: {
      total: -50,
      longestDistanceKm: Number.POSITIVE_INFINITY,
      contactedRegions: [null, 7, "", " AS-JA "],
    },
    qsoLogEntries: [log({ distanceKm: 2500, location: "NA-W" })],
  });
  const byId = Object.fromEntries(achievements.map((value) => [value.id, value]));

  assert.equal(byId["first-qso"].current, 1);
  assert.equal(byId["dx-5000"].current, 2500);
  assert.equal(byId["dx-5000"].progress, 0.5);
  assert.equal(byId["regions-3"].current, 2);
  assert.equal(byId["regions-3"].progress, 2 / 3);
});

test("finds only false-to-true unlocks in fixed catalog order", () => {
  const previousSave = {
    qsoRecords: {
      total: 4,
      longestDistanceKm: 4900,
      contactedRegions: ["AS-JA", "NA-W"],
      weakSignalQsos: 0,
    },
  };
  const nextSave = {
    qsoRecords: {
      total: 5,
      longestDistanceKm: 6100,
      contactedRegions: ["AS-JA", "NA-W", "EU-W"],
      weakSignalQsos: 1,
    },
  };

  const unlocked = findNewlyUnlockedAchievements(previousSave, nextSave);
  assert.deepEqual(unlocked.map(({ id }) => id), [
    "qso-5",
    "dx-5000",
    "weak-signal",
    "regions-3",
  ]);
  assert.ok(unlocked.every((achievement) => achievement.unlocked));
});

test("does not repeat achievements that were already unlocked", () => {
  const unlocked = findNewlyUnlockedAchievements(
    { qsoRecords: { total: 5 } },
    { qsoRecords: { total: 10 } },
  );

  assert.deepEqual(unlocked.map(({ id }) => id), ["qso-10"]);
});

test("new-unlock comparison safely handles malformed save snapshots", () => {
  assert.deepEqual(findNewlyUnlockedAchievements(null, undefined), []);
  assert.deepEqual(
    findNewlyUnlockedAchievements(
      { qsoLogs: "bad", qsoRecords: { total: Number.NaN } },
      { qsoLogs: 42, qsoRecords: { total: "1" } },
    ).map(({ id }) => id),
    ["first-qso"],
  );
  assert.deepEqual(
    findNewlyUnlockedAchievements(
      { qsoRecords: { total: 10 } },
      { qsoRecords: { total: "corrupt" } },
    ),
    [],
  );
});
