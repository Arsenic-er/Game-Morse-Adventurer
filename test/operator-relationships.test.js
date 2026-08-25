import test from "node:test";
import assert from "node:assert/strict";
import {
  OPERATOR_RELATIONSHIPS_VERSION, normalizeOperatorRelationship, normalizeOperatorRelationships,
  operatorEncounterId, recordCompletedOperatorRelationship, recordOperatorEncounter,
} from "../src/qso/operatorRelationships.js";

function log(overrides = {}) {
  return {
    id: "SIM2DX-1",
    callsign: "SIM2DX",
    startedAt: "2026-08-13T11:58:00.000Z",
    completedAt: "2026-08-13T12:00:00.000Z",
    operatorProfileId: "weak-signal-listener",
    finalPropagationLevel: 1,
    copyOutcome: "copied",
    copyQueries: 1,
    repeatRequests: 0,
    attemptHistory: [{ remoteOutcome: "query" }],
    optionalExchangeQuestion: "weather",
    optionalExchangeOutcome: "answered",
    ...overrides,
  };
}

test("relationship schema records encounters, completed QSOs, recoveries and topics", () => {
  assert.equal(OPERATOR_RELATIONSHIPS_VERSION, 2);
  const first = recordCompletedOperatorRelationship([], log());
  assert.deepEqual(first, [{
    personId: "person:legacy:SIM2DX",
    callsign: "SIM2DX",
    operatorProfileId: "weak-signal-listener",
    encounterCount: 1,
    completedQsos: 1,
    weakSignalRecoveries: 1,
    topicCounts: { weather: 1 },
    firstMetAt: "2026-08-13T12:00:00.000Z",
    lastMetAt: "2026-08-13T12:00:00.000Z",
    lastEncounterId: "SIM2DX:2026-08-13T11:58:00.000Z",
    lastQsoId: "SIM2DX-1",
  }]);

  const second = recordCompletedOperatorRelationship(first, log({
    id: "SIM2DX-2",
    completedAt: "2026-08-14T12:00:00.000Z",
    finalPropagationLevel: 4,
    copyQueries: 0,
    attemptHistory: [],
    optionalExchangeQuestion: "rig",
  }));
  assert.equal(second[0].encounterCount, 2);
  assert.equal(second[0].completedQsos, 2);
  assert.equal(second[0].weakSignalRecoveries, 1);
  assert.deepEqual(second[0].topicCounts, { weather: 1, rig: 1 });
  assert.equal(second[0].lastQsoId, "SIM2DX-2");
  assert.deepEqual(recordCompletedOperatorRelationship(second, log({ id: "SIM2DX-2", completedAt: "2026-08-14T12:00:00.000Z" })), second);
});

test("relationship normalization sanitizes corrupt input and keeps the latest callsign row", () => {
  const normalized = normalizeOperatorRelationship({
    callsign: " sim/2dx! ", operatorProfileId: " x ", encounterCount: -2, completedQsos: 3,
    weakSignalRecoveries: 99, topicCounts: { weather: "2.9", private: 99 },
    firstMetAt: "2026-08-14T00:00:00Z", lastMetAt: "2026-08-13T00:00:00Z", lastQsoId: " qso ",
  });
  assert.equal(normalized.callsign, "SIM/2DX");
  assert.equal(normalized.encounterCount, 3);
  assert.equal(normalized.weakSignalRecoveries, 3);
  assert.deepEqual(normalized.topicCounts, { weather: 2 });
  assert.equal(normalized.firstMetAt, "2026-08-13T00:00:00.000Z");
  assert.equal(normalized.lastMetAt, "2026-08-14T00:00:00.000Z");
  assert.equal(normalized.lastEncounterId, null);
  assert.deepEqual(normalizeOperatorRelationships([null, {}, normalized, { ...normalized, lastMetAt: "2026-08-15T00:00:00Z" }]).map(({ callsign }) => callsign), ["SIM/2DX"]);
});

test("weak propagation alone is not called a recovery without a copy problem", () => {
  const relationship = recordCompletedOperatorRelationship([], log({ copyQueries: 0, repeatRequests: 0, attemptHistory: [] }))[0];
  assert.equal(relationship.weakSignalRecoveries, 0);
});

