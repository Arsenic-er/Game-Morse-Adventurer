const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");

const { finishQaProcess } = require("../electron/qa-shutdown.cjs");

function fakeApp() {
  return {
    quitCalls: 0,
    quit() { this.quitCalls += 1; },
  };
}

class FakeWindow extends EventEmitter {
  constructor({ destroyed = false, closeMode = "sync" } = {}) {
    super();
    this.destroyed = destroyed;
    this.destroyCalls = 0;
    this.closeMode = closeMode;
  }

  isDestroyed() { return this.destroyed; }

  destroy() {
    this.destroyCalls += 1;
    this.destroyed = true;
    if (this.closeMode === "sync") this.emit("closed");
    if (this.closeMode === "async") queueMicrotask(() => this.emit("closed"));
  }
}

for (const exitCode of [0, 1]) {
  test(`QA shutdown preserves exit code ${exitCode} and closes resources before quitting`, async () => {
    const order = [];
    const app = fakeApp();
    app.quit = () => { order.push("quit"); app.quitCalls += 1; };
    const window = new FakeWindow({ closeMode: "async" });
    window.on("closed", () => order.push("closed"));
    const processRef = { exitCode: null };

    await finishQaProcess({ app, window, exitCode, processRef });

    assert.equal(processRef.exitCode, exitCode);
    assert.equal(window.destroyCalls, 1);
    assert.equal(app.quitCalls, 1);
    assert.deepEqual(order, ["closed", "quit"]);
  });
}

test("QA shutdown skips an already-destroyed window", async () => {
  const app = fakeApp();
  const window = new FakeWindow({ destroyed: true });
  const processRef = { exitCode: null };

  await finishQaProcess({ app, window, exitCode: 0, processRef });

  assert.equal(window.destroyCalls, 0);
  assert.equal(app.quitCalls, 1);
  assert.equal(processRef.exitCode, 0);
});

test("QA shutdown handles a synchronous closed event and repeated calls exactly once", async () => {
  const app = fakeApp();
  const window = new FakeWindow({ closeMode: "sync" });
  const processRef = { exitCode: null };

  const first = finishQaProcess({ app, window, exitCode: 1, processRef });
  const repeated = finishQaProcess({ app, window, exitCode: 0, processRef });
  assert.equal(first, repeated);
  await Promise.all([first, repeated]);

  assert.equal(window.destroyCalls, 1);
  assert.equal(app.quitCalls, 1);
  assert.equal(processRef.exitCode, 1);
});

test("packaged QA flushes evidence before graceful success and failure shutdown", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  assert.match(
    source,
    /await writeProcessStream\(process\.stdout,[\s\S]*await finishQaProcess\(\{ app, window: mainWindow, exitCode: 0 \}\)/,
  );
  assert.match(
    source,
    /qa-failure\.txt[\s\S]*await writeProcessStream\(process\.stderr,[\s\S]*await finishQaProcess\(\{ app, window: mainWindow, exitCode: 1 \}\)/,
  );
  assert.match(source, /window-all-closed[\s\S]*if \(qaCaptureMode\) return;[\s\S]*app\.quit\(\)/);
});
