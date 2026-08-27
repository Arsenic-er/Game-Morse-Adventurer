import assert from "node:assert/strict";
import test from "node:test";

import { createQslRecord } from "../src/game/qslRecords.js";
import {
  QSL_STORY_PHASES,
  abandonQslStoryRun,
  confirmQslStoryChoice,
  createQslStoryRun,
  emptyQslStoryState,
  normalizeQslStoryRun,
  normalizeQslStoryState,
  receiveQslClarification,
  retryQslStoryRun,
  reviewQslAccounts,
  submitQslClarification,
} from "../src/game/qslStoryRun.js";

const ISO = "2026-08-28T00:00:00.000Z";
const ISO2 = "2026-08-28T00:01:00.000Z";
const ISO3 = "2026-08-28T00:02:00.000Z";
const ISO4 = "2026-08-28T00:03:00.000Z";
const ISO5 = "2026-08-28T00:04:00.000Z";
const safeSemantic = () => Object.freeze({ safeToCommit: true });

function hillQsl(choice = "believe") {
  return createQslRecord({
    id: "qsl-hill-1",
    personId: "person:sora",
    stationId: "station:sim6jp",
    callsign: "SIM6JP",
    qsoId: "expedition-qso:run-1",
    eventRunId: "run-1",
    playerNarrativeKey: "qsl.player.hill-signal",
    operatorNarrativeKey: "qsl.operator.sora-hill-reply",
    createdAt: "2026-08-27T23:00:00.000Z",
    choice,
    confirmedAt: choice ? "2026-08-27T23:01:00.000Z" : null,
  });
}

function reviewedRun() {
  return reviewQslAccounts(createQslStoryRun({
    sourceQsl: hillQsl(),
    playerCallsign: "BH1ABC",
    startedAt: ISO,
  }));
}

function finalChoiceRun() {
  let run = reviewedRun();
  run = submitQslClarification(run, "QSL HILL-1 DE BH1ABC PSE K", safeSemantic(), ISO2);
  run = receiveQslClarification(run, ISO3);
  return run;
}

test("Chapter 7 preserves the source choice and permits a different final stance", () => {
  let run = finalChoiceRun();
  run = confirmQslStoryChoice(run, "request-review", ISO4);

  assert.equal(run.phase, QSL_STORY_PHASES.COMPLETED);
  assert.equal(run.initialChoice, "believe");
  assert.equal(run.finalChoice, "request-review");
  assert.equal(run.sourceQslId, "qsl-hill-1");
  assert.equal(run.personId, "person:sora");
  assert.equal(run.stationId, "station:sim6jp");
  assert.equal(run.callsign, "SIM6JP");
  assert.equal(run.completedAt, ISO4);
  assert.equal(JSON.stringify(run).includes("QSL HILL-1 DE"), false);
});

test("a confirmed SORA hill QSL is required and account review gates the call", () => {
  assert.equal(createQslStoryRun({ sourceQsl: hillQsl(null), playerCallsign: "BH1ABC", startedAt: ISO }), null);
  assert.equal(createQslStoryRun({ sourceQsl: { ...hillQsl(), personId: "person:other" }, playerCallsign: "BH1ABC", startedAt: ISO }), null);
  assert.equal(createQslStoryRun({ sourceQsl: hillQsl(), playerCallsign: "BAD-CALL", startedAt: ISO }), null);

  const run = createQslStoryRun({ sourceQsl: hillQsl(), playerCallsign: "bh1abc", startedAt: ISO });
  assert.equal(run.phase, QSL_STORY_PHASES.CASE_OPEN);
  assert.equal(run.caseId, "HILL-1");
  assert.equal(submitQslClarification(run, "QSL HILL-1 DE BH1ABC PSE K", safeSemantic(), ISO2), run);
  assert.equal(reviewQslAccounts(run).phase, QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL);
});

test("clarification call validates case, callsign, hard fields, and semantic veto", () => {
  const attempts = [
    ["QSL HILL-2 DE BH1ABC PSE K", safeSemantic(), "CASE_MISMATCH"],
    ["QSL HILL-1 DE JA1WRONG PSE K", safeSemantic(), "CALLSIGN_MISMATCH"],
    ["HILL-1 DE BH1ABC PSE K", safeSemantic(), "QSL_REQUIRED"],
  ];
  for (const [decoded, semantic, reason] of attempts) {
    const next = submitQslClarification(reviewedRun(), decoded, semantic, ISO2);
    assert.equal(next.phase, QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL);
    assert.equal(next.errors.at(-1), reason);
  }
  const unsafe = submitQslClarification(
    reviewedRun(), "QSL HILL-1 DE BH1ABC PSE K", { safeToCommit: false }, ISO2,
  );
  assert.equal(unsafe.errors.at(-1), "SEMANTIC_UNSAFE");
});

