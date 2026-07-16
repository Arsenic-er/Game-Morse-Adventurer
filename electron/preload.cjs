const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cwgameSystem", {
  getNetworkStatus: () => ipcRenderer.invoke("cwgame:network-status"),
  qaCapture: process.argv.includes("--qa-capture") || Boolean(process.env.CWGAME_QA_OUTPUT),
});
