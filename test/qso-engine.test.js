import test from "node:test";
import assert from "node:assert/strict";
import {
  QSO_PHASES, createQso, createQsoLogEntry, markQsoAssisted, onNpcPlaybackFinished,
  qsoCanAcceptPlayer, qsoNeedsNpcPlayback, resolveCqResponse,
  restartQso, submitPlayerMessage, validatePlayerMessage,
} from "../src/qso/qsoEngine.js";
import { MAX_QSO_ATTEMPT_HISTORY, QSO_LOG_VERSION } from "../src/qso/qsoLog.js";
import { generateProceduralNpcAt, proceduralNpcToStation } from "../src/qso/proceduralNpc.js";
import { interpretCwTraffic } from "../src/qso/semanticInterpreter.js";

const npc = {
  callsign: "SIM7QX", regionId: "NA-SIM", latitude: 37.77, longitude: -122.42,
  baseLevel: 2, finalLevel: 3, wpm: 18, isFictional: true,
};

function reachReportPhase(candidate = npc) {
  let qso = submitPlayerMessage(createQso({ npc: candidate }), "CQ CQ DE SIM-K7QX K");
  qso = resolveCqResponse(qso, candidate, { seed: "reach-report" });
  assert.equal(qso.npcReplyDisposition, "copy");
  return onNpcPlaybackFinished(qso);
}

test("guided CQ validation accepts compact spacing and PSE K style", () => {
  const qso = createQso({ npc, playerCallsign: "BH1ABC" });
  for (const message of [
    "CQCQDEBH1ABCBH1ABCK",
    "CQ CQ DE BH1 ABC BH1 ABC PSE K",
  ]) {
    assert.deepEqual(validatePlayerMessage(qso, message), { valid: true, reason: null }, message);
  }
});

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
    accuracy: 100,
    rhythm: 88.9,
    cqQuality: 99,
    copyScore: null,
    remoteOutcome: null,
    operatorProfileId: null,
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
  assert.equal(qso.attemptHistory.at(-1).remoteOutcome, "copied");
  assert.equal(qso.attemptHistory.at(-1).operatorProfileId, "careful-beginner");
  assert.ok(qso.attemptHistory.at(-1).copyScore >= 68);
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
  assert.equal(log.wpm, 10);
  assert.equal(log.transmitAccuracy, 96.4);
  assert.equal("copyAccuracy" in log, false);
  assert.equal(log.keyingScore, 91.2);
  assert.equal(log.repeatRequests, 0);
  assert.equal(log.copyQueries, 0);
  assert.equal(log.cqQuality, 99);
  assert.ok(log.copyScore >= 75);
  assert.equal(log.copyOutcome, "copied");
  assert.equal(log.operatorProfileId, "careful-beginner");
  assert.equal(log.operatorProfileRevision, 4);
  assert.ok(log.remoteWpm >= 5 && log.remoteWpm <= 60);
  assert.equal(log.guidanceLevel, "full");
  assert.equal(log.visualAssistUsed, true);
  assert.equal(log.independentWatch, false);
  assert.equal(log.attemptHistory.length, 2);
  assert.equal(log.version, QSO_LOG_VERSION);
  assert.equal(log.credits, 100);
  assert.equal(log.isFictional, true);
});

