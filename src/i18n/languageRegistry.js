export const LANGUAGE_STORAGE_KEY = "game-morse-adventurer.language.v1";

export const LANGUAGES = Object.freeze([
  { id: "zh-CN", label: "简体中文", short: "简" },
  { id: "zh-TW", label: "繁體中文", short: "繁" },
  { id: "ja", label: "日本語", short: "日" },
  { id: "en", label: "English", short: "EN" },
  { id: "es", label: "Español", short: "ES" },
  { id: "de", label: "Deutsch", short: "DE" },
  { id: "ru", label: "Русский", short: "RU" },
]);

export const LANGUAGE_IDS = Object.freeze(LANGUAGES.map(({ id }) => id));

export function detectLanguage(language = globalThis.navigator?.language) {
  const candidate = String(language || "en");
  if (/^zh-(TW|HK|MO)/i.test(candidate)) return "zh-TW";
  if (/^zh/i.test(candidate)) return "zh-CN";
  if (/^ja/i.test(candidate)) return "ja";
  if (/^es/i.test(candidate)) return "es";
  if (/^de/i.test(candidate)) return "de";
  if (/^ru/i.test(candidate)) return "ru";
  return "en";
}

export function normalizeLanguage(language) {
  return LANGUAGE_IDS.includes(language) ? language : "en";
}

export function loadLanguagePreference(storage = globalThis.localStorage, browserLanguage = globalThis.navigator?.language) {
  try {
    const stored = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return stored && LANGUAGE_IDS.includes(stored) ? stored : detectLanguage(browserLanguage);
  } catch {
    return detectLanguage(browserLanguage);
  }
}

export function persistLanguagePreference(language, storage = globalThis.localStorage) {
  const normalized = normalizeLanguage(language);
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Language changes should remain usable even when storage is unavailable.
  }
  return normalized;
}
