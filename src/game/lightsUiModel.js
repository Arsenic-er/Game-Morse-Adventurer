import {
  LIGHTS_MAX_CONTACTS, LIGHTS_PHASES, LIGHTS_RUN_DURATION_MS, currentLightsPileup,
  currentLightsPrompt, lightsRunResult,
} from "./lightsRun.js";
import { lightsText } from "../screens/lightsEventText.js";

const INSTRUCTION_KEYS = Object.freeze({
  [LIGHTS_PHASES.CHASE_CQ]: "phaseChaseCq",
  [LIGHTS_PHASES.CHASE_PLAYER_CALL]: "phaseChaseCall",
  [LIGHTS_PHASES.CHASE_NPC_REPORT]: "phaseChaseReport",
  [LIGHTS_PHASES.CHASE_PLAYER_REPORT]: "phaseChaseReply",
  [LIGHTS_PHASES.CHASE_FINAL]: "phaseChaseFinal",
  [LIGHTS_PHASES.CONTROL_CQ]: "phaseControlCq",
  [LIGHTS_PHASES.CONTROL_PILEUP]: "phasePileup",
  [LIGHTS_PHASES.CONTROL_SELECTION]: "phaseSelection",
  [LIGHTS_PHASES.CONTROL_CALLER_REPORT]: "phaseCallerReport",
  [LIGHTS_PHASES.CONTROL_PLAYER_REPORT]: "phasePlayerReport",
  [LIGHTS_PHASES.CONTROL_FINAL]: "phaseFinal",
  [LIGHTS_PHASES.RUN_COMPLETE]: "phaseComplete",
});

const PLAYBACK_PHASES = new Set([
  LIGHTS_PHASES.CHASE_CQ, LIGHTS_PHASES.CHASE_NPC_REPORT, LIGHTS_PHASES.CHASE_FINAL,
  LIGHTS_PHASES.CONTROL_PILEUP, LIGHTS_PHASES.CONTROL_CALLER_REPORT, LIGHTS_PHASES.CONTROL_FINAL,
]);
const TRANSMIT_PHASES = new Set([
  LIGHTS_PHASES.CHASE_PLAYER_CALL, LIGHTS_PHASES.CHASE_PLAYER_REPORT,
  LIGHTS_PHASES.CONTROL_CQ, LIGHTS_PHASES.CONTROL_SELECTION, LIGHTS_PHASES.CONTROL_PLAYER_REPORT,
]);
const CONTROL_PHASES = new Set([
  LIGHTS_PHASES.CONTROL_CQ, LIGHTS_PHASES.CONTROL_PILEUP, LIGHTS_PHASES.CONTROL_SELECTION,
  LIGHTS_PHASES.CONTROL_CALLER_REPORT, LIGHTS_PHASES.CONTROL_PLAYER_REPORT, LIGHTS_PHASES.CONTROL_FINAL,
]);

export function lightsTimerShouldRun({ phase, inputBlocked = false, windowActive = true } = {}) {
  return CONTROL_PHASES.has(phase) && inputBlocked !== true && windowActive !== false;
}

export function advanceLightsActiveClock(clock, monotonicNow) {
  const elapsedMs = Math.max(0, Number(clock?.elapsedMs) || 0);
  const now = Number(monotonicNow);
  const previousNow = Number(clock?.monotonicNow);
  const active = clock?.active === true;
  const elapsedDelta = active && Number.isFinite(now) && Number.isFinite(previousNow)
    ? Math.max(0, now - previousNow) : 0;
  return {
    elapsedMs: elapsedMs + elapsedDelta,
    monotonicNow: Number.isFinite(now) ? now : Number.isFinite(previousNow) ? previousNow : null,
    active,
  };
}

export function createActivityPlaybackLifecycle({
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  stopAll = () => {},
  stopListening = () => {},
} = {}) {
  let visible = true;
  let pending = null;
  let request = null;
  let audioControls = { stopAll, stopListening };

  function cancelPendingPlayback() {
    if (!pending) return;
    clearTimeoutFn(pending.timer);
    pending = null;
  }

  function schedulePendingPlayback() {
    if (!visible || !request || pending) return;
    const scheduledRequest = request;
    const token = {};
    const timer = setTimeoutFn(() => {
      if (!visible || pending?.token !== token || request !== scheduledRequest) return;
      pending = null;
      request = null;
      scheduledRequest.callback();
    }, scheduledRequest.delay);
    pending = { token, timer };
  }

  return {
    setAudioControls(controls = {}) {
      audioControls = {
        stopAll: typeof controls.stopAll === "function" ? controls.stopAll : () => {},
        stopListening: typeof controls.stopListening === "function" ? controls.stopListening : () => {},
      };
    },
    requestPlayback(delay, callback) {
      cancelPendingPlayback();
      request = typeof callback === "function" ? { delay: Math.max(0, Number(delay) || 0), callback } : null;
      schedulePendingPlayback();
    },
    cancelPendingPlayback,
    clearPlayback() {
      cancelPendingPlayback();
      request = null;
    },
    setVisible(nextVisible) {
      const next = nextVisible !== false;
      if (!next) {
        visible = false;
        cancelPendingPlayback();
        audioControls.stopAll();
        audioControls.stopListening();
        return false;
      }
      const resumed = !visible;
      visible = true;
      if (resumed) schedulePendingPlayback();
      return resumed;
    },
  };
}

