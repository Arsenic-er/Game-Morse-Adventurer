const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  MODEL_FILE,
  createSemanticRuntime,
  encodeText,
  normalizePhase,
  normalizeSemanticText,
} = require("../electron/semantic-runtime.cjs");

const assetDirectory = path.resolve(__dirname, "..", "runtime-models");

const tokenizerContract = {
  maxSemanticLength: 8,
  tokenizer: {
    clsId: 1,
    characterToId: { " ": 2, A: 3, B: 4, C: 5, "1": 6 },
  },
};

test("semantic runtime normalizes and encodes the training alphabet exactly", () => {
  assert.equal(normalizeSemanticText(" a_ b\n1 ", tokenizerContract.tokenizer.characterToId), "A B1");
  const encoded = encodeText("ABC1ABC1", tokenizerContract);
  assert.equal(encoded.normalized, "ABC1ABC");
  assert.deepEqual([...encoded.ids], [1n, 3n, 4n, 5n, 6n, 3n, 4n, 5n]);
  assert.deepEqual([...encoded.mask], [1, 1, 1, 1, 1, 1, 1, 1]);
});

test("game phases map onto the model dialogue phases", () => {
  assert.equal(normalizePhase("PLAYER_CQ"), "CALLING");
  assert.equal(normalizePhase("PLAYER_RST_AND_73"), "EXCHANGE");
  assert.equal(normalizePhase("QSO_COMPLETE"), "CLOSING");
  assert.equal(normalizePhase("unexpected"), "IDLE");
});

test("INT8 semantic model accepts tolerant CQ and rejects noise", {
  skip: !fs.existsSync(path.join(assetDirectory, MODEL_FILE)),
}, async () => {
  const runtime = createSemanticRuntime({ assetDirectory });
  const cq = await runtime.interpret({
    message: "CQCQDEBH1ABCBH1ABCPSEK",
    phase: "PLAYER_CQ",
    selfCallsign: "BH1ABC",
    peerCallsign: "JA1PIX",
  });
  assert.equal(cq.provider, "onnxruntime-node");
  assert.equal(cq.safeToCommit, true);
  assert.ok(cq.acts.CQ > 0.9);
  assert.ok(cq.topics.CALLSIGN > 0.9);
  assert.ok(cq.interpretability >= 90);

  const noise = await runtime.interpret({
    message: "T T T T",
    phase: "PLAYER_CQ",
    selfCallsign: "BH1ABC",
  });
  assert.equal(noise.safeToCommit, false);
  assert.equal(noise.procedure.grade, "IRRELEVANT");
  assert.ok(noise.interpretability < 35);
});

test("optional power replies decode the game's spaced unit format", {
  skip: !fs.existsSync(path.join(assetDirectory, MODEL_FILE)),
}, async () => {
  const runtime = createSemanticRuntime({ assetDirectory });
  const result = await runtime.interpret({
    message: "PWR 50 W K",
    phase: "PLAYER_OPTIONAL_ANSWER",
    pendingQuestion: "POWER",
    selfCallsign: "BH1ABC",
    peerCallsign: "JA1PIX",
    knownSlots: ["CALLSIGN", "RST"],
  });
  assert.equal(result.safeToCommit, true);
  assert.ok(result.topics.POWER > 0.9);
  assert.deepEqual(result.slots.filter(({ topic }) => topic === "POWER").map(({ value }) => value), ["50W"]);
});
