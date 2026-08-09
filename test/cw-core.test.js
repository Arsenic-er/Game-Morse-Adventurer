import test from "node:test";
import assert from "node:assert/strict";
import {
  CLEAR_INPUT_GESTURE_LENGTH, analyzeKeying, detectClearInputGesture, estimateDotDuration, scoreDecodedText,
} from "../src/cw/inputAnalyzer.js";
import { automaticSymbolDuration, dotDurationFromWpm, encodeTextToEvents, normalizeCwText, pulsesToPlaybackEvents } from "../src/cw/morse.js";
import { tailPreview } from "../src/cw/display.js";

function pulsesFromText(text, dotMs = 60, startAt = 0) {
  const sequence = encodeTextToEvents(text, { wpm: 1200 / dotMs });
  const pulses = [];
  let cursor = startAt;
  sequence.events.forEach((event) => {
    if (event.type === "tone") pulses.push({ downAt: cursor, upAt: cursor + event.durationMs });
    cursor += event.durationMs;
  });
  return pulses;
}

test("normalizes supported CW text", () => {
  assert.equal(normalizeCwText(" cq  de sim-k7qx! "), "CQ DE SIM-K7QX");
});

test("encodes standard Morse timing deterministically", () => {
  const first = encodeTextToEvents("SOS", { wpm: 20 });
  const second = encodeTextToEvents("SOS", { wpm: 20 });
  assert.equal(first.morse, "... --- ...");
  assert.equal(first.dotMs, 60);
  assert.equal(first.durationMs, 27 * 60);
  assert.deepEqual(first.events, second.events);
});

test("uses PARIS dot timing", () => {
  assert.equal(dotDurationFromWpm(20), 60);
  assert.equal(dotDurationFromWpm(10), 120);
});

test("automatic dash is exactly three times the dot duration", () => {
  const dot = automaticSymbolDuration(".", 18);
  const dash = automaticSymbolDuration("-", 18);
  assert.equal(dash, dot * 3);
  assert.throws(() => automaticSymbolDuration("?", 18));
});

test("long decoded text uses a bounded tail preview", () => {
  assert.equal(tailPreview("ABCDEFGHIJ", 6), "…FGHIJ");
  assert.equal(tailPreview("CQ", 6), "CQ");
  assert.equal(tailPreview("", 6), "...");
});

test("decodes keyed CQ and estimates speed", () => {
  const pulses = pulsesFromText("CQ", 60);
  const result = analyzeKeying(pulses, { fallbackWpm: 18, targetText: "CQ" });
  assert.equal(result.decoded, "CQ");
  assert.equal(result.wpm, 20);
  assert.equal(result.accuracy, 100);
  assert.ok(result.rhythm >= 99);
});

test("recognizes all-dash timing from the fallback speed", () => {
  const pulses = pulsesFromText("O", 75);
  assert.equal(Math.round(estimateDotDuration(pulses, 16)), 75);
  assert.equal(analyzeKeying(pulses, { fallbackWpm: 16 }).decoded, "O");
});

test("scores text using edit distance", () => {
  assert.equal(scoreDecodedText("CQ", "CQ"), 100);
  assert.equal(scoreDecodedText("C", "CQ"), 50);
  assert.equal(scoreDecodedText("", "CQ"), 0);
});

test("replay events preserve captured pulse durations and gaps", () => {
  const pulses = [{ downAt: 100, upAt: 160 }, { downAt: 220, upAt: 400 }];
  assert.deepEqual(pulsesToPlaybackEvents(pulses).map(({ type, durationMs }) => ({ type, durationMs })), [
    { type: "tone", durationMs: 60 },
    { type: "silence", durationMs: 60 },
    { type: "tone", durationMs: 180 },
  ]);
});

function repeatedElementPulses(symbol, count, dotMs = 60, startAt = 0) {
  const durationMs = symbol === "." ? dotMs : dotMs * 3;
  return Array.from({ length: count }, (_, index) => {
    const downAt = startAt + index * (durationMs + dotMs);
    return { downAt, upAt: downAt + durationMs, symbol, source: "automatic" };
  });
}

test("clear gesture activates only after seven continuous identical elements", () => {
  const sixDots = repeatedElementPulses(".", CLEAR_INPUT_GESTURE_LENGTH - 1);
  const sevenDots = repeatedElementPulses(".", CLEAR_INPUT_GESTURE_LENGTH);
  assert.equal(detectClearInputGesture(sixDots, { fallbackWpm: 20 }), null);
  assert.deepEqual(detectClearInputGesture(sevenDots, { fallbackWpm: 20 }), { symbol: ".", count: 7 });

  const sevenDashes = repeatedElementPulses("-", CLEAR_INPUT_GESTURE_LENGTH);
  assert.deepEqual(detectClearInputGesture(sevenDashes, { fallbackWpm: 20 }), { symbol: "-", count: 7 });
});

test("clear gesture resets across a changed element or character-length gap", () => {
  const mixed = [
    ...repeatedElementPulses(".", 6),
    { downAt: 720, upAt: 900, symbol: "-", source: "automatic" },
  ];
  assert.equal(detectClearInputGesture(mixed, { fallbackWpm: 20 }), null);

  const separated = repeatedElementPulses(".", 7);
  separated[6] = { ...separated[6], downAt: separated[5].upAt + 180, upAt: separated[5].upAt + 240 };
  assert.equal(detectClearInputGesture(separated, { fallbackWpm: 20 }), null);
});
