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

async function hover(window, selector) {
  const point = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing hover target: ")} + ${JSON.stringify(selector)});
    const bounds = node.getBoundingClientRect();
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) };
  })()`, true);
  window.webContents.sendInputEvent({ type: "mouseMove", x: point.x, y: point.y });
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function clearHover(window) {
  window.webContents.sendInputEvent({ type: "mouseMove", x: 840, y: 24 });
  await new Promise((resolve) => setTimeout(resolve, 120));
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
  const [captureWidth, captureHeight] = window.getContentSize();
  const suffix = process.env.CWGAME_QA_SUFFIX || `${captureWidth}x${captureHeight}`;
  const shot = (stem) => `${stem}-${suffix}.png`;
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
  await capture(window, outputDir, shot("start"));

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
  await capture(window, outputDir, shot("save-create"));

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await capture(window, outputDir, shot("home"));
  await capture(window, outputDir, shot("home-motion-a"));
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await capture(window, outputDir, shot("home-motion-b"));
  await clearHover(window);
  await hover(window, ".hotspot-warehouse");
  await capture(window, outputDir, shot("home-hover-warehouse"));
  await click(window, ".hotspot-warehouse");
  await waitFor(window, ".warehouse-screen");
  await click(window, ".warehouse-category-rail button:nth-of-type(2)");
  await click(window, ".warehouse-category-rail button:nth-of-type(1)");
  // The hidden QA window can return the previous compositor frame on its first capture.
  await capture(window, outputDir, shot("warehouse-radio-warmup"));
  await capture(window, outputDir, shot("warehouse-radio"));
  await click(window, ".warehouse-category-rail button:nth-of-type(3)");
  await capture(window, outputDir, shot("warehouse-accessories"));
  await click(window, ".warehouse-category-rail button:nth-of-type(2)");
  await click(window, '[data-antenna-id="yagi-3el"]');
  await capture(window, outputDir, shot("warehouse-antenna-selected"));
  await click(window, ".rack-equip-button");
  await capture(window, outputDir, shot("warehouse-antenna-equipped"));
  await click(window, ".warehouse-return");
  await waitFor(window, ".home-screen");
  await clearHover(window);
  await hover(window, ".hotspot-achievements");
  await capture(window, outputDir, shot("home-hover-achievements"));

  await click(window, ".home-topbar button");
  await waitFor(window, ".qsl-slot.occupied");
  await capture(window, outputDir, shot("save-loaded"));

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");
  await capture(window, outputDir, shot("station-off"));

  await click(window, ".map-preview");
  await waitFor(window, ".map-modal");
  await capture(window, outputDir, shot("propagation-map"));

  await fs.writeFile(
    path.join(outputDir, "runtime-console-errors.json"),
    `${JSON.stringify(consoleErrors, null, 2)}\n`,
    "utf8",
  );
  window.webContents.removeListener("console-message", onConsoleMessage);

  return {
    outputDir,
    captures: [
      "start", "save-create", "home", "home-motion-a", "home-motion-b",
      "home-hover-warehouse", "warehouse-radio", "warehouse-accessories",
      "warehouse-antenna-selected", "warehouse-antenna-equipped",
      "home-hover-achievements", "save-loaded", "station-off", "propagation-map",
    ].map(shot),
  };
}

module.exports = { runQaCapture };
