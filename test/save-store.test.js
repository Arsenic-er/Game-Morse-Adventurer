import test from "node:test";
import assert from "node:assert/strict";
import {
  createSave, isValidCallsign, loadSaves, normalizeQsoGuidance, persistSaves, sanitizeCallsign,
} from "../src/game/saveStore.js";
import {
  DEFAULT_AUTOMATIC_KEY_WPM, normalizeAutomaticKeyWpm,
} from "../src/cw/automaticKeyer.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";
import { PRACTICE_MODES } from "../src/practice/practiceEngine.js";
import { recordPracticeAttempt } from "../src/practice/practiceRecords.js";
import { PRACTICE_CALLSIGN_REGIONS } from "../src/practice/practiceCallsignCatalog.js";

function storageStub() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}
test("callsigns are uppercase, alphanumeric, and capped at seven characters", () => {
  assert.equal(sanitizeCallsign("bh-1abcxyz"), "BH1ABCX");
  assert.equal(sanitizeCallsign("ja1 z kq"), "JA1ZKQ");
  assert.equal(isValidCallsign("JA1ZKQ"), true);
  assert.equal(isValidCallsign("JA1-ZKQ"), false);
  assert.equal(isValidCallsign("ABCDEFGH"), false);
});

test("save records preserve fixed hardware and swappable loadout ids", () => {
  const save = createSave({ callsign: "bh1abc", locationId: "china-beijing-outskirts", antennaId: "none", keyType: "automatic" });
  assert.equal(save.callsign, "BH1ABC");
  assert.equal(save.locationId, "china-beijing-outskirts");
  assert.equal(save.antennaId, "dipole");
  assert.equal(save.keyType, "automatic");
  assert.equal(save.automaticKeyWpm, DEFAULT_AUTOMATIC_KEY_WPM);
  assert.equal(save.equipmentId, "squid-01");
  assert.equal(save.inventoryVersion, 2);
  assert.deepEqual(save.ownedEquipment, ["squid-01"]);
  assert.deepEqual(save.ownedAntennas, ["dipole"]);
  assert.deepEqual(save.accessories, []);
  assert.equal(save.accessoryId, "none");
  assert.equal(save.credits, 0);
  assert.deepEqual(save.qsoLogs, []);
  assert.deepEqual(save.qsoRecords, {
    total: 0,
    longestDistanceKm: 0,
    longestQsoId: null,
    contactedRegions: [],
    weakSignalQsos: 0,
    settledQsoIds: [],
  });
  assert.equal(save.qsoGuidance, "full");
  assert.equal(save.qsoBriefSeen, false);
  assert.equal(save.firstWatchCompleted, false);
});

test("legacy saves receive safe defaults and migrate old QSO aliases", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "old",
    callsign: "JA1OLD",
    locationId: "japan-tokyo-kanto",
    antennaId: "dipole",
    credits: "12.9",
    qsoLogEntries: [{
      id: "legacy-qso",
      startedAt: "2026-07-15T12:00:00.000Z",
      completedAt: "2026-07-15T12:03:00.000Z",
      playerCallsign: "JA1OLD",
      npcCallsign: "sim7qx",
      sentRst: "559",
      receivedRst: "579",
      regionId: "NA-W",
      distanceKm: "9134.7",
      creditsAwarded: 100,
    }],
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.keyType, "manual");
  assert.equal(save.automaticKeyWpm, DEFAULT_AUTOMATIC_KEY_WPM);
  assert.equal(save.equipmentId, "squid-01");
  assert.equal(save.credits, 12);
  assert.equal(save.qsoLogs.length, 1);
  assert.equal(save.qsoLogs[0].id, "legacy-qso");
  assert.equal(save.qsoLogs[0].callsign, "SIM7QX");
  assert.equal(save.qsoLogs[0].version, 3);
  assert.equal(save.qsoLogs[0].guidanceLevel, "full");
  assert.equal(save.qsoLogs[0].visualAssistUsed, false);
  assert.equal(save.qsoLogs[0].independentWatch, false);
  assert.deepEqual(save.qsoLogs[0].attemptHistory, []);
  assert.equal(save.qsoLogs[0].repeatRequests, 0);
  assert.equal(save.qsoGuidance, "full");
  assert.equal(save.qsoBriefSeen, false);
  assert.equal(save.firstWatchCompleted, false);
  assert.equal("qsoLogEntries" in save, false);
  assert.deepEqual(save.qsoRecords, {
    total: 1,
    longestDistanceKm: 9134.7,
    longestQsoId: "legacy-qso",
    contactedRegions: ["NA-W"],
    weakSignalQsos: 0,
    settledQsoIds: ["legacy-qso"],
  });
});

