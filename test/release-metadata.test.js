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

test("all localized v0.37 summaries separate completed, playable, foundation, and planned boundaries", () => {
  const summaries = {
    "README.md": [
      "Chapter 5 is now complete", "Chapter 6 is playable", "Chapter 7 foundation only",
      "Full Chapter 7 and Chapters 8–15 remain planned",
    ],
    "README.zh-CN.md": [
      "第 5 章现已完整实现", "第 6 章现已可玩", "第 7 章仅完成基础",
      "完整第 7 章及第 8–15 章仍在计划中",
    ],
    "README.zh-TW.md": [
      "第 5 章現已完整實作", "第 6 章現已可玩", "第 7 章僅完成基礎",
      "完整第 7 章及第 8–15 章仍在規劃中",
    ],
    "README.ja.md": [
      "第5章を完全実装", "第6章はプレイ可能", "第7章は基盤のみ",
      "第7章の完全版と第8～15章は引き続き計画段階",
    ],
    "README.es.md": [
      "El capítulo 5 ya está completo", "El capítulo 6 ya es jugable", "El capítulo 7 solo incorpora la base",
      "El capítulo 7 completo y los capítulos 8–15 siguen planificados",
    ],
    "README.de.md": [
      "Kapitel 5 ist jetzt vollständig umgesetzt", "Kapitel 6 ist spielbar", "Kapitel 7 enthält nur die Grundlage",
      "Das vollständige Kapitel 7 und die Kapitel 8–15 bleiben geplant",
    ],
    "README.ru.md": [
      "Глава 5 теперь реализована полностью", "Глава 6 доступна для прохождения", "В главе 7 реализована только основа",
      "Полная глава 7 и главы 8–15 остаются в планах",
    ],
  };
  for (const [file, phrases] of Object.entries(summaries)) {
    const source = read(file);
    assert.ok(source.includes("https://github.com/Arsenic-er/cwformer"), `${file} must retain the cwformer link`);
    for (const phrase of phrases) assert.ok(source.includes(phrase), `${file} is missing boundary: ${phrase}`);
  }
});

test("release design docs distinguish the Chapter 7 foundation from future chapters", () => {
  const design = read("docs/CW_台站模拟游戏设计文档_v0.4.md");
  const story = read("docs/story-missions-open-station-v0.1.md");
  const working = read("docs/planning/chapter-05-lights-working-design-v0.1.md");
  const chapterFive = read("docs/superpowers/specs/2026-08-25-chapter-05-lights-gameplay-design.md");
  const continuation = read("docs/superpowers/specs/2026-08-25-v037-ch5-ch7-continuation-design.md");
  for (const source of [design, story, continuation]) {
    assert.match(source, /第 5 章[^\n]*(?:完整实现|完整呈现)/);
    assert.match(source, /第 6 章[^\n]*(?:可玩|纵向切片)/);
    assert.match(source, /第 7 章[^\n]*(?:基础|跨章基础)/);
    assert.match(source, /第 8[–-]15 章[^\n]*(?:计划|尚未实现)/);
  }
  assert.match(working, /v0\.37\.0[^\n]*完整实现/);
  assert.match(chapterFive, /v0\.37\.0[^\n]*complete Chapter 5/);
  assert.doesNotMatch(continuation, /第 7 章已完整实现/);
  for (const source of [design, story, working, chapterFive, continuation]) {
    assert.doesNotMatch(source, /(?:本项目|项目|遊戲|game)\s*(?:是|为|為|is an?)\s*(?:开源|開源|open-source)/i);
  }
});
