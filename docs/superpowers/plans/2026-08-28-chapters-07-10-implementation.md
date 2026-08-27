# Chapters 7–10 Implementation Plan

> **Execution contract:** Use `superpowers:executing-plans` to implement this plan task-by-task in the isolated `agent/chapters-07-10` worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete playable Chapters 7–10 with durable state, deterministic structured-message rules, seven-language interfaces, idempotent rewards, and packaged Windows QA evidence.

**Architecture:** Add one bounded continuation-state envelope and one shared deterministic field parser, then build four independent pure chapter engines with their own settlement proofs and lazy-loaded screens. Mission progression consumes only chapter-specific bounded proofs; App coordinates persistence and routes without owning chapter rules.

**Tech Stack:** React 19, Vite 6, Electron 43, Node 24 built-in test runner, existing cwformer ONNX runtime, pure JavaScript game modules, CSS pixel design system.

**Spec:** `docs/superpowers/specs/2026-08-28-chapters-07-10-design.md`

## Global Constraints

- Final release version is `0.40.0`; Chapters 11–15 and open-station mode remain out of scope.
- Windows x64 portable must remain offline, unsigned, source-available proprietary, and usable without GPU or network.
- On-air gameplay uses real Space or Z/X key events; no test helper may write decoded text, pulse state, focus state, or chapter phase.
- cwformer may veto with `safeToCommit=false` but may never supply missing hard fields.
- No player free text, model prose, real emergency frequency, real emergency contact, or real address is persisted.
- Every retained array is bounded and own-property safe; holes, accessors, inherited slots, duplicates, invalid ordering, or exceptions fail closed.
- Migration cannot backfill chapter completion or increase money, technology points, QSO counts, relationship counts, achievements, or mission history.
- All chapter settlement and mission claim paths are idempotent and use safe-integer saturating rewards.
- Seven interface languages remain `zh-CN`, `zh-TW`, `ja`, `en`, `es`, `de`, and `ru`; every dictionary has the same non-empty shape.
- Every owned JavaScript output chunk must stay at or below `512000` bytes.
- Packaged QA must produce exactly 142 validated PNGs across 11 scopes with one run ID, console error count 0, and no failure or timeout marker.

### Test Fixture Conventions

- Every test file declares its own literal builders; no fixture is imported from production code unless the test is explicitly validating that production normalizer.
- Timestamps named `ISO` through `ISO6` are consecutive UTC instants beginning at `2026-08-28T00:00:00.000Z` and advancing one minute each.
- `safeSemantic()` returns a fresh frozen object with `safeToCommit: true`; hostile tests use a fresh object with `safeToCommit: false` and no production state is mutated.
- Helper names shown in snippets (`validCases`, `confirmedHillQsl`, `completedQslRun`, `completeContacts`, and render helpers) are local test builders declared immediately above their first use. Each builder must return a fully literal, normalized-shape object; it may not call the production function under test to manufacture the expected result.
- Sparse/accessor fixtures are created with `Object.defineProperty` and assert zero getter calls. Large-array fixtures expose a guarded `Proxy` and assert the documented retained-tail read ceiling.

---

### Task 1: Shared Structured Fields and Continuation State

**Files:**
- Create: `src/game/structuredMessage.js`
- Create: `src/game/storyContinuationState.js`
- Create: `test/structured-message.test.js`
- Create: `test/story-continuation-state.test.js`

**Interfaces:**
- Produces: `tokenizeStructuredMessage(input, { maxCharacters, maxTokens }) -> readonly string[]`
- Produces: `parseStructuredFields(input, schema) -> { ok, fields, errors, tokens }`
- Produces: `STORY_CONTINUATION_STATE_VERSION`, `emptyStoryContinuationState()`, `normalizeStoryContinuationState(value)`
- Consumes later: chapter engines store only normalized substate returned by `normalizeStoryContinuationState`.

- [ ] **Step 1: Write parser RED tests**

```js
import { parseStructuredFields, tokenizeStructuredMessage } from "../src/game/structuredMessage.js";

test("structured fields accept one exact labelled value and reject conflicts", () => {
  const schema = Object.freeze({
    MSG: { pattern: /^\d{3}$/ },
    PRI: { values: ["1", "2", "3"] },
  });
  assert.deepEqual(parseStructuredFields("MSG 041 PRI 2 K", schema).fields, { MSG: "041", PRI: "2" });
  assert.equal(parseStructuredFields("MSG 041 MSG 042 PRI 2", schema).ok, false);
  assert.equal(tokenizeStructuredMessage("X".repeat(10_000)).join("").length <= 256, true);
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `node --test test/structured-message.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/game/structuredMessage.js`.

- [ ] **Step 3: Implement the deterministic parser**

```js
export function tokenizeStructuredMessage(input, { maxCharacters = 256, maxTokens = 64 } = {}) {
  return Object.freeze(String(input ?? "").toUpperCase().slice(0, maxCharacters)
    .replace(/[^A-Z0-9-]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, maxTokens));
}

