export const MORSE_CODE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
  "/": "-..-.", "-": "-....-", ".": ".-.-.-", ",": "--..--", "?": "..--..",
});

export const MORSE_DECODE = Object.freeze(
  Object.fromEntries(Object.entries(MORSE_CODE).map(([character, pattern]) => [pattern, character])),
);

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeCwText(text) {
  return String(text ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9/.,?\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dotDurationFromWpm(wpm = 18) {
  return 1200 / clamp(Number(wpm) || 18, 5, 60);
}

export function automaticSymbolDuration(symbol, wpm = 18) {
  if (!['.', '-'].includes(symbol)) throw new Error(`Unsupported automatic-key symbol: ${symbol}`);
  const dotMs = dotDurationFromWpm(wpm);
  return symbol === '.' ? dotMs : dotMs * 3;
}

export function encodeTextToEvents(text, { wpm = 18 } = {}) {
  const normalized = normalizeCwText(text);
  const dotMs = dotDurationFromWpm(wpm);
  const events = [];
  const words = normalized.split(" ").filter(Boolean);

  words.forEach((word, wordIndex) => {
    const characters = [...word].filter((character) => MORSE_CODE[character]);
    characters.forEach((character, characterIndex) => {
      const pattern = MORSE_CODE[character];
      [...pattern].forEach((symbol, symbolIndex) => {
        const units = symbol === "." ? 1 : 3;
        events.push({ type: "tone", units, durationMs: units * dotMs, symbol, character });
        if (symbolIndex < pattern.length - 1) {
          events.push({ type: "silence", units: 1, durationMs: dotMs, gap: "element" });
        }
      });
      if (characterIndex < characters.length - 1) {
        events.push({ type: "silence", units: 3, durationMs: 3 * dotMs, gap: "character" });
      }
    });
    if (wordIndex < words.length - 1) {
      events.push({ type: "silence", units: 7, durationMs: 7 * dotMs, gap: "word" });
    }
  });

  return {
    text: normalized,
    morse: words.map((word) => [...word].map((character) => MORSE_CODE[character]).filter(Boolean).join(" ")).join(" / "),
    wpm: Math.round(1200 / dotMs),
    dotMs,
    events,
    durationMs: events.reduce((total, event) => total + event.durationMs, 0),
  };
}

export function pulsesToPlaybackEvents(pulses) {
  const ordered = [...(pulses ?? [])]
    .filter((pulse) => Number.isFinite(pulse.downAt) && Number.isFinite(pulse.upAt) && pulse.upAt > pulse.downAt)
    .sort((left, right) => left.downAt - right.downAt);
  const events = [];

  ordered.forEach((pulse, index) => {
    if (index > 0) {
      const gapMs = Math.max(0, pulse.downAt - ordered[index - 1].upAt);
      if (gapMs > 0) events.push({ type: "silence", durationMs: gapMs, units: 0, gap: "recorded" });
    }
    events.push({ type: "tone", durationMs: pulse.upAt - pulse.downAt, units: 0, symbol: pulse.symbol });
  });
  return events;
}
