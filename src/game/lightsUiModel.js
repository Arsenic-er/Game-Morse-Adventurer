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
    callerHint: pileup?.callers?.length ? `${pileup.callers.length} ${t.caller}` : "",
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
