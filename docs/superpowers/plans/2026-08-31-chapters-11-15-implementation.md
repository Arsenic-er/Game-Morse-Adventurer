# Chapters 11–15 and Open Station Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Chapters 11–15, unlock a bounded Open Station dashboard, and release the fully verified offline Windows v0.45.0 prototype.

**Architecture:** Extend the existing continuation aggregate from Chapters 7–10 with five isolated run/settlement modules and one post-story aggregate. Every chapter follows the established pure-engine → atomic-settlement → mission-proof → lazy-screen path, while Chapter 15 deliberately reuses the ordinary QSO engine instead of creating a second full-watch implementation.

**Tech Stack:** React 19, JavaScript ESM, Node test runner, Vite, Electron, pnpm, existing `useCwCore`, local ONNX semantic IPC, deterministic save/mission engines.

**Spec:** `docs/superpowers/specs/2026-08-31-chapters-11-15-design.md`

## Global Constraints

- Mission order is exactly `story-11` → `story-12` → `story-13` → `story-14` → `story-15`.
- Chapter event QSOs pay zero ordinary-QSO rewards.
- On-air evidence comes only through `useCwCore` and real Space/Z/X events.
- No player prose, real emergency facts, arbitrary model fields, or portraits enter persisted radio state.
- All hostile collections are bounded before iteration and all persisted fields are own-data-property only.
- Duplicate settlement and duplicate claim return the original save reference or an exact no-op result.
- Old saves receive empty state and no retroactive value.
- Seven-language dictionaries remain shape-identical and non-empty.
- Every owned JavaScript chunk stays at or below 512,000 bytes.
- Final packaged evidence is 197 exact PNGs across 17 scopes, all bound to one QA UUID.

---

### Task 1: Continuation State v2 and Empty Chapter Aggregates

**Files:**
- Create: `src/game/listeningRun.js`
- Create: `src/game/stormRelayRun.js`
- Create: `src/game/nightOperationsRun.js`
- Create: `src/game/finalPromiseRun.js`
- Create: `src/game/firstPageState.js`
- Create: `src/game/openStationState.js`
- Modify: `src/game/storyContinuationState.js`
- Modify: `src/game/saveStore.js`
- Test: `test/story-continuation-state.test.js`
- Test: `test/save-store.test.js`

**Interfaces:**
- Produces `emptyListeningState`, `emptyStormRelayState`, `emptyNightOperationsState`, `emptyFinalPromiseState`, `emptyFirstPageState`, and `emptyOpenStationState`.
- Produces matching `normalize*Run` and `normalize*State` functions consumed by every later task.
- Advances `STORY_CONTINUATION_STATE_VERSION` from 1 to 2 without changing Chapters 7–10.

- [ ] **Step 1: Write failing migration and hostile-input tests**

```js
test("continuation v2 adds empty chapters eleven through fifteen without backfill", () => {
  const old = normalizeStoryContinuationState({ version: 1, chapter10: completedContestState() });
  assert.equal(old.version, 2);
  assert.deepEqual(old.chapter11, emptyListeningState());
  assert.deepEqual(old.chapter15, emptyFirstPageState());
  assert.deepEqual(old.openStation, emptyOpenStationState());
  assert.equal(old.chapter10.completedRuns.length, 1);
});

test("new continuation arrays reject holes accessors duplicates and inherited values", () => {
  const hostile = Object.create({ chapter11: forgedListeningState() });
  assert.deepEqual(normalizeStoryContinuationState(hostile), emptyStoryContinuationState());
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/story-continuation-state.test.js test/save-store.test.js`

Expected: FAIL because v2 fields and normalizers do not exist.

- [ ] **Step 3: Implement fixed empty aggregates and own-only normalizers**

Each state has this exact outer shape:

```js
Object.freeze({
  version: 1,
  activeRun: null,
  completedRuns: Object.freeze([]),
  settledRunIds: Object.freeze([]),
  settlementProofs: Object.freeze([]),
  archive: Object.freeze([]),
  taskTreeUnlocked: false,
});
```