test("a profile-selected optional question accepts an explicit answer without persisting it", () => {
  const chattyNpc = { ...npc, callsign: "SIM3RA" };
  let qso = reachReportPhase(chattyNpc);
  qso = submitPlayerMessage(qso, "SIM3RA DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_OPTIONAL_QUERY);
  assert.equal(qso.optionalExchangeQuestion, "location");
  assert.equal(qso.optionalExchangeOutcome, "pending");
  assert.equal(qso.npcMessage, "SIM-K7QX DE SIM3RA R RST 579 QTH QTH? K");
  assert.equal(qsoNeedsNpcPlayback(qso), true);

  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_OPTIONAL_ANSWER);
  assert.equal(qso.expectedPlayer, "QTH PIXEL CITY K");
  assert.equal(qsoCanAcceptPlayer(qso), true);

  qso = submitPlayerMessage(qso, "MY PRIVATE ADDRESS K");
  assert.equal(qso.lastError, "invalidOptionalAnswer");
  assert.equal(qso.attemptHistory.at(-1).message, "OPTIONAL RESPONSE REDACTED");
  assert.doesNotMatch(JSON.stringify(qso), /PRIVATE ADDRESS/);

  qso = submitPlayerMessage(qso, "QTH SECRET HARBOR K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.optionalExchangeOutcome, "answered");
  assert.equal(qso.attemptHistory.at(-1).message, "OPTIONAL RESPONSE REDACTED");
  assert.doesNotMatch(JSON.stringify(qso), /SECRET HARBOR/);

  qso = onNpcPlaybackFinished(qso, new Date(Date.parse(qso.startedAt) + 1000).toISOString());
  const log = createQsoLogEntry(qso);
  assert.equal(log.optionalExchangeQuestion, "location");
  assert.equal(log.optionalExchangeOutcome, "answered");
  assert.equal(log.optionalExchangeRepeatRequests, 0);
  assert.doesNotMatch(JSON.stringify(log), /SECRET|PRIVATE/);
});

test("optional topics use NPC reply style without retaining the player's answer", () => {
  const cases = [
    {
      callsign: "SIM3RA", answer: "QTH SECRET HARBOR K",
      question: "SIM-K7QX DE SIM3RA R RST 579 QTH QTH? K",
      final: "SIM-K7QX DE SIM3RA TNX QTH MY QTH PINE RIDGE R RST 579 73 SK", privateText: "SECRET HARBOR",
    },
    {
      callsign: "SIM5TU", answer: "PWR 50 W K",
      question: "SIM-K7QX DE SIM5TU R RST 579 PWR? K",
      final: "SIM-K7QX DE SIM5TU TNX PWR MY PWR 10 W R RST 579 73 SK", privateText: "50 W",
    },
    {
      callsign: "SIM2DX", answer: "WX SUNNY K",
      question: "SIM-K7QX DE SIM2DX R RST 579 WX? K",
      final: "SIM-K7QX DE SIM2DX TNX WX MY WX RAIN R RST 579 73 SK", privateText: "SUNNY",
    },
    {
      callsign: "SIM8CW", answer: "NAME SPARK K",
      question: "SIM-K7QX DE SIM8CW R RST 579 PSE NAME? K",
      final: "SIM-K7QX DE SIM8CW TNX NAME MY NAME DIEGO FB 73 SK", privateText: "SPARK",
    },
    {
      callsign: "SIM6JP", answer: "AGE 25 K",
      question: "SIM-K7QX DE SIM6JP R RST 579 PSE AGE? K",
      final: "SIM-K7QX DE SIM6JP TNX AGE MY AGE 19 FB 73 SK", privateText: "AGE 25",
    },
    {
      callsign: "SIM4NZ", answer: "RIG FIELD RADIO K",
      question: "SIM-K7QX DE SIM4NZ R RST 579 RIG RIG? K",
      final: "SIM-K7QX DE SIM4NZ TNX RIG MY RIG VINTAGE RIG R RST 579 73 SK", privateText: "FIELD RADIO",
    },
    {
      callsign: "SIM0BR", answer: "ANTENNA VERTICAL K",
      question: "SIM-K7QX DE SIM0BR R RST 579 PSE ANT? K",
      final: "SIM-K7QX DE SIM0BR TNX ANT MY ANT 3EL YAGI FB 73 SK", privateText: "VERTICAL",
    },
  ];
  for (const candidate of cases) {
    const remote = { ...npc, callsign: candidate.callsign };
    let qso = reachReportPhase(remote);
    qso = submitPlayerMessage(qso, `${candidate.callsign} DE SIM-K7QX RST 559 73 K`);
    assert.equal(qso.npcMessage, candidate.question, candidate.callsign);
    qso = onNpcPlaybackFinished(qso);
    qso = submitPlayerMessage(qso, candidate.answer);
    assert.equal(qso.npcMessage, candidate.final, candidate.callsign);
    assert.doesNotMatch(JSON.stringify(qso), new RegExp(candidate.privateText), candidate.callsign);
  }
});

test("optional answers accept semantic and contextual variants while rejecting empty values", () => {
  const cases = [
    ["SIM3RA", "MY QTH SECRET HARBOR K"],
    ["SIM5TU", "POWER 50W K"],
    ["SIM2DX", "WEATHER SUNNY K"],
    ["SIM8CW", "MY NAME SPARK K"],
    ["SIM6JP", "MY AGE 25 K"],
    ["SIM4NZ", "RADIO FIELD RIG K"],
    ["SIM0BR", "ANTENNA VERTICAL K"],
  ];
  for (const [callsign, answer] of cases) {
    const remote = { ...npc, callsign };
    let qso = reachReportPhase(remote);
    qso = submitPlayerMessage(qso, `${callsign} DE SIM-K7QX RST 559 73 K`);
    qso = onNpcPlaybackFinished(qso);
    qso = submitPlayerMessage(qso, answer);
    assert.equal(qso.optionalExchangeOutcome, "answered", `${callsign}:${answer}`);
    assert.equal(qso.attemptHistory.at(-1).message, "OPTIONAL RESPONSE REDACTED");
    assert.doesNotMatch(JSON.stringify(qso), new RegExp(answer.replace(/ K$/, "")), callsign);
  }

  let contextual = reachReportPhase({ ...npc, callsign: "SIM3RA" });
  contextual = submitPlayerMessage(contextual, "SIM3RA DE SIM-K7QX RST 559 73 K");
  contextual = onNpcPlaybackFinished(contextual);
  const contextualSemantics = interpretCwTraffic({
    message: "PIXEL CITY K",
    phase: QSO_PHASES.PLAYER_OPTIONAL_ANSWER,
    selfCallsign: contextual.playerCallsign,
    peerCallsign: contextual.npc.callsign,
    pendingQuestion: "LOCATION",
  });
  contextual = submitPlayerMessage(contextual, "PIXEL CITY K", {
    semanticResult: { ...contextualSemantics, provider: "onnxruntime-node" },
  });
  assert.equal(contextual.optionalExchangeOutcome, "answered");

  let emptyAge = reachReportPhase({ ...npc, callsign: "SIM6JP" });
  emptyAge = submitPlayerMessage(emptyAge, "SIM6JP DE SIM-K7QX RST 559 73 K");
  emptyAge = onNpcPlaybackFinished(emptyAge);
  emptyAge = submitPlayerMessage(emptyAge, "MY AGE K");
  assert.equal(emptyAge.lastError, "invalidOptionalAnswer");

  let unsafePower = reachReportPhase({ ...npc, callsign: "SIM5TU" });
  unsafePower = submitPlayerMessage(unsafePower, "SIM5TU DE SIM-K7QX RST 559 73 K");
  unsafePower = onNpcPlaybackFinished(unsafePower);
  const powerMessage = "PWR 50 W K";
  const powerSemantics = interpretCwTraffic({
    message: powerMessage,
    phase: QSO_PHASES.PLAYER_OPTIONAL_ANSWER,
    selfCallsign: unsafePower.playerCallsign,
    peerCallsign: unsafePower.npc.callsign,
    pendingQuestion: "POWER",
  });
  unsafePower = submitPlayerMessage(unsafePower, powerMessage, {
    semanticResult: { ...powerSemantics, safeToCommit: false },
  });
  assert.equal(unsafePower.phase, QSO_PHASES.PLAYER_OPTIONAL_ANSWER);
  assert.equal(unsafePower.lastError, "unsafeSemanticResult");
  assert.equal(unsafePower.optionalExchangeOutcome, "pending");
  assert.equal(unsafePower.attemptHistory.at(-1).result, "rejected");
});

test("an optional question can be replayed or politely skipped with no extra reward", () => {
  const chattyNpc = { ...npc, callsign: "SIM5TU" };
  let qso = reachReportPhase(chattyNpc);
  qso = submitPlayerMessage(qso, "SIM5TU DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_OPTIONAL_QUERY);
  assert.equal(qso.optionalExchangeQuestion, "power");
  const question = qso.npcMessage;
  qso = onNpcPlaybackFinished(qso);
  assert.deepEqual(validatePlayerMessage(qso, "AGN K"), {
    valid: true, reason: null, action: "repeat-optional",
  });
  assert.deepEqual(validatePlayerMessage(qso, "SKIP K"), {
    valid: true, reason: null, action: "skip-optional",
  });
  assert.deepEqual(validatePlayerMessage(qso, "73 K"), {
    valid: true, reason: null, action: "skip-optional",
  });

  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.phase, QSO_PHASES.NPC_OPTIONAL_QUERY);
  assert.equal(qso.npcMessage, question);
  assert.equal(qso.optionalExchangeRepeatRequests, 1);
  assert.equal(qso.repeatRequests, 1);
  assert.equal(qso.creditsAwarded, 0);
  qso = onNpcPlaybackFinished(qso);
  qso = submitPlayerMessage(qso, "73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.optionalExchangeOutcome, "skipped");
  assert.match(qso.npcMessage, / OK R RST 579 73 SK$/);
  qso = onNpcPlaybackFinished(qso, new Date(Date.parse(qso.startedAt) + 1000).toISOString());
  assert.equal(qso.phase, QSO_PHASES.QSO_COMPLETE);
  assert.equal(qso.creditsAwarded, 100);
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

test("createQsoLogEntry retains the production procedural NPC identity", () => {
  const profile = generateProceduralNpcAt({ worldSeed: "qso-log-identity", globalIndex: 0 });
  const station = proceduralNpcToStation(profile);
  const qso = {
    ...createQso({
      npc: station,
      playerCallsign: "JA1LGT",
      startedAt: "2026-07-15T00:00:00.000Z",
    }),
    phase: QSO_PHASES.QSO_COMPLETE,
    completedAt: "2026-07-15T00:05:00.000Z",
    sentRst: "559",
    receivedRst: "579",
  };

  assert.equal(qso.npc.proceduralNpcId, "N1-JP-0000");
  const log = createQsoLogEntry(qso);
  assert.equal(log.personId, "person:procedural:N1-JP-0000");
  assert.equal(log.stationId, "station:procedural:N1-JP-0000");
});

test("malformed CQ is transmitted on air and resolved by the remote copy model", () => {
  let qso = createQso({ npc });
  assert.equal(validatePlayerMessage(qso, "SIM-K7QX DE CQ K").reason, "wrongCqOrder");
  qso = submitPlayerMessage(qso, "BAD");
  assert.equal(qso.phase, QSO_PHASES.WAITING_RESPONSE);
  assert.ok(qso.cqAssessment.quality < 20);
  assert.equal(qso.attemptHistory.at(-1).result, "transmitted");
  assert.equal(qso.attemptHistory.at(-1).reason, "missingCq");
  qso = resolveCqResponse(qso, { ...npc, callsign: "SIM6JP", finalLevel: 2 }, { seed: "bad-cq" });
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.lastCopyOutcome, "unreadable");
  assert.equal(qso.channelNotice, "unreadableCq");
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  assert.equal(qso.phase, QSO_PHASES.WAITING_RESPONSE);
  assert.equal(qso.attempts, 0);

  const restarted = restartQso({ ...qso, phase: QSO_PHASES.QSO_FAILED });
  assert.equal(restarted.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(restarted.attempts, 0);
});

test("a partial report copy asks for a full repeat without changing the contact", () => {
  let qso = reachReportPhase();
  const originalNpc = qso.npc;
  const lockedContact = {
    callsign: qso.npc.callsign,
    baseLevel: qso.npc.baseLevel,
    finalLevel: qso.npc.finalLevel,
    operatorProfileId: qso.npc.operatorProfileId,
  };
  const originalContactMessage = qso.npcMessage;

  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K", {
    wpm: 18, accuracy: 45, rhythm: 60, seed: "partial-report",
  });
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.equal(qso.npcReplyDisposition, "report-query");
  assert.equal(qso.npcMessage, "AGN? K");
  assert.equal(qso.reportCopyQueries, 1);
  assert.equal(qso.creditsAwarded, 0);
  assert.equal(qso.sentRst, null);
  assert.strictEqual(qso.npc, originalNpc);
  assert.deepEqual({
    callsign: qso.npc.callsign,
    baseLevel: qso.npc.baseLevel,
    finalLevel: qso.npc.finalLevel,
    operatorProfileId: qso.npc.operatorProfileId,
  }, lockedContact);
  assert.equal(qso.attemptHistory.at(-1).remoteOutcome, "query");
  assert.ok(qso.attemptHistory.at(-1).copyScore >= 42);
  assert.equal(qso.attemptHistory.at(-1).operatorProfileId, "careful-beginner");

  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73);
  assert.equal(qso.channelNotice, "reportQuery");
  assert.equal(qso.npcMessage, originalContactMessage);
  assert.equal(qso.contactRevealed, true);

  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.equal(qso.npcMessage, originalContactMessage);
  assert.equal(qso.contactRevealed, true);
});

test("an unreadable report remains recoverable and only a copied retry can complete", () => {
  let qso = reachReportPhase();
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K", {
    wpm: 18, accuracy: 0, rhythm: 0, seed: "unreadable-report",
  });
  assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73);
  assert.equal(qso.lastReportCopyOutcome, "unreadable");
  assert.equal(qso.channelNotice, "unreadableReport");
  assert.equal(qso.creditsAwarded, 0);
  assert.equal(qso.sentRst, null);
  assert.equal(qsoCanAcceptPlayer(qso), true);
  assert.equal(qso.attemptHistory.at(-1).remoteOutcome, "unreadable");
  assert.ok(qso.attemptHistory.at(-1).copyScore < 42);

  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K", {
    wpm: 18, accuracy: 100, rhythm: 100, seed: "clear-report",
  });
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.lastReportCopyOutcome, "copied");
  assert.deepEqual(qso.attemptHistory.slice(-2).map((attempt) => attempt.remoteOutcome), ["unreadable", "copied"]);

  const completedAt = new Date(Date.parse(qso.startedAt) + 1000).toISOString();
  const duplicateCallbackAt = new Date(Date.parse(qso.startedAt) + 2000).toISOString();
  qso = onNpcPlaybackFinished(qso, completedAt);
  assert.equal(qso.phase, QSO_PHASES.QSO_COMPLETE);
  assert.equal(qso.creditsAwarded, 100);
  const completed = qso;
  qso = onNpcPlaybackFinished(qso, duplicateCallbackAt);
  assert.strictEqual(qso, completed);
  assert.equal(qso.completedAt, completedAt);
  assert.equal(qso.creditsAwarded, 100);
  const firstLog = createQsoLogEntry(qso);
  const secondLog = createQsoLogEntry(qso);
  assert.equal(firstLog.id, secondLog.id);
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

