import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { bootstrapChapterOneLocalReview } from "../src/game/chapterOneLocalReview.js";
import { advanceChapterOnePresentation } from "../src/game/chapterOneStory.js";
import { persistSaves, loadSaves } from "../src/game/saveStore.js";
import { LANGUAGE_STORAGE_KEY } from "../src/i18n/languageRegistry.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test("local review creates only a first-chapter save and resumes without awarding value", () => {
  const storage = memoryStorage();
  const first = bootstrapChapterOneLocalReview(storage);
  assert.equal(first.screen, "chapter-one");
  assert.equal(first.saves.length, 1);
  assert.equal(first.saves[0].callsign, "SIM1OP");
  assert.equal(first.saves[0].keyType, "automatic");
  assert.equal(first.saves[0].money, 0);
  assert.deepEqual(first.saves[0].qsoLogs, []);
  assert.deepEqual(first.saves[0].missionState.activeMissions.map(item => item.id), ["story-01"]);
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), "zh-CN");
  const advanced = advanceChapterOnePresentation(first.saves[0], "operator").save;
  persistSaves([advanced], storage);
  const resumed = bootstrapChapterOneLocalReview(storage);
  assert.equal(resumed.activeSaveId, first.activeSaveId);
  assert.equal(resumed.saves[0].chapterOnePresentation.beat, "operator");
  assert.equal(resumed.saves[0].money, 0);
});

test("explicit review reset replaces only that storage and preserves language", () => {
  const review = memoryStorage();
  const mainGame = memoryStorage();
  const main = bootstrapChapterOneLocalReview(mainGame);
  const first = bootstrapChapterOneLocalReview(review);
  review.setItem(LANGUAGE_STORAGE_KEY, "en");
  const reset = bootstrapChapterOneLocalReview(review, { reset: true });
  assert.notEqual(reset.activeSaveId, first.activeSaveId);
  assert.equal(reset.saves[0].chapterOnePresentation.beat, "silence");
  assert.deepEqual(loadSaves(mainGame), main.saves);
  assert.equal(review.getItem(LANGUAGE_STORAGE_KEY), "en");
});

test("dedicated desktop package isolates its data and retains production security and models", () => {
  const entry = fs.readFileSync(new URL("../electron/chapter-one-review-main.cjs", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(entry, /app\.setPath\("userData"/);
  assert.match(entry, /CWGame-ChapterOne-Review/);
  assert(entry.indexOf('app.setPath("userData"') < entry.indexOf('require("./main.cjs")'));
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /additionalArguments: chapterOneLocalReviewMode/);
  assert.match(app, /chapterOneLocalReview === true \? bootstrapChapterOneLocalReview\(\) : null/);
  assert.match(app, /!\["chapter-one", "chapter-one-review", "station"\]\.includes\(screen\)/);
});
