const { createHash } = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const MODEL_FILE = "qso-semanticformer-v0.4.int8.onnx";
const CONTRACT_FILE = "qso-semanticformer-v0.4.runtime-contract.json";
const EXPECTED_CONTRACT = "qso-semantic-runtime-4";

const DEFAULT_CATALOGS = Object.freeze({
  NAME: ["AKI", "HANA", "KEN", "MIO", "REN", "SORA", "YUKI", "LEO", "MAYA", "NINA"],
  LOCATION: ["AOBA", "LAKE HILL", "PINE BAY", "SORA VALLEY", "WEST RIDGE", "MIZU PORT"],
  WEATHER: ["SUNNY", "CLOUDY", "RAIN", "SNOW", "WINDY", "CLEAR"],
  RIG: ["USDX", "MICA8", "PIXIE", "QRP ONE", "HOME BREW"],
  ANTENNA: ["DIPOLE", "VERTICAL", "LOOP", "YAGI", "END FED"],
  REGION: ["JA", "EU", "NA", "SA", "AF", "OC"],
  CQ_SCOPE: ["DX", "TEST", "QRP"],
});

const PROCEDURE_SCORES = Object.freeze({
  CANONICAL: 100,
  INTELLIGIBLE_NONCANONICAL: 82,
  INCOMPLETE: 52,
  AMBIGUOUS: 28,
  IRRELEVANT: 0,
});

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function softmax(values) {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  return exponentials.map((value) => value / total);
}

function argmax(values) {
  let bestIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[bestIndex]) bestIndex = index;
  }
  return bestIndex;
}

function normalizeSemanticText(value, characterToId) {
  const supported = new Set(Object.keys(characterToId));
  return [...String(value ?? "").toUpperCase()]
    .filter((character) => supported.has(character))
    .join("")
    .trim()
    .replace(/\s+/g, " ");
}

function encodeText(value, contract) {
  const { tokenizer, maxSemanticLength } = contract;
  const normalized = normalizeSemanticText(value, tokenizer.characterToId)
    .slice(0, maxSemanticLength - 1);
  const ids = new BigInt64Array(maxSemanticLength);
  const mask = new Uint8Array(maxSemanticLength);
  ids[0] = BigInt(tokenizer.clsId);
  mask[0] = 1;
  [...normalized].forEach((character, index) => {
    ids[index + 1] = BigInt(tokenizer.characterToId[character]);
    mask[index + 1] = 1;
  });
  return { normalized, ids, mask };
}

function encodeCallsign(value, contract) {
  const normalized = normalizeSemanticText(value, contract.tokenizer.characterToId)
    .replace(/\s/g, "")
    .slice(0, contract.maxCallsignLength);
  const ids = new BigInt64Array(contract.maxCallsignLength);
  [...normalized].forEach((character, index) => {
    ids[index] = BigInt(contract.tokenizer.characterToId[character]);
  });
  return ids;
}

function normalizePhase(value) {
  const phase = String(value ?? "IDLE").toUpperCase();
  if (phase === "PLAYER_CQ") return "CALLING";
  if (phase === "WAITING_RESPONSE") return "WAITING_REPLY";
  if (["PLAYER_RST_AND_73", "NPC_OPTIONAL_QUERY", "PLAYER_OPTIONAL_ANSWER", "NPC_REPLY"].includes(phase)) {
    return "EXCHANGE";
  }
  if (["NPC_73_AND_SK", "QSO_COMPLETE"].includes(phase)) return "CLOSING";
  return ["IDLE", "CALLING", "WAITING_REPLY", "EXCHANGE", "CLOSING"].includes(phase)
    ? phase : "IDLE";
}

function normalizePendingQuestion(value, contract) {
  const pending = String(value ?? "NONE").toUpperCase();
  return Object.hasOwn(contract.contextSchema.pendingQuestionToId, pending) ? pending : "NONE";
}

function encodeKnownSlots(values, contract) {
  const encoded = new Float32Array(contract.contextSchema.knownSlotNames.length);
  for (const value of Array.isArray(values) ? values : []) {
    const index = contract.contextSchema.knownSlotToIndex[String(value).toUpperCase()];
    if (Number.isInteger(index)) encoded[index] = 1;
  }
  return encoded;
}

