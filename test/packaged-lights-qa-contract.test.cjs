const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLightsQaPlan } = require("../electron/qa-capture.cjs");

test("packaged lights QA plan names every real gameplay checkpoint", () => {
  const plan = buildLightsQaPlan({ suffix: "1280x720" });

  assert.deepEqual(
    plan.checkpoints.map((checkpoint) => checkpoint.id),
    [
      "story-ready",
      "story-launch",
      "chase-complete",
      "control-entered",
      "escape-paused",
      "escape-resumed",
      "failed-run",
      "retry-control",
      "settled",
      "reloaded-history",
      "duplicate-settlement",
    ],
  );
  assert.deepEqual(
    plan.screenshots,
    [
      "lights-story-launch-1280x720.png",
      "lights-chase-1280x720.png",
      "lights-control-1280x720.png",
      "lights-failed-1280x720.png",
      "lights-result-1280x720.png",
      "lights-reloaded-history-1280x720.png",
    ],
  );
  assert.equal(plan.resultFile, "lights-qa-result.json");
});
