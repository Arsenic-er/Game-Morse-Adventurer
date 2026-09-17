import assert from "node:assert/strict";
import test from "node:test";
import { acceptMission, abandonMission, claimMission, missionBoard } from "../src/game/missionSystem.js";
import { advanceChapterOnePresentation, chapterOneStoryModel, normalizeChapterOnePresentation } from "../src/game/chapterOneStory.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";
import { chapterForScreen } from "../src/media/chapterMediaCatalog.js";
import { isWorldCalendarGameplayActive } from "../src/game/worldCalendarHeartbeat.js";

const ACCEPTED = "2026-09-13T10:00:00.000Z";
const COMPLETED = "2026-09-13T10:05:00.000Z";
function accepted() { return acceptMission(createSave({ callsign: "BH1TEST" }), "story-01", ACCEPTED).save; }
function log(overrides = {}) {
  return { id: "chapter-one-real-qso", playerCallsign: "BH1TEST", callsign: "SIM3RA",
    startedAt: "2026-09-13T10:02:00.000Z", completedAt: COMPLETED, sent: "579", received: "559",
    location: "CN-E", distanceKm: 1500, frequencyMhz: 21.06, mode: "CW", finalPropagationLevel: 3,
    equipmentId: "squid-01", antennaId: "dipole", accessoryId: "none", wpm: 18,
    operatorProfileId: "patient-mentor", copyOutcome: "copied", transmitAccuracy: 95, keyingScore: 90, ...overrides };
}
function completed(save = accepted(), overrides = {}) { return recordCompletedQso(save, log(overrides)).save; }

test("old saves receive only an empty presentation bookmark and no new rewards", () => {
  const original = createSave({ callsign: "BH1TEST" });
  delete original.chapterOnePresentation;
  const migrated = normalizeSave(original);
  assert.deepEqual(migrated.chapterOnePresentation, normalizeChapterOnePresentation(null));
  assert.equal(migrated.money, original.money);
  assert.deepEqual(migrated.missionState, original.missionState);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(migrated))), migrated);
  assert.equal(chapterOneStoryModel(migrated).step, 0);
});

test("presentation bookmarks reject inherited properties, accessors and invalid steps", () => {
  const inherited = Object.create({ acceptedAt: ACCEPTED, beat: "log", qsoId: "forged" });
  assert.deepEqual(normalizeChapterOnePresentation(inherited), normalizeChapterOnePresentation(null));
  const hostile = { get acceptedAt() { throw new Error("must not execute"); } };
  assert.deepEqual(normalizeChapterOnePresentation(hostile), normalizeChapterOnePresentation(null));
  assert.equal(normalizeChapterOnePresentation({ acceptedAt: ACCEPTED, beat: "fake" }).beat, "silence");
});

test("opening advances only after acceptance and cannot skip into a fabricated response", () => {
  const fresh = createSave({ callsign: "BH1TEST" });
  assert.equal(advanceChapterOnePresentation(fresh, "operator").updated, false);
  let save = accepted();
  for (const beat of ["call", "answer", "log"]) assert.equal(advanceChapterOnePresentation(save, beat).updated, false);
  save = advanceChapterOnePresentation(save, "operator").save;
  save = advanceChapterOnePresentation(save, "call").save;
  assert.equal(chapterOneStoryModel(normalizeSave(JSON.parse(JSON.stringify(save)))).step, 2);
  assert.strictEqual(advanceChapterOnePresentation(save, "call").save, save);
  assert.equal(advanceChapterOnePresentation(save, "answer").updated, false);
  assert.equal(save.money, 0);
});

test("abandon and reaccept reset the opening bookmark and reject the old completion", () => {
  let save = advanceChapterOnePresentation(accepted(), "operator").save;
  save = advanceChapterOnePresentation(save, "call").save;
  save = completed(save);
  save = abandonMission(save, "story-01").save;
  save = acceptMission(save, "story-01", "2026-09-13T11:00:00.000Z").save;
  const model = chapterOneStoryModel(save);
  assert.equal(model.step, 0);
  assert.equal(model.candidate, null);
});

test("closing requires a matching ordinary saved QSO, settlement id and mission event", () => {
  const good = completed();
  assert.equal(chapterOneStoryModel(good).candidate?.id, log().id);
  assert.equal(chapterOneStoryModel(good).step, 3);
  const variants = [
    { ...good, qsoLogs: [] },
    { ...good, qsoRecords: { ...good.qsoRecords, settledQsoIds: [] } },
    { ...good, missionState: { ...good.missionState, events: [] } },
    { ...good, qsoLogs: [{ ...good.qsoLogs[0], eventId: "chapter-five" }] },
    { ...good, qsoLogs: [{ ...good.qsoLogs[0], completedAt: "2026-09-13T09:00:00.000Z" }] },
    { ...good, qsoLogs: [{ ...good.qsoLogs[0], callsign: "SIM6JP" }] },
    { ...good, qsoLogs: [{ ...good.qsoLogs[0], received: "" }] },
    { ...good, qsoLogs: [{ ...good.qsoLogs[0], sent: { toString() { throw new Error("must not coerce RST"); } } }] },
  ];
  for (const variant of variants) {
    assert.equal(chapterOneStoryModel(variant).candidate, null);
    assert.equal(advanceChapterOnePresentation(variant, "log").updated, false);
  }
});

test("the actual callsign and RST survive reload; presentation cannot pay or duplicate a claim", () => {
  let save = completed();
  const qsoMoney = save.money;
  save = advanceChapterOnePresentation(save, "log").save;
  assert.equal(save.money, qsoMoney);
  assert.equal(save.chapterOnePresentation.qsoId, log().id);
  const claimed = claimMission(save, "story-01", "2026-09-13T10:06:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.moneyAwarded, 150);
  const reloaded = normalizeSave(JSON.parse(JSON.stringify(claimed.save)));
  const model = chapterOneStoryModel(reloaded);
  assert.equal(model.status, "claimed");
  assert.equal(model.step, 4);
  assert.equal(model.candidate.callsign, "SIM3RA");
  assert.equal(model.candidate.sent, "579");
  assert.equal(model.candidate.received, "559");
  assert.equal(missionBoard(reloaded).story[1].status, "available");
  assert.strictEqual(claimMission(reloaded, "story-01").save, reloaded);
  assert.strictEqual(advanceChapterOnePresentation(reloaded, "log").save, reloaded);
  assert.equal(reloaded.money, qsoMoney + 150);
});

test("new story screen uses Chapter One media and the save-backed world calendar", () => {
  assert.equal(chapterForScreen("chapter-one", accepted()), 1);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: "one", screen: "chapter-one" }), true);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: null, screen: "chapter-one" }), false);
});
