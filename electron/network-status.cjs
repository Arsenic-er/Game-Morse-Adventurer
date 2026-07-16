const { execFile } = require("child_process");

function stateForSignalPercent(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 75) return "good";
  if (value >= 40) return "medium";
  if (value > 0) return "poor";
  return "offline";
}

function parseNetshWlan(output) {
  const values = [...String(output ?? "").matchAll(/:\s*(\d{1,3})\s*%/g)]
    .map((match) => Math.max(0, Math.min(100, Number(match[1]))))
    .filter(Number.isFinite);
  if (!values.length) {
    return { state: null, signalPercent: null, source: "windows-wlan" };
  }
  const signalPercent = Math.max(...values);
  return { state: stateForSignalPercent(signalPercent), signalPercent, source: "windows-wlan" };
}

function readWindowsWifiStatus() {
  return new Promise((resolve) => {
    execFile("netsh", ["wlan", "show", "interfaces"], { windowsHide: true, timeout: 4000 }, (error, stdout) => {
      const parsed = parseNetshWlan(stdout);
      resolve({ ...parsed, available: parsed.signalPercent !== null, errorCode: error?.code ?? null });
    });
  });
}

module.exports = { parseNetshWlan, readWindowsWifiStatus, stateForSignalPercent };
