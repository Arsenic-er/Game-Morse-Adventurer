import test from "node:test";
import assert from "node:assert/strict";
import { assessCqTransmission } from "../src/qso/cqAssessment.js";
import {
  DEFAULT_OPERATOR_PROFILE_ID, NPC_OPERATOR_ASSIGNMENTS, OPERATOR_PROFILES,
  OPERATOR_PROFILE_SCHEMA_VERSION, resolveOperatorProfile, resolveRemoteCopy, resolveRemoteReportCopy,
  responseDelayForNpc, withOperatorProfile,
} from "../src/qso/operatorProfiles.js";
import { NPC_STATIONS } from "../src/propagation/propagationEngine.js";

test("the versioned operator table covers every fictional station with bounded traits", () => {
  assert.equal(OPERATOR_PROFILE_SCHEMA_VERSION, 1);
  assert.ok(Object.keys(OPERATOR_PROFILES).length >= 7);
  for (const station of NPC_STATIONS) {
    assert.ok(NPC_OPERATOR_ASSIGNMENTS[station.callsign], station.callsign);
    const resolved = resolveOperatorProfile(station);
    assert.ok(OPERATOR_PROFILES[resolved.profileId], station.callsign);
  }
  for (const [id, candidate] of Object.entries(OPERATOR_PROFILES)) {
    assert.equal(Object.isFrozen(candidate), true, id);
    for (const key of [
      "rxSkill", "txAccuracy", "speedTolerance", "patience", "procedureStrictness",
      "responseTempo", "fistStability", "verbosity", "initiative",
    ]) {
      assert.ok(candidate[key] >= 0 && candidate[key] <= 100, `${id}:${key}`);
    }
    assert.ok(candidate.preferredWpm >= 5 && candidate.preferredWpm <= 40, id);
  }
});

test("unknown callsigns use an explicit safe fallback profile", () => {
  const unknown = withOperatorProfile({ callsign: "SIMZZZ", finalLevel: 3, wpm: 44 });
  assert.equal(unknown.operatorProfileId, DEFAULT_OPERATOR_PROFILE_ID);
  assert.equal(unknown.operatorProfileRevision, OPERATOR_PROFILE_SCHEMA_VERSION);
  assert.ok(unknown.wpm >= 5 && unknown.wpm <= 60);
});

test("the same imperfect CQ is copied by a veteran but queried by a beginner", () => {
  const assessment = assessCqTransmission({
    message: "CQ CQ BH1ABC K",
    playerCallsign: "BH1ABC",
    wpm: 18,
    rhythm: 80,
  });
  const veteran = resolveRemoteCopy({
    assessment,
    npc: { callsign: "SIM3RA", finalLevel: 3 },
    playerCallsign: "BH1ABC",
    seed: "demo",
  });
  const beginner = resolveRemoteCopy({
    assessment,
    npc: { callsign: "SIM7QX", finalLevel: 2 },
    playerCallsign: "BH1ABC",
    seed: "demo",
  });
  assert.equal(veteran.outcome, "copied");
  assert.equal(beginner.outcome, "query");
  assert.match(beginner.replyMessage, /AGN|QRZ|QRS|\?/);
});

test("recognizable low-quality traffic can produce a general CQ without creating a copy", () => {
  const assessment = assessCqTransmission({
    message: "CQ T T K",
    playerCallsign: "BH1ABC",
    wpm: 18,
    rhythm: 70,
  });
  const decision = resolveRemoteCopy({
    assessment,
    npc: { callsign: "SIM6JP", finalLevel: 2 },
    playerCallsign: "BH1ABC",
    seed: "demo",
  });
  assert.equal(decision.outcome, "unreadable");
  assert.equal(decision.disposition, "general");
  assert.equal(decision.replyMessage, "CQ CQ DE SIM6JP SIM6JP K");
});

test("operator decisions, WPM and delays are deterministic for a stable seed", () => {
  const assessment = assessCqTransmission({
    message: "CQ CQ DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 32, rhythm: 78,
  });
  const npc = { callsign: "SIM5TU", finalLevel: 3 };
  const first = resolveRemoteCopy({ assessment, npc, playerCallsign: "BH1ABC", seed: "stable" });
  const second = resolveRemoteCopy({ assessment, npc, playerCallsign: "BH1ABC", seed: "stable" });
  assert.deepEqual(first, second);
  assert.equal(responseDelayForNpc(npc, "stable"), responseDelayForNpc(npc, "stable"));
  assert.ok(first.replyWpm >= 5 && first.replyWpm <= 60);
  assert.ok(first.responseDelayMs >= 700);
});

test("report copy is deterministic and uses the locked operator and propagation level", () => {
  const args = {
    npc: { callsign: "SIM7QX", finalLevel: 2 },
    wpm: 18,
    accuracy: 45,
    rhythm: 60,
    seed: "stable-report",
  };
  const first = resolveRemoteReportCopy(args);
  const second = resolveRemoteReportCopy(args);
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "query");
  assert.equal(first.replyMessage, "AGN? K");
  assert.equal(first.operatorProfileId, "careful-beginner");

  const weakBeginner = resolveRemoteReportCopy({
    ...args,
    npc: { callsign: "SIM7QX", finalLevel: 1 },
  });
  const strongVeteran = resolveRemoteReportCopy({
    ...args,
    npc: { callsign: "SIM3RA", finalLevel: 4 },
  });
  assert.ok(strongVeteran.copyScore > weakBeginner.copyScore);

  const tooFast = resolveRemoteReportCopy({
    npc: { callsign: "SIM7QX", finalLevel: 4 },
    wpm: 60,
    accuracy: 100,
    rhythm: 100,
    seed: "fast-report",
  });
  assert.equal(tooFast.outcome, "query");
  assert.equal(tooFast.replyMessage, "QRS? K");
});

