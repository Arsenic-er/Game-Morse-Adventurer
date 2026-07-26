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
- A location-aware Home management center with filter-highlighted station, warehouse, shop, log, and achievement hotspots.
- Three local save slots with a seven-character uppercase callsign, fixed starting location, swappable equipment, and credits.
- Standard Morse timing, fixed 650 Hz sidetone, decoding, rhythm scoring, and straight-key WPM detection.
- Straight-key input with `Space`; adjustable 5–40 WPM automatic paddle input with `Z` for dot and `X` for dash, including continuous hold-to-repeat.
- Independent CW practice for characters, fictional callsigns, straight key, and paddle.
- A player-led fictional QSO loop: the receiver opens automatically, the player calls CQ, propagation determines whether a station responds, and a successful contact continues through callsigns, RST, 73/SK, credits, and logging.
- Persistent QSO result pages and logbook entries, including callsign, region, distance, RST, propagation, equipment, WPM, accuracy, and rhythm.
- A four-language achievement archive derives six permanent milestones from durable QSO records and retained logs without granting duplicate rewards.
- Atomic, idempotent credit settlement prevents a completed QSO from being rewarded more than once.
- A four-language station store supports atomic purchases, persistent ownership, and warehouse-only equipment changes.
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
| Send/replay the captured CQ or reply | `F2` |
| Save log or restart a failed QSO | `F3` |

## Development

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

The project currently has 85 automated tests covering the CW core and repeating keyer, receiver audio filtering, practice engine, player-led QSO state machine, CQ response probability, persistent QSO logs and results, achievement derivation, idempotent credit settlement, store economy, accessory ownership and loadouts, propagation model, map projection, and save data rules.

## Project status

Version **v0.13.0** replaces the start-screen placeholder alert with a complete four-section Station Manual in English, Simplified Chinese, Traditional Chinese, and Japanese. It explains save creation, always-on receiver listening and player-led CQ calls, straight-key and automatic-paddle controls, propagation, antennas, and the CW-500 filter without requiring an external guide. The station console's former misleading Delete label is now an explicit Clear Input action. The v0.12 CW-500 accessory, v2 inventory migration, and QSO equipment snapshots remain fully supported. Every accepted `main` revision is tested and packaged as a checksummed Windows x64 portable artifact without committing generated build directories to source control.

## Rights and third-party software

Original project materials are copyright © 2026 Arsenic-er (koko), all rights reserved. No open-source license is granted for the original game code or artwork. Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
