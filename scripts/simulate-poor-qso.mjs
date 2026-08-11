import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_SCENARIOS,
  communicationScenarioMatchesExpected,
  simulateCommunicationScenarioMatrix,
} from "../src/qso/communicationScenarios.js";
import { semanticResultFromProvider } from "../src/qso/semanticInterpreter.js";

const require = createRequire(import.meta.url);
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDirectory = path.join(projectDirectory, "runtime-models");
const modelPath = path.join(assetDirectory, "qso-semanticformer-v0.4.int8.onnx");
const semanticResults = {};
let provider = "rules-v1";

if (existsSync(modelPath)) {
  const { createSemanticRuntime } = require("../electron/semantic-runtime.cjs");
  const runtime = createSemanticRuntime({ assetDirectory });
  for (const scenario of COMMUNICATION_SCENARIOS) {
    if (!scenario.responder) continue;
    const candidate = await runtime.interpret({
      message: scenario.message,
      phase: scenario.stage === "REPORT" ? "PLAYER_RST_AND_73" : "PLAYER_CQ",
      selfCallsign: scenario.playerCallsign,
      peerCallsign: scenario.npc.callsign,
      pendingQuestion: "NONE",
      knownSlots: scenario.stage === "REPORT" ? ["CALLSIGN"] : [],
    });
    semanticResults[scenario.id] = semanticResultFromProvider(candidate);
  }
  provider = "onnxruntime-node";
}

const results = simulateCommunicationScenarioMatrix({ semanticResults });
const failures = results.filter((result) => !communicationScenarioMatchesExpected(result, provider));
const report = {
  schemaVersion: 1,
  provider,
  passed: results.length - failures.length,
  total: results.length,
  releaseReady: failures.length === 0,
  results,
  failures: failures.map(({ id, outcome, disposition, replyMessage, expected, expectedModel }) => ({
    id, outcome, disposition, replyMessage, expected: provider === "onnxruntime-node" ? expectedModel : expected,
  })),
};

console.table(results.map((result) => ({
  id: result.id,
  level: result.channelLevel,
  fade: result.channelFadePenalty,
  score: result.copyScore ?? "-",
  outcome: result.outcome,
  reply: result.replyMessage ?? "(silence)",
  reasons: result.reasonCodes.join(","),
})));
console.log(JSON.stringify({
  provider: report.provider,
  passed: report.passed,
  total: report.total,
  releaseReady: report.releaseReady,
}, null, 2));

if (process.env.CWGAME_SCENARIO_OUTPUT) {
  await writeFile(path.resolve(process.env.CWGAME_SCENARIO_OUTPUT), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (!report.releaseReady) process.exitCode = 1;
