import test from "node:test";
import assert from "node:assert/strict";
import { receiverNoiseFilterForChannel, receiverSignalProfileForChannel } from "../src/cw/audioEngine.js";

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

test("receiver signal envelope converts QSB depth into carrier and audible swing", () => {
  const clear = receiverSignalProfileForChannel({ signalGain: 1, qsbDepth: .08 });
  const faded = receiverSignalProfileForChannel({ signalGain: .3, qsbDepth: .85 });
  assert.ok(clear.carrierGain > faded.carrierGain);
  assert.ok(faded.qsbSwing > 0);
  assert.equal(clear.carrierGain + clear.qsbSwing, clear.signalGain);
  assert.equal(faded.carrierGain + faded.qsbSwing, faded.signalGain);
  assert.deepEqual(receiverSignalProfileForChannel({ signalGain: -3, qsbDepth: 4 }), {
    signalGain: 0,
    qsbDepth: .95,
    carrierGain: 0,
    qsbSwing: 0,
  });
});
