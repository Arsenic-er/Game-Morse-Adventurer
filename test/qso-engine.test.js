import test from "node:test";
import assert from "node:assert/strict";
import {
  QSO_PHASES, createQso, createQsoLogEntry, onNpcPlaybackFinished,
  restartQso, submitPlayerMessage, validatePlayerMessage,
} from "../src/qso/qsoEngine.js";

const npc = { callsign: "SIM7QX", regionId: "NA-SIM", isFictional: true };

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
  const log = createQsoLogEntry(qso);
  assert.equal(log.callsign, "SIM7QX");
  assert.equal(log.sent, "559");
  assert.equal(log.isFictional, true);
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

