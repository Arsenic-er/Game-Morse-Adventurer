import { assessCqTransmission } from "./cqAssessment.js";
import { channelReceptionForNpc, resolveRemoteCopy, resolveRemoteReportCopy } from "./operatorProfiles.js";
import { interpretCwTraffic } from "./semanticInterpreter.js";
import { observePlayerSignal } from "./signalObservation.js";

export const COMMUNICATION_SCENARIO_SCHEMA_VERSION = 1;

function scenario(candidate) {
  return Object.freeze({
    ...candidate,
    npc: Object.freeze({ ...candidate.npc }),
    expected: Object.freeze({ ...candidate.expected }),
    expectedModel: Object.freeze({ ...(candidate.expectedModel ?? candidate.expected) }),
  });
}

const CLEAN_CQ = "CQ CQ DE BH1ABC BH1ABC PSE K";
const CLEAN_REPORT = "SIM7QX DE BH1ABC RST 559 73 K";

export const COMMUNICATION_SCENARIOS = Object.freeze([
  scenario({
    id: "clear-reference", category: "REFERENCE", stage: "CQ", responder: true,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM3RA", finalLevel: 4 },
    wpm: 17, accuracy: 100, rhythm: 95, seed: "clear", expected: { outcome: "copied", disposition: "copy" },
  }),
  scenario({
    id: "no-propagation-path", category: "NO_PATH", stage: "CQ", responder: false,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM3RA", finalLevel: 0 },
    wpm: 17, accuracy: 100, rhythm: 95, seed: "no-path", expected: { outcome: "no-response", disposition: "silence" },
  }),
  scenario({
    id: "deep-fade-beginner", category: "WEAK_CHANNEL", stage: "CQ", responder: true,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 1 },
    wpm: 18, accuracy: 100, rhythm: 85, seed: "deep-fade-beginner", expected: { outcome: "query", disposition: "query", reply: "AGN AGN? K" },
  }),
  scenario({
    id: "weak-signal-specialist", category: "OPERATOR_SKILL", stage: "CQ", responder: true,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM2DX", finalLevel: 1 },
    wpm: 16, accuracy: 100, rhythm: 90, seed: "weak-expert-0", expected: { outcome: "copied", disposition: "copy" },
  }),
  scenario({
    id: "deep-fade-specialist", category: "DEEP_FADE", stage: "CQ", responder: true,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM2DX", finalLevel: 1 },
    wpm: 16, accuracy: 100, rhythm: 90, seed: "deep-fade-expert", expected: { outcome: "query", disposition: "query", reply: "AGN? K" },
  }),
  scenario({
    id: "deep-fade-specialist-retry", category: "RECOVERY", stage: "CQ", responder: true,
    message: CLEAN_CQ, playerCallsign: "BH1ABC", npc: { callsign: "SIM2DX", finalLevel: 1 },
    wpm: 16, accuracy: 100, rhythm: 90, seed: "deep-fade-expert", queryCount: 2, expected: { outcome: "copied", disposition: "copy" },
  }),
  scenario({
    id: "too-fast-for-beginner", category: "SPEED_MISMATCH", stage: "CQ", responder: true,
    message: "CQ CQ DE BH1ABC K", playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 4 },
    wpm: 40, accuracy: 100, rhythm: 90, seed: "fast", expected: { outcome: "query", disposition: "query", reply: "QRS PSE K" },
  }),
  scenario({
    id: "speed-recovered", category: "RECOVERY", stage: "CQ", responder: true,
    message: "CQ CQ DE BH1ABC K", playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 4 },
    wpm: 12, accuracy: 100, rhythm: 90, seed: "fast", expected: { outcome: "copied", disposition: "copy" },
  }),
  scenario({
    id: "callsign-uncertain", category: "CALLSIGN_DAMAGE", stage: "CQ", responder: true,
    message: "CQ CQ DE BH1ABX K", playerCallsign: "BH1ABC", npc: { callsign: "SIM2DX", finalLevel: 3 },
    wpm: 16, accuracy: 88, rhythm: 90, seed: "call", expected: { outcome: "query", disposition: "query", reply: "QRZ? K" },
  }),
  scenario({
    id: "garbled-active-station", category: "SEMANTIC_DAMAGE", stage: "CQ", responder: true,
    message: "CQ T T K", playerCallsign: "BH1ABC", npc: { callsign: "SIM6JP", finalLevel: 2 },
    wpm: 18, accuracy: 30, rhythm: 70, seed: "demo", expected: { outcome: "unreadable", disposition: "general", reply: "CQ CQ DE SIM6JP SIM6JP K" },
    expectedModel: { outcome: "query", disposition: "query", reply: "UR CALL? K" },
  }),
  scenario({
    id: "garbled-weak-contest-station", category: "COMPOUND_CQ_FAILURE", stage: "CQ", responder: true,
    message: "CQ T T K", playerCallsign: "BH1ABC", npc: { callsign: "SIM9AK", finalLevel: 1 },
    wpm: 28, accuracy: 25, rhythm: 60, seed: "weak-garbled", expected: { outcome: "unreadable", disposition: "silence" },
    expectedModel: { outcome: "query", disposition: "query", reply: "?" },
  }),
  scenario({
    id: "pure-noise-active-station", category: "NOISE_ONLY", stage: "CQ", responder: true,
    message: "T T T T", playerCallsign: "BH1ABC", npc: { callsign: "SIM6JP", finalLevel: 2 },
    wpm: 18, accuracy: 0, rhythm: 70, seed: "noise-0", expected: { outcome: "unreadable", disposition: "silence" },
    expectedModel: { outcome: "unreadable", disposition: "general", reply: "CQ CQ DE SIM6JP SIM6JP K" },
  }),
  scenario({
    id: "noisy-report", category: "REPORT_ERRORS", stage: "REPORT", responder: true,
    message: CLEAN_REPORT, playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 2 },
    wpm: 18, accuracy: 45, rhythm: 60, seed: "report-noisy", expected: { outcome: "query", disposition: "report-query", reply: "AGN? K" },
  }),
  scenario({
    id: "compound-report-failure", category: "COMPOUND_REPORT_FAILURE", stage: "REPORT", responder: true,
    message: CLEAN_REPORT, playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 1 },
    wpm: 35, accuracy: 20, rhythm: 35, seed: "compound", expected: { outcome: "unreadable", disposition: "unreadable" },
  }),
  scenario({
    id: "report-recovered", category: "RECOVERY", stage: "REPORT", responder: true,
    message: CLEAN_REPORT, playerCallsign: "BH1ABC", npc: { callsign: "SIM7QX", finalLevel: 1 },
    wpm: 12, accuracy: 100, rhythm: 95, seed: "compound", expected: { outcome: "copied", disposition: "copied" },
  }),
]);