function catalogMatches(text, values) {
  const matches = [];
  for (const value of [...values].sort((left, right) => right.length - left.length)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`).test(text)) matches.push(value);
  }
  return matches;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function decodeSlots(text, topics, safeToCommit) {
  if (!safeToCommit) return [];
  const matches = {
    CALLSIGN: unique(text.match(/(?<![A-Z0-9])(?=[A-Z0-9]{3,7}(?![A-Z0-9]))(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*[0-9])[A-Z0-9]+/g) ?? []),
    AGE: unique([
      ...[...text.matchAll(/(?<![A-Z0-9])AGE(?: IS)? (?<value>[89]|[1-7][0-9]|8[0-5])(?![0-9])/g)].map(({ groups }) => groups?.value),
      ...[...text.matchAll(/(?<![A-Z0-9])I AM (?<value>[89]|[1-7][0-9]|8[0-5]) YEARS OLD(?![A-Z0-9])/g)].map(({ groups }) => groups?.value),
      ...[...text.matchAll(/^(?<value>[89]|[1-7][0-9]|8[0-5])(?: K|$)/g)].map(({ groups }) => groups?.value),
    ]),
    POWER: unique((text.match(/(?<![A-Z0-9])(?:1|2|5|10|20|50|100) ?W(?![A-Z0-9])/g) ?? [])
      .map((value) => value.replace(" ", ""))),
    RST: unique(text.match(/(?<![0-9])[1-5][1-9][1-9](?![0-9])/g) ?? []),
  };
  for (const [topic, values] of Object.entries(DEFAULT_CATALOGS)) {
    matches[topic] = catalogMatches(text, values);
  }
  return Object.entries(matches).flatMap(([topic, values]) => {
    if ((topics[topic] ?? 0) < 0.5) return [];
    return values.map((value) => ({ topic, role: "VALUE", value, confidence: topics[topic] }));
  });
}

function checksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertContract(contract, modelBuffer) {
  if (contract.contractVersion !== EXPECTED_CONTRACT) {
    throw new Error(`Unsupported semantic contract: ${contract.contractVersion ?? "missing"}`);
  }
  const expected = contract.artifacts?.find(({ file }) => file.endsWith("release.int8.onnx"));
  if (!expected) throw new Error("Semantic contract does not declare the INT8 model.");
  const actual = checksum(modelBuffer);
  if (actual !== String(expected.sha256).toLowerCase()) {
    throw new Error(`Semantic model checksum mismatch: ${actual}`);
  }
}

function boundedText(value, maximum) {
  return String(value ?? "").slice(0, maximum);
}

function createSemanticRuntime({ assetDirectory }) {
  let loaded = null;
  let loading = null;

  async function load() {
    if (loaded) return loaded;
    if (!loading) {
      loading = (async () => {
        const contractPath = path.join(assetDirectory, CONTRACT_FILE);
        const modelPath = path.join(assetDirectory, MODEL_FILE);
        const [contractSource, modelBuffer] = await Promise.all([
          fs.readFile(contractPath, "utf8"),
          fs.readFile(modelPath),
        ]);
        const contract = JSON.parse(contractSource);
        assertContract(contract, modelBuffer);
        const ort = require("onnxruntime-node");
        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ["cpu"],
          graphOptimizationLevel: "all",
        });
        loaded = { contract, ort, session };
        return loaded;
      })().catch((error) => {
        loading = null;
        throw error;
      });
    }
    return loading;
  }

  async function interpret(payload = {}) {
    const { contract, ort, session } = await load();
    const text = encodeText(boundedText(payload.message, 512), contract);
    const phase = normalizePhase(payload.phase);
    const pending = normalizePendingQuestion(payload.pendingQuestion, contract);
    const context = new BigInt64Array([
      BigInt(contract.contextSchema.phaseToId[phase]),
      BigInt(contract.contextSchema.pendingQuestionToId[pending]),
    ]);
    const feeds = {
      input_ids: new ort.Tensor("int64", text.ids, [1, contract.maxSemanticLength]),
      valid_mask: new ort.Tensor("bool", text.mask, [1, contract.maxSemanticLength]),
      context_ids: new ort.Tensor("int64", context, [1, 2]),
      self_callsign_ids: new ort.Tensor("int64", encodeCallsign(boundedText(payload.selfCallsign, 16), contract), [1, contract.maxCallsignLength]),
      peer_callsign_ids: new ort.Tensor("int64", encodeCallsign(boundedText(payload.peerCallsign, 16), contract), [1, contract.maxCallsignLength]),
      known_slots: new ort.Tensor("float32", encodeKnownSlots(payload.knownSlots, contract), [1, contract.contextSchema.knownSlotNames.length]),
    };
    const output = await session.run(feeds);
    const actNames = contract.outputs.act_logits.names;
    const topicNames = contract.outputs.topic_logits.names;
    const acts = Object.fromEntries(actNames.map((name, index) => [name, sigmoid(output.act_logits.data[index])]));
    const topics = Object.fromEntries(topicNames.map((name, index) => [name, sigmoid(output.topic_logits.data[index])]));
    const registerProbabilities = softmax([...output.register_logits.data]);
    const procedureProbabilities = softmax([...output.procedure_logits.data]);
    const registerIndex = argmax(registerProbabilities);
    const procedureIndex = argmax(procedureProbabilities);
    const register = contract.outputs.register_logits.names[registerIndex];
    const grade = contract.outputs.procedure_logits.names[procedureIndex];
    const safeProbability = sigmoid(output.safe_to_commit_logits.data[0]);
    const safeToCommit = safeProbability >= contract.outputs.safe_to_commit_logits.threshold;
    const maximumAct = Math.max(...Object.values(acts));
    const maximumTopic = Math.max(...Object.values(topics));
    const confidence = (maximumAct + maximumTopic + procedureProbabilities[procedureIndex] + safeProbability) / 4;
    const interpretability = Math.round(100 * (
      0.4 * maximumAct + 0.25 * maximumTopic + 0.2 * procedureProbabilities[procedureIndex] + 0.15 * safeProbability
    ));
    const expectedCallsign = normalizeSemanticText(payload.selfCallsign, contract.tokenizer.characterToId).replace(/\s/g, "");
    const compactText = text.normalized.replace(/\s/g, "");
    return {
      contractVersion: contract.contractVersion,
      provider: "onnxruntime-node",
      modelVersion: contract.modelVersion,
      normalized: text.normalized,
      acts,
      topics,
      slots: decodeSlots(text.normalized, topics, safeToCommit),
      register,
      procedure: {
        grade,
        score: Math.round(PROCEDURE_SCORES[grade] * (0.7 + 0.3 * procedureProbabilities[procedureIndex])),
        issues: [],
      },
      interpretability,
      confidence,
      safeToCommit,
      fallbackRequired: false,
      evidence: {
        runtime: "onnxruntime-node",
        intentScore: (acts.CQ ?? 0) * 100,
        identityScore: (topics.CALLSIGN ?? 0) * 100,
        identityEditDistance: expectedCallsign && !compactText.includes(expectedCallsign) ? 1 : 0,
        terminalScore: Math.max(acts.HANDOVER ?? 0, acts.SIGNOFF ?? 0) * 100,
        safeProbability,
        procedureConfidence: procedureProbabilities[procedureIndex],
      },
    };
  }

  async function status() {
    try {
      const runtime = await load();
      return {
        available: true,
        contractVersion: runtime.contract.contractVersion,
        modelVersion: runtime.contract.modelVersion,
        provider: "onnxruntime-node",
      };
    } catch (error) {
      return { available: false, reason: String(error?.message ?? error).slice(0, 240) };
    }
  }

  return { interpret, status };
}

module.exports = {
  CONTRACT_FILE,
  MODEL_FILE,
  createSemanticRuntime,
  encodeText,
  normalizePhase,
  normalizeSemanticText,
};
