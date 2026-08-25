import { normalizeCwText } from "../cw/morse.js";
import { LIGHTS_EVENT, LIGHTS_EVENT_REGIONS } from "./lightsEventCatalog.js";
import { parseLightsReport } from "./lightsExchange.js";

export const LIGHTS_PHASES = Object.freeze({
  CHASE_CQ: "CHASE_CQ",
  CHASE_PLAYER_CALL: "CHASE_PLAYER_CALL",
  CHASE_NPC_REPORT: "CHASE_NPC_REPORT",
  CHASE_PLAYER_REPORT: "CHASE_PLAYER_REPORT",
  CHASE_FINAL: "CHASE_FINAL",
  CONTROL_CQ: "CONTROL_CQ",
});

const RUN_MODES = new Set(["story", "annual", "practice"]);
const GUIDANCE_LEVELS = new Set(["full", "hints", "off"]);

function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function recoveryAction(message) {
  const normalized = normalizeCwText(message);
  if (/^(AGN|QRZ) K$/.test(normalized)) return "repeat";
  if (/^(QRS K|QRS PSE K|PSE QRS K)$/.test(normalized)) return "slower";
  return null;
}

function validChaseCall(message, playerCallsign) {
  const compact = normalizeCwText(message).replace(/\s/g, "");
  return compact === `${LIGHTS_EVENT.callsign}DE${playerCallsign}K`
    || compact === `${LIGHTS_EVENT.callsign}DE${playerCallsign}KN`;
}

export function createLightsRun({
  mode = "story", playerCallsign, playerRegion, guidance = "full", seed = "lights",
  startedAt = new Date(),
} = {}) {
  const normalizedMode = RUN_MODES.has(mode) ? mode : "story";
  const callsign = normalizeCwText(playerCallsign).replace(/\s/g, "").slice(0, 7);
  const region = String(playerRegion ?? "").trim().toUpperCase();
  if (!callsign) throw new Error("PLAYER_CALLSIGN_REQUIRED");
  if (!LIGHTS_EVENT_REGIONS.includes(region)) throw new Error("PLAYER_REGION_REQUIRED");
  const started = iso(startedAt);
  return {
    version: 1,
    runId: `${normalizedMode}:${String(seed)}:${started}`,
    mode: normalizedMode,
    seed: String(seed),
    startedAt: started,
    playerCallsign: callsign,
    playerRegion: region,
    guidance: GUIDANCE_LEVELS.has(guidance) ? guidance : "full",
    phase: normalizedMode === "story" ? LIGHTS_PHASES.CHASE_CQ : LIGHTS_PHASES.CONTROL_CQ,
    chaseCompleted: false,
    chaseWpm: 18,
    chase: Object.freeze({
      callsign: LIGHTS_EVENT.callsign,
      region: "JP",
      rst: "599",
      operatorName: "SORA",
      channelSeed: `${String(seed)}:sora`,
    }),
    lastError: null,
    recoveryRequests: 0,
  };
}

export function currentLightsPrompt(run) {
  if (run?.phase === LIGHTS_PHASES.CHASE_CQ) return `CQ ${LIGHTS_EVENT.token} CQ ${LIGHTS_EVENT.token} DE ${LIGHTS_EVENT.callsign} K`;
  if (run?.phase === LIGHTS_PHASES.CHASE_NPC_REPORT) {
    return `${run.playerCallsign} DE ${LIGHTS_EVENT.callsign} RST ${run.chase.rst} ${run.chase.region} K`;
  }
  if (run?.phase === LIGHTS_PHASES.CHASE_FINAL) return `${run.playerCallsign} DE ${LIGHTS_EVENT.callsign} TU 73 SK`;
  return null;
}

export function advanceLightsPlayback(run) {
  if (!run || typeof run !== "object") return run;
  if (run.phase === LIGHTS_PHASES.CHASE_CQ) return { ...run, phase: LIGHTS_PHASES.CHASE_PLAYER_CALL, lastError: null };
  if (run.phase === LIGHTS_PHASES.CHASE_NPC_REPORT) return { ...run, phase: LIGHTS_PHASES.CHASE_PLAYER_REPORT, lastError: null };
  if (run.phase === LIGHTS_PHASES.CHASE_FINAL) {
    return { ...run, phase: LIGHTS_PHASES.CONTROL_CQ, chaseCompleted: true, lastError: null };
  }
  return run;
}

export function submitLightsTransmission(run, message, { semanticResult = null } = {}) {
  if (!run || typeof run !== "object") return run;
  const recovery = recoveryAction(message);
  if ([LIGHTS_PHASES.CHASE_PLAYER_CALL, LIGHTS_PHASES.CHASE_PLAYER_REPORT].includes(run.phase) && recovery) {
    return {
      ...run,
      phase: run.phase === LIGHTS_PHASES.CHASE_PLAYER_CALL
        ? LIGHTS_PHASES.CHASE_CQ : LIGHTS_PHASES.CHASE_NPC_REPORT,
      chaseWpm: recovery === "slower" ? Math.max(5, run.chaseWpm - 3) : run.chaseWpm,
      recoveryRequests: run.recoveryRequests + 1,
      lastError: null,
    };
  }
  if (run.phase === LIGHTS_PHASES.CHASE_PLAYER_CALL) {
    if (!validChaseCall(message, run.playerCallsign)) return { ...run, lastError: "wrongCallsign" };
    return { ...run, phase: LIGHTS_PHASES.CHASE_NPC_REPORT, lastError: null };
  }
  if (run.phase === LIGHTS_PHASES.CHASE_PLAYER_REPORT) {
    const parsed = parseLightsReport(message, {
      selfCallsign: run.playerCallsign,
      peerCallsign: LIGHTS_EVENT.callsign,
      expectedRegion: run.playerRegion,
      semanticResult,
    });
    if (!parsed.accepted) return { ...run, lastError: parsed.reason };
    return {
      ...run,
      phase: LIGHTS_PHASES.CHASE_FINAL,
      chase: Object.freeze({ ...run.chase, playerRst: parsed.rst, playerRegion: parsed.region }),
      lastError: null,
    };
  }
  return { ...run, lastError: "notWaitingForPlayer" };
}