test("an on-air responder counts as met before completion without double counting the QSO", () => {
  const startedAt = "2026-08-13T11:58:00.000Z";
  const encounterId = operatorEncounterId("SIM2DX", startedAt);
  const met = recordOperatorEncounter([], {
    callsign: "SIM2DX", operatorProfileId: "weak-signal-listener",
  }, startedAt, encounterId);
  assert.equal(met[0].encounterCount, 1);
  assert.equal(met[0].completedQsos, 0);
  const completed = recordCompletedOperatorRelationship(met, log({ startedAt }));
  assert.equal(completed[0].encounterCount, 1);
  assert.equal(completed[0].completedQsos, 1);
  assert.deepEqual(recordOperatorEncounter(completed, {
    callsign: "SIM2DX", operatorProfileId: "weak-signal-listener",
  }, startedAt, encounterId), completed);
});

test("v1 fixed-station rows migrate idempotently to one SORA relationship keyed by personId", () => {
  const legacy = [{
    callsign: "SIM6JP",
    operatorProfileId: "youth-club",
    encounterCount: 2,
    completedQsos: 2,
    weakSignalRecoveries: 1,
    topicCounts: { name: 1 },
    firstMetAt: "2026-08-01T00:00:00.000Z",
    lastMetAt: "2026-08-02T00:00:00.000Z",
    lastEncounterId: "SIM6JP:2026-08-02T00:00:00.000Z",
    lastQsoId: "club-qso",
  }, {
    callsign: "SIM5LT",
    operatorProfileId: "youth-club",
    encounterCount: 1,
    completedQsos: 0,
    weakSignalRecoveries: 0,
    topicCounts: { weather: 1 },
    firstMetAt: "2026-08-03T00:00:00.000Z",
    lastMetAt: "2026-08-03T00:00:00.000Z",
    lastEncounterId: "lights-chase:story-run",
    lastQsoId: null,
  }];

  const migrated = normalizeOperatorRelationships(legacy);
  assert.deepEqual(migrated, [{
    personId: "person:sora",
    callsign: "SIM5LT",
    operatorProfileId: "youth-club",
    encounterCount: 3,
    completedQsos: 2,
    weakSignalRecoveries: 1,
    topicCounts: { weather: 1, name: 1 },
    firstMetAt: "2026-08-01T00:00:00.000Z",
    lastMetAt: "2026-08-03T00:00:00.000Z",
    lastEncounterId: "lights-chase:story-run",
    lastQsoId: "club-qso",
  }]);
  assert.deepEqual(normalizeOperatorRelationships(migrated), migrated);
});

test("v1 unknown callsigns never merge merely because names match", () => {
  const common = {
    operatorName: "SAM",
    operatorProfileId: "legacy-standard",
    encounterCount: 1,
    completedQsos: 1,
    firstMetAt: "2026-08-01T00:00:00.000Z",
    lastMetAt: "2026-08-01T00:01:00.000Z",
  };
  const migrated = normalizeOperatorRelationships([
    { ...common, callsign: "OLD1AA" },
    { ...common, callsign: "OLD2BB" },
  ]);

  assert.deepEqual(migrated.map(({ personId }) => personId).sort(), [
    "person:legacy:OLD1AA",
    "person:legacy:OLD2BB",
  ]);
});

test("cross-station migration keeps merged counters within safe integer bounds", () => {
  const common = {
    operatorProfileId: "youth-club",
    encounterCount: 1e30,
    completedQsos: 1e30,
    weakSignalRecoveries: 1e30,
    topicCounts: { weather: 1e30 },
  };
  const [relationship] = normalizeOperatorRelationships([{
    ...common,
    callsign: "SIM6JP",
    firstMetAt: "2026-08-01T00:00:00.000Z",
    lastMetAt: "2026-08-01T00:00:00.000Z",
  }, {
    ...common,
    callsign: "SIM5LT",
    firstMetAt: "2026-08-02T00:00:00.000Z",
    lastMetAt: "2026-08-02T00:00:00.000Z",
  }]);

  assert.equal(relationship.encounterCount, Number.MAX_SAFE_INTEGER);
  assert.equal(relationship.completedQsos, Number.MAX_SAFE_INTEGER);
  assert.equal(relationship.weakSignalRecoveries, Number.MAX_SAFE_INTEGER);
  assert.equal(relationship.topicCounts.weather, Number.MAX_SAFE_INTEGER);
});
