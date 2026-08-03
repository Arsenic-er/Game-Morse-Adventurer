const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { runQaCapture } = require("./qa-capture.cjs");
const { readWindowsWifiStatus } = require("./network-status.cjs");
const { qsoExitDialogOptions } = require("./qso-exit-dialog.cjs");

const qaCaptureMode = process.argv.includes("--qa-capture");
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

  ipcMain.handle("cwgame:network-status", () => readWindowsWifiStatus());
  ipcMain.on("cwgame:qso-unload-guard", (event, payload = {}) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    const risk = ["active", "unsaved"].includes(payload.risk) ? payload.risk : "none";
    const language = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"].includes(payload.language) ? payload.language : "en";
    qsoUnloadGuard = { risk, language };
  });

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

  app.whenReady().then(createWindow);

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