test("QSO guidance and first-watch flags normalize and persist safely", () => {
  assert.equal(normalizeQsoGuidance("full"), "full");
  assert.equal(normalizeQsoGuidance("hints"), "hints");
  assert.equal(normalizeQsoGuidance("off"), "off");
  assert.equal(normalizeQsoGuidance("expert"), "full");

  const hintedNewSave = createSave({
    callsign: "JA1QSO",
    locationId: "japan-tokyo-kanto",
    qsoGuidance: "hints",
  });
  assert.equal(hintedNewSave.qsoGuidance, "hints");

  const storage = storageStub();
  const save = createSave({ callsign: "JA1COACH", locationId: "japan-tokyo-kanto" });
  save.qsoGuidance = "hints";
  save.qsoBriefSeen = true;
  save.firstWatchCompleted = true;
  persistSaves([save], storage);

  const [reloaded] = loadSaves(storage);
  assert.equal(reloaded.qsoGuidance, "hints");
  assert.equal(reloaded.qsoBriefSeen, true);
  assert.equal(reloaded.firstWatchCompleted, true);

  reloaded.qsoGuidance = "invalid";
  reloaded.qsoBriefSeen = "true";
  reloaded.firstWatchCompleted = 1;
  persistSaves([reloaded], storage);
  const [sanitized] = loadSaves(storage);
  assert.equal(sanitized.qsoGuidance, "full");
  assert.equal(sanitized.qsoBriefSeen, false);
  assert.equal(sanitized.firstWatchCompleted, false);
});

test("legacy saves keep their valid equipped antenna during inventory migration", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "legacy-yagi",
    callsign: "JA1YAGI",
    locationId: "japan-tokyo-kanto",
    antennaId: "yagi-3el",
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.inventoryVersion, 2);
  assert.equal(save.antennaId, "yagi-3el");
  assert.deepEqual(save.ownedAntennas, ["dipole", "yagi-3el"]);
});

test("legacy saves cannot gain a newly catalogued radio from equipmentId alone", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "legacy-new-radio",
    callsign: "JA1SAFE",
    locationId: "japan-tokyo-kanto",
    equipmentId: "usdr-8",
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.equipmentId, "squid-01");
  assert.deepEqual(save.ownedEquipment, ["squid-01"]);
});

test("inventory saves preserve an owned and equipped MICA-8", () => {
  const storage = storageStub();
  const save = createSave({ callsign: "JA1USDR", locationId: "japan-tokyo-kanto" });
  save.ownedEquipment = ["squid-01", "usdr-8"];
  save.equipmentId = "usdr-8";
  persistSaves([save], storage);

  const [reloaded] = loadSaves(storage);
  assert.deepEqual(reloaded.ownedEquipment, ["squid-01", "usdr-8"]);
  assert.equal(reloaded.equipmentId, "usdr-8");
});

test("inventory saves cannot equip an unowned MICA-8", () => {
  const storage = storageStub();
  const save = createSave({ callsign: "JA1NOPE", locationId: "japan-tokyo-kanto" });
  save.equipmentId = "usdr-8";
  persistSaves([save], storage);

  const [reloaded] = loadSaves(storage);
  assert.deepEqual(reloaded.ownedEquipment, ["squid-01"]);
  assert.equal(reloaded.equipmentId, "squid-01");
});

test("migrated saves cannot grant themselves an unowned equipped antenna", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    inventoryVersion: 1,
    id: "tampered",
    callsign: "JA1SAFE",
    locationId: "japan-tokyo-kanto",
    antennaId: "yagi-3el",
    ownedEquipment: ["squid-01", "unknown", "squid-01"],
    ownedAntennas: ["dipole", "unknown", "dipole"],
    accessories: [],
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.antennaId, "dipole");
  assert.deepEqual(save.ownedEquipment, ["squid-01"]);
  assert.deepEqual(save.ownedAntennas, ["dipole"]);
});

test("the empty antenna sentinel is equipable but never enters inventory", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    inventoryVersion: 1,
    id: "no-antenna",
    callsign: "JA1NONE",
    locationId: "japan-tokyo-kanto",
    antennaId: "none",
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["none", "dipole"],
    accessories: [],
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.antennaId, "none");
  assert.deepEqual(save.ownedAntennas, ["dipole"]);
});

