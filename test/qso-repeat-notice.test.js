import test from "node:test";
import assert from "node:assert/strict";
import { qsoRepeatNoticeCopy } from "../src/qso/qsoRepeatNotice.js";

const languages = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"];

test("repeat feedback is translated for every supported interface language", () => {
  for (const language of languages) {
    const copy = qsoRepeatNoticeCopy(language);
    assert.equal(typeof copy.agnRepeat, "string", `${language} AGN feedback must be text`);
    assert.ok(copy.agnRepeat.trim().length > 0, `${language} AGN feedback must not be blank`);
    assert.equal(typeof copy.qrsRepeat, "string", `${language} QRS feedback must be text`);
    assert.equal(typeof copy.qrsMinimum, "string", `${language} minimum-speed feedback must be text`);
  }
});

test("repeat feedback falls back to English for an unknown language", () => {
  assert.deepEqual(qsoRepeatNoticeCopy("unknown"), qsoRepeatNoticeCopy("en"));
});
