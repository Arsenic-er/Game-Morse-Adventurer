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
  sanitizeDynamicCatalogs,
  sanitizeSemanticPayload,
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
test("semantic IPC catalogs are allowlisted, normalized, deduplicated, and bounded", () => {
  const catalogs = sanitizeDynamicCatalogs({
    NAME: Array.from({ length: 20 }, (_, index) => ` op-${index} `),
    LOCATION: ["  Forest <Club>  ", "FOREST CLUB", null],
    RIG: "MICA 8",
    CALLSIGN: ["EVIL1"],
  });
  assert.deepEqual(catalogs.NAME, Array.from({ length: 16 }, (_, index) => `OP-${index}`));
  assert.deepEqual(catalogs.LOCATION, ["FOREST CLUB"]);
  assert.equal(Object.hasOwn(catalogs, "RIG"), false);
  assert.equal(Object.hasOwn(catalogs, "CALLSIGN"), false);

  const payload = sanitizeSemanticPayload({
    message: "X".repeat(600),
    phase: "PLAYER_CQ".repeat(8),
    selfCallsign: "BH1ABC-TOO-LONG-AGAIN",
    knownSlots: Array.from({ length: 40 }, (_, index) => `SLOT-${index}`),
    catalogs,
  });
  assert.equal(payload.message.length, 512);
  assert.equal(payload.phase.length, 32);
  assert.equal(payload.selfCallsign.length, 16);
  assert.equal(payload.knownSlots.length, 24);
  assert.deepEqual(payload.catalogs, catalogs);
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