test("version one saves migrate to an empty accessory slot", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    inventoryVersion: 1,
    id: "version-one-accessory",
    callsign: "JA1VONE",
    locationId: "japan-tokyo-kanto",
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
  }]));

  const [save] = loadSaves(storage);
  assert.equal(save.inventoryVersion, 2);
  assert.equal(save.accessoryId, "none");
  assert.deepEqual(save.accessories, []);
});

test("owned and equipped accessories persist while unowned selections are rejected", () => {
  const storage = storageStub();
  const save = createSave({ callsign: "JA1FILT", locationId: "japan-tokyo-kanto" });
  save.accessories = ["cw-filter-500", "unknown", "cw-filter-500", "none"];
  save.accessoryId = "cw-filter-500";
  persistSaves([save], storage);

  const [reloaded] = loadSaves(storage);
  assert.deepEqual(reloaded.accessories, ["cw-filter-500"]);
  assert.equal(reloaded.accessoryId, "cw-filter-500");

  reloaded.accessories = [];
  persistSaves([reloaded], storage);
  const [sanitized] = loadSaves(storage);
  assert.equal(sanitized.accessoryId, "none");
});

test("falls back to legacy QSO entries when the current log field is malformed", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "partially-migrated",
    callsign: "JA1OLD",
    locationId: "japan-tokyo-kanto",
    qsoLogs: { corrupted: true },
    qsoLogEntries: [{
      id: "legacy-fallback",
      startedAt: "2026-07-15T12:00:00.000Z",
      completedAt: "2026-07-15T12:03:00.000Z",
      playerCallsign: "JA1OLD",
      npcCallsign: "SIM7QX",
      sentRst: "559",
      receivedRst: "579",
      regionId: "NA-W",
    }],
  }]));
  const [save] = loadSaves(storage);
  assert.equal(save.qsoLogs.length, 1);
  assert.equal(save.qsoLogs[0].id, "legacy-fallback");
  assert.deepEqual(save.qsoRecords.settledQsoIds, ["legacy-fallback"]);
});

test("preserves evicted settlement ids across a save round trip", () => {
  const storage = storageStub();
  const save = createSave({ callsign: "BH1ABC", locationId: "china-beijing-outskirts" });
  save.credits = 100;
  save.qsoRecords = {
    total: 1,
    longestDistanceKm: 500,
    longestQsoId: "evicted-qso",
    contactedRegions: ["NA-W"],
    settledQsoIds: ["evicted-qso"],
  };
  persistSaves([save], storage);
  const [reloaded] = loadSaves(storage);
  assert.deepEqual(reloaded.qsoRecords.settledQsoIds, ["evicted-qso"]);

  const retry = recordCompletedQso(reloaded, {
    id: "evicted-qso",
    startedAt: "2026-07-15T12:00:00.000Z",
    completedAt: "2026-07-15T12:03:00.000Z",
    playerCallsign: "BH1ABC",
    callsign: "SIM7QX",
    sent: "559",
    received: "579",
    location: "NA-W",
    distanceKm: 500,
    credits: 100,
  });
  assert.equal(retry.added, false);
  assert.equal(retry.save.credits, 100);
  assert.equal(retry.save.qsoRecords.total, 1);
});

test("invalid or negative legacy credits normalize to zero", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([
    { id: "negative", callsign: "SIM1", locationId: "japan-tokyo-kanto", credits: -4.7 },
    { id: "invalid", callsign: "SIM2", locationId: "japan-tokyo-kanto", credits: "not-a-number" },
  ]));
  const saves = loadSaves(storage);
  assert.deepEqual(saves.map((save) => save.credits), [0, 0]);
});

test("credits are normalized to safe non-negative integers", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([
    { id: "fraction", callsign: "SIM3", locationId: "japan-tokyo-kanto", credits: 12.9 },
    { id: "huge", callsign: "SIM4", locationId: "japan-tokyo-kanto", credits: 1e30 },
  ]));
  const saves = loadSaves(storage);
  assert.deepEqual(saves.map((save) => save.credits), [12, Number.MAX_SAFE_INTEGER]);
});

