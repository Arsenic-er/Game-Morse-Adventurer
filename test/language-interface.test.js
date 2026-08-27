import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  LANGUAGES, LANGUAGE_IDS, LANGUAGE_STORAGE_KEY, detectLanguage,
  loadLanguagePreference, persistLanguagePreference,
} from "../src/i18n/languageRegistry.js";
import { ACCESSORIES } from "../src/game/accessoryCatalog.js";
import { ANTENNAS } from "../src/game/antennaCatalog.js";
import { KEY_OPTIONS, TRANSMITTERS } from "../src/game/equipmentCatalog.js";
import { LOCATIONS, REGION_NAMES } from "../src/game/locations.js";

const SUPPORTED_LANGUAGES = Object.freeze(["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
const REQUIRED_START_AND_SETTINGS_COPY = Object.freeze([
  "subtitle",
  "newGame",
  "practice",
  "fieldGuide",
  "callsignDisclaimer",
  "prototype",
  "language",
  "settings",
  "close",
  "interface",
  "keyType",
  "manual",
  "automatic",
  "automaticSpeed",
  "automaticSpeedHint",
  "apply",
]);

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function readLiteral(source, constantName, opening, closing) {
  const declaration = `const ${constantName} = `;
  const declarationIndex = source.indexOf(declaration);
  assert.notEqual(declarationIndex, -1, `missing ${constantName} declaration`);
  const start = source.indexOf(opening, declarationIndex + declaration.length);
  assert.notEqual(start, -1, `missing ${constantName} literal`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth === 0) {
      return vm.runInNewContext(`(${source.slice(start, index + 1)})`, Object.create(null));
    }
  }
  assert.fail(`unterminated ${constantName} literal`);
}

function assertLocalizedShape(candidate, reference, path) {
  if (typeof reference === "string") {
    assert.equal(typeof candidate, "string", `${path} must be text`);
    assert.ok(candidate.trim(), `${path} must not be blank`);
    assert.ok(!/^(undefined|null)$/i.test(candidate.trim()) && !candidate.includes("\ufffd"), `${path} contains placeholder or invalid text`);
    return;
  }
  if (Array.isArray(reference)) {
    assert.ok(Array.isArray(candidate), `${path} must be a list`);
    assert.equal(candidate.length, reference.length, `${path} list length must match English`);
    reference.forEach((value, index) => assertLocalizedShape(candidate[index], value, `${path}[${index}]`));
    return;
  }
  if (reference && typeof reference === "object") {
    assert.ok(candidate && typeof candidate === "object" && !Array.isArray(candidate), `${path} must be an object`);
    assert.deepEqual(Object.keys(candidate), Object.keys(reference), `${path} keys must match English`);
    for (const key of Object.keys(reference)) assertLocalizedShape(candidate[key], reference[key], `${path}.${key}`);
    return;
  }
  assert.equal(typeof candidate, typeof reference, `${path} value type must match English`);
}

function assertSevenLanguageDictionary(relativePath, constantName) {
  const dictionary = readLiteral(read(relativePath), constantName, "{", "}");
  assert.deepEqual(Object.keys(dictionary), SUPPORTED_LANGUAGES, `${relativePath}:${constantName} language keys`);
  for (const language of SUPPORTED_LANGUAGES) {
    assertLocalizedShape(dictionary[language], dictionary.en, `${relativePath}:${constantName}.${language}`);
  }
  for (const language of ["es", "de", "ru"]) {
    assert.notDeepEqual(dictionary[language], dictionary.en, `${relativePath}:${constantName}.${language} must not be an English fallback`);
  }
}

function assertLocalizedNames(names, path) {
  assert.deepEqual(Object.keys(names), SUPPORTED_LANGUAGES, `${path} language keys`);
  for (const language of SUPPORTED_LANGUAGES) {
    assert.equal(typeof names[language], "string", `${path}.${language} must be text`);
    assert.ok(names[language].trim(), `${path}.${language} must not be blank`);
  }
}

test("language menus expose the supported seven-language set with usable labels", () => {
  assert.deepEqual(LANGUAGE_IDS, SUPPORTED_LANGUAGES);
  assert.ok(Object.isFrozen(LANGUAGES));
  assert.ok(Object.isFrozen(LANGUAGE_IDS));
  for (const language of LANGUAGES) {
    assert.equal(typeof language.label, "string", `${language.id} label must be text`);
    assert.ok(language.label.trim(), `${language.id} label must not be blank`);
    assert.equal(typeof language.short, "string", `${language.id} short label must be text`);
    assert.ok(language.short.trim(), `${language.id} short label must not be blank`);
  }
});

test("start and settings copy is complete for every supported language", () => {
  const source = read("src/App.jsx");
  const copy = readLiteral(source, "COPY", "{", "}");

  assert.deepEqual(Object.keys(copy), SUPPORTED_LANGUAGES);
  for (const language of SUPPORTED_LANGUAGES) {
    for (const key of REQUIRED_START_AND_SETTINGS_COPY) {
      const value = copy[language]?.[key];
      assert.equal(typeof value, "string", `${language}.${key} must be text`);
      assert.ok(value.trim(), `${language}.${key} must not be blank`);
      assert.doesNotMatch(value, /undefined|null|\ufffd/i, `${language}.${key} contains placeholder or invalid text`);
    }
  }

  for (const language of ["es", "de", "ru"]) {
    for (const key of ["newGame", "fieldGuide", "callsignDisclaimer", "language", "settings", "interface", "keyType", "apply"]) {
      assert.notEqual(copy[language][key], copy.en[key], `${language}.${key} must not silently fall back to English`);
    }
  }
});

test("every interface dictionary has the same non-empty shape in all seven languages", () => {
  const dictionaries = [
    ["src/App.jsx", "ANTENNA_STATUS"],
    ["src/App.jsx", "COPY"],
    ["src/App.jsx", "STATION_FLOW_COPY"],
    ["src/App.jsx", "OPTIONAL_EXCHANGE_COPY"],
    ["src/components/NetworkIndicator.jsx", "LABELS"],
    ["src/components/QsoDutyCoach.jsx", "TEXT"],
    ["src/components/QsoRewardBreakdown.jsx", "TEXT"],
    ["src/practice/PracticeScreen.jsx", "TEXT"],
    ["src/propagation/StationLocationModal.jsx", "TEXT"],
    ["src/screens/AchievementsModal.jsx", "TEXT"],
    ["src/screens/AchievementsModal.jsx", "NOTIFICATION_TEXT"],
    ["src/screens/AchievementsModal.jsx", "ACHIEVEMENT_EXTRA_TEXT"],
    ["src/screens/AchievementsModal.jsx", "REWARD_TEXT"],
    ["src/screens/HomeScreen.jsx", "TEXT"],
    ["src/screens/HomeScreen.jsx", "WAREHOUSE_TEXT"],
    ["src/screens/HomeScreen.jsx", "QSO_LOG_TEXT"],
    ["src/screens/HomeScreen.jsx", "QSO_REVIEW_TEXT"],
    ["src/screens/lightsEventText.js", "LIGHTS_TEXT"],
    ["src/screens/expeditionText.js", "EXPEDITION_TEXT"],
    ["src/screens/qslStoryText.js", "QSL_STORY_TEXT"],
    ["src/screens/serviceNetText.js", "SERVICE_NET_TEXT"],
    ["src/screens/PeopleAndQslModal.jsx", "QSL_TEXT"],
    ["src/screens/MissionCenterModal.jsx", "TEXT"],
    ["src/screens/QsoResultModal.jsx", "TEXT"],
    ["src/screens/QsoResultModal.jsx", "REVIEW_TEXT"],
    ["src/screens/QsoLeaveConfirmModal.jsx", "QSO_LEAVE_TEXT"],
    ["src/screens/SaveSelectScreen.jsx", "TEXT"],
    ["src/screens/StationManualModal.jsx", "TEXT"],
    ["src/screens/StoreModal.jsx", "TEXT"],
  ];
  for (const [relativePath, constantName] of dictionaries) {
    assertSevenLanguageDictionary(relativePath, constantName);
  }
});

test("chapters six through ten expose responsive portrait-free seven-language interfaces", () => {
  const expedition = read("src/screens/ExpeditionScreen.jsx");
  const qslStory = read("src/screens/QslStoryScreen.jsx");
  const serviceNet = read("src/screens/ServiceNetScreen.jsx");
  const coordinateRelay = read("src/screens/CoordinateRelayScreen.jsx");
  const contest = read("src/screens/ContestScreen.jsx");
  const structuredMessages = read("src/screens/StructuredMessageLogModal.jsx");
  const people = read("src/screens/PeopleAndQslModal.jsx");
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(expedition, /data-testid="expedition-screen"/);
  assert.match(expedition, /data-expedition-elapsed-ms=\{run\.elapsedMilliseconds\}/);
  assert.match(expedition, /data-expedition-failure-reason=\{run\.failureReason \?\? ""\}/);
  assert.match(expedition, /data-expedition-window-active=\{windowActive\}/);
  assert.match(expedition, /data-expedition-paused=\{inputBlocked \|\| !windowActive\}/);
  assert.match(expedition, /data-portrait-visible="false"/);
  assert.doesNotMatch(expedition, /<img[^>]+portrait/i);
  assert.match(expedition, /data-action="expedition-call-cq"/);
  assert.match(expedition, /data-action="expedition-settle"/);
  assert.match(expedition, /cwgameSystem\?\.interpretCwTraffic/);
  assert.doesNotMatch(expedition, /submitExpeditionExchange\(run, exchange, \{ safeToCommit: true \}/);
  assert.match(qslStory, /data-testid="qsl-story-screen"/);
  assert.match(qslStory, /data-portrait-visible="false"/);
  assert.doesNotMatch(qslStory, /<img[^>]+portrait/i);
  assert.match(qslStory, /data-action="qsl-story-submit"/);
  assert.match(qslStory, /data-action="qsl-story-settle"/);
  assert.match(qslStory, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(people, /data-testid="people-qsl-modal"/);
  assert.match(people, /className="icon-button"[^>]+aria-label=\{t\.close\}/);
  assert.match(people, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(people, /event\.key !== "Escape"/);
  assert.match(people, /event\.preventDefault\(\)/);
  assert.match(people, /data-qsl-choice=/);
  assert.match(people, /t\[record\.operatorNarrativeKey\]/);
  assert.match(people, /t\[record\.playerNarrativeKey\]/);
  assert.doesNotMatch(people, />\{record\.operatorNarrativeKey\}<\/p>/);
  for (const key of [
    "qsl.player.hill-signal", "qsl.operator.sora-hill-reply",
    "qsl.player.lights-contact", "qsl.operator.lights-reply",
    "qsl.player.clarification-request", "qsl.operator.sora-clarification",
  ]) assert.match(people, new RegExp(`"${key.replaceAll(".", "\\.")}"`));
  assert.match(serviceNet, /data-testid="service-net-screen"/);
  assert.match(serviceNet, /data-simulation="fictional-public-service"/);
  assert.match(serviceNet, /data-portrait-visible="false"/);
  assert.doesNotMatch(serviceNet, /<img[^>]+portrait/i);
  assert.match(serviceNet, /data-action="service-net-submit"/);
  assert.match(serviceNet, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(coordinateRelay, /data-testid="coordinate-relay-screen"/);
  assert.match(coordinateRelay, /data-simulation="fictional-pixel-grid"/);
  assert.match(coordinateRelay, /data-portrait-visible="false"/);
  assert.doesNotMatch(coordinateRelay, /<img[^>]+portrait/i);
  assert.match(coordinateRelay, /data-action="coordinate-submit"/);
  assert.match(coordinateRelay, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(contest, /data-testid="contest-screen"/);
  assert.match(contest, /data-simulation="fictional-five-minute-contest"/);
  assert.match(contest, /data-portrait-visible="false"/);
  assert.doesNotMatch(contest, /<img[^>]+portrait/i);
  assert.match(contest, /data-action="contest-submit"/);
  assert.match(contest, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(structuredMessages, /data-testid="structured-message-log"/);
  assert.doesNotMatch(structuredMessages, /rawInput|playerInput|decodedText|freeText/);
  assert.match(app, /screen === "expedition"/);
  assert.match(app, /screen === "qsl-story"/);
  assert.match(app, /screen === "service-net"/);
  assert.match(app, /screen === "coordinate-relay"/);
  assert.match(app, /screen === "contest"/);
  assert.match(home, /data-action="open-people-qsl"/);
  assert.match(home, /data-action="enter-qsl-story-home"/);
  assert.match(home, /data-action="enter-service-net-home"/);
  assert.match(home, /data-action="enter-coordinate-relay-home"/);
  assert.match(home, /data-action="enter-contest-home"/);
  assert.match(home, /data-action="open-structured-messages"/);
  assert.match(mission, /data-action="launch-expedition-story"/);
  assert.match(mission, /data-action="launch-qsl-story"/);
  assert.match(mission, /data-action="launch-service-net"/);
  assert.match(mission, /data-action="launch-coordinate-relay"/);
  assert.match(mission, /data-action="launch-contest"/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.expedition-screen/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.qsl-story-screen/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.service-net-screen/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.coordinate-relay-screen/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.contest-screen/);
});

test("chapter five achievements have localized display copy instead of raw ids", () => {
  const source = read("src/screens/AchievementsModal.jsx");
  const extra = readLiteral(source, "ACHIEVEMENT_EXTRA_TEXT", "{", "}");
  const ids = ["lights-base", "lights-silver", "lights-gold", "lights-annual", "lights-may5"];
  for (const language of SUPPORTED_LANGUAGES) {
    for (const id of ids) {
      assert.equal(typeof extra[language]?.[id]?.title, "string", `${language}.${id}.title`);
      assert.ok(extra[language][id].title.trim());
      assert.notEqual(extra[language][id].title, id);
      assert.ok(extra[language][id].description.trim(), `${language}.${id}.description`);
    }
  }
});

test("chapter five presentation stays archive-backed, portrait-free on air, and responsive", () => {
  const eventScreen = read("src/screens/LightsEventScreen.jsx");
  const mapPanel = read("src/screens/LightsMapPanel.jsx");
  const historyPanel = read("src/screens/LightsHistoryPanel.jsx");
  const missionCenter = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(eventScreen, /<LightsMapPanel archive=\{save\.eventRunArchive\}/);
  assert.match(eventScreen, /<LightsHistoryPanel archive=\{save\.eventRunArchive\}/);
  assert.match(eventScreen, /const stationDate = lightsStationCalendarDate\(startedAt\)/);
  assert.doesNotMatch(eventScreen, /getLocation\(save\.locationId\)\.timeZone/);
  assert.match(eventScreen, /data-portrait-visible="false"/);
  assert.doesNotMatch(eventScreen, /<img[^>]+portrait/i);
  assert.match(mapPanel, /buildLightsMapModel\(archive/);
  assert.doesNotMatch(mapPanel, /\b(?:hash32|Math\.random|randomUUID)\b/);
  assert.match(historyPanel, /buildLightsHistoryModel\(archive\)/);
  assert.match(missionCenter, /data-lights-narrative-key/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.lights-event-console \{ overflow: auto; \}/);
});

test("equipment and location catalogs provide non-empty names in all seven languages", () => {
  for (const item of [...ACCESSORIES, ...ANTENNAS, ...TRANSMITTERS, ...LOCATIONS]) {
    assertLocalizedNames(item.names, `${item.id}.names`);
  }
  for (const option of KEY_OPTIONS) {
    assertLocalizedNames(option.names, `${option.id}.names`);
    assertLocalizedNames(option.controls, `${option.id}.controls`);
  }
  for (const [regionId, names] of Object.entries(REGION_NAMES)) {
    assertLocalizedNames(names, `REGION_NAMES.${regionId}`);
  }
});

test("language choice has a dedicated versioned persistence contract", () => {
  assert.equal(LANGUAGE_STORAGE_KEY, "game-morse-adventurer.language.v1");
  const browserCases = new Map([["zh-CN","zh-CN"],["zh-HK","zh-TW"],["ja-JP","ja"],["en-US","en"],["es-MX","es"],["de-AT","de"],["ru-RU","ru"],["fr-FR","en"]]);
  for (const [input, expected] of browserCases) assert.equal(detectLanguage(input), expected);
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(loadLanguagePreference(storage, "de-DE"), "de");
  for (const language of SUPPORTED_LANGUAGES) {
    assert.equal(persistLanguagePreference(language, storage), language);
    assert.equal(values.get(LANGUAGE_STORAGE_KEY), language);
    assert.equal(loadLanguagePreference(storage, "en-US"), language);
  }
  assert.equal(persistLanguagePreference("unsupported", storage), "en");
  assert.equal(loadLanguagePreference(storage, "ru-RU"), "en");
  const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(loadLanguagePreference(unavailable, "es-ES"), "es");
  assert.equal(persistLanguagePreference("ru", unavailable), "ru");
});
