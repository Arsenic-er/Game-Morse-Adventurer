const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const {
  buildQaSegmentPlan,
  QA_SUPPORTED_SCOPES,
  validateFinalPromiseQaEvidence,
  validateFirstPageQaEvidence,
  validateListeningQaEvidence,
  validateNightOperationsQaEvidence,
  validateStormRelayQaEvidence,
} = require("../electron/qa-capture.cjs");

const QA_RUN_ID = "123e4567-e89b-42d3-a456-426614174000";

test("final chapter packaged plan adds five exact chained scopes and reaches 197 images", () => {
  assert.deepEqual(QA_SUPPORTED_SCOPES.slice(-5), [
    "listening", "storm-relay", "night-operations", "final-promise", "first-page",
  ]);
  const plan = buildQaSegmentPlan({ suffix: "1439x912" });
  const finalScopes = plan.segments.filter(({ scope }) => QA_SUPPORTED_SCOPES.slice(-5).includes(scope));
  assert.deepEqual(finalScopes.map(({ scope, predecessor, screenshots }) => [scope, predecessor, screenshots.length]), [
    ["listening", "contest", 11],
    ["storm-relay", "listening", 12],
    ["night-operations", "storm-relay", 12],
    ["final-promise", "night-operations", 11],
    ["first-page", "final-promise", 9],
  ]);
  const all = plan.segments.flatMap(({ screenshots }) => screenshots);
  assert.equal(all.length, 197);
  assert.equal(new Set(all).size, 197);
});

test("final chapter validators require literal linked gameplay facts and the common QA run id", () => {
  const common = {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
    settled: true,
    missionClaimed: true,
    reloadPersisted: true,
    duplicateSettlementExecuted: true,
    duplicateSettlementNoOp: true,
    focusPauseVerified: true,
    replayRewardNoOp: true,
    rawPlayerTextPersisted: false,
  };
  const fixtures = [
    [validateListeningQaEvidence, { ...common, activity: "listening", observationCount: 3, callCount: 1, eventQsoCount: 0, conclusionKey: "chapter11.conclusion.no-reply-after-listening" }],
    [validateStormRelayQaEvidence, { ...common, activity: "storm-relay", canonicalRevision: 2, eventQsoCount: 2, relationshipCount: 2, failureRecoveryVerified: true }],
    [validateNightOperationsQaEvidence, { ...common, activity: "night-operations", contactCount: 3, eventQsoCount: 3, relationshipCount: 3, distinctPersonCount: 3 }],
    [validateFinalPromiseQaEvidence, { ...common, activity: "final-promise", recipientPersonId: "person:chapter14:final-recipient", tone: "steady", eventQsoCount: 1, relationshipCount: 1, qslLinked: true, accountRepeatVerified: true }],
    [validateFirstPageQaEvidence, { ...common, activity: "first-page", ordinaryQsoIncrease: 1, countedQsoCreditsPositive: true, countedQsoPostAcceptance: true, countedQsoEventFree: true, firstGoal: "world-log", openStationUnlocked: true, activeGoalUpdatedAfterReload: true }],
  ];
  for (const [validate, evidence] of fixtures) {
    assert.deepEqual(validate(evidence, { qaRunId: QA_RUN_ID }), evidence);
    assert.throws(() => validate({ ...evidence, qaRunId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }, { qaRunId: QA_RUN_ID }), /run id/i);
    assert.throws(() => validate({ ...evidence, replayRewardNoOp: false }, { qaRunId: QA_RUN_ID }), /evidence/i);
    assert.throws(() => validate({ ...evidence, rawPlayerTextPersisted: true }, { qaRunId: QA_RUN_ID }), /evidence/i);
  }
});

test("final chapter packaged scopes use the physical CW helper and emit literal result files", async () => {
  const qaSource = await fs.readFile(path.join(__dirname, "../electron/qa-capture.cjs"), "utf8");
  const supervisorSource = await fs.readFile(path.join(__dirname, "../scripts/run-packaged-qa.cjs"), "utf8");
  for (const scope of ["Listening", "StormRelay", "NightOperations", "FinalPromise", "FirstPage"]) {
    assert.match(qaSource, new RegExp(`run${scope}QaScope`));
  }
  assert.match(qaSource, /sendAutomaticStructuredText/);
  for (const filename of [
    "listening-qa-result.json", "storm-relay-qa-result.json", "night-operations-qa-result.json",
    "final-promise-qa-result.json", "first-page-qa-result.json",
  ]) {
    assert.match(qaSource, new RegExp(filename.replaceAll(".", "\\.")));
    assert.match(supervisorSource, new RegExp(filename.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(qaSource, /set(?:Listening|Storm|Night|FinalPromise|FirstPage).*decoded/i);
});
