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

test("v0.45 metadata marks chapters five through fifteen and initial Open Station complete", () => {
  const summaries = {
    "README.md": [
      "Chapters 5–15 and the initial Open Station dashboard are implemented", "Chapter 11 listening watch",
      "Chapter 12 storm relay", "Chapter 13 night operations", "Chapter 14 final promise", "Chapter 15 ordinary QSO",
    ],
    "README.zh-CN.md": [
      "第 5–15 章与初始开放台站面板已经实现", "第 11 章守听", "第 12 章风暴中继",
      "第 13 章夜间操作", "第 14 章最后约定", "第 15 章普通 QSO",
    ],
    "README.zh-TW.md": [
      "第 5–15 章與初始開放台站面板已經實作", "第 11 章守聽", "第 12 章風暴中繼",
      "第 13 章夜間操作", "第 14 章最後約定", "第 15 章普通 QSO",
    ],
    "README.ja.md": [
      "第5～15章と初期Open Stationダッシュボードを実装", "第11章のリスニング監視",
      "第12章のストーム中継", "第13章の夜間運用", "第14章の最後の約束", "第15章の通常QSO",
    ],
    "README.es.md": [
      "Los capítulos 5–15 y el panel inicial de Open Station están implementados", "escucha del capítulo 11",
      "relevo de tormenta del capítulo 12", "operaciones nocturnas del capítulo 13",
      "promesa final del capítulo 14", "QSO ordinario del capítulo 15",
    ],
    "README.de.md": [
      "Kapitel 5–15 und das erste Open-Station-Dashboard sind umgesetzt", "Hörwache in Kapitel 11",
      "Sturmrelais in Kapitel 12", "Nachtbetrieb in Kapitel 13", "letzte Versprechen in Kapitel 14",
      "gewöhnliche QSO in Kapitel 15",
    ],
    "README.ru.md": [
      "Главы 5–15 и начальная панель Open Station реализованы", "Прослушивание в главе 11",
      "штормовая ретрансляция в главе 12", "ночная работа в главе 13",
      "последнее обещание в главе 14", "обычный QSO в главе 15",
    ],
  };
  for (const [file, phrases] of Object.entries(summaries)) {
    const source = read(file);
    assert.ok(source.includes("https://github.com/Arsenic-er/cwformer"), `${file} must retain the cwformer link`);
    for (const phrase of phrases) assert.ok(source.includes(phrase), `${file} is missing boundary: ${phrase}`);
  }
});

test("release design docs record completed Chapters 11–15 and the bounded Open Station dashboard", () => {
  const design = read("docs/CW_台站模拟游戏设计文档_v0.4.md");
  const story = read("docs/story-missions-open-station-v0.1.md");
  const working = read("docs/planning/chapter-05-lights-working-design-v0.1.md");
  const chapterFive = read("docs/superpowers/specs/2026-08-25-chapter-05-lights-gameplay-design.md");
  const continuation = read("docs/superpowers/specs/2026-08-25-v037-ch5-ch7-continuation-design.md");
  for (const source of [design, story]) {
    assert.match(source, /v0\.45\.0/);
    assert.match(source, /第 11 章[^\n]*(?:完整实现|守听)/);
    assert.match(source, /第 12 章[^\n]*(?:完整实现|风暴中继)/);
    assert.match(source, /第 13 章[^\n]*(?:完整实现|夜间操作)/);
    assert.match(source, /第 14 章[^\n]*(?:完整实现|最后约定)/);
    assert.match(source, /第 15 章[^\n]*(?:完整实现|普通 QSO)/);
    assert.match(source, /开放台站[^\n]*(?:面板|仪表板|已实现|解锁)/);
  }
  assert.match(working, /v0\.37\.0[^\n]*完整实现/);
  assert.match(chapterFive, /v0\.37\.0[^\n]*complete Chapter 5/);
  assert.doesNotMatch(continuation, /第 7 章已完整实现/);
  for (const source of [design, story, working, chapterFive, continuation]) {
    assert.doesNotMatch(source, /(?:本项目|项目|遊戲|game)\s*(?:是|为|為|is an?)\s*(?:开源|開源|open-source)/i);
  }
});
