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
    ["src/components/NetworkIndicator.jsx", "LABELS"],
    ["src/components/QsoDutyCoach.jsx", "TEXT"],
    ["src/components/QsoRewardBreakdown.jsx", "TEXT"],
    ["src/practice/PracticeScreen.jsx", "TEXT"],
    ["src/propagation/StationLocationModal.jsx", "TEXT"],
    ["src/screens/AchievementsModal.jsx", "TEXT"],
    ["src/screens/AchievementsModal.jsx", "NOTIFICATION_TEXT"],
    ["src/screens/HomeScreen.jsx", "TEXT"],
    ["src/screens/HomeScreen.jsx", "WAREHOUSE_TEXT"],
    ["src/screens/HomeScreen.jsx", "QSO_LOG_TEXT"],
    ["src/screens/HomeScreen.jsx", "QSO_REVIEW_TEXT"],
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
