import assert from "node:assert/strict";
import test from "node:test";
import { EXPEDITION_SITES, createExpeditionLoadout } from "../src/game/expeditionCatalog.js";
import {
  advanceExpeditionSetup, attemptExpeditionSetup, beginExpeditionCq,
  createExpeditionRun, receiveExpeditionContact, requestExpeditionRecovery,
  retryExpeditionRun, selectExpeditionSite, submitExpeditionExchange,
} from "../src/game/expeditionRun.js";
import {
  EXPEDITION_TEXT, expeditionLeaveRisk, expeditionUiModel,
} from "../src/screens/expeditionText.js";

const AT = "2026-08-26T03:00:00.000Z";

function freshRun() {
  return createExpeditionRun({
    runId: "ui-expedition-1",
    playerCallsign: "BH1ABC",
    loadout: createExpeditionLoadout({}, { source: "loan" }),
    startedAt: AT,
  });
}

function contactRun(level = 3) {
  let run = selectExpeditionSite(freshRun(), "sunward-hill", AT);
  run = advanceExpeditionSetup(run, "antenna", "2026-08-26T03:00:10.000Z");
  run = advanceExpeditionSetup(run, "power", "2026-08-26T03:00:20.000Z");
  run = beginExpeditionCq(run, {
    observedAt: "2026-08-26T03:00:30.000Z",
    propagationSnapshot: { level, noise: 2, capturedAt: "2026-08-26T03:00:30.000Z" },
  });
  return receiveExpeditionContact(run, {
    callsign: "SIM6JP", npcId: "sora", locationId: "fictional-tokyo",
    distanceKm: 510, remoteWpm: 17, operatorProfileId: "sora-patient",
  }, "2026-08-26T03:00:35.000Z");
}

test("expedition UI model exposes site, honest loadout, setup, battery and propagation phases", () => {
  let run = freshRun();
  let model = expeditionUiModel(run, { language: "en", ownedLoadoutAvailable: false });
  assert.equal(model.phase, "site-selection");
  assert.equal(model.canSelectSite, true);
  assert.equal(model.loadoutSource, "loan");
  assert.equal(model.ownedLoadoutAvailable, false);
  assert.equal(model.battery.percent, 100);

  run = selectExpeditionSite(run, "sunward-hill", AT);
  const beforePenalty = run.power.remainingWh;
  run = attemptExpeditionSetup(run, "antenna", { valid: false, errorCode: "INVALID_WIRING" }, AT);
  model = expeditionUiModel(run, { language: "en" });
  assert.equal(model.phase, "setup");
  assert.equal(model.setupMistakes, 1);
  assert.ok(model.battery.remainingWh < beforePenalty);
  assert.equal(model.failureKey, "failureInvalidWiring");

  run = advanceExpeditionSetup(run, "antenna", AT);
  run = advanceExpeditionSetup(run, "power", AT);
  run = beginExpeditionCq(run, {
    observedAt: AT,
    propagationSnapshot: { level: 4, noise: 1, capturedAt: AT },
  });
  model = expeditionUiModel(run, { language: "en" });
  assert.equal(model.phase, "calling");
  assert.deepEqual(model.propagation, { level: 3, noise: 1 });
  assert.equal(model.onAir, true);
  assert.equal(model.portraitVisible, false);
});

test("expedition UI model guides QTH/PWR/ANT, AGN/QRS recovery, result and retry", () => {
  let run = contactRun(1);
  let model = expeditionUiModel(run, { language: "en" });
  assert.equal(model.exchangeHint, "QTH SUNWARD PWR 5W ANT WIRE");
  assert.deepEqual(model.requiredTopics, ["QTH", "POWER", "ANTENNA"]);

  run = submitExpeditionExchange(run, "QTH WRONG PWR 5W ANT WIRE", { safeToCommit: true }, "2026-08-26T03:00:40.000Z");
  model = expeditionUiModel(run, { language: "en" });
  assert.equal(model.phase, "recovering");
  assert.equal(model.canRequestAgn, true);
  assert.equal(model.canRequestQrs, true);

  run = requestExpeditionRecovery(run, "QRS", "2026-08-26T03:00:45.000Z");
  run = submitExpeditionExchange(run, "PSE QTH SUNWARD PWR 5W ANT WIRE K", { safeToCommit: true }, "2026-08-26T03:00:50.000Z");
  model = expeditionUiModel(run, { language: "en" });
  assert.equal(model.phase, "completed");
  assert.equal(model.result, "success");
  assert.equal(model.canSettle, true);

  let failed = selectExpeditionSite(freshRun(), "sunward-hill", AT);
  failed = attemptExpeditionSetup(failed, "antenna", { valid: false }, AT);
  failed = attemptExpeditionSetup(failed, "antenna", { valid: false }, AT);
  failed = attemptExpeditionSetup(failed, "antenna", { valid: false }, AT);
  assert.equal(expeditionUiModel(failed, { language: "en" }).canRetry, true);
  const retried = retryExpeditionRun(failed, { runId: "ui-expedition-retry", startedAt: AT });
  assert.equal(expeditionUiModel(retried, { language: "en" }).phase, "setup");
});

test("Esc pause and leave guards distinguish active, unsettled and safe expedition states", () => {
  const active = selectExpeditionSite(freshRun(), "sunward-hill", AT);
  assert.equal(expeditionUiModel(active, { language: "en", paused: true }).paused, true);
  assert.equal(expeditionLeaveRisk(active), "active");
  const completed = submitExpeditionExchange(contactRun(3), "SUNWARD 5W WIRE", { safeToCommit: true }, "2026-08-26T03:00:50.000Z");
  assert.equal(expeditionLeaveRisk(completed), "unsaved");
  assert.equal(expeditionLeaveRisk({ ...completed, settlementStatus: "settled" }), "none");
});

test("expedition copy is complete and non-empty in all seven languages", () => {
  const languages = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"];
  assert.deepEqual(Object.keys(EXPEDITION_TEXT), languages);
  const keys = Object.keys(EXPEDITION_TEXT.en);
  for (const language of languages) {
    assert.deepEqual(Object.keys(EXPEDITION_TEXT[language]), keys);
    for (const key of keys) assert.ok(EXPEDITION_TEXT[language][key].trim(), `${language}.${key}`);
    for (const site of EXPEDITION_SITES) assert.ok(EXPEDITION_TEXT[language][site.nameKey].trim());
    assert.notEqual(EXPEDITION_TEXT[language].ready.toLowerCase(), "ready");
  }
});