test("three failed clarification submissions fail closed and retry starts a fresh bounded attempt", () => {
  let run = reviewedRun();
  run = submitQslClarification(run, "BAD", safeSemantic(), ISO2);
  run = submitQslClarification(run, "BAD", safeSemantic(), ISO3);
  run = submitQslClarification(run, "BAD", safeSemantic(), ISO4);

  assert.equal(run.phase, QSL_STORY_PHASES.FAILED);
  assert.equal(run.errors.length, 3);
  assert.equal(run.completedAt, ISO4);

  const retried = retryQslStoryRun(run, ISO5);
  assert.equal(retried.phase, QSL_STORY_PHASES.CASE_OPEN);
  assert.equal(retried.retryCount, 1);
  assert.notEqual(retried.runId, run.runId);
  assert.deepEqual(retried.errors, []);
  assert.equal(retried.sourceQslId, run.sourceQslId);
  assert.equal(retryQslStoryRun(retried, ISO5), retried);
});

test("AGN and QRS replay one frozen clarification without rerolling facts", () => {
  let run = finalChoiceRun();
  const frozenKey = run.replyNarrativeKey;
  const initialWpm = run.replyWpm;

  run = submitQslClarification(run, "AGN K", safeSemantic(), ISO4);
  assert.equal(run.phase, QSL_STORY_PHASES.SORA_CLARIFICATION_REPLY);
  assert.equal(run.replyNarrativeKey, frozenKey);
  assert.equal(run.replyWpm, initialWpm);
  run = receiveQslClarification(run, ISO4);
  run = submitQslClarification(run, "QRS K", safeSemantic(), ISO5);
  assert.equal(run.replyNarrativeKey, frozenKey);
  assert.ok(run.replyWpm < initialWpm);
  assert.deepEqual(run.recoveryActions, ["AGN", "QRS"]);
});

test("final choice and abandon are terminal exact no-ops", () => {
  const completed = confirmQslStoryChoice(finalChoiceRun(), "defer", ISO4);
  assert.equal(confirmQslStoryChoice(completed, "believe", ISO5), completed);
  assert.equal(abandonQslStoryRun(completed, ISO5), completed);

  const abandoned = abandonQslStoryRun(reviewedRun(), ISO2);
  assert.equal(abandoned.phase, QSL_STORY_PHASES.ABANDONED);
  assert.equal(abandoned.completedAt, ISO2);
  assert.equal(abandonQslStoryRun(abandoned, ISO3), abandoned);
});

test("run and chapter state normalization are bounded, own-only, and JSON-idempotent", () => {
  const completed = confirmQslStoryChoice(finalChoiceRun(), "believe", ISO4);
  assert.deepEqual(normalizeQslStoryRun(JSON.parse(JSON.stringify(completed))), completed);

  let getterCalls = 0;
  const errors = [];
  Object.defineProperty(errors, "0", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "QSL_REQUIRED";
    },
  });
  const hostile = { ...completed, errors };
  assert.equal(normalizeQslStoryRun(hostile), null);
  assert.equal(getterCalls, 0);

  const cases = Array.from({ length: 45 }, (_, index) => ({
    id: `qsl-case:${String(index).padStart(3, "0")}`,
    runId: `qsl-story:${String(index).padStart(3, "0")}`,
    sourceQslId: "qsl-hill-1",
    qsoId: `qsl-story-qso:${String(index).padStart(3, "0")}`,
    personId: "person:sora",
    stationId: "station:sim6jp",
    initialChoice: "believe",
    finalChoice: "request-review",
    completedAt: new Date(Date.UTC(2026, 7, 28, 0, index)).toISOString(),
  }));
  const state = normalizeQslStoryState({ cases, settledRunIds: cases.map(({ runId }) => runId) });
  assert.equal(state.cases.length, 40);
  assert.equal(state.settledRunIds.length, 45);
  assert.deepEqual(normalizeQslStoryState(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(emptyQslStoryState(), { activeRun: null, cases: [], settledRunIds: [] });
});

test("normalization rejects forged run identity and impossible phase chronology", () => {
  const completed = confirmQslStoryChoice(finalChoiceRun(), "believe", ISO4);

  assert.equal(normalizeQslStoryRun({ ...completed, runId: "qsl-story:forged" }), null);
  assert.equal(normalizeQslStoryRun({ ...completed, caseId: "OTHER" }), null);
  assert.equal(normalizeQslStoryRun({ ...completed, replyReceivedAt: "2026-08-27T23:59:00.000Z" }), null);
  assert.equal(normalizeQslStoryRun({
    ...completed,
    phase: QSL_STORY_PHASES.FAILED,
    finalChoice: null,
    errors: [],
  }), null);
});