test("report safety fields preserve addressing order without imposing a seven-token script", () => {
  let qso = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  qso = onNpcPlaybackFinished(resolveCqResponse(qso, npc));
  assert.equal(validatePlayerMessage(qso, "SIM7QX SIM-K7QX RST 559 73 K").reason, "missingDe");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73").reason, "missingK");
  assert.equal(validatePlayerMessage(qso, "AGN").reason, "invalidAgn");
  assert.equal(validatePlayerMessage(qso, "SIM-K7QX DE SIM7QX RST 559 73 K").reason, "wrongReplyOrder");
  assert.equal(validatePlayerMessage(qso, "SIM7QX RST 559 DE SIM-K7QX 73 K").reason, "wrongReplyOrder");
  assert.equal(validatePlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K").valid, true);

  for (const message of [
    "R SIM7QX DE SIM-K7QX UR RST 559 TNX 73 PSE K",
    "SIM7QX SIM7QX DE SIM-K7QX SIM-K7QX R UR RST 559 TNX 73 KN",
  ]) {
    const semanticResult = interpretCwTraffic({
      message,
      phase: QSO_PHASES.PLAYER_RST_AND_73,
      selfCallsign: qso.playerCallsign,
      peerCallsign: qso.npc.callsign,
    });
    assert.equal(semanticResult.safeToCommit, true, message);
    assert.deepEqual(
      validatePlayerMessage(qso, message, { semanticResult: {
        ...semanticResult,
        provider: "onnxruntime-node",
        acts: { ...semanticResult.acts, PROVIDE: .002 },
      } }),
      { valid: true, reason: null, action: "complete", rst: "559" },
      message,
    );
  }
});

test("an extended report reaches NPC copy evaluation and can complete normally", () => {
  let qso = reachReportPhase();
  const message = "R SIM7QX DE SIM-K7QX UR RST 559 TNX 73 PSE K";
  qso = submitPlayerMessage(qso, message, {
    wpm: 18,
    accuracy: 100,
    rhythm: 100,
    seed: "extended-report",
  });
  assert.equal(qso.lastError, null);
  assert.equal(qso.lastReportCopyOutcome, "copied");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.sentRst, "559");
  assert.equal(qso.attemptHistory.at(-1).remoteOutcome, "copied");
});

