import assert from "node:assert/strict";
import test from "node:test";

import {
  CALIBRATION_OPERATORS,
  OPERATOR_CALIBRATION_SCHEMA_VERSION,
  OPERATOR_CALIBRATION_SIGNALS,
  evaluateOperatorCalibration,
} from "../src/qso/operatorCalibration.js";

test("seven operator archetypes pass the fixed reception calibration matrix", () => {
  const report = evaluateOperatorCalibration();
  assert.equal(OPERATOR_CALIBRATION_SCHEMA_VERSION, 1);
  assert.equal(CALIBRATION_OPERATORS.length, 7);
  assert.equal(OPERATOR_CALIBRATION_SIGNALS.length, 5);
  assert.equal(report.results.length, 35);
  assert.deepEqual(report.issues, []);
  assert.equal(report.releaseReady, true);
});

test("calibration records expose scores and personality thresholds separately", () => {
  const report = evaluateOperatorCalibration();
  for (const result of report.results) {
    assert.ok(result.copyScore >= 0 && result.copyScore <= 100);
    assert.ok(result.queryThreshold < result.copyThreshold);
    assert.ok(result.receptionTolerance >= 0 && result.receptionTolerance <= 100);
    assert.equal(result.schemaVersion, OPERATOR_CALIBRATION_SCHEMA_VERSION);
  }
  const weak = report.results.filter(({ signalId }) => signalId === "weak-path");
  const beginner = weak.find(({ profileId }) => profileId === "careful-beginner");
  const specialist = weak.find(({ profileId }) => profileId === "weak-signal-listener");
  assert.equal(beginner.outcome, "query");
  assert.equal(specialist.outcome, "copied");
  assert.ok(specialist.copyScore > beginner.copyScore);
  assert.ok(specialist.copyThreshold < beginner.copyThreshold);
});
