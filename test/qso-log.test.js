import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QSO_ATTEMPT_HISTORY, MAX_QSO_LOGS, QSO_LOG_VERSION, appendQsoLog, normalizeQsoLogEntry, normalizeQsoLogs,
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
    copyQueries: 1,
    cqQuality: 91.24,
    copyScore: 82.44,
    copyOutcome: "copied",
    operatorProfileId: "careful-beginner",
    operatorProfileRevision: 1,
    remoteWpm: 10,
    optionalExchangeQuestion: "location",
    optionalExchangeOutcome: "answered",
    optionalExchangeRepeatRequests: 1,
    guidanceLevel: "off",
    visualAssistUsed: false,
    independentWatch: true,
    attemptHistory: [{
      stage: "PLAYER_RST_AND_73", message: "sim7qx de bh1abc rst 559 73 k",
      result: "accepted", reason: null, wpm: 18.04, accuracy: 92.34, rhythm: 88.88,
      cqQuality: 91.24, copyScore: 82.44, remoteOutcome: "copied",
      operatorProfileId: "careful-beginner",
    }],
    credits: 150,
    isFictional: true,
    ...overrides,
  };
}

test("normalizes the complete QSO log v6 schema", () => {
  const normalized = normalizeQsoLogEntry(entry());
  assert.equal(normalized.version, QSO_LOG_VERSION);
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
  assert.equal(normalized.copyQueries, 1);
  assert.equal(normalized.cqQuality, 91.2);
  assert.equal(normalized.copyScore, 82.4);
  assert.equal(normalized.copyOutcome, "copied");
  assert.equal(normalized.operatorProfileId, "careful-beginner");
  assert.equal(normalized.operatorProfileRevision, 1);
  assert.equal(normalized.remoteWpm, 10);
  assert.equal(normalized.optionalExchangeQuestion, "location");
  assert.equal(normalized.optionalExchangeOutcome, "answered");
  assert.equal(normalized.optionalExchangeRepeatRequests, 1);
  assert.equal(normalized.guidanceLevel, "off");
  assert.equal(normalized.visualAssistUsed, false);
  assert.equal(normalized.independentWatch, true);
  assert.equal(normalized.rewardBreakdown, null);
  assert.deepEqual(normalized.attemptHistory, [{
    stage: "PLAYER_RST_AND_73",
    message: "SIM7QX DE BH1ABC RST 559 73 K",
    result: "accepted",
    reason: null,
    wpm: 18,
    accuracy: 92.3,
    rhythm: 88.9,
    cqQuality: 91.2,
    copyScore: 82.4,
    remoteOutcome: "copied",
    operatorProfileId: "careful-beginner",
  }]);
});

test("legacy v1-v5 QSO logs safely migrate to v6 defaults without retroactive rewards", () => {
  for (const version of [1, 2, 3, 4, 5]) {
    const normalized = normalizeQsoLogEntry(entry({
    version,
    accessoryId: undefined,
    transmitAccuracy: undefined,
    copyAccuracy: 87.65,
    repeatRequests: undefined,
    copyQueries: undefined,
    cqQuality: undefined,
    copyScore: undefined,
    copyOutcome: undefined,
    operatorProfileId: undefined,
    operatorProfileRevision: undefined,
    remoteWpm: undefined,
    optionalExchangeQuestion: undefined,
    optionalExchangeOutcome: undefined,
    optionalExchangeRepeatRequests: undefined,
    guidanceLevel: undefined,
    visualAssistUsed: undefined,
    independentWatch: undefined,
    attemptHistory: undefined,
  }));
  assert.equal(normalized.accessoryId, "none");
  assert.equal(normalized.version, QSO_LOG_VERSION);
  assert.equal(normalized.repeatRequests, 0);
  assert.equal(normalized.copyQueries, 0);
  assert.equal(normalized.cqQuality, null);
  assert.equal(normalized.copyScore, null);
  assert.equal(normalized.copyOutcome, null);
  assert.equal(normalized.operatorProfileId, "legacy-standard");
  assert.equal(normalized.operatorProfileRevision, 0);
  assert.equal(normalized.remoteWpm, null);
  assert.equal(normalized.optionalExchangeQuestion, null);
  assert.equal(normalized.optionalExchangeOutcome, "not-offered");
  assert.equal(normalized.optionalExchangeRepeatRequests, 0);
  assert.equal(normalized.transmitAccuracy, 87.7);
  assert.equal("copyAccuracy" in normalized, false);
  assert.equal(normalized.guidanceLevel, "full");
  assert.equal(normalized.visualAssistUsed, false);
  assert.equal(normalized.independentWatch, false);
  assert.equal(normalized.rewardBreakdown, null);
  assert.equal(normalized.credits, 150);
  assert.deepEqual(normalized.attemptHistory, []);
  }
});

test("v5 remote speed is nullable and clamps malformed values", () => {
  assert.equal(normalizeQsoLogEntry(entry({ version: 5, remoteWpm: null })).remoteWpm, null);
  assert.equal(normalizeQsoLogEntry(entry({ version: 5, remoteWpm: 999 })).remoteWpm, 60);
  assert.equal(normalizeQsoLogEntry(entry({ version: 5, remoteWpm: -4 })).remoteWpm, 0);
});

