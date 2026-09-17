import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createSave } from "../src/game/saveStore.js";
import { acceptMission } from "../src/game/missionSystem.js";
import { advanceChapterOnePresentation } from "../src/game/chapterOneStory.js";
import { recordCompletedQso } from "../src/qso/qsoLog.js";
import { CHAPTER_ONE_STORY_LABELS } from "../src/screens/chapterOneStoryLabels.js";
import { chapterOneStoryText } from "../src/screens/chapterOneStoryText.js";
import { VISUAL_NOVEL_TEXT, visualNovelText } from "../src/screens/visualNovelText.js";

test("visual novel controls are localized without inventing a character speaker", () => {
  for (const language of Object.keys(CHAPTER_ONE_STORY_LABELS)) {
    assert.deepEqual(Object.keys(VISUAL_NOVEL_TEXT[language]).sort(), Object.keys(VISUAL_NOVEL_TEXT.en).sort());
    assert(Object.values(visualNovelText(language)).every(value => typeof value === "string" && value.trim()));
  }
  assert.equal(visualNovelText("zh-CN").narrator, "旁白");
});

test("production narrative and controls are complete in all seven languages", () => {
  const keys = Object.keys(CHAPTER_ONE_STORY_LABELS.en).sort();
  for (const language of ["zh-CN", "zh-TW", "en", "ja", "es", "de", "ru"]) {
    const labels = CHAPTER_ONE_STORY_LABELS[language];
    assert.deepEqual(Object.keys(labels).sort(), keys);
    assert(Object.values(labels).every(value => typeof value === "string" && value.trim()));
    const { beats } = chapterOneStoryText(language);
    assert.equal(beats.length, 5);
    assert(beats.every(beat => beat.title && beat.tab && beat.paragraphs.length === 2));
    if (language !== "en") assert.notEqual(beats[0].paragraphs[0], chapterOneStoryText("en").beats[0].paragraphs[0]);
  }
});

test("formal opening and closing render only real save facts, while review stays independent", async () => {
  const vite = await createServer({ appType: "custom", logLevel: "silent", optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null } });
  try {
    const { ChapterOneStoryScreen } = await vite.ssrLoadModule("/src/screens/ChapterOneStoryScreen.jsx");
    const { ChapterOneReviewScreen } = await vite.ssrLoadModule("/src/screens/ChapterOneReviewScreen.jsx");
    const { HomeScreen } = await vite.ssrLoadModule("/src/screens/HomeScreen.jsx");
    const { MissionCenterModal } = await vite.ssrLoadModule("/src/screens/MissionCenterModal.jsx");
    const { QsoResultModal } = await vite.ssrLoadModule("/src/screens/QsoResultModal.jsx");
    const { ReviewIncomingCaption } = await vite.ssrLoadModule("/src/components/ReviewIncomingCaption.jsx");
    let save = acceptMission(createSave({ callsign: "BH1NEW" }), "story-01", "2026-09-13T10:00:00.000Z").save;
    const callbacks = { onAdvance() {}, onEnterStation() {}, onClaim() {}, onBack() {}, onSettings() {} };
    const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
    const opening = render(ChapterOneStoryScreen, { language: "zh-CN", save, ...callbacks });
    assert.match(opening, /data-story-beat="silence"/);
    assert.doesNotMatch(opening, /data-testid="chapter-one-real-log"/);
    const home = render(HomeScreen, { language: "zh-CN", save, onEnterChapterOne() {}, ...callbacks });
    assert.match(home, /data-action="enter-chapter-one-home"/);
    const mission = render(MissionCenterModal, { language: "zh-CN", save, onLaunchChapterOne() {}, onClose() {} });
    assert.match(mission, /data-action="launch-chapter-one"/);
    save = advanceChapterOnePresentation(save, "operator").save;
    save = advanceChapterOnePresentation(save, "call").save;
    const call = render(ChapterOneStoryScreen, { language: "zh-CN", save, ...callbacks });
    assert.match(call, /BH1NEW/);
    assert.doesNotMatch(call, /SIM1OP/);
    assert.match(call, /data-vn-line="0"/);
    assert.match(call, /data-action="vn-notes"/);
    assert.doesNotMatch(call, /chapter-one-review-beats/);
    save = recordCompletedQso(save, { id: "live-first", callsign: "SIM7QX", playerCallsign: "BH1NEW", location: "NA-W", startedAt: "2026-09-13T10:02:00.000Z", completedAt: "2026-09-13T10:07:00.000Z", sent: "579", received: "559", frequencyMhz: 21.06, finalPropagationLevel: 3, transmitAccuracy: 96, keyingScore: 92 }).save;
    const answer = render(ChapterOneStoryScreen, { language: "zh-CN", save, ...callbacks });
    assert.match(answer, /data-story-beat="answer"/);
    assert.match(answer, /SIM7QX/);
    assert.doesNotMatch(answer, /SIM6JP/);
    save = advanceChapterOnePresentation(save, "log").save;
    for (const language of Object.keys(CHAPTER_ONE_STORY_LABELS)) {
      const closing = render(ChapterOneStoryScreen, { language, save, ...callbacks });
      assert.match(closing, /data-story-qso-id="live-first"/);
      assert.match(closing, /579 \/ 559/);
      assert.doesNotMatch(closing, /599/);
      assert.match(closing, /2026-09-13 10:07/);
    }
    const unsaved = render(QsoResultModal, { language: "zh-CN", saved: false, onContinueStory() {} });
    assert.doesNotMatch(unsaved, /data-action="continue-chapter-one"/);
    const savedResult = render(QsoResultModal, { language: "zh-CN", saved: true, onContinueStory() {} });
    assert.match(savedResult, /data-action="continue-chapter-one"/);
    const before = JSON.stringify(save);
    const review = render(ChapterOneReviewScreen, { language: "zh-CN", onBack() {}, onSettings() {} });
    assert.match(review, /data-review-beat="silence"/);
    assert.match(review, /不写入正式存档/);
    assert.equal(JSON.stringify(save), before);
    const waiting = render(ReviewIncomingCaption, { language: "zh-CN" });
    assert.match(waiting, /等待对方发报/);
    assert.doesNotMatch(waiting, /SIM6JP|data-testid="review-incoming-text"/);
    const received = render(ReviewIncomingCaption, { language: "zh-CN", text: "BH1QA DE SIM7QX 559 K", status: "receiving", assisted: true });
    assert.match(received, /BH1QA DE SIM7QX 559 K/);
    assert.match(received, /发送方：SIM7QX/);
    assert.match(received, /不计独立守听/);
    const hidden = render(ReviewIncomingCaption, { language: "zh-CN", text: "PRIVATE 599", expanded: false });
    assert.doesNotMatch(hidden, /PRIVATE|599/);
    assert.match(hidden, /aria-expanded="false"/);
  } finally { await vite.close(); }
});