function summarize(scenarioSpec, decision) {
  return Object.freeze({
    schemaVersion: COMMUNICATION_SCENARIO_SCHEMA_VERSION,
    id: scenarioSpec.id,
    category: scenarioSpec.category,
    stage: scenarioSpec.stage,
    npcCallsign: scenarioSpec.npc.callsign,
    channelLevel: decision.channelLevel ?? scenarioSpec.npc.finalLevel,
    channelQuality: decision.channelQuality ?? 0,
    channelFadePenalty: decision.channelFadePenalty ?? 0,
    outcome: decision.outcome,
    disposition: decision.disposition,
    copyScore: decision.copyScore ?? null,
    replyMessage: decision.replyMessage ?? null,
    reasonCodes: Object.freeze([...(decision.reasonCodes ?? [])]),
    expected: scenarioSpec.expected,
    expectedModel: scenarioSpec.expectedModel,
  });
}

export function simulateCommunicationScenario(scenarioSpec, { semanticResult = null } = {}) {
  if (!scenarioSpec?.responder) {
    const channel = channelReceptionForNpc(scenarioSpec?.npc, scenarioSpec?.seed, "cq");
    return summarize(scenarioSpec, {
      channelLevel: channel.level,
      channelQuality: channel.quality,
      channelFadePenalty: channel.fadePenalty,
      outcome: "no-response",
      disposition: "silence",
      reasonCodes: ["noPropagationPath"],
    });
  }

  const phase = scenarioSpec.stage === "REPORT" ? "EXCHANGE" : "CALLING";
  const semantics = semanticResult ?? interpretCwTraffic({
    message: scenarioSpec.message,
    phase,
    selfCallsign: scenarioSpec.playerCallsign,
    peerCallsign: scenarioSpec.npc.callsign,
    wpm: scenarioSpec.wpm,
  });
  const observation = observePlayerSignal({
    message: scenarioSpec.message,
    wpm: scenarioSpec.wpm,
    accuracy: scenarioSpec.accuracy,
    rhythm: scenarioSpec.rhythm,
    semanticResult: semantics,
  });

  if (scenarioSpec.stage === "REPORT") {
    return summarize(scenarioSpec, resolveRemoteReportCopy({
      npc: scenarioSpec.npc,
      wpm: scenarioSpec.wpm,
      accuracy: scenarioSpec.accuracy,
      rhythm: scenarioSpec.rhythm,
      semanticResult: semantics,
      signalObservation: observation,
      seed: scenarioSpec.seed,
      queryCount: scenarioSpec.queryCount ?? 0,
    }));
  }

  const assessment = assessCqTransmission({
    message: scenarioSpec.message,
    playerCallsign: scenarioSpec.playerCallsign,
    wpm: scenarioSpec.wpm,
    rhythm: scenarioSpec.rhythm,
  });
  return summarize(scenarioSpec, resolveRemoteCopy({
    assessment,
    semanticResult: semantics,
    signalObservation: observation,
    npc: scenarioSpec.npc,
    playerCallsign: scenarioSpec.playerCallsign,
    seed: scenarioSpec.seed,
    queryCount: scenarioSpec.queryCount ?? 0,
  }));
}

export function communicationScenarioMatchesExpected(result, provider = "rules-v1") {
  const expected = provider === "onnxruntime-node"
    ? (result?.expectedModel ?? result?.expected ?? {}) : (result?.expected ?? {});
  return result?.outcome === expected.outcome
    && result?.disposition === expected.disposition
    && (expected.reply === undefined || result?.replyMessage === expected.reply);
}

export function simulateCommunicationScenarioMatrix(options = {}) {
  return COMMUNICATION_SCENARIOS.map((scenarioSpec) => simulateCommunicationScenario(
    scenarioSpec,
    { semanticResult: options.semanticResults?.[scenarioSpec.id] ?? null },
  ));
}
