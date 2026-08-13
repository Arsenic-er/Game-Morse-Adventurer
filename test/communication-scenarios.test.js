import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNICATION_SCENARIO_SCHEMA_VERSION,
  COMMUNICATION_SCENARIOS,
  communicationScenarioMatchesExpected,
  simulateCommunicationScenario,
  simulateCommunicationScenarioMatrix,
} from "../src/qso/communicationScenarios.js";

test("poor communication matrix covers distinct failure and recovery categories", () => {
  assert.equal(COMMUNICATION_SCENARIO_SCHEMA_VERSION, 1);
  assert.equal(COMMUNICATION_SCENARIOS.length, 15);
  const categories = new Set(COMMUNICATION_SCENARIOS.map(({ category }) => category));
  for (const category of [
    "NO_PATH", "WEAK_CHANNEL", "DEEP_FADE", "SPEED_MISMATCH", "CALLSIGN_DAMAGE",
    "SEMANTIC_DAMAGE", "NOISE_ONLY", "COMPOUND_CQ_FAILURE", "REPORT_ERRORS", "COMPOUND_REPORT_FAILURE", "RECOVERY",
  ]) assert.ok(categories.has(category), category);
});

test("every deterministic poor communication scenario reaches its declared verdict", () => {
  const results = simulateCommunicationScenarioMatrix();
  assert.equal(results.length, COMMUNICATION_SCENARIOS.length);
  for (const result of results) {
    assert.equal(communicationScenarioMatchesExpected(result), true, JSON.stringify(result));
    assert.equal(result.schemaVersion, COMMUNICATION_SCENARIO_SCHEMA_VERSION);
    assert.ok(result.channelLevel >= 0 && result.channelLevel <= 4);
    assert.ok(result.channelFadePenalty >= 0);
  }
});

test("the same P1 path separates beginner, weak-signal specialist and deep fade", () => {
  const resultById = Object.fromEntries(simulateCommunicationScenarioMatrix().map((result) => [result.id, result]));
  assert.equal(resultById["deep-fade-beginner"].outcome, "query");
  assert.equal(resultById["weak-signal-specialist"].outcome, "copied");
  assert.equal(resultById["deep-fade-specialist"].outcome, "query");
  assert.equal(resultById["deep-fade-specialist-retry"].outcome, "copied");
  assert.ok(resultById["deep-fade-specialist-retry"].channelFadePenalty < resultById["deep-fade-specialist"].channelFadePenalty);
  assert.ok(resultById["deep-fade-specialist"].channelFadePenalty > resultById["weak-signal-specialist"].channelFadePenalty);
});

test("slowing down and retransmitting cleanly can recover without changing the path", () => {
  const byId = Object.fromEntries(COMMUNICATION_SCENARIOS.map((scenario) => [scenario.id, scenario]));
  const fast = simulateCommunicationScenario(byId["too-fast-for-beginner"]);
  const slowed = simulateCommunicationScenario(byId["speed-recovered"]);
  assert.equal(fast.replyMessage, "QRS PSE K");
  assert.equal(slowed.outcome, "copied");

  const damaged = simulateCommunicationScenario(byId["compound-report-failure"]);
  const recovered = simulateCommunicationScenario(byId["report-recovered"]);
  assert.equal(damaged.channelLevel, recovered.channelLevel);
  assert.equal(damaged.channelFadePenalty, recovered.channelFadePenalty);
  assert.equal(damaged.outcome, "unreadable");
  assert.equal(recovered.outcome, "copied");
});
