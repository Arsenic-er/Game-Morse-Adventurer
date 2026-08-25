# v0.37 Chapter 5–7 Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the ten v0.36 audit findings, finish Chapter 5 presentation, ship a playable Chapter 6 vertical slice, and establish Chapter 7 QSL/person-memory foundations.

**Architecture:** Correct the live-event clock/audio/unload boundary first, then migrate durable person and event identities before any map or narrative consumes them. Chapter 6 uses a separate expedition aggregate so temporary field state cannot corrupt the permanent station; Chapter 7 builds only on stable person IDs and immutable QSL records.

**Tech Stack:** React 19, Electron 43, Vite 6, Node test runner, deterministic JavaScript state engines, onnxruntime-node.

**Spec:** `docs/superpowers/specs/2026-08-25-v037-ch5-ch7-continuation-design.md`

## Global Constraints

- Windows local portable EXE; offline play must not require GPU or network.
- Supported UI languages are exactly `en`, `zh-CN`, `zh-TW`, `ja`, `es`, `de`, `ru`.
- All callsigns, people, activity data, weather, and story locations are fictional.
- Do not persist player free text in profiles, QSL narratives, event messages, or training data.
- Deterministic parsers own safety-critical fields; `safeToCommit:false` never advances state.
- Legacy migrations never retroactively pay money, TP, stamps, or achievement rewards.
- Chapter 6 story uses a loan kit and cannot require optional technology grind.
- Follow test-first red/green cycles and commit each task independently as `Arsenic-er <302726993@qq.com>` without co-author trailers.

---

### Task 1: Correct lights wall-clock, audio pause, and unload behavior

**Files:**
- Modify: `src/game/lightsSettlement.js`
- Modify: `src/game/lightsUiModel.js`
- Modify: `src/screens/LightsEventScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Test: `test/lights-settlement.test.js`
- Test: `test/lights-ui-model.test.js`
- Test: `test/world-calendar.test.js`
- Create: `test/activity-unload-guard.test.js`

**Interfaces:**
- Produces: `settleLightsRun(save, result, { observedAt })`, `advanceLightsActiveClock(clock, monotonicNow)`, and a renderer-to-main generic activity guard.
- Preserves: `result.completedAt` as the station-date source while `observedAt` advances rollback protection.

- [ ] Write failing delayed-settlement tests with literal Tokyo/New York/Rhine boundary timestamps proving `completedAt` selects the event date and `observedAt` only controls the rollback guard.
- [ ] Run `node --test test/lights-settlement.test.js test/world-calendar.test.js` and confirm the new boundary assertions fail.
- [ ] Implement the split completion/observation clock contract without changing existing reward amounts.
- [ ] Write failing pure monotonic-clock tests: a callback delayed by 2000 ms adds 2000 ms; a paused interval adds zero; resume resets the baseline.
- [ ] Run `node --test test/lights-ui-model.test.js` and confirm the monotonic-clock API is missing.
- [ ] Implement the clock helper and wire it to `performance.now()`; reset on menu, blur, visibility loss, and resume.
- [ ] Write failing guard tests for live lights, completed-unsettled lights, ordinary QSO, and safe Home state.
- [ ] Implement a generic activity unload guard in App/preload/main and make settings/blur stop all playback plus receiver noise; closing settings replays the frozen phase once.
- [ ] Run the four targeted suites, then `pnpm test`; commit `fix: harden lights activity lifecycle`.

### Task 2: Give packaged QA real lights coverage

**Files:**
- Modify: `electron/qa-capture.cjs`
- Modify: `.github/workflows/windows-portable.yml`
- Test: `test/lights-event-acceptance.test.js`
- Create: `test/packaged-lights-qa-contract.test.cjs`

**Interfaces:**
- Consumes: generic activity guard and corrected event clock from Task 1.
- Produces: named QA evidence files `lights-*.png` and `lights-qa-result.json` with phase, retry, settlement, reload, and idempotency facts.

- [ ] Write a failing contract test that executes the QA plan builder and expects named story launch, chase, control, Esc pause/resume, failed retry, settlement, reload, and duplicate-settlement checkpoints.
- [ ] Run the new test and confirm missing lights checkpoints.
- [ ] Extend `--qa-capture` to seed a story-05-ready fictional save, drive the real DOM through the activity, and write literal result facts; do not accept screenshot count as the assertion.
- [ ] Add workflow gates that require the result JSON and at least one screenshot for chase, control, result, and reloaded history.
- [ ] Run targeted tests and `pnpm build`; commit `test: exercise lights gameplay in packaged QA`.

### Task 3: Migrate stable people and durable event archives

**Files:**
- Create: `src/game/personIdentity.js`
- Create: `src/game/eventRunArchive.js`
- Modify: `src/qso/operatorRelationships.js`
- Modify: `src/qso/qsoLog.js`
- Modify: `src/game/lightsPileup.js`
- Modify: `src/game/lightsRun.js`
- Modify: `src/game/lightsSettlement.js`
- Modify: `src/game/saveStore.js`
- Create: `test/person-identity.test.js`
- Create: `test/event-run-archive.test.js`
- Modify: `test/operator-relationships.test.js`
- Modify: `test/save-store.test.js`

**Interfaces:**
- Produces: `personIdForOperator`, `stationIdentityForCallsign`, relationship schema v2 keyed by `personId`, and bounded `eventRunArchive` snapshots.
- Exact fixed IDs: `person:sora`, `station:sim6jp`, `station:lights-sim5lt`; procedural IDs use `person:procedural:<npcId>`.

- [ ] Write failing identity tests proving `SIM6JP` and SORA-at-`SIM5LT` map to one person but distinct stations, while unknown legacy calls remain distinct.
- [ ] Run the identity tests and confirm the module is absent.
- [ ] Implement bounded identity normalization and relationship v1→v2 migration without name-based merging.
- [ ] Write failing archive tests with hand-built seven-contact results proving person/station IDs, time zones, deterministic fictional weather/message keys, story/20-year/31-day retention, JSON round-trip, and hostile-input bounds.
- [ ] Run archive/save tests and confirm missing archive fields.
- [ ] Implement event snapshots and QSO linkage; make SORA chase count as one encounter without inventing an ordinary QSO reward.
- [ ] Add a sanitized v0.35 fixture and prove two normalization passes are identical with money, TP, equipment, logs, missions, and relationships preserved and no retroactive reward.
- [ ] Run identity/archive/relationship/save/lights suites, then `pnpm test`; commit `feat: persist stable people and lights archives`.

### Task 4: Make public builds durable and reduce release debt

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/sync-semantic-model.mjs`
- Modify: `package.json`
- Modify: `electron/main.cjs`
- Modify: `.github/workflows/windows-portable.yml`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: seven `README*.md` files
- Modify: `docs/CW_台站模拟游戏设计文档_v0.4.md`
- Add: verified files under `runtime-models/`
- Add: `build/icon.ico`
- Create: `test/offline-model-sync.test.cjs`
- Create: `test/release-contract.test.cjs`

