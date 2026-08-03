const { contextBridge, ipcRenderer } = require("electron");

const qaCapture = process.argv.includes("--qa-capture") || Boolean(process.env.CWGAME_QA_OUTPUT);
const failedIncomingPhases = new Set();

contextBridge.exposeInMainWorld("cwgameSystem", {
  getNetworkStatus: () => ipcRenderer.invoke("cwgame:network-status"),
  setQsoUnloadGuard: (risk, language) => ipcRenderer.send("cwgame:qso-unload-guard", { risk, language }),
  qaCapture,
  consumeQaIncomingFailure: (phase) => {
    if (!qaCapture || failedIncomingPhases.has(phase)) return false;
    failedIncomingPhases.add(phase);
    return true;
  },
  getQaIncomingFailureCount: () => failedIncomingPhases.size,
});
