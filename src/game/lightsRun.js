import { normalizeCwText } from "../cw/morse.js";
import { LIGHTS_EVENT, LIGHTS_EVENT_REGIONS } from "./lightsEventCatalog.js";
import { parseLightsReport } from "./lightsExchange.js";
import { createLightsPileup, resolveLightsCallsignSelection } from "./lightsPileup.js";
import { scoreLightsResult } from "./lightsScoring.js";

export const LIGHTS_RUN_DURATION_MS = 8 * 60 * 1000;
export const LIGHTS_MAX_CONTACTS = 7;

export const LIGHTS_PHASES = Object.freeze({
  CHASE_CQ: "CHASE_CQ",
  CHASE_PLAYER_CALL: "CHASE_PLAYER_CALL",
  CHASE_NPC_REPORT: "CHASE_NPC_REPORT",
  CHASE_PLAYER_REPORT: "CHASE_PLAYER_REPORT",
  CHASE_FINAL: "CHASE_FINAL",
  CONTROL_CQ: "CONTROL_CQ",
  CONTROL_PILEUP: "CONTROL_PILEUP",
  CONTROL_SELECTION: "CONTROL_SELECTION",
  CONTROL_CALLER_REPORT: "CONTROL_CALLER_REPORT",
  CONTROL_PLAYER_REPORT: "CONTROL_PLAYER_REPORT",
  CONTROL_FINAL: "CONTROL_FINAL",
  RUN_COMPLETE: "RUN_COMPLETE",
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
  return new RegExp(`^${LIGHTS_EVENT.callsign}DE${playerCallsign}(?:PSE)?K(?:N)?$`).test(compact);
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
    elapsedMs: 0,
    round: 0,
    pileup: null,
    playbackCallers: Object.freeze([]),
    selectedCaller: null,
    pendingContact: null,
    contacts: Object.freeze([]),
    resolvedPileupCount: 0,
    successfulPartialCount: 0,
    misidentificationCount: 0,
    agnRequestCount: 0,
  };
}

export function currentLightsPrompt(run) {
  if (run?.phase === LIGHTS_PHASES.CHASE_CQ) return `CQ ${LIGHTS_EVENT.token} CQ ${LIGHTS_EVENT.token} DE ${LIGHTS_EVENT.callsign} K`;
  if (run?.phase === LIGHTS_PHASES.CHASE_NPC_REPORT) {
    return `${run.playerCallsign} DE ${LIGHTS_EVENT.callsign} RST ${run.chase.rst} ${run.chase.region} K`;
  }
  if (run?.phase === LIGHTS_PHASES.CHASE_FINAL) return `${run.playerCallsign} DE ${LIGHTS_EVENT.callsign} TU 73 SK`;
  if (run?.phase === LIGHTS_PHASES.CONTROL_CALLER_REPORT && run.selectedCaller) {
    return `${LIGHTS_EVENT.callsign} DE ${run.selectedCaller.callsign} RST 599 ${run.selectedCaller.regionCode} K`;
  }
  if (run?.phase === LIGHTS_PHASES.CONTROL_FINAL && run.selectedCaller) {
    return `${LIGHTS_EVENT.callsign} DE ${run.selectedCaller.callsign} TU 73 SK`;
  }
  return null;
}

export function currentLightsPileup(run) {
  if (!run?.pileup) return null;
  if ([LIGHTS_PHASES.CONTROL_PILEUP, LIGHTS_PHASES.CONTROL_SELECTION].includes(run.phase)
    && Array.isArray(run.playbackCallers) && run.playbackCallers.length) {
    return run.playbackCallers === run.pileup.callers
      ? run.pileup : { ...run.pileup, callers: run.playbackCallers };
  }
  return run.pileup;
}

export function advanceLightsPlayback(run) {
  if (!run || typeof run !== "object") return run;
  if (run.phase === LIGHTS_PHASES.CHASE_CQ) return { ...run, phase: LIGHTS_PHASES.CHASE_PLAYER_CALL, lastError: null };
  if (run.phase === LIGHTS_PHASES.CHASE_NPC_REPORT) return { ...run, phase: LIGHTS_PHASES.CHASE_PLAYER_REPORT, lastError: null };
  if (run.phase === LIGHTS_PHASES.CHASE_FINAL) {
    return { ...run, phase: LIGHTS_PHASES.CONTROL_CQ, chaseCompleted: true, lastError: null };
  }
  if (run.phase === LIGHTS_PHASES.CONTROL_PILEUP) {
    return { ...run, phase: LIGHTS_PHASES.CONTROL_SELECTION, lastError: null };
  }
  if (run.phase === LIGHTS_PHASES.CONTROL_CALLER_REPORT) {
    return { ...run, phase: LIGHTS_PHASES.CONTROL_PLAYER_REPORT, lastError: null };
  }
  if (run.phase === LIGHTS_PHASES.CONTROL_FINAL) {
    const contacts = Object.freeze([...run.contacts, Object.freeze(run.pendingContact)]);
    const completed = contacts.length >= LIGHTS_MAX_CONTACTS;
    return {
      ...run,
      phase: completed ? LIGHTS_PHASES.RUN_COMPLETE : LIGHTS_PHASES.CONTROL_CQ,
      contacts,
      pileup: null,
      playbackCallers: Object.freeze([]),
      selectedCaller: null,
      pendingContact: null,
      lastError: null,
    };
  }
  return run;
}

