import { emptyQslStoryState, normalizeQslStoryState } from "./qslStoryRun.js";
import { emptyServiceNetState, normalizeServiceNetState } from "./serviceNetRun.js";
import { emptyCoordinateRelayState, normalizeCoordinateRelayState } from "./coordinateRelayRun.js";
import { emptyContestState, normalizeContestState } from "./contestRun.js";
import { emptyListeningState, normalizeListeningState } from "./listeningRun.js";
import { emptyStormRelayState, normalizeStormRelayState } from "./stormRelayRun.js";
import { emptyNightOperationsState, normalizeNightOperationsState } from "./nightOperationsRun.js";
import { emptyFinalPromiseState, normalizeFinalPromiseState } from "./finalPromiseRun.js";
import { emptyFirstPageState, normalizeFirstPageState } from "./firstPageState.js";
import { emptyOpenStationState, normalizeOpenStationState } from "./openStationState.js";

export const STORY_CONTINUATION_STATE_VERSION = 2;

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

export function emptyStoryContinuationState() {
  return Object.freeze({
    version: STORY_CONTINUATION_STATE_VERSION,
    chapter07: emptyQslStoryState(),
    chapter08: emptyServiceNetState(),
    chapter09: emptyCoordinateRelayState(),
    chapter10: emptyContestState(),
    chapter11: emptyListeningState(),
    chapter12: emptyStormRelayState(),
    chapter13: emptyNightOperationsState(),
    chapter14: emptyFinalPromiseState(),
    chapter15: emptyFirstPageState(),
    openStation: emptyOpenStationState(),
  });
}

export function normalizeStoryContinuationState(value) {
  try {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.freeze({
      version: STORY_CONTINUATION_STATE_VERSION,
      chapter07: normalizeQslStoryState(own(source, "chapter07")),
      chapter08: normalizeServiceNetState(own(source, "chapter08")),
      chapter09: normalizeCoordinateRelayState(own(source, "chapter09")),
      chapter10: normalizeContestState(own(source, "chapter10")),
      chapter11: normalizeListeningState(own(source, "chapter11")),
      chapter12: normalizeStormRelayState(own(source, "chapter12")),
      chapter13: normalizeNightOperationsState(own(source, "chapter13")),
      chapter14: normalizeFinalPromiseState(own(source, "chapter14")),
      chapter15: normalizeFirstPageState(own(source, "chapter15")),
      openStation: normalizeOpenStationState(own(source, "openStation")),
    });
  } catch {
    return emptyStoryContinuationState();
  }
}