**Interfaces:**
- Produces: locally verified semantic runtime assets, Windows icon, persistent tag-release workflow, build-size report, and source-available wording.
- Preserves: cwformer model version and both published SHA-256 values.

- [ ] Write failing offline-sync tests that deny network access and expect verified local assets to satisfy synchronization; corrupt local files must fail closed.
- [ ] Run the test and confirm current ignored/missing assets fail.
- [ ] Track the pinned runtime model/contract, update sync behavior, and document author/version/hash/license without changing model bytes.
- [ ] Create the project ICO from approved in-repository project artwork and configure BrowserWindow/electron-builder to use it.
- [ ] Write failing release-contract tests for a durable `v*` GitHub Release path, checksum attachment, explicit unsigned notice, pinned action SHAs, source-available wording, and a 500 KiB owned-JS budget report.
- [ ] Implement route-level lazy loading, WOFF2 font delivery, safe asset compression, release upload, and CI build-size summary; never remove required seven-language glyphs.
- [ ] Run offline sync, release contract, `pnpm build`, and record before/after asset sizes; commit `build: make portable releases durable and leaner`.

### Task 5: Complete Chapter 5 narrative, map, records, and achievements

**Files:**
- Create: `src/game/lightsNarrative.js`
- Create: `src/screens/LightsMapPanel.jsx`
- Create: `src/screens/LightsHistoryPanel.jsx`
- Modify: `src/screens/LightsEventScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/screens/lightsEventText.js`
- Modify: `src/game/lightsEventCatalog.js`
- Modify: `src/game/achievements.js`
- Modify: `src/pixel-theme.css`
- Create: `test/lights-narrative.test.js`
- Create: `test/lights-map-model.test.js`
- Modify: `test/language-interface.test.js`
- Modify: `test/achievements.test.js`

**Interfaces:**
- Consumes: Task 3 `eventRunArchive` and person/station identities.
- Produces: deterministic NOVA→SORA→MORSE narrative beats, failure debriefs, archive-backed map/history view models, and event achievements.

- [ ] Write failing narrative tests for invitation, handoff, cause-specific failure debrief, success signoff, and no portraits during on-air phases.
- [ ] Implement narrative keys and phase transitions using only fixed/localized keys.
- [ ] Write failing map tests using literal archive fixtures: only contacted regions light; selected light derives local time from the stored timezone; weather/message keys survive reload; annual window copy exposes timezone, next opening, claimed status, best grade, and stamp.
- [ ] Implement the pixel map/history panels and data-driven May 1–7/May 5 activity catalogue.
- [ ] Write failing achievement tests for base/silver/gold, annual participation, and May 5 special stamp with no migration back-pay.
- [ ] Implement event achievements and seven-language copy; verify 1280×720 and minimum supported viewport in packaged QA.
- [ ] Run all Chapter 5/language/achievement suites and `pnpm build`; commit `feat: complete chapter five lights presentation`.

### Task 6: Build the Chapter 6 expedition engine

