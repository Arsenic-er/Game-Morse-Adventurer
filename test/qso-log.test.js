import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QSO_ATTEMPT_HISTORY, MAX_QSO_LOGS, appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs,
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
    accessoryId: "cw-filter-500",
    playerLocationId: "japan-tokyo-kanto",
    wpm: 18,
    transmitAccuracy: 92.34,
    keyingScore: 88.88,
    repeatRequests: 2,
    guidanceLevel: "off",
    visualAssistUsed: false,
    independentWatch: true,
    attemptHistory: [{
      stage: "PLAYER_RST_AND_73", message: "sim7qx de bh1abc rst 559 73 k",
      result: "accepted", reason: null, wpm: 18.04, accuracy: 92.34, rhythm: 88.88,
    }],
    credits: 150,
    isFictional: true,
    ...overrides,
  };
}

test("normalizes the complete QSO log v3 schema", () => {
  const normalized = normalizeQsoLogEntry(entry());
  assert.equal(normalized.version, 3);
  assert.equal(normalized.startedAt, "2026-07-15T00:00:00.000Z");
  assert.equal(normalized.completedAt, "2026-07-15T00:05:00.000Z");
  assert.equal(normalized.playerCallsign, "BH1ABC");
  assert.equal(normalized.callsign, "SIM7QX");
  assert.equal(normalized.npcLatitude, 37.77);
  assert.equal(normalized.npcLongitude, -122.42);
  assert.equal(normalized.distanceKm, 8291.5);
  assert.equal(normalized.transmitAccuracy, 92.3);
  assert.equal("copyAccuracy" in normalized, false);
  assert.equal(normalized.keyingScore, 88.9);
  assert.equal(normalized.finalPropagationLevel, 3);
  assert.equal(normalized.playerLocationId, "japan-tokyo-kanto");
  assert.equal(normalized.accessoryId, "cw-filter-500");
  assert.equal(normalized.repeatRequests, 2);
  assert.equal(normalized.guidanceLevel, "off");
  assert.equal(normalized.visualAssistUsed, false);
  assert.equal(normalized.independentWatch, true);
  assert.deepEqual(normalized.attemptHistory, [{
    stage: "PLAYER_RST_AND_73",
    message: "SIM7QX DE BH1ABC RST 559 73 K",
    result: "accepted",
    reason: null,
    wpm: 18,
    accuracy: 92.3,
    rhythm: 88.9,
  }]);
});

test("legacy QSO logs safely migrate to v3 defaults", () => {
  const normalized = normalizeQsoLogEntry(entry({
    version: 1,
    accessoryId: undefined,
    transmitAccuracy: undefined,
    copyAccuracy: 87.65,
    repeatRequests: undefined,
    guidanceLevel: undefined,
    visualAssistUsed: undefined,
    independentWatch: undefined,
    attemptHistory: undefined,
  }));
  assert.equal(normalized.accessoryId, "none");
  assert.equal(normalized.version, 3);
  assert.equal(normalized.repeatRequests, 0);
  assert.equal(normalized.transmitAccuracy, 87.7);
  assert.equal("copyAccuracy" in normalized, false);
  assert.equal(normalized.guidanceLevel, "full");
  assert.equal(normalized.visualAssistUsed, false);
  assert.equal(normalized.independentWatch, false);
  assert.deepEqual(normalized.attemptHistory, []);
});

test("v3 assistance fields enforce independent-watch integrity", () => {
  assert.equal(normalizeQsoLogEntry(entry({ guidanceLevel: "hints" })).independentWatch, false);
  assert.equal(normalizeQsoLogEntry(entry({ visualAssistUsed: true })).independentWatch, false);
  const invalidGuidance = normalizeQsoLogEntry(entry({ guidanceLevel: "unknown" }));
  assert.equal(invalidGuidance.guidanceLevel, "full");
  assert.equal(invalidGuidance.independentWatch, false);
});

test("attempt history is sanitized and capped to the newest valid records", () => {
  const attempts = Array.from({ length: MAX_QSO_ATTEMPT_HISTORY + 3 }, (_, index) => ({
    stage: ` STAGE-${index} `,
    message: ` attempt   ${index} `,
    result: index === 1 ? "unknown" : "rejected",
    reason: "missingCq",
    wpm: index,
    accuracy: 101,
    rhythm: -1,
  }));
  const normalized = normalizeQsoLogEntry(entry({ attemptHistory: attempts }));
  assert.equal(normalized.attemptHistory.length, MAX_QSO_ATTEMPT_HISTORY);
  assert.equal(normalized.attemptHistory[0].stage, "STAGE-3");
  assert.equal(normalized.attemptHistory[0].message, "ATTEMPT 3");
  assert.equal(normalized.attemptHistory[0].accuracy, 100);
  assert.equal(normalized.attemptHistory[0].rhythm, 0);
  assert.equal(normalized.attemptHistory.at(-1).stage, `STAGE-${MAX_QSO_ATTEMPT_HISTORY + 2}`);
});

test("legacy generic accuracy migrates when neither v2 nor copy accuracy exists", () => {
  const normalized = normalizeQsoLogEntry(entry({
    transmitAccuracy: undefined,
    copyAccuracy: undefined,
    accuracy: "76.24",
  }));
  assert.equal(normalized.transmitAccuracy, 76.2);
});

test("repeat request counts normalize to safe non-negative integers", () => {
  assert.equal(normalizeQsoLogEntry(entry({ repeatRequests: -3 })).repeatRequests, 0);
  assert.equal(normalizeQsoLogEntry(entry({ repeatRequests: "4.9" })).repeatRequests, 4);
  assert.equal(normalizeQsoLogEntry(entry({ repeatRequests: "invalid" })).repeatRequests, 0);
  assert.equal(normalizeQsoLogEntry(entry({ repeatRequests: 1e30 })).repeatRequests, Number.MAX_SAFE_INTEGER);
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
    weakSignalQsos: 0,
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
  assert.equal(first.save.credits, 175);
  assert.deepEqual(first.save.ownedEquipment, ["squid-01"]);
  assert.deepEqual(first.save.ownedAntennas, ["dipole", "vertical"]);
  assert.deepEqual(first.save.accessories, []);
  assert.equal(first.save.qsoLogs.length, 2);
  assert.equal(first.save.qsoLogs[0].repeatRequests, 2);
  assert.deepEqual(first.save.qsoRecords, {
    total: 8,
    longestDistanceKm: 8291.5,
    longestQsoId: "SIM7QX-1",
    contactedRegions: ["AS-JA", "NA-W"],
    weakSignalQsos: 0,
    settledQsoIds: ["SIM7QX-1", "old"],
  });

  const duplicate = recordCompletedQso(first.save, entry());
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.newRegion, false);
  assert.equal(duplicate.newDistanceRecord, false);
  assert.strictEqual(duplicate.save, first.save);
  assert.equal(duplicate.save.credits, 175);
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
  const first = entry({ id: "first", completedAt: "2026-07-15T00:05:00.000Z", finalPropagationLevel: 2 });
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
  assert.equal(save.qsoRecords.weakSignalQsos, 1);

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
