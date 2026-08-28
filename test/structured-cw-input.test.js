import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/cw/useStructuredCwInput.js", import.meta.url), "utf8");
const qaSource = readFileSync(new URL("../electron/qa-capture.cjs", import.meta.url), "utf8");

test("structured chapter input uses the live CW core and physical key events", () => {
  assert.match(source, /useCwCore/);
  assert.match(source, /event\.code === "Space"/);
  assert.match(source, /event\.code === "KeyZ"/);
  assert.match(source, /event\.code === "KeyX"/);
  assert.match(source, /cw\.beginManual\(\)/);
  assert.match(source, /cw\.beginAutomatic\("\."\)/);
  assert.match(source, /cw\.beginAutomatic\("-"\)/);
});

test("packaged chapter QA keys the same Space/Z/X path instead of assigning decoded text", () => {
  assert.match(qaSource, /sendAutomaticStructuredText/);
  assert.match(qaSource, /sendAutomaticStructuredText\(window, "QSL WRONG DE WRONG PSE K"/);
  assert.match(qaSource, /sendAutomaticStructuredText\(window, `\$\{playerCallsign\} CHECK IN K`/);
  assert.match(qaSource, /sendAutomaticStructuredText\(window, packetText/);
  assert.doesNotMatch(qaSource, /async function submitQaTextInput/);
  assert.doesNotMatch(qaSource, /setInputValue\(window, '\.qsl-story-message input'/);
  assert.doesNotMatch(qaSource, /setInputValue\(window, '\.service-net-message input'/);
  assert.doesNotMatch(qaSource, /setInputValue\(window, '\.coordinate-relay-input input'/);
});
