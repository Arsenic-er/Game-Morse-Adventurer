import test from "node:test";
import assert from "node:assert/strict";
import {
  SEMANTIC_MODEL_CONTRACT_VERSION,
  SEMANTIC_RESULT_SCHEMA_VERSION,
  interpretCwTraffic,
} from "../src/qso/semanticInterpreter.js";
import {
  SIGNAL_OBSERVATION_SCHEMA_VERSION,
  observePlayerSignal,
} from "../src/qso/signalObservation.js";
import {
  NPC_RECEPTION_SCHEMA_VERSION,
  resolveRemoteCopy,
} from "../src/qso/operatorProfiles.js";

function cqSemantics(message = "CQ CQ DE BH1ABC PSE K") {
  return interpretCwTraffic({
    message,
    phase: "CALLING",
    selfCallsign: "BH1ABC",
    wpm: 18,
  });
}

test("semantic result is a versioned ONNX-compatible meaning contract", () => {
  const result = cqSemantics("CQCQDEBH1 ABC PSE K");
  assert.equal(SEMANTIC_MODEL_CONTRACT_VERSION, "qso-semantic-runtime-4");
  assert.equal(result.register, "CW_PROCEDURAL");
  assert.ok(Object.hasOwn(result.acts, "REPEAT_REQUEST"));
  assert.ok(Object.hasOwn(result.acts, "SPEED_REQUEST"));
  assert.ok(Object.hasOwn(result.topics, "CQ_SCOPE"));
  assert.equal(result.schemaVersion, SEMANTIC_RESULT_SCHEMA_VERSION);
  assert.equal(result.contractVersion, SEMANTIC_MODEL_CONTRACT_VERSION);
  assert.equal(result.provider, "rules-v1");
  assert.ok(result.acts.CQ >= .55);
  assert.ok(result.topics.CALLSIGN >= .7);
  assert.equal(result.slots.find(({ role }) => role === "SELF")?.value, "BH1ABC");
  assert.equal(result.safeToCommit, true);
  assert.ok(result.interpretability >= 80);
});

test("elliptical optional answers use dialogue context without inventing a verdict", () => {
  const result = interpretCwTraffic({
    message: "5 W K",
    phase: "EXCHANGE",
    selfCallsign: "BH1ABC",
    peerCallsign: "SIM5TU",
    pendingQuestion: "POWER",
  });
  assert.ok(result.acts.PROVIDE >= .9);
  assert.ok(result.topics.POWER >= .9);
  assert.equal(result.safeToCommit, true);
  assert.equal(Object.hasOwn(result, "copyScore"), false);
  assert.equal(Object.hasOwn(result, "outcome"), false);
});

test("signal observation records facts but never judges the player", () => {
  const semantics = cqSemantics();
  const observation = observePlayerSignal({
    message: semantics.normalized,
    wpm: 19.4,
    accuracy: 83,
    rhythm: 71,
    semanticResult: semantics,
  });
  assert.equal(observation.schemaVersion, SIGNAL_OBSERVATION_SCHEMA_VERSION);
  assert.deepEqual(observation.timing, { wpm: 19.4, rhythmScore: 71 });
  assert.equal(observation.transcript.decoderAccuracy, 83);
  assert.equal(Object.hasOwn(observation, "quality"), false);
  assert.equal(Object.hasOwn(observation, "outcome"), false);
});

test("NPC personality produces the verdict after meaning and signal are fixed", () => {
  const semanticResult = cqSemantics("CQ CQ BH1ABC K");
  const signalObservation = observePlayerSignal({
    message: semanticResult.normalized,
    wpm: 18,
    accuracy: 80,
    rhythm: 80,
    semanticResult,
  });
  const common = {
    semanticResult,
    signalObservation,
    playerCallsign: "BH1ABC",
    seed: "demo",
  };
  const veteran = resolveRemoteCopy({ ...common, npc: { callsign: "SIM3RA", finalLevel: 3 } });
  const beginner = resolveRemoteCopy({ ...common, npc: { callsign: "SIM7QX", finalLevel: 2 } });
  assert.equal(veteran.schemaVersion, NPC_RECEPTION_SCHEMA_VERSION);
  assert.equal(veteran.outcome, "copied");
  assert.equal(beginner.outcome, "query");
  assert.ok(veteran.copyScore > beginner.copyScore);
});

test("model confidence alone is never treated as player signal quality", () => {
  const semanticResult = cqSemantics();
  const signalObservation = observePlayerSignal({
    message: semanticResult.normalized,
    wpm: 18,
    accuracy: 90,
    rhythm: 90,
    semanticResult,
  });
  const args = {
    signalObservation,
    npc: { callsign: "SIM3RA", finalLevel: 4 },
    playerCallsign: "BH1ABC",
    seed: "confidence-is-not-skill",
  };
  const normal = resolveRemoteCopy({ ...args, semanticResult });
  const uncertainModel = resolveRemoteCopy({
    ...args,
    semanticResult: { ...semanticResult, confidence: .01 },
  });
  assert.equal(normal.copyScore, uncertainModel.copyScore);
  assert.equal(normal.outcome, uncertainModel.outcome);
});
