import { createSave, loadSaves, loadActiveSaveId, persistSaves, persistActiveSaveId } from "./saveStore.js";
import { acceptMission } from "./missionSystem.js";
import { LANGUAGE_STORAGE_KEY, persistLanguagePreference } from "../i18n/languageRegistry.js";

// Called only by the dedicated desktop review entry, whose userData is isolated.
export function bootstrapChapterOneLocalReview(storage = globalThis.localStorage, { reset = false } = {}) {
  const existing = reset ? [] : loadSaves(storage);
  const activeId = loadActiveSaveId(storage);
  const current = existing.find(save => save.id === activeId) ?? existing[0]
    ?? createSave({ callsign: "SIM1OP", keyType: "automatic", automaticKeyWpm: 18, qsoGuidance: "full" });
  const ready = current.missionState.claimedMissionIds.includes("story-01")
    || current.missionState.activeMissions.some(mission => mission.id === "story-01")
    ? current : acceptMission(current, "story-01").save;
  const saves = persistSaves([ready], storage);
  persistActiveSaveId(ready.id, storage);
  if (!storage?.getItem(LANGUAGE_STORAGE_KEY)) persistLanguagePreference("zh-CN", storage);
  return { saves, activeSaveId: ready.id, screen: ready.missionState.claimedMissionIds.includes("story-01") ? "home" : "chapter-one" };
}
