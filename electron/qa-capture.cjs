const fs = require("fs/promises");
const path = require("path");

async function waitFor(window, selector, timeout = 10000) {
  const source = `new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (node) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > ${timeout}) { clearInterval(timer); reject(new Error("Timed out: ${selector}")); }
    }, 40);
  })`;
  return window.webContents.executeJavaScript(source, true);
}

async function click(window, selector) {
  await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing click target: ")} + ${JSON.stringify(selector)});
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  })()`, true);
}

async function capture(window, outputDir, filename) {
  await window.webContents.executeJavaScript(`Promise.all(Array.from(document.images).map(async (image) => {
    if (!image.complete) await new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); });
    if (image.decode) await image.decode().catch(() => {});
  }))`, true);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, filename), image.toPNG());
}

async function runQaCapture(window) {
  const outputDir = process.env.CWGAME_QA_OUTPUT || path.join(process.cwd(), "qa-artifacts");
  await fs.mkdir(outputDir, { recursive: true });
  const consoleErrors = [];
  const onConsoleMessage = (_event, levelOrDetails, message) => {
    const details = typeof levelOrDetails === "object" ? levelOrDetails : { level: levelOrDetails, message };
    if (details.level === 2 || details.level === 3 || details.level === "warning" || details.level === "error") {
      consoleErrors.push({ level: details.level, message: details.message || message || "" });
    }
  };
  window.webContents.on("console-message", onConsoleMessage);
  await window.webContents.session.clearStorageData();
  await window.reload();
  await waitFor(window, ".start-screen");
  await capture(window, outputDir, "start-1672x941.png");

  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(".callsign-field input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "bh-1abcxyz");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelectorAll(".location-picker button")[1].click();
  })()`, true);
  await capture(window, outputDir, "save-create-1672x941.png");

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await capture(window, outputDir, "home-1672x941.png");

  await click(window, ".home-topbar button");
  await waitFor(window, ".qsl-slot.occupied");
  await capture(window, outputDir, "save-loaded-1672x941.png");

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");
  await capture(window, outputDir, "station-off-1672x941.png");

  await click(window, ".map-preview");
  await waitFor(window, ".map-modal");
  await capture(window, outputDir, "propagation-map-1672x941.png");

  await fs.writeFile(
    path.join(outputDir, "runtime-console-errors.json"),
    `${JSON.stringify(consoleErrors, null, 2)}\n`,
    "utf8",
  );
  window.webContents.removeListener("console-message", onConsoleMessage);

  return {
    outputDir,
    captures: [
      "start-1672x941.png",
      "save-create-1672x941.png",
      "home-1672x941.png",
      "save-loaded-1672x941.png",
      "station-off-1672x941.png",
      "propagation-map-1672x941.png",
    ],
  };
}

module.exports = { runQaCapture };
