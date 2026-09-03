import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { activeStoryChapter, CHAPTER_MEDIA, chapterForScreen, chapterMedia } from "../src/media/chapterMediaCatalog.js";
import {
  CHAPTER_MEDIA_SETTINGS_KEY, DEFAULT_CHAPTER_MEDIA_SETTINGS, loadChapterMediaSettings,
  normalizeChapterMediaSettings, persistChapterMediaSettings,
} from "../src/media/chapterMediaSettings.js";

const root = fileURLToPath(new URL("../", import.meta.url));

function assetBuffer(assetPath) {
  return readFileSync(`${root}public\\${assetPath.replace("./", "").replaceAll("/", "\\")}`);
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

test("all fifteen chapters ship a distinct complete five-part media set", () => {
  assert.equal(CHAPTER_MEDIA.length, 15);
  const kinds = ["scene", "portrait", "illustration", "ambience", "music"];
  for (const kind of kinds) {
    const hashes = new Set();
    for (const media of CHAPTER_MEDIA) {
      assert.equal(media.chapter, CHAPTER_MEDIA.indexOf(media) + 1);
      const buffer = assetBuffer(media[kind]);
      assert.ok(buffer.length > (kind === "ambience" || kind === "music" ? 100_000 : 500_000));
      hashes.add(hash(buffer));
      if (["scene", "portrait", "illustration"].includes(kind)) {
        assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.ok(buffer.readUInt32BE(16) >= 1024);
        assert.ok(buffer.readUInt32BE(20) >= 768);
      } else {
        assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
        assert.equal(buffer.subarray(8, 12).toString("ascii"), "WAVE");
        assert.equal(buffer.readUInt16LE(22), 1);
        assert.equal(buffer.readUInt32LE(24), 16_000);
        assert.equal(buffer.readUInt16LE(34), 16);
      }
    }
    assert.equal(hashes.size, 15, `${kind} files must be chapter-specific`);
  }
});

test("the public audit manifest matches every catalogued asset", () => {
  const manifest = JSON.parse(readFileSync(`${root}public\\assets\\chapters\\manifest.json`, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.chapters.length, 15);
  for (const media of CHAPTER_MEDIA) {
    const entry = manifest.chapters[media.chapter - 1];
    assert.equal(entry.chapter, media.chapter);
    for (const kind of ["scene", "portrait", "illustration", "ambience", "music"]) {
      const buffer = assetBuffer(media[kind]);
      assert.equal(entry.assets[kind].path, media[kind]);
      assert.equal(entry.assets[kind].bytes, buffer.length);
      assert.equal(entry.assets[kind].sha256, hash(buffer));
    }
  }
});

test("screen and active-story routing select the intended chapter", () => {
  assert.equal(chapterMedia(1)?.scene, "./assets/chapters/01/scene.png");
  assert.equal(chapterMedia(15)?.music, "./assets/chapters/15/music.wav");
  assert.equal(chapterMedia(16), null);
  assert.equal(chapterForScreen("lights", null), 5);
  assert.equal(chapterForScreen("final-promise", null), 14);
  const save = { missionState: { activeMissions: [{ id: "daily-x" }, { id: "story-03" }] } };
  assert.equal(activeStoryChapter(save), 3);
  assert.equal(chapterForScreen("station", save), 3);
  assert.equal(chapterForScreen("home", save), null);
  assert.equal(activeStoryChapter({ missionState: { activeMissions: "story-03" } }), null);
  assert.equal(activeStoryChapter({ missionState: { activeMissions: [null, { id: "story-99" }] } }), null);
});

test("chapter media preferences normalize and persist safely", () => {
  assert.deepEqual(normalizeChapterMediaSettings(null), DEFAULT_CHAPTER_MEDIA_SETTINGS);
  assert.deepEqual(normalizeChapterMediaSettings({ enabled: false, musicVolume: 3, ambienceVolume: -2 }), {
    enabled: false, musicVolume: 1, ambienceVolume: 0,
  });
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  persistChapterMediaSettings({ enabled: true, musicVolume: .31, ambienceVolume: .42 }, storage);
  assert.ok(values.has(CHAPTER_MEDIA_SETTINGS_KEY));
  assert.deepEqual(loadChapterMediaSettings(storage), { enabled: true, musicVolume: .31, ambienceVolume: .42 });
  assert.deepEqual(loadChapterMediaSettings({ getItem: () => "{" }), DEFAULT_CHAPTER_MEDIA_SETTINGS);
});
