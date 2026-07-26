import test from "node:test";
import assert from "node:assert/strict";
import { receiverNoiseFilterForChannel } from "../src/cw/audioEngine.js";

test("receiver noise uses the legacy wide filter when no accessory is configured", () => {
  assert.deepEqual(receiverNoiseFilterForChannel({}), { centerHz: 1150, q: 0.35 });
  assert.deepEqual(receiverNoiseFilterForChannel({
    noiseFilterCenterHz: null,
    noiseFilterQ: null,
  }), { centerHz: 1150, q: 0.35 });
  assert.deepEqual(receiverNoiseFilterForChannel({
    noiseFilterCenterHz: "650",
    noiseFilterQ: "1.3",
  }), { centerHz: 1150, q: 0.35 });
});

test("the CW-500 profile centers a 500 Hz passband on the fixed tone", () => {
  assert.deepEqual(receiverNoiseFilterForChannel({
    noiseFilterCenterHz: 650,
    noiseFilterQ: 1.3,
  }), { centerHz: 650, q: 1.3 });
});

test("receiver filter parameters clamp unsafe values", () => {
  assert.deepEqual(receiverNoiseFilterForChannel({
    noiseFilterCenterHz: 9000,
    noiseFilterQ: 0,
  }), { centerHz: 4000, q: 0.1 });
});