`openStation` instead stores `{ version: 1, unlocked: false, firstGoal: null, activeGoal: null, goalUpdatedAt: null }`. Use the existing descriptor-safe helpers and keep ledgers sorted, unique, fixed-shape, and capped at 80.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/story-continuation-state.test.js test/save-store.test.js`

Expected: PASS with two consecutive `normalizeSave(JSON.parse(JSON.stringify(save)))` results deeply equal.

- [ ] **Step 5: Commit**

```bash
git add src/game/listeningRun.js src/game/stormRelayRun.js src/game/nightOperationsRun.js src/game/finalPromiseRun.js src/game/firstPageState.js src/game/openStationState.js src/game/storyContinuationState.js src/game/saveStore.js test/story-continuation-state.test.js test/save-store.test.js
git commit -m "feat: add final chapter state foundations"
```

### Task 2: Chapter 11 Listening Engine

**Files:**
- Modify: `src/game/listeningRun.js`
- Create: `test/listening-run.test.js`

**Interfaces:**
- Produces `createListeningRun`, `observeListeningWindow`, `submitListeningCall`, `finishListeningWait`, `recordListeningSilence`, `retryListeningRun`, `abandonListeningRun`, and `tickListeningRun`.
- Consumes the existing structured semantic result only as an unsafe-content veto.

- [ ] **Step 1: Write the pure-run RED tests**

```js
test("one directed call plus three listening windows can record silence", () => {
  let run = createListeningRun({ playerCallsign: "BH1ABC", seed: "story-11", startedAt: ISO });
  run = observeAllThree(run);
  run = submitListeningCall(run, "SIM11LS DE BH1ABC K", safeSemantic);
  run = finishListeningWait(run, ISO2);
  run = recordListeningSilence(run, ISO3);
  assert.equal(run.phase, "COMPLETED");
  assert.equal(run.summary.callCount, 1);
  assert.equal(run.summary.conclusionKey, "chapter11.conclusion.no-reply-after-listening");
});

