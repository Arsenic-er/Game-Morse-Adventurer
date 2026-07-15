import { normalizeCwText } from "../cw/morse.js";

export const PRACTICE_MODES = Object.freeze({
  CHARACTER_RX: "character-rx",
  CALLSIGN_RX: "callsign-rx",
  MANUAL_TX: "manual-tx",
  PADDLE_TX: "paddle-tx",
});

export const CHARACTER_POOL = Object.freeze(["A", "N", "T", "E", "I", "M", "S", "O", "R", "K", "D", "U", "G", "W", "Q", "7", "3", "5"]);
export const FICTIONAL_CALLSIGNS = Object.freeze(["SIM7QX", "SIM3RA", "SIM9AK", "SIM5TU", "SIM2DX", "SIM8CW", "SIM4NZ", "SIM6JP"]);

export function emptyPracticeStats() {
  return { attempts: 0, correct: 0, accuracy: 0, rhythmTotal: 0, rhythmSamples: 0, averageRhythm: 0, weaknesses: {} };
}

export function isReceptionMode(mode) {
  return mode === PRACTICE_MODES.CHARACTER_RX || mode === PRACTICE_MODES.CALLSIGN_RX;
}

export function isSendingMode(mode) {
  return mode === PRACTICE_MODES.MANUAL_TX || mode === PRACTICE_MODES.PADDLE_TX;
}

function weakestCharacter(weaknesses) {
  return Object.entries(weaknesses ?? {}).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

export function practiceTargetFor(mode, index = 0, weaknesses = {}) {
  const safeIndex = Math.max(0, Number(index) || 0);
  if (mode === PRACTICE_MODES.CALLSIGN_RX) return FICTIONAL_CALLSIGNS[safeIndex % FICTIONAL_CALLSIGNS.length];
  if (mode === PRACTICE_MODES.MANUAL_TX && safeIndex % 3 === 2) return "SIM7QX";
  if (mode === PRACTICE_MODES.PADDLE_TX && safeIndex % 4 === 3) return "SIM3RA";
  const weak = weakestCharacter(weaknesses);
  if (weak && safeIndex > 0 && safeIndex % 3 === 0 && CHARACTER_POOL.includes(weak)) return weak;
  return CHARACTER_POOL[safeIndex % CHARACTER_POOL.length];
}

export function evaluateReception(answer, target) {
  const normalizedAnswer = normalizeCwText(answer).replace(/\s/g, "");
  const normalizedTarget = normalizeCwText(target).replace(/\s/g, "");
  const correct = normalizedAnswer === normalizedTarget;
  const missed = [];
  if (!correct) {
    [...normalizedTarget].forEach((character, index) => {
      if (normalizedAnswer[index] !== character) missed.push(character);
    });
  }
  return { answer: normalizedAnswer, target: normalizedTarget, correct, accuracy: correct ? 100 : 0, rhythm: null, missed };
}

export function evaluateSending(analysis, target) {
  const normalizedTarget = normalizeCwText(target).replace(/\s/g, "");
  const normalizedDecoded = normalizeCwText(analysis?.decoded).replace(/\s/g, "");
  const correct = normalizedDecoded === normalizedTarget;
  const missed = correct ? [] : [...normalizedTarget].filter((character, index) => normalizedDecoded[index] !== character);
  return {
    answer: normalizedDecoded,
    target: normalizedTarget,
    correct,
    accuracy: Number(analysis?.accuracy) || 0,
    rhythm: Number(analysis?.rhythm) || 0,
    missed,
  };
}

export function updatePracticeStats(stats, result) {
  const current = stats ?? emptyPracticeStats();
  const attempts = current.attempts + 1;
  const correct = current.correct + (result.correct ? 1 : 0);
  const weaknesses = { ...current.weaknesses };
  result.missed.forEach((character) => { weaknesses[character] = (weaknesses[character] ?? 0) + 1; });
  const hasRhythm = Number.isFinite(result.rhythm);
  const rhythmTotal = current.rhythmTotal + (hasRhythm ? result.rhythm : 0);
  const rhythmSamples = current.rhythmSamples + (hasRhythm ? 1 : 0);
  return {
    attempts,
    correct,
    accuracy: Math.round((correct / attempts) * 100),
    rhythmTotal,
    rhythmSamples,
    averageRhythm: rhythmSamples ? Math.round(rhythmTotal / rhythmSamples) : 0,
    weaknesses,
  };
}

