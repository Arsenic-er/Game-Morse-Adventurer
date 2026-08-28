import assert from "node:assert/strict";
import test from "node:test";

import { analyzeKeying } from "../src/cw/inputAnalyzer.js";
import { encodeTextToEvents } from "../src/cw/morse.js";
import { appendCwInputPulse } from "../src/cw/useCwCore.js";

function pulsesFor(text, wpm = 18) {
  let at = 0;
  const pulses = [];
  for (const event of encodeTextToEvents(text, { wpm }).events) {
    if (event.type === "tone") pulses.push({ downAt: at, upAt: at + event.durationMs, source: "automatic" });
    at += event.durationMs;
  }
  return pulses;
}

test("CW input retains a complete canonical Chapter 9 packet beyond 160 pulses", () => {
  const message = "MSG 856 GRID PX 9835 8510 TIME 0249Z PEOPLE 55 CHECK 10";
  const pulses = pulsesFor(message);
  assert.equal(pulses.length, 165);
  const retained = pulses.reduce((current, pulse) => appendCwInputPulse(current, pulse), []);
  const analysis = analyzeKeying(retained, { fallbackWpm: 18, targetText: message });
  assert.equal(analysis.pulseCount, 165);
  assert.equal(analysis.decoded, message);
});

test("CW input pulse retention stays bounded under hostile repeated input", () => {
  const pulses = Array.from({ length: 1_000 }, (_, index) => ({ downAt: index * 100, upAt: index * 100 + 50, source: "automatic" }));
  const retained = pulses.reduce((current, pulse) => appendCwInputPulse(current, pulse), []);
  assert.equal(retained.length, 256);
  assert.equal(retained[0], pulses[744]);
  assert.equal(retained.at(-1), pulses.at(-1));
});
