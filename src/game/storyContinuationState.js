import { emptyQslStoryState, normalizeQslStoryState } from "./qslStoryRun.js";
import { emptyServiceNetState, normalizeServiceNetState } from "./serviceNetRun.js";
import { emptyCoordinateRelayState, normalizeCoordinateRelayState } from "./coordinateRelayRun.js";
import { emptyContestState, normalizeContestState } from "./contestRun.js";

export const STORY_CONTINUATION_STATE_VERSION = 1;

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
    });
  } catch {
    return emptyStoryContinuationState();
  }
}
