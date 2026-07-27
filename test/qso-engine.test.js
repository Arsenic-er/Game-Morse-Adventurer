import test from "node:test";
import assert from "node:assert/strict";
import {
  QSO_PHASES, createQso, createQsoLogEntry, markQsoAssisted, onNpcPlaybackFinished,
  qsoCanAcceptPlayer, qsoNeedsNpcPlayback, resolveCqResponse,
  restartQso, submitPlayerMessage, validatePlayerMessage,
} from "../src/qso/qsoEngine.js";
import { MAX_QSO_ATTEMPT_HISTORY } from "../src/qso/qsoLog.js";

const npc = {
  callsign: "SIM7QX", regionId: "NA-SIM", latitude: 37.77, longitude: -122.42,
  baseLevel: 2, finalLevel: 3, wpm: 18, isFictional: true,
};

test("completes the minimum QSO state machine", () => {
  let qso = createQso({ npc, playerCallsign: "SIM-K7QX", startedAt: "2026-07-15T00:00:00.000Z" });
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.expectedPlayer, "CQ CQ DE SIM-K7QX SIM-K7QX K");
  assert.equal(qso.repeatRequests, 0);
  assert.equal(qso.contactRevealed, false);
  assert.equal(qso.guidanceLevel, "full");
  assert.equal(qso.visualAssistUsed, true);
  assert.deepEqual(qso.attemptHistory, []);
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K", { wpm: 19, accuracy: 94.44, rhythm: 88.86 });
  assert.equal(qso.phase, QSO_PHASES.WAITING_RESPONSE);
  assert.deepEqual(qso.attemptHistory[0], {
    stage: QSO_PHASES.PLAYER_CQ,
    message: "CQ CQ DE SIM-K7QX K",
    result: "accepted",
    reason: null,
    wpm: 19,
    accuracy: 94.4,
    rhythm: 88.9,
  });
  qso = resolveCqResponse(qso, npc);
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.equal(qso.contactRevealed, false);
  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73);
  assert.equal(qso.contactRevealed, false);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.contactRevealed, true);
  qso = onNpcPlaybackFinished(qso, "2026-07-15T00:05:00.000Z");
  assert.equal(qso.phase, QSO_PHASES.QSO_COMPLETE);
  assert.equal(qso.creditsAwarded, 100);
  assert.equal(qso.independentWatch, false);
  const log = createQsoLogEntry(qso, {
    playerLocation: { id: "japan-tokyo-kanto", latitude: 35.6762, longitude: 139.6503 },
    equipmentId: "squid-01",
    antennaId: "dipole",
    accessoryId: "cw-filter-500",
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
  assert.equal(log.accessoryId, "cw-filter-500");
  assert.equal(log.wpm, 18);
  assert.equal(log.transmitAccuracy, 96.4);
  assert.equal("copyAccuracy" in log, false);
  assert.equal(log.keyingScore, 91.2);
  assert.equal(log.repeatRequests, 0);
  assert.equal(log.guidanceLevel, "full");
  assert.equal(log.visualAssistUsed, true);
  assert.equal(log.independentWatch, false);
  assert.equal(log.attemptHistory.length, 2);
  assert.equal(log.version, 3);
  assert.equal(log.credits, 100);
  assert.equal(log.isFictional, true);
});

test("an unassisted guidance-off watch earns the independent bonus", () => {
  let qso = createQso({ npc, guidanceLevel: "off" });
  assert.equal(qso.guidanceLevel, "off");
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  qso = onNpcPlaybackFinished(qso, "2026-07-15T00:05:00.000Z");
  assert.equal(qso.independentWatch, true);
  assert.equal(qso.creditsAwarded, 150);

  const afterCompletion = markQsoAssisted(qso);
  assert.strictEqual(afterCompletion, qso);
  assert.equal(afterCompletion.visualAssistUsed, false);
  assert.equal(afterCompletion.independentWatch, true);
  assert.equal(afterCompletion.creditsAwarded, 150);
});

test("visual assistance prevents the independent bonus while guidance remains frozen", () => {
  assert.equal(createQso({ npc, guidanceLevel: "hints" }).visualAssistUsed, true);
  assert.equal(createQso({ npc, guidanceLevel: "hints", visualAssistUsed: false }).visualAssistUsed, false);
  assert.equal(createQso({ npc, guidanceLevel: "unknown" }).guidanceLevel, "full");
  let qso = createQso({ npc, guidanceLevel: "off", visualAssistUsed: false });
  qso = markQsoAssisted(qso);
  assert.equal(qso.guidanceLevel, "off");
  assert.equal(qso.visualAssistUsed, true);
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.independentWatch, false);
  assert.equal(qso.creditsAwarded, 100);
  assert.equal(restartQso(qso).guidanceLevel, "off");

  const failed = { ...createQso({ npc, guidanceLevel: "off" }), phase: QSO_PHASES.QSO_FAILED };
  assert.strictEqual(markQsoAssisted(failed), failed);
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

test("malformed replies accumulate attempts without forcing failure and a correction clears them", () => {
  let qso = createQso({ npc });
  assert.equal(validatePlayerMessage(qso, "SIM-K7QX DE CQ K").reason, "wrongCqOrder");
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.attempts, 2);
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  assert.equal(qso.phase, QSO_PHASES.WAITING_RESPONSE);
  assert.equal(qso.attempts, 0);

  const restarted = restartQso({ ...qso, phase: QSO_PHASES.QSO_FAILED });
  assert.equal(restarted.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(restarted.attempts, 0);
});

test("requires a valid RST and 73", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = resolveCqResponse(qso, npc);
  qso = onNpcPlaybackFinished(qso);
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 999 73 K").reason, "invalidRst");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 K").reason, "missing73");
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 999 73 K");
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 K");
  assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73);
  assert.equal(qso.attempts, 2);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.attempts, 0);
});