test("automatic-key speed is normalized and persists across save round trips", () => {
  assert.equal(normalizeAutomaticKeyWpm(null), 18);
  assert.equal(normalizeAutomaticKeyWpm("invalid"), 18);
  assert.equal(normalizeAutomaticKeyWpm(2), 5);
  assert.equal(normalizeAutomaticKeyWpm(48), 40);
  assert.equal(normalizeAutomaticKeyWpm(22.6), 23);

  const storage = storageStub();
  const save = createSave({ callsign: "SIM5", locationId: "japan-tokyo-kanto", keyType: "automatic" });
  save.automaticKeyWpm = 27;
  persistSaves([save], storage);
  assert.equal(loadSaves(storage)[0].automaticKeyWpm, 27);
});

test("only three normalized save slots are persisted", () => {
  const storage = storageStub();
  const saves = Array.from({ length: 4 }, (_, index) => createSave({ callsign: `SIM${index}`, locationId: "japan-tokyo-kanto" }));
  persistSaves(saves, storage);
  assert.equal(loadSaves(storage).length, 3);
});

test("new and migrated saves receive bounded per-mode practice records", () => {
  const storage = storageStub();
  const fresh = createSave({ callsign: "JA1TRY", locationId: "japan-tokyo-kanto" });
  assert.equal(fresh.practiceRecordsVersion, 3);
  assert.equal(fresh.practiceRecords[PRACTICE_MODES.CHARACTER_RX].attempts, 0);
  assert.equal(fresh.practiceRecords[PRACTICE_MODES.CHARACTER_RX].difficulty, "guided");
  assert.equal(fresh.practiceRecords[PRACTICE_MODES.CHARACTER_RX].lesson, 1);
  assert.equal(fresh.practiceRecords[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);

  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "legacy-practice",
    callsign: "BH1OLD",
    locationId: "china-beijing-outskirts",
  }]));
  const [migrated] = loadSaves(storage);
  assert.equal(migrated.practiceRecordsVersion, 3);
  assert.equal(migrated.practiceRecords[PRACTICE_MODES.PADDLE_TX].attempts, 0);
  assert.equal(migrated.practiceRecords[PRACTICE_MODES.PADDLE_TX].difficulty, "guided");
  assert.equal(migrated.practiceRecords[PRACTICE_MODES.PADDLE_TX].lesson, 1);
});

test("practice record v2 migration preserves callsign progress and repairs its region", () => {
  const storage = storageStub();
  storage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([{
    id: "practice-v2",
    callsign: "SIMV2",
    locationId: "japan-tokyo-kanto",
    practiceRecordsVersion: 2,
    practiceRecords: {
      [PRACTICE_MODES.CALLSIGN_RX]: {
        attempts: 7,
        correct: 5,
        difficulty: "standard",
        completedLessons: 1,
        lessonAttempts: 3,
        lessonCorrect: 2,
        recentTargets: ["SIM7QX"],
      },
    },
  }]));
  const [migrated] = loadSaves(storage);
  const record = migrated.practiceRecords[PRACTICE_MODES.CALLSIGN_RX];
  assert.equal(migrated.practiceRecordsVersion, 3);
  assert.equal(record.callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
  assert.equal(record.attempts, 7);
  assert.equal(record.correct, 5);
  assert.equal(record.difficulty, "standard");
  assert.equal(record.completedLessons, 1);
  assert.equal(record.lessonAttempts, 3);
  assert.equal(record.lessonCorrect, 2);
  assert.deepEqual(record.recentTargets, ["SIM7QX"]);

  const broken = { ...migrated, practiceRecords: {
    ...migrated.practiceRecords,
    [PRACTICE_MODES.CALLSIGN_RX]: { ...record, callsignRegion: "moon" },
  } };
  persistSaves([broken], storage);
  assert.equal(loadSaves(storage)[0].practiceRecords[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
});

test("practice records persist with their save without leaking session attempt ids", () => {
  const storage = storageStub();
  const save = createSave({ callsign: "K1TEST", locationId: "usa-portland-cascades" });
  save.practiceRecords = recordPracticeAttempt(save.practiceRecords, PRACTICE_MODES.CHARACTER_RX, {
    attemptId: "temporary-question-id",
    target: "Q",
    correct: false,
    accuracy: 0,
    rhythm: null,
    missed: ["Q"],
  }, "2026-07-27T10:00:00.000Z");
  persistSaves([save], storage);
  const [reloaded] = loadSaves(storage);
  const record = reloaded.practiceRecords[PRACTICE_MODES.CHARACTER_RX];
  assert.equal(record.attempts, 1);
  assert.deepEqual(record.weaknesses, { Q: 1 });
  assert.deepEqual(record.recentTargets, ["Q"]);
  assert.equal("settledAttemptIds" in record, false);
});
