import assert from "node:assert/strict";
import test from "node:test";

import {
  ECONOMY_PURCHASE_PLAN,
  MISSION_ECONOMY_GATES,
  MISSION_ECONOMY_SIMULATION_VERSION,
  formatMissionEconomyReport,
  simulateMissionEconomy,
} from "../src/game/missionEconomy.js";

test("the balanced mission economy simulation is deterministic", () => {
  const first = simulateMissionEconomy();
  const second = simulateMissionEconomy();
  assert.deepEqual(first, second);
  assert.equal(first.version, MISSION_ECONOMY_SIMULATION_VERSION);
  assert.equal(first.scenario.id, "balanced-operator-v1");
  assert.equal(first.scenario.cycles, 12);
  assert.equal(first.contacts, 24);
});

test("current rewards keep missions meaningful without making them the only income", () => {
  const report = simulateMissionEconomy();
  assert.deepEqual(report.sourceValues.qsoRewards, {
    base: 100,
    independentWatch: 50,
    weakSignal: 75,
    newRegion: 20,
    newDistanceRecord: 25,
  });
  assert.equal(report.sourceValues.storyRewards.reduce((sum, mission) => sum + mission.moneyReward, 0), 2990);
  assert.equal(report.income.qso, 3495);
  assert.equal(report.income.story, 1590);
  assert.equal(report.income.daily, 1700);
  assert.equal(report.income.total, 6785);
  assert.equal(report.income.qso + report.income.mission, report.income.total);
  assert.equal(report.income.qsoShare + report.income.missionShare, 1);
  assert.ok(report.income.qsoShare >= MISSION_ECONOMY_GATES.minimumQsoIncomeShare);
  assert.ok(report.income.missionShare >= MISSION_ECONOMY_GATES.minimumMissionIncomeShare);
  assert.ok(report.income.missionShare <= MISSION_ECONOMY_GATES.maximumMissionIncomeShare);
});

test("money and technology gates produce an explainable staged purchase curve", () => {
  const report = simulateMissionEconomy();
  assert.deepEqual(ECONOMY_PURCHASE_PLAN.map(({ id, price }) => [id, price]), [
    ["vertical", 200],
    ["cw-filter-500", 300],
    ["yagi-3el", 500],
    ["usdr-8", 800],
  ]);
  assert.deepEqual(report.purchasePlan.map(({ id, cumulativeTechnologyCost }) => [id, cumulativeTechnologyCost]), [
    ["vertical", 5],
    ["cw-filter-500", 5],
    ["yagi-3el", 10],
    ["usdr-8", 9],
  ]);
  assert.deepEqual(report.purchases.map(({ id, cycle, contact }) => [id, cycle, contact]), [
    ["vertical", 2, 3],
    ["cw-filter-500", 2, 3],
    ["yagi-3el", 2, 4],
    ["usdr-8", 4, 8],
  ]);
  assert.equal(report.spending.total, 1800);
  assert.equal(report.spending.balance, report.income.total - report.spending.total);
  for (const purchase of report.purchases) {
    const ready = report.technology.productReady[purchase.id];
    assert.ok(ready.contact <= purchase.contact, purchase.id);
  }
});

test("research remains the primary TP source and unlock timing stays bounded", () => {
  const report = simulateMissionEconomy();
  assert.deepEqual({
    research: report.technology.researchEarned,
    missions: report.technology.missionEarned,
    total: report.technology.totalEarned,
    spent: report.technology.spent,
    balance: report.technology.balance,
  }, { research: 54, missions: 8, total: 62, spent: 24, balance: 38 });
  assert.ok(report.technology.researchShare >= MISSION_ECONOMY_GATES.minimumResearchTpShare);
  assert.equal(report.technology.productReady.vertical.contact, 3);
  assert.equal(report.technology.productReady["usdr-8"].contact, 4);
  assert.equal(new Set(report.technology.unlocks.map(({ technologyId }) => technologyId)).size, 8);
});

test("free QSOs alone retain a complete purchasing path", () => {
  const report = simulateMissionEconomy({ storyClaimCycles: [], dailyMissionInterval: 0 });
  assert.equal(report.income.mission, 0);
  assert.equal(report.income.qsoShare, 1);
  assert.equal(report.qsoOnly.contactsToMica, 6);
  assert.deepEqual(report.purchases.map(({ id }) => id), ECONOMY_PURCHASE_PLAN.map(({ id }) => id));
  assert.equal(report.purchases.at(-1).cycle, 6);
  assert.equal(report.technology.missionEarned, 0);
});

test("all default economy release thresholds pass and explain their bounds", () => {
  const report = simulateMissionEconomy();
  assert.equal(report.releaseReady, true);
  assert.equal(report.thresholds.length, 9);
  assert.deepEqual(report.thresholds.filter(({ passed }) => !passed), []);
  assert.ok(report.thresholds.every(({ id, expectation }) => id && expectation));
  const formatted = formatMissionEconomyReport(report);
  assert.match(formatted, /QSO 3495 \(51\.5%\)/);
  assert.match(formatted, /missions 3290 \(48\.5%\)/);
  assert.match(formatted, /Release gate: PASS/);
});
