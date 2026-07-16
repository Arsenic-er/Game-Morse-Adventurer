import test from "node:test";
import assert from "node:assert/strict";
import {
  QSO_PHASES, createQso, createQsoLogEntry, onNpcPlaybackFinished,
  restartQso, submitPlayerMessage, validatePlayerMessage,
} from "../src/qso/qsoEngine.js";

const npc = {
  callsign: "SIM7QX", regionId: "NA-SIM", latitude: 37.77, longitude: -122.42,
  baseLevel: 2, finalLevel: 3, wpm: 18, isFictional: true,
};

test("completes the minimum QSO state machine", () => {
  let qso = createQso({ npc, playerCallsign: "SIM-K7QX", startedAt: "2026-07-15T00:00:00.000Z" });
  assert.equal(qso.phase, QSO_PHASES.WAITING_CQ);
  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_REPLY);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX K");
  assert.equal(qso.phase, QSO_PHASES.NPC_RST);
  qso = onNpcPlaybackFinished(qso);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  qso = onNpcPlaybackFinished(qso, "2026-07-15T00:05:00.000Z");
  assert.equal(qso.phase, QSO_PHASES.QSO_COMPLETE);
  assert.equal(qso.creditsAwarded, 100);
  const log = createQsoLogEntry(qso, {
    playerLocation: { id: "japan-tokyo-kanto", latitude: 35.6762, longitude: 139.6503 },
    equipmentId: "squid-01",
    antennaId: "dipole",
    propagationSource: "OFFLINE_DEFAULT",
    copyAccuracy: 96.4,
    keyingScore: 91.2,
  });
  assert.equal(log.callsign, "SIM7QX");
  assert.equal(log.playerCallsign, "SIM-K7QX");
  assert.equal(log.sent, "559");
  assert.equal(log.received, "579");
  assert.equal(log.startedAt, "2026-07-15T00:00:00.000Z");
  assert.equal(log.completedAt, "2026-07-15T00:05:00.000Z");
  assert.equal(log.location, "NA-SIM");
  assert.equal(log.npcLatitude, 37.77);
  assert.equal(log.npcLongitude, -122.42);
  assert.ok(log.distanceKm > 8000);
  assert.equal(log.basePropagationLevel, 2);
  assert.equal(log.finalPropagationLevel, 3);
  assert.equal(log.propagationSource, "OFFLINE_DEFAULT");
  assert.equal(log.playerLocationId, "japan-tokyo-kanto");
  assert.equal(log.equipmentId, "squid-01");
  assert.equal(log.antennaId, "dipole");
  assert.equal(log.wpm, 18);
  assert.equal(log.copyAccuracy, 96.4);
  assert.equal(log.keyingScore, 91.2);
  assert.equal(log.credits, 100);
  assert.equal(log.isFictional, true);
});

test("only completed QSOs with chronological timestamps can be logged", () => {
  assert.throws(() => createQsoLogEntry(createQso({ npc })), /Only completed QSOs/);
  const invalid = {
    ...createQso({ npc, startedAt: "2026-07-15T00:06:00.000Z" }),
    phase: QSO_PHASES.QSO_COMPLETE,
    completedAt: "2026-07-15T00:05:00.000Z",
  };
  assert.throws(() => createQsoLogEntry(invalid), /chronological timestamps/);
});

test("rejects malformed replies and records failure", () => {
  let qso = onNpcPlaybackFinished(createQso({ npc }));
  assert.equal(validatePlayerMessage(qso, "SIM-K7QX DE SIM7QX").reason, "wrongCallsignOrder");
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.phase, QSO_PHASES.PLAYER_REPLY);
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.phase, QSO_PHASES.QSO_FAILED);
  assert.equal(restartQso(qso).phase, QSO_PHASES.WAITING_CQ);
});

test("requires a valid RST and 73", () => {
  let qso = onNpcPlaybackFinished(createQso({ npc }));
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(qso);
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 999 73 K").reason, "invalidRst");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 K").reason, "missing73");
});
