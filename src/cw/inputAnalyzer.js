import { MORSE_DECODE, clamp, normalizeCwText } from "./morse.js";

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function editDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let row = 0; row <= left.length; row += 1) rows[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      );
    }
  }
  return rows[left.length][right.length];
}

export function estimateDotDuration(pulses, fallbackWpm = 18) {
  const fallbackDot = 1200 / clamp(Number(fallbackWpm) || 18, 5, 60);
  const durations = (pulses ?? [])
    .map((pulse) => pulse.upAt - pulse.downAt)
    .filter((duration) => Number.isFinite(duration) && duration >= 15 && duration <= 1500)
    .sort((left, right) => left - right);
  if (!durations.length) return fallbackDot;

  let splitIndex = -1;
  let largestRatio = 1;
  for (let index = 0; index < durations.length - 1; index += 1) {
    const ratio = durations[index + 1] / Math.max(1, durations[index]);
    if (ratio > largestRatio) {
      largestRatio = ratio;
      splitIndex = index;
    }
  }

  let estimate;
  if (largestRatio >= 1.7 && splitIndex >= 0) {
    estimate = median(durations.slice(0, splitIndex + 1));
  } else {
    const center = median(durations);
    estimate = center > fallbackDot * 1.8 ? center / 3 : center;
  }
  return clamp(estimate, 20, 240);
}

export function scoreDecodedText(decoded, target) {
  const normalizedDecoded = normalizeCwText(decoded).replace(/\s/g, "");
  const normalizedTarget = normalizeCwText(target).replace(/\s/g, "");
  if (!normalizedTarget.length) return normalizedDecoded.length ? 100 : 0;
  const distance = editDistance(normalizedDecoded, normalizedTarget);
  return Math.round(100 * (1 - Math.min(1, distance / Math.max(normalizedDecoded.length, normalizedTarget.length))));
}

export function analyzeKeying(pulses, { fallbackWpm = 18, targetText = "" } = {}) {
  const ordered = [...(pulses ?? [])]
    .filter((pulse) => Number.isFinite(pulse.downAt) && Number.isFinite(pulse.upAt) && pulse.upAt > pulse.downAt)
    .sort((left, right) => left.downAt - right.downAt);
  if (!ordered.length) {
    return { decoded: "", morse: "", wpm: Math.round(fallbackWpm), dotMs: 1200 / fallbackWpm, accuracy: 0, rhythm: 0, pulseCount: 0 };
  }

  const dotMs = estimateDotDuration(ordered, fallbackWpm);
  const decoded = [];
  const morseWords = [];
  let pattern = "";
  let currentWord = [];
  const errors = [];

  function finishCharacter() {
    if (!pattern) return;
    currentWord.push(MORSE_DECODE[pattern] ?? "?");
    pattern = "";
  }

  function finishWord() {
    finishCharacter();
    if (!currentWord.length) return;
    decoded.push(currentWord.join(""));
    morseWords.push(currentWord);
    currentWord = [];
  }

  ordered.forEach((pulse, index) => {
    if (index > 0) {
      const gap = Math.max(0, pulse.downAt - ordered[index - 1].upAt);
      let expectedGap = dotMs;
      if (gap >= 5.5 * dotMs) {
        expectedGap = 7 * dotMs;
        finishWord();
      } else if (gap >= 2.2 * dotMs) {
        expectedGap = 3 * dotMs;
        finishCharacter();
      }
      errors.push(Math.min(1, Math.abs(gap - expectedGap) / Math.max(expectedGap, 1)));
    }
    const duration = pulse.upAt - pulse.downAt;
    const symbol = duration < 2 * dotMs ? "." : "-";
    pattern += symbol;
    const expectedDuration = symbol === "." ? dotMs : 3 * dotMs;
    errors.push(Math.min(1, Math.abs(duration - expectedDuration) / Math.max(expectedDuration, 1)));
  });
  finishWord();

  const decodedText = decoded.join(" ");
  return {
    decoded: decodedText,
    morse: ordered.map((pulse) => (pulse.upAt - pulse.downAt < 2 * dotMs ? "." : "-")).join(""),
    wpm: Math.round(clamp(1200 / dotMs, 5, 60)),
    dotMs,
    accuracy: scoreDecodedText(decodedText, targetText),
    rhythm: Math.round(100 * (1 - (errors.length ? errors.reduce((total, error) => total + error, 0) / errors.length : 1))),
    pulseCount: ordered.length,
  };
}

