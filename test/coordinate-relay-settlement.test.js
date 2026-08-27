import assert from "node:assert/strict";
import test from "node:test";

import {
  beginCoordinateRelayRun, coordinatePacketText, createCoordinateRelayRun, normalizeCoordinateRelayState,
  receiveCoordinatePacket, receiveRelayConfirmation, submitCoordinateRelayText,
} from "../src/game/coordinateRelayRun.js";
import { settleCoordinateRelayRun, verifiedCoordinateRelayCompletion } from "../src/game/coordinateRelaySettlement.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const START = "2026-08-28T02:00:00.000Z";
const SETTLE = "2026-08-28T02:02:00.000Z";
const safe = { safeToCommit: true };

export function completedCoordinateRun(seed = "coordinate-settlement") {
  let run = beginCoordinateRelayRun(createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed, startedAt: START }));
  run = receiveCoordinatePacket(run, "2026-08-28T02:00:10.000Z");
  run = submitCoordinateRelayText(run, coordinatePacketText(run.packet), safe, "2026-08-28T02:00:20.000Z");
  run = submitCoordinateRelayText(run, coordinatePacketText(run.packet), safe, "2026-08-28T02:00:30.000Z");
  return receiveRelayConfirmation(run, `QSL MSG ${run.packet.packetId} CHECK ${String(run.packet.check).padStart(2, "0")} K`, "2026-08-28T02:00:40.000Z");
}

function readySave(run = completedCoordinateRun()) {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save, money: 500, technologyPoints: 12,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState, chapter09: normalizeCoordinateRelayState({ activeRun: run }),
    }),
  };
}

test("coordinate settlement atomically links packet, both event QSOs, relationships, and settled id", () => {
  const run = completedCoordinateRun();
  const initial = readySave(run);
  const result = settleCoordinateRelayRun(initial, run, SETTLE);
  assert.equal(result.settled, true);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.deepEqual(result.qsoIds.length, 2);
  assert.equal(result.save.money, 500);
  assert.equal(result.save.technologyPoints, 12);
  const chapter = result.save.storyContinuationState.chapter09;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.equal(chapter.packets.length, 1);
  assert.deepEqual(chapter.packets[0].packet, run.packet);
  assert.equal(chapter.packets[0].sourceQsoId, result.qsoIds[0]);
  assert.equal(chapter.packets[0].relayQsoId, result.qsoIds[1]);
  const logs = result.qsoIds.map((id) => result.save.qsoLogs.find((entry) => entry.id === id));
  assert.deepEqual(logs.map(({ eventKind }) => eventKind), ["coordinate-relay", "coordinate-relay"]);
  assert.deepEqual(logs.map(({ personId }) => personId), [run.source.personId, run.relay.personId]);
  assert.ok(logs.every(({ eventRunId, credits }) => eventRunId === run.runId && credits === 0));
  assert.deepEqual(result.save.operatorRelationships.filter(({ personId }) => [run.source.personId, run.relay.personId].includes(personId)).map(({ completedQsos }) => completedQsos), [1, 1]);
  const active = { acceptedAt: "2026-08-28T01:59:00.000Z", baselineCoordinateRelayRunIds: [] };
  assert.equal(verifiedCoordinateRelayCompletion(result.save, active), true);
  const duplicate = settleCoordinateRelayRun(result.save, run, "2026-08-28T02:03:00.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("coordinate settlement rejects missing, mismatched, forged, inherited, and early evidence", () => {
  const run = completedCoordinateRun("coordinate-forged");
  const save = readySave(run);
  for (const candidate of [
    { ...run, phase: "RELAY_CONFIRMATION", completedAt: null },
    { ...run, runId: "coordinate-relay:forged" },
    Object.create(run),
  ]) assert.equal(settleCoordinateRelayRun(save, candidate, SETTLE).settled, false);
  const missing = { ...save, storyContinuationState: normalizeStoryContinuationState({ ...save.storyContinuationState, chapter09: normalizeCoordinateRelayState({}) }) };
  assert.equal(settleCoordinateRelayRun(missing, run, SETTLE).reason, "RUN_STATE_MISMATCH");
  assert.equal(settleCoordinateRelayRun(save, run, "2026-08-28T02:00:39.999Z").reason, "INVALID_SETTLEMENT_TIME");
  const settled = settleCoordinateRelayRun(save, run, SETTLE).save;
  const active = { acceptedAt: "2026-08-28T01:59:00.000Z", baselineCoordinateRelayRunIds: [] };
  for (const forged of [
    { ...settled, qsoLogs: settled.qsoLogs.slice(1) },
    { ...settled, operatorRelationships: settled.operatorRelationships.slice(1) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter09: normalizeCoordinateRelayState({ ...settled.storyContinuationState.chapter09, settledRunIds: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter09: normalizeCoordinateRelayState({ ...settled.storyContinuationState.chapter09, packets: [] }) }) },
  ]) assert.equal(verifiedCoordinateRelayCompletion(forged, active), false);
});

test("coordinate archive survives two JSON save normalizations without back-paying value", () => {
  const result = settleCoordinateRelayRun(readySave(), completedCoordinateRun(), SETTLE);
  assert.equal(result.settled, true);
  const once = normalizeSave(JSON.parse(JSON.stringify(result.save)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, 500);
  assert.equal(twice.technologyPoints, 12);
  assert.equal(twice.qsoLogs.length, 2);
});
