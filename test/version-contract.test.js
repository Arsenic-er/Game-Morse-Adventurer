import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VERSION = "0.37.0";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("package, UI, desktop QA, docs, and localized READMEs share one release version", () => {
  assert.equal(JSON.parse(read("../package.json")).version, VERSION);
  assert.match(read("../src/App.jsx"), new RegExp(`BUILD_VERSION = "${VERSION.replaceAll(".", "\\.")}"`));
  assert.match(read("../electron/qa-capture.cjs"), new RegExp(`v${VERSION.replaceAll(".", "\\.")}`));
  assert.match(read("../docs/CW_台站模拟游戏设计文档_v0.4.md"), new RegExp(`实现基线：\\*\\* v${VERSION.replaceAll(".", "\\.")}`));
  for (const file of [
    "README.md", "README.zh-CN.md", "README.zh-TW.md", "README.ja.md",
    "README.es.md", "README.de.md", "README.ru.md",
  ]) {
    assert.match(read(`../${file}`), new RegExp(`v${VERSION.replaceAll(".", "\\.")}`), file);
  }
});
