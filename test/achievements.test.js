import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_REWARDS_VERSION,
  evaluateAchievements,
  findNewlyUnlockedAchievements,
  settleAchievementRewards,
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
function progressOf({ id, current, target, unlocked, progress }) {
  return { id, current, target, unlocked, progress };
}


test("returns the complete locked achievement catalog for an empty or malformed old save", () => {
  for (const save of [null, {}, { qsoLogs: "bad", qsoRecords: { total: "nope" } }]) {
    const achievements = evaluateAchievements(save);
    assert.deepEqual(achievements.map(({ id }) => id), [
      "first-qso", "qso-5", "qso-10", "dx-5000", "weak-signal", "regions-3",
      "independent-watch", "radio-upgrade", "antenna-upgrade", "first-accessory", "first-name",
      "lights-base", "lights-silver", "lights-gold", "lights-annual", "lights-may5",
    ]);
    assert.equal(achievements.length, 16);
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

  assert.deepEqual(progressOf(byId["first-qso"]), {
    id: "first-qso", current: 7, target: 1, unlocked: true, progress: 1,
  });
  assert.deepEqual(progressOf(byId["qso-5"]), {
    id: "qso-5", current: 7, target: 5, unlocked: true, progress: 1,
  });
  assert.deepEqual(progressOf(byId["qso-10"]), {
    id: "qso-10", current: 7, target: 10, unlocked: false, progress: 0.7,
  });
  assert.deepEqual(progressOf(byId["dx-5000"]), {
    id: "dx-5000", current: 6250.5, target: 5000, unlocked: true, progress: 1,
  });
  assert.deepEqual(progressOf(byId["weak-signal"]), {
    id: "weak-signal", current: 2, target: 1, unlocked: true, progress: 1,
  });
  assert.deepEqual(progressOf(byId["regions-3"]), {
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
  assert.deepEqual(progressOf(weakSignal), {
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

test("achievement rewards add money and technology points exactly once", () => {
  const save = {
    money: 10,
    technologyPoints: 2,
    claimedAchievementRewards: [],
    qsoLogs: [],
    qsoRecords: { total: 10, longestDistanceKm: 5100, contactedRegions: ["AS-JA", "NA-W", "EU-W"], weakSignalQsos: 1 },
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
    knownOperatorNames: [],
  };
  const first = settleAchievementRewards(save);
  assert.deepEqual(first.newlyAwarded.map(({ id }) => id), [
    "first-qso", "qso-5", "qso-10", "dx-5000", "weak-signal", "regions-3",
  ]);
  assert.equal(first.moneyAwarded, 1670);
  assert.equal(first.technologyPointsAwarded, 2);
  assert.equal(first.save.money, 1680);
  assert.equal(first.save.technologyPoints, 4);

  const duplicate = settleAchievementRewards(first.save);
  assert.deepEqual(duplicate.newlyAwarded, []);
  assert.equal(duplicate.moneyAwarded, 0);
  assert.equal(duplicate.technologyPointsAwarded, 0);
  assert.equal(duplicate.save.money, 1680);
  assert.equal(duplicate.save.technologyPoints, 4);
});

test("equipment and people achievements use inventory and discovered-name state", () => {
  const achievements = evaluateAchievements({ ownedEquipment: ["squid-01", "usdr-8"], ownedAntennas: ["dipole", "vertical"], accessories: ["cw-filter-500"], knownOperatorNames: ["Morse", "morse", "Wang"] });
  const unlocked = achievements.filter(({ unlocked }) => unlocked).map(({ id }) => id);
  assert.deepEqual(unlocked, ["radio-upgrade", "antenna-upgrade", "first-accessory", "first-name"]);
});

function lightsArchive({ mode = "story", grade = "base", stamp = "none", stationDate = "2026-05-02" } = {}) {
  const run = {
    version: 1, eventRunId: `${mode}:${grade}:${stamp}`, mode,
    startedAt: "2026-05-02T00:00:00.000Z", completedAt: "2026-05-02T00:08:00.000Z",
    stationDate, score: grade === "gold" ? 800 : grade === "silver" ? 600 : 400,
    grade, stamp, playerCallsign: "BH1ABC", contacts: [],
  };
  return { version: 1, storyBest: mode === "story" ? run : null, annualBests: mode === "annual" ? [run] : [], practiceBests: [] };
}

test("lights achievements cover base, silver, gold, annual participation, and May 5", () => {
  assert.equal(ACHIEVEMENT_REWARDS_VERSION, 2);
  const gold = evaluateAchievements({ eventRunArchive: lightsArchive({ mode: "annual", grade: "gold", stamp: "special", stationDate: "2026-05-05" }) });
  assert.deepEqual(gold.filter(({ unlocked }) => unlocked).map(({ id }) => id), [
    "lights-base", "lights-silver", "lights-gold", "lights-annual", "lights-may5",
  ]);
  const silver = Object.fromEntries(evaluateAchievements({ eventRunArchive: lightsArchive({ grade: "silver" }) }).map((item) => [item.id, item]));
  assert.equal(silver["lights-base"].unlocked, true);
  assert.equal(silver["lights-silver"].unlocked, true);
  assert.equal(silver["lights-gold"].unlocked, false);
  assert.equal(silver["lights-annual"].unlocked, false);
});

test("v1 migration recognizes historical lights milestones without back-paying rewards", () => {
  const legacy = {
    achievementRewardsVersion: 1,
    claimedAchievementRewards: [],
    money: 55,
    technologyPoints: 3,
    eventRunArchive: lightsArchive({ mode: "annual", grade: "gold", stamp: "special", stationDate: "2026-05-05" }),
  };
  const settlement = settleAchievementRewards(legacy);
  assert.deepEqual(settlement.newlyAwarded, []);
  assert.equal(settlement.moneyAwarded, 0);
  assert.equal(settlement.technologyPointsAwarded, 0);
  assert.equal(settlement.save.money, 55);
  assert.equal(settlement.save.technologyPoints, 3);
  assert.deepEqual(settlement.save.claimedAchievementRewards.slice(-5), [
    "lights-base", "lights-silver", "lights-gold", "lights-annual", "lights-may5",
  ]);
});

test("new v2 saves receive lights rewards once when milestones are newly reached", () => {
  const save = {
    achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION,
    claimedAchievementRewards: [], money: 0, technologyPoints: 0,
    eventRunArchive: lightsArchive({ mode: "annual", grade: "gold", stamp: "special", stationDate: "2026-05-05" }),
  };
  const first = settleAchievementRewards(save);
  assert.deepEqual(first.newlyAwarded.map(({ id }) => id), [
    "lights-base", "lights-silver", "lights-gold", "lights-annual", "lights-may5",
  ]);
  const duplicate = settleAchievementRewards(first.save);
  assert.deepEqual(duplicate.newlyAwarded, []);
  assert.equal(duplicate.save.money, first.save.money);
});
