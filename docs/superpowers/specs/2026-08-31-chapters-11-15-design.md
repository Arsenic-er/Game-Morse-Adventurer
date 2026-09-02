# Chapters 11–15 and Open Station Mode Design

**Date:** 2026-08-31

**Target release:** v0.45.0

**Base:** v0.40.0, commit `0d8294e81e4b61c1a6e4cca34f586287cfe3cf55`

## 1. Outcome

Complete the remaining five chapters of *The Unfinished Log* and unlock a durable, replay-safe Open Station mode. Every chapter must remain a fictional offline simulation, use the existing physical CW input path during on-air play, persist only bounded structured facts, and settle rewards exactly once.

The release is developed on one continuation branch with a reviewable commit after each engine, settlement, screen, QA, and release milestone. It is released only after Chapter 15 and the post-story dashboard pass the same packaged evidence gates as Chapters 7–10.

## 2. Global constraints

- Chapter order is strict: `story-11` through `story-15`, each requiring the previous claimed story.
- Chapter event contacts pay zero ordinary-QSO money and technology points. Only the mission claim pays value.
- On-air screens use `useCwCore` and real Space/Z/X key events. They never accept a plain text field as radio evidence.
- On-air phases are portrait-free. Portraits remain outside this release.
- `Escape`, document visibility, and real window focus pause every live activity without catch-up.
- Player prose is never persisted. Saves contain fixed enums, normalized hard fields, identifiers, timestamps, scores, and fixed localization keys only.
- Model output may veto unsafe content but may never invent or override deterministic hard fields.
- Every settlement is atomic, bounded, own-property-only, JSON-idempotent, and an exact no-op when repeated.
- Old saves receive empty Chapter 11–15 state and never gain retroactive mission completion, rewards, contacts, relationships, or Open Station unlocks.
- Callsigns, people, stations, locations, schedules, messages, and rescue facts are fictional.
- The final owned JavaScript chunk remains at or below 512,000 bytes.
- The interface remains complete in English, Simplified Chinese, Traditional Chinese, Japanese, Spanish, German, and Russian.

## 3. State architecture

`storyContinuationState` advances to version 2 and adds five independently normalized aggregates plus one post-story aggregate:

```text
storyContinuationState
├─ chapter07 ... chapter10       existing, unchanged
├─ chapter11: listening state
├─ chapter12: storm relay state
├─ chapter13: night operations state
├─ chapter14: final promise state
├─ chapter15: first-page state
└─ openStation: post-story dashboard and chosen goal
```

Each chapter owns:

- `activeRun`: at most one normalized live run;
- `completedRuns`: a bounded tail of immutable summaries;
- `settledRunIds`: a bounded tail used only for replay rejection;
- `settlementProofs`: at most 80 fixed-shape proof records, fully validated before use;
- a chapter-specific archive containing only facts that the corresponding screen renders;
- a durable replay/task-tree unlock set only by claiming that story mission.

Mission readiness is never inferred from a summary alone. The verifier requires the active mission contract, a completed summary, the chapter settlement proof, the chapter settled ledger, and every retained event QSO required by that chapter. Chapter 11, which intentionally produces no QSO, instead requires its monitoring record and proof.

## 4. Chapter 11 — “The One Who Cannot Hear”

### Purpose

Teach that silence is meaningful evidence and that repeated calling is not always the correct action.

### Fictional contract

- Target callsign: `SIM11LS`
- Target station ID: `station:chapter11:sim11ls`
- Target person ID: `person:chapter11:silent-listener`
- The target never answers during this story run. The game does not claim that the person is missing or in danger.
- Three deterministic listening windows expose a frozen propagation/noise observation. No real frequency or location is stored.

### Run

Phases are `BRIEFING`, `LISTENING`, `CALL_READY`, `WAITING`, `DECISION`, `COMPLETED`, `FAILED`, and `ABANDONED`.

The player must:

1. observe all three listening windows;
2. key one valid directed call, `SIM11LS DE <PLAYER> K`, through the real CW path;
3. wait through the complete no-response window;
4. choose the fixed action `record-silence` instead of calling more than twice.

