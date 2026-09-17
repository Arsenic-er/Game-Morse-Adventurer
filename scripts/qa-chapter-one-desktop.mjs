import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chapterOneStoryText } from "../src/screens/chapterOneStoryText.js";
import { MORSE_CODE } from "../src/cw/morse.js";

const executable = path.resolve(process.argv[2] || "release-chapter-one/CWGame-ChapterOne-Review.exe");
const output = path.resolve("qa-artifacts-chapter-one-desktop");
const profile = path.join(os.tmpdir(), `cw-chapter-one-desktop-${Date.now()}`);
const port = 9446;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(output, { recursive: true });
const child = spawn(executable, [`--remote-debugging-port=${port}`], {
  windowsHide: true, stdio: "ignore",
  env: { ...process.env, CWGAME_CHAPTER_ONE_REVIEW_DATA: profile },
});
let socket;
let call;
try {
  let tab;
  for (let attempt = 0; attempt < 180; attempt++) {
    try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === "page"); } catch {}
    if (tab) break;
    await pause(500);
  }
  assert(tab, "packaged app exposes its renderer");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", ({ data }) => {
    const result = JSON.parse(data);
    if (result.method === "Runtime.exceptionThrown") exceptions.push(result.params);
    const request = pending.get(result.id);
    if (request) { clearTimeout(request.timer); pending.delete(result.id); result.error ? request.reject(new Error(JSON.stringify(result.error))) : request.resolve(result.result); }
  });
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async expression => {
    for (let attempt = 0; attempt < 400; attempt++) {
      try { if (await evaluate(`Boolean(${expression})`)) return; }
      catch (error) {
        if (!/navigated or closed|Execution context was destroyed|Cannot find context/.test(error.message)) throw error;
      }
      await pause(100);
    }
    throw new Error(`Timeout: ${expression}; ${await evaluate("document.body.innerText")}`);
  };
  const reload = async () => {
    await evaluate('window.__chapterQaReload = true');
    await call('Page.reload');
    await until(`window.__chapterQaReload !== true && document.querySelector('.vn-dialogue')`);
  };
  const click = async selector => { await until(`document.querySelector(${JSON.stringify(selector)})`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); };
  const save = () => evaluate(`JSON.parse(localStorage.getItem('game-morse-adventurer.saves.v1'))[0]`);
  const finishScene = async () => {
    for (let n = 0; n < 6; n++) {
      if (await evaluate(`document.querySelector('.vn-dialogue')?.dataset.vnReady === 'true'`)) break;
      await click('.vn-line'); await pause(80);
    }
    assert.equal(await evaluate(`document.querySelector('.vn-dialogue').dataset.vnReady`), 'true');
    await click('[data-action="chapter-one-primary"]');
  };
  const capture = async name => {
    await until(`Array.from(document.querySelectorAll('.vn-art > img')).every(image => image.complete && image.naturalWidth > 0)`);
    await pause(600);
    const shot = await call("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(shot.data, "base64"));
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await until(`location.protocol === 'file:' && document.querySelector('.vn-dialogue')`);
  await call("Network.enable");
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload();
  await call("Page.bringToFront");
  await until(`document.querySelector('[data-story-beat="silence"]')`);
  assert.equal(await evaluate("location.protocol"), "file:");
  assert.equal(await evaluate("window.cwgameSystem.chapterOneLocalReview"), true);
  assert.equal(await evaluate("window.cwgameSystem.qaCapture"), false);
  const initial = await save();
  assert.equal(initial.qsoLogs.length, 0);
  const semantic = await evaluate("window.cwgameSystem.getSemanticStatus()");
  assert.equal(semantic.available, true, JSON.stringify(semantic));
  assert.equal(semantic.provider, "onnxruntime-node");
  await until(`document.querySelector('.vn-dialogue')?.dataset.vnComplete === 'true'`);
  await capture("01-offline-opening");
  await evaluate('document.activeElement?.blur()');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await until(`document.querySelector('.vn-dialogue').dataset.vnLine === '1'`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', autoRepeat: true, windowsVirtualKeyCode: 32 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  assert.equal((await save()).chapterOnePresentation.beat, 'silence');
  await until(`document.querySelector('.vn-dialogue').dataset.vnReady === 'true'`);
  await evaluate(`document.querySelector('.vn-primary').focus()`);
  for (let repeat = 0; repeat < 3; repeat++) await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', autoRepeat: true, windowsVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal((await save()).chapterOnePresentation.beat, 'silence', 'focused next button also ignores held Enter');
  await click('[data-action="vn-auto"]');
  assert.equal(await evaluate(`document.querySelector('[data-action="vn-auto"]').getAttribute('aria-pressed')`), 'true');
  await pause(3000);
  assert.equal((await save()).chapterOnePresentation.beat, 'silence', 'auto cannot cross a scene boundary');
  await click('[data-action="vn-history"]');
  assert.equal(await evaluate(`document.querySelectorAll('.vn-history-entry').length`), 2);
  assert.equal(await evaluate(`document.querySelector('.vn-modal').innerText.includes(${JSON.stringify(chapterOneStoryText('zh-CN').beats[1].paragraphs[0])})`), false, 'unread lines are not in the backlog');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await until(`!document.querySelector('.vn-modal') && document.activeElement === document.querySelector('[data-action="vn-history"]')`);
  await click('[data-action="vn-hide"]');
  assert.equal(await evaluate(`document.querySelector('.vn-interface').hidden`), true);
  await click('.vn-restore');
  await until(`!document.querySelector('.vn-interface').hidden`);
  await finishScene();
  await until(`document.querySelector('[data-story-beat="operator"]')`);
  await click('.chapter-one-review-settings');
  const pausedLine = await evaluate(`document.querySelector('.vn-line-text').textContent`);
  await pause(500);
  assert.equal(await evaluate(`document.querySelector('.vn-line-text').textContent`), pausedLine, 'settings pauses typewriting');
  assert.equal(await evaluate(`document.querySelector('.visual-novel-screen').inert`), true);
  await click('.settings-modal header .icon-button');
  await until(`document.querySelector('.vn-dialogue').dataset.vnComplete === 'true'`);
  await capture('02a-galgame-portrait');
  await until(`Array.from(document.querySelectorAll('audio')).every(audio => !audio.error && Number.isFinite(audio.duration) && audio.duration > 0)`);
  await reload();
  await until(`document.querySelector('[data-story-beat="operator"]')`);
  assert.equal((await save()).id, initial.id);
  await click('[data-action="vn-auto"]');
  assert.equal(await evaluate(`document.querySelector('[data-action="vn-auto"]').getAttribute('aria-pressed')`), 'true');
  await until(`document.querySelector('.vn-dialogue').dataset.vnReady === 'true'`);
  assert.equal((await save()).chapterOnePresentation.beat, 'operator', 'auto reads lines but stops before changing the saved scene');
  await capture("02-offline-resume");
  console.log("PASS: offline assets, keyboard, held Enter, auto boundaries, backlog, settings pause");
  await click(".chapter-one-review-back");
  await until(`document.querySelector('[data-testid="chapter-one-local-menu"]')`);
  assert.equal(await evaluate("!!document.querySelector('.home-screen')"), false);
  await capture("03-local-review-menu");
  await click('[data-action="local-review-art"]');
  await until(`document.querySelector('[data-review-beat="silence"]')`);
  await capture("04-story-art-review");
  assert.equal((await save()).chapterOnePresentation.beat, "operator");
  await evaluate(`(() => { const select = document.querySelector('.vn-scene-select'); select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until(`document.querySelector('[data-review-beat="answer"]')`);
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="review-incoming-text"]')`), false, 'no future response before playback');
  for (let line = 0; line < 6; line++) {
    if (await evaluate(`document.querySelector('.vn-dialogue').dataset.vnReady === 'true'`)) break;
    await click('.vn-line'); await pause(80);
  }
  await click('[data-action="chapter-one-review-primary"]');
  await until(`document.querySelector('[data-testid="review-incoming-caption"]').dataset.status === 'receiving'`);
  await until(`document.querySelector('[data-review-beat="answer"]').dataset.toneActive === 'true'`);
  assert.equal(await evaluate(`document.querySelector('[data-testid="review-incoming-text"]').textContent`), 'SIM1OP DE SIM6JP 599 K');
  assert.match(await evaluate(`document.querySelector('[data-testid="review-incoming-meaning"]').textContent`), /发送方：SIM6JP/);
  await capture('06-live-incoming-caption');
  await click('[data-action="toggle-review-caption"]');
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="review-incoming-text"]')`), false);
  await click('[data-action="toggle-review-caption"]');
  await click('[data-action="vn-hide"]');
  assert.equal(await evaluate(`document.querySelector('[data-testid="review-incoming-caption"]').checkVisibility()`), false);
  await click('.vn-restore');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate(`(() => { const caption = document.querySelector('[data-testid="review-incoming-caption"]').getBoundingClientRect(); const dialogue = document.querySelector('.vn-dialogue').getBoundingClientRect(); return caption.left >= 0 && caption.right <= innerWidth && caption.bottom < dialogue.top && document.documentElement.scrollWidth <= innerWidth; })()`), true, 'caption fits above mobile dialogue');
  await capture('07-mobile-incoming-caption');
  await call('Emulation.clearDeviceMetricsOverride');
  await until(`document.querySelector('[data-testid="review-incoming-caption"]').dataset.status === 'received'`);
  assert.match(await evaluate(`document.querySelector('[data-action="chapter-one-review-primary"]').textContent`), /回报\s*599/);
  assert.equal((await save()).chapterOnePresentation.beat, "operator", 'caption and canned audio do not write formal progress');
  console.log('PASS: actual incoming audio, exact CW text, Chinese glossary, collapse/hide and mobile caption');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  for (const language of ['zh-CN', 'zh-TW', 'en', 'ja', 'es', 'de', 'ru']) {
    await evaluate(`localStorage.setItem('game-morse-adventurer.language.v1', ${JSON.stringify(language)})`);
    await reload();
    await until(`document.querySelector('[data-story-beat="operator"]')`);
    for (let line = 0; line < 5; line++) {
      if (await evaluate(`document.querySelector('.vn-dialogue').dataset.vnReady === 'true'`)) break;
      await click('.vn-line'); await pause(80);
    }
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `${language}: no horizontal overflow`);
    assert.equal(await evaluate(`(() => { const box = document.querySelector('.vn-dialogue').getBoundingClientRect(); const button = document.querySelector('.vn-primary').getBoundingClientRect(); return box.top >= 85 && button.top >= 0 && button.bottom <= innerHeight && button.right <= innerWidth; })()`), true, `${language}: dialogue and next action fit on screen`);
    await capture(`mobile-${language}`);
    console.log(`PASS: mobile layout ${language}`);
  }
  await evaluate(`localStorage.setItem('game-morse-adventurer.language.v1', 'zh-CN')`);
  await call('Emulation.clearDeviceMetricsOverride');
  await reload();
  await until(`document.querySelector('[data-story-beat="operator"]')`);
  await click(".chapter-one-review-back");
  await click('[data-action="local-review-reset"]');
  assert.equal((await save()).id, initial.id, "reset requires a second explicit click");
  await click('[data-action="local-review-confirm-reset"]');
  await until(`document.querySelector('[data-story-beat="silence"]')`);
  assert.notEqual((await save()).id, initial.id);
  await finishScene();
  await finishScene();
  await finishScene();
  await click('[data-action="start-guided-watch"]');
  await until(`document.querySelector('.station-screen')?.dataset.qsoPhase === 'PLAYER_CQ'`);
  await until(`document.querySelector('[data-testid="review-incoming-caption"]')`);
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="review-incoming-text"]')`), false, 'local station also waits for actual RX');
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
  await pause(20);
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
  await until(`Number(document.querySelector('.station-screen').dataset.pulseCount) > 0`);
  await capture("05-packaged-live-keyer");
  await click('[data-action="clear-input"]');
  const cq = 'CQ CQ DE SIM1OP K';
  const words = cq.split(' ');
  const steps = words.flatMap((word, wi) => [...word].map((char, ci) => ({ pattern: MORSE_CODE[char], gap: ci < word.length - 1 ? 1200 / 18 * 2 : wi < words.length - 1 ? 1200 / 18 * 6 : 0 })));
  await evaluate(`(async () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const channel = new MessageChannel(), waiters = [];
    channel.port1.onmessage = () => waiters.shift()?.();
    const yieldTask = () => new Promise(resolve => { waiters.push(resolve); channel.port2.postMessage(0); });
    const waitFor = async predicate => { const end = performance.now() + 8000; while (!predicate()) { if (performance.now() > end) throw new Error('Keyer did not settle'); await yieldTask(); } };
    try {
      document.activeElement?.blur();
      for (const { pattern, gap } of ${JSON.stringify(steps)}) {
        const before = Number(document.querySelector('.station-screen').dataset.pulseCount);
        for (const symbol of pattern) {
          const key = symbol === '.' ? 'z' : 'x', code = symbol === '.' ? 'KeyZ' : 'KeyX';
          window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
          const start = performance.now(); while (performance.now() - start < 8) {}
          window.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true, cancelable: true }));
          await yieldTask();
        }
        await waitFor(() => Number(document.querySelector('.station-screen').dataset.pulseCount) >= before + pattern.length);
        await waitFor(() => !!document.querySelector('[data-action="submit-reply"]:not([disabled])'));
        if (gap) await pause(gap);
      }
    } finally { channel.port1.close(); channel.port2.close(); }
  })()`);
  const keyedCq = await evaluate(`document.querySelector('.station-screen').dataset.decoded.trim().replace(/\\s+/g, ' ')`);
  assert.equal(keyedCq, cq, 'real desktop CW decoded before requesting the reply');
  await click('[data-action="submit-reply"]');
  await until(`document.querySelector('[data-testid="review-incoming-caption"]').dataset.status === 'receiving'`);
  assert.equal(await evaluate(`document.querySelector('.station-screen').dataset.visualAssistUsed`), 'true');
  const stationIncoming = await evaluate(`document.querySelector('[data-testid="review-incoming-text"]').textContent`);
  assert(stationIncoming.trim());
  await capture('08-station-real-incoming-caption');
  await click('[data-action="toggle-review-caption"]');
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="review-incoming-text"]')`), false);
  assert.equal(await evaluate(`document.querySelector('.station-screen').dataset.visualAssistUsed`), 'true', 'hiding cannot erase assistance');
  console.log('PASS: real local station CQ and incoming caption', JSON.stringify({ keyedCq, stationIncoming }));
  await click('[data-action="back-home"]');
  await pause(250);
  if (await evaluate(`!!document.querySelector('[data-action="confirm-qso-leave"]')`)) await click('[data-action="confirm-qso-leave"]');
  await until(`document.querySelector('[data-testid="chapter-one-local-menu"]')`);
  assert.equal((await save()).qsoLogs.length, 0);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  await writeFile(path.join(output, "evidence.json"), JSON.stringify({ passed: true, executable, offlineFileProtocol: true, isolatedProfile: profile, qaCapture: false, semantic, directFirstChapter: true, reloadResume: true, reviewDoesNotWriteProgress: true, resetRequiresConfirmation: true, realKeyEvents: true, incomingCaption: { rawCanned: 'SIM1OP DE SIM6JP 599 K', keyedCq, stationIncoming, collapse: true, mobile: true }, noMainGameMenu: true, exceptions }, null, 2));
  console.log(JSON.stringify({ passed: true, executable, output, semantic }));
} catch (error) {
  await writeFile(path.join(output, "evidence.json"), JSON.stringify({ passed: false, executable, error: error.stack }, null, 2));
  if (call) {
    const shot = await call('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (shot) await writeFile(path.join(output, 'failure.png'), Buffer.from(shot.data, 'base64'));
  }
  throw error;
} finally {
  if (call) await call("Runtime.evaluate", { expression: "setTimeout(() => window.close(), 100)" }).catch(() => {});
  socket?.close();
  await pause(1000);
  for (let attempt = 0; attempt < 30 && child.exitCode === null && child.signalCode === null; attempt++) await pause(500);
  if (child.exitCode === null && child.signalCode === null) child.kill();
  const root = path.resolve(os.tmpdir());
  const target = path.resolve(profile);
  if (path.dirname(target) !== root || !path.basename(target).startsWith("cw-chapter-one-desktop-")) throw new Error("Unsafe cleanup target");
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(error => console.warn(error.message));
}
