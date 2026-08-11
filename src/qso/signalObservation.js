import { clamp, normalizeCwText } from "../cw/morse.js";

export const SIGNAL_OBSERVATION_SCHEMA_VERSION = 1;

function metric(value, fallback = null, maximum = 100) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(clamp(numeric, 0, maximum).toFixed(1)) : fallback;
}

export function observePlayerSignal({
  message,
  wpm = null,
  accuracy = null,
  rhythm = null,
  semanticResult = null,
} = {}) {
  const normalized = normalizeCwText(message).slice(0, 160);
  return Object.freeze({
    schemaVersion: SIGNAL_OBSERVATION_SCHEMA_VERSION,
    transcript: Object.freeze({
      normalized,
      characterCount: normalized.replace(/\s/g, "").length,
      decoderAccuracy: metric(accuracy),
    }),
    timing: Object.freeze({
      wpm: metric(wpm, null, 120),
      rhythmScore: metric(rhythm),
    }),
    semantic: Object.freeze({
      schemaVersion: semanticResult?.schemaVersion ?? null,
      provider: semanticResult?.provider ?? null,
      interpretability: metric(semanticResult?.interpretability),
      safeToCommit: semanticResult?.safeToCommit === true,
    }),
  });
}

export function signalObservationFromCqAssessment(assessment = {}) {
  return observePlayerSignal({
    message: assessment.normalized,
    wpm: assessment.wpm,
    accuracy: assessment.editScore,
    rhythm: assessment.rhythmScore,
    semanticResult: {
      schemaVersion: null,
      provider: "legacy-cq-assessment",
      interpretability: assessment.semanticQuality ?? assessment.quality,
      safeToCommit: assessment.recognizable === true,
    },
  });
}
