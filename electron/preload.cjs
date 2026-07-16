const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cwgameSystem", {
  getNetworkStatus: () => ipcRenderer.invoke("cwgame:network-status"),
});
