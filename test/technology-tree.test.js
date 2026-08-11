import test from "node:test";
import assert from "node:assert/strict";
import { ECONOMY_RESULT, purchaseItem } from "../src/game/economy.js";
import { settleResearchProjects } from "../src/game/researchProjects.js";
import { createSave, loadSaves } from "../src/game/saveStore.js";
import {
  ROOT_TECHNOLOGY_ID, TECHNOLOGY_RESULT, unlockTechnology,
} from "../src/game/technologyTree.js";

function storageStub() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test("a new station begins at the root of the technology tree", () => {
  const save = createSave({ callsign: "JA1TECH", locationId: "japan-tokyo-kanto" });
  assert.equal(save.technologyTreeVersion, 1);
  assert.equal(save.technologyPoints, 0);
  assert.deepEqual(save.unlockedTechnologies, [ROOT_TECHNOLOGY_ID]);
  assert.deepEqual(save.completedResearchProjects, []);
});

test("store equipment requires research before money can be spent", () => {
  const save = createSave({ callsign: "JA1LOCK", locationId: "japan-tokyo-kanto" });
  save.money = 1000;
  const locked = purchaseItem(save, { category: "radio", itemId: "usdr-8" });
  assert.equal(locked.reason, ECONOMY_RESULT.RESEARCH_REQUIRED);
  assert.equal(locked.save.money, 1000);

  const missingPoints = unlockTechnology(save, "rf-circuits");
  assert.equal(missingPoints.reason, TECHNOLOGY_RESULT.INSUFFICIENT_POINTS);

  const withPoints = { ...save, technologyPoints: 9 };
  const rf = unlockTechnology(withPoints, "rf-circuits");
  assert.equal(rf.unlocked, true);
  assert.equal(rf.save.technologyPoints, 7);
  const synthesis = unlockTechnology(rf.save, "frequency-synthesis");
  assert.equal(synthesis.unlocked, true);
  assert.equal(synthesis.save.technologyPoints, 4);
  const multiband = unlockTechnology(synthesis.save, "multiband-qrp");
  assert.equal(multiband.unlocked, true);
  assert.equal(multiband.save.technologyPoints, 0);

  const purchased = purchaseItem(multiband.save, { category: "radio", itemId: "usdr-8" });
  assert.equal(purchased.reason, ECONOMY_RESULT.PURCHASED);
  assert.equal(purchased.save.money, 200);
});

test("progressively harder projects award technology points once", () => {
  const save = createSave({ callsign: "BH1LAB", locationId: "china-beijing-outskirts" });
  save.qsoRecords = { ...save.qsoRecords, total: 1 };
  const first = settleResearchProjects(save);
  assert.equal(first.technologyPointsAwarded, 2);
  assert.deepEqual(first.save.completedResearchProjects, ["first-contact"]);

  const duplicate = settleResearchProjects(first.save);
  assert.equal(duplicate.technologyPointsAwarded, 0);

  const advanced = {
    ...duplicate.save,
    qsoRecords: {
      ...duplicate.save.qsoRecords,
      total: 3,
      weakSignalQsos: 1,
      contactedRegions: ["AS-E", "EU-W", "NA-W"],
      longestDistanceKm: 6500,
    },
  };
  const settled = settleResearchProjects(advanced);
  assert.deepEqual(settled.newlyCompleted.map(({ id }) => id), [
    "reliable-operator", "weak-signal-study", "regional-network", "dx-field-programme",
  ]);
  assert.equal(settled.technologyPointsAwarded, 14);
});

test("specialist projects count clean operating, recoveries, and independent watches", () => {
  const save = createSave({ callsign: "DL1PATH", locationId: "europe-berlin-brandenburg" });
  save.completedResearchProjects = ["first-contact", "reliable-operator"];
  save.qsoLogs = [
    {
      transmitAccuracy: 96, keyingScore: 88, repeatRequests: 0, independentWatch: true,
      attemptHistory: [{ remoteOutcome: "query", accepted: false }, { remoteOutcome: "copied", accepted: true }],
    },
    {
      transmitAccuracy: 92, keyingScore: 84, repeatRequests: 0, independentWatch: true,
      attemptHistory: [{ remoteOutcome: "copied", accepted: true }],
    },
    {
      transmitAccuracy: 76, keyingScore: 70, repeatRequests: 1, independentWatch: true,
      attemptHistory: [{ outcome: "repeat", accepted: false }, { remoteOutcome: "copied", accepted: true }],
    },
  ];

  const settled = settleResearchProjects(save);
  assert.deepEqual(settled.newlyCompleted.map(({ id }) => id), [
    "precision-operating", "recovery-drill", "independent-watch", "independent-operator",
  ]);
  assert.equal(settled.technologyPointsAwarded, 16);
});

test("legacy saves retain access to equipment released before the research system", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "legacy-tech",
    callsign: "K1OLD",
    locationId: "usa-portland-cascades",
    credits: 900,
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.technologyTreeVersion, 1);
  assert.ok(save.unlockedTechnologies.includes("multiband-qrp"));
  assert.ok(save.unlockedTechnologies.includes("directional-arrays"));
  assert.ok(save.unlockedTechnologies.includes("narrowband-filtering"));
});