test("unsafe or unsupported semantic reports never advance a contact", () => {
  const message = "SIM7QX DE SIM-K7QX RST 559 73 K";
  const semantics = interpretCwTraffic({
    message,
    phase: QSO_PHASES.PLAYER_RST_AND_73,
    selfCallsign: "SIM-K7QX",
    peerCallsign: "SIM7QX",
  });
  assert.equal(semantics.safeToCommit, true);

  const candidates = [
    [{ ...semantics, safeToCommit: false }, "unsafeSemanticResult"],
    [{ ...semantics, acts: { ...semantics.acts, REPORT: 0 } }, "unrecognizedReport"],
    [{ ...semantics, topics: { ...semantics.topics, RST: 0 } }, "unrecognizedReport"],
    [{
      ...semantics,
      slots: semantics.slots.map((slot) => slot.topic === "RST" ? { ...slot, value: "599" } : slot),
    }, "unrecognizedReport"],
  ];

  for (const [semanticResult, reason] of candidates) {
    let qso = reachReportPhase();
    qso = submitPlayerMessage(qso, message, {
      wpm: 18,
      accuracy: 100,
      rhythm: 100,
      seed: `fail-closed:${reason}`,
      semanticResult,
    });
    assert.equal(qso.phase, QSO_PHASES.PLAYER_RST_AND_73, reason);
    assert.equal(qso.lastError, reason);
    assert.equal(qso.sentRst, null);
    assert.equal(qso.lastReportCopyOutcome, null);
    assert.equal(qso.attemptHistory.at(-1).result, "rejected");
    assert.equal(qso.attemptHistory.at(-1).remoteOutcome, null);
  }
});

