import test from "node:test";
import assert from "node:assert/strict";
import {
  createSave, isValidCallsign, loadSaves, persistSaves, sanitizeCallsign,
} from "../src/game/saveStore.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";

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
  assert.equal(save.antennaId, "none");
  assert.equal(save.keyType, "automatic");
  assert.equal(save.equipmentId, "squid-01");
  assert.equal(save.credits, 0);
  assert.deepEqual(save.qsoLogs, []);
  assert.deepEqual(save.qsoRecords, {
    total: 0,
    longestDistanceKm: 0,
    longestQsoId: null,
    contactedRegions: [],
    settledQsoIds: [],
  });
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
  assert.equal(save.equipmentId, "squid-01");
  assert.equal(save.credits, 12);
  assert.equal(save.qsoLogs.length, 1);
  assert.equal(save.qsoLogs[0].id, "legacy-qso");
  assert.equal(save.qsoLogs[0].callsign, "SIM7QX");
  assert.equal("qsoLogEntries" in save, false);
  assert.deepEqual(save.qsoRecords, {
    total: 1,
    longestDistanceKm: 9134.7,
    longestQsoId: "legacy-qso",
    contactedRegions: ["NA-W"],
    settledQsoIds: ["legacy-qso"],
  });
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

test("only three normalized save slots are persisted", () => {
  const storage = storageStub();
  const saves = Array.from({ length: 4 }, (_, index) => createSave({ callsign: `SIM${index}`, locationId: "japan-tokyo-kanto" }));
  persistSaves(saves, storage);
  assert.equal(loadSaves(storage).length, 3);
});
