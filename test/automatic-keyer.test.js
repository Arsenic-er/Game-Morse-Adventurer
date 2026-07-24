import test from "node:test";
import assert from "node:assert/strict";
import { AutomaticKeyer, normalizeAutomaticKeyWpm } from "../src/cw/automaticKeyer.js";

function fakeClock() {
  let currentTime = 0;
  let nextId = 1;
  const tasks = new Map();
  return {
    now: () => currentTime,
    setTimer(callback, delay) {
      const id = nextId++;
      tasks.set(id, { callback, due: currentTime + delay });
      return id;
    },
    clearTimer(id) {
      tasks.delete(id);
    },
    tick(milliseconds) {
      const end = currentTime + milliseconds;
      while (true) {
        const next = [...tasks.entries()].sort((left, right) => left[1].due - right[1].due)[0];
        if (!next || next[1].due > end) break;
        currentTime = next[1].due;
        tasks.delete(next[0]);
        next[1].callback();
      }
      currentTime = end;
    },
    pending: () => tasks.size,
  };
}

function keyerFixture(wpm = 20) {
  const clock = fakeClock();
  const pulses = [];
  const sessions = [];
  const starts = [];
  const keyer = new AutomaticKeyer({
    getWpm: () => wpm,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onPulse: (pulse) => pulses.push(pulse),
    onElementStart: (element) => starts.push(element),
    onSessionChange: (active) => sessions.push(active),
  });
  return { clock, keyer, pulses, sessions, starts, setWpm: (value) => { wpm = value; } };
}

test("automatic keyer speed clamps to the player range", () => {
  assert.equal(normalizeAutomaticKeyWpm(1), 5);
  assert.equal(normalizeAutomaticKeyWpm(18.4), 18);
  assert.equal(normalizeAutomaticKeyWpm(99), 40);
  assert.equal(normalizeAutomaticKeyWpm("bad"), 18);
});

test("holding a paddle repeats internally and releasing completes the active element", () => {
  const fixture = keyerFixture(20);
  assert.equal(fixture.keyer.begin("."), true);
  assert.equal(fixture.keyer.begin("."), true);
  fixture.clock.tick(180);
  assert.equal(fixture.pulses.length, 2);
  assert.deepEqual(fixture.pulses.map((pulse) => [pulse.downAt, pulse.upAt]), [[0, 60], [120, 180]]);

  fixture.keyer.end(".");
  fixture.clock.tick(60);
  assert.equal(fixture.pulses.length, 2);
  assert.equal(fixture.keyer.isBusy(), false);
  assert.deepEqual(fixture.sessions, [true, false]);
});

test("a held dash uses three dot units plus one-dot repeat spacing", () => {
  const fixture = keyerFixture(20);
  fixture.keyer.begin("-");
  fixture.clock.tick(180);
  assert.equal(fixture.pulses.length, 1);
  assert.equal(fixture.pulses[0].upAt - fixture.pulses[0].downAt, 180);
  fixture.clock.tick(60);
  assert.equal(fixture.starts.length, 2);
  assert.equal(fixture.starts[1].downAt, 240);
  fixture.keyer.end("-");
  fixture.clock.tick(240);
  assert.equal(fixture.pulses.length, 2);
});

test("a press released during the inter-element gap is remembered once", () => {
  const fixture = keyerFixture(20);
  fixture.keyer.begin(".");
  fixture.keyer.end(".");
  fixture.clock.tick(60);
  assert.equal(fixture.pulses.length, 1);

  fixture.clock.tick(10);
  fixture.keyer.begin("-");
  fixture.keyer.end("-");
  fixture.clock.tick(50);
  assert.equal(fixture.starts.length, 2);
  assert.equal(fixture.starts[1].symbol, "-");

  fixture.clock.tick(180);
  assert.deepEqual(fixture.pulses.map((pulse) => pulse.symbol), [".", "-"]);
  fixture.clock.tick(60);
  assert.equal(fixture.keyer.isBusy(), false);
});

test("speed changes apply to the next automatic element without parallel timers", () => {
  const fixture = keyerFixture(20);
  fixture.keyer.begin(".");
  fixture.setWpm(40);
  fixture.clock.tick(60);
  assert.equal(fixture.pulses[0].upAt - fixture.pulses[0].downAt, 60);
  fixture.clock.tick(60);
  assert.equal(fixture.starts[1].durationMs, 30);
  assert.equal(fixture.clock.pending(), 1);
  fixture.keyer.stop();
  assert.equal(fixture.clock.pending(), 0);
  assert.equal(fixture.keyer.isBusy(), false);
});

test("quick taps queue exactly one complete element each", () => {
  const fixture = keyerFixture(20);
  fixture.keyer.tap(".");
  fixture.keyer.tap("-");
  fixture.clock.tick(360);
  assert.deepEqual(fixture.pulses.map((pulse) => pulse.symbol), [".", "-"]);
  assert.deepEqual(fixture.pulses.map((pulse) => pulse.upAt - pulse.downAt), [60, 180]);
});
