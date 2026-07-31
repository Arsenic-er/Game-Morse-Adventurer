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

async function setInputValue(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error(${JSON.stringify("Missing input target: ")} + ${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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

async function assertHoverTint(window, selector) {
  await clearHover(window);
  const bounds = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing hover-tint target: ")} + ${JSON.stringify(selector)});
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  })()`, true);
  const before = await window.webContents.capturePage();
  await hover(window, selector);
  const after = await window.webContents.capturePage();
  const size = before.getSize();
  const scaleX = size.width / bounds.viewportWidth;
  const scaleY = size.height / bounds.viewportHeight;
  const left = Math.max(0, Math.floor((bounds.left + bounds.width * 0.25) * scaleX));
  const right = Math.min(size.width, Math.ceil((bounds.left + bounds.width * 0.75) * scaleX));
  const top = Math.max(0, Math.floor((bounds.top + bounds.height * 0.15) * scaleY));
  const bottom = Math.min(size.height, Math.ceil((bounds.top + bounds.height * 0.5) * scaleY));
  const beforePixels = before.toBitmap();
  const afterPixels = after.toBitmap();
  let difference = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const offset = (y * size.width + x) * 4;
      difference += Math.abs(beforePixels[offset] - afterPixels[offset]);
      difference += Math.abs(beforePixels[offset + 1] - afterPixels[offset + 1]);
      difference += Math.abs(beforePixels[offset + 2] - afterPixels[offset + 2]);
      samples += 3;
    }
  }
  let meanDifference = samples ? difference / samples : 0;
  if (meanDifference < 2) {
    await window.webContents.executeJavaScript(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      node?.focus({ focusVisible: true });
    })()`, true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const focused = await window.webContents.capturePage();
    const focusedPixels = focused.toBitmap();
    difference = 0;
    samples = 0;
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const offset = (y * size.width + x) * 4;
        difference += Math.abs(beforePixels[offset] - focusedPixels[offset]);
        difference += Math.abs(beforePixels[offset + 1] - focusedPixels[offset + 1]);
        difference += Math.abs(beforePixels[offset + 2] - focusedPixels[offset + 2]);
        samples += 3;
      }
    }
    meanDifference = samples ? difference / samples : 0;
  }
  if (meanDifference < 2) {
    throw new Error(`Hover/focus tint did not visibly change ${selector}; mean RGB delta ${meanDifference.toFixed(2)}`);
  }
}

async function waitForMissing(window, selector, timeout = 10000) {
  const source = `new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > ${timeout}) { clearInterval(timer); reject(new Error(${JSON.stringify(`Timed out waiting for removal: ${selector}`)})); }
    }, 40);
  })`;
  return window.webContents.executeJavaScript(source, true);
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

async function assertHeldAutomaticKey(window, { code, key, holdMs, minimumPulses }) {
  const before = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    code: ${JSON.stringify(code)},
    key: ${JSON.stringify(key)},
    bubbles: true,
    cancelable: true,
  }))`, true);
  await delay(holdMs);
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keyup", {
    code: ${JSON.stringify(code)},
    key: ${JSON.stringify(key)},
    bubbles: true,
    cancelable: true,
  }))`, true);
  await delay(260);
  const after = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  if (after - before < minimumPulses) {
    throw new Error(`Held ${code} generated only ${after - before} pulses; expected at least ${minimumPulses}`);
  }
  await delay(320);
  const settled = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  if (settled !== after) throw new Error(`Held ${code} continued after keyup (${after} -> ${settled})`);
}

async function capture(window, outputDir, filename) {
  await window.webContents.executeJavaScript(`Promise.all(Array.from(document.images).map(async (image) => {
    if (!image.complete) await new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); });
    if (image.decode) await image.decode().catch(() => {});
  }))`, true);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Software-rendered packaged builds can return the previous compositor frame
  // on the first capture after a large modal or route transition.
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, filename), image.toPNG());
}