test("hard report fields cannot be bypassed by an optimistic model result", () => {
  const qso = reachReportPhase();
  const goodMessage = "SIM7QX DE SIM-K7QX RST 559 73 K";
  const optimistic = interpretCwTraffic({
    message: goodMessage,
    phase: QSO_PHASES.PLAYER_RST_AND_73,
    selfCallsign: qso.playerCallsign,
    peerCallsign: qso.npc.callsign,
  });
  for (const [message, reason] of [
    ["SIM7QX DE SIM-K7QX RST 999 73 K", "invalidRst"],
    ["SIM-K7QX DE SIM7QX RST 559 73 K", "wrongReplyOrder"],
    ["SIM7QX DE SIM-K7QX RST 559 K", "missing73"],
    ["SIM7QX DE SIM-K7QX RST 559 73", "missingK"],
    ["SIM7QX DE SIM-K7QX RST 559 RST 579 73 K", "invalidRst"],
  ]) {
    assert.equal(validatePlayerMessage(qso, message, { semanticResult: optimistic }).reason, reason, message);
  }
});

test("attempt history records every submission and retains only the newest bounded entries", () => {
  let qso = createQso({ npc });
  for (let index = 0; index < MAX_QSO_ATTEMPT_HISTORY + 5; index += 1) {
    qso = submitPlayerMessage(qso, `BAD ${index}`, {
      wpm: index,
      accuracy: index + 0.24,
      rhythm: 200,
    });
    qso = resolveCqResponse(qso, null);
  }
  assert.equal(qso.attemptHistory.length, MAX_QSO_ATTEMPT_HISTORY);
  assert.equal(qso.attemptHistory[0].message, "BAD 5");
  assert.equal(qso.attemptHistory.at(-1).message, `BAD ${MAX_QSO_ATTEMPT_HISTORY + 4}`);
  assert.equal(qso.attemptHistory.at(-1).result, "transmitted");
  assert.equal(qso.attemptHistory.at(-1).reason, "missingCq");
  assert.equal(qso.attemptHistory.at(-1).rhythm, 100);
  assert.equal(qso.attemptHistory.at(-1).remoteOutcome, "no-response");
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
  assert.equal(qso.channelNotice, "agnRepeat");
  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.repeatRequests, 2);
  qso = onNpcPlaybackFinished(qso);
  qso = submitPlayerMessage(qso, "SIM7QX DE SIM-K7QX RST 559 73 K");
  assert.equal(qso.phase, QSO_PHASES.NPC_73_AND_SK);
  assert.equal(qso.contactRevealed, true);
  assert.equal(qso.repeatRequests, 2);
});

