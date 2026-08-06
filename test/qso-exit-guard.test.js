import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createQso, QSO_PHASES, submitPlayerMessage } from "../src/qso/qsoEngine.js";
import { QSO_EXIT_RISKS, qsoExitRisk } from "../src/qso/qsoExitGuard.js";

const require = createRequire(import.meta.url);
const { QSO_EXIT_DIALOG_TEXT, qsoExitDialogOptions } = require("../electron/qso-exit-dialog.cjs");
const npc = { callsign: "SIM7QX", regionId: "NA-SIM", finalLevel: 3, wpm: 18 };

test("a pristine watch can leave without an unnecessary warning", () => {
  const qso = createQso({ npc });
  assert.equal(qsoExitRisk(qso), QSO_EXIT_RISKS.NONE);
  assert.equal(qsoExitRisk(qso, { saved: false, pulseCount: 0, isKeying: false }), QSO_EXIT_RISKS.NONE);
});
test("draft keying and prior calling activity protect PLAYER_CQ", () => {
  const pristine = createQso({ npc });
  assert.equal(qsoExitRisk(pristine, { pulseCount: 1 }), QSO_EXIT_RISKS.ACTIVE);
  assert.equal(qsoExitRisk(pristine, { isKeying: true }), QSO_EXIT_RISKS.ACTIVE);
  assert.equal(qsoExitRisk({ ...pristine, attemptHistory: [{ result: "rejected" }] }), QSO_EXIT_RISKS.ACTIVE);
  assert.equal(qsoExitRisk({ ...pristine, unansweredCalls: 1 }), QSO_EXIT_RISKS.ACTIVE);
});

test("every live on-air phase is protected", () => {
  for (const phase of [
    QSO_PHASES.WAITING_RESPONSE,
    QSO_PHASES.NPC_REPLY,
    QSO_PHASES.PLAYER_RST_AND_73,
    QSO_PHASES.NPC_OPTIONAL_QUERY,
    QSO_PHASES.PLAYER_OPTIONAL_ANSWER,
    QSO_PHASES.NPC_73_AND_SK,
  ]) {
    assert.equal(qsoExitRisk({ ...createQso({ npc }), phase }), QSO_EXIT_RISKS.ACTIVE, phase);
  }
  const waiting = submitPlayerMessage(createQso({ npc }), "CQ CQ DE SIM-K7QX K");
  assert.equal(qsoExitRisk(waiting), QSO_EXIT_RISKS.ACTIVE);
});

test("a completed QSO remains protected until it is saved", () => {
  const complete = { ...createQso({ npc }), phase: QSO_PHASES.QSO_COMPLETE };
  assert.equal(qsoExitRisk(complete), QSO_EXIT_RISKS.UNSAVED);
  assert.equal(qsoExitRisk(complete, { saved: true }), QSO_EXIT_RISKS.NONE);
  assert.equal(qsoExitRisk({ ...complete, phase: QSO_PHASES.QSO_FAILED }), QSO_EXIT_RISKS.NONE);
});

test("missing and malformed state fail without silently blessing an unknown live phase", () => {
  assert.equal(qsoExitRisk(null), QSO_EXIT_RISKS.NONE);
  assert.equal(qsoExitRisk(undefined), QSO_EXIT_RISKS.NONE);
  assert.equal(qsoExitRisk({ phase: "FUTURE_LIVE_PHASE" }), QSO_EXIT_RISKS.ACTIVE);
  assert.equal(qsoExitRisk({}), QSO_EXIT_RISKS.ACTIVE);
});

test("native unload warning is localized in all seven interface languages", () => {
  const languages = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"];
  assert.deepEqual(Object.keys(QSO_EXIT_DIALOG_TEXT), languages);
  for (const language of languages) {
    const active = qsoExitDialogOptions({ risk: "active", language });
    const unsaved = qsoExitDialogOptions({ risk: "unsaved", language });
    assert.equal(active.buttons.length, 2);
    assert.ok(active.title.trim() && active.detail.trim());
    assert.ok(unsaved.detail.trim());
    assert.notEqual(active.detail, unsaved.detail);
    assert.equal(active.defaultId, 0);
    assert.equal(active.cancelId, 0);
  }
  assert.deepEqual(qsoExitDialogOptions({ risk: "active", language: "xx" }), qsoExitDialogOptions({ risk: "active", language: "en" }));
});
