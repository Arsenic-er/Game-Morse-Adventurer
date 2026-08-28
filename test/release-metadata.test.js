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

test("v0.40 metadata marks chapters seven through ten complete and eleven through fifteen planned", () => {
  const summaries = {
    "README.md": [
      "Chapters 5–10 are implemented", "Chapter 7 QSL investigation", "Chapter 8 fictional service net",
      "Chapter 9 Pixel Grid coordinate relay", "Chapter 10 RUN / S&P contest", "Chapters 11–15 remain planned",
    ],
    "README.zh-CN.md": [
      "第 5–10 章已经实现", "第 7 章 QSL 复核", "第 8 章虚构公共服务点名",
      "第 9 章 Pixel Grid 坐标中继", "第 10 章 RUN / S&P 比赛", "第 11–15 章仍在计划中",
    ],
    "README.zh-TW.md": [
      "第 5–10 章已經實作", "第 7 章 QSL 複核", "第 8 章虛構公共服務點名",
      "第 9 章 Pixel Grid 座標中繼", "第 10 章 RUN / S&P 比賽", "第 11–15 章仍在規劃中",
    ],
    "README.ja.md": [
      "第5～10章を実装", "第7章のQSL再確認", "第8章の架空公共サービスネット",
      "第9章のPixel Grid座標中継", "第10章のRUN / S&Pコンテスト", "第11～15章は引き続き計画段階",
    ],
    "README.es.md": [
      "Los capítulos 5–10 están implementados", "investigación QSL del capítulo 7", "red ficticia de servicio público del capítulo 8",
      "relevo de coordenadas Pixel Grid del capítulo 9", "concurso RUN / S&P del capítulo 10", "Los capítulos 11–15 siguen planificados",
    ],
    "README.de.md": [
      "Kapitel 5–10 sind umgesetzt", "QSL-Nachprüfung in Kapitel 7", "fiktive öffentliche Servicenetz in Kapitel 8",
      "Pixel-Grid-Koordinatenweitergabe in Kapitel 9", "RUN-/S&P-Wettbewerb in Kapitel 10", "Kapitel 11–15 bleiben geplant",
    ],
    "README.ru.md": [
      "Главы 5–10 реализованы", "Проверка QSL в главе 7", "Вымышленная сеть общественной службы в главе 8",
      "Ретрансляция координат Pixel Grid в главе 9", "Соревнование RUN / S&P в главе 10", "Главы 11–15 остаются в планах",
    ],
  };
  for (const [file, phrases] of Object.entries(summaries)) {
    const source = read(file);
    assert.ok(source.includes("https://github.com/Arsenic-er/cwformer"), `${file} must retain the cwformer link`);
    for (const phrase of phrases) assert.ok(source.includes(phrase), `${file} is missing boundary: ${phrase}`);
  }
});

test("release design docs record completed Chapters 7–10 and keep Chapters 11–15 non-playable", () => {
  const design = read("docs/CW_台站模拟游戏设计文档_v0.4.md");
  const story = read("docs/story-missions-open-station-v0.1.md");
  const working = read("docs/planning/chapter-05-lights-working-design-v0.1.md");
  const chapterFive = read("docs/superpowers/specs/2026-08-25-chapter-05-lights-gameplay-design.md");
  const continuation = read("docs/superpowers/specs/2026-08-25-v037-ch5-ch7-continuation-design.md");
  for (const source of [design, story]) {
    assert.match(source, /v0\.40\.0/);
    assert.match(source, /第 7 章[^\n]*(?:完整实现|完整剧情|QSL 复核)/);
    assert.match(source, /第 8 章[^\n]*(?:完整实现|公共服务点名)/);
    assert.match(source, /第 9 章[^\n]*(?:完整实现|坐标中继)/);
    assert.match(source, /第 10 章[^\n]*(?:完整实现|RUN \/ S&P)/);
    assert.match(source, /第 11[–-]15 章[^\n]*(?:计划|尚未实现|不可玩)/);
  }
  assert.match(working, /v0\.37\.0[^\n]*完整实现/);
  assert.match(chapterFive, /v0\.37\.0[^\n]*complete Chapter 5/);
  assert.doesNotMatch(continuation, /第 7 章已完整实现/);
  for (const source of [design, story, working, chapterFive, continuation]) {
    assert.doesNotMatch(source, /(?:本项目|项目|遊戲|game)\s*(?:是|为|為|is an?)\s*(?:开源|開源|open-source)/i);
  }
});
