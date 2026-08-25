import { touchSaveWorldCalendar } from "./saveStore.js";

export function isWorldCalendarGameplayActive({ activeSaveId, screen, practiceReturnScreen }) {
  if (!activeSaveId) return false;
  if (screen === "home" || screen === "station" || screen === "lights") return true;
  return screen === "practice" && practiceReturnScreen === "home";
}

export function touchActiveWorldCalendarSaves(saves, activeSaveId, now = new Date()) {
  if (!activeSaveId || !Array.isArray(saves)) return { changed: false, saves };
  let changed = false;
  const nextSaves = saves.map((save) => {
    if (save.id !== activeSaveId) return save;
    const touched = touchSaveWorldCalendar(save, now);
    if (touched !== save) changed = true;
    return touched;
  });
  return changed ? { changed: true, saves: nextSaves } : { changed: false, saves };
}
