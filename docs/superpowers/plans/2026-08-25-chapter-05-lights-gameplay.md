# Chapter 5 “Lights Across the Air” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the playable Chapter 5 story, annual, and practice flows through grade and reward settlement, covering roadmap steps 2–10 without the later lights-map UI.

**Architecture:** Keep event rules in pure modules that do not depend on React or Web Audio. A dedicated run engine owns chase/control phases, deterministic pile-up facts, parsing, timer, score, and contacts; React renders that state and delegates audio to a layered extension of the existing CW engine. Save settlement consumes a completed result once, while the mission system consumes the persisted story result.

**Tech Stack:** React 19, JavaScript ES modules, Node 24 `node:test`, Web Audio API, Vite 6, existing save/mission/QSO/procedural-NPC modules.

**Spec:** `docs/superpowers/specs/2026-08-25-chapter-05-lights-gameplay-design.md`

## Global Constraints

- Event identity is `lights-across-air`; special callsign is `SIM5LT`; on-air token is `LGT`.
- Event regions are exactly `JP`, `US`, `CN`, `GE`, `CH`, and `FI`; `DE` is never accepted as an event exchange code.
- Story is date-independent; annual is May 1–7 station-local after story completion; practice is year-round after story completion.
- Player timing defects and whitespace loss are soft quality inputs; wrong callsigns, illegal RST, and unknown/wrong region codes are hard failures.
- Pile-ups contain 2–4 deterministic callers and preserve the same roster and exchange facts on repeat.
- Base/silver/gold are 3/2/1, 5/4/1, and 7/5/1 plus zero misidentifications respectively: QSO count / region count / resolved pile-up count.
- Event contacts count toward career history and relationships but never receive ordinary per-QSO money.
- Story reward is 500 money and 2 TP; annual is 300 once/year; practice daily maxima are 40/60/80; lifetime silver/gold bonuses are 100/200 total.
- Every production behavior is introduced by a test that is observed failing for the missing behavior before implementation.

---

### Task 1: Event catalogue and three-mode entry contract

**Files:**
- Create: `src/game/lightsEventCatalog.js`
- Create: `test/lights-event-catalog.test.js`

**Interfaces:**
- Consumes: `getLocation(locationId)` and `evaluateLightsAvailability(...)`.
- Produces: `LIGHTS_EVENT`, `LIGHTS_EVENT_REGIONS`, `lightsRegionForLocation(locationId)`, and `lightsEntryModes(save, now)`.

- [ ] **Step 1: Write the failing catalogue test**

```js
test("event regions map every playable location and reserve GE instead of DE", () => {
  assert.equal(lightsRegionForLocation("europe-rhine-valley"), "GE");
  assert.deepEqual(new Set(LOCATIONS.map(({ id }) => lightsRegionForLocation(id))),
    new Set(["JP", "US", "CN", "GE", "CH", "FI"]));
  assert.equal(LIGHTS_EVENT_REGIONS.includes("DE"), false);
});
```

- [ ] **Step 2: Run `pnpm test test/lights-event-catalog.test.js` and confirm missing-module failure**
- [ ] **Step 3: Implement the frozen identity, six-code mapping, seven display names, and mode projection**

```js
export function lightsEntryModes(save, now = new Date()) {
  const storyCompleted = save?.missionState?.claimedMissionIds?.includes("story-05") === true;
  return evaluateLightsAvailability({
    now, timeZone: getLocation(save?.locationId).timeZone,
    storyCompleted, state: save?.worldCalendarState,
  });
}
```

- [ ] **Step 4: Run the catalogue test and `test/world-calendar.test.js` green**
- [ ] **Step 5: Commit `feat: define lights event entry contract`**

### Task 2: Tolerant event exchange parser and chase state

**Files:**
- Create: `src/game/lightsExchange.js`
- Create: `src/game/lightsRun.js`
- Create: `test/lights-exchange.test.js`
- Create: `test/lights-run-chase.test.js`

**Interfaces:**
- Consumes: `normalizeCwText(text)` and optional semantic result `{ safeToCommit, slots, acts, topics }`.
- Produces: `parseLightsReport(message, context)`, `createLightsRun(options)`, `currentLightsPrompt(run)`, `submitLightsTransmission(run, message, options)`, and `advanceLightsPlayback(run)`.

- [ ] **Step 1: Write failing parser tests for canonical, omitted `RST`, glued whitespace, optional procedure tokens, wrong self/peer, illegal RST, wrong region, and unsafe semantic results**

```js
assert.equal(parseLightsReport("SIM5LTDEBH1ABCRST579CNK", {
  selfCallsign: "BH1ABC", peerCallsign: "SIM5LT", expectedRegion: "CN",
}).accepted, true);
assert.equal(parseLightsReport("SIM5LT DE BH1ABC 589 DE K", {
  selfCallsign: "BH1ABC", peerCallsign: "SIM5LT", expectedRegion: "CN",
}).reason, "wrongRegion");
```

