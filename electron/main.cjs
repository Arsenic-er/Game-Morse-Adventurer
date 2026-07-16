const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { runQaCapture } = require("./qa-capture.cjs");

const qaCaptureMode = process.argv.includes("--qa-capture");

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: qaCaptureMode ? 1672 : 1600,
      height: qaCaptureMode ? 941 : 900,
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
      },
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    if (qaCaptureMode) {
      mainWindow.webContents.once("did-finish-load", async () => {
        try {
          const result = await runQaCapture(mainWindow);
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          app.exit(0);
        } catch (error) {
          process.stderr.write(`${error.stack || error}\n`);
          app.exit(1);
        }
      });
    } else {
      mainWindow.once("ready-to-show", () => mainWindow.show());
    }
    mainWindow.on("closed", () => { mainWindow = null; });
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
