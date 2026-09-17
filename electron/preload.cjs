const { contextBridge, ipcRenderer } = require("electron");

const qaCapture = process.argv.includes("--qa-capture") || process.argv.includes("--qa-lights-capture") || Boolean(process.env.CWGAME_QA_OUTPUT);
const failedIncomingPhases = new Set();

contextBridge.exposeInMainWorld("cwgameSystem", {
  chapterOneLocalReview: process.argv.includes("--chapter-one-local-review"),
  getNetworkStatus: () => ipcRenderer.invoke("cwgame:network-status"),
  getSemanticStatus: () => ipcRenderer.invoke("cwgame:semantic-status"),
  interpretCwTraffic: (payload) => ipcRenderer.invoke("cwgame:interpret-cw-traffic", payload),
  setActivityUnloadGuard: (risk, language) => ipcRenderer.send("cwgame:activity-unload-guard", { risk, language }),
  qaCapture,
  consumeQaIncomingFailure: (phase) => {
    if (!qaCapture || failedIncomingPhases.has(phase)) return false;
    failedIncomingPhases.add(phase);
    return true;
  },
  getQaIncomingFailureCount: () => failedIncomingPhases.size,
});