async function runQaCapture(window) {
  const outputDir = process.env.CWGAME_QA_OUTPUT || path.join(process.cwd(), "qa-artifacts");
  const [captureWidth, captureHeight] = window.getContentSize();
  const suffix = process.env.CWGAME_QA_SUFFIX || `${captureWidth}x${captureHeight}`;
  const shot = (stem) => `${stem}-${suffix}.png`;
  const manualCaptures = [];
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
  const buildTag = await window.webContents.executeJavaScript(
    'document.querySelector(".build-tag")?.textContent.trim() ?? ""',
    true,
  );
  if (!buildTag.includes("v0.21.0")) throw new Error(`Unexpected title build tag: ${buildTag}`);

  async function readManualState(label) {
    const state = await window.webContents.executeJavaScript(`(() => {
      const modal = document.querySelector('[data-testid="station-manual-modal"]');
      return {
        label: ${JSON.stringify(label)},
        text: modal?.textContent.trim() ?? "",
        page: Number(modal?.dataset.manualPageNumber),
        total: Number(modal?.dataset.manualPageTotal),
        chapters: modal?.querySelectorAll("[data-manual-chapter]").length ?? 0,
        pageTitle: modal?.querySelector(".station-manual-page h3")?.textContent.trim() ?? "",
      };
    })()`, true);
    if (!state.text || !state.pageTitle || state.page !== 1 || state.total !== 4 || state.chapters !== 4) {
      throw new Error(`Station Manual ${label} state is incomplete: ${JSON.stringify(state)}`);
    }
    return state;
  }

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  const firstManualState = await readManualState("initial open");
  await capture(window, outputDir, shot("station-manual-page-1"));
  manualCaptures.push(shot("station-manual-page-1"));

  const languageUpdateState = await window.webContents.executeJavaScript(`(async () => {
    const beforeLanguage = document.documentElement.lang;
    const beforeText = document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "";
    document.querySelector(".start-language .language-globe")?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const menuItems = Array.from(document.querySelectorAll(".start-language .language-menu button"));
    const targetIndex = beforeLanguage === "en" ? 2 : 3;
    menuItems[targetIndex]?.click();
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
      beforeLanguage,
      afterLanguage: document.documentElement.lang,
      beforeText,
      afterText: document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "",
    }))));
  })()`, true);
  if (languageUpdateState.beforeLanguage === languageUpdateState.afterLanguage
    || languageUpdateState.beforeText === languageUpdateState.afterText) {
    throw new Error(`Open Station Manual did not update with language: ${JSON.stringify(languageUpdateState)}`);
  }
  await capture(window, outputDir, shot("station-manual-language-updated"));
  manualCaptures.push(shot("station-manual-language-updated"));

  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "ArrowRight", code: "ArrowRight", bubbles: true, cancelable: true,
  }))`, true);
  await delay(80);
  let keyboardPage = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (keyboardPage !== 2) throw new Error(`ArrowRight navigation landed on page ${keyboardPage}`);
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "ArrowLeft", code: "ArrowLeft", bubbles: true, cancelable: true,
  }))`, true);
  await delay(80);
  keyboardPage = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (keyboardPage !== 1) throw new Error(`ArrowLeft navigation landed on page ${keyboardPage}`);

  let manualPage = 1;
  let previousManualText = languageUpdateState.afterText;
  for (; manualPage < 8; manualPage += 1) {
    const navigation = await window.webContents.executeJavaScript(`(() => {
      const modal = document.querySelector('[data-testid="station-manual-modal"]');
      const next = modal?.querySelector('[data-action="manual-next"]');
      if (!next || next.disabled) return { advanced: false };
      next.click();
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        advanced: true,
        text: document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "",
      }))));
    })()`, true);
    if (!navigation.advanced) break;
    if (!navigation.text || navigation.text === previousManualText) {
      throw new Error(`Station Manual page ${manualPage + 1} did not change content`);
    }
    previousManualText = navigation.text;
    const captureName = shot(`station-manual-page-${manualPage + 1}`);
    await capture(window, outputDir, captureName);
    manualCaptures.push(captureName);
  }
  if (manualPage !== firstManualState.total) {
    throw new Error(`Station Manual exposed ${manualPage} of ${firstManualState.total} pages`);
  }
  await click(window, '[data-testid="station-manual-modal"] [data-action="manual-prev"]');
  const previousPageNumber = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (previousPageNumber !== firstManualState.total - 1) {
    throw new Error(`Station Manual previous navigation landed on page ${previousPageNumber}`);
  }
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", bubbles: true, cancelable: true,
  }))`, true);
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  await readManualState("backdrop-close open");
  await window.webContents.executeJavaScript(`(() => {
    const backdrop = document.querySelector('[data-testid="station-manual-backdrop"]');
    if (!backdrop) throw new Error("Missing Station Manual backdrop");
    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  })()`, true);
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  await readManualState("close-button open");
  await click(window, '[data-testid="station-manual-modal"] [data-action="close-station-manual"]');
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, ".practice-screen");
  await waitFor(window, '.practice-screen[data-practice-recording="session"][data-practice-difficulty="guided"][data-practice-lesson="1"][data-practice-lessons-completed="0"]');
  const sessionOnlyPracticeState = await window.webContents.executeJavaScript(`(() => ({
    recording: document.querySelector(".practice-screen")?.dataset.practiceRecording ?? null,
    difficulty: document.querySelector(".practice-screen")?.dataset.practiceDifficulty ?? null,
    lesson: Number(document.querySelector(".practice-screen")?.dataset.practiceLesson),
    completedLessons: Number(document.querySelector(".practice-screen")?.dataset.practiceLessonsCompleted),
    statusClass: document.querySelector(".practice-recording-status")?.className ?? "",
    statusText: document.querySelector(".practice-recording-status")?.textContent.trim() ?? "",
    saveCount: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1") || "[]").length,
  }))()`, true);
  if (sessionOnlyPracticeState.recording !== "session"
    || sessionOnlyPracticeState.difficulty !== "guided"
    || sessionOnlyPracticeState.lesson !== 1
    || sessionOnlyPracticeState.completedLessons !== 0
    || !sessionOnlyPracticeState.statusClass.includes("session-only")
    || !sessionOnlyPracticeState.statusText
    || sessionOnlyPracticeState.saveCount !== 0) {
    throw new Error(`No-save practice was not explicitly session-only: ${JSON.stringify(sessionOnlyPracticeState)}`);
  }
  await capture(window, outputDir, shot("practice-session-only"));
  await click(window, ".practice-sidebar nav button:nth-of-type(4)");
  await assertHeldAutomaticKey(window, { code: "KeyZ", key: "z", holdMs: 520, minimumPulses: 3 });
  await assertHeldAutomaticKey(window, { code: "KeyX", key: "x", holdMs: 620, minimumPulses: 2 });
  await click(window, ".practice-topbar .top-actions button:first-child");
  await waitFor(window, ".start-screen");

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
  await assertHoverTint(window, ".hotspot-store");
  await capture(window, outputDir, shot("home-hover-store"));
  await click(window, ".hotspot-store");
  await waitFor(window, '[data-testid="store-modal"]');
  await capture(window, outputDir, shot("store-antenna"));
  await click(window, '[data-store-category="radio"]');
  await capture(window, outputDir, shot("store-radio"));
  await click(window, '[data-store-category="accessories"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="insufficient"]');
  await capture(window, outputDir, shot("store-accessory-insufficient"));
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
  await click(window, ".hotspot-achievements");
  await waitFor(window, '[data-testid="achievements-modal"]');
  const emptyAchievementState = await window.webContents.executeJavaScript(`(() => ({
    total: document.querySelectorAll(".achievement-card").length,
    unlocked: document.querySelectorAll('.achievement-card[data-achievement-state="unlocked"]').length,
    callsign: document.querySelector(".achievements-summary strong")?.textContent.trim() ?? null,
    savedCallsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  if (emptyAchievementState.total !== 6 || emptyAchievementState.unlocked !== 0
    || emptyAchievementState.callsign !== emptyAchievementState.savedCallsign) {
    throw new Error(`Unexpected empty achievement state: ${JSON.stringify(emptyAchievementState)}`);
  }
  await capture(window, outputDir, shot("achievements-empty"));
  await click(window, '[data-action="close-achievements-footer"]');
  await waitForMissing(window, '[data-testid="achievements-modal"]');
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
    save.credits = 2000;
    save.qsoLogs = [
      { version: 1, id: "SIM9AK-qa-2", startedAt: "2026-07-15T03:06:00.000Z", completedAt: "2026-07-15T03:12:00.000Z", playerCallsign: save.callsign, callsign: "SIM9AK", frequencyMhz: 21.06, mode: "CW", sent: "559", received: "579", location: "EU-W", npcLatitude: 51.51, npcLongitude: -0.13, distanceKm: 9568.2, basePropagationLevel: 2, finalPropagationLevel: 3, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: save.antennaId, playerLocationId: save.locationId, wpm: 19, copyAccuracy: 94, keyingScore: 91, credits: 100, isFictional: true },
      { version: 1, id: "SIM6JP-qa-1", startedAt: "2026-07-14T22:00:00.000Z", completedAt: "2026-07-14T22:05:00.000Z", playerCallsign: save.callsign, callsign: "SIM6JP", frequencyMhz: 21.06, mode: "CW", sent: "579", received: "599", location: "AS-JA", npcLatitude: 35.68, npcLongitude: 139.76, distanceKm: 162.4, basePropagationLevel: 3, finalPropagationLevel: 4, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: "dipole", playerLocationId: save.locationId, wpm: 18, copyAccuracy: 98, keyingScore: 96, credits: 100, isFictional: true }
    ];
    save.qsoRecords = {
      total: 4,
      longestDistanceKm: 9568.2,
      longestQsoId: "SIM9AK-qa-2",
      contactedRegions: ["AS-JA", "EU-W"],
      weakSignalQsos: 0,
      settledQsoIds: ["SIM6JP-qa-1", "SIM9AK-qa-2"],
    };
    localStorage.setItem(key, JSON.stringify(saves));
  })()`, true);
  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".qsl-slot.occupied");
  await capture(window, outputDir, shot("save-loaded"));

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-store");
  await waitFor(window, '[data-testid="store-modal"]');
  await click(window, '[data-store-category="accessories"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="available"]');
  await click(window, '[data-action="purchase"][data-purchase-item-id="cw-filter-500"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="owned"]');
  const accessoryPurchaseState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return { credits: save.credits, accessories: save.accessories, accessoryId: save.accessoryId };
  })()`, true);
  if (accessoryPurchaseState.credits !== 1700
    || !accessoryPurchaseState.accessories.includes("cw-filter-500")
    || accessoryPurchaseState.accessoryId !== "none") {
    throw new Error(`Accessory purchase was not atomic: ${JSON.stringify(accessoryPurchaseState)}`);
  }
  await capture(window, outputDir, shot("store-accessory-owned"));
  await click(window, '[data-store-category="radio"]');
  await waitFor(window, '[data-store-item-id="usdr-8"][data-store-item-state="available"]');
  await click(window, '[data-store-item-id="usdr-8"]');
  await capture(window, outputDir, shot("store-radio-available-warmup"));
  await capture(window, outputDir, shot("store-radio-available"));
  await click(window, '[data-action="purchase"][data-purchase-item-id="usdr-8"]');
  await waitFor(window, '[data-store-item-id="usdr-8"][data-store-item-state="owned"]');
  const radioPurchaseState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return { credits: save.credits, ownedEquipment: save.ownedEquipment, equipmentId: save.equipmentId };
  })()`, true);
  if (radioPurchaseState.credits !== 900
    || !radioPurchaseState.ownedEquipment.includes("usdr-8")
    || radioPurchaseState.equipmentId !== "squid-01") {
    throw new Error(`Radio purchase was not atomic: ${JSON.stringify(radioPurchaseState)}`);
  }
  await capture(window, outputDir, shot("store-radio-owned-warmup"));
  await capture(window, outputDir, shot("store-radio-owned"));
  await click(window, '[data-action="close-store"]');
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-warehouse");
  await waitFor(window, ".warehouse-screen");
  await click(window, ".warehouse-category-rail button:nth-of-type(3)");
  await click(window, '[data-accessory-id="cw-filter-500"]');
  await capture(window, outputDir, shot("warehouse-accessory-selected"));
  await click(window, '[data-action="equip-item"][data-equipped-item-id="cw-filter-500"]');
  const equippedAccessoryId = await window.webContents.executeJavaScript(
    'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].accessoryId',
    true,
  );
  if (equippedAccessoryId !== "cw-filter-500") throw new Error(`Accessory did not persist after equip: ${equippedAccessoryId}`);
  await capture(window, outputDir, shot("warehouse-accessory-equipped"));
  await click(window, '[data-warehouse-category="radio"]');
  await click(window, '[data-radio-id="usdr-8"]');
  await capture(window, outputDir, shot("warehouse-radio-selected"));
  await click(window, '[data-action="equip-item"][data-equipped-item-id="usdr-8"]');
  const equippedRadioState = await window.webContents.executeJavaScript(`(() => ({
    saved: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].equipmentId,
    shown: document.querySelector('[data-testid="current-radio-loadout"]')?.dataset.equipmentId ?? null,
  }))()`, true);
  if (equippedRadioState.saved !== "usdr-8" || equippedRadioState.shown !== "usdr-8") {
    throw new Error(`Radio did not persist after equip: ${JSON.stringify(equippedRadioState)}`);
  }
  await capture(window, outputDir, shot("warehouse-radio-equipped"));
  await click(window, ".warehouse-return");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-achievements");
  await waitFor(window, '[data-testid="achievements-modal"]');
  const populatedAchievementState = await window.webContents.executeJavaScript(`(() => ({
    unlocked: Array.from(document.querySelectorAll('.achievement-card[data-achievement-state="unlocked"]'))
      .map((node) => node.dataset.achievementId).sort(),
    locked: Array.from(document.querySelectorAll('.achievement-card[data-achievement-state="locked"]'))
      .map((node) => node.dataset.achievementId),
    callsign: document.querySelector(".achievements-summary strong")?.textContent.trim() ?? null,
    savedCallsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  const expectedUnlockedAchievements = ["dx-5000", "first-qso"];
  if (JSON.stringify(populatedAchievementState.unlocked) !== JSON.stringify(expectedUnlockedAchievements)
    || populatedAchievementState.callsign !== populatedAchievementState.savedCallsign) {
    throw new Error(`Unexpected populated achievement state: ${JSON.stringify(populatedAchievementState)}`);
  }
  await capture(window, outputDir, shot("achievements-populated"));
  await click(window, '[data-action="close-achievements-footer"]');
  await waitForMissing(window, '[data-testid="achievements-modal"]');
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await capture(window, outputDir, shot("home-log-populated-warmup"));
  await capture(window, outputDir, shot("home-log-populated"));
  await click(window, ".qso-log-records button:nth-of-type(2)");
  await capture(window, outputDir, shot("home-log-detail-second"));
  await click(window, ".qso-log-return");
  await waitForMissing(window, ".qso-log-modal");
  await delay(400);

  // The Home book stack is the save-aware curriculum entrance. Its hover tint,
  // route, return route, promotion gate and persistence are all smoke-tested.
  await clearHover(window);
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="0"][data-practice-total="19"][data-practice-percent="0"]');
  const initialHomePracticeProgress = await window.webContents.executeJavaScript(`(() => {
    const hotspot = document.querySelector('[data-testid="home-practice-hotspot"]');
    const progress = document.querySelector('[data-testid="home-practice-progress"]');
    return {
      hotspotCompleted: Number(hotspot?.dataset.practiceCompleted),
      hotspotTotal: Number(hotspot?.dataset.practiceTotal),
      hotspotPercent: Number(hotspot?.dataset.practicePercent),
      completed: Number(progress?.dataset.practiceCompleted),
      total: Number(progress?.dataset.practiceTotal),
      percent: Number(progress?.dataset.practicePercent),
    };
  })()`, true);
  if (initialHomePracticeProgress.hotspotCompleted !== 0
    || initialHomePracticeProgress.hotspotTotal !== 19
    || initialHomePracticeProgress.hotspotPercent !== 0
    || initialHomePracticeProgress.completed !== 0
    || initialHomePracticeProgress.total !== 19
    || initialHomePracticeProgress.percent !== 0) {
    throw new Error(`Initial Home practice progress is not 0/19: ${JSON.stringify(initialHomePracticeProgress)}`);
  }
  await assertHoverTint(window, '[data-testid="home-practice-hotspot"]');
  await capture(window, outputDir, shot("home-hover-practice"));
  await click(window, '[data-testid="home-practice-hotspot"]');
  await waitFor(window, '.practice-screen[data-practice-recording="save"][data-practice-difficulty="guided"][data-practice-lesson="1"][data-practice-lessons-completed="0"]');
  await waitFor(window, '[data-testid="practice-lesson-content"]');
  await waitFor(window, '[data-testid="practice-mastery-feedback"][data-mastery-status="not-started"][data-mastery-completed-lessons="0"][data-mastery-block-attempts="0"][data-mastery-block-correct="0"][data-mastery-attempts-remaining="5"][data-mastery-correct-needed="4"][data-mastery-can-pass="true"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-callsign-rx"][data-practice-mode-completed="0"][data-practice-mode-total="4"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-manual-tx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-paddle-tx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  const initialPracticeOverview = await window.webContents.executeJavaScript(`(() => ({
    modes: Object.fromEntries(["character-rx", "callsign-rx", "manual-tx", "paddle-tx"].map((mode) => {
      const node = document.querySelector('[data-testid="practice-mode-option-' + mode + '"]');
      return [mode, {
        completed: Number(node?.dataset.practiceModeCompleted),
        total: Number(node?.dataset.practiceModeTotal),
        percent: Number(node?.dataset.practiceModePercent),
      }];
    })),
    weakReviewAvailable: document.querySelector('[data-testid="practice-weak-review"]')?.dataset.weakReviewAvailable ?? null,
    weakReviewTargets: document.querySelector('[data-testid="practice-weak-review"]')?.dataset.weakReviewTargets ?? null,
  }))()`, true);
  const expectedInitialPracticeOverview = {
    "character-rx": { completed: 0, total: 5, percent: 0 },
    "callsign-rx": { completed: 0, total: 4, percent: 0 },
    "manual-tx": { completed: 0, total: 5, percent: 0 },
    "paddle-tx": { completed: 0, total: 5, percent: 0 },
  };
  if (JSON.stringify(initialPracticeOverview.modes) !== JSON.stringify(expectedInitialPracticeOverview)
    || initialPracticeOverview.weakReviewAvailable !== "false"
    || initialPracticeOverview.weakReviewTargets !== "") {
    throw new Error(`Initial four-mode curriculum overview is incomplete: ${JSON.stringify(initialPracticeOverview)}`);
  }
  await capture(window, outputDir, shot("practice-overview-initial"));
  const persistentPracticeIdentity = await window.webContents.executeJavaScript(`(() => ({
    recording: document.querySelector(".practice-screen")?.dataset.practiceRecording ?? null,
    difficulty: document.querySelector(".practice-screen")?.dataset.practiceDifficulty ?? null,
    lesson: Number(document.querySelector(".practice-screen")?.dataset.practiceLesson),
    completedLessons: Number(document.querySelector(".practice-screen")?.dataset.practiceLessonsCompleted),
    lessonNew: document.querySelector(".practice-screen")?.dataset.practiceLessonNew ?? "",
    lessonPool: document.querySelector(".practice-screen")?.dataset.practiceLessonPool ?? "",
    masteryAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryAttempts),
    masteryCorrect: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryCorrect),
    masteryRemaining: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryRemaining),
    masteryCanPass: document.querySelector(".practice-screen")?.dataset.practiceMasteryCanPass ?? null,
    statusText: document.querySelector(".practice-recording-status")?.textContent.trim() ?? "",
    callsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  if (persistentPracticeIdentity.recording !== "save"
    || persistentPracticeIdentity.difficulty !== "guided"
    || persistentPracticeIdentity.lesson !== 1
    || persistentPracticeIdentity.completedLessons !== 0
    || persistentPracticeIdentity.lessonNew !== "A,N,T,E"
    || persistentPracticeIdentity.lessonPool !== "A,N,T,E"
    || persistentPracticeIdentity.masteryAttempts !== 0
    || persistentPracticeIdentity.masteryCorrect !== 0
    || persistentPracticeIdentity.masteryRemaining !== 5
    || persistentPracticeIdentity.masteryCanPass !== "true"
    || !persistentPracticeIdentity.statusText.includes(persistentPracticeIdentity.callsign)) {
    throw new Error(`Active-save practice did not identify its record destination: ${JSON.stringify(persistentPracticeIdentity)}`);
  }
  await capture(window, outputDir, shot("practice-lesson-guidance"));

  const practiceTargets = [];
  let wrongPracticeTarget = null;
  for (let index = 0; index < 5; index += 1) {
    const question = await window.webContents.executeJavaScript(`(() => ({
      id: document.querySelector(".practice-screen")?.dataset.practiceQuestionId ?? "",
      target: document.querySelector(".practice-screen")?.dataset.practiceTarget ?? "",
      attempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
      lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
    }))()`, true);
    if (!question.id || !question.target || question.attempts !== index || question.lifetimeAttempts !== index) {
      throw new Error(`Practice question ${index + 1} did not start cleanly: ${JSON.stringify(question)}`);
    }
    practiceTargets.push(question.target);
    const intentionallyWrong = index === 4;
    const answer = intentionallyWrong ? (question.target === "E" ? "T" : "E") : question.target;
    if (intentionallyWrong) wrongPracticeTarget = question.target;
    await setInputValue(window, '[data-testid="practice-answer"]', answer);

    if (index === 0) {
      await window.webContents.executeJavaScript(`(() => {
        const submit = document.querySelector('[data-action="practice-submit"]');
        if (!submit) throw new Error("Missing practice submit button");
        submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      })()`, true);
    } else {
      await click(window, '[data-action="practice-submit"]');
    }
    await waitFor(window, `.practice-screen[data-practice-attempts="${index + 1}"][data-practice-lifetime-attempts="${index + 1}"]`);
    await waitFor(window, intentionallyWrong
      ? '.practice-screen[data-practice-result="wrong"]'
      : '.practice-screen[data-practice-result="correct"]');
    const settlement = await window.webContents.executeJavaScript(`(() => {
      const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
      const record = save.practiceRecords?.["character-rx"];
      return {
        sessionAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
        lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
        storedAttempts: Number(record?.attempts),
        storedCorrect: Number(record?.correct),
        submitDisabled: Boolean(document.querySelector('[data-action="practice-submit"]')?.disabled),
      };
    })()`, true);
    if (settlement.sessionAttempts !== index + 1 || settlement.lifetimeAttempts !== index + 1
      || settlement.storedAttempts !== index + 1 || settlement.storedCorrect !== (intentionallyWrong ? 4 : index + 1)
      || !settlement.submitDisabled) {
      throw new Error(`Practice settlement ${index + 1} was duplicated or lost: ${JSON.stringify(settlement)}`);
    }
    if (index < 4) {
      await click(window, '[data-action="practice-next"]');
      await waitFor(window, '.practice-screen[data-practice-result="waiting"]');
    }
  }

  const guidedLessonOneTargets = new Set(["A", "N", "T", "E"]);
  if (practiceTargets.some((target) => !guidedLessonOneTargets.has(target))
    || new Set(practiceTargets.slice(0, 4)).size !== 4) {
    throw new Error(`Guided lesson one leaked a locked target or duplicated its first bag: ${JSON.stringify(practiceTargets)}`);
  }
  await waitFor(window, '[data-testid="practice-summary-modal"][data-summary-attempts="5"][data-summary-lesson="1"][data-summary-lesson-passed="true"][data-summary-next-lesson="2"]');
  const completedPracticeState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["character-rx"];
    const modal = document.querySelector('[data-testid="practice-summary-modal"]');
    return {
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      difficulty: record?.difficulty ?? null,
      lesson: Number(record?.lesson),
      completedLessons: Number(record?.completedLessons),
      lessonAttempts: Number(record?.lessonAttempts),
      weaknesses: record?.weaknesses ?? {},
      recentTargets: record?.recentTargets ?? [],
      summaryAttempts: Number(modal?.dataset.summaryAttempts),
      summaryCorrect: Number(modal?.dataset.summaryCorrect),
    };
  })()`, true);
  const expectedRecentTargets = practiceTargets.slice(-4);
  if (completedPracticeState.attempts !== 5 || completedPracticeState.correct !== 4
    || completedPracticeState.difficulty !== "guided"
    || completedPracticeState.lesson !== 2 || completedPracticeState.completedLessons !== 1
    || completedPracticeState.lessonAttempts !== 0
    || completedPracticeState.summaryAttempts !== 5 || completedPracticeState.summaryCorrect !== 4
    || Number(completedPracticeState.weaknesses[wrongPracticeTarget]) < 1
    || JSON.stringify(completedPracticeState.recentTargets) !== JSON.stringify(expectedRecentTargets)
    || !completedPracticeState.recentTargets.includes(wrongPracticeTarget)) {
    throw new Error(`Practice summary or durable weak/recent record is incomplete: ${JSON.stringify({ practiceTargets, wrongPracticeTarget, completedPracticeState })}`);
  }
  await capture(window, outputDir, shot("practice-session-summary"));

  await click(window, '[data-action="practice-summary-continue"]');
  await waitFor(window, '.practice-screen[data-practice-result="waiting"][data-practice-difficulty="guided"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-new="I,M,S,O"]');
  await waitFor(window, '[data-testid="practice-mastery-feedback"][data-mastery-status="not-started"][data-mastery-completed-lessons="1"][data-mastery-attempts-remaining="5"][data-mastery-correct-needed="4"][data-mastery-can-pass="true"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, `[data-testid="practice-weak-review"][data-weak-review-available="true"][data-weak-review-active="false"][data-weak-review-targets="${wrongPracticeTarget}"]`);
  const completedOverviewState = await window.webContents.executeJavaScript(`(() => {
    const character = document.querySelector('[data-testid="practice-mode-option-character-rx"]');
    const otherModes = ["callsign-rx", "manual-tx", "paddle-tx"].map((mode) => {
      const node = document.querySelector('[data-testid="practice-mode-option-' + mode + '"]');
      return {
        mode,
        completed: Number(node?.dataset.practiceModeCompleted),
        total: Number(node?.dataset.practiceModeTotal),
        percent: Number(node?.dataset.practiceModePercent),
      };
    });
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const records = save.practiceRecords ?? {};
    return {
      character: {
        completed: Number(character?.dataset.practiceModeCompleted),
        total: Number(character?.dataset.practiceModeTotal),
        percent: Number(character?.dataset.practiceModePercent),
      },
      otherModes,
      aggregateCompleted: Object.values(records).reduce((sum, record) => sum + Number(record?.completedLessons || 0), 0),
    };
  })()`, true);
  if (JSON.stringify(completedOverviewState.character) !== JSON.stringify({ completed: 1, total: 5, percent: 20 })
    || completedOverviewState.otherModes.some(({ completed, percent }) => completed !== 0 || percent !== 0)
    || completedOverviewState.aggregateCompleted !== 1) {
    throw new Error(`Completed lesson did not update the four-mode overview to 1/5 and aggregate 1/19: ${JSON.stringify(completedOverviewState)}`);
  }
  await capture(window, outputDir, shot("practice-overview-after-lesson"));

  // The single miss above exposes one durable weak target. The review locks
  // that pool for five questions and must never mutate the formal lesson block.
  await click(window, '[data-testid="practice-weak-review"]');
  await waitFor(window, `.practice-screen[data-practice-session-type="weakness-review"][data-practice-review-targets="${wrongPracticeTarget}"][data-practice-weak-review-available="true"][data-practice-review-recovered="0"][data-practice-review-remaining="1"][data-practice-attempts="0"][data-practice-lifetime-attempts="5"][data-practice-lifetime-correct="4"]`);
  await waitFor(window, `[data-testid="practice-weak-review"][data-weak-review-active="true"][data-weak-review-targets="${wrongPracticeTarget}"][data-weak-review-recovered="0"][data-weak-review-remaining="1"]`);
  const lockedWeakReviewControls = await window.webContents.executeJavaScript(`(() => ({
    modeButtons: Array.from(document.querySelectorAll("[data-practice-mode-option]"))
      .map((node) => ({ mode: node.dataset.practiceModeOption, disabled: Boolean(node.disabled) })),
    endDisabled: Boolean(document.querySelector('[data-action="practice-end"]')?.disabled),
  }))()`, true);
  if (lockedWeakReviewControls.modeButtons.length !== 4
    || lockedWeakReviewControls.modeButtons.some(({ disabled }) => !disabled)
    || !lockedWeakReviewControls.endDisabled) {
    throw new Error(`Weakness review did not lock mode switching and early completion: ${JSON.stringify(lockedWeakReviewControls)}`);
  }
  await capture(window, outputDir, shot("practice-weak-recovery-review"));

  const weakReviewTargets = [];
  for (let index = 0; index < 5; index += 1) {
    const question = await window.webContents.executeJavaScript(`(() => ({
      id: document.querySelector(".practice-screen")?.dataset.practiceQuestionId ?? "",
      target: document.querySelector(".practice-screen")?.dataset.practiceTarget ?? "",
      sessionType: document.querySelector(".practice-screen")?.dataset.practiceSessionType ?? null,
      reviewTargets: document.querySelector(".practice-screen")?.dataset.practiceReviewTargets ?? "",
      attempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
      lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
      lifetimeCorrect: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeCorrect),
      recovered: Number(document.querySelector(".practice-screen")?.dataset.practiceReviewRecovered),
      remaining: Number(document.querySelector(".practice-screen")?.dataset.practiceReviewRemaining),
    }))()`, true);
    if (!question.id || question.target !== wrongPracticeTarget
      || question.sessionType !== "weakness-review" || question.reviewTargets !== wrongPracticeTarget
      || question.attempts !== index || question.lifetimeAttempts !== 5 + index
      || question.lifetimeCorrect !== 4 + index
      || question.recovered !== Math.min(index, 1)
      || question.remaining !== Math.max(1 - index, 0)) {
      throw new Error(`Weakness-review question ${index + 1} escaped its fixed pool or lost lifetime state: ${JSON.stringify(question)}`);
    }
    weakReviewTargets.push(question.target);
    await setInputValue(window, '[data-testid="practice-answer"]', question.target);
    await click(window, '[data-action="practice-submit"]');
    await waitFor(window, `.practice-screen[data-practice-session-type="weakness-review"][data-practice-review-recovered="1"][data-practice-review-remaining="0"][data-practice-attempts="${index + 1}"][data-practice-lifetime-attempts="${6 + index}"][data-practice-lifetime-correct="${5 + index}"]`);
    await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-recovered="1"][data-weak-review-remaining="0"]');
    await waitFor(window, '.practice-screen[data-practice-result="correct"]');
    const settlement = await window.webContents.executeJavaScript(`(() => {
      const record = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].practiceRecords?.["character-rx"];
      return {
        attempts: Number(record?.attempts),
        correct: Number(record?.correct),
        lesson: Number(record?.lesson),
        completedLessons: Number(record?.completedLessons),
        lessonAttempts: Number(record?.lessonAttempts),
        lessonCorrect: Number(record?.lessonCorrect),
      };
    })()`, true);
    if (settlement.attempts !== 6 + index || settlement.correct !== 5 + index
      || settlement.lesson !== 2 || settlement.completedLessons !== 1
      || settlement.lessonAttempts !== 0 || settlement.lessonCorrect !== 0) {
      throw new Error(`Weakness review mutated formal progress or lost a lifetime result: ${JSON.stringify(settlement)}`);
    }
    if (index < 4) {
      await click(window, '[data-action="practice-next"]');
      await waitFor(window, '.practice-screen[data-practice-session-type="weakness-review"][data-practice-result="waiting"]');
    }
  }
  if (weakReviewTargets.some((target) => target !== wrongPracticeTarget)) {
    throw new Error(`Weakness review did not keep its single-target fixed pool: ${JSON.stringify(weakReviewTargets)}`);
  }
  await waitFor(window, '[data-testid="practice-summary-modal"][data-summary-session-type="weakness-review"][data-summary-progression-eligible="false"][data-summary-attempts="5"][data-summary-correct="5"][data-summary-recovered="1"][data-summary-remaining-weakness="0"][data-summary-review-mastered="true"]');
  const completedWeakReviewState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["character-rx"];
    const modal = document.querySelector('[data-testid="practice-summary-modal"]');
    return {
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      lesson: Number(record?.lesson),
      completedLessons: Number(record?.completedLessons),
      lessonAttempts: Number(record?.lessonAttempts),
      lessonCorrect: Number(record?.lessonCorrect),
      weakness: Number(record?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      summarySessionType: modal?.dataset.summarySessionType ?? null,
      progressionEligible: modal?.dataset.summaryProgressionEligible ?? null,
      summaryAttempts: Number(modal?.dataset.summaryAttempts),
      summaryCorrect: Number(modal?.dataset.summaryCorrect),
      summaryRecovered: Number(modal?.dataset.summaryRecovered),
      summaryRemainingWeakness: Number(modal?.dataset.summaryRemainingWeakness),
      summaryReviewMastered: modal?.dataset.summaryReviewMastered ?? null,
    };
  })()`, true);
  if (completedWeakReviewState.attempts !== 10 || completedWeakReviewState.correct !== 9
    || completedWeakReviewState.lesson !== 2 || completedWeakReviewState.completedLessons !== 1
    || completedWeakReviewState.lessonAttempts !== 0 || completedWeakReviewState.lessonCorrect !== 0
    || completedWeakReviewState.weakness !== 0
    || completedWeakReviewState.summarySessionType !== "weakness-review"
    || completedWeakReviewState.progressionEligible !== "false"
    || completedWeakReviewState.summaryAttempts !== 5 || completedWeakReviewState.summaryCorrect !== 5
    || completedWeakReviewState.summaryRecovered !== 1
    || completedWeakReviewState.summaryRemainingWeakness !== 0
    || completedWeakReviewState.summaryReviewMastered !== "true") {
    throw new Error(`Weakness-review summary or formal-progress isolation failed: ${JSON.stringify(completedWeakReviewState)}`);
  }
  await capture(window, outputDir, shot("practice-weak-summary-recovered"));

  await click(window, '[data-action="practice-summary-continue"]');
  await waitFor(window, '.practice-screen[data-practice-session-type="lesson"][data-practice-result="waiting"][data-practice-lifetime-attempts="10"][data-practice-lifetime-correct="9"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-attempts="0"][data-practice-weak-review-available="false"][data-practice-review-targets=""][data-practice-review-recovered="0"][data-practice-review-remaining="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-available="false"][data-weak-review-active="false"][data-weak-review-targets=""][data-weak-review-recovered="0"][data-weak-review-remaining="0"]');
  await capture(window, outputDir, shot("practice-weak-cleared"));
  await click(window, '[data-action="practice-back"]');
  await waitFor(window, ".home-screen");
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="1"][data-practice-total="19"][data-practice-percent="5"]');
  await capture(window, outputDir, shot("home-after-practice"));

  await window.reload();
  await waitFor(window, ".start-screen");
  await delay(250);
  const practiceReloadState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      attempts: Number(save.practiceRecords?.["character-rx"]?.attempts),
      correct: Number(save.practiceRecords?.["character-rx"]?.correct),
      difficulty: save.practiceRecords?.["character-rx"]?.difficulty ?? null,
      lesson: Number(save.practiceRecords?.["character-rx"]?.lesson),
      completedLessons: Number(save.practiceRecords?.["character-rx"]?.completedLessons),
      lessonAttempts: Number(save.practiceRecords?.["character-rx"]?.lessonAttempts),
      lessonCorrect: Number(save.practiceRecords?.["character-rx"]?.lessonCorrect),
      weakness: Number(save.practiceRecords?.["character-rx"]?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      notificationCount: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    };
  })()`, true);
  if (practiceReloadState.attempts !== 10 || practiceReloadState.correct !== 9
    || practiceReloadState.difficulty !== "guided"
    || practiceReloadState.lesson !== 2 || practiceReloadState.completedLessons !== 1
    || practiceReloadState.lessonAttempts !== 0 || practiceReloadState.lessonCorrect !== 0
    || practiceReloadState.weakness !== 0
    || practiceReloadState.notificationCount !== 0) {
    throw new Error(`Practice lifetime record or reload notification policy failed: ${JSON.stringify(practiceReloadState)}`);
  }
  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, '.practice-screen[data-practice-recording="save"][data-practice-session-type="lesson"][data-practice-lifetime-attempts="10"][data-practice-lifetime-correct="9"][data-practice-difficulty="guided"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-attempts="0"][data-practice-weak-review-available="false"][data-practice-review-targets=""][data-practice-review-remaining="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-available="false"][data-weak-review-active="false"][data-weak-review-targets=""][data-weak-review-remaining="0"]');
  await capture(window, outputDir, shot("practice-weak-cleared-reloaded"));
  await click(window, '[data-action="practice-back"]');
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="1"][data-practice-total="19"][data-practice-percent="5"]');
  await window.webContents.executeJavaScript(`(() => {
    window.__qaAchievementEvents = [];
    window.__qaAchievementLast = null;
    window.__qaAchievementObserver?.disconnect();
    const inspect = () => {
      const id = document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementId ?? null;
      if (id && id !== window.__qaAchievementLast) window.__qaAchievementEvents.push(id);
      window.__qaAchievementLast = id;
    };
    window.__qaAchievementObserver = new MutationObserver(inspect);
    window.__qaAchievementObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    inspect();
  })()`, true);
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");
  await waitFor(window, '[data-testid="qso-briefing-modal"]');
  await capture(window, outputDir, shot("qso-duty-briefing"));
  await click(window, '[data-action="start-guided-watch"]');
  await waitForMissing(window, '[data-testid="qso-briefing-modal"]');
  await waitFor(window, '[data-qso-phase="PLAYER_CQ"][data-receiver-active="true"]', 10000);
  const initialReceiverState = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
    receiverActive: document.querySelector(".station-screen")?.dataset.receiverActive ?? null,
    hasManualReceiveButton: Boolean(document.querySelector('[data-action="play-npc"]')),
    hiddenContact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (initialReceiverState.phase !== "PLAYER_CQ" || initialReceiverState.receiverActive !== "true"
    || initialReceiverState.hasManualReceiveButton || initialReceiverState.hiddenContact !== "---") {
    throw new Error(`Station did not enter automatic receive state: ${JSON.stringify(initialReceiverState)}`);
  }
  const accessoryReceiverState = await window.webContents.executeJavaScript(`(() => {
    const station = document.querySelector(".station-screen");
    return {
      accessoryId: station?.dataset.accessoryId ?? null,
      equipmentId: station?.dataset.equipmentId ?? null,
      equipmentPropagationBonus: Number(station?.dataset.equipmentPropagationBonus),
      equipmentNoiseGainMultiplier: Number(station?.dataset.equipmentNoiseGainMultiplier),
      equipmentQsbDepthMultiplier: Number(station?.dataset.equipmentQsbDepthMultiplier),
      playerEquipmentBonus: Number(station?.dataset.playerEquipmentBonus),
      noiseGain: Number(station?.dataset.channelNoiseGain),
      qsbDepth: Number(station?.dataset.channelQsbDepth),
      qsbDepthMultiplier: Number(station?.dataset.channelQsbDepthMultiplier),
      radioArt: document.querySelector('[data-testid="station-radio-art"]')?.getAttribute("src") ?? null,
    };
  })()`, true);
  if (accessoryReceiverState.accessoryId !== "cw-filter-500" || accessoryReceiverState.equipmentId !== "usdr-8"
    || accessoryReceiverState.equipmentPropagationBonus !== 0 || accessoryReceiverState.playerEquipmentBonus !== 0
    || Math.abs(accessoryReceiverState.equipmentNoiseGainMultiplier - 0.8) > 0.000001
    || Math.abs(accessoryReceiverState.equipmentQsbDepthMultiplier - 0.85) > 0.000001
    || Math.abs(accessoryReceiverState.noiseGain - 0.0338) > 0.000001
    || Math.abs(accessoryReceiverState.qsbDepthMultiplier - 0.85) > 0.000001
    || !(accessoryReceiverState.qsbDepth >= 0 && accessoryReceiverState.qsbDepth <= 0.765)
    || !accessoryReceiverState.radioArt?.includes("usdr-8-off.png")) {
    throw new Error(`Radio/accessory modifiers did not affect the open receiver: ${JSON.stringify(accessoryReceiverState)}`);
  }
  await capture(window, outputDir, shot("station-listening-warmup"));
  await capture(window, outputDir, shot("station-listening"));
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyX", key: "x", bubbles: true, cancelable: true }))`, true);
  await waitFor(window, '[data-testid="station-radio-art"][data-radio-art-state="tx"]');
  const txRadioArt = await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-testid="station-radio-art"]\')?.getAttribute("src") ?? null',
    true,
  );
  if (!txRadioArt?.includes("usdr-8-on.png")) throw new Error(`Radio TX artwork did not switch: ${txRadioArt}`);
  await capture(window, outputDir, shot("station-radio-tx"));
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyX", key: "x", bubbles: true, cancelable: true }))`, true);
  await delay(300);
  await click(window, '[data-action="clear-input"]');
  await sendAutomaticText(window, "E");
  const beforeClearInput = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
      decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
      logIds: (save.qsoLogs ?? []).map((entry) => entry.id),
    };
  })()`, true);
  if (beforeClearInput.pulseCount < 1 || !beforeClearInput.decoded) {
    throw new Error(`Could not prepare clear-input QA state: ${JSON.stringify(beforeClearInput)}`);
  }
  await click(window, '[data-action="clear-input"]');
  await delay(100);
  const afterClearInput = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
      decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
      logIds: (save.qsoLogs ?? []).map((entry) => entry.id),
    };
  })()`, true);
  if (afterClearInput.pulseCount !== 0 || afterClearInput.decoded
    || JSON.stringify(afterClearInput.logIds) !== JSON.stringify(beforeClearInput.logIds)) {
    throw new Error(`Clear input mutated logs or retained input: ${JSON.stringify({ beforeClearInput, afterClearInput })}`);
  }
  await capture(window, outputDir, shot("station-input-cleared"));
  const markStep = (step) => fs.writeFile(path.join(outputDir, "qa-step.txt"), `${step}\n`, "utf8");
  await markStep("station-listening");

  const playerIdentity = await window.webContents.executeJavaScript(`(() => ({
    player: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  const cqMessage = `CQ CQ DE ${playerIdentity.player} ${playerIdentity.player} K`;
  await sendAutomaticText(window, cqMessage);
  await markStep("cq-keyed");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const cqDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(cqMessage)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-cq-debug.json"), `${JSON.stringify(cqDebug, null, 2)}\n`, "utf8");
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-qso-phase="PLAYER_RST_AND_73"]', 10000);
  const firstRecoveryState = await window.webContents.executeJavaScript(`(() => ({
    failures: window.cwgameSystem?.getQaIncomingFailureCount?.() ?? 0,
    recovering: document.querySelector(".station-screen")?.dataset.npcPlaybackRecovering ?? null,
  }))()`, true);
  if (firstRecoveryState.failures !== 1 || firstRecoveryState.recovering !== "false") {
    throw new Error(`First incoming phase did not recover cleanly: ${JSON.stringify(firstRecoveryState)}`);
  }
  const stationIdentity = await window.webContents.executeJavaScript(`(() => ({
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? null,
    player: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
    shownContact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
    activeAreaLeaksCallsign: [".contact-card", ".qso-duty-coach", ".morse-display", ".signal-note"]
      .map((selector) => document.querySelector(selector)?.textContent ?? "")
      .join(" ")
      .includes(document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? "__NO_CALL__"),
  }))()`, true);
  if (!stationIdentity.npc || stationIdentity.shownContact !== "REMOTE" || stationIdentity.activeAreaLeaksCallsign) {
    throw new Error(`Blind-copy screen leaked the remote identity: ${JSON.stringify(stationIdentity)}`);
  }
  await capture(window, outputDir, shot("qso-blind-copy"));
  await markStep(`auto-response-${stationIdentity.npc}-${stationIdentity.player}`);

  await sendAutomaticText(window, "E");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-action="clear-and-retry"]', 10000);
  const retainedInvalidReply = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
    decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
    contact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (retainedInvalidReply.phase !== "PLAYER_RST_AND_73" || retainedInvalidReply.decoded !== "E" || retainedInvalidReply.contact !== "REMOTE") {
    throw new Error(`Invalid reply was not retained safely: ${JSON.stringify(retainedInvalidReply)}`);
  }
  await capture(window, outputDir, shot("qso-specific-error"));
  await click(window, '[data-action="clear-and-retry"]');

  await sendAutomaticText(window, "AGN K");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-qso-phase="PLAYER_RST_AND_73"][data-repeat-requests="1"]', 10000);
  const repeatedIncoming = await window.webContents.executeJavaScript(`(() => ({
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? null,
    repeatRequests: Number(document.querySelector(".station-screen")?.dataset.repeatRequests),
    contact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (repeatedIncoming.npc !== stationIdentity.npc || repeatedIncoming.repeatRequests !== 1 || repeatedIncoming.contact !== "REMOTE") {
    throw new Error(`AGN K did not replay the same hidden station: ${JSON.stringify(repeatedIncoming)}`);
  }
  await capture(window, outputDir, shot("qso-agn-repeat"));

  await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`);
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const secondReplyDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(`${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-second-reply-debug.json"), `${JSON.stringify(secondReplyDebug, null, 2)}\n`, "utf8");
  await click(window, '[data-action="submit-reply"]');
  await delay(120);
  const secondReplyPhase = await window.webContents.executeJavaScript(
    'document.querySelector(".station-screen")?.dataset.qsoPhase ?? null',
    true,
  );
  if (secondReplyPhase === "PLAYER_RST_AND_73") {
    await click(window, '[data-action="clear-input"]');
    await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`);
    await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
    await click(window, '[data-action="submit-reply"]');
  }
  await waitFor(window, ".qso-result-modal.success", 30000);
  await waitFor(window, ".qso-operation-review");
  await waitFor(window, ".qso-attempt-history > li.accepted");
  await waitFor(window, ".qso-attempt-history > li.error");
  await waitFor(window, ".qso-attempt-history > li.repeat");
  const recoveredIncomingState = await window.webContents.executeJavaScript(`(() => ({
    failures: window.cwgameSystem?.getQaIncomingFailureCount?.() ?? 0,
    recovering: document.querySelector(".station-screen")?.dataset.npcPlaybackRecovering ?? null,
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
  }))()`, true);
  if (recoveredIncomingState.failures !== 2 || recoveredIncomingState.recovering !== "false"
    || recoveredIncomingState.phase !== "QSO_COMPLETE") {
    throw new Error(`Expected both incoming phases to recover cleanly: ${JSON.stringify(recoveredIncomingState)}`);
  }
  await fs.writeFile(path.join(outputDir, "incoming-recovery-debug.json"), `${JSON.stringify({ firstRecoveryState, recoveredIncomingState }, null, 2)}\n`, "utf8");
  await capture(window, outputDir, shot("qso-result-unsaved-warmup"));
  await capture(window, outputDir, shot("qso-result-unsaved"));
  const resultReviewState = await window.webContents.executeJavaScript(`(() => ({
    accepted: document.querySelectorAll(".qso-attempt-history > li.accepted").length,
    errors: document.querySelectorAll(".qso-attempt-history > li.error").length,
    repeats: document.querySelectorAll(".qso-attempt-history > li.repeat").length,
    reward: document.querySelector(".qso-result-rewards strong")?.textContent.replace(/\\s+/g, " ").trim() ?? "",
  }))()`, true);
  if (resultReviewState.accepted < 2 || resultReviewState.errors < 1 || resultReviewState.repeats < 1
    || !resultReviewState.reward.includes("+100") || resultReviewState.reward.includes("+150")) {
    throw new Error(`Full-guidance operation review or reward is incomplete: ${JSON.stringify(resultReviewState)}`);
  }
  await capture(window, outputDir, shot("qso-operation-review"));
  await click(window, ".qso-result-primary");
  await waitFor(window, ".qso-result-modal.success header .icon-button", 10000);
  await waitFor(window, '[data-testid="achievement-notification"][data-achievement-id="qso-5"]', 10000);
  const achievementNotificationState = await window.webContents.executeJavaScript(`(() => ({
    visible: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    id: document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementId ?? null,
    queueSize: Number(document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementQueueSize),
    appearances: (window.__qaAchievementEvents ?? []).filter((id) => id === "qso-5").length,
    totalQsos: Number(JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qsoRecords?.total),
  }))()`, true);
  if (achievementNotificationState.visible !== 1 || achievementNotificationState.id !== "qso-5"
    || achievementNotificationState.queueSize < 1 || achievementNotificationState.appearances !== 1
    || achievementNotificationState.totalQsos !== 5) {
    throw new Error(`The qso-5 unlock notification was not queued exactly once: ${JSON.stringify(achievementNotificationState)}`);
  }
  await capture(window, outputDir, shot("achievement-qso-5-unlocked"));
  await click(window, '[data-action="dismiss-achievement-notification"]');
  await waitForMissing(window, '[data-testid="achievement-notification"][data-achievement-id="qso-5"]');
  for (let index = 0; index < 6; index += 1) {
    const hasQueuedNotification = await window.webContents.executeJavaScript(
      'Boolean(document.querySelector(\'[data-testid="achievement-notification"]\'))',
      true,
    );
    if (!hasQueuedNotification) break;
    await click(window, '[data-action="dismiss-achievement-notification"]');
    await delay(80);
  }
  await waitForMissing(window, '[data-testid="achievement-notification"]');
  await delay(250);
  const dismissedAchievementState = await window.webContents.executeJavaScript(`(() => ({
    visible: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    appearances: (window.__qaAchievementEvents ?? []).filter((id) => id === "qso-5").length,
  }))()`, true);
  if (dismissedAchievementState.visible !== 0 || dismissedAchievementState.appearances !== 1) {
    throw new Error(`Dismissed qso-5 notification reappeared: ${JSON.stringify(dismissedAchievementState)}`);
  }
  const savedEquipmentSnapshot = await window.webContents.executeJavaScript(
    `(() => {
      const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
      const entry = save.qsoLogs[0];
      return {
        version: entry.version,
        accessoryId: entry.accessoryId,
        equipmentId: entry.equipmentId,
        repeatRequests: entry.repeatRequests,
        transmitAccuracy: entry.transmitAccuracy,
        guidanceLevel: entry.guidanceLevel,
        visualAssistUsed: entry.visualAssistUsed,
        independentWatch: entry.independentWatch,
        creditsAwarded: entry.credits,
        saveCredits: save.credits,
        attemptResults: (entry.attemptHistory ?? []).map((attempt) => attempt.result),
        attemptMetricsComplete: (entry.attemptHistory ?? []).every((attempt) =>
          Number.isFinite(attempt.wpm) && Number.isFinite(attempt.accuracy) && Number.isFinite(attempt.rhythm)),
        firstWatchCompleted: save.firstWatchCompleted,
        totalQsos: save.qsoRecords?.total,
      };
    })()`,
    true,
  );
  const savedAttemptResults = new Set(savedEquipmentSnapshot.attemptResults);
  if (savedEquipmentSnapshot.version !== 3
    || savedEquipmentSnapshot.accessoryId !== "cw-filter-500" || savedEquipmentSnapshot.equipmentId !== "usdr-8"
    || savedEquipmentSnapshot.repeatRequests !== 1 || !Number.isFinite(savedEquipmentSnapshot.transmitAccuracy)
    || savedEquipmentSnapshot.guidanceLevel !== "full" || savedEquipmentSnapshot.visualAssistUsed !== true
    || savedEquipmentSnapshot.independentWatch !== false || savedEquipmentSnapshot.creditsAwarded !== 100
    || savedEquipmentSnapshot.saveCredits !== 1000
    || !savedAttemptResults.has("accepted") || !savedAttemptResults.has("rejected") || !savedAttemptResults.has("repeat")
    || !savedEquipmentSnapshot.attemptMetricsComplete
    || savedEquipmentSnapshot.firstWatchCompleted !== true || savedEquipmentSnapshot.totalQsos !== 5) {
    throw new Error(`QSO log v3 lost its review, eligibility, reward, or equipment snapshot: ${JSON.stringify(savedEquipmentSnapshot)}`);
  }
  await capture(window, outputDir, shot("qso-result-saved"));
  await click(window, ".qso-result-modal.success header .icon-button");

  await click(window, '.station-topbar .top-actions [data-action="back-home"]');
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await waitFor(window, ".qso-log-records button:nth-of-type(3)", 10000);
  await waitFor(window, ".qso-log-review");
  await waitFor(window, ".qso-log-review li.accepted");
  await waitFor(window, ".qso-log-review li.error");
  await waitFor(window, ".qso-log-review li.repeat");
  await capture(window, outputDir, shot("home-log-after-qso-warmup"));
  await capture(window, outputDir, shot("home-log-after-qso"));
  const homeReviewState = await window.webContents.executeJavaScript(`(() => ({
    accepted: document.querySelectorAll(".qso-log-review li.accepted").length,
    errors: document.querySelectorAll(".qso-log-review li.error").length,
    repeats: document.querySelectorAll(".qso-log-review li.repeat").length,
  }))()`, true);
  if (homeReviewState.accepted < 2 || homeReviewState.errors < 1 || homeReviewState.repeats < 1) {
    throw new Error(`Home log operation review is incomplete: ${JSON.stringify(homeReviewState)}`);
  }
  await capture(window, outputDir, shot("home-log-operation-review"));
  await click(window, ".qso-log-return");
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");

  await click(window, ".map-preview");
  await waitFor(window, ".map-modal");
  await capture(window, outputDir, shot("propagation-map"));
  await click(window, ".map-mode-buttons button:first-child");
  await waitFor(window, '[data-map-mode="world"]');
  await capture(window, outputDir, shot("world-map"));

  await window.reload();
  await waitFor(window, ".start-screen");
  await delay(350);
  const finalReloadState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      totalQsos: Number(save.qsoRecords?.total),
      practiceAttempts: Number(save.practiceRecords?.["character-rx"]?.attempts),
      practiceCorrect: Number(save.practiceRecords?.["character-rx"]?.correct),
      practiceDifficulty: save.practiceRecords?.["character-rx"]?.difficulty ?? null,
      practiceLesson: Number(save.practiceRecords?.["character-rx"]?.lesson),
      practiceLessonsCompleted: Number(save.practiceRecords?.["character-rx"]?.completedLessons),
      practiceLessonAttempts: Number(save.practiceRecords?.["character-rx"]?.lessonAttempts),
      practiceLessonCorrect: Number(save.practiceRecords?.["character-rx"]?.lessonCorrect),
      practiceWeakness: Number(save.practiceRecords?.["character-rx"]?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      notificationCount: document.querySelectorAll('[data-testid="achievement-notification"]').length,
      liveRegionCount: document.querySelectorAll('.achievement-notification-region[role="status"][aria-live="polite"]').length,
    };
  })()`, true);
  if (finalReloadState.totalQsos !== 5 || finalReloadState.practiceAttempts !== 10
    || finalReloadState.practiceCorrect !== 9
    || finalReloadState.practiceDifficulty !== "guided"
    || finalReloadState.practiceLesson !== 2 || finalReloadState.practiceLessonsCompleted !== 1
    || finalReloadState.practiceLessonAttempts !== 0 || finalReloadState.practiceLessonCorrect !== 0
    || finalReloadState.practiceWeakness !== 0
    || finalReloadState.notificationCount !== 0 || finalReloadState.liveRegionCount !== 1) {
    throw new Error(`Reload repeated an unlock or lost durable records: ${JSON.stringify(finalReloadState)}`);
  }
  await capture(window, outputDir, shot("reload-without-achievement-repeat"));

  await fs.writeFile(
    path.join(outputDir, "runtime-console-errors.json"),
    `${JSON.stringify(consoleErrors, null, 2)}\n`,
    "utf8",
  );
  window.webContents.removeListener("console-message", onConsoleMessage);

  return {
    outputDir,
    captures: [...[
      "start", "save-create", "home", "home-motion-a", "home-motion-b",
      "home-hover-store", "store-antenna", "store-radio", "store-accessory-insufficient",
      "home-hover-warehouse", "warehouse-radio", "warehouse-accessories",
      "warehouse-antenna-selected", "warehouse-antenna-equipped",
      "home-hover-achievements", "achievements-empty", "home-log-empty", "practice-session-only", "save-loaded", "store-accessory-owned", "store-radio-available", "store-radio-owned",
      "warehouse-accessory-selected", "warehouse-accessory-equipped", "warehouse-radio-selected", "warehouse-radio-equipped", "achievements-populated", "home-log-populated",
      "home-log-detail-second", "home-hover-practice", "practice-overview-initial", "practice-lesson-guidance", "practice-session-summary", "practice-overview-after-lesson", "practice-weak-recovery-review", "practice-weak-summary-recovered", "practice-weak-cleared", "home-after-practice", "practice-weak-cleared-reloaded", "qso-duty-briefing", "station-listening", "station-radio-tx", "station-input-cleared", "qso-blind-copy", "qso-specific-error", "qso-agn-repeat", "qso-result-unsaved", "qso-operation-review", "achievement-qso-5-unlocked", "qso-result-saved", "home-log-after-qso", "home-log-operation-review", "propagation-map", "world-map", "reload-without-achievement-repeat",
    ].map(shot), ...manualCaptures],
  };
}

module.exports = { runQaCapture };
