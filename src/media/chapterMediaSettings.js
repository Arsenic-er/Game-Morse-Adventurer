export const CHAPTER_MEDIA_SETTINGS_KEY = "cwgame.chapter-media.v1";

export const DEFAULT_CHAPTER_MEDIA_SETTINGS = Object.freeze({
  enabled: true,
  ambienceVolume: 0.24,
  musicVolume: 0.16,
});

function clampVolume(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

export function normalizeChapterMediaSettings(value) {
  return {
    enabled: value?.enabled !== false,
    ambienceVolume: clampVolume(value?.ambienceVolume, DEFAULT_CHAPTER_MEDIA_SETTINGS.ambienceVolume),
    musicVolume: clampVolume(value?.musicVolume, DEFAULT_CHAPTER_MEDIA_SETTINGS.musicVolume),
  };
}

export function loadChapterMediaSettings(storage = globalThis.localStorage) {
  try {
    return normalizeChapterMediaSettings(JSON.parse(storage?.getItem(CHAPTER_MEDIA_SETTINGS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_CHAPTER_MEDIA_SETTINGS };
  }
}

export function persistChapterMediaSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizeChapterMediaSettings(settings);
  try {
    storage?.setItem(CHAPTER_MEDIA_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Preferences remain active for this session when storage is unavailable.
  }
  return normalized;
}