test("QRS accepts three strict forms and rejects malformed slowdown requests", () => {
  const qso = reachReportPhase({ ...npc, callsign: "SIM3RA" });
  for (const message of ["QRS K", "qrs   pse k", "PSE QRS K"]) {
    assert.deepEqual(validatePlayerMessage(qso, message), {
      valid: true, reason: null, action: "repeat-slower",
    });
  }
  for (const message of ["QRS", "QRS PSE", "PSE QRS", "PLEASE QRS K", "QRS K K", "QRS AGN K"]) {
    assert.deepEqual(validatePlayerMessage(qso, message), {
      valid: false, reason: "invalidQrs",
    });
  }
  assert.equal(validatePlayerMessage(createQso({ npc }), "QRS K").valid, false);
});

test("QRS replays the same contact more slowly, floors at 5 WPM, and AGN keeps that speed", () => {
  let qso = reachReportPhase({ ...npc, callsign: "SIM3RA" });
  const originalNpc = qso.npc;
  const originalMessage = qso.npcMessage;
  const originalLevels = [qso.npc.baseLevel, qso.npc.finalLevel];
  const initialWpm = qso.replyWpm;

  qso = submitPlayerMessage(qso, "QRS PSE K");
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.strictEqual(qso.npc, originalNpc);
  assert.equal(qso.npcMessage, originalMessage);
  assert.deepEqual([qso.npc.baseLevel, qso.npc.finalLevel], originalLevels);
  assert.equal(qso.replyWpm, Math.max(5, initialWpm - 4));
  assert.equal(qso.channelNotice, "qrsRepeat");
  assert.equal(qso.repeatRequests, 1);
  assert.equal(qso.attempts, 0);
  assert.equal(qso.attemptHistory.at(-1).result, "repeat");
  assert.equal(qso.creditsAwarded, 0);

  qso = onNpcPlaybackFinished(qso);
  const slowedWpm = qso.replyWpm;
  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.replyWpm, slowedWpm);
  assert.equal(qso.channelNotice, "agnRepeat");

  for (let index = 0; index < 8; index += 1) {
    qso = onNpcPlaybackFinished(qso);
    qso = submitPlayerMessage(qso, "QRS K");
  }
  assert.equal(qso.replyWpm, 5);
  assert.equal(qso.channelNotice, "qrsMinimum");
});

