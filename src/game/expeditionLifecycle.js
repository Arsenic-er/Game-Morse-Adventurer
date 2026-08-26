const TIMED_STATUSES = new Set(["setup", "ready", "calling", "exchange", "recovering"]);

export function expeditionTimerShouldRun({ status, inputBlocked = false, windowActive = true } = {}) {
  return TIMED_STATUSES.has(status)
    && inputBlocked !== true
    && windowActive !== false;
}

export function createExpeditionActiveClock({
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  onElapsed = () => {},
  intervalMilliseconds = 250,
} = {}) {
  let active = false;
  let baseline = null;
  let timer = null;

  function stopTimer() {
    if (timer === null) return;
    clearIntervalFn(timer);
    timer = null;
  }

  function sample() {
    const current = Number(now());
    if (!Number.isFinite(current)) return 0;
    const elapsed = active && Number.isFinite(baseline)
      ? Math.max(0, current - baseline)
      : 0;
    baseline = current;
    if (elapsed > 0) onElapsed(elapsed);
    return elapsed;
  }

  function setActive(nextActive) {
    stopTimer();
    active = nextActive === true;
    const current = Number(now());
    baseline = Number.isFinite(current) ? current : null;
    if (active) timer = setIntervalFn(sample, intervalMilliseconds);
    return active;
  }

  return {
    sample,
    setActive,
    dispose() {
      active = false;
      stopTimer();
      baseline = null;
    },
  };
}

export function expeditionPageIsActive(documentTarget = globalThis.document) {
  return documentTarget?.visibilityState !== "hidden"
    && (typeof documentTarget?.hasFocus !== "function" || documentTarget.hasFocus());
}

export function registerExpeditionPageVisibility({
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  onActiveChange = () => {},
} = {}) {
  const readActive = () => expeditionPageIsActive(documentTarget);
  const onBlur = () => onActiveChange(false);
  const onFocus = () => onActiveChange(readActive());
  const onVisibilityChange = () => onActiveChange(readActive());

  onActiveChange(readActive());
  windowTarget?.addEventListener?.("blur", onBlur);
  windowTarget?.addEventListener?.("focus", onFocus);
  documentTarget?.addEventListener?.("visibilitychange", onVisibilityChange);
  return () => {
    windowTarget?.removeEventListener?.("blur", onBlur);
    windowTarget?.removeEventListener?.("focus", onFocus);
    documentTarget?.removeEventListener?.("visibilitychange", onVisibilityChange);
  };
}

export function expeditionReplayAvailable(save) {
  if (save?.expeditionState?.expeditionTreeUnlocked === true) return true;
  return Array.isArray(save?.missionState?.claimedMissionIds)
    && save.missionState.claimedMissionIds.slice(-64).includes("story-06");
}
