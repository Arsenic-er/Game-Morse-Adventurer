import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAPTER_ONE_REVIEW_LANGUAGES, chapterOneReviewText,
} from "../src/screens/chapterOneReviewText.js";

const EXPECTED_LANGUAGES = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"];

test("chapter one review exposes a five-beat standalone narrative in every interface language", () => {
  assert.deepEqual(CHAPTER_ONE_REVIEW_LANGUAGES, EXPECTED_LANGUAGES);
  for (const language of EXPECTED_LANGUAGES) {
    const text = chapterOneReviewText(language);
    assert.equal(text.beats.length, 5);
    assert.deepEqual(text.beats.map(({ id }) => id), ["silence", "operator", "call", "answer", "log"]);
    assert.match(text.noSave, /save|存|セーブ|partidas|Spielstände|сохранения/i);
  }
});

test("chapter one review assigns every approved artwork to a narrative purpose", () => {
  const text = chapterOneReviewText("zh-CN");
  assert.deepEqual(text.beats.map(({ asset }) => asset), ["scene", "portrait", "illustration", "illustration", "scene"]);
  assert.match(text.beats[0].caption, /台站/);
  assert.match(text.beats[1].caption, /值守员/);
  assert.match(text.beats[2].caption, /电键/);
  assert.match(text.beats[4].paragraphs.join(" "), /SIM3RA/);
});

test("unknown languages use the complete English review copy", () => {
  assert.equal(chapterOneReviewText("unknown"), chapterOneReviewText("en"));
});