test("v3 assistance fields enforce independent-watch integrity", () => {
  assert.equal(normalizeQsoLogEntry(entry({ guidanceLevel: "hints" })).independentWatch, false);
  assert.equal(normalizeQsoLogEntry(entry({ visualAssistUsed: true })).independentWatch, false);
  const invalidGuidance = normalizeQsoLogEntry(entry({ guidanceLevel: "unknown" }));
  assert.equal(invalidGuidance.guidanceLevel, "full");
  assert.equal(invalidGuidance.independentWatch, false);
});

test("persists a safe reward breakdown and derives its credit total", () => {
  const normalized = normalizeQsoLogEntry(entry({
    credits: 9999,
    rewardBreakdown: {
      version: 1,
      base: 100,
      independentWatch: 50,
      weakSignal: 75,
      newRegion: 20,
      newDistanceRecord: 25,
      total: 1,
    },
  }));
  assert.equal(normalized.credits, 270);
  assert.deepEqual(normalized.rewardBreakdown, {
    version: 1,
    base: 100,
    independentWatch: 50,
    weakSignal: 75,
    newRegion: 20,
    newDistanceRecord: 25,
    total: 270,
  });
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
  assert.equal(normalizeQsoLogEntry(entry({ optionalExchangeRepeatRequests: -3 })).optionalExchangeRepeatRequests, 0);
  assert.equal(normalizeQsoLogEntry(entry({ optionalExchangeRepeatRequests: "4.9" })).optionalExchangeRepeatRequests, 4);
  assert.equal(normalizeQsoLogEntry(entry({ optionalExchangeQuestion: "unknown" })).optionalExchangeQuestion, null);
  assert.equal(normalizeQsoLogEntry(entry({ optionalExchangeQuestion: "unknown" })).optionalExchangeOutcome, "not-offered");
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
  assert.equal(first.creditsAwarded, 195);
  assert.equal(first.save.credits, 220);
  assert.strictEqual(first.settledEntry, first.save.qsoLogs.find((log) => log.id === "SIM7QX-1"));
  assert.deepEqual(first.rewardBreakdown, {
    version: 1,
    base: 100,
    independentWatch: 50,
    weakSignal: 0,
    newRegion: 20,
    newDistanceRecord: 25,
    total: 195,
  });
  assert.deepEqual(first.settledEntry.rewardBreakdown, first.rewardBreakdown);
  assert.equal(first.settledEntry.credits, 195);
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
  assert.equal(duplicate.save.credits, 220);
  assert.equal(duplicate.creditsAwarded, 0);
  assert.deepEqual(duplicate.rewardBreakdown, first.rewardBreakdown);
  assert.deepEqual(duplicate.settledEntry, first.settledEntry);
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
  assert.equal(result.creditsAwarded, 150);
  assert.deepEqual(result.rewardBreakdown, {
    version: 1,
    base: 100,
    independentWatch: 50,
    weakSignal: 0,
    newRegion: 0,
    newDistanceRecord: 0,
    total: 150,
  });
});

test("awards weak-signal credit at P2 but not P3", () => {
  const save = {
    credits: 10,
    qsoLogs: [entry({ id: "far", location: "NA-W", distanceKm: 9000 })],
    qsoRecords: { total: 1, longestDistanceKm: 9000, longestQsoId: "far", contactedRegions: ["NA-W"] },
  };
  const p2 = recordCompletedQso(save, entry({
    id: "p2", distanceKm: 1000, finalPropagationLevel: 2,
    guidanceLevel: "full", independentWatch: false,
  }));
  assert.equal(p2.creditsAwarded, 175);
  assert.equal(p2.save.credits, 185);
  assert.equal(p2.rewardBreakdown.weakSignal, 75);

  const p3 = recordCompletedQso(p2.save, entry({
    id: "p3", distanceKm: 1100, finalPropagationLevel: 3,
    guidanceLevel: "full", independentWatch: false,
  }));
  assert.equal(p3.creditsAwarded, 100);
  assert.equal(p3.save.credits, 285);
  assert.equal(p3.rewardBreakdown.weakSignal, 0);
});

test("does not infer a weak-signal reward from a missing or invalid propagation level", () => {
  const save = {
    credits: 10,
    qsoLogs: [entry({ id: "far", location: "NA-W", distanceKm: 9000, finalPropagationLevel: 4 })],
    qsoRecords: {
      total: 1,
      longestDistanceKm: 9000,
      longestQsoId: "far",
      contactedRegions: ["NA-W"],
      weakSignalQsos: 0,
    },
  };
  for (const [id, finalPropagationLevel] of [["missing-level", undefined], ["invalid-level", -1]]) {
    const result = recordCompletedQso(save, entry({
      id,
      distanceKm: 100,
      finalPropagationLevel,
      guidanceLevel: "full",
      independentWatch: false,
    }));
    assert.equal(result.creditsAwarded, 100);
    assert.equal(result.rewardBreakdown.weakSignal, 0);
    assert.equal(result.save.qsoRecords.weakSignalQsos, 0);
  }
});

test("does not retroactively award credits to a legacy settled log", () => {
  const legacyEntry = entry({ id: "legacy", version: 3, rewardBreakdown: undefined, credits: 150 });
  const save = { credits: 7, qsoLogs: [legacyEntry], qsoRecords: null };
  const retry = recordCompletedQso(save, legacyEntry);
  assert.equal(retry.added, false);
  assert.strictEqual(retry.save, save);
  assert.equal(retry.save.credits, 7);
  assert.equal(retry.creditsAwarded, 0);
  assert.equal(retry.rewardBreakdown, null);
  assert.equal(retry.settledEntry.credits, 150);
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
