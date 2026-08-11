const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { runQaCapture } = require("./qa-capture.cjs");
const { readWindowsWifiStatus } = require("./network-status.cjs");
const { qsoExitDialogOptions } = require("./qso-exit-dialog.cjs");
const { createSemanticRuntime } = require("./semantic-runtime.cjs");

const qaCaptureMode = process.argv.includes("--qa-capture");
const semanticSmokeMode = process.argv.includes("--semantic-smoke");
const qaWidth = Math.max(1280, Number(process.env.CWGAME_QA_WIDTH) || 1672);
const qaHeight = Math.max(720, Number(process.env.CWGAME_QA_HEIGHT) || 941);
if (qaCaptureMode) app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (qaCaptureMode && process.env.CWGAME_QA_OUTPUT) {
  const qaUserData = path.join(process.env.CWGAME_QA_OUTPUT, "electron-user-data");
  fs.mkdirSync(qaUserData, { recursive: true });
  app.setPath("userData", qaUserData);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let qsoUnloadGuard = { risk: "none", language: "en" };
  const semanticRuntime = createSemanticRuntime({
    assetDirectory: app.isPackaged
      ? path.join(process.resourcesPath, "models")
      : path.join(__dirname, "..", "runtime-models"),
  });

  function isMainRenderer(event) {
    return Boolean(mainWindow && event.sender === mainWindow.webContents);
  }

  ipcMain.handle("cwgame:network-status", () => readWindowsWifiStatus());
  ipcMain.handle("cwgame:semantic-status", async (event) => (
    isMainRenderer(event) ? semanticRuntime.status() : { available: false, reason: "untrusted-sender" }
  ));
  ipcMain.handle("cwgame:interpret-cw-traffic", async (event, payload = {}) => {
    if (!isMainRenderer(event)) return { ok: false, error: "untrusted-sender" };
    try {
      const result = await semanticRuntime.interpret(payload && typeof payload === "object" ? payload : {});
      return { ok: true, result };
    } catch (error) {
      process.stderr.write(`Semantic runtime fallback: ${error?.stack || error}\n`);
      return { ok: false, error: String(error?.message ?? error).slice(0, 240) };
    }
  });
  ipcMain.on("cwgame:qso-unload-guard", (event, payload = {}) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    const risk = ["active", "unsaved"].includes(payload.risk) ? payload.risk : "none";
    const language = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"].includes(payload.language) ? payload.language : "en";
    qsoUnloadGuard = { risk, language };
  });

  async function runSemanticSmoke() {
    let report;
    try {
      const result = await semanticRuntime.interpret({
        message: "CQCQDEBH1ABCBH1ABCPSEK",
        phase: "PLAYER_CQ",
        selfCallsign: "BH1ABC",
        peerCallsign: "JA1PIX",
      });
      report = {
        ok: result.provider === "onnxruntime-node"
          && result.safeToCommit === true
          && result.acts.CQ > 0.9
          && result.topics.CALLSIGN > 0.9,
        provider: result.provider,
        modelVersion: result.modelVersion,
        interpretability: result.interpretability,
      };
    } catch (error) {
      report = { ok: false, error: String(error?.stack || error) };
    }
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (process.env.CWGAME_SEMANTIC_SMOKE_OUTPUT) {
      fs.writeFileSync(process.env.CWGAME_SEMANTIC_SMOKE_OUTPUT, serialized, "utf8");
    } else {
      process.stdout.write(serialized);
    }
    app.exit(report.ok ? 0 : 1);
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: qaCaptureMode ? qaWidth : 1600,
      height: qaCaptureMode ? qaHeight : 900,
      useContentSize: qaCaptureMode,
      frame: !qaCaptureMode,
      minWidth: 1280,
      minHeight: 720,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: "#02090e",
      title: "CWGame",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    mainWindow.webContents.on("will-prevent-unload", (event) => {
      if (qsoUnloadGuard.risk === "none") return;
      const choice = dialog.showMessageBoxSync(mainWindow, qsoExitDialogOptions(qsoUnloadGuard));
      if (choice === 1) event.preventDefault();
    });
    if (qaCaptureMode) {
      mainWindow.webContents.once("did-finish-load", async () => {
        try {
          const result = await runQaCapture(mainWindow);
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          app.exit(0);
        } catch (error) {
          const outputDir = process.env.CWGAME_QA_OUTPUT;
          if (outputDir) {
            fs.mkdirSync(outputDir, { recursive: true });
            fs.writeFileSync(path.join(outputDir, "qa-failure.txt"), `${error.stack || error}\n`, "utf8");
          }
          process.stderr.write(`${error.stack || error}\n`);
          app.exit(1);
        }
      });
    } else {
      mainWindow.once("ready-to-show", () => mainWindow.show());
    }
    mainWindow.on("closed", () => { mainWindow = null; qsoUnloadGuard = { risk: "none", language: "en" }; });
  }

  app.whenReady().then(() => {
    if (semanticSmokeMode) return runSemanticSmoke();
    return createWindow();
  });

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