test("a third call fails and no response can ever be fabricated", () => {
  const run = callThreeTimes(observeAllThree(createRun()));
  assert.equal(run.phase, "FAILED");
  assert.equal(run.failureReason, "CALL_LIMIT_EXCEEDED");
  assert.equal("response" in JSON.stringify(run), false);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/listening-run.test.js`

Expected: FAIL on missing engine exports.

- [ ] **Step 3: Implement the deterministic state machine**

Freeze target identity and three observation facts at creation. Validate the directed-call hard fields locally, cap calls at two, cap observations at three, use monotonic active milliseconds, pause on the shared activity predicate, and retain only fixed error keys.

- [ ] **Step 4: Add hostile, timeout, pause, retry, and idempotence cases**

Include 10,000-element proxy arrays, inherited identity, impossible phase chronology, repeated completion, timeout, abandon, and retry preserving the seed but clearing attempt work.

- [ ] **Step 5: Run and commit**

Run: `node --test test/listening-run.test.js test/story-continuation-state.test.js`

```bash
git add src/game/listeningRun.js test/listening-run.test.js
git commit -m "feat: add chapter eleven listening engine"
```

### Task 3: Chapter 11 Settlement and Mission

**Files:**
- Create: `src/game/listeningSettlement.js`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/missionEconomy.js`
- Create: `test/listening-settlement.test.js`
- Modify: `test/mission-system.test.js`
- Modify: `test/mission-economy.test.js`

**Interfaces:**
- Produces `settleListeningRun(save, run, settledAt)` and `verifiedListeningCompletion(save, activeMission)`.
- Adds `story-11`, reward 1,200 money / 5 TP, prerequisite `story-10`.

- [ ] **Step 1: Write settlement and verifier RED tests**

```js
test("Chapter 11 settlement writes monitoring proof but no QSO", () => {
  const result = settleListeningRun(acceptedSave(), completedRun(), ISO4);
  assert.equal(result.settled, true);
  assert.equal(result.save.qsoLog.length, acceptedSave().qsoLog.length);
  assert.equal(result.save.storyContinuationState.chapter11.archive.length, 1);
  assert.equal(getMissionProgress(result.save, "story-11").status, "ready");
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/listening-settlement.test.js test/mission-system.test.js`

- [ ] **Step 3: Implement four-way monitoring proof and claim unlock**

Require active contract, completed summary, settled ID, proof, and monitoring archive record. Claiming sets `chapter11.taskTreeUnlocked = true`. Any mismatch returns the original save. Use saturated reward addition.

- [ ] **Step 4: Add forged-summary, mismatched-contract, duplicate, legacy, and 10k-tail tests**

Verify no ordinary QSO, relationship, money, or TP is created until the mission is claimed.

- [ ] **Step 5: Run and commit**

Run: `node --test test/listening-settlement.test.js test/mission-system.test.js test/mission-economy.test.js test/save-store.test.js`

```bash
git add src/game/listeningSettlement.js src/game/missionSystem.js src/game/missionEconomy.js test/listening-settlement.test.js test/mission-system.test.js test/mission-economy.test.js
git commit -m "feat: settle chapter eleven listening story"
```

### Task 4: Chapter 11 Screen and Seven-Language Copy

**Files:**
- Create: `src/screens/ListeningScreen.jsx`
- Create: `src/screens/listeningText.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/pixel-theme.css`
- Create: `test/listening-ui.test.js`
- Modify: `test/language-interface.test.js`
- Modify: `test/mission-center-ui.test.js`

**Interfaces:**
- Route name `listening`; props follow `ContestScreen` with update, settle, back, settings, key type, and WPM.

- [ ] **Step 1: Write SSR/source-contract RED tests**

Assert three listening observations, physical-key hooks, directed-call prompt, silence decision, pause, retry, result, no portrait, seven-language key shape, accepted-story entry, and durable replay entry.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/listening-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js`

- [ ] **Step 3: Implement the lazy route and activity guard**

Use `useCwCore`; submit only decoded CW; never expose an input element for radio text. Reuse the generic activity leave guard and visibility/focus clock.

- [ ] **Step 4: Add all seven dictionaries and responsive CSS**

- [ ] **Step 5: Run and commit**

```bash
node --test test/listening-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js
git add src/screens/ListeningScreen.jsx src/screens/listeningText.js src/App.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/pixel-theme.css test/listening-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js
git commit -m "feat: complete chapter eleven listening story"
```

### Task 5: Chapter 12 Storm Relay Engine

**Files:**
- Modify: `src/game/stormRelayRun.js`
- Create: `test/storm-relay-run.test.js`

**Interfaces:**
- Produces `createStormRelayRun`, `submitStormCheckIn`, `requestStormVerification`, `submitStormRelay`, `repeatStormMessage`, `tickStormRelayRun`, `retryStormRelayRun`, and `abandonStormRelayRun`.

- [ ] **Step 1: Write RED tests for the conflicting revisions**

```js
test("only source verification exposes the canonical revision two packet", () => {
  let run = receiveConflict(checkedInRun());
  assert.equal(submitStormRelay(run, revisionOnePacket, safeSemantic).phase, "CONFLICT");
  run = requestStormVerification(run, "AGN MSG 214 REV K", safeSemantic);
  run = submitStormRelay(run, canonicalRevisionTwo(run), safeSemantic);
  assert.equal(run.phase, "COMPLETED");
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test test/storm-relay-run.test.js`

- [ ] **Step 3: Implement frozen packets and deterministic validation**

Parse exactly `MSG REV GRID PEOPLE ITEM QTY CHECK`; compute CHECK internally; reject reordered, duplicate, conflicting, oversized, inherited, and accessor-backed fields. Exact `AGN`/`QRS` repeats the same packet.

- [ ] **Step 4: Add third-error failure, pause, timeout, retry, and hostile tests**

- [ ] **Step 5: Run and commit**

```bash
node --test test/storm-relay-run.test.js test/structured-message.test.js
git add src/game/stormRelayRun.js test/storm-relay-run.test.js
git commit -m "feat: add chapter twelve storm relay engine"
```

### Task 6: Chapter 12 Settlement, Mission, and Screen

**Files:**
- Create: `src/game/stormRelaySettlement.js`
- Create: `src/screens/StormRelayScreen.jsx`
- Create: `src/screens/stormRelayText.js`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/missionEconomy.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/screens/StructuredMessageLogModal.jsx`
- Modify: `src/pixel-theme.css`
- Create: `test/storm-relay-settlement.test.js`
- Create: `test/storm-relay-ui.test.js`

**Interfaces:**
- Adds `story-12`, 1,350 money / 6 TP, prerequisite `story-11`.
- Settlement creates exactly two zero-credit event QSOs and the advanced rescue-project unlock.

- [ ] **Step 1: Write RED integration and UI tests**

Assert source/relay identity, canonical revision, two event QSOs, relationships, proof, duplicate no-op, no ordinary reward, physical CW, conflict presentation, and fictional-simulation warning.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/storm-relay-settlement.test.js test/storm-relay-ui.test.js`

- [ ] **Step 3: Implement atomic settlement and mission verifier**

- [ ] **Step 4: Implement screen, structured archive rendering, seven languages, and responsive layout**

- [ ] **Step 5: Run and commit**

```bash
node --test test/storm-relay-run.test.js test/storm-relay-settlement.test.js test/storm-relay-ui.test.js test/mission-system.test.js test/language-interface.test.js
git add src/game/stormRelaySettlement.js src/game/missionSystem.js src/game/missionEconomy.js src/App.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/screens/StructuredMessageLogModal.jsx src/screens/StormRelayScreen.jsx src/screens/stormRelayText.js src/pixel-theme.css test/storm-relay-settlement.test.js test/storm-relay-ui.test.js
git commit -m "feat: complete chapter twelve storm relay"
```

### Task 7: Chapter 13 Night Operations Engine

**Files:**
- Modify: `src/game/nightOperationsRun.js`
- Create: `test/night-operations-run.test.js`

**Interfaces:**
- Produces deterministic four-target scheduling, three-band labels, monotonic windows, contact exchange, retry, and normalization functions.

- [ ] **Step 1: Write scheduling RED tests**

```js
test("three distinct known people can be scheduled in non-overlapping windows", () => {
  let run = createNightOperationsRun({ save: knownPeopleSave(), seed: "story-13", startedAt: ISO });
  run = completeNextThreeWindows(run);
  assert.equal(run.phase, "COMPLETED");
  assert.equal(new Set(run.contacts.map((contact) => contact.personId)).size, 3);
  assert.equal(new Set(run.contacts.map((contact) => contact.windowId)).size, 3);
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test test/night-operations-run.test.js`

- [ ] **Step 3: Implement schedule generation and physical exchange contract**

Use known fixed people when verified relationships exist and stable story fallbacks otherwise. Freeze `40M`, `20M`, `15M` labels and four windows. Do not read the wall clock after creation except through monotonic ticks.

- [ ] **Step 4: Add overlap, closed-window, duplicate-person, pause, missed-window, retry, and hostile tests**

- [ ] **Step 5: Run and commit**

```bash
node --test test/night-operations-run.test.js
git add src/game/nightOperationsRun.js test/night-operations-run.test.js
git commit -m "feat: add chapter thirteen operations engine"
```

### Task 8: Chapter 13 Settlement, Mission, and Operations Board

**Files:**
- Create: `src/game/nightOperationsSettlement.js`
- Create: `src/screens/NightOperationsScreen.jsx`
- Create: `src/screens/nightOperationsText.js`
- Create: `src/screens/StationOperationsModal.jsx`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/missionEconomy.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/pixel-theme.css`
- Create: `test/night-operations-settlement.test.js`
- Create: `test/night-operations-ui.test.js`

**Interfaces:**
- Adds `story-13`, 1,500 money / 6 TP, prerequisite `story-12`.
- Settlement writes three event QSOs and unlocks the read-only station operations modal.

- [ ] **Step 1: Write RED settlement/UI tests**

Require three distinct people, three windows, legal chronology, exact event QSO linkage, relationship encounter increments, physical CW, pause, and claimed replay no reward.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/night-operations-settlement.test.js test/night-operations-ui.test.js`

- [ ] **Step 3: Implement settlement/verifier and operations archive**

- [ ] **Step 4: Implement board, modal, seven-language copy, and responsive CSS**

- [ ] **Step 5: Run and commit**

```bash
node --test test/night-operations-run.test.js test/night-operations-settlement.test.js test/night-operations-ui.test.js test/mission-system.test.js test/language-interface.test.js
git add src/game/nightOperationsSettlement.js src/game/missionSystem.js src/game/missionEconomy.js src/App.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/screens/NightOperationsScreen.jsx src/screens/nightOperationsText.js src/screens/StationOperationsModal.jsx src/pixel-theme.css test/night-operations-settlement.test.js test/night-operations-ui.test.js
git commit -m "feat: complete chapter thirteen station operations"
```

### Task 9: Chapter 14 Final Promise Engine

**Files:**
- Modify: `src/game/finalPromiseRun.js`
- Create: `test/final-promise-run.test.js`

**Interfaces:**
- Produces `createFinalPromiseRun`, `reviewFinalPromise`, `submitFinalPromiseCall`, `chooseFinalPromiseTone`, `submitFinalPromiseMessage`, repeat/retry/tick/abandon functions.

- [ ] **Step 1: Write RED tests for bounded recall and three tones**

```js
test("Chapter 14 recalls fixed prior facts and accepts a canonical warm message", () => {
  let run = createFinalPromiseRun({ save: completedChaptersSave(), playerCallsign: "BH1ABC", startedAt: ISO });
  assert.deepEqual(run.recallKeys, expectedRecallKeys);
  run = reachFinalChoice(run);
  run = chooseFinalPromiseTone(run, "warm");
  run = submitFinalPromiseMessage(run, canonicalFinalMessage(run), safeSemantic);
  assert.equal(run.phase, "COMPLETED");
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test test/final-promise-run.test.js`

- [ ] **Step 3: Implement own-only recall and canonical messages**

Allow only fixed recall keys from verified Chapter 7, 11, 12, and 13 records. Map `brief`, `steady`, and `warm` to bounded deterministic Morse templates; persist the enum and template key, never decoded prose.

- [ ] **Step 4: Add missing optional recall, forged QSL, mismatched identity, unsafe semantic, repeat, retry, and hostile tests**

- [ ] **Step 5: Run and commit**

```bash
node --test test/final-promise-run.test.js test/qsl-records.test.js
git add src/game/finalPromiseRun.js test/final-promise-run.test.js
git commit -m "feat: add chapter fourteen promise engine"
```

### Task 10: Chapter 14 Settlement, Mission, and Final-Page Screen

**Files:**
- Create: `src/game/finalPromiseSettlement.js`
- Create: `src/screens/FinalPromiseScreen.jsx`
- Create: `src/screens/finalPromiseText.js`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/missionEconomy.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/screens/PeopleAndQslModal.jsx`
- Modify: `src/pixel-theme.css`
- Create: `test/final-promise-settlement.test.js`
- Create: `test/final-promise-ui.test.js`

**Interfaces:**
- Adds `story-14`, 1,700 money / 7 TP, prerequisite `story-13`.
- Settlement links the final-page record to the verified Chapter 7 QSL and one zero-credit event QSO.

- [ ] **Step 1: Write RED proof-chain and screen tests**

Require retained QSL, recipient identity, recall keys, tone enum, canonical message key, event QSO, relationship, no raw text, physical CW, and old-log final page.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/final-promise-settlement.test.js test/final-promise-ui.test.js`

- [ ] **Step 3: Implement atomic final-page settlement and mission verifier**

- [ ] **Step 4: Implement screen, final-page display, seven languages, and responsive layout**

- [ ] **Step 5: Run and commit**

```bash
node --test test/final-promise-run.test.js test/final-promise-settlement.test.js test/final-promise-ui.test.js test/mission-system.test.js test/qsl-records.test.js test/language-interface.test.js
git add src/game/finalPromiseSettlement.js src/game/missionSystem.js src/game/missionEconomy.js src/App.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/screens/PeopleAndQslModal.jsx src/screens/FinalPromiseScreen.jsx src/screens/finalPromiseText.js src/pixel-theme.css test/final-promise-settlement.test.js test/final-promise-ui.test.js
git commit -m "feat: complete chapter fourteen final promise"
```

### Task 11: Chapter 15 Ordinary-QSO Bridge and First-Page Settlement

**Files:**
- Modify: `src/game/firstPageState.js`
- Create: `src/game/firstPageSettlement.js`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/missionEconomy.js`
- Modify: `src/qso/qsoLog.js`
- Modify: `src/App.jsx`
- Create: `src/screens/FirstPageModal.jsx`
- Create: `src/screens/firstPageText.js`
- Create: `test/first-page-settlement.test.js`
- Create: `test/first-page-ui.test.js`

**Interfaces:**
- Adds `story-15`, 2,000 money / 8 TP, prerequisite `story-14`.
- Counts one retained, settled, positive ordinary QSO created after acceptance; event QSOs never count.
- Produces `settleFirstPage(save, { qsoId, goal, completedAt })`.

- [ ] **Step 1: Write RED tests for the real ordinary-QSO bridge**

```js
test("only a post-acceptance ordinary QSO can become the first page", () => {
  const accepted = acceptMission(chapter14ClaimedSave(), "story-15", ISO);
  assert.equal(settleFirstPage(accepted.save, { qsoId: oldQsoId, goal: "world-log", completedAt: ISO2 }).settled, false);
  const withNewQso = recordOrdinaryQso(accepted.save, completedOrdinaryQsoAfter(ISO));
  const settled = settleFirstPage(withNewQso, { qsoId: withNewQso.qsoLog[0].id, goal: "world-log", completedAt: ISO3 });
  assert.equal(settled.settled, true);
  assert.equal(getMissionProgress(settled.save, "story-15").status, "ready");
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test test/first-page-settlement.test.js test/first-page-ui.test.js`

- [ ] **Step 3: Implement acceptance baseline, retained-QSO proof, and immutable story goal**

Validate QSO type, chronology, positive ordinary settlement, QSO ledger membership, retained log identity, and exact mission baseline. Claim sets `openStation.unlocked = true` and copies the fixed first goal.

- [ ] **Step 4: Implement Station story marker and fixed-choice modal**

The mission action enters the ordinary station; Home exposes the first-page modal only after a valid new QSO exists. The modal has no text area.

- [ ] **Step 5: Run and commit**

```bash
node --test test/first-page-settlement.test.js test/first-page-ui.test.js test/qso-log.test.js test/mission-system.test.js test/mission-economy.test.js
git add src/game/firstPageState.js src/game/firstPageSettlement.js src/game/missionSystem.js src/game/missionEconomy.js src/qso/qsoLog.js src/App.jsx src/screens/FirstPageModal.jsx src/screens/firstPageText.js test/first-page-settlement.test.js test/first-page-ui.test.js
git commit -m "feat: complete chapter fifteen first page"
```

### Task 12: Open Station Dashboard

**Files:**
- Modify: `src/game/openStationState.js`
- Create: `src/game/openStationDashboard.js`
- Create: `src/screens/OpenStationModal.jsx`
- Create: `src/screens/openStationText.js`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/pixel-theme.css`
- Create: `test/open-station-dashboard.test.js`
- Create: `test/open-station-ui.test.js`

**Interfaces:**
- Produces `buildOpenStationDashboard(save)` and `updateOpenStationGoal(save, goal, updatedAt)`.

- [ ] **Step 1: Write RED dashboard and unlock tests**

Assert locked-before-claim, five progress lines derived only from durable records, active-goal update without story-history mutation, reload persistence, and no network/leaderboard API.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/open-station-dashboard.test.js test/open-station-ui.test.js`

- [ ] **Step 3: Implement pure projections and bounded goal update**

- [ ] **Step 4: Implement Home/Mission entry, seven-language modal, and responsive CSS**

- [ ] **Step 5: Run and commit**

```bash
node --test test/open-station-dashboard.test.js test/open-station-ui.test.js test/language-interface.test.js test/mission-center-ui.test.js
git add src/game/openStationState.js src/game/openStationDashboard.js src/App.jsx src/screens/HomeScreen.jsx src/screens/MissionCenterModal.jsx src/screens/OpenStationModal.jsx src/screens/openStationText.js src/pixel-theme.css test/open-station-dashboard.test.js test/open-station-ui.test.js
git commit -m "feat: unlock open station mode"
```

### Task 13: Packaged QA Scopes for Chapters 11–15

**Files:**
- Modify: `electron/qa-capture.cjs`
- Modify: `electron/main.cjs`
- Modify: `scripts/run-packaged-qa.cjs`
- Modify: `.github/workflows/windows-portable.yml`
- Modify: `test/packaged-lights-qa-contract.test.cjs`
- Modify: `test/packaged-qa-segmentation-contract.test.cjs`
- Create: `test/packaged-final-chapters-qa-contract.test.cjs`

**Interfaces:**
- Adds `listening`, `storm-relay`, `night-operations`, `final-promise`, and `first-page` scopes.
- Raises exact capture count from 142 to 197.

- [ ] **Step 1: Write RED manifest, scope, evidence, and fail-closed tests**

```js
assert.deepEqual(buildQaSegmentPlan().slice(-5).map(({ scope, screenshots }) => [scope, screenshots.length]), [
  ["listening", 11], ["storm-relay", 12], ["night-operations", 12], ["final-promise", 11], ["first-page", 9],
]);
assert.equal(buildQaSegmentPlan().flatMap((segment) => segment.screenshots).length, 197);
```

Require literal result facts, common run UUID, exact predecessor state, zero-byte/corrupt/blank/duplicate screenshot rejection, hard timeout, console zero, and first-failure stop.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/packaged-final-chapters-qa-contract.test.cjs test/packaged-qa-segmentation-contract.test.cjs test/packaged-lights-qa-contract.test.cjs`

- [ ] **Step 3: Implement scopes with real DOM and physical key events**

Use the existing key helper and real focus restoration. Never assign decoded text or call settlement directly from QA.

- [ ] **Step 4: Add literal validators and workflow exact-count gate**

- [ ] **Step 5: Run and commit**

```bash
node --test test/packaged-final-chapters-qa-contract.test.cjs test/packaged-qa-segmentation-contract.test.cjs test/packaged-lights-qa-contract.test.cjs
git add electron/qa-capture.cjs electron/main.cjs scripts/run-packaged-qa.cjs .github/workflows/windows-portable.yml test/packaged-final-chapters-qa-contract.test.cjs test/packaged-qa-segmentation-contract.test.cjs test/packaged-lights-qa-contract.test.cjs
git commit -m "test: verify chapters eleven through fifteen end to end"
```

### Task 14: v0.45 Release Metadata, Documentation, and Final Verification

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/App.jsx`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.zh-TW.md`
- Modify: `README.ja.md`
- Modify: `README.es.md`
- Modify: `README.de.md`
- Modify: `README.ru.md`
- Modify: `docs/CW_台站模拟游戏设计文档_v0.4.md`
- Modify: `docs/story-missions-open-station-v0.1.md`
- Create: `docs/release-v0.45-verification.md`
- Modify: `test/version-contract.test.js`
- Modify: `test/release-metadata.test.js`

**Interfaces:**
- Version becomes exactly `0.45.0` everywhere.

- [ ] **Step 1: Write RED version and implementation-boundary tests**

Assert all localized READMEs identify Chapters 5–15 and the initial Open Station dashboard as implemented while retaining unsigned/source-available/proprietary and offline-model wording.

- [ ] **Step 2: Confirm RED**

Run: `node --test test/version-contract.test.js test/release-metadata.test.js test/release-contract.test.cjs`

- [ ] **Step 3: Update metadata and seven-language documentation**

- [ ] **Step 4: Run the complete source verification chain**

```bash
pnpm test
pnpm test
pnpm build
pnpm qso:simulate:poor
pnpm qso:calibrate
pnpm mission:economy
pnpm desktop:build
```

Expected: all tests pass, simulations report no issues, build size gate passes, and the portable build exits zero.

- [ ] **Step 5: Run packaged semantic smoke and fresh 197-image QA**

Use a new exclusive evidence root. Verify 197 physical PNGs, 17 sentinels, one run UUID, zero console errors, zero failure/timeout markers, all six legacy gameplay validators, all five new chapter validators, PE/MZ, unsigned status, checksum, model hashes, and packaged OFL files.

- [ ] **Step 6: Write the literal verification report and run final audits**

Record exact command results, counts, hashes, evidence basename, run UUID, known unsigned status, and implemented/planned boundary. Run `git diff --check`, high-confidence secret/path scan, and confirm author/committer identity.

- [ ] **Step 7: Commit without pushing or releasing**

```bash
git add package.json pnpm-lock.yaml src/App.jsx README*.md docs/CW_台站模拟游戏设计文档_v0.4.md docs/story-missions-open-station-v0.1.md docs/release-v0.45-verification.md test/version-contract.test.js test/release-metadata.test.js
git commit -m "release: verify v0.45 open station story"
```

Expected final state: clean branch, no push, no merge, no GitHub release until the user explicitly requests integration.