- [ ] **Step 2: Run the parser tests and confirm missing-module failure**
- [ ] **Step 3: Implement field extraction independently from word spacing; semantic `safeToCommit:false` fails closed**
- [ ] **Step 4: Write failing chase tests for CQ, player answer, SORA report, `AGN`, `QRS`, accepted player report, and completed chase**
- [ ] **Step 5: Run chase tests and confirm `createLightsRun`/phase assertions fail**
- [ ] **Step 6: Implement story chase phases with frozen SORA/channel facts and no reroll on recovery**
- [ ] **Step 7: Run both new suites green**
- [ ] **Step 8: Commit `feat: add lights chase exchange`**

### Task 3: Deterministic pile-up schedules and layered audio

**Files:**
- Create: `src/game/lightsPileup.js`
- Modify: `src/cw/audioEngine.js`
- Modify: `src/cw/useCwCore.js`
- Create: `test/lights-pileup.test.js`
- Modify: `test/audio-engine.test.js`

**Interfaces:**
- Consumes: `generateProceduralNpc({ worldSeed, regionId, localIndex })`, `encodeTextToEvents(text, { wpm })`, and existing channel profiles.
- Produces: `createLightsPileup(options)`, `resolveLightsCallsignSelection(pileup, message)`, `normalizePlaybackLayers(layers)`, `CwAudioEngine.playLayers(layers, callbacks)`, and hook method `playIncomingLayers(layers)`.

- [ ] **Step 1: Write failing deterministic roster tests for caller counts, five-region reachability across seven rounds, pitch separation, bounds, two repeats, and identical output from identical seeds**
- [ ] **Step 2: Run pile-up tests and confirm missing-module failure**
- [ ] **Step 3: Implement region-first procedural roster selection and immutable layer schedules**

```js
{
  caller, text, wpm, toneHz, signalGain, qsbDepth, startOffsetMs,
  events: encodeTextToEvents(text, { wpm }).events,
}
```

- [ ] **Step 4: Write failing selection tests for exact, unique prefix/suffix wildcard, ambiguous wildcard, unknown full callsign, and `AGN`/`QRZ`**
- [ ] **Step 5: Implement selection resolution without changing the supplied pile-up object**
- [ ] **Step 6: Write failing audio-normalization tests that hand-check layer offset, duration, tone, and gain bounds**
- [ ] **Step 7: Implement `playLayers` with one oscillator/gain envelope per layer and a timer fallback that resolves at the longest layer duration**
- [ ] **Step 8: Expose `playIncomingLayers` from `useCwCore` and run audio/pile-up suites green**
- [ ] **Step 9: Commit `feat: add deterministic CW pileups`**

### Task 4: Control-stage run engine, timer, contacts, score, and grades

**Files:**
- Modify: `src/game/lightsRun.js`
- Create: `src/game/lightsScoring.js`
- Create: `test/lights-run-control.test.js`
- Create: `test/lights-scoring.test.js`

**Interfaces:**
- Consumes: Task 2 parser and Task 3 pile-up APIs.
- Produces: `tickLightsRun(run, elapsedMs)`, `lightsRunResult(run)`, and `scoreLightsResult(facts)`.

- [ ] **Step 1: Write failing scoring boundary tests with literal expected scores and exact grade edges**

```js
assert.deepEqual(scoreLightsResult({
  validQsoCount: 7, distinctRegionCount: 5, resolvedPileupCount: 1,
  successfulPartialCount: 1, misidentificationCount: 0, agnRequestCount: 1,
}), { score: 835, grade: "gold" });
```

- [ ] **Step 2: Run scoring tests and confirm missing-module failure**
- [ ] **Step 3: Implement clamped score and fact-based grades**
- [ ] **Step 4: Write failing control tests for event CQ, frozen responders, partial selection, ambiguous repeat subset, wrong full-call penalty, caller report, player report, contact completion, next round, seven-contact completion, and eight-minute timeout**
- [ ] **Step 5: Run control tests and confirm state-machine assertions fail**
- [ ] **Step 6: Implement pure control transitions and event contact objects with `onAirCallsign:"SIM5LT"` and save callsign operator metadata**
- [ ] **Step 7: Run chase, pile-up, control, and scoring suites green**
- [ ] **Step 8: Commit `feat: complete lights control run engine`**

### Task 5: Save normalization and idempotent run settlement

**Files:**
- Create: `src/game/lightsSettlement.js`
- Modify: `src/game/saveStore.js`
- Modify: `src/game/worldCalendar.js`
- Modify: `test/save-store.test.js`
- Modify: `test/world-calendar.test.js`
- Create: `test/lights-settlement.test.js`

**Interfaces:**
- Consumes: completed `lightsRunResult`, `recordLightsAnnualResult`, QSO log normalization, and operator relationship recording.
- Produces: `LIGHTS_EVENT_STATE_VERSION`, `emptyLightsEventState()`, `normalizeLightsEventState(value)`, and `settleLightsRun(save, result, context)`.