A second valid call is tolerated but recorded. A third call fails the attempt with `CALL_LIMIT_EXCEEDED`. Timeout and abandon give no progress. Completion stores observation IDs, call count, listening duration, propagation band, and the fixed conclusion key `chapter11.conclusion.no-reply-after-listening`; it stores no keyed text.

### Result

Settlement creates one monitoring record and no QSO. Claiming `story-11` awards 1,200 money and 5 technology points and unlocks the listening-record task tree.

## 5. Chapter 12 — “Coastal Storm”

### Purpose

Teach verification when several plausible messages disagree.

### Fictional contract

- Control station: `SIM12CS`, person `person:chapter12:control`
- Relay station: `SIM12RL`, person `person:chapter12:relay`
- Packet fields: `MSG`, `REV`, `GRID`, `PEOPLE`, `ITEM`, `QTY`, `CHECK`
- `GRID` is a fictional Pixel Grid value. Items are frozen enums. The check is computed in the engine.

The frozen schedule contains two conflicting revision-1 packets and one authoritative revision-2 correction. The correct packet is not selectable until the player requests verification from the source.

### Run

Phases are `CHECK_IN`, `RECEIVING`, `CONFLICT`, `VERIFY_SOURCE`, `RELAY`, `COMPLETED`, `FAILED`, and `ABANDONED`.

The player keys a check-in, receives the conflict, sends `AGN MSG <ID> REV K` to the source, then relays the canonical revision-2 packet. Exact hard fields, revision precedence, computed check, and source identity are deterministic. `AGN` and `QRS` repeat the same frozen traffic. Guessing, mixing revisions, or accepting an unsafe semantic result does not advance. Three bad relays fail the attempt.

### Result

Settlement writes two zero-credit event QSOs, source and relay relationships, the canonical storm record, and a fixed proof. Claiming `story-12` awards 1,350 money and 6 technology points and unlocks the advanced fictional rescue project.

## 6. Chapter 13 — “The Same Night”

### Purpose

Turn prior relationships into an operations problem: several known people are available in different short windows, and no single contact should erase the others.

### Fictional contract

- Four candidate people are selected deterministically from already-known fixed story people, with stable fallback story operators.
- Three simulated band labels are allowed: `40M`, `20M`, and `15M`. They are offline scenario labels, not live tuning or frequency advice.
- Four deterministic availability windows are frozen at run creation. Windows never reroll on retry.

### Run

Phases are `BOARD`, `WINDOW_OPEN`, `CALL`, `EXCHANGE`, `WINDOW_CLOSED`, `COMPLETED`, `FAILED`, and `ABANDONED`.

The operations board shows identity, simulated band, opening order, propagation grade, and time remaining. The player schedules and completes three distinct contacts in three non-overlapping windows. Every call and exchange uses the physical CW path. Selecting a closed window, duplicating a person, or allowing two windows to overlap is rejected. Paused time does not consume a window. Missing two available contacts fails the run, while a retry preserves the schedule seed but clears attempt work.

### Result

Settlement writes three zero-credit event QSOs, three relationship encounters, a schedule archive, and a fixed proof. Claiming `story-13` awards 1,500 money and 6 technology points and unlocks the station operations board.

## 7. Chapter 14 — “The Unfinished Promise”

### Purpose

Resolve the old log without pretending the player can replace its former owner.

### Fictional contract

- Final recipient callsign: `SIM14FP`
- Person ID: `person:chapter14:final-recipient`
- Station ID: `station:chapter14:sim14fp`
- The recipient is safe, fictional, and does not demand imitation or reunion.

The story recalls bounded facts from Chapters 7, 11, 12, and 13: the final QSL stance, whether the player stopped patiently, whether the player verified the corrected packet, and which known people were scheduled. Missing optional facts use fixed neutral keys and never block a valid migrated run after the prerequisite missions were legitimately claimed.

### Run

Phases are `REVIEW`, `CALL`, `ACCOUNT`, `FINAL_CHOICE`, `FINAL_MESSAGE`, `COMPLETED`, `FAILED`, and `ABANDONED`.

The recipient sends one of a finite set of localized account keys. The player chooses `brief`, `steady`, or `warm`; each maps to a canonical Morse message that includes the player callsign and no free prose. The player keys that message through the real CW path. Hard identity and choice fields must agree with the frozen run. `AGN` and `QRS` repeat the same account.

