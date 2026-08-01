import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("release metadata uses the package version across the game, QA, and localized docs", () => {
  const packageJson = JSON.parse(read("package.json"));
  const version = String(packageJson.version ?? "");
  assert.match(version, /^\d+\.\d+\.\d+$/);

  assert.match(
    read("src/App.jsx"),
    new RegExp(`const BUILD_VERSION = ["']${version.replaceAll(".", "\\.")}["'];`),
  );
  assert.ok(
    read("electron/qa-capture.cjs").includes(`buildTag.includes("v${version}")`),
    "packaged QA must assert the same title-screen version",
  );

  for (const readme of [
    "README.md", "README.zh-CN.md", "README.zh-TW.md", "README.ja.md",
    "README.es.md", "README.de.md", "README.ru.md",
  ]) {
    assert.ok(read(readme).includes(`**v${version}**`), `${readme} must describe v${version}`);
  }
  assert.ok(
    read("docs/CW_台站模拟游戏设计文档_v0.4.md").includes(`**实现基线：** v${version}`),
    "the design document baseline must match package.json",
  );
});
