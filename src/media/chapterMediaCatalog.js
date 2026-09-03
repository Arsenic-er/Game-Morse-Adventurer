const chapterPath = (chapter, filename) => `./assets/chapters/${String(chapter).padStart(2, "0")}/${filename}`;

export const CHAPTER_MEDIA = Object.freeze(Array.from({ length: 15 }, (_, index) => {
  const chapter = index + 1;
  return Object.freeze({
    chapter,
    scene: chapterPath(chapter, "scene.png"),
    portrait: chapterPath(chapter, "portrait.png"),
    illustration: chapterPath(chapter, "illustration.png"),
    ambience: chapterPath(chapter, "ambience.wav"),
    music: chapterPath(chapter, "music.wav"),
  });
}));

const SCREEN_CHAPTERS = Object.freeze({
  lights: 5,
  expedition: 6,
  "qsl-story": 7,
  "service-net": 8,
  "coordinate-relay": 9,
  contest: 10,
  listening: 11,
  "storm-relay": 12,
  "night-operations": 13,
  "final-promise": 14,
});

export function chapterMedia(chapter) {
  const numeric = Math.floor(Number(chapter));
  return CHAPTER_MEDIA[numeric - 1] ?? null;
}

export function activeStoryChapter(save) {
  const missions = Array.isArray(save?.missionState?.activeMissions) ? save.missionState.activeMissions : [];
  const active = missions.find((mission) => /^story-(?:0[1-9]|1[0-5])$/.test(mission?.id));
  return active ? Number(active.id.slice(-2)) : null;
}

export function chapterForScreen(screen, save) {
  if (SCREEN_CHAPTERS[screen]) return SCREEN_CHAPTERS[screen];
  if (screen === "station") return activeStoryChapter(save);
  return null;
}
