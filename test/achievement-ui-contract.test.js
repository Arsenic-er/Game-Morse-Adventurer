import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/screens/AchievementsModal.jsx", import.meta.url),
  "utf8",
);

test("the achievement modal resolves localized reward copy in render scope", () => {
  const modalSource = source.slice(source.indexOf("export function AchievementsModal"));
  assert.match(
    modalSource,
    /const rewardText = REWARD_TEXT\[language\] \?\? REWARD_TEXT\.en;/,
  );
  const keyHandler = modalSource.match(/function handleKeyDown\(event\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
  assert.doesNotMatch(keyHandler, /const rewardText/);
});