test("requires the strict REMOTE DE PLAYER RST nnn 73 K closing order", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  assert.equal(validatePlayerMessage(qso, "SIM7QX SIM-K7QX RST 559 73 K").reason, "missingDe");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73").reason, "missingK");
  assert.equal(validatePlayerMessage(qso, "AGN").reason, "invalidAgn");
  assert.equal(validatePlayerMessage(qso, "SIM-K7QX DE SIM7QX RST 559 73 K").reason, "wrongReplyOrder");
  assert.equal(validatePlayerMessage(qso, "SIM7QX RST 559 DE SIM-K7QX 73 K").reason, "wrongReplyOrder");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K").valid, true);
});

test("attempt history records every submission and retains only the newest bounded entries", () => {
  let qso = createQso({ npc });
  for (let index = 0; index < MAX_QSO_ATTEMPT_HISTORY + 5; index += 1) {
    qso = submitPlayerMessage(qso, `BAD ${index}`, {
      wpm: index,
      accuracy: index + 0.24,
      rhythm: 200,
    });
  }
  assert.equal(qso.attemptHistory.length, MAX_QSO_ATTEMPT_HISTORY);
  assert.equal(qso.attemptHistory[0].message, "BAD 5");
  assert.equal(qso.attemptHistory.at(-1).message, `BAD ${MAX_QSO_ATTEMPT_HISTORY + 4}`);
  assert.equal(qso.attemptHistory.at(-1).result, "rejected");
  assert.equal(qso.attemptHistory.at(-1).reason, "missingCq");
  assert.equal(qso.attemptHistory.at(-1).rhythm, 100);
});

test("a strict AGN K request replays the same incoming message without consuming an attempt", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.attempts, 1);
  const originalNpc = qso.npc;
  const originalMessage = qso.npcMessage;
  const originalExpected = qso.expectedPlayer;
  const originalLevels = [qso.npc.baseLevel, qso.npc.finalLevel];

  assert.deepEqual(validatePlayerMessage(qso, "agn   k"), {
    valid: true, reason: null, action: "repeat",
  });
  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.strictEqual(qso.npc, originalNpc);
  assert.equal(qso.npcMessage, originalMessage);
  assert.equal(qso.expectedPlayer, originalExpected);
  assert.deepEqual([qso.npc.baseLevel, qso.npc.finalLevel], originalLevels);
  assert.equal(qso.attempts, 1);
  assert.equal(qso.repeatRequests, 1);
  assert.equal(qso.contactRevealed, false);
  assert.equal(qso.creditsAwarded, 0);
  assert.equal(qsoNeedsNpcPlayback(qso), true);

  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73);
  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.repeatRequests, 2);
  qso = onNpcPlaybackFinished(qso);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.contactRevealed, true);
  assert.equal(qso.repeatRequests, 2);
});

test("repeat requests must be exactly AGN K and only work while awaiting the report", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  for (const message of ["AGN", "AGN ?", "PLEASE AGN K", "AGN K K", "AGN K EXTRA"]) {
    const validation = validatePlayerMessage(qso, message);
    assert.equal(validation.valid, false, message);
    assert.notEqual(validation.action, "repeat", message);
  }
  assert.equal(validatePlayerMessage(createQso({ npc }), "AGN K").valid, false);
});

test("an unanswered CQ returns to calling without counting as a failed attempt", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = resolveCqResponse(qso, null);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.unansweredCalls, 1);
  assert.equal(qso.attempts, 0);
  assert.equal(qso.lastError, "noResponse");
  assert.equal(qso.contactRevealed, false);
  assert.equal(qsoCanAcceptPlayer(qso), true);
  assert.equal(qsoNeedsNpcPlayback(qso), false);
});

test("only actual incoming phases request automatic playback", () => {
  let qso = createQso({ npc });
  assert.equal(qsoNeedsNpcPlayback(qso), false);
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  assert.equal(qsoNeedsNpcPlayback(qso), false);
  qso = resolveCqResponse(qso, npc);
  assert.equal(qsoNeedsNpcPlayback(qso), true);
});
