const shutdownByApp = new WeakMap();

function destroyQaWindow(window) {
  if (!window || window.isDestroyed()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.once("closed", finish);
    try {
      window.destroy();
    } catch (error) {
      settled = true;
      window.removeListener("closed", finish);
      reject(error);
    }
  });
}

function finishQaProcess({ app, window, exitCode, processRef = process }) {
  const existing = shutdownByApp.get(app);
  if (existing) return existing;
  processRef.exitCode = exitCode;
  const shutdown = (async () => {
    await destroyQaWindow(window);
    app.quit();
  })();
  shutdownByApp.set(app, shutdown);
  return shutdown;
}

module.exports = { finishQaProcess };