export function activityPlaybackIsActive(documentTarget = globalThis.document) {
  return documentTarget?.visibilityState !== "hidden"
    && (typeof documentTarget?.hasFocus !== "function" || documentTarget.hasFocus());
}

export function registerActivityPlaybackVisibility({
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  lifecycle,
  onActiveChange = () => {},
} = {}) {
  const isActive = () => activityPlaybackIsActive(documentTarget);
  const applyActiveState = (active) => {
    lifecycle?.setVisible?.(active);
    onActiveChange(active);
  };
  const onBlur = () => applyActiveState(false);
  const onFocus = () => applyActiveState(isActive());
  const onVisibilityChange = () => applyActiveState(isActive());

  applyActiveState(isActive());
  windowTarget?.addEventListener?.("blur", onBlur);
  windowTarget?.addEventListener?.("focus", onFocus);
  documentTarget?.addEventListener?.("visibilitychange", onVisibilityChange);
  return () => {
    windowTarget?.removeEventListener?.("blur", onBlur);
    windowTarget?.removeEventListener?.("focus", onFocus);
    documentTarget?.removeEventListener?.("visibilitychange", onVisibilityChange);
  };
}

export function lightsExitNeedsConfirmation(run, { settled = false } = {}) {
  if (!run || settled) return false;
  if (run.phase === LIGHTS_PHASES.RUN_COMPLETE) return true;
  const initialPhase = run.mode === "story" ? LIGHTS_PHASES.CHASE_CQ : LIGHTS_PHASES.CONTROL_CQ;
  return Number(run.elapsedMs) > 0 || run.chaseCompleted === true || (run.contacts?.length ?? 0) > 0
    || run.phase !== initialPhase;
}

export function activityUnloadRisk({ activity, run, settled = false, risk } = {}) {
  if (activity === "lights" && lightsExitNeedsConfirmation(run, { settled })) {
    return run?.phase === LIGHTS_PHASES.RUN_COMPLETE ? "unsaved" : "active";
  }
  return activity === "qso" && ["active", "unsaved"].includes(risk) ? risk : "none";
}

export function lightsRunSeed({ saveId, mode, stationDate, startedAt } = {}) {
  const id = String(saveId ?? "save");
  if (mode === "story") return `${id}:story`;
  if (mode === "annual") return `${id}:annual:${Number(stationDate?.year) || 1970}`;
  const instant = new Date(startedAt);
  const suffix = Number.isFinite(instant.getTime()) ? instant.toISOString() : new Date(0).toISOString();
  return `${id}:practice:${String(stationDate?.dateKey ?? "1970-01-01")}:${suffix}`;
}

export function lightsAnnualStampLabel(settlement, language = "en") {
  const stamp = settlement?.annualStamp;
  if (stamp !== "standard" && stamp !== "special") return null;
  const t = lightsText(language);
  return stamp === "special" ? t.stampSpecial : t.stampStandard;
}

function timerText(elapsedMs) {
  const seconds = Math.ceil(Math.max(0, LIGHTS_RUN_DURATION_MS - Number(elapsedMs || 0)) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorKey(reason) {
  if (["wrongCallsign"].includes(reason)) return "errorWrongCallsign";
  if (reason === "wrongRegion") return "errorWrongRegion";
  if (reason === "invalidRst") return "errorInvalidRst";
  if (reason === "missingEventToken") return "errorMissingEventToken";
  if (reason === "missingCq") return "errorMissingCq";
  if (reason === "missingHandoff") return "errorMissingHandoff";
  if (reason === "partialAmbiguous") return "errorPartialAmbiguous";
  if (reason === "callsignMisidentified") return "errorCallsignMisidentified";
  if (reason === "partialNoMatch") return "errorPartialNoMatch";
  if (["unsafeSemanticCommit", "unsafeSemanticResult"].includes(reason)) return "errorUnsafe";
  return reason ? "errorGeneric" : null;
}

export function lightsUiModel(run, language = "en") {
  const t = lightsText(language);
  const pileup = currentLightsPileup(run);
  const result = lightsRunResult(run);
  const distinctRegions = new Set((run?.contacts ?? []).map(({ eventRegionCode }) => eventRegionCode)).size;
  const key = errorKey(run?.lastError);
  return {
    modeLabel: t[run?.mode] ?? t.story,
    instruction: t[INSTRUCTION_KEYS[run?.phase]] ?? t.phaseComplete,
    incomingText: currentLightsPrompt(run),
    callerHint: run?.guidance === "hints" && pileup?.callers?.length
      ? `${pileup.callers.length} ${t.caller}` : "",
    needsPlayback: PLAYBACK_PHASES.has(run?.phase),
    needsLayeredPlayback: run?.phase === LIGHTS_PHASES.CONTROL_PILEUP,
    canTransmit: TRANSMIT_PHASES.has(run?.phase),
    canSettle: Boolean(result),
    timerText: timerText(run?.elapsedMs),
    contacts: Math.min(LIGHTS_MAX_CONTACTS, run?.contacts?.length ?? 0),
    maxContacts: LIGHTS_MAX_CONTACTS,
    regions: distinctRegions,
    score: result?.score ?? 0,
    grade: result?.grade ?? "none",
    gradeLabel: t[`grade${String(result?.grade ?? "none").replace(/^./, (value) => value.toUpperCase())}`],
    errorText: key ? t[key] : "",
    result,
  };
}