### Result

Settlement writes one zero-credit event QSO, the relationship encounter, the final-page record, and a proof linking the recalled Chapter 7 QSL record. Claiming `story-14` awards 1,700 money and 7 technology points and seals the old log’s final page without deleting or rewriting earlier records.

## 8. Chapter 15 — “Your First Page”

### Purpose

Move authorship from the old log to the player and unlock normal play as the continuing game rather than an epilogue menu.

### Story bridge

Accepting `story-15` stores the current QSO baseline. The mission action enters the ordinary Station with a Chapter 15 watch marker; it does not create a second QSO engine. The player must complete and save one new ordinary QSO through the existing full watch after acceptance. Event contacts, pre-acceptance logs, synthetic summaries, and zero-credit story QSOs do not count.

After returning Home, the player chooses one fixed first-page goal:

- `world-log`
- `people-network`
- `field-operations`
- `public-service`
- `contest-craft`

The selection is immutable for the story record but can later be replaced as the active annual goal in Open Station mode. No free text is stored.

### Result

Settlement binds the retained ordinary QSO, its settled ledger entry, the first-page choice, mission contract, and proof. Claiming `story-15` awards 2,000 money and 8 technology points, sets `openStationUnlocked`, and exposes the post-story dashboard. Replaying the story or changing a post-story goal never pays again.

## 9. Open Station mode

Open Station is a Home/Mission Center entry, not a parallel save or online service. It reads existing durable records and presents five progress lines:

1. World log: ordinary QSO regions, people, propagation conditions, and prefixes.
2. Award wall: existing achievements plus story certificates.
3. People network: stable relationships and QSL records.
4. Station engineering: researched technologies and owned equipment.
5. Annual career: Lights history, expedition records, contest bests, and one fixed annual goal.

The first release provides the dashboard, replay entries, and deterministic goal tracking. It does not add networking, paid rarity, live leaderboards, arbitrary player text, real emergency dispatch, or an infinite procedural mission generator.

## 10. UI and localization

Each chapter gets a lazy-loaded screen and a focused text module. Existing mission cards expose accepted-story launch and claimed-story replay actions. Home exposes the unlocked Open Station dashboard after Chapter 15 claim.

All screens provide:

- current fictional station and objective;
- frozen structured fields or schedule facts;
- real CW decoded preview and physical key hints;
- explicit pause state and leave confirmation;
- cause-specific failure, retry, completion, and settlement states;
- no portrait during any radio phase;
- responsive layout at 820 px and below;
- complete seven-language keys with identical dictionary shape.

## 11. Packaged evidence

The Windows packaged supervisor adds five scopes after `contest` and before final aggregation:

- `listening` — 11 captures
- `storm-relay` — 12 captures
- `night-operations` — 12 captures
- `final-promise` — 11 captures
- `first-page` — 9 captures

Together with the existing 142 captures, the v0.45 manifest requires exactly 197 named PNGs. Every new scope uses a fresh process and user-data directory, the common run UUID, external hard timeout, validated PNG pixels, zero console errors, state-envelope predecessor, segment sentinel, and literal chapter result JSON.

The result JSONs must prove the real failure/recovery path, completion proof, event-QSO count, relationship linkage, duplicate settlement no-op, mission claim, replay no-reward behavior, reload persistence, focus/visibility pause, and absence of raw player text. Chapter 15 additionally proves the counted QSO is an ordinary post-acceptance QSO and that Open Station survives reload.

## 12. Release gates

- Focused engine, settlement, migration, mission, UI, language, and QA-contract tests pass.
- Full `pnpm test` passes twice from a clean working tree.
- Poor-QSO simulation, operator calibration, and mission-economy simulation pass.
- `pnpm build` passes and every owned JS chunk is at most 512,000 bytes.
- Offline semantic model hashes and real CPU-provider smoke remain unchanged.
- Windows desktop package remains unsigned and includes the two complete OFL texts.
- Fresh packaged QA produces exactly 197 valid screenshots, sixteen segment sentinels, zero failure/timeout markers, zero console errors, and all chapter validators passing.
- Release metadata and seven localized READMEs identify Chapters 5–15 as implemented and describe Open Station’s exact initial depth without claiming online or real-emergency features.
