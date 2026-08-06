<div align="center">

# Game-Morse-Adventurer

### A pixel-art CW amateur radio station adventure

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md) · [**Español**](./README.es.md) · [**Deutsch**](./README.de.md) · [**Русский**](./README.ru.md)

[![Windows portable](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml/badge.svg)](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml)

</div>

> [!IMPORTANT]
> All callsigns in this game are fictional and unrelated to real-world callsigns. Any resemblance is purely coincidental.(It's still  a prototype. Any issues are welcomed!!!)

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer — friends camping and operating an amateur-radio station beside a mountain lake" width="100%">
</p>

**Tags:** Morse code · amateur radio · CW · telegraphy · game

## About

Game-Morse-Adventurer is a local Windows game prototype for learning and using Morse code in a fictional amateur-radio station. Enter the station to open the receiver and hear live background noise, call CQ with a straight key or automatic paddle, wait for a propagation-dependent fictional response, complete the QSO, and explore conditions across an offline world map.

## Highlights

- Hard-edged dark pixel UI using Fusion Bold Pixel for English, Chinese, and Japanese, plus Press Start 2P for Spanish, German, and Russian.
- English, Simplified Chinese, Traditional Chinese, Japanese, Spanish, German, and Russian interfaces with a persistent language preference.
- A location-aware Home management center with filter-highlighted station, warehouse, shop, log, achievement, and a new interactive `MORSE CODE` book hotspot that opens practice without leaving the active save.
- Three local save slots with a seven-character uppercase callsign, fixed starting location, swappable equipment, and credits.
- Standard Morse timing, fixed 650 Hz sidetone, decoding, rhythm scoring, and straight-key WPM detection.
- Straight-key input with `Space`; adjustable 5–40 WPM automatic paddle input with `Z` for dot and `X` for dash, including continuous hold-to-repeat.
- Independent CW practice for characters, fictional callsigns, straight key, and paddle. Guided, Standard, and Challenge difficulties set listening speed and lesson pass targets; staged curricula unlock one lesson at a time in every mode.
- Callsign reception offers five training filters: All, Japan, United States, China, and Europe. Each specific region has eight game-invented, `SIM`-prefixed targets introduced two per lesson; these are fictional exercise labels, not real callsign allocations or authentic regional-prefix data.
- The callsign region can change only before the current session has any answer input, CW pulse, or settled attempt, and is locked throughout weakness review. Changing region clears the callsign recent-target window without resetting lifetime statistics, weakness weights, formal lesson scoring, unlocks, or the 19-lesson total.
- A deterministic shuffled bag avoids repeats within a round and, when the active lesson pool permits, steers the next prompt away from the four most recent targets; each prompt settles at most once. Practice shows session summaries for attempts, accuracy, rhythm, weak characters, and lesson progress.
- Each lesson now identifies the targets introduced in that lesson and its full review pool. A live mastery card explains the scored block, pass rule, remaining questions, correct answers still needed, and whether the current block can still pass.
- With an active save, lifetime results, curriculum progress, and the callsign-reception region preference persist independently by mode. Practice-record schema v3 safely migrates older saves, defaults missing or invalid regions to All, and filters recent targets to the selected fictional pool; without a selected save, training remains available but records stay session-only.
- The Home `MORSE CODE` book shows the aggregate completed-lesson count and percentage across all 19 lessons, and refreshes immediately when the player returns from practice.
- The practice sidebar now provides a four-mode curriculum overview with each mode's completed lessons, total lessons, and percentage. When the selected mode has recorded weaknesses, a five-question weakness review locks its target pool at session start and draws only from currently unlocked weak targets.
- Weakness review updates lifetime attempts, correct answers, averages, weakness weights, recent targets, and last-practiced time, but is never eligible to advance, reset, or otherwise change the formal lesson, its scored block, or completed-lesson count.
- Each correct review answer removes at most one weakness point from its target, while an incorrect answer still adds one. Multi-character prompts recover the eligible character with the highest current weight, breaking ties by target order. The five-question pool remains fixed; a target that reaches zero leaves the next review pool.
- A player-led fictional QSO loop: the receiver opens automatically, the player calls CQ, propagation determines whether a station responds, and a successful contact continues through callsigns, RST, 73/SK, credits, and logging.
- A seven-language first-watch briefing and full/hints/off duty coach teach each QSO stage without revealing the remote callsign during blind copy.
- `AGN K` repeats the same remote station over the same channel without changing propagation, attempts, or rewards; malformed messages retain their decoded text for correction instead of ending the QSO after two errors.
- QSO messages are validated in radio order: remote call, `DE`, player call, `RST`, report, `73`, then `K`; misplaced or missing procedural signs receive a specific correction instead of a false pass.
- Persistent QSO result pages and logbook entries include callsign, region, distance, RST, propagation, equipment, WPM, transmit accuracy, rhythm, repeat-request count, and a line-by-line operating review of accepted, transmitted, rejected, and repeat attempts.
- Every settled QSO now stores a permanent seven-language reward breakdown: 100 base credits, +50 for an independent watch, +75 for a P0–P2 weak-signal contact, +20 for a first contact with a region, and +25 for a new distance record. The result page and Home logbook read the same schema-v5 ledger; legacy logs retain their historical totals without retroactive rewards.
- A seven-language achievement archive derives six permanent milestones from durable QSO records and retained logs without granting duplicate rewards. Newly unlocked QSO achievements appear immediately in a non-blocking notification queue.
- Atomic, idempotent credit settlement prevents a completed QSO from being rewarded more than once.
- A seven-language station store supports atomic purchases, persistent ownership, and warehouse-only equipment changes.
- The first replacement radio, the fictional MICA-8, costs 800 credits and is inspired by open uSDX/uSDR QRP concepts: a 5 W eight-band hardware profile, 20% lower receiver noise, 15% shallower perceived QSB through AGC, and paired idle/TX pixel artwork whose red diode lights only while transmitting. Current gameplay remains fixed at 21.060 MHz CW.
- A single accessory slot supports the 300-credit CW-500 audio filter, centered at 650 Hz with a 500 Hz bandwidth and 35% lower receiver noise; the equipped accessory is preserved in QSO logs.
- Station clocks display both the selected station's local time and UTC.
- Deterministic offline propagation based on station location, UTC, and 21.060 MHz.
- Propagation levels affect NPC availability, signal gain, noise, QSB, and small frequency offsets.
- Local Windows x64 portable build; no account or network connection required for gameplay.

## Controls

| Action | Control |
| --- | --- |
| Straight key | Hold `Space` |
| Automatic paddle — dot | `Z` |
| Automatic paddle — dash | `X` |
| Submit the captured CQ or reply | `F2` |
| Save a completed QSO log | `F3` |

## Development

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

The automated suite covers the CW core and repeating keyer, receiver audio filtering, practice engine, regional fictional-callsign catalogs and pools, schema-v3 migration, preference isolation and reload, switch locking, four-mode curriculum summaries, weakness-review pool isolation, weakness recovery, mastered-state persistence, and formal-lesson invariants, blind-copy QSO state machine, strict QSO ordering and `AGN K` repeats, operating-review history, independent-watch reward eligibility, CQ response probability, persistent QSO logs and results, achievement derivation, idempotent credit settlement, store economy, radio/accessory ownership and loadouts, propagation model, map projection, and save data rules.

## Project status

Version **v0.27.0** replaces the binary CQ format gate with simulated remote copy. Each transmitted call is scored against several valid CQ forms, then combined with callsign identity, order, rhythm, player speed, propagation, and the listening operator's skill. Ten fictional callsigns now use seven experimental operator styles with different preferred speeds, receive skill, patience, procedure strictness, response delay, reply length, and query style. A clear call receives a directed reply; a partial copy may produce `?`, `AGN?`, `QRZ?`, or `QRS?`; a recognizable but unreadable signal may trigger an undirected general CQ, while complete garbage or a terse operator may remain silent. Schema-v5 logs preserve CQ quality, copy score, outcome, operator profile, remote WPM, and query count. The v0.25 active-QSO exit guard and all seven interface languages remain intact. Every accepted `main` revision is packaged as a checksummed Windows x64 portable artifact. The same remote-copy model now also evaluates the player's RST/73 report: a partial copy produces `AGN? K` or `QRS? K`, an unreadable report remains recoverable, and only a copied retry can complete and settle the QSO.

## Rights and third-party software

Original project materials are copyright © 2026 Arsenic-er (koko), all rights reserved. No open-source license is granted for the original game code or artwork. Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
