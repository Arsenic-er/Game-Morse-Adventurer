import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  OPERATOR_CALIBRATION_SIGNALS,
  evaluateOperatorCalibration,
} from "../src/qso/operatorCalibration.js";
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
  for (const signal of OPERATOR_CALIBRATION_SIGNALS) {
    semanticResults[signal.id] = semanticResultFromProvider(await runtime.interpret({
      message: signal.message,
      phase: "PLAYER_CQ",
      selfCallsign: "BH1ABC",
      peerCallsign: "SIMCAL",
      pendingQuestion: "NONE",
    }));
  }
  provider = "onnxruntime-node";
}

const report = evaluateOperatorCalibration({ semanticResults });
console.table(report.results.map((result) => ({
  signal: result.signalId,
  profile: result.profileId,
  score: result.copyScore,
  threshold: result.copyThreshold,
  outcome: result.outcome,
  reply: result.replyMessage ?? "(silence)",
})));
console.log(JSON.stringify({
  provider,
  operators: new Set(report.results.map(({ profileId }) => profileId)).size,
  signals: OPERATOR_CALIBRATION_SIGNALS.length,
  cases: report.results.length,
  issues: report.issues,
  releaseReady: report.releaseReady,
}, null, 2));
if (!report.releaseReady) process.exitCode = 1;
