import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { explainReviewIncoming } from "../src/qso/reviewIncomingCaption.js";
import { chapterOneReviewText } from "../src/screens/chapterOneReviewText.js";
import { chapterOneStoryText } from "../src/screens/chapterOneStoryText.js";

test("incoming glossary exposes only the supplied transmission", () => {
  assert.deepEqual(explainReviewIncoming(""), []);
  const reply = explainReviewIncoming("BH1QA DE SIM7QX R RST 559 K").join(" ");
  assert.match(reply, /发送方：SIM7QX/);
  assert.match(reply, /信号报告：559/);
  assert.match(reply, /轮到你发送/);
  assert.doesNotMatch(reply, /SIM6JP|599|听见你了/);
  assert.doesNotMatch(explainReviewIncoming("AGN? K").join(" "), /发送方|信号报告/);
  assert.match(explainReviewIncoming("MYSTERY").join(" "), /尚无自动释义/);
});

test("glossary explains requests, optional exchange, correction and signoff", () => {
  for (const text of ["?", "PSE AGN K", "AGN AGN? K"]) assert.match(explainReviewIncoming(text).join(" "), /再发一遍/);
  for (const text of ["QRS?", "QRS PSE K"]) assert.match(explainReviewIncoming(text).join(" "), /慢一点/);
  for (const text of ["QRZ? K", "UR CALL? K"]) assert.match(explainReviewIncoming(text).join(" "), /再报一次呼号/);
  for (const topic of ["PWR", "QTH", "WX", "NAME", "AGE", "RIG", "ANT"]) {
    assert.match(explainReviewIncoming(`PSE ${topic}? K`).join(" "), /游戏内资料/);
    assert.match(explainReviewIncoming(`BH1QA DE SIM7QX MY ${topic} VALUE FB 73 SK`).join(" "), /：VALUE。/);
  }
  const final = explainReviewIncoming("T HH BH1QA DE SIM7QX TNX CALL MY PWR 50W R RST 579 FB 73 SK").join(" ");
  assert.match(final, /更正/);
  assert.match(final, /功率：50W/);
  assert.match(final, /信号报告：579/);
  assert.match(final, /通联结束/);
  assert.doesNotMatch(final, /轮到你发送/);
  assert.match(explainReviewIncoming("CQ CQ DE SIM7QX K", "en").join(" "), /Sending station: SIM7QX/);
});

test("Chinese story distinguishes a pending reply from an already completed QSO", () => {
  const review = chapterOneReviewText("zh-CN").beats;
  const formal = chapterOneStoryText("zh-CN").beats;
  assert.match(review[2].paragraphs.join(" "), /接下来，先发 CQ/);
  assert.match(review[3].paragraphs.join(" "), /要是真有人回答/);
  assert.match(formal[3].paragraphs.join(" "), /通联就这样完成了/);
  assert.doesNotMatch([...formal, ...review].flatMap(beat => beat.paragraphs).join(" "), /听见你了|纸页没有变重|不是他的续页/);
  assert.match(formal[4].paragraphs.join(" "), /SIM3RA/);
});

test("station captions are opt-in local-review UI, captured at RX playback only", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /reviewAssist = false/);
  assert.match(app, /reviewAssist=\{Boolean\(localReviewBoot\)\}/);
  assert.match(app, /if \(reviewAssist && !forcedQaFailure\) \{\s*setReviewIncoming\(qso.npcMessage\)/);
  assert.match(app, /reviewCaptionExpandedRef.current\) setQso\(current => markQsoAssisted\(current\)\)/);
  assert.doesNotMatch(app, /setReviewIncoming\(qso.expectedPlayer/);
  const review = await readFile(new URL("../src/screens/ChapterOneReviewScreen.jsx", import.meta.url), "utf8");
  assert.match(review, /encodeTextToEvents\(text, \{ wpm: 22 \}\).events/);
});
