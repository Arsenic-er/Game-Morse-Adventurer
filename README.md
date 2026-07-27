<div align="center">

# Game-Morse-Adventurer

### A pixel-art CW amateur radio station adventure

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

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

- Hard-edged dark pixel UI using the Fusion Bold Pixel font family.
- English, Simplified Chinese, Traditional Chinese, and Japanese interfaces.
- A location-aware Home management center with filter-highlighted station, warehouse, shop, log, achievement, and a new interactive `MORSE CODE` book hotspot that opens practice without leaving the active save.
- Three local save slots with a seven-character uppercase callsign, fixed starting location, swappable equipment, and credits.
- Standard Morse timing, fixed 650 Hz sidetone, decoding, rhythm scoring, and straight-key WPM detection.
- Straight-key input with `Space`; adjustable 5–40 WPM automatic paddle input with `Z` for dot and `X` for dash, including continuous hold-to-repeat.
- Independent CW practice for characters, fictional callsigns, straight key, and paddle. Guided, Standard, and Challenge difficulties set listening speed and lesson pass targets; staged curricula unlock one lesson at a time in every mode.
- A deterministic shuffled bag avoids repeats within a round and, when the active lesson pool permits, steers the next prompt away from the four most recent targets; each prompt settles at most once. Practice shows session summaries for attempts, accuracy, rhythm, weak characters, and lesson progress.
- With an active save, lifetime results and curriculum progress accumulate independently for all four modes. Practice-record schema v2 safely migrates older saves with conservative defaults; without a selected save, training remains available but records stay session-only.
- A player-led fictional QSO loop: the receiver opens automatically, the player calls CQ, propagation determines whether a station responds, and a successful contact continues through callsigns, RST, 73/SK, credits, and logging.
- A four-language first-watch briefing and full/hints/off duty coach teach each QSO stage without revealing the remote callsign during blind copy.
- `AGN K` repeats the same remote station over the same channel without changing propagation, attempts, or rewards; malformed messages retain their decoded text for correction instead of ending the QSO after two errors.
- QSO messages are validated in radio order: remote call, `DE`, player call, `RST`, report, `73`, then `K`; misplaced or missing procedural signs receive a specific correction instead of a false pass.
- Persistent QSO result pages and logbook entries include callsign, region, distance, RST, propagation, equipment, WPM, transmit accuracy, rhythm, repeat-request count, and a line-by-line operating review of accepted, rejected, and repeat attempts.
- Completing a QSO with guidance off and without opening visual assistance qualifies as an independent watch and awards an extra 50 credits on top of the 100-credit base reward.
- A four-language achievement archive derives six permanent milestones from durable QSO records and retained logs without granting duplicate rewards. Newly unlocked QSO achievements appear immediately in a non-blocking notification queue.
- Atomic, idempotent credit settlement prevents a completed QSO from being rewarded more than once.
- A four-language station store supports atomic purchases, persistent ownership, and warehouse-only equipment changes.
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

The automated suite covers the CW core and repeating keyer, receiver audio filtering, practice engine, blind-copy QSO state machine, strict QSO ordering and `AGN K` repeats, operating-review history, independent-watch reward eligibility, CQ response probability, persistent QSO logs and results, achievement derivation, idempotent credit settlement, store economy, radio/accessory ownership and loadouts, propagation model, map projection, and save data rules.

## Project status

Version **v0.18.0** deepens the existing CW curriculum without adding radios, antennas, or accessories. Guided, Standard, and Challenge difficulties provide progressively faster receive speeds and stricter pass targets; each practice mode now unlocks staged lessons from a compact starter set toward its complete pool. The active save retains each mode's difficulty, current lesson, partial lesson result, and completed lessons through practice-record schema v2, while legacy records migrate safely. A new interactive `MORSE CODE` book on Home opens the lesson-aware practice desk and returns the player to Home afterward. Every accepted `main` revision is packaged as a checksummed Windows x64 portable artifact.

## Rights and third-party software

Original project materials are copyright © 2026 Arsenic-er (koko), all rights reserved. No open-source license is granted for the original game code or artwork. Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