test("speed, CQ intent and exact callsign identity materially affect copy", () => {
  const fast = assessCqTransmission({
    message: "CQ CQ DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 40, rhythm: 90,
  });
  const beginner = resolveRemoteCopy({
    assessment: fast, npc: { callsign: "SIM7QX", finalLevel: 4 }, playerCallsign: "BH1ABC", seed: "speed",
  });
  const veteran = resolveRemoteCopy({
    assessment: fast, npc: { callsign: "SIM3RA", finalLevel: 4 }, playerCallsign: "BH1ABC", seed: "speed",
  });
  assert.equal(beginner.outcome, "query");
  assert.match(beginner.replyMessage, /QRS/);
  assert.equal(veteran.outcome, "copied");

  const noCq = assessCqTransmission({
    message: "DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 17, rhythm: 90,
  });
  assert.notEqual(resolveRemoteCopy({
    assessment: noCq, npc: { callsign: "SIM3RA", finalLevel: 4 }, playerCallsign: "BH1ABC", seed: "intent",
  }).outcome, "copied");

  const longCallError = assessCqTransmission({
    message: "CQ DE BH1ABCZ K", playerCallsign: "BH1ABCX", wpm: 17, rhythm: 90,
  });
  const identityDecision = resolveRemoteCopy({
    assessment: longCallError, npc: { callsign: "SIM3RA", finalLevel: 4 }, playerCallsign: "BH1ABCX", seed: "identity",
  });
  assert.equal(longCallError.identityEditDistance, 1);
  assert.equal(identityDecision.outcome, "query");
  assert.match(identityDecision.replyMessage, /QRZ|\?/);
});

test("transmit accuracy, verbosity, initiative and fist stability change observable behavior", () => {
  const exact = assessCqTransmission({
    message: "CQ DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 18, rhythm: 95,
  });
  const base = { callsign: "SIM8CW", finalLevel: 4 };

  let accuracySeed = null;
  for (let index = 0; index < 500 && accuracySeed === null; index += 1) {
    const seed = `accuracy-${index}`;
    const inaccurate = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { txAccuracy: 0 } }, playerCallsign: "BH1ABC", seed });
    const accurate = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { txAccuracy: 100 } }, playerCallsign: "BH1ABC", seed });
    if (inaccurate.selfCorrection && !accurate.selfCorrection) accuracySeed = seed;
  }
  assert.ok(accuracySeed);

  const terse = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { verbosity: 0, txAccuracy: 100 } }, playerCallsign: "BH1ABC", seed: "verbosity" });
  const verbose = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { verbosity: 100, txAccuracy: 100 } }, playerCallsign: "BH1ABC", seed: "verbosity" });
  assert.ok(verbose.replyMessage.length > terse.replyMessage.length);

  const lowTraffic = assessCqTransmission({ message: "CQ T T K", playerCallsign: "BH1ABC", wpm: 18, rhythm: 70 });
  let initiativeSeed = null;
  for (let index = 0; index < 500 && initiativeSeed === null; index += 1) {
    const seed = `initiative-${index}`;
    const passive = resolveRemoteCopy({ assessment: lowTraffic, npc: { ...base, operatorOverrides: { initiative: 0 } }, playerCallsign: "BH1ABC", seed });
    const active = resolveRemoteCopy({ assessment: lowTraffic, npc: { ...base, operatorOverrides: { initiative: 100 } }, playerCallsign: "BH1ABC", seed });
    if (passive.disposition === "silence" && active.disposition === "general") initiativeSeed = seed;
  }
  assert.ok(initiativeSeed);

  let fistSeed = null;
  for (let index = 0; index < 500 && fistSeed === null; index += 1) {
    const seed = `fist-${index}`;
    const stable = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { fistStability: 100 } }, playerCallsign: "BH1ABC", seed });
    const uneven = resolveRemoteCopy({ assessment: exact, npc: { ...base, operatorOverrides: { fistStability: 0 } }, playerCallsign: "BH1ABC", seed });
    if (stable.replyWpm === stable.npc.operatorStyle.preferredWpm && uneven.replyWpm !== stable.replyWpm) fistSeed = seed;
  }
  assert.ok(fistSeed);
});

test("query and reply style enums produce distinct, cause-aware messages", () => {
  const fast = assessCqTransmission({ message: "CQ DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 40, rhythm: 90 });
  const identityError = assessCqTransmission({ message: "CQ DE BH1ABX K", playerCallsign: "BH1ABC", wpm: 18, rhythm: 90 });
  const base = { callsign: "SIMX", finalLevel: 4 };
  const messageFor = (assessment, queryStyle) => resolveRemoteCopy({
    assessment,
    npc: { ...base, operatorOverrides: { queryStyle, rxSkill: 60, preferredWpm: 10, speedTolerance: 0 } },
    playerCallsign: "BH1ABC",
    seed: "style",
  }).replyMessage;
  assert.notEqual(messageFor(fast, "QUESTION"), messageFor(fast, "QRS"));
  assert.notEqual(messageFor(identityError, "QUESTION"), messageFor(identityError, "QRZ"));

  const exact = assessCqTransmission({ message: "CQ DE BH1ABC K", playerCallsign: "BH1ABC", wpm: 18, rhythm: 95 });
  const replyFor = (replyStyle) => resolveRemoteCopy({
    assessment: exact,
    npc: { ...base, operatorOverrides: { replyStyle, txAccuracy: 100, verbosity: 80 } },
    playerCallsign: "BH1ABC",
    seed: "reply-style",
  }).replyMessage;
  assert.equal(new Set(["TERSE", "REPEAT", "FRIENDLY", "STANDARD"].map(replyFor)).size, 4);
});