test("QRS slows and repeats the same optional question without rerolling or rewarding it", () => {
  const chattyNpc = { ...npc, callsign: "SIM5TU" };
  let qso = reachReportPhase(chattyNpc);
  qso = submitPlayerMessage(qso, "SIM5TU DE SIM-K7QX RST 559 73 K");
  const originalQuestion = qso.optionalExchangeQuestion;
  const originalMessage = qso.npcMessage;
  const originalWpm = qso.replyWpm;
  qso = onNpcPlaybackFinished(qso);

  assert.deepEqual(validatePlayerMessage(qso, "PSE QRS K"), {
    valid: true, reason: null, action: "repeat-optional-slower",
  });
  qso = submitPlayerMessage(qso, "PSE QRS K");
  assert.equal(qso.phase, QSO_PHASES.NPC_OPTIONAL_QUERY);
  assert.equal(qso.optionalExchangeQuestion, originalQuestion);
  assert.equal(qso.npcMessage, originalMessage);
  assert.equal(qso.replyWpm, Math.max(5, originalWpm - 3));
  assert.equal(qso.channelNotice, "qrsRepeat");
  assert.equal(qso.optionalExchangeRepeatRequests, 1);
  assert.equal(qso.repeatRequests, 1);
  assert.equal(qso.creditsAwarded, 0);

  qso = onNpcPlaybackFinished(qso);
  const slowedWpm = qso.replyWpm;
  qso = submitPlayerMessage(qso, "AGN K");
  assert.equal(qso.replyWpm, slowedWpm);
  assert.equal(qso.optionalExchangeQuestion, originalQuestion);
  assert.equal(qso.npcMessage, originalMessage);
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

test("a partially copied CQ receives a personality-specific query and can be resent immediately", () => {
  const beginner = { ...npc, callsign: "SIM7QX", finalLevel: 2 };
  let qso = submitPlayerMessage(
    createQso({ npc: beginner }),
    "CQ CQ SIM-K7QX K",
    { wpm: 18, rhythm: 80 },
  );
  qso = resolveCqResponse(qso, beginner, { seed: "demo" });
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.equal(qso.npcReplyDisposition, "query");
  assert.match(qso.npcMessage, /AGN|QRZ|QRS|\?/);
  assert.equal(qso.hasContact, false);
  assert.equal(qso.contactRevealed, false);
  assert.equal(qso.copyQueries, 1);
  assert.equal(qso.lastCopyOutcome, "query");
  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.channelNotice, "npcQuery");
  assert.equal(qsoCanAcceptPlayer(qso), true);
  assert.equal(qso.pendingResponder.callsign, "SIM7QX");
  assert.equal(qso.pendingResponderQueryCount, 1);
});

test("a new responder starts with fresh patience while total queries stay cumulative", () => {
  const beginner = { ...npc, callsign: "SIM7QX", finalLevel: 2 };
  let qso = submitPlayerMessage(
    { ...createQso({ npc: beginner }), copyQueries: 9, pendingResponderQueryCount: 0 },
    "CQ CQ SIM-K7QX K",
    { wpm: 18, rhythm: 80 },
  );
  qso = resolveCqResponse(qso, beginner, { seed: "demo" });
  assert.equal(qso.npcReplyDisposition, "query");
  assert.equal(qso.copyQueries, 10);
  assert.equal(qso.pendingResponderQueryCount, 1);
});

test("a responder stops querying at its own patience limit", () => {
  const impatient = { ...npc, callsign: "SIM9AK", finalLevel: 4 };
  let qso = submitPlayerMessage(createQso({ npc: impatient }), "CQ DE SIM-K7Q K", { wpm: 18, rhythm: 80 });
  qso = resolveCqResponse(qso, impatient, { seed: "patience" });
  assert.equal(qso.npcReplyDisposition, "query");
  qso = onNpcPlaybackFinished(qso);
  qso = submitPlayerMessage(qso, "CQ DE SIM-K7Q K", { wpm: 18, rhythm: 80 });
  qso = resolveCqResponse(qso, impatient, { seed: "patience" });
  assert.notEqual(qso.npcReplyDisposition, "query");
  assert.equal(qso.copyQueries, 1);
  assert.equal(qso.pendingResponder, null);
  assert.equal(qso.pendingResponderQueryCount, 0);
});

test("a recognizable but unreadable call can turn into an undirected general CQ", () => {
  const clubStation = { ...npc, callsign: "SIM6JP", finalLevel: 2 };
  let qso = submitPlayerMessage(
    createQso({ npc: clubStation }),
    "CQ T T K",
    { wpm: 18, rhythm: 70 },
  );
  qso = resolveCqResponse(qso, clubStation, { seed: "demo" });
  assert.equal(qso.phase, QSO_PHASES.NPC_REPLY);
  assert.equal(qso.npcReplyDisposition, "general");
  assert.equal(qso.npcMessage, "CQ CQ DE SIM6JP SIM6JP K");
  assert.equal(qso.hasContact, false);
  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  assert.equal(qso.channelNotice, "generalCall");
  assert.equal(qso.unansweredCalls, 1);
});

test("only actual incoming phases request automatic playback", () => {
  let qso = createQso({ npc });
  assert.equal(qsoNeedsNpcPlayback(qso), false);
  qso = submitPlayerMessage(qso, "CQ CQ DE SIM-K7QX K");
  assert.equal(qsoNeedsNpcPlayback(qso), false);
  qso = resolveCqResponse(qso, npc);
  assert.equal(qsoNeedsNpcPlayback(qso), true);
});