**Files:**
- Create: `src/game/expeditionCatalog.js`
- Create: `src/game/expeditionExchange.js`
- Create: `src/game/expeditionRun.js`
- Create: `src/game/expeditionSettlement.js`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/saveStore.js`
- Create: `test/expedition-catalog.test.js`
- Create: `test/expedition-exchange.test.js`
- Create: `test/expedition-run.test.js`
- Create: `test/expedition-settlement.test.js`
- Modify: `test/mission-v2.test.js`

**Interfaces:**
- Produces: separate expedition aggregate with field site, loan/owned loadout, power budget, setup phases, propagation snapshot, contacts, result, and idempotent settlement.
- Chapter 6 mission ID is `story-06`, prerequisite `story-05`; required topics are `QTH`, `POWER`, `ANTENNA`.

- [ ] Write failing catalogue tests for three fictional hill sites, fixed coordinates/time zones, loan radio/wire/battery, and no permanent inventory mutation.
- [ ] Implement immutable catalogues and bounded normalizers.
- [ ] Write failing parser tests for canonical/compact QTH-PWR-ANT exchanges, wrong hard fields, unsafe semantics, and harmless procedure variants.
- [ ] Implement the deterministic hard-field parser.
- [ ] Write failing run tests for site selection, setup, power consumption, CQ/contact, weak-link recovery, timeout, failure, abandon, retry, and stable propagation snapshots.
- [ ] Implement pure expedition transitions.
- [ ] Write failing settlement/mission tests for story unlock, loan isolation, one-time rewards, no grind prerequisite, relationship/QSO linkage, and corrupt/legacy state.
- [ ] Implement normalized expedition state and atomic settlement; run all expedition/mission/save/economy suites, then `pnpm test`; commit `feat: add chapter six expedition engine`.

### Task 7: Ship the Chapter 6 screen and Chapter 7 QSL foundation

**Files:**
- Create: `src/screens/ExpeditionScreen.jsx`
- Create: `src/screens/expeditionText.js`
- Create: `src/game/qslRecords.js`
- Create: `src/screens/PeopleAndQslModal.jsx`
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/MissionCenterModal.jsx`
- Modify: `src/game/missionSystem.js`
- Modify: `src/game/saveStore.js`
- Modify: `src/pixel-theme.css`
- Create: `test/expedition-ui-model.test.js`
- Create: `test/qsl-records.test.js`
- Modify: `test/language-interface.test.js`
- Modify: `electron/qa-capture.cjs`

**Interfaces:**
- Consumes: Task 6 expedition engine and Task 3 person identities.
- Produces: playable Chapter 6, expedition-tree unlock, and versioned immutable QSL/choice records for Chapter 7 and later Chapter 14 recall.

- [ ] Write failing UI-model tests for site choice, setup, on-air exchange, battery/propagation display, result, retry, Esc pause, and leave guard.
- [ ] Implement the seven-language pixel expedition screen and wire it through Mission Center/App without changing the permanent Home scene or equipment.
- [ ] Write failing QSL tests for person-linked records, fixed narrative keys, `believe/request-review/defer` choices, one-time confirmation, reload persistence, hostile-input bounds, and zero free-text storage.
- [ ] Implement QSL schema and People/QSL page; add only the Chapter 7 foundation contract, not emergency gameplay.
- [ ] Extend packaged QA through a Chapter 6 success, failure recovery, reload, relationship update, and QSL choice persistence.
- [ ] Run expedition/QSL/language suites and `pnpm build`; commit `feat: connect chapters six and seven foundations`.

### Task 8: Release v0.37 and verify the complete branch

**Files:**
- Modify: `package.json`
- Modify: seven `README*.md` files
- Modify: `docs/CW_台站模拟游戏设计文档_v0.4.md`
- Modify: `docs/story-missions-open-station-v0.1.md`
- Modify: Chapter 5 working design and this spec with exact implemented boundaries
- Modify: `.github/workflows/windows-portable.yml` only if verification exposes a release-gate defect

**Interfaces:**
- Produces: v0.37.0 source, documentation, portable executable, checksums, QA evidence, and final code-review package.

- [ ] Update all version contracts and seven-language release summaries to `0.37.0`, explicitly separating implemented Chapters 5–6, Chapter 7 foundation, and planned Chapters 7–15.
- [ ] Run `pnpm test`, `pnpm qso:simulate:poor`, `pnpm qso:calibrate`, and `pnpm mission:economy`.
- [ ] Run `pnpm build`, enforce the asset budgets, then `pnpm desktop:build`.
- [ ] Run packaged `--semantic-smoke` and `--qa-capture`; verify named lights and expedition evidence, console report, migration fixture, and duplicate settlement guards.
- [ ] Run `git diff --check`, tracked-secret scan, model hashes, PE header, EXE size, and SHA-256 generation.
- [ ] Request broad whole-branch code review; fix every Critical/Important finding and perform one scoped re-review.
- [ ] Commit `release: verify v0.37 chapter continuation`; retain the isolated branch until the user chooses merge/push.