export function parseStructuredFields(input, schema) {
  const tokens = tokenizeStructuredMessage(input);
  const entries = Object.entries(schema);
  const fields = Object.create(null);
  const errors = [];
  let cursor = 0;
  for (const [label, rule] of entries) {
    while (["DE", "PSE", "K", "KN", "AGN", "QRS"].includes(tokens[cursor])) cursor += 1;
    if (tokens[cursor] !== label || cursor + 1 >= tokens.length) {
      errors.push(`MISSING_${label}`);
      continue;
    }
    const value = tokens[cursor + 1];
    if (Object.hasOwn(fields, label)) errors.push(`DUPLICATE_${label}`);
    else if (rule.values && !rule.values.includes(value)) errors.push(`INVALID_${label}`);
    else if (rule.pattern && !rule.pattern.test(value)) errors.push(`INVALID_${label}`);
    else fields[label] = value;
    cursor += 2;
  }
  while (["DE", "PSE", "K", "KN", "AGN", "QRS"].includes(tokens[cursor])) cursor += 1;
  if (cursor !== tokens.length) errors.push("UNEXPECTED_TOKEN");
  return Object.freeze({ ok: errors.length === 0, fields: Object.freeze(fields), errors: Object.freeze(errors), tokens });
}
```

- [ ] **Step 4: Write continuation-state RED tests**

```js
test("continuation state is bounded, own-only, ordered, and JSON-idempotent", () => {
  const state = normalizeStoryContinuationState({
    chapter07: { cases: validCases(45), settledRunIds: validIds(105) },
  });
  assert.equal(state.chapter07.cases.length, 40);
  assert.equal(state.chapter07.settledRunIds.length, 100);
  assert.deepEqual(normalizeStoryContinuationState(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(normalizeStoryContinuationState(sparseOrAccessorLedger()), emptyStoryContinuationState());
});
```

- [ ] **Step 5: Run state tests and verify RED**

Run: `node --test test/story-continuation-state.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/game/storyContinuationState.js`.

- [ ] **Step 6: Implement the versioned envelope**

```js
export const STORY_CONTINUATION_STATE_VERSION = 1;
export function emptyStoryContinuationState() {
  return Object.freeze({
    version: 1,
    chapter07: emptyQslStoryState(),
    chapter08: emptyServiceNetState(),
    chapter09: emptyCoordinateRelayState(),
    chapter10: emptyContestState(),
  });
}
```

Start with local empty/normalizer helpers in this module; replace each local helper with the chapter module export when that chapter lands. Validate chronological ascending order before retaining a ledger.

- [ ] **Step 7: Run focused tests**

Run: `node --test test/structured-message.test.js test/story-continuation-state.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/structuredMessage.js src/game/storyContinuationState.js test/structured-message.test.js test/story-continuation-state.test.js
git commit -m "feat: add continuation state foundations"
```

### Task 2: Save Migration and Persistence Contract

**Files:**
- Modify: `src/game/saveStore.js`
- Modify: `test/save-store.test.js`
- Modify: `test/fixtures/save-v035-sanitized.json` only if the fixture assertion requires an explicit absent-field check; do not add fabricated continuation data.

**Interfaces:**
- Consumes: `STORY_CONTINUATION_STATE_VERSION`, `emptyStoryContinuationState`, `normalizeStoryContinuationState`.
- Produces: every normalized save has `storyContinuationStateVersion: 1` and `storyContinuationState`.

- [ ] **Step 1: Write migration RED tests**

```js
test("legacy saves gain an empty continuation state without retroactive value", () => {
  const legacy = { ...createSave(), money: 1234, technologyPoints: 7 };
  delete legacy.storyContinuationState;
  const once = normalizeSave(legacy);
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(once.storyContinuationState, emptyStoryContinuationState());
  assert.equal(once.money, 1234);
  assert.equal(once.technologyPoints, 7);
  assert.deepEqual(twice, once);
});
```

- [ ] **Step 2: Run save tests and verify RED**

Run: `node --test test/save-store.test.js`

Expected: FAIL because the normalized save lacks `storyContinuationStateVersion`.

- [ ] **Step 3: Wire defaults and normalization**

Add imports and the two fields to `createSave` and `normalizeSave`:

```js
storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
storyContinuationState: normalizeStoryContinuationState(save?.storyContinuationState),
```

- [ ] **Step 4: Run save and fixture tests**

Run: `node --test test/save-store.test.js test/story-continuation-state.test.js`

Expected: PASS with double normalization and no value drift.

- [ ] **Step 5: Commit**

```bash
git add src/game/saveStore.js test/save-store.test.js test/fixtures/save-v035-sanitized.json
git commit -m "feat: persist chapter continuation state"
```

### Task 3: Chapter 7 QSL Story Engine

**Files:**
- Create: `src/game/qslStoryRun.js`
- Create: `test/qsl-story-run.test.js`
- Modify: `src/game/storyContinuationState.js`
- Modify: `src/game/qslRecords.js`
- Modify: `test/qsl-records.test.js`

**Interfaces:**
- Produces: `QSL_STORY_PHASES`, `emptyQslStoryState()`, `normalizeQslStoryState(value)`.
- Produces: `createQslStoryRun({ sourceQsl, playerCallsign, startedAt })`.
- Produces: `reviewQslAccounts(run)`, `submitQslClarification(run, decoded, semanticResult, at)`, `receiveQslClarification(run, at)`, `confirmQslStoryChoice(run, choice, at)`, `retryQslStoryRun(run, at)`, `abandonQslStoryRun(run, at)`.
- Produces: new fixed narrative keys in the QSL allowlist; no API accepts persisted prose.

- [ ] **Step 1: Write phase and parser RED tests**

```js
test("Chapter 7 preserves the source choice and permits a different final stance", () => {
  let run = createQslStoryRun({ sourceQsl: confirmedHillQsl("believe"), playerCallsign: "BH1ABC", startedAt: ISO });
  run = reviewQslAccounts(run);
  run = submitQslClarification(run, "QSL HILL-1 DE BH1ABC PSE K", safeSemantic(), ISO2);
  run = receiveQslClarification(run, ISO3);
  run = confirmQslStoryChoice(run, "request-review", ISO4);
  assert.equal(run.phase, QSL_STORY_PHASES.COMPLETED);
  assert.equal(run.initialChoice, "believe");
  assert.equal(run.finalChoice, "request-review");
  assert.equal(run.sourceQslId, "qsl-hill-1");
});
```

Add tests for absent initial choice, wrong case ID, wrong callsign, `AGN K`, `QRS K`, unsafe semantic veto, three bounded errors, retry, abandon, hostile arrays, and JSON idempotency.

- [ ] **Step 2: Run Chapter 7 engine tests and verify RED**

Run: `node --test test/qsl-story-run.test.js test/qsl-records.test.js`

Expected: FAIL because `qslStoryRun.js` and new narrative keys do not exist.

- [ ] **Step 3: Implement the pure state machine**

Use frozen return values, deterministic run IDs derived from source QSL plus start time, fixed error enums, and a maximum of three failed clarification submissions. `AGN K` and `QRS K` repeat the same frozen reply and never reroll facts.

- [ ] **Step 4: Replace the local Chapter 7 state helper**

Import `emptyQslStoryState` and `normalizeQslStoryState` into `storyContinuationState.js`. Keep the aggregate interface unchanged.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/qsl-story-run.test.js test/qsl-records.test.js test/story-continuation-state.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/qslStoryRun.js src/game/qslRecords.js src/game/storyContinuationState.js test/qsl-story-run.test.js test/qsl-records.test.js test/story-continuation-state.test.js
git commit -m "feat: add chapter seven qsl story engine"
```

### Task 4: Chapter 7 Settlement and Mission Progression

**Files:**
- Create: `src/game/qslStorySettlement.js`
- Create: `test/qsl-story-settlement.test.js`
- Modify: `src/game/missionSystem.js`
- Modify: `test/mission-system.test.js`
- Modify: `src/qso/qsoLog.js`
- Modify: `test/qso-log.test.js`
- Modify: `src/qso/operatorRelationships.js`
- Modify: `test/operator-relationships.test.js`

**Interfaces:**
- Produces: `settleQslStoryRun(save, run, settledAt) -> { save, settled, reason, qsoId, moneyAwarded: 0 }`.
- Produces: `verifiedQslStoryCompletion(save, activeMission) -> boolean`.
- Extends: event QSO log with bounded `eventKind: "qsl-story"` while keeping schema migration safe.
- Extends: mission IDs through `story-07`, reward 750 money / 3 TP, prerequisite `story-06`.

- [ ] **Step 1: Write atomic settlement RED tests**

```js
test("QSL story settlement writes four linked facts once", () => {
  const first = settleQslStoryRun(storySixSave(), completedQslRun(), ISO5);
  assert.equal(first.settled, true);
  assert.equal(first.moneyAwarded, 0);
  assert.equal(first.save.qsoLogs.at(-1).eventKind, "qsl-story");
  assert.equal(first.save.qsoLogs.at(-1).eventRunId, completedQslRun().id);
  assert.equal(first.save.operatorRelationships.find((item) => item.personId === "person:sora").completedQsos, 1);
  assert.deepEqual(settleQslStoryRun(first.save, completedQslRun(), ISO6), { ...expectedNoOp(first.save) });
});
```

Add mismatched QSL/person/station/QSO/time, forged summary, missing proof, inherited fields, large-ledger, failed and abandoned run tests.

- [ ] **Step 2: Run settlement tests and verify RED**

Run: `node --test test/qsl-story-settlement.test.js test/qso-log.test.js test/operator-relationships.test.js`

Expected: FAIL because the settlement module and `eventKind` contract are missing.

- [ ] **Step 3: Implement settlement and event log normalization**

Create a zero-credit event log through the existing QSO identity functions, then atomically update relationship, Chapter 7 case, settled ID and proof. Any invalid dependency returns the original save reference.

- [ ] **Step 4: Write mission RED tests**

```js
test("story seven unlocks after story six and requires the dedicated proof", () => {
  const accepted = acceptMission(storySixClaimedWithQsl(), "story-07", ISO);
  assert.equal(accepted.accepted, true);
  assert.equal(missionBoard(accepted.save).story[6].status, "active");
  const settled = settleQslStoryRun(accepted.save, completedQslRun(), ISO5).save;
  assert.equal(missionBoard(settled).story[6].status, "ready");
  const claimed = claimMission(settled, "story-07", ISO6);
  assert.equal(claimed.moneyAwarded, 750);
  assert.equal(claimed.technologyPointsAwarded, 3);
  assert.equal(claimMission(claimed.save, "story-07", ISO6).reason, "MISSION_ALREADY_CLAIMED");
});
```

- [ ] **Step 5: Implement story-07 definition and verifier**

Add the exact four-way completion check and preserve the one-active-story rule. Claiming unlocks a bounded `peopleTaskTreeUnlocked` flag inside Chapter 7 state.

- [ ] **Step 6: Run Chapter 7 integration tests**

Run: `node --test test/qsl-story-settlement.test.js test/mission-system.test.js test/qso-log.test.js test/operator-relationships.test.js test/save-store.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/qslStorySettlement.js src/game/missionSystem.js src/qso/qsoLog.js src/qso/operatorRelationships.js test/qsl-story-settlement.test.js test/mission-system.test.js test/qso-log.test.js test/operator-relationships.test.js
git commit -m "feat: settle chapter seven qsl story"
```

### Task 5: Chapter 7 Screen and Seven-Language Story

**Files:**
- Create: `src/screens/QslStoryScreen.jsx`
- Create: `src/screens/qslStoryText.js`
- Create: `test/qsl-story-ui.test.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/screens/PeopleAndQslModal.jsx`
- Modify: `src/styles.css`
- Modify: `test/language-interface.test.js`
- Modify: `test/activity-unload-guard.test.js`

**Interfaces:**
- Screen props: `{ language, save, inputBlocked, onActivityRisk, onRunChange, onSettle, onConfirmSourceChoice, onBack }`.
- Route name: `qsl-story`.
- Mission action: `onEnterQslStory` appears only for accepted story-07 or unlocked replay.

- [ ] **Step 1: Write UI RED tests**

```js
test("Chapter 7 renders both accounts, real radio input, choices, and no portrait", async () => {
  const html = await renderQslStory({ language: "en", save: acceptedStorySevenSave() });
  assert.match(html, /data-testid="qsl-story-screen"/);
  assert.match(html, /data-player-account/);
  assert.match(html, /data-operator-account/);
  assert.match(html, /data-qsl-choice="request-review"/);
  assert.match(html, /data-portrait-visible="false"/);
});
```

Add seven-language shape, Esc pause, leave guard, 820 px CSS, source-choice-first, reload and no raw narrative-key output tests.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test test/qsl-story-ui.test.js test/language-interface.test.js test/activity-unload-guard.test.js`

Expected: FAIL because the screen and dictionary are missing.

- [ ] **Step 3: Implement lazy route and screen**

Follow `ExpeditionScreen` for activity lifecycle and real key input. The screen calls `window.cwgameSystem.interpretCwTraffic` with fixed catalogs containing only the current case ID and fixed identities; it passes the result to the pure engine.

- [ ] **Step 4: Wire persistence transactions in App**

Add `updateQslStoryRunForActiveSave`, `settleQslStoryForActiveSave`, and route props. Commit only normalized Chapter 7 state returned from the engine / settlement.

- [ ] **Step 5: Add localized mission, Home and People/QSL entry copy**

Add identical keys in all seven dictionaries for title, accounts, clarification, replay, final stance, failure reasons, pause, leave, settle and debrief.

- [ ] **Step 6: Run focused UI and build**

Run: `node --test test/qsl-story-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js test/activity-unload-guard.test.js && pnpm build`

Expected: PASS and largest owned JS ≤ 512000 bytes.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/screens/QslStoryScreen.jsx src/screens/qslStoryText.js src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/screens/PeopleAndQslModal.jsx src/styles.css test/qsl-story-ui.test.js test/language-interface.test.js test/activity-unload-guard.test.js
git commit -m "feat: complete chapter seven qsl story"
```

### Task 6: Chapter 8 Public-Service Engine, Settlement, and Mission

**Files:**
- Create: `src/game/serviceNetRun.js`
- Create: `src/game/serviceNetSettlement.js`
- Create: `test/service-net-run.test.js`
- Create: `test/service-net-settlement.test.js`
- Modify: `src/game/storyContinuationState.js`
- Modify: `src/game/missionSystem.js`
- Modify: `test/mission-system.test.js`

**Interfaces:**
- Produces: `SERVICE_NET_PHASES`, `emptyServiceNetState`, `normalizeServiceNetState`.
- Produces: `createServiceNetRun({ playerCallsign, seed, startedAt })`, `submitServiceNetText(run, decoded, semanticResult, at)`, `retryServiceNetRun`, `abandonServiceNetRun`.
- Produces: `settleServiceNetRun(save, run, settledAt)` and `verifiedServiceNetCompletion`.
- Extends mission: `story-08`, reward 850 money / 4 TP, prerequisite `story-07`.

- [ ] **Step 1: Write engine RED tests**

```js
test("service messages are frozen and acknowledged in priority order", () => {
  let run = createServiceNetRun({ playerCallsign: "BH1ABC", seed: "story-08", startedAt: ISO });
  run = submitServiceNetText(run, "BH1ABC CHECK IN K", safeSemantic(), ISO2);
  const first = run.messages[run.priorityOrder[0]];
  run = submitServiceNetText(run, `ACK ${first.messageId} PRI ${first.priority} K`, safeSemantic(), ISO3);
  assert.equal(run.receipts[0].messageId, first.messageId);
  assert.equal(run.phase, SERVICE_NET_PHASES.RECEIVE_MESSAGE);
});
```

Add deterministic three-message schedule, message shape, wrong ID, wrong priority, out-of-order, AGN, QRS, unsafe semantic, third-error failure, retry preserving facts, abandon, timer pause, hostile normalization and no real emergency content tests.

- [ ] **Step 2: Verify engine RED**

Run: `node --test test/service-net-run.test.js`

Expected: FAIL because `serviceNetRun.js` is absent.

- [ ] **Step 3: Implement engine and replace aggregate helper**

Use `parseStructuredFields` for check-in and acknowledgements. Freeze `SIM8PS` with procedural `npcId: "chapter08-net-control"`; store only fixed item enums and numbers.

- [ ] **Step 4: Write settlement and mission RED tests**

Assert one zero-credit event log, three exact receipts, dedicated proof, duplicate no-op, four-way mission verification, reward 850/4, task-tree unlock and replay with no reward.

- [ ] **Step 5: Implement settlement and story-08**

Reject partial, failed, abandoned, mismatched, inherited or chronologically invalid runs. Use safe-add claim logic already shared by missionSystem.

- [ ] **Step 6: Run Chapter 8 integration tests**

Run: `node --test test/structured-message.test.js test/service-net-run.test.js test/service-net-settlement.test.js test/mission-system.test.js test/save-store.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/serviceNetRun.js src/game/serviceNetSettlement.js src/game/storyContinuationState.js src/game/missionSystem.js test/service-net-run.test.js test/service-net-settlement.test.js test/mission-system.test.js test/save-store.test.js
git commit -m "feat: add chapter eight service net"
```

### Task 7: Chapter 8 Screen and Public-Service Task Entry

**Files:**
- Create: `src/screens/ServiceNetScreen.jsx`
- Create: `src/screens/serviceNetText.js`
- Create: `test/service-net-ui.test.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/styles.css`
- Modify: `test/language-interface.test.js`
- Modify: `test/activity-unload-guard.test.js`

**Interfaces:**
- Screen props mirror Chapter 7 and route name is `service-net`.
- DOM contract exposes phase, message ID, priority, receipt count, paused state and `data-simulation="fictional-public-service"`.

- [ ] **Step 1: Write UI RED tests**

Assert fictional-simulation warning, priority queue, current message, real key input controls, AGN/QRS guidance, failure/retry, result/settlement, no portrait, seven-language shape, Esc pause and narrow layout.

- [ ] **Step 2: Verify UI RED**

Run: `node --test test/service-net-ui.test.js test/language-interface.test.js`

Expected: FAIL because the screen and dictionary are absent.

- [ ] **Step 3: Implement screen, route and transactions**

Use a lazy route and the same focus / visibility lifecycle as Expedition. Semantic catalogs contain only frozen message IDs, priorities, item enums and current callsigns.

- [ ] **Step 4: Add Home and Mission actions**

Accepted story-08 launches the story run; claiming it leaves a durable public-service practice/task-tree entry. The replay entry cannot grant rewards.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/service-net-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js test/activity-unload-guard.test.js && pnpm build`

Expected: PASS within size budget.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/screens/ServiceNetScreen.jsx src/screens/serviceNetText.js src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/styles.css test/service-net-ui.test.js test/language-interface.test.js test/activity-unload-guard.test.js
git commit -m "feat: add chapter eight service screen"
```

### Task 8: Chapter 9 Coordinate Relay Engine, Settlement, and Mission

**Files:**
- Create: `src/game/coordinateRelayRun.js`
- Create: `src/game/coordinateRelaySettlement.js`
- Create: `test/coordinate-relay-run.test.js`
- Create: `test/coordinate-relay-settlement.test.js`
- Modify: `src/game/storyContinuationState.js`
- Modify: `src/game/missionSystem.js`
- Modify: `test/mission-system.test.js`

**Interfaces:**
- Produces: `computeCoordinatePacketCheck(fields) -> integer 0..96`.
- Produces: `createCoordinateRelayRun`, `submitCoordinateRelayText`, `retryCoordinateRelayRun`, `abandonCoordinateRelayRun`, state empty / normalizer exports.
- Produces: `settleCoordinateRelayRun`, `verifiedCoordinateRelayCompletion`.
- Extends mission: `story-09`, reward 950 money / 4 TP, prerequisite `story-08`.

- [ ] **Step 1: Write packet parser RED tests**

```js
test("coordinate packets validate grid, UTC, people and computed check", () => {
  const run = createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed: "story-09", startedAt: ISO });
  const packet = run.packet;
  assert.match(packet.grid, /^PX-\d{4}-\d{4}$/);
  assert.equal(packet.check, computeCoordinatePacketCheck(packet));
  assert.equal(submitCoordinateRelayText(run, correctReadback(packet), safeSemantic(), ISO2).phase, "RELAY_PACKET");
  assert.equal(submitCoordinateRelayText(run, wrongTimeReadback(packet), safeSemantic(), ISO2).lastError, "TIME_MISMATCH");
});
```

Add invalid `2400Z`, coordinate bounds, duplicate/reordered labels, forged check, AGN/QRS, field correction, three failures, frozen retry, second-station confirmation and hostile normalization tests.

- [ ] **Step 2: Verify engine RED**

Run: `node --test test/coordinate-relay-run.test.js`

Expected: FAIL because the coordinate module is absent.

- [ ] **Step 3: Implement engine and aggregate state**

Build checks from the canonical field string inside the module. Never accept a caller-provided computed check as truth. Use procedural station IDs `chapter09-source` and `chapter09-relay`.

- [ ] **Step 4: Write settlement / mission RED tests**

Require source log, relay log, packet archive, settled ID and dedicated proof to agree on run ID, both identities, fields and chronology. Test no-op, forged links, large arrays and reward 950/4.

- [ ] **Step 5: Implement settlement and story-09**

Claim sets `toolUnlocked=true`; the tool reads only archived canonical packets and fixed error keys.

- [ ] **Step 6: Run Chapter 9 integration tests**

Run: `node --test test/structured-message.test.js test/coordinate-relay-run.test.js test/coordinate-relay-settlement.test.js test/mission-system.test.js test/save-store.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/coordinateRelayRun.js src/game/coordinateRelaySettlement.js src/game/storyContinuationState.js src/game/missionSystem.js test/coordinate-relay-run.test.js test/coordinate-relay-settlement.test.js test/mission-system.test.js test/save-store.test.js
git commit -m "feat: add chapter nine coordinate relay"
```

### Task 9: Chapter 9 Screen and Structured Message Tool

**Files:**
- Create: `src/screens/CoordinateRelayScreen.jsx`
- Create: `src/screens/coordinateRelayText.js`
- Create: `src/screens/StructuredMessageLogModal.jsx`
- Create: `test/coordinate-relay-ui.test.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/styles.css`
- Modify: `test/language-interface.test.js`

**Interfaces:**
- Route name: `coordinate-relay`.
- Tool modal prop: `{ language, packets, onClose }`; it renders canonical fields only.

- [ ] **Step 1: Write UI RED tests**

Assert fictional Pixel Grid label, source and relay stages, fixed field correction, UTC and check display, no raw input in the tool, seven-language shape, real key controls, Esc pause, leave protection and 820 px layout.

- [ ] **Step 2: Verify UI RED**

Run: `node --test test/coordinate-relay-ui.test.js test/language-interface.test.js`

Expected: FAIL because the screen, tool and dictionary are absent.

- [ ] **Step 3: Implement screen, tool and route transactions**

Persist only engine output. The tool becomes visible only when `chapter09.toolUnlocked === true` and always normalizes packets before rendering.

- [ ] **Step 4: Add Mission and Home copy**

Add story launch, locked reason, replay and structured-tool buttons to all seven languages.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/coordinate-relay-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js test/activity-unload-guard.test.js && pnpm build`

Expected: PASS within size budget.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/screens/CoordinateRelayScreen.jsx src/screens/coordinateRelayText.js src/screens/StructuredMessageLogModal.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/styles.css test/coordinate-relay-ui.test.js test/language-interface.test.js
git commit -m "feat: add chapter nine relay screen"
```

### Task 10: Chapter 10 Contest Engine, Settlement, and Mission

**Files:**
- Create: `src/game/contestRun.js`
- Create: `src/game/contestSettlement.js`
- Create: `test/contest-run.test.js`
- Create: `test/contest-settlement.test.js`
- Modify: `src/game/storyContinuationState.js`
- Modify: `src/game/missionSystem.js`
- Modify: `test/mission-system.test.js`

**Interfaces:**
- Produces: `CONTEST_PHASES`, `CONTEST_MODES`, `createContestRun`, `selectContestMode`, `submitContestText`, `tickContestRun`, `finishContestRun`, `retryContestRun`, `abandonContestRun`, state empty / normalizer.
- Produces: `scoreContestRun(run) -> { score, grade, facts }`.
- Produces: `settleContestRun`, `verifiedContestCompletion`.
- Extends mission: `story-10`, reward 1100 money / 5 TP, prerequisite `story-09`.

- [ ] **Step 1: Write RUN/S&P and scoring RED tests**

```js
test("contest completion requires six unique contacts and both operating modes", () => {
  let run = createContestRun({ playerCallsign: "BH1ABC", seed: "story-10", startedAt: ISO });
  run = completeContacts(run, { RUN: 3, SP: 3, regions: ["JP", "CN", "US"] });
  const result = finishContestRun(run, ISO5);
  assert.equal(result.phase, CONTEST_PHASES.COMPLETED);
  assert.equal(scoreContestRun(result).facts.bothModes, true);
  assert.equal(new Set(result.contacts.map(({ personId }) => personId)).size, 6);
});
```

Add deterministic pile-up / S&P pools, hard exchange fields, serial progression, duplicate station, busted call, wrong region/power, interruption, AGN/QRS, five-minute monotonic timeout, pause, ten-contact cap, reachable complete/silver/gold, retry and hostile normalization tests.

- [ ] **Step 2: Verify engine RED**

Run: `node --test test/contest-run.test.js`

Expected: FAIL because the contest module is absent.

- [ ] **Step 3: Implement the pure contest engine**

Reuse only `parseStructuredFields`, procedural NPC catalog functions and deterministic Lights pile-up scheduling ideas. Do not import Lights story state or settlement. Every accepted contact freezes person/station identity and exchange facts.

- [ ] **Step 4: Write settlement / mission RED tests**

Assert six to ten zero-credit event QSO logs, one relationship update per new person, record / settled ID / proof consistency, personal-best improvement, duplicate settlement no-op, story reward 1100/5 and durable replay/task-tree unlock.

- [ ] **Step 5: Implement settlement and story-10**

Reject incomplete, failed, abandoned, duplicate-person, invalid-grade, mismatched-log and hostile ledger cases. A replay may improve best score but never reissue story claim value.

- [ ] **Step 6: Run Chapter 10 integration tests**

Run: `node --test test/structured-message.test.js test/contest-run.test.js test/contest-settlement.test.js test/mission-system.test.js test/qso-log.test.js test/operator-relationships.test.js test/save-store.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/contestRun.js src/game/contestSettlement.js src/game/storyContinuationState.js src/game/missionSystem.js test/contest-run.test.js test/contest-settlement.test.js test/mission-system.test.js test/qso-log.test.js test/operator-relationships.test.js test/save-store.test.js
git commit -m "feat: add chapter ten contest engine"
```

### Task 11: Chapter 10 RUN/S&P Screen and Contest Task Tree

**Files:**
- Create: `src/screens/ContestScreen.jsx`
- Create: `src/screens/contestText.js`
- Create: `test/contest-ui.test.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/styles.css`
- Modify: `test/language-interface.test.js`
- Modify: `test/activity-unload-guard.test.js`

**Interfaces:**
- Route name: `contest`.
- Screen exposes current mode, pile-up / station pool, frozen exchange, elapsed time, score facts, penalties and result.

- [ ] **Step 1: Write UI RED tests**

Assert RUN and S&P controls, real keying, caller selection, exchange fields, timer, duplicate / interruption feedback, result grades, no portrait, seven languages, Esc pause, leave guard and responsive controls.

- [ ] **Step 2: Verify UI RED**

Run: `node --test test/contest-ui.test.js test/language-interface.test.js`

Expected: FAIL because the screen and dictionary are absent.

- [ ] **Step 3: Implement lazy screen and App transactions**

Follow Lights for pile-up playback and Expedition for monotonic activity ticking. Do not share chapter state; only share pure scheduling / keying utilities.

- [ ] **Step 4: Add Mission and Home entries**

Accepted story-10 launches story mode. Claimed story exposes contest practice and task-tree entry without replay reward.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/contest-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js test/activity-unload-guard.test.js && pnpm build`

Expected: PASS within size budget.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/screens/ContestScreen.jsx src/screens/contestText.js src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/styles.css test/contest-ui.test.js test/language-interface.test.js test/activity-unload-guard.test.js
git commit -m "feat: complete chapter ten contest screen"
```

### Task 12: Expand Packaged QA from 102 to 142 Captures

**Files:**
- Modify: `electron/qa-capture.cjs`
- Modify: `scripts/run-packaged-qa.cjs`
- Modify: `.github/workflows/windows-portable.yml`
- Modify: `test/packaged-qa-segmentation-contract.test.cjs`
- Modify: `test/packaged-lights-qa-contract.test.cjs` only if the shared character-boundary helper contract changes.

**Interfaces:**
- `QA_SUPPORTED_SCOPES` becomes `full, bootstrap, inventory, equipment, practice, qso, expedition, qsl-story, service-net, coordinate-relay, contest`.
- New predecessor chain: `expedition → qsl-story → service-net → coordinate-relay → contest`; Lights remains independent.
- Root manifest requires 142 exact screenshots and chapter result JSON for all four new scopes.

- [ ] **Step 1: Write exact plan and supervisor RED tests**

```js
assert.deepEqual(QA_SUPPORTED_SCOPES, [
  "full", "bootstrap", "inventory", "equipment", "practice", "qso", "expedition",
  "qsl-story", "service-net", "coordinate-relay", "contest",
]);
assert.equal(buildQaSegmentPlan({ suffix: "1439x912" }).screenshots.length, 142);
```

Add exact 8/10/10/12 manifests, predecessor mismatch, run-ID mismatch, missing sentinel, missing result, nonzero console, bad PNG, timeout and fail-fast tests.

- [ ] **Step 2: Run QA contract and verify RED**

Run: `node --test test/packaged-qa-segmentation-contract.test.cjs`

Expected: FAIL with old scope list and 102 total.

- [ ] **Step 3: Add four real runner scopes**

Drive Mission Center and every screen through real DOM controls. For each scope capture entry, one field error, recovery, completion, settlement, claim, reload and duplicate no-op. Use existing character-boundary key helpers; no fixture may directly mark a run complete.

- [ ] **Step 4: Extend result validators**

Each chapter result validates literal gameplay facts and the common run ID. The root supervisor validates all 142 image paths, pixels, sentinels, state envelopes, result files and aggregated console errors before writing `qa-result.json`.

- [ ] **Step 5: Update workflow gates**

Keep build job read-only and release job tag-only. Change only capture count, exact scopes and result validation; do not weaken PNG, timeout, model or release checks.

- [ ] **Step 6: Run focused QA contracts**

Run: `node --test test/packaged-qa-segmentation-contract.test.cjs test/packaged-lights-qa-contract.test.cjs test/qsl-story-ui.test.js test/service-net-ui.test.js test/coordinate-relay-ui.test.js test/contest-ui.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add electron/qa-capture.cjs scripts/run-packaged-qa.cjs .github/workflows/windows-portable.yml test/packaged-qa-segmentation-contract.test.cjs test/packaged-lights-qa-contract.test.cjs
git commit -m "test: cover chapters seven through ten in packaged qa"
```

### Task 13: v0.40 Metadata, Documentation, and Release Contracts

**Files:**
- Modify: `package.json`
- Modify: `src/App.jsx`
- Modify: seven `README*.md` files
- Modify: `docs/CW_台站模拟游戏设计文档_v0.4.md`
- Modify: `docs/story-missions-open-station-v0.1.md`
- Create: `docs/release-v0.40-verification.md`
- Modify: `test/version-contract.test.js`
- Modify: `test/release-metadata.test.js`

**Interfaces:**
- All package, UI, QA and localized documentation versions become `0.40.0`.
- Documentation says Chapters 5–10 are implemented at their exact depth and Chapters 11–15 remain planned.

- [ ] **Step 1: Write version / boundary RED tests**

```js
test("v0.40 metadata marks chapters seven through ten complete and eleven through fifteen planned", () => {
  assert.equal(packageJson.version, "0.40.0");
  for (const readme of localizedReadmes()) {
    assert.match(readme, /0\.40\.0/);
    assert.match(readme, /11.{0,20}15.*planned|第 11.{0,20}15 章.*计划/s);
  }
});
```

- [ ] **Step 2: Run release tests and verify RED**

Run: `node --test test/version-contract.test.js test/release-metadata.test.js test/release-contract.test.cjs`

Expected: FAIL on version `0.37.0` and old chapter boundary copy.

- [ ] **Step 3: Update package, UI and seven localized summaries**

Preserve the unsigned, source-available proprietary, offline, model source and font-license statements in every README.

- [ ] **Step 4: Update design and story status**

Record exact implemented contracts for Chapters 7–10 and keep Chapters 11–15 explicitly non-playable. Do not rewrite historical v0.37 verification evidence.

- [ ] **Step 5: Create the v0.40 verification report skeleton with executed facts only**

Add release boundary and command checklist now; fill counts, hashes, evidence root and review findings only after Task 14 commands run.

- [ ] **Step 6: Run metadata tests**

Run: `node --test test/version-contract.test.js test/release-metadata.test.js test/release-contract.test.cjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json src/App.jsx README*.md docs/CW_台站模拟游戏设计文档_v0.4.md docs/story-missions-open-station-v0.1.md docs/release-v0.40-verification.md test/version-contract.test.js test/release-metadata.test.js
git commit -m "docs: prepare v0.40 chapter release"
```

### Task 14: Full Verification, Portable Evidence, and Final Review

**Files:**
- Modify: `docs/release-v0.40-verification.md`
- Modify only files required by reproducible Critical / Important review findings, with a failing test first.

**Interfaces:**
- Produces: one final source commit, portable EXE SHA-256, semantic smoke evidence and fresh 142-capture root.

- [ ] **Step 1: Run all source-level release gates**

```powershell
pnpm test
pnpm qso:simulate:poor
pnpm qso:calibrate
pnpm mission:economy
pnpm semantic:model:sync
pnpm build
```

Expected: zero failures, calibration issues 0, economy PASS, exact model / contract hashes, largest owned JS ≤ 512000 bytes.

- [ ] **Step 2: Build the portable executable once**

Run: `pnpm desktop:build`

Expected: exit 0 and `release/CWGame-latest.exe` present.

- [ ] **Step 3: Verify packaged semantic runtime and binary facts**

Run the workflow-equivalent `--semantic-smoke`, check MZ / PE, Authenticode `NotSigned`, app.asar font OFL files, model bytes, EXE size and SHA-256 sidecar.

- [ ] **Step 4: Run one fresh externally supervised 142-image QA chain**

Use a newly created exclusive temp root and visible Electron windows. Do not poll with foreground shells during focus-sensitive CW scopes. Require 11 exact segment sentinels, 142 unique manifest paths, approved pixel duplicate groups only, console 0, no failure / timeout and all four new result validators PASS.

- [ ] **Step 5: Run repository integrity checks**

Run `git diff --check`, changed-text secret / absolute-path scan, author / committer scan, lockfile diff audit and `git status --short`.

- [ ] **Step 6: Conduct broad code review and scoped re-review**

Review the whole branch against the spec, focusing on persistence trust boundaries, reward idempotency, emergency-simulation safety, field parsers, timer pause, contest uniqueness and packaged evidence. For each reproducible Critical / Important finding: add a RED test, implement the minimum fix, rerun focused and full gates, then re-review the fix range. Minor findings are recorded without blocking unless they affect the release contract.

- [ ] **Step 7: Fill the verification report from actual outputs**

Record exact test count, build bytes, JS maximum, EXE size / SHA, model hashes, QA root basename / run ID / scope counts, result facts, review findings and unsigned status. Do not copy v0.37 values.

- [ ] **Step 8: Commit the verified release**

```bash
git add docs/release-v0.40-verification.md
git diff --cached --check
git commit -m "release: verify v0.40 chapters seven through ten"
```

Any review-driven production fix is committed in its own RED/GREEN step before this report-only commit, staging the exact production file and its exact regression test together; never use a glob or `git add -A`.

- [ ] **Step 9: Stop before merge, push, tag, or GitHub Release**

Report the final commit, test/build/QA evidence and worktree status. Merge and push require the user's explicit instruction; tag and GitHub Release require a separate explicit instruction.