- [ ] **Step 1: Write failing migration tests proving old/corrupt saves receive bounded empty state and never infer rewards**
- [ ] **Step 2: Run migration tests and confirm missing fields/functions fail**
- [ ] **Step 3: Implement normalized settled-run IDs, story best, lifetime paid-grade amount, annual stamps, practice daily records, and event contacts**
- [ ] **Step 4: Write failing settlement tests for story grade difference, annual 300 once/year, May 5 stamp upgrade without second payment, rollback withholding, practice 40/60/80 daily difference, repeated run ID no-op, and event contacts with null ordinary reward breakdown**
- [ ] **Step 5: Run settlement tests and confirm missing settlement behavior**
- [ ] **Step 6: Implement one-save-replacement settlement; cap run IDs, contacts, stamps, and practice records against hostile input**
- [ ] **Step 7: Run save/calendar/settlement suites green**
- [ ] **Step 8: Commit `feat: settle lights event rewards safely`**

### Task 6: Add Chapter 5 to the mission tree

**Files:**
- Modify: `src/game/missionSystem.js`
- Modify: `test/mission-system.test.js`
- Modify: `test/mission-v2.test.js`
- Modify: `src/game/missionEconomy.js`
- Modify: `test/mission-economy.test.js`

**Interfaces:**
- Consumes: normalized `save.lightsEventState.storyBest` and existing mission accept/claim functions.
- Produces: `story-05` board entry with objective `lights-event`, 500 money, 2 TP, prerequisite `story-04`, and SORA reveal on claim.

- [ ] **Step 1: Write failing mission tests for sequential lock, accepted event contract, no old-log progress, base-result readiness, one-time claim, and SORA reveal**
- [ ] **Step 2: Run mission suites and confirm `story-05` is absent**
- [ ] **Step 3: Add `story-05`, recognize a persisted story base result only after acceptance, and reveal SORA during the existing atomic claim**
- [ ] **Step 4: Update economy expectations with hand-calculated Chapter 5 income and verify all economy gates remain within their configured ranges**
- [ ] **Step 5: Run mission and economy suites plus `pnpm mission:economy` green**
- [ ] **Step 6: Commit `feat: connect lights event to chapter five`**

### Task 7: Playable event screen and entry wiring

**Files:**
- Create: `src/screens/LightsEventScreen.jsx`
- Create: `src/screens/lightsEventText.js`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Create: `src/game/lightsUiModel.js`
- Create: `test/lights-ui-model.test.js`

**Interfaces:**
- Consumes: all pure run/entry/settlement APIs and `useCwCore` including `playIncomingLayers`.
- Produces: `LightsEventScreen` callbacks `onSettle(result)` and `onBack()`, plus pure `lightsUiModel(run, language)` used for labels/actions.

- [ ] **Step 1: Write failing UI-model tests for chase prompt, pile-up caller-count hints, partial/repeat error feedback, timer display, grades, and disabled settlement before completion**
- [ ] **Step 2: Run UI-model tests and confirm missing-module failure**
- [ ] **Step 3: Implement the seven-language event copy and pure UI model**
- [ ] **Step 4: Build `LightsEventScreen` with receiver noise on entry, CW key capture, incoming-message/layer playback, submit/clear/replay controls, eight-minute paused timer, grade summary, and leave confirmation for an active run**
- [ ] **Step 5: Add Mission Center launch for accepted `story-05`; after story completion expose annual when open and practice year-round**
- [ ] **Step 6: Add App `lights` screen state, selected run mode, active-save settlement, achievement rescan, Escape settings compatibility, and world-calendar heartbeat eligibility**
- [ ] **Step 7: Add pixel-style layout without the later map visualization; run `pnpm build` and correct only compilation/integration failures**
- [ ] **Step 8: Run UI-model tests and the full test suite green**
- [ ] **Step 9: Commit `feat: add playable lights event screen`**

### Task 8: Acceptance matrix, documentation, and release gates

**Files:**
- Create: `test/lights-event-acceptance.test.js`
- Modify: `docs/planning/chapter-05-lights-working-design-v0.1.md`
- Modify: `docs/CW_台站模拟游戏设计文档_v0.4.md`

**Interfaces:**
- Consumes: public event APIs only.
- Produces: end-to-end deterministic acceptance fixtures for story, annual, practice, poor-link recovery, and reward idempotency.

- [ ] **Step 1: Write acceptance tests that drive canonical and variant chase/control transmissions through real pure engines and settlement**
- [ ] **Step 2: Run acceptance tests and fix production behavior only when the test exposes a spec violation**
- [ ] **Step 3: Add poor-link cases for `AGN`, `QRS`, glued text, unique partial, ambiguous partial, misidentification, and unsafe semantic output**
- [ ] **Step 4: Update design documents from “planned” to the exact implemented boundary; keep lights-map/dialogue/Chapters 6–15 explicitly outside this release**
- [ ] **Step 5: Run `pnpm test`, `pnpm build`, `pnpm qso:simulate:poor`, `pnpm qso:calibrate`, and `pnpm mission:economy`**
- [ ] **Step 6: Run `git diff --check`, inspect the final diff for generated files or secrets, and commit `test: verify chapter five lights gameplay`**