function validEventCq(message) {
  const normalized = normalizeCwText(message);
  const compact = normalized.replace(/\s/g, "");
  if (!compact.includes("CQ")) return { valid: false, reason: "missingCq" };
  if (!compact.includes(LIGHTS_EVENT.token)) return { valid: false, reason: "missingEventToken" };
  if (!compact.includes(`DE${LIGHTS_EVENT.callsign}`)) return { valid: false, reason: "wrongCallsign" };
  if (!/(?:K|KN)$/.test(compact)) return { valid: false, reason: "missingHandoff" };
  return { valid: true, reason: null };
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
  if (run.phase === LIGHTS_PHASES.CONTROL_CQ) {
    const validation = validEventCq(message);
    if (!validation.valid) return { ...run, lastError: validation.reason };
    const round = run.round + 1;
    const pileup = createLightsPileup({
      seed: run.seed,
      worldSeed: run.seed,
      round,
      guidance: run.guidance,
    });
    return {
      ...run,
      phase: LIGHTS_PHASES.CONTROL_PILEUP,
      round,
      pileup,
      playbackCallers: pileup.callers,
      selectedCaller: null,
      pendingContact: null,
      lastError: null,
    };
  }
  if (run.phase === LIGHTS_PHASES.CONTROL_SELECTION) {
    const activePileup = currentLightsPileup(run);
    const resolution = resolveLightsCallsignSelection(activePileup, message);
    if (resolution.kind === "repeat") {
      return {
        ...run,
        phase: LIGHTS_PHASES.CONTROL_PILEUP,
        playbackCallers: run.pileup.callers,
        agnRequestCount: run.agnRequestCount + 1,
        lastError: null,
      };
    }
    if (resolution.kind === "ambiguous") {
      return {
        ...run,
        phase: LIGHTS_PHASES.CONTROL_PILEUP,
        playbackCallers: Object.freeze([...resolution.callers]),
        lastError: "partialAmbiguous",
      };
    }
    if (resolution.kind === "misidentified") {
      return {
        ...run,
        misidentificationCount: run.misidentificationCount + 1,
        lastError: "callsignMisidentified",
      };
    }
    if (resolution.kind !== "selected") return { ...run, lastError: "partialNoMatch" };
    return {
      ...run,
      phase: LIGHTS_PHASES.CONTROL_CALLER_REPORT,
      selectedCaller: resolution.selected,
      successfulPartialCount: run.successfulPartialCount + Number(resolution.partial),
      resolvedPileupCount: run.resolvedPileupCount + Number(run.pileup.callers.length >= 2),
      lastError: null,
    };
  }
  if (run.phase === LIGHTS_PHASES.CONTROL_PLAYER_REPORT) {
    const parsed = parseLightsReport(message, {
      selfCallsign: LIGHTS_EVENT.callsign,
      peerCallsign: run.selectedCaller?.callsign,
      expectedRegion: run.playerRegion,
      semanticResult,
    });
    if (!parsed.accepted) return { ...run, lastError: parsed.reason };
    return {
      ...run,
      phase: LIGHTS_PHASES.CONTROL_FINAL,
      pendingContact: {
        id: `${run.runId}:${run.round}:${run.selectedCaller.callsign}`,
        callsign: run.selectedCaller.callsign,
        eventRegionCode: run.selectedCaller.regionCode,
        locationId: run.selectedCaller.locationId,
        operatorName: run.selectedCaller.operatorName,
        operatorProfileId: run.selectedCaller.operatorProfileId,
        remoteRst: "599",
        sentRst: parsed.rst,
        onAirCallsign: LIGHTS_EVENT.callsign,
        operatorCallsign: run.playerCallsign,
      },
      lastError: null,
    };
  }
  return { ...run, lastError: "notWaitingForPlayer" };
}

export function tickLightsRun(run, elapsedMs) {
  const delta = Number(elapsedMs);
  if (!run || typeof run !== "object" || !Number.isFinite(delta) || delta <= 0
    || run.phase === LIGHTS_PHASES.RUN_COMPLETE) return run;
  const elapsed = Math.min(LIGHTS_RUN_DURATION_MS, run.elapsedMs + delta);
  return {
    ...run,
    elapsedMs: elapsed,
    phase: elapsed >= LIGHTS_RUN_DURATION_MS ? LIGHTS_PHASES.RUN_COMPLETE : run.phase,
  };
}

export function lightsRunResult(run) {
  if (run?.phase !== LIGHTS_PHASES.RUN_COMPLETE) return null;
  const distinctRegionCount = new Set(run.contacts.map(({ eventRegionCode }) => eventRegionCode)).size;
  const facts = {
    validQsoCount: run.contacts.length,
    distinctRegionCount,
    resolvedPileupCount: run.resolvedPileupCount,
    successfulPartialCount: run.successfulPartialCount,
    misidentificationCount: run.misidentificationCount,
    agnRequestCount: run.agnRequestCount,
  };
  const scored = scoreLightsResult(facts);
  const completedAt = new Date(Date.parse(run.startedAt) + run.elapsedMs).toISOString();
  return {
    version: 1,
    runId: run.runId,
    mode: run.mode,
    startedAt: run.startedAt,
    completedAt,
    playerCallsign: run.playerCallsign,
    playerRegion: run.playerRegion,
    chaseCompleted: run.chaseCompleted,
    contacts: run.contacts.map((contact) => ({ ...contact })),
    ...facts,
    ...scored,
  };
}
