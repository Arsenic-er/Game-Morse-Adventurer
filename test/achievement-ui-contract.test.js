import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import test from "node:test";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { createServer } from "vite";

const source = readFileSync(
  new URL("../src/screens/AchievementsModal.jsx", import.meta.url),
  "utf8",
);

test("the achievement modal resolves localized reward copy in render scope", () => {
  const modalSource = source.slice(source.indexOf("export function AchievementsModal"));
  assert.match(
    modalSource,
    /const rewardText = REWARD_TEXT\[language\] \?\? REWARD_TEXT\.en;/,
  );
  const keyHandler = modalSource.match(/function handleKeyDown\(event\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
  assert.doesNotMatch(keyHandler, /const rewardText/);
});

test("an empty achievement queue keeps the lazy polite live region mounted", async () => {
  const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  try {
    const { App } = await vite.ssrLoadModule("/src/App.jsx");
    const html = await new Promise((resolve, reject) => {
      const output = new PassThrough();
      let rendered = "";
      output.setEncoding("utf8");
      output.on("data", (chunk) => { rendered += chunk; });
      output.on("end", () => resolve(rendered));
      const stream = renderToPipeableStream(React.createElement(App), {
        onAllReady() { stream.pipe(output); },
        onError(error) { reject(error); },
      });
    });

    assert.match(html, /class="achievement-notification-region"/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.doesNotMatch(html, /data-testid="achievement-notification"/);
  } finally {
    await vite.close();
  }
});
