const fs = require("fs/promises");
const path = require("path");

async function waitFor(window, selector, timeout = 10000) {
  const source = `new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (node) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > ${timeout}) { clearInterval(timer); reject(new Error(${JSON.stringify(`Timed out: ${selector}`)})); }
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

const MORSE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendAutomaticText(window, text, wpm = 18) {
  const dotMs = 1200 / wpm;
  const words = String(text).toUpperCase().trim().split(/\s+/);
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const characters = [...words[wordIndex]];
    for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
      const pattern = MORSE[characters[characterIndex]];
      if (!pattern) continue;
      for (let symbolIndex = 0; symbolIndex < pattern.length; symbolIndex += 1) {
        const symbol = pattern[symbolIndex];
        const keyCode = symbol === "." ? "Z" : "X";
        const previousPulseCount = await window.webContents.executeJavaScript(
          'Number(document.querySelector(".station-screen")?.dataset.pulseCount || 0)',
          true,
        );
        const eventCode = keyCode === "Z" ? "KeyZ" : "KeyX";
        await window.webContents.executeJavaScript(`(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { code: ${JSON.stringify(eventCode)}, key: ${JSON.stringify(keyCode.toLowerCase())}, bubbles: true, cancelable: true }));
          window.dispatchEvent(new KeyboardEvent("keyup", { code: ${JSON.stringify(eventCode)}, key: ${JSON.stringify(keyCode.toLowerCase())}, bubbles: true, cancelable: true }));
        })()`, true);
        const accepted = await window.webContents.executeJavaScript(`new Promise((resolve) => {
          const started = Date.now();
          const timer = setInterval(() => {
            const count = Number(document.querySelector(".station-screen")?.dataset.pulseCount || 0);
            if (count > ${previousPulseCount}) { clearInterval(timer); resolve(true); }
            else if (Date.now() - started > 3000) { clearInterval(timer); resolve(false); }
          }, 20);
        })`, true);
        if (!accepted) {
          const state = await window.webContents.executeJavaScript(`(() => {
            const station = document.querySelector(".station-screen");
            return {
              phase: station?.dataset.qsoPhase ?? null,
              decoded: station?.dataset.decoded ?? null,
              pulseCount: station?.dataset.pulseCount ?? null,
              keyType: document.querySelector(".key-card strong")?.textContent ?? null,
              bodyClass: document.body.className,
            };
          })()`, true);
          throw new Error(`Automatic-key pulse was dropped for ${keyCode}: ${JSON.stringify(state)}`);
        }
        // The pulse-count update is observed after the automatic-key timer ends,
        // so the intra-character gap has already begun. Keep the remaining wait
        // short to avoid hidden-window compositor delays splitting one letter.
        if (symbolIndex < pattern.length - 1) await delay(12);
      }
      if (characterIndex < characters.length - 1) await delay(dotMs * 3 + 25);
    }
    if (wordIndex < words.length - 1) await delay(dotMs * 7 + 25);
  }
  await delay(180);
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
  await fs.rm(path.join(outputDir, "qa-failure.txt"), { force: true });
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
  await hover(window, ".hotspot-store");
  await capture(window, outputDir, shot("home-hover-store"));
  await click(window, ".hotspot-store");
  await waitFor(window, '[data-testid="store-modal"]');
  await capture(window, outputDir, shot("store-antenna"));
  await click(window, '[data-store-category="radio"]');
  await capture(window, outputDir, shot("store-radio"));
  await click(window, '[data-action="close-store"]');
  await waitFor(window, ".home-screen");
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
  await click(window, '[data-antenna-id="none"]');
  await capture(window, outputDir, shot("warehouse-antenna-selected"));
  await click(window, ".rack-equip-button");
  await capture(window, outputDir, shot("warehouse-antenna-equipped"));
  // Restore the starter dipole so the later RF/QSO smoke flow remains operable.
  await click(window, '[data-antenna-id="dipole"]');
  await click(window, ".rack-equip-button");
  await click(window, ".warehouse-return");
  await waitFor(window, ".home-screen");
  await clearHover(window);
  await hover(window, ".hotspot-achievements");
  await capture(window, outputDir, shot("home-hover-achievements"));
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await capture(window, outputDir, shot("home-log-empty-warmup"));
  await capture(window, outputDir, shot("home-log-empty"));
  await click(window, ".qso-log-return");
  await window.webContents.executeJavaScript(`(() => {
    const key = "game-morse-adventurer.saves.v1";
    const saves = JSON.parse(localStorage.getItem(key) || "[]");
    const save = saves[0];
    save.keyType = "automatic";
    save.credits = 200;
    save.qsoLogs = [
      { version: 1, id: "SIM9AK-qa-2", startedAt: "2026-07-15T03:06:00.000Z", completedAt: "2026-07-15T03:12:00.000Z", playerCallsign: save.callsign, callsign: "SIM9AK", frequencyMhz: 21.06, mode: "CW", sent: "559", received: "579", location: "EU-W", npcLatitude: 51.51, npcLongitude: -0.13, distanceKm: 9568.2, basePropagationLevel: 2, finalPropagationLevel: 3, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: save.antennaId, playerLocationId: save.locationId, wpm: 19, copyAccuracy: 94, keyingScore: 91, credits: 100, isFictional: true },
      { version: 1, id: "SIM6JP-qa-1", startedAt: "2026-07-14T22:00:00.000Z", completedAt: "2026-07-14T22:05:00.000Z", playerCallsign: save.callsign, callsign: "SIM6JP", frequencyMhz: 21.06, mode: "CW", sent: "579", received: "599", location: "AS-JA", npcLatitude: 35.68, npcLongitude: 139.76, distanceKm: 162.4, basePropagationLevel: 3, finalPropagationLevel: 4, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: "dipole", playerLocationId: save.locationId, wpm: 18, copyAccuracy: 98, keyingScore: 96, credits: 100, isFictional: true }
    ];
    localStorage.setItem(key, JSON.stringify(saves));
  })()`, true);
  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".qsl-slot.occupied");
  await capture(window, outputDir, shot("save-loaded"));

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await capture(window, outputDir, shot("home-log-populated-warmup"));
  await capture(window, outputDir, shot("home-log-populated"));
  await click(window, ".qso-log-records button:nth-of-type(2)");
  await capture(window, outputDir, shot("home-log-detail-second"));
  await click(window, ".qso-log-return");
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");
  await capture(window, outputDir, shot("station-off"));
  const markStep = (step) => fs.writeFile(path.join(outputDir, "qa-step.txt"), `${step}\n`, "utf8");
  await markStep("station-captured");

  await click(window, ".reply-button");
  await markStep("f1-clicked");
  await waitFor(window, '[data-qso-phase="PLAYER_REPLY"]', 10000);
  await markStep("player-reply-phase");
  const stationIdentity = await window.webContents.executeJavaScript(`(() => ({
    npc: document.querySelector(".contact-card h2").textContent.trim(),
    player: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  await markStep(`identity-${stationIdentity.npc}-${stationIdentity.player}`);
  await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} K`);
  await markStep("first-reply-keyed");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const firstReplyDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(`${stationIdentity.npc} DE ${stationIdentity.player} K`)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-first-reply-debug.json"), `${JSON.stringify(firstReplyDebug, null, 2)}\n`, "utf8");
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-qso-phase="NPC_RST"]', 10000);
  await waitFor(window, ".reply-button:not([disabled])", 30000);
  await click(window, ".reply-button");
  await waitFor(window, '[data-qso-phase="PLAYER_RST_AND_73"]', 10000);
  await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`);
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const secondReplyDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(`${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-second-reply-debug.json"), `${JSON.stringify(secondReplyDebug, null, 2)}\n`, "utf8");
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-qso-phase="NPC_73_AND_SK"]', 10000);
  await waitFor(window, ".reply-button:not([disabled])", 30000);
  await click(window, ".reply-button");
  await waitFor(window, ".qso-result-modal.success", 30000);
  await capture(window, outputDir, shot("qso-result-unsaved-warmup"));
  await capture(window, outputDir, shot("qso-result-unsaved"));
  await click(window, ".qso-result-primary");
  await waitFor(window, ".qso-result-modal.success header .icon-button", 10000);
  await capture(window, outputDir, shot("qso-result-saved"));
  await click(window, ".qso-result-modal.success header .icon-button");

  await click(window, ".station-topbar .top-actions button:first-child");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await waitFor(window, ".qso-log-records button:nth-of-type(3)", 10000);
  await capture(window, outputDir, shot("home-log-after-qso-warmup"));
  await capture(window, outputDir, shot("home-log-after-qso"));
  await click(window, ".qso-log-return");
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");

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
      "home-hover-store", "store-antenna", "store-radio",
      "home-hover-warehouse", "warehouse-radio", "warehouse-accessories",
      "warehouse-antenna-selected", "warehouse-antenna-equipped",
      "home-hover-achievements", "home-log-empty", "save-loaded", "home-log-populated",
      "home-log-detail-second", "station-off", "qso-result-unsaved", "qso-result-saved", "home-log-after-qso", "propagation-map",
    ].map(shot),
  };
}

module.exports = { runQaCapture };
