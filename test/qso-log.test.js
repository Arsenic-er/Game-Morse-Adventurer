import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QSO_LOGS, appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs,
  normalizeQsoRecords, recordCompletedQso,
} from "../src/qso/qsoLog.js";

function entry(overrides = {}) {
  return {
    id: "SIM7QX-1",
    startedAt: "2026-07-15T00:00:00.000Z",
    completedAt: "2026-07-15T00:05:00.000Z",
    playerCallsign: "BH1ABC",
    callsign: "SIM7QX",
    frequencyMhz: 21.06,
    mode: "CW",
    sent: "559",
    received: "579",
    location: "NA-W",
    npcLatitude: 37.77,
    npcLongitude: -122.42,
    distanceKm: 8291.46,
    basePropagationLevel: 2,
    finalPropagationLevel: 3,
    propagationSource: "OFFLINE_DEFAULT",
    equipmentId: "squid-01",
    antennaId: "dipole",
    playerLocationId: "japan-tokyo-kanto",
    wpm: 18,
    copyAccuracy: 92.34,
    keyingScore: 88.88,
    credits: 100,
    isFictional: true,
    ...overrides,
  };
}

test("normalizes the complete QSO log v1 schema", () => {
  const normalized = normalizeQsoLogEntry(entry());
  assert.equal(normalized.version, 1);
  assert.equal(normalized.startedAt, "2026-07-15T00:00:00.000Z");
  assert.equal(normalized.completedAt, "2026-07-15T00:05:00.000Z");
  assert.equal(normalized.playerCallsign, "BH1ABC");
  assert.equal(normalized.callsign, "SIM7QX");
  assert.equal(normalized.npcLatitude, 37.77);
  assert.equal(normalized.npcLongitude, -122.42);
  assert.equal(normalized.distanceKm, 8291.5);
  assert.equal(normalized.copyAccuracy, 92.3);
  assert.equal(normalized.keyingScore, 88.9);
  assert.equal(normalized.finalPropagationLevel, 3);
  assert.equal(normalized.playerLocationId, "japan-tokyo-kanto");
});

test("rejects invalid chronology and required identity fields", () => {
  assert.equal(normalizeQsoLogEntry(entry({ completedAt: "not-a-date" })), null);
  assert.equal(normalizeQsoLogEntry(entry({ completedAt: "2026-07-14T23:59:59.000Z" })), null);
  assert.equal(normalizeQsoLogEntry(entry({ callsign: "" })), null);
  assert.equal(normalizeQsoLogEntry(entry({ playerCallsign: "" })), null);
});

test("deduplicates, sorts newest first, and caps the retained log", () => {
  const many = Array.from({ length: MAX_QSO_LOGS + 5 }, (_, index) => entry({
    id: `SIM-${index}`,
    completedAt: new Date(Date.UTC(2026, 6, 15, 0, 5, index)).toISOString(),
  }));
  const logs = normalizeQsoLogs([many[0], many[0], ...many]);
  assert.equal(logs.length, MAX_QSO_LOGS);
  assert.equal(logs[0].id, `SIM-${MAX_QSO_LOGS + 4}`);
  assert.equal(logs.at(-1).id, "SIM-5");
  assert.equal(appendQsoLog(logs, logs[0]).length, MAX_QSO_LOGS);
});

test("normalizes aggregate records from retained logs", () => {
  const logs = [
    entry({ id: "near", location: "AS-JA", distanceKm: 120 }),
    entry({ id: "far", location: "NA-W", distanceKm: 8291.5 }),
  ];
  assert.deepEqual(normalizeQsoRecords(null, logs), {
    total: 2,
    longestDistanceKm: 8291.5,
    longestQsoId: "far",
    contactedRegions: ["AS-JA", "NA-W"],
    settledQsoIds: ["far", "near"],
  });
});

test("records a completed QSO atomically and idempotently", () => {
  const save = {
    id: "save-1",
    credits: 25,
    inventoryVersion: 1,
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole", "vertical"],
    accessories: [],
    qsoLogs: [entry({ id: "old", location: "AS-JA", distanceKm: 200, credits: 50 })],
    qsoRecords: { total: 7, longestDistanceKm: 200, longestQsoId: "old", contactedRegions: ["AS-JA"] },
  };
  const first = recordCompletedQso(save, entry());
  assert.equal(first.added, true);
  assert.equal(first.newRegion, true);
  assert.equal(first.newDistanceRecord, true);
  assert.equal(first.save.credits, 125);
  assert.deepEqual(first.save.ownedEquipment, ["squid-01"]);
  assert.deepEqual(first.save.ownedAntennas, ["dipole", "vertical"]);
  assert.deepEqual(first.save.accessories, []);
  assert.equal(first.save.qsoLogs.length, 2);
  assert.deepEqual(first.save.qsoRecords, {
    total: 8,
    longestDistanceKm: 8291.5,
    longestQsoId: "SIM7QX-1",
    contactedRegions: ["AS-JA", "NA-W"],
    settledQsoIds: ["SIM7QX-1", "old"],
  });

  const duplicate = recordCompletedQso(first.save, entry());
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.newRegion, false);
  assert.equal(duplicate.newDistanceRecord, false);
  assert.strictEqual(duplicate.save, first.save);
  assert.equal(duplicate.save.credits, 125);
  assert.equal(duplicate.save.qsoRecords.total, 8);
});

test("reports ordinary contacts without false milestones", () => {
  const save = {
    credits: 0,
    qsoLogs: [entry({ id: "far", location: "NA-W", distanceKm: 9000 })],
    qsoRecords: { total: 1, longestDistanceKm: 9000, longestQsoId: "far", contactedRegions: ["NA-W"] },
  };
  const result = recordCompletedQso(save, entry({ id: "near", distanceKm: 1000 }));
  assert.equal(result.added, true);
  assert.equal(result.newRegion, false);
  assert.equal(result.newDistanceRecord, false);
  assert.equal(result.save.qsoRecords.longestQsoId, "far");
});

test("keeps settlements idempotent after an old log is evicted", () => {
  let save = { credits: 0, qsoLogs: [], qsoRecords: null };
  const first = entry({ id: "first", completedAt: "2026-07-15T00:05:00.000Z" });
  save = recordCompletedQso(save, first).save;
  for (let index = 1; index <= MAX_QSO_LOGS; index += 1) {
    save = recordCompletedQso(save, entry({
      id: `later-${index}`,
      completedAt: new Date(Date.UTC(2026, 6, 15, 0, 5, index)).toISOString(),
    })).save;
  }
  assert.equal(save.qsoLogs.length, MAX_QSO_LOGS);
  assert.equal(save.qsoLogs.some((log) => log.id === "first"), false);
  assert.equal(save.qsoRecords.settledQsoIds.includes("first"), true);

  const creditsBeforeRetry = save.credits;
  const totalBeforeRetry = save.qsoRecords.total;
  const retry = recordCompletedQso(save, first);
  assert.equal(retry.added, false);
  assert.strictEqual(retry.save, save);
  assert.equal(retry.save.credits, creditsBeforeRetry);
  assert.equal(retry.save.qsoRecords.total, totalBeforeRetry);
});

test("rejects settlement when either RST report is missing or invalid", () => {
  const save = { credits: 0, qsoLogs: [], qsoRecords: null };
  assert.throws(() => recordCompletedQso(save, entry({ sent: null })), /sent and received RST/);
  assert.throws(() => recordCompletedQso(save, entry({ received: "999" })), /sent and received RST/);
  assert.equal(save.credits, 0);
  assert.deepEqual(save.qsoLogs, []);
});
